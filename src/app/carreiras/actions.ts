"use server";

import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import {
  candidateLoginSchema,
  candidatePasswordUpdateSchema,
  candidateRecoverySchema,
  candidateRegistrationSchema,
  safeCareersDestination,
} from "@/lib/careers/auth-validation";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import { ensureCandidateOnboarding } from "@/lib/careers/candidate-onboarding";
import { sendCareerCommunication } from "@/lib/careers/communications/service";
import { consumeCandidateRegistrationRateLimit } from "@/lib/careers/registration-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function careersRecoveryCallbackUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url.trim();
  const callback = new URL("/carreiras/auth/callback", baseUrl);
  callback.searchParams.set("type", "recovery");
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

function isExistingCandidateError(error: { code?: string; message: string }) {
  return (
    ["email_exists", "user_already_exists"].includes(error.code ?? "") ||
    /already|registered|exists/i.test(error.message)
  );
}

async function rollbackCandidateRegistration(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
) {
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
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

  const admin = createSupabaseAdminClient();
  if (!admin) redirect(careersAuthUrl("cadastro", "config", next));

  let registrationAllowed = false;
  try {
    registrationAllowed = await consumeCandidateRegistrationRateLimit(admin);
  } catch {
    redirect(careersAuthUrl("cadastro", "config", next));
  }
  if (!registrationAllowed) {
    redirect(careersAuthUrl("cadastro", "rate-limit", next));
  }

  const termsAcceptedAt = new Date().toISOString();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      account_type: "candidate",
      terms_accepted_at: termsAcceptedAt,
    },
  });
  if (error || !data.user) {
    const reason =
      error && isExistingCandidateError(error) ? "email-exists" : "signup";
    redirect(careersAuthUrl("cadastro", reason, next));
  }

  try {
    await ensureCandidateOnboarding(admin, data.user);
  } catch {
    await rollbackCandidateRegistration(admin, data.user.id);
    redirect(careersAuthUrl("cadastro", "account", next));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    await rollbackCandidateRegistration(admin, data.user.id);
    redirect(careersAuthUrl("cadastro", "config", next));
  }
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (signInError) {
    await rollbackCandidateRegistration(admin, data.user.id);
    redirect(careersAuthUrl("cadastro", "session", next));
  }
  redirect(next);
}

export async function candidateRequestPasswordAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = candidateRecoverySchema.safeParse({
    email: formValue(formData, "email"),
  });
  if (!parsed.success) {
    redirect("/carreiras/recuperar-senha?error=invalid");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/carreiras/recuperar-senha?error=config");
  const { data: targets } = await admin.rpc("get_candidate_recovery_target", {
    p_email: parsed.data.email,
  });
  const target = Array.isArray(targets) ? targets[0] : targets;
  if (!target) redirect("/carreiras/recuperar-senha?status=check-email");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: target.recipient_email,
    options: { redirectTo: careersRecoveryCallbackUrl() },
  });
  if (!error && data.properties.action_link) {
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
    await sendCareerCommunication(
      {
        candidateId: target.candidate_id,
        template: "PASSWORD_RECOVERY",
        recipientKind: "candidate",
        recipient: target.recipient_email,
        variables: {
          candidateName: target.candidate_name,
          recoveryUrl: data.properties.action_link,
        },
        triggeredBy: "candidate",
        idempotencyKey: `candidate:${target.candidate_id}:recovery:${bucket}`,
      },
      { recoveryUrl: data.properties.action_link },
    ).catch(() => undefined);
  }
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
