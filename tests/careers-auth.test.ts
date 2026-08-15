import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  candidateRegistrationSchema,
  normalizeCandidateName,
  safeCareersDestination,
} from "../src/lib/careers/auth-validation";
import { getCandidateIdentityFromAuthUser } from "../src/lib/careers/candidate-identity";

const validRegistration = {
  fullName: "Maria da Silva",
  email: "maria@example.com",
  password: "senha-segura-123",
  passwordConfirmation: "senha-segura-123",
  acceptedTerms: true as const,
};

test("aceita cadastro mínimo válido de candidato", () => {
  assert.equal(
    candidateRegistrationSchema.safeParse(validRegistration).success,
    true,
  );
});

test("rejeita senha divergente e ausência de aceite", () => {
  assert.equal(
    candidateRegistrationSchema.safeParse({
      ...validRegistration,
      passwordConfirmation: "outra-senha",
    }).success,
    false,
  );
  assert.equal(
    candidateRegistrationSchema.safeParse({
      ...validRegistration,
      acceptedTerms: false,
    }).success,
    false,
  );
});

test("callback aceita somente destinos internos previstos", () => {
  assert.equal(
    safeCareersDestination("/carreiras/recuperar-senha?mode=update"),
    "/carreiras/recuperar-senha?mode=update",
  );
  assert.equal(
    safeCareersDestination("https://example.com"),
    "/carreiras/perfil",
  );
  assert.equal(safeCareersDestination("//example.com"), "/carreiras/perfil");
  assert.equal(
    safeCareersDestination(
      "/carreiras/vagas/assistente-de-atendimento/candidatar",
    ),
    "/carreiras/vagas/assistente-de-atendimento/candidatar",
  );
  assert.equal(
    safeCareersDestination("/carreiras/vagas/../admin/candidatar"),
    "/carreiras/perfil",
  );
});

test("normaliza nome ausente sem inventar dados profissionais", () => {
  assert.equal(normalizeCandidateName("  Ana Souza  "), "Ana Souza");
  assert.equal(normalizeCandidateName(""), "Candidato");
});

test("usa somente nome e e-mail seguros fornecidos pelo Google", () => {
  const identity = getCandidateIdentityFromAuthUser({
    email: "ana@example.com",
    user_metadata: {
      full_name: "  Ana Souza  ",
      avatar_url: "https://example.com/foto.jpg",
      locale: "pt-BR",
    },
    identities: [],
  });
  assert.deepEqual(identity, {
    fullName: "Ana Souza",
    email: "ana@example.com",
  });
});

test("aceita nome do identity_data sem inferir campos ausentes", () => {
  const identity = getCandidateIdentityFromAuthUser({
    email: undefined,
    user_metadata: {},
    identities: [
      {
        id: "google-id",
        user_id: "candidate-id",
        identity_id: "identity-id",
        provider: "google",
        identity_data: {
          given_name: "Maria",
          family_name: "Silva",
          email: "maria@example.com",
          picture: "https://example.com/foto.jpg",
        },
        created_at: "2026-08-15T00:00:00.000Z",
        updated_at: "2026-08-15T00:00:00.000Z",
        last_sign_in_at: "2026-08-15T00:00:00.000Z",
      },
    ],
  });
  assert.deepEqual(identity, {
    fullName: "Maria Silva",
    email: "maria@example.com",
  });
});

test("login com Google só aparece quando o provedor estiver habilitado", () => {
  const page = readFileSync(
    new URL("../src/app/carreiras/(portal)/entrar/page.tsx", import.meta.url),
    "utf8",
  );
  const providers = readFileSync(
    new URL("../src/lib/careers/auth-providers.ts", import.meta.url),
    "utf8",
  );
  assert.match(page, /isCandidateGoogleAuthEnabled/);
  assert.match(page, /googleEnabled \?/);
  assert.match(providers, /\/auth\/v1\/settings/);
  assert.match(providers, /settings\.external\?\.google === true/);
});

test("cadastro oferece Google quando habilitado e separa o estado check-email", () => {
  const page = readFileSync(
    new URL("../src/app/carreiras/(portal)/cadastro/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /GoogleAuthForm/);
  assert.match(page, /source="cadastro"/);
  assert.match(page, /checkEmail \?/);
  assert.match(page, /Confirme seu e-mail/);
  assert.match(page, /ResendConfirmationForm/);
});

test("botão Google informa carregamento e callback não sobrescreve perfil", () => {
  const button = readFileSync(
    new URL("../src/components/careers/google-auth-form.tsx", import.meta.url),
    "utf8",
  );
  const callback = readFileSync(
    new URL("../src/app/carreiras/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  const onboarding = readFileSync(
    new URL("../src/lib/careers/candidate-onboarding.ts", import.meta.url),
    "utf8",
  );
  const profile = readFileSync(
    new URL(
      "../src/app/carreiras/(portal)/perfil/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(button, /useFormStatus/);
  assert.match(button, /Conectando ao Google/);
  assert.match(callback, /ensureCandidateOnboarding/);
  assert.match(onboarding, /ignoreDuplicates: true/);
  assert.match(onboarding, /CANDIDATE_PROFILE_SUFFICIENT_PERCENT/);
  assert.match(profile, /Complete seu perfil profissional/);
});

test("reenvio usa API oficial, callback seguro e cooldown assinado", () => {
  const actions = readFileSync(
    new URL("../src/app/carreiras/actions.ts", import.meta.url),
    "utf8",
  );
  const callback = readFileSync(
    new URL("../src/app/carreiras/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  const pending = readFileSync(
    new URL("../src/lib/careers/auth-pending.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /supabase\.auth\.resend\(\{/);
  assert.match(actions, /type: "signup"/);
  assert.match(actions, /setCandidateResendCooldown/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /safeCareersDestination/);
  assert.match(pending, /createHmac\("sha256"/);
  assert.match(pending, /httpOnly: true/);
  assert.match(pending, /sameSite: "lax"/);
});

test("templates Auth usam token hash e retorno SSR do Carreiras", () => {
  const confirmation = readFileSync(
    new URL("../supabase/templates/confirmation.html", import.meta.url),
    "utf8",
  );
  const recovery = readFileSync(
    new URL("../supabase/templates/recovery.html", import.meta.url),
    "utf8",
  );
  assert.match(confirmation, /Confirme seu cadastro/);
  assert.match(confirmation, /\.RedirectTo/);
  assert.match(confirmation, /\.TokenHash/);
  assert.match(confirmation, /type=email/);
  assert.match(recovery, /Redefina sua senha/);
  assert.match(recovery, /type=recovery/);
});
