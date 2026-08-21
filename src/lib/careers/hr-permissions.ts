import type { AdminProfile, HrAccessRole } from "@/types/cms";
import { hasAdminPermission } from "@/lib/admin/permissions";

export type HrPermission =
  | "dashboard:view"
  | "jobs:manage"
  | "processes:manage"
  | "candidates:manage"
  | "talent-bank:manage"
  | "assigned-candidates:evaluate"
  | "reports:view"
  | "settings:manage";

const permissionsByRole: Record<HrAccessRole, ReadonlySet<HrPermission>> = {
  administrator: new Set([
    "dashboard:view",
    "jobs:manage",
    "processes:manage",
    "candidates:manage",
    "talent-bank:manage",
    "assigned-candidates:evaluate",
    "reports:view",
    "settings:manage",
  ]),
  hr_manager: new Set([
    "dashboard:view",
    "jobs:manage",
    "processes:manage",
    "candidates:manage",
    "talent-bank:manage",
    "assigned-candidates:evaluate",
    "reports:view",
  ]),
  reviewer: new Set(["dashboard:view", "assigned-candidates:evaluate"]),
  viewer: new Set(["dashboard:view"]),
};

type HrProfile = Pick<AdminProfile, "role" | "hr_role">;

export function resolveHrAccessRole(
  profile: HrProfile | null | undefined,
): HrAccessRole | null {
  if (!profile) return null;
  if ("permissions" in profile) {
    const adminProfile = profile as AdminProfile;
    if (hasAdminPermission(adminProfile, "hr.manage")) return "administrator";
    if (hasAdminPermission(adminProfile, "hr.evaluate")) return "reviewer";
    if (hasAdminPermission(adminProfile, "hr.view")) return "viewer";
    return null;
  }
  if (profile.role === "super_admin" || profile.role === "admin") {
    return "administrator";
  }
  if (profile.role === "reception") return null;
  return profile.hr_role;
}

export function hasHrPermission(
  role: HrAccessRole | null,
  permission: HrPermission,
) {
  return role ? permissionsByRole[role].has(permission) : false;
}

export function canAccessHr(profile: HrProfile | null | undefined) {
  if (profile && "permissions" in profile)
    return hasAdminPermission(profile as AdminProfile, "hr.view");
  return hasHrPermission(resolveHrAccessRole(profile), "dashboard:view");
}
