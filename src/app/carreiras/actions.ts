"use server";

import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import {
  candidateLoginSchema,
  candidatePasswordUpdateSchema,
  candidateRecoverySchema,
  candidateRegistrationSchema,
} from "@/lib/careers/auth-validation";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function careersCallbackUrl(next: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url.trim();
  const callback = new URL("/carreiras/auth/callback", baseUrl);
  callback.searchParams.set("next", next);
  return callback.toString();
}

export async function candidateLoginAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = candidateLoginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });
  if (!parsed.success) redirect("/carreiras/entrar?error=invalid");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/carreiras/entrar?error=config");
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/carreiras/entrar?error=credentials");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: account } = user
    ? await supabase
        .from("candidate_accounts")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  if (!account) {
    await supabase.auth.signOut();
    redirect("/carreiras/entrar?error=not-candidate");
  }
  redirect("/carreiras/perfil");
}

export async function candidateGoogleLoginAction() {
  requireCareersPortalEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/carreiras/entrar?error=config");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: careersCallbackUrl("/carreiras/perfil"),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/carreiras/entrar?error=google");
  redirect(data.url);
}

export async function candidateRegistrationAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = candidateRegistrationSchema.safeParse({
    fullName: formValue(formData, "full_name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    passwordConfirmation: formValue(formData, "password_confirmation"),
    acceptedTerms: formData.get("accepted_terms") === "on",
  });
  if (!parsed.success) redirect("/carreiras/cadastro?error=invalid");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/carreiras/cadastro?error=config");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: careersCallbackUrl("/carreiras/perfil"),
      data: {
        full_name: parsed.data.fullName,
        account_type: "candidate",
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) redirect("/carreiras/cadastro?error=signup");
  if (data.session) redirect("/carreiras/perfil");
  redirect("/carreiras/cadastro?status=check-email");
}

export async function candidateRequestPasswordAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = candidateRecoverySchema.safeParse({
    email: formValue(formData, "email"),
  });
  if (!parsed.success) {
    redirect("/carreiras/recuperar-senha?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/carreiras/recuperar-senha?error=config");
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: careersCallbackUrl("/carreiras/recuperar-senha?mode=update"),
  });
  redirect("/carreiras/recuperar-senha?status=check-email");
}

export async function candidateUpdatePasswordAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = candidatePasswordUpdateSchema.safeParse({
    password: formValue(formData, "password"),
    passwordConfirmation: formValue(formData, "password_confirmation"),
  });
  if (!parsed.success) {
    redirect("/carreiras/recuperar-senha?mode=update&error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/carreiras/recuperar-senha?mode=update&error=config");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/carreiras/recuperar-senha?error=expired");

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    redirect("/carreiras/recuperar-senha?mode=update&error=update");
  }
  await supabase.auth.signOut();
  redirect("/carreiras/entrar?status=password-updated");
}

export async function candidateLogoutAction() {
  requireCareersPortalEnabled();
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/carreiras/entrar?status=signed-out");
}
