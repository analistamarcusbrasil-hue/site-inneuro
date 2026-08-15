import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/cms/auth";
import {
  hasHrPermission,
  resolveHrAccessRole,
} from "@/lib/careers/hr-permissions";
import { CANDIDATE_RESUME_BUCKET } from "@/lib/careers/profile";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session.user || !session.profile || !session.supabase) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const role = resolveHrAccessRole(session.profile);
  if (!hasHrPermission(role, "candidates:manage")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Currículo inválido" }, { status: 400 });
  }
  const { data: resume } = await session.supabase
    .from("candidate_resumes")
    .select("id, candidate_id, storage_path, original_name, version")
    .eq("id", id)
    .maybeSingle();
  if (!resume)
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const { data, error } = await session.supabase.storage
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
