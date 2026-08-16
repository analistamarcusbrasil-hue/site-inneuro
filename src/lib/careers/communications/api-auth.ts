import "server-only";

import { getAdminSession } from "@/lib/cms/auth";
import {
  hasHrPermission,
  resolveHrAccessRole,
  type HrPermission,
} from "@/lib/careers/hr-permissions";

export async function getCareerCommunicationsApiSession(
  permission: HrPermission = "candidates:manage",
) {
  const session = await getAdminSession();
  if (!session.user || !session.profile || !session.supabase) {
    return { ok: false as const, status: 401 as const };
  }
  const role = resolveHrAccessRole(session.profile);
  if (!hasHrPermission(role, permission)) {
    return { ok: false as const, status: 403 as const };
  }
  return { ok: true as const, session };
}
