import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractText, getDocumentProxy } from "unpdf";
import {
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
