import { notFound } from "next/navigation";
import { isCareersPortalEnabled } from "./feature-flag";

export function requireCareersPortalEnabled() {
  if (!isCareersPortalEnabled()) notFound();
}
