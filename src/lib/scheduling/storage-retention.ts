import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEDULING_BUCKET } from "@/lib/scheduling/shared";

export async function isPersistedSchedulingDocument(
  admin: SupabaseClient,
  path: string,
) {
  const [original, preview] = await Promise.all([
    admin
      .from("appointment_request_documents")
      .select("id")
      .eq("storage_path", path)
      .limit(1)
      .maybeSingle(),
    admin
      .from("appointment_request_documents")
      .select("id")
      .eq("preview_storage_path", path)
      .limit(1)
      .maybeSingle(),
  ]);
  if (original.error || preview.error)
    throw new Error("SCHEDULING_PERSISTENCE_CHECK_FAILED");
  return Boolean(original.data || preview.data);
}

export async function removeUnpersistedSchedulingDocuments(
  admin: SupabaseClient,
  paths: string[],
) {
  await Promise.all(
    paths.map(async (path) => {
      if (await isPersistedSchedulingDocument(admin, path)) return;
      let result = await admin.storage.from(SCHEDULING_BUCKET).remove([path]);
      if (result.error) {
        result = await admin.storage.from(SCHEDULING_BUCKET).remove([path]);
      }
      if (result.error) throw new Error("SCHEDULING_CLEANUP_FAILED");
    }),
  );
}
