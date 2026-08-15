begin;

create table if not exists public.career_job_match_matrices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.career_jobs(id) on delete restrict,
  version integer not null check (version > 0),
  criteria jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (job_id, version)
);

create table if not exists public.career_application_match_runs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.career_job_applications(id) on delete restrict,
  matrix_id uuid not null references public.career_job_match_matrices(id) on delete restrict,
  matrix_version integer not null check (matrix_version > 0),
  overall_score integer not null check (overall_score between 0 and 100),
  hard_skills_score integer not null check (hard_skills_score between 0 and 100),
  result jsonb not null,
  calculated_by uuid not null references public.profiles(id) on delete restrict,
  calculated_at timestamptz not null default now()
);

create index if not exists career_job_match_matrices_latest_idx
on public.career_job_match_matrices (job_id, version desc);

create index if not exists career_application_match_runs_latest_idx
on public.career_application_match_runs (application_id, calculated_at desc);

create index if not exists career_application_match_runs_score_idx
on public.career_application_match_runs (matrix_id, overall_score desc, calculated_at desc);

create or replace function public.validate_career_job_match_matrix()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  criterion_count integer;
  distinct_count integer;
  total_weight integer;
begin
  if jsonb_typeof(new.criteria) <> 'array'
    or jsonb_array_length(new.criteria) <> 6 then
    raise exception using errcode = '22023', message = 'matching_criteria_must_be_array';
  end if;

  select
    count(*),
    count(distinct item ->> 'key'),
    coalesce(sum((item ->> 'weight')::integer), 0)
  into criterion_count, distinct_count, total_weight
  from jsonb_array_elements(new.criteria) item
  where item ->> 'key' in (
    'related_experience',
    'technical_skills',
    'education',
    'sector_experience',
    'certifications',
    'availability'
  )
    and jsonb_typeof(item -> 'label') = 'string'
    and char_length(trim(item ->> 'label')) between 3 and 120
    and jsonb_typeof(item -> 'weight') = 'number'
    and (item ->> 'weight') ~ '^\d+$'
    and (item ->> 'weight')::integer between 0 and 100;

  if criterion_count <> 6 or distinct_count <> 6 or total_weight <> 100 then
    raise exception using errcode = '22023', message = 'invalid_matching_matrix';
  end if;

  return new;
end;
$$;

drop trigger if exists career_job_match_matrix_validation
on public.career_job_match_matrices;
create trigger career_job_match_matrix_validation
before insert on public.career_job_match_matrices
for each row execute procedure public.validate_career_job_match_matrix();

create or replace function public.validate_career_application_match_run()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_version integer;
  expected_job uuid;
  application_job uuid;
begin
  select version, job_id
    into expected_version, expected_job
  from public.career_job_match_matrices
  where id = new.matrix_id;

  select job_id into application_job
  from public.career_job_applications
  where id = new.application_id;

  if expected_version is null
    or expected_version <> new.matrix_version
    or expected_job is distinct from application_job then
    raise exception using errcode = '23514', message = 'matching_run_matrix_application_mismatch';
  end if;

  if jsonb_typeof(new.result) is distinct from 'object'
    or (new.result ->> 'overallScore')::integer is distinct from new.overall_score
    or (new.result ->> 'hardSkillsScore')::integer is distinct from new.hard_skills_score
    or new.result ->> 'sourcePolicy' is distinct from 'confirmed_application_snapshot' then
    raise exception using errcode = '22023', message = 'invalid_matching_result';
  end if;

  return new;
end;
$$;

drop trigger if exists career_application_match_run_validation
on public.career_application_match_runs;
create trigger career_application_match_run_validation
before insert on public.career_application_match_runs
for each row execute procedure public.validate_career_application_match_run();

create or replace function public.prevent_career_matching_history_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using errcode = '55000', message = 'matching_history_is_immutable';
end;
$$;

drop trigger if exists career_job_match_matrices_immutable
on public.career_job_match_matrices;
create trigger career_job_match_matrices_immutable
before update or delete on public.career_job_match_matrices
for each row execute procedure public.prevent_career_matching_history_changes();

drop trigger if exists career_application_match_runs_immutable
on public.career_application_match_runs;
create trigger career_application_match_runs_immutable
before update or delete on public.career_application_match_runs
for each row execute procedure public.prevent_career_matching_history_changes();

alter table public.career_job_match_matrices enable row level security;
alter table public.career_application_match_runs enable row level security;

create policy "hr manages job matching matrices"
on public.career_job_match_matrices for select to authenticated
using (public.can_manage_hr());

create policy "hr creates job matching matrices"
on public.career_job_match_matrices for insert to authenticated
with check (public.can_manage_hr() and created_by = auth.uid());

create policy "hr reads application matching history"
on public.career_application_match_runs for select to authenticated
using (public.can_manage_hr());

create policy "hr creates application matching runs"
on public.career_application_match_runs for insert to authenticated
with check (public.can_manage_hr() and calculated_by = auth.uid());

grant select, insert on
  public.career_job_match_matrices,
  public.career_application_match_runs
to authenticated;

revoke execute on function public.validate_career_job_match_matrix()
from public, anon, authenticated;
revoke execute on function public.validate_career_application_match_run()
from public, anon, authenticated;
revoke execute on function public.prevent_career_matching_history_changes()
from public, anon, authenticated;

comment on table public.career_application_match_runs is
  'Histórico explicável de apoio à triagem. Nunca altera status ou decide contratação.';

commit;
