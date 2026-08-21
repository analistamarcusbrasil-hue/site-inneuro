import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getOperationalEvaluator } from "@/lib/careers/operational-users";
import { CANDIDATE_RESUME_BUCKET } from "@/lib/careers/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session.user || !session.profile || !session.supabase) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const canManage = hasAdminPermission(session.profile, "hr.manage");
  const canEvaluate = hasAdminPermission(session.profile, "hr.evaluate");
  if (!canManage && !canEvaluate) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Currículo inválido" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Serviço indisponível" },
      { status: 503 },
    );
  }
  const { data: resume } = await admin
    .from("candidate_resumes")
    .select("id, candidate_id, storage_path, original_name, version")
    .eq("id", id)
    .maybeSingle();
  if (!resume)
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (!canManage) {
    const evaluator = await getOperationalEvaluator(admin, session.user.id);
    const { data: assignments } = await admin
      .from("career_application_evaluators")
      .select("application:career_job_applications!inner(candidate_id)")
      .eq("evaluator_id", session.user.id)
      .eq("application.candidate_id", resume.candidate_id)
      .limit(1);
    if (!evaluator || !assignments?.length) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
  }

  const { data, error } = await admin.storage
    .from(CANDIDATE_RESUME_BUCKET)
    .createSignedUrl(resume.storage_path, 120);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Arquivo indisponível" },
      { status: 503 },
    );
  }
  await session.supabase.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "candidate_resume_accessed",
    entity_type: "candidate_resume",
    entity_id: resume.id,
    after_data: {
      candidate_id: resume.candidate_id,
      version: resume.version,
      access:
        new URL(request.url).searchParams.get("download") === "1"
          ? "download"
          : "view",
    },
  });
  return NextResponse.redirect(data.signedUrl, 302);
}
