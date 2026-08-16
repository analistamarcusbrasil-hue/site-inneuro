import { redirect } from "next/navigation";
import {
  hasHrPermission,
  resolveHrAccessRole,
  type HrPermission,
} from "@/lib/careers/hr-permissions";
import { requireAdmin } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function requireHrAccess(
  permission: HrPermission = "dashboard:view",
) {
  const session = await requireAdmin();
  if (!hasAdminPermission(session.profile, "hr.view")) {
    redirect("/admin?error=permission");
  }
  const hrRole = resolveHrAccessRole(session.profile);

  if (!hasHrPermission(hrRole, permission)) {
    redirect("/admin?error=permission");
  }

  return { ...session, hrRole: hrRole as NonNullable<typeof hrRole> };
}
