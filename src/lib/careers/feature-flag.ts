export function isCareersPortalEnabled(
  value = process.env.CAREERS_PORTAL_ENABLED,
) {
  return value?.trim() === "true";
}
