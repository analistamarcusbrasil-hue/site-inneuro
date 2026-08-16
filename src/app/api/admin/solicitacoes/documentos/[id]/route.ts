import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAdminSession();
  if (!user || !profile)
    return Response.json(
      { error: "Autenticação necessária." },
      { status: 401 },
    );
  if (!hasAdminPermission(profile, "scheduling.view"))
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return Response.json({ error: "Documento inválido." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin)
    return Response.json({ error: "Serviço indisponível." }, { status: 503 });
  const { data: document } = await admin
    .from("appointment_request_documents")
    .select("appointment_request_id")
    .eq("id", id)
    .maybeSingle();
  if (!document?.appointment_request_id)
    return Response.json(
      { error: "Documento não encontrado." },
      { status: 404 },
    );
  const response = NextResponse.redirect(
    new URL(
      `/api/admin/solicitacoes/${document.appointment_request_id}/documentos/${id}/download`,
      request.url,
    ),
    307,
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
