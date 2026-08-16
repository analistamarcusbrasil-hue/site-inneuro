import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractText, getDocumentProxy } from "unpdf";
import {
  assessResumeText,
  buildResumeFieldConflicts,
  countExtractedResumeFields,
  parseResumeText,
  resumeExtractionSchema,
} from "../src/lib/careers/resume-extraction";

function escapePdfText(value: string) {
  return value.replace(/([\\()])/g, "\\$1");
}

function createTextPdf(lines: string[]) {
  const commands = lines
    .map(
      (line, index) => `${index ? "0 -18 Td " : ""}(${escapePdfText(line)}) Tj`,
    )
    .join("\n");
  const stream = `BT /F1 11 Tf 72 760 Td\n${commands}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

test("PDF textual é lido localmente e convertido em dados estruturados", async () => {
  const bytes = createTextPdf([
    "Maria da Silva",
    "maria@example.com",
    "(96) 99999-9999",
    "Macapa - AP",
    "Objetivo profissional",
    "Atuar na area administrativa.",
    "Experiencia profissional",
    "Empresa: Clinica Exemplo",
    "Cargo: Assistente administrativa",
    "01/2022 - atual",
    "Atividades: Atendimento e organizacao de documentos.",
    "Habilidades",
    "Atendimento, Excel, Organizacao",
  ]);
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  await pdf.cleanup();
  const result = parseResumeText(text);
  assert.equal(result.fullName, "Maria da Silva");
  assert.equal(result.email, "maria@example.com");
  assert.equal(result.state, "AP");
  assert.equal(result.experiences.length, 1);
  assert.equal(result.experiences[0].isCurrent, true);
  assert.deepEqual(result.skills, ["Atendimento", "Excel", "Organizacao"]);
});

test("currículo incompleto deixa informações ausentes vazias", () => {
  const result = parseResumeText("Joao Pereira\njoao@example.com");
  assert.equal(result.fullName, "Joao Pereira");
  assert.equal(result.email, "joao@example.com");
  assert.equal(result.whatsapp, null);
  assert.equal(result.city, null);
  assert.deepEqual(result.experiences, []);
  assert.deepEqual(result.education, []);
});

test("currículo sem experiência continua válido", () => {
  const result = parseResumeText(
    "Ana Souza\nana@example.com\nObjetivo\nPrimeira oportunidade profissional.",
  );
  assert.equal(
    result.professionalObjective,
    "Primeira oportunidade profissional.",
  );
  assert.deepEqual(result.experiences, []);
  assert.equal(resumeExtractionSchema.safeParse(result).success, true);
});

test("currículo extenso é limitado sem inventar campos", () => {
  const result = parseResumeText(`Carlos Lima\n${"texto ".repeat(60_000)}`);
  assert.equal(result.fullName, "Carlos Lima");
  assert.equal(result.email, null);
  assert.equal(result.experiences.length, 0);
  assert.equal(countExtractedResumeFields(result), 1);
});

test("conflitos mostram diferenças sem alterar o perfil", () => {
  const extracted = parseResumeText(
    "Maria Silva\nnovo@example.com\nMacapa - AP\nObjetivo\nAtendimento ao publico.",
  );
  assert.deepEqual(
    buildResumeFieldConflicts(
      {
        fullName: "Maria Silva",
        email: "antigo@example.com",
        city: "Santana",
        state: "AP",
        professionalObjective: "Area administrativa.",
      },
      extracted,
    ).sort(),
    ["city", "email", "professionalObjective"].sort(),
  );
});

test("aceita títulos alternativos, colunas e períodos em formatos brasileiros", () => {
  const result = parseResumeText(`
Ana Paula Ribeiro                         ana.ribeiro@example.com
(96) 99123-4567                          Macapá/AP
SÍNTESE PROFISSIONAL
Profissional organizada com experiência em atendimento ao público.
HISTÓRICO PROFISSIONAL
Recepcionista | Clínica Horizonte | mar/2022 - atual
Recepção de pacientes, orientação e organização do fluxo de atendimento.
Assistente administrativa | Empresa Norte | 2019 a 2021
Atendimento presencial e apoio a documentos.
FORMAÇÃO ESCOLAR
Ensino Médio Completo | Escola Estadual Central | 2018
CURSOS COMPLEMENTARES
Excel Avançado | SENAC | 2023
Atendimento ao Cliente | SENAI | 2022
PRINCIPAIS COMPETÊNCIAS
Comunicação • Organização • Cordialidade • Atendimento
`);
  assert.equal(result.fullName, "Ana Paula Ribeiro");
  assert.equal(result.email, "ana.ribeiro@example.com");
  assert.equal(result.state, "AP");
  assert.equal(result.experiences.length, 2);
  assert.equal(result.experiences[0].jobTitle, "Recepcionista");
  assert.equal(result.experiences[0].startMonth, "2022-03");
  assert.equal(result.education[0].educationLevel, "Ensino médio");
  assert.equal(result.education[0].institution, "Escola Estadual Central");
  assert.equal(result.certifications.length, 2);
  assert.deepEqual(result.skills, [
    "Comunicação",
    "Organização",
    "Cordialidade",
    "Atendimento",
  ]);
});

test("remove informações repetidas sem perder a primeira grafia", () => {
  const result = parseResumeText(`
Marina Lopes
marina@example.com
Habilidades
Atendimento, atendimento, Organização, organização
Cursos
Excel | SENAC | 2024
Excel | SENAC | 2024
`);
  assert.deepEqual(result.skills, ["Atendimento", "Organização"]);
  assert.equal(result.certifications.length, 1);
});

test("diferencia PDF escaneado, texto insuficiente e currículo textual", () => {
  assert.equal(assessResumeText("").quality, "image_only");
  assert.equal(assessResumeText("Maria Silva").quality, "insufficient");
  assert.equal(
    assessResumeText(
      "Maria Silva possui experiência profissional em atendimento ao público, organização de documentos e rotinas administrativas desde 2020.",
    ).quality,
    "native_text",
  );
});

test("PDF inválido é rejeitado pelo leitor", async () => {
  await assert.rejects(() =>
    getDocumentProxy(new TextEncoder().encode("arquivo inválido")),
  );
});

test("migração protege extrações e registra origem confirmada", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608140004_resume_profile_extraction.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /candidate_resume_extractions/);
  assert.match(migration, /candidate_id = auth\.uid\(\)/);
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.match(migration, /data_source in \('manual', 'resume'\)/);
  assert.match(migration, /foreign key \(source_extraction_id, candidate_id\)/);
  assert.match(migration, /grant update \(status, applied_at, ignored_at\)/);
  assert.doesNotMatch(
    migration,
    /grant select, insert, update on public\.candidate_resume_extractions/,
  );
  assert.doesNotMatch(migration, /create policy[^;]+to anon/i);
  assert.doesNotMatch(migration, /raw_text|pdf_content|resume_text/i);
});

test("revisão protege valores manuais e oferece aplicação em lote auditável", () => {
  const page = readFileSync(
    new URL(
      "../src/app/carreiras/(portal)/perfil/revisar-curriculo/[id]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const action = readFileSync(
    new URL("../src/app/carreiras/resume-review-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(page, /defaultChecked=\{!conflict\}/);
  assert.match(page, /Aplicar todas as informações identificadas/);
  assert.match(action, /const applyAll = value\(formData, "apply_all"\)/);
  assert.match(action, /data_source: "resume"/);
  assert.match(action, /source_extraction_id: extractionId/);
});
