export const isCmsConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const isCmsAdminConfigured = Boolean(
  isCmsConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY,
);
