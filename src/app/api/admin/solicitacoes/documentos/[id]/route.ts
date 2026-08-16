import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SCHEDULING_BUCKET } from "@/lib/scheduling/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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
  if (!/^[0-9a-f-]{36}$/i.test(id))
    redirect("/admin/solicitacoes?error=document");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/solicitacoes?error=config");
  const { data: document } = await admin
    .from("appointment_request_documents")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (!document?.storage_path) redirect("/admin/solicitacoes?error=document");
  const { data, error } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .createSignedUrl(document.storage_path, 60, { download: true });
  if (error || !data?.signedUrl) redirect("/admin/solicitacoes?error=document");
  return Response.redirect(data.signedUrl, 302);
}
