"use server";

import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import {
  getCandidateResendAvailableAt,
  getPendingCandidateEmail,
  rememberPendingCandidateEmail,
  setCandidateResendCooldown,
} from "@/lib/careers/auth-pending";
import {
  candidateLoginSchema,
  candidatePasswordUpdateSchema,
  candidateRecoverySchema,
  candidateRegistrationSchema,
  safeCareersDestination,
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

function careersAuthUrl(
  path: "entrar" | "cadastro",
  reason: string,
  next: string,
) {
  const params = new URLSearchParams({ error: reason, next });
  return `/carreiras/${path}?${params.toString()}`;
}

export async function candidateLoginAction(formData: FormData) {
  requireCareersPortalEnabled();
  const next = safeCareersDestination(formValue(formData, "next"));
  const parsed = candidateLoginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });
  if (!parsed.success) redirect(careersAuthUrl("entrar", "invalid", next));

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(careersAuthUrl("entrar", "config", next));
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(careersAuthUrl("entrar", "credentials", next));

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
    redirect(careersAuthUrl("entrar", "not-candidate", next));
  }
  redirect(next);
}

export async function candidateGoogleLoginAction(formData: FormData) {
  requireCareersPortalEnabled();
  const next = safeCareersDestination(formValue(formData, "next"));
  const source =
    formValue(formData, "auth_source") === "cadastro" ? "cadastro" : "entrar";
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(careersAuthUrl(source, "config", next));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: careersCallbackUrl(next),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect(careersAuthUrl(source, "google", next));
  redirect(data.url);
}

export async function candidateRegistrationAction(formData: FormData) {
  requireCareersPortalEnabled();
  const next = safeCareersDestination(formValue(formData, "next"));
  const parsed = candidateRegistrationSchema.safeParse({
    fullName: formValue(formData, "full_name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    passwordConfirmation: formValue(formData, "password_confirmation"),
    acceptedTerms: formData.get("accepted_terms") === "on",
  });
  if (!parsed.success) redirect(careersAuthUrl("cadastro", "invalid", next));

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(careersAuthUrl("cadastro", "config", next));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: careersCallbackUrl(next),
      data: {
        full_name: parsed.data.fullName,
        account_type: "candidate",
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) redirect(careersAuthUrl("cadastro", "signup", next));
  if (data.session) redirect(next);
  await rememberPendingCandidateEmail(parsed.data.email);
  await setCandidateResendCooldown();
  const checkEmail = new URLSearchParams({ status: "check-email", next });
  redirect(`/carreiras/cadastro?${checkEmail.toString()}`);
}

export async function candidateResendConfirmationAction(formData: FormData) {
  requireCareersPortalEnabled();
  const next = safeCareersDestination(formValue(formData, "next"));
  const params = new URLSearchParams({ status: "check-email", next });
  const email = await getPendingCandidateEmail();
  if (!email) {
    params.set("resend", "expired");
    redirect(`/carreiras/cadastro?${params.toString()}`);
  }

  if ((await getCandidateResendAvailableAt()) > Date.now()) {
    params.set("resend", "wait");
    redirect(`/carreiras/cadastro?${params.toString()}`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    params.set("resend", "error");
    redirect(`/carreiras/cadastro?${params.toString()}`);
  }
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: careersCallbackUrl(next) },
  });
  if (error) {
    params.set(
      "resend",
      error.status === 429 || /rate/i.test(error.message) ? "wait" : "error",
    );
    redirect(`/carreiras/cadastro?${params.toString()}`);
  }

  await setCandidateResendCooldown();
  params.set("resend", "sent");
  redirect(`/carreiras/cadastro?${params.toString()}`);
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
