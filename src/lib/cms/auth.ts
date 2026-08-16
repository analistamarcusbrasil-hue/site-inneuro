import { redirect } from "next/navigation";
import type { AdminProfile, AppRole } from "@/types/cms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  hasAdminPermission,
  type AdminPermission,
} from "@/lib/admin/permissions";

export async function getAdminSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, profile: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, hr_role, email, active, access_profile, permissions, must_change_password, last_login_at",
    )
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
  if (!session.profile.active) {
    await session.supabase?.auth.signOut();
    redirect("/admin/login?error=inactive");
  }
  if (session.profile.must_change_password) redirect("/admin/definir-senha");
  if (roles && !roles.includes(session.profile.role)) redirect("/admin");
  return session as typeof session & {
    user: NonNullable<typeof session.user>;
    profile: AdminProfile;
    supabase: NonNullable<typeof session.supabase>;
  };
}

export async function requireAdminPermission(permission: AdminPermission) {
  const session = await requireAdmin();
  if (!hasAdminPermission(session.profile, permission))
    redirect("/admin?error=permission");
  return session;
}
