import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/cms/auth";
import { isCareersPortalEnabled } from "./feature-flag";
import { hasHrPermission, resolveHrAccessRole } from "./hr-permissions";

export async function requireCareersJobsAccess() {
  if (isCareersPortalEnabled()) return { isInternalPreview: false };
  const { profile } = await getAdminSession();
  const role = resolveHrAccessRole(profile);
  if (!hasHrPermission(role, "jobs:manage")) notFound();
  return { isInternalPreview: true };
}
