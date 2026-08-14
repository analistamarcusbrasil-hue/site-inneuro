import type { AdminProfile, HrAccessRole } from "@/types/cms";

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
};

type HrProfile = Pick<AdminProfile, "role" | "hr_role">;

export function resolveHrAccessRole(
  profile: HrProfile | null | undefined,
): HrAccessRole | null {
  if (!profile) return null;
  if (profile.role === "super_admin" || profile.role === "admin") {
    return "administrator";
  }
  return profile.hr_role;
}

export function hasHrPermission(
  role: HrAccessRole | null,
  permission: HrPermission,
) {
  return role ? permissionsByRole[role].has(permission) : false;
}

export function canAccessHr(profile: HrProfile | null | undefined) {
  return hasHrPermission(resolveHrAccessRole(profile), "dashboard:view");
}
