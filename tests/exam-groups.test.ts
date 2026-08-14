import assert from "node:assert/strict";
import test from "node:test";
import { exames } from "../src/data/exames";
import { modalities } from "../src/data/modalidades";
import {
  createExamGroups,
  findExamGroup,
  hasExamDetails,
} from "../src/lib/exams/groups";

const groups = createExamGroups(exames, modalities);

test("mantém exatamente os quatro grupos atuais e suas contagens", () => {
  assert.deepEqual(
    groups.map((group) => [group.slug, group.exams.length]),
    [
      ["diagnostico-por-imagem", 6],
      ["neurofisiologia-exames-funcionais", 2],
      ["outros", 1],
      ["atendimento-medico", 1],
    ],
  );
});

test("cada exame ativo pertence a um único grupo", () => {
  const groupedSlugs = groups.flatMap((group) =>
    group.exams.map((exam) => exam.slug),
  );
  const activeSlugs = exames
    .filter((exam) => exam.active)
    .map((exam) => exam.slug);
  assert.equal(new Set(groupedSlugs).size, groupedSlugs.length);
  assert.deepEqual([...groupedSlugs].sort(), [...activeSlugs].sort());
});

test("preserva o catálogo atual sem Eletroneuromiografia", () => {
  const names = groups.flatMap((group) => group.exams.map((exam) => exam.name));
  assert.equal(names.includes("Eletroneuromiografia"), false);
  assert.equal(names.includes("Teste Ergométrico"), true);
});

test("preserva o destaque da Ressonância do Coração", () => {
  const exam = exames.find((item) => item.slug === "ressonancia-do-coracao");
  assert.equal(exam?.badge, "Exclusivo");
});

test("só oferece detalhes quando existe conteúdo confiável", () => {
  const consultas = exames.find((item) => item.slug === "consultas");
  const tomografia = exames.find(
    (item) => item.slug === "tomografia-computadorizada",
  );
  assert.ok(consultas);
  assert.ok(tomografia);
  assert.equal(hasExamDetails(consultas), false);
  assert.equal(hasExamDetails(tomografia), true);
});

test("grupo inexistente não é resolvido", () => {
  assert.equal(findExamGroup(groups, "grupo-inexistente"), undefined);
});
