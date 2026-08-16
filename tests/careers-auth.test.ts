import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("usa somente nome e e-mail seguros da conta confirmada", () => {
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

test("Google não aparece no login nem no cadastro de candidatos", () => {
  const loginPage = readFileSync(
    new URL("../src/app/carreiras/(portal)/entrar/page.tsx", import.meta.url),
    "utf8",
  );
  const registrationPage = readFileSync(
    new URL("../src/app/carreiras/(portal)/cadastro/page.tsx", import.meta.url),
    "utf8",
  );
  const googleComponent = new URL(
    "../src/components/careers/google-auth-form.tsx",
    import.meta.url,
  );
  const googleProvider = new URL(
    "../src/lib/careers/auth-providers.ts",
    import.meta.url,
  );
  assert.doesNotMatch(loginPage, /GoogleAuthForm|Continuar com Google/);
  assert.doesNotMatch(registrationPage, /GoogleAuthForm|Continuar com Google/);
  assert.equal(existsSync(googleComponent), false);
  assert.equal(existsSync(googleProvider), false);
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
  assert.doesNotMatch(
    actions,
    /auth\.signUp|auth\.resend|candidateGoogleLoginAction|signInWithOAuth/,
  );
});

test("onboarding preserva o perfil existente do candidato", () => {
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
  assert.doesNotMatch(callback, /ensureCandidateOnboarding/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(onboarding, /ignoreDuplicates: true/);
  assert.match(onboarding, /CANDIDATE_PROFILE_SUFFICIENT_PERCENT/);
  assert.match(profile, /Complete seu perfil profissional/);
});

test("callback aceita apenas recuperação de senha", () => {
  const actions = readFileSync(
    new URL("../src/app/carreiras/actions.ts", import.meta.url),
    "utf8",
  );
  const callback = readFileSync(
    new URL("../src/app/carreiras/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /auth\.admin\.generateLink/);
  assert.match(actions, /sendCareerCommunication/);
  assert.doesNotMatch(actions, /resetPasswordForEmail|auth\.resend/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /type: "recovery"/);
  assert.match(callback, /type !== "recovery"/);
  assert.match(callback, /recuperar-senha\?mode=update/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.doesNotMatch(callback, /safeCareersDestination/);
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
  assert.match(adminActions, /auth\.admin\.createUser/);
  assert.doesNotMatch(adminActions, /inviteUserByEmail/);
});

test("recuperação de senha usa template próprio e não o mailer do Supabase", () => {
  const recovery = readFileSync(
    new URL(
      "../src/lib/careers/communications/templates/password-recovery.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(recovery, /Redefina sua senha/);
  assert.match(recovery, /recoveryUrl/);
  assert.equal(
    existsSync(new URL("../supabase/templates/recovery.html", import.meta.url)),
    false,
  );
});
