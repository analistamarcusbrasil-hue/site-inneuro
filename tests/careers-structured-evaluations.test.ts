import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateEvaluationAverage,
  calculateHumanEvaluationAverage,
  containsProhibitedEvaluationCriterion,
  defaultEvaluationCriteria,
  evaluationCriteriaSchema,
  latestEvaluationByEvaluator,
  type CandidateEvaluation,
} from "../src/lib/careers/evaluations";
import { evaluationTemplateFormSchema } from "../src/lib/careers/evaluation-validation";

const applicationId = "6e36ad17-5450-4cdd-81d8-ae029d1bbd93";
const templateId = "5c8491ed-c79e-4ad9-a926-ceca7ca27aec";

function evaluation(
  evaluatorId: string,
  version: number,
  score: number,
  createdAt: string,
): CandidateEvaluation {
  return {
    id: `${version}e36ad17-5450-4cdd-81d8-ae029d1bbd9${version}`,
    application_id: applicationId,
    template_id: templateId,
    template_version: 1,
    evaluator_id: evaluatorId,
    evaluation_version: version,
    scores: Object.fromEntries(
      defaultEvaluationCriteria.map((criterion) => [criterion.id, score]),
    ),
    comment: null,
    created_at: createdAt,
  };
}

test("modelo mantém seis critérios profissionais e aceita customizações seguras", () => {
  assert.equal(
    evaluationCriteriaSchema.safeParse(defaultEvaluationCriteria).success,
    true,
  );
  assert.equal(
    evaluationTemplateFormSchema.safeParse({
      jobId: applicationId,
      customCriteria: ["Domínio do sistema da área"],
    }).success,
    true,
  );
  assert.equal(
    evaluationTemplateFormSchema.safeParse({
      jobId: applicationId,
      customCriteria: ["Aparência profissional"],
    }).success,
    false,
  );
});

test("bloqueia critérios pessoais protegidos", () => {
  for (const criterion of [
    "Aparência",
    "Sexo",
    "Idade",
    "Perfil bonito",
    "Raça",
    "Religião",
    "Estado civil",
    "Gravidez",
  ]) {
    assert.equal(containsProhibitedEvaluationCriterion(criterion), true);
  }
  assert.equal(
    containsProhibitedEvaluationCriterion("Conhecimento técnico"),
    false,
  );
});

test("escala calcula média individual entre 1 e 5", () => {
  assert.equal(calculateEvaluationAverage({ a: 5, b: 4, c: 3 }), 4);
  assert.equal(calculateEvaluationAverage({}), null);
});

test("média humana usa apenas a versão mais recente de cada avaliador", () => {
  const evaluatorA = "34067c18-ad08-4f92-995f-88d0fd468c10";
  const evaluatorB = "1074d5ab-323b-4d18-928f-bb750daf32c0";
  const evaluations = [
    evaluation(evaluatorA, 1, 1, "2026-08-15T10:00:00.000Z"),
    evaluation(evaluatorA, 2, 5, "2026-08-15T12:00:00.000Z"),
    evaluation(evaluatorB, 1, 3, "2026-08-15T11:00:00.000Z"),
  ];
  assert.equal(latestEvaluationByEvaluator(evaluations).length, 2);
  assert.equal(calculateHumanEvaluationAverage(evaluations), 4);
});

test("migração garante multiavaliador, histórico imutável e acesso atribuído", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150006_structured_candidate_evaluations.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /career_application_evaluators/);
  assert.match(migration, /career_evaluation_templates/);
  assert.match(migration, /career_candidate_evaluations/);
  assert.match(migration, /career_candidate_interviews/);
  assert.match(migration, /evaluation_version/);
  assert.match(migration, /evaluator_id/);
  assert.match(migration, /evaluation_history_is_immutable/);
  assert.match(migration, /is_assigned_application_evaluator/);
  assert.match(migration, /value::integer between 1 and 5/);
  assert.doesNotMatch(migration, /candidate reads candidate evaluations/i);
});

test("ações são auditáveis e nunca atualizam avaliação existente", () => {
  const actions = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/avaliacoes/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actions, /candidate_evaluation_submitted/);
  assert.match(actions, /candidate_interview_registered/);
  assert.match(actions, /application_evaluator_assigned/);
  assert.match(actions, /audit_logs/);
  assert.match(actions, /evaluationVersion/);
  assert.doesNotMatch(
    actions,
    /from\("career_candidate_evaluations"\)[\s\S]{0,180}\.update\(/,
  );
});

test("interface mantém média humana e aderência em blocos separados", () => {
  const page = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/avaliacoes/[applicationId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /Média das avaliações humanas/);
  assert.match(page, /Aderência automática à vaga/);
  assert.match(page, /não são somadas/);
  assert.match(page, /Avaliações individuais/);
});
