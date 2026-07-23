import { redirect } from "next/navigation";
import type { AdminProfile, AppRole } from "@/types/cms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAdminSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, profile: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    profile: (data as AdminProfile | null) ?? null,
  };
}

export async function requireAdmin(roles?: AppRole[]) {
  const session = await getAdminSession();
  if (!session.user || !session.profile) redirect("/admin/login");
  if (roles && !roles.includes(session.profile.role)) redirect("/admin");
  return session as typeof session & {
    user: NonNullable<typeof session.user>;
    profile: AdminProfile;
    supabase: NonNullable<typeof session.supabase>;
  };
}
