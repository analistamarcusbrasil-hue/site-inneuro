import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260821175347_single_candidate_resume.sql",
    import.meta.url,
  ),
  "utf8",
);

test("banco garante currículo único e obrigatório nos dois fluxos", () => {
  assert.match(
    migration,
    /unique index if not exists candidate_resumes_candidate_unique_idx[\s\S]*\(candidate_id\)/,
  );
  assert.match(migration, /replace_candidate_resume/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /career_job_applications_require_resume/);
  assert.match(migration, /career_talent_pool_memberships_require_resume/);
  assert.match(migration, /message = 'resume_required'/);
  assert.match(
    migration,
    /delete from public\.candidate_resume_extractions[\s\S]*update public\.candidate_resumes/,
  );
});

test("ações verificam currículo antes da candidatura e do Banco de Talentos", () => {
  const applicationAction = readFileSync(
    new URL("../src/app/carreiras/application-actions.ts", import.meta.url),
    "utf8",
  );
  const talentPoolAction = readFileSync(
    new URL("../src/app/carreiras/talent-pool-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(applicationAction, /from\("candidate_resumes"\)/);
  assert.match(applicationAction, /error: "resume-required"/);
  assert.match(talentPoolAction, /from\("candidate_resumes"\)/);
  assert.match(talentPoolAction, /talent-resume-required/);
});

test("upload usa progresso real e trava uma segunda submissão", () => {
  const component = readFileSync(
    new URL(
      "../src/components/careers/candidate-resume-upload.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(component, /busyRef\.current/);
  assert.match(component, /XMLHttpRequest/);
  assert.match(component, /upload\.upload\.addEventListener\("progress"/);
  assert.match(component, /progressEvent\.loaded \/ progressEvent\.total/);
  assert.doesNotMatch(component, /setInterval|Math\.random/);
});
