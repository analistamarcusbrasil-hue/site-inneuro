import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCareerReportRows,
  countCareerReportDimension,
  filterAndSortCareerReportDrilldown,
  reportNotInformedValue,
  type CareerReportApplication,
  type CareerReportJob,
} from "../src/lib/careers/reports";

const snapshot = (fullName: string) => ({
  captured_at: "2026-08-01T00:00:00.000Z",
  candidate: { full_name: fullName, email: null },
  profile: null,
  experiences: [],
  education: [],
  certifications: [],
  skills: [],
  resume: null,
});

const jobs: CareerReportJob[] = [
  { id: "job-1", title: "Enfermeiro", area_id: "area-1", unit_id: "unit-1" },
  {
    id: "job-2",
    title: "Técnico de Enfermagem",
    area_id: "area-1",
    unit_id: "unit-1",
  },
];

const applications: CareerReportApplication[] = [
  {
    id: "app-1",
    job_id: "job-1",
    candidate_id: "candidate-1",
    status: "submitted",
    source: "site_inneuro",
    profile_snapshot: snapshot("Ana Souza"),
    candidate_stage: "resume",
    submitted_at: "2026-08-20T12:00:00.000Z",
  },
  {
    id: "app-2",
    job_id: "job-2",
    candidate_id: "candidate-2",
    status: "in_process",
    source: "site_inneuro",
    profile_snapshot: snapshot("Carlos Lima"),
    candidate_stage: "interview",
    submitted_at: "2026-08-21T12:00:00.000Z",
  },
  {
    id: "app-3",
    job_id: "job-1",
    candidate_id: "candidate-3",
    status: "submitted",
    source: null,
    profile_snapshot: snapshot("Beatriz Alves"),
    candidate_stage: "resume",
    submitted_at: "2026-08-19T12:00:00.000Z",
  },
  {
    id: "app-4",
    job_id: "job-1",
    candidate_id: "candidate-4",
    status: "submitted",
    source: "legacy_without_label",
    profile_snapshot: snapshot("Daniel Costa"),
    candidate_stage: "not_approved",
    submitted_at: "2026-08-18T12:00:00.000Z",
  },
];

test("etapa atual usa candidate_stage e não a etapa legada do processo", () => {
  const rows = buildCareerReportRows({
    applications,
    jobs,
    processCandidates: [
      {
        application_id: "app-1",
        process_id: "process-1",
        stage: "finalists",
      },
    ],
    logistics: [],
    filters: { etapa: "resume" },
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["app-1", "app-3"],
  );
  assert.deepEqual(countCareerReportDimension(rows, "stage"), { resume: 2 });
  assert.equal(rows[0]?.candidateName, "Ana Souza");
  assert.equal("profile_snapshot" in (rows[0] ?? {}), false);
});

test("valores ausentes e desconhecidos formam um único Não informado", () => {
  const rows = buildCareerReportRows({
    applications,
    jobs,
    processCandidates: [],
    logistics: [],
    filters: {},
  });
  assert.deepEqual(countCareerReportDimension(rows, "source"), {
    site_inneuro: 2,
    [reportNotInformedValue]: 2,
  });
});

test("drill-down mantém contagem exata, busca e ordenação", () => {
  const rows = buildCareerReportRows({
    applications,
    jobs,
    processCandidates: [],
    logistics: [],
    filters: { unidade: "unit-1" },
  });
  const groupCount = countCareerReportDimension(rows, "source").site_inneuro;
  const groupRows = filterAndSortCareerReportDrilldown(rows, {
    dimension: "source",
    value: "site_inneuro",
  });
  assert.equal(groupCount, 2);
  assert.equal(groupRows.length, groupCount);
  assert.deepEqual(
    groupRows.map((row) => row.candidateName),
    ["Carlos Lima", "Ana Souza"],
  );
  assert.deepEqual(
    filterAndSortCareerReportDrilldown(rows, {
      dimension: "source",
      value: "site_inneuro",
      search: "enfermeiro",
      sort: "name",
    }).map((row) => row.candidateName),
    ["Ana Souza"],
  );
});

test("página e exportação preservam segurança, filtros e dados mínimos", () => {
  const page = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/relatorios/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const drawer = readFileSync(
    new URL(
      "../src/components/admin/careers/report-drilldown-drawer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const route = readFileSync(
    new URL("../src/app/api/admin/rh/relatorios/csv/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(page, /requireHrAccess\("reports:view"\)/);
  assert.match(
    page,
    /candidate_id, status, source, profile_snapshot, candidate_stage/,
  );
  assert.match(page, /const pageSize = 25/);
  assert.match(page, /ReportBreakdown/);
  assert.match(page, /ReportDrilldownDrawer/);
  assert.match(drawer, /Buscar candidato ou vaga/);
  assert.match(drawer, /Motivo da classificação/);
  assert.match(drawer, /Ver candidatura/);
  assert.match(drawer, /Exportar este agrupamento/);
  assert.doesNotMatch(drawer, /whatsapp|telefone|e-mail/i);
  assert.match(route, /filterAndSortCareerReportDrilldown/);
  assert.match(route, /drilldown: dimension/);
});
