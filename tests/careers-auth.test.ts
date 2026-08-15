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
    "/carreiras/vagas",
  );
  assert.equal(safeCareersDestination("//example.com"), "/carreiras/vagas");
  assert.equal(
    safeCareersDestination(
      "/carreiras/vagas/assistente-de-atendimento/candidatar",
    ),
    "/carreiras/vagas/assistente-de-atendimento/candidatar",
  );
  assert.equal(
    safeCareersDestination("/carreiras/vagas/../admin/candidatar"),
    "/carreiras/vagas",
  );
  assert.equal(safeCareersDestination(null), "/carreiras/vagas");
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

test("Google não aparece no login nem no cadastro de candidatos", () => {
  const loginPage = readFileSync(
    new URL("../src/app/carreiras/(portal)/entrar/page.tsx", import.meta.url),
    "utf8",
  );
  const registrationPage = readFileSync(
    new URL("../src/app/carreiras/(portal)/cadastro/page.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(loginPage, /GoogleAuthForm|Continuar com Google/);
  assert.doesNotMatch(registrationPage, /GoogleAuthForm|Continuar com Google/);
});

test("cadastro administrativo confirma e autentica o candidato imediatamente", () => {
  const actions = readFileSync(
    new URL("../src/app/carreiras/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /createSupabaseAdminClient/);
  assert.match(actions, /admin\.auth\.admin\.createUser/);
  assert.match(actions, /email_confirm: true/);
  assert.match(actions, /account_type: "candidate"/);
  assert.match(actions, /ensureCandidateOnboarding\(admin, data\.user\)/);
  assert.match(actions, /supabase\.auth\.signInWithPassword/);
  assert.match(actions, /consumeCandidateRegistrationRateLimit/);
  assert.match(actions, /rollbackCandidateRegistration/);
  assert.doesNotMatch(actions, /auth\.signUp|auth\.resend/);
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
    new URL("../src/app/carreiras/(portal)/perfil/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(button, /useFormStatus/);
  assert.match(button, /Conectando ao Google/);
  assert.match(callback, /ensureCandidateOnboarding/);
  assert.match(onboarding, /ignoreDuplicates: true/);
  assert.match(onboarding, /CANDIDATE_PROFILE_SUFFICIENT_PERCENT/);
  assert.match(profile, /Complete seu perfil profissional/);
});

test("callback mantém destino seguro para OAuth e recuperação de senha", () => {
  const actions = readFileSync(
    new URL("../src/app/carreiras/actions.ts", import.meta.url),
    "utf8",
  );
  const callback = readFileSync(
    new URL("../src/app/carreiras/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /resetPasswordForEmail/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /type: "recovery"/);
  assert.match(callback, /if \(isRecovery\)/);
  assert.match(callback, /safeCareersDestination/);
});

test("cadastro limita abuso sem expor a Service Role no cliente", () => {
  const limiter = readFileSync(
    new URL("../src/lib/careers/registration-rate-limit.ts", import.meta.url),
    "utf8",
  );
  const adminClient = readFileSync(
    new URL("../src/lib/supabase/admin.ts", import.meta.url),
    "utf8",
  );
  const registrationPage = readFileSync(
    new URL("../src/app/carreiras/(portal)/cadastro/page.tsx", import.meta.url),
    "utf8",
  );
  const adminActions = readFileSync(
    new URL("../src/app/admin/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(limiter, /consume_contact_rate_limit/);
  assert.match(limiter, /createHmac\("sha256"/);
  assert.match(adminClient, /^import "server-only";/);
  assert.doesNotMatch(registrationPage, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(adminActions, /inviteUserByEmail/);
});

test("recuperação de senha mantém template com retorno SSR do Carreiras", () => {
  const recovery = readFileSync(
    new URL("../supabase/templates/recovery.html", import.meta.url),
    "utf8",
  );
  assert.match(recovery, /Redefina sua senha/);
  assert.match(recovery, /type=recovery/);
});
