import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runResumeOptimizer } from "@/lib/portal-guardian/resume-optimizer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const guardianSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!guardianSecret || !supabaseUrl) {
    return Response.json(
      { error: "Portal Guardian não configurado." },
      { status: 503 },
    );
  }

  // A execução nasce em dry run e só muda com uma variável explícita no ambiente.
  const dryRun = process.env.PORTAL_GUARDIAN_EXECUTION_MODE !== "active";
  const response = await fetch(`${supabaseUrl}/functions/v1/portal-guardian`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${guardianSecret}`,
    },
    body: JSON.stringify({ dryRun, batchSize: 100 }),
    cache: "no-store",
  });
  const lifecycle = (await response.json()) as {
    ok?: boolean;
    runId?: string;
    error?: string;
  };
  if (!response.ok || !lifecycle.ok || !lifecycle.runId) {
    return Response.json(
      { error: "Falha no ciclo de vida do Guardian." },
      { status: 502 },
    );
  }

  let resumes = null;
  if (!dryRun) {
    const admin = createSupabaseAdminClient();
    if (!admin)
      return Response.json({ error: "Serviço indisponível." }, { status: 503 });
    const started = await admin.rpc("portal_guardian_begin_job", {
      p_job_name: "portal_guardian_resume_optimizer",
      p_dry_run: false,
    });
    if (started.error || !started.data) {
      return Response.json(
        { error: "Não foi possível iniciar o otimizador." },
        { status: 502 },
      );
    }
    const resumeRunId = String(started.data);
    try {
      resumes = await runResumeOptimizer(admin, resumeRunId, 8);
      await admin.rpc("portal_guardian_finish_job", {
        p_run_id: resumeRunId,
        p_status: resumes.failed ? "PARTIAL" : "SUCCESS",
        p_scanned: resumes.scanned,
        p_affected: resumes.optimized,
        p_failed: resumes.failed,
        p_bytes_freed: resumes.bytesFreed,
        p_summary: { skipped: resumes.skipped },
        p_error_code: null,
      });
    } catch {
      await admin.rpc("portal_guardian_finish_job", {
        p_run_id: resumeRunId,
        p_status: "FAILED",
        p_scanned: 0,
        p_affected: 0,
        p_failed: 1,
        p_bytes_freed: 0,
        p_summary: {},
        p_error_code: "resume_optimizer_failed",
      });
      return Response.json(
        { error: "Falha no otimizador de currículos." },
        { status: 502 },
      );
    }
  }
  return Response.json(
    { ok: true, dryRun, runId: lifecycle.runId, resumes },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
