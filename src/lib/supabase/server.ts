import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isCmsConfigured } from "@/lib/cms/config";

export async function createSupabaseServerClient() {
  if (!isCmsConfigured) return null;

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies. The proxy refreshes sessions.
          }
        },
      },
    },
  );
}
