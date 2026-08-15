import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateRegistrationSchema,
  normalizeCandidateName,
  safeCareersDestination,
} from "../src/lib/careers/auth-validation";

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
