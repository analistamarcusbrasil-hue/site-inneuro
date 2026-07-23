import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type CmsConnectionStatus =
  | { configured: false; database: "not_configured" }
  | { configured: true; database: "connected" | "query_failed" };

export async function getCmsConnectionStatus(): Promise<CmsConnectionStatus> {
  if (!isSupabaseConfigured()) {
    return { configured: false, database: "not_configured" };
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return { configured: false, database: "not_configured" };
    }

    const { error } = await supabase
      .schema("public")
      .from("site_settings")
      .select("value")
      .eq("key", "cms_connection_status")
      .maybeSingle();

    if (error) {
      return { configured: true, database: "query_failed" };
    }

    return { configured: true, database: "connected" };
  } catch {
    return { configured: true, database: "query_failed" };
  }
}
