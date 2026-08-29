import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateNps, isCriticalSurveyResponse, surveyDateRange, visibleSurveyQuestions } from "../src/lib/surveys/logic";
import type { SurveyQuestion, SurveyRule } from "../src/lib/surveys/types";

const root = process.cwd();
const migration = readFileSync(`${root}/supabase/migrations/20260829021615_survey_rls_storage_and_functions.sql`, "utf8");
const seed = readFileSync(`${root}/supabase/migrations/20260829021618_survey_initial_campaign_and_questions.sql`, "utf8");
const publicPage = readFileSync(`${root}/src/app/q/s/[token]/page.tsx`, "utf8");
const finishRoute = readFileSync(`${root}/src/app/api/pesquisas/satisfacao/concluir/route.ts`, "utf8");
const audioRoute = readFileSync(`${root}/src/app/api/pesquisas/satisfacao/audio/route.ts`, "utf8");

function question(id: string, conditional = false): SurveyQuestion { return { id, stable_key: id, sort_order: 0, active: true, version: { id: `${id}-version`, version_number: 1, category: conditional ? "DIAGNOSTICO" : "RECEPCAO", question_type: conditional ? "SINGLE_CHOICE" : "STAR_5", title: id, description: null, required: !conditional, allow_na: false, configuration: { conditional }, options: [] } }; }

test("A/B — rota exige QR longo e oferece estado inválido amigável", () => { assert.match(publicPage, /getSurveyPublicDefinition/); assert.match(publicPage, /Pesquisa indisponível/); assert.match(seed, /gen_random_bytes\(36\)/); assert.match(seed, /stable_token/); });
test("C/D — perguntas condicionais só aparecem quando a regra corresponde", () => { const base=question("base"); const extra=question("extra",true); const rules: SurveyRule[]=[{id:"r",source_question_id:"base",operator:"LTE",comparison_value:3,target_question_id:"extra",action:"SHOW"}]; assert.deepEqual(visibleSurveyQuestions([base,extra],rules,{base:{numericValue:5}}).map((item)=>item.id),["base"]); assert.deepEqual(visibleSurveyQuestions([base,extra],rules,{base:{numericValue:3}}).map((item)=>item.id),["base","extra"]); });
test("E/F — texto conclui pela transação e áudio usa bucket privado", () => { assert.match(finishRoute, /complete_survey_response/); assert.match(finishRoute, /textContent/); assert.match(audioRoute, /SURVEY_AUDIO_BUCKET/); assert.match(migration, /'survey-feedback-audio', 'survey-feedback-audio', false/); assert.match(migration, /create policy "survey users read authorized audio"/); });
test("G — NPS classifica detratores, neutros e promotores corretamente", () => { assert.deepEqual(calculateNps([0,6,7,8,9,10]),{nps:0,promoters:2,passives:2,detractors:2}); });
test("H — permissões são exigidas nas rotas administrativas", () => { const responses=readFileSync(`${root}/src/app/admin/(protected)/pesquisas/satisfacao/respostas/page.tsx`,"utf8"); const builder=readFileSync(`${root}/src/app/api/admin/pesquisas/perguntas/route.ts`,"utf8"); assert.match(responses,/requireAdminPermission\("surveys\.view"\)/); assert.match(builder,/surveys\.manage/); });
test("I — edição cria versão nova e respostas preservam question_version_id", () => { const builder=readFileSync(`${root}/src/app/api/admin/pesquisas/perguntas/route.ts`,"utf8"); assert.match(builder,/version_number/); assert.match(migration,/survey_question_versions_are_immutable/); assert.match(migration,/question_version_id/); });
test("J — períodos produzem limites exclusivos consistentes", () => { const range=surveyDateRange("7d",undefined,undefined,new Date("2026-08-28T12:00:00-03:00")); assert.equal((range.exclusiveEnd.getTime()-range.start.getTime())/(24*60*60*1000),7); });
test("K — snapshot é único, idempotente e só regenera com surveys.admin", () => { assert.match(migration,/existing_record\.id is not null and not p_force/); assert.match(migration,/survey_admin_required/); assert.match(migration,/SURVEY_MONTHLY_SNAPSHOT_REGENERATED/); });
test("L — RLS e escopo de organização/unidade protegem isolamento", () => { assert.match(migration,/enable row level security/); assert.match(migration,/can_access_survey_tenant/); assert.match(migration,/organization_id/); assert.match(migration,/unit_id/); });
test("regra crítica centralizada cobre nota, NPS e duas dimensões", () => { assert.equal(isCriticalSurveyResponse({overall:2,nps:10,dimensions:[]}),true); assert.equal(isCriticalSurveyResponse({overall:5,nps:6,dimensions:[]}),true); assert.equal(isCriticalSurveyResponse({overall:5,nps:10,dimensions:[2,2]}),true); assert.equal(isCriticalSurveyResponse({overall:5,nps:10,dimensions:[4,5]}),false); });
