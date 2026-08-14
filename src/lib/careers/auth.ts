import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CandidateAccount = {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export async function getCandidateSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, account: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null };

  const { data } = await supabase
    .from("candidate_accounts")
    .select("id, full_name, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    account: (data as CandidateAccount | null) ?? null,
  };
}

export async function requireCandidateSession() {
  const session = await getCandidateSession();
  if (!session.user || !session.account) {
    redirect("/carreiras/entrar?error=session");
  }
  return session as typeof session & {
    supabase: NonNullable<typeof session.supabase>;
    user: NonNullable<typeof session.user>;
    account: CandidateAccount;
  };
}
