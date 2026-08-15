begin;

create table if not exists public.career_application_evaluators (
  application_id uuid not null references public.career_job_applications(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (application_id, evaluator_id)
);

create table if not exists public.career_evaluation_templates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.career_jobs(id) on delete restrict,
  version integer not null check (version > 0),
  criteria jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (job_id, version)
);

create table if not exists public.career_candidate_evaluations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.career_job_applications(id) on delete restrict,
  template_id uuid not null references public.career_evaluation_templates(id) on delete restrict,
  template_version integer not null check (template_version > 0),
  evaluator_id uuid not null references public.profiles(id) on delete restrict,
  evaluation_version integer not null check (evaluation_version > 0),
  scores jsonb not null,
  comment text check (comment is null or char_length(comment) <= 3000),
  created_at timestamptz not null default now(),
  unique (application_id, template_id, evaluator_id, evaluation_version)
);

create table if not exists public.career_candidate_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.career_job_applications(id) on delete restrict,
  scheduled_at timestamptz not null,
  interview_type text not null check (
    interview_type in ('in_person', 'video', 'phone', 'technical', 'other')
  ),
  responsible_id uuid not null references public.profiles(id) on delete restrict,
  status text not null check (
    status in ('scheduled', 'completed', 'cancelled', 'no_show')
  ),
  internal_notes text check (
    internal_notes is null or char_length(internal_notes) <= 4000
  ),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists career_application_evaluators_evaluator_idx
on public.career_application_evaluators (evaluator_id, assigned_at desc);

create index if not exists career_evaluation_templates_latest_idx
on public.career_evaluation_templates (job_id, version desc);

create index if not exists career_candidate_evaluations_latest_idx
on public.career_candidate_evaluations (
  application_id,
  evaluator_id,
  created_at desc
);

create index if not exists career_candidate_interviews_application_idx
on public.career_candidate_interviews (application_id, scheduled_at desc);

create or replace function public.is_assigned_application_evaluator(
  requested_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.career_application_evaluators assignment
    where assignment.application_id = requested_application_id
      and assignment.evaluator_id = auth.uid()
  );
$$;

create or replace function public.validate_career_evaluation_template()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  criteria_count integer;
  distinct_count integer;
begin
  if jsonb_typeof(new.criteria) <> 'array'
    or jsonb_array_length(new.criteria) not between 6 and 12 then
    raise exception using errcode = '22023', message = 'invalid_evaluation_criteria';
  end if;

  select count(*), count(distinct item ->> 'id')
    into criteria_count, distinct_count
  from jsonb_array_elements(new.criteria) item
  where jsonb_typeof(item -> 'id') = 'string'
    and char_length(trim(item ->> 'id')) between 2 and 80
    and jsonb_typeof(item -> 'label') = 'string'
    and char_length(trim(item ->> 'label')) between 3 and 120;

  if criteria_count <> jsonb_array_length(new.criteria)
    or distinct_count <> criteria_count
    or lower(new.criteria::text) ~
      '(aparência|aparencia|\msexo\M|\midade\M|perfil bonito|\mraça\M|\mraca\M|religião|religiao|orientação sexual|orientacao sexual|estado civil|gravidez|fotografia)' then
    raise exception using errcode = '22023', message = 'prohibited_evaluation_criterion';
  end if;

  return new;
end;
$$;

create or replace function public.validate_career_candidate_evaluation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  application_job uuid;
  template_job uuid;
  expected_template_version integer;
  criteria_ids text[];
  score_ids text[];
  expected_evaluation_version integer;
begin
  select job_id into application_job
  from public.career_job_applications
  where id = new.application_id;

  select
    job_id,
    version,
    array(select item ->> 'id' from jsonb_array_elements(criteria) item order by item ->> 'id')
  into template_job, expected_template_version, criteria_ids
  from public.career_evaluation_templates
  where id = new.template_id;

  select array_agg(key order by key)
    into score_ids
  from jsonb_each(new.scores)
  where jsonb_typeof(value) = 'number'
    and value::text ~ '^\d+$'
    and value::integer between 1 and 5;

  select coalesce(max(evaluation_version), 0) + 1
    into expected_evaluation_version
  from public.career_candidate_evaluations
  where application_id = new.application_id
    and template_id = new.template_id
    and evaluator_id = new.evaluator_id;

  if application_job is null
    or application_job is distinct from template_job
    or new.template_version <> expected_template_version
    or criteria_ids is distinct from score_ids
    or new.evaluation_version <> expected_evaluation_version then
    raise exception using errcode = '23514', message = 'invalid_structured_evaluation';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_career_evaluation_history_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using errcode = '55000', message = 'evaluation_history_is_immutable';
end;
$$;

drop trigger if exists career_evaluation_template_validation
on public.career_evaluation_templates;
create trigger career_evaluation_template_validation
before insert on public.career_evaluation_templates
for each row execute procedure public.validate_career_evaluation_template();

drop trigger if exists career_candidate_evaluation_validation
on public.career_candidate_evaluations;
create trigger career_candidate_evaluation_validation
before insert on public.career_candidate_evaluations
for each row execute procedure public.validate_career_candidate_evaluation();

drop trigger if exists career_evaluation_templates_immutable
on public.career_evaluation_templates;
create trigger career_evaluation_templates_immutable
before update or delete on public.career_evaluation_templates
for each row execute procedure public.prevent_career_evaluation_history_changes();

drop trigger if exists career_candidate_evaluations_immutable
on public.career_candidate_evaluations;
create trigger career_candidate_evaluations_immutable
before update or delete on public.career_candidate_evaluations
for each row execute procedure public.prevent_career_evaluation_history_changes();

drop trigger if exists career_candidate_interviews_immutable
on public.career_candidate_interviews;
create trigger career_candidate_interviews_immutable
before update or delete on public.career_candidate_interviews
for each row execute procedure public.prevent_career_evaluation_history_changes();

alter table public.career_application_evaluators enable row level security;
alter table public.career_evaluation_templates enable row level security;
alter table public.career_candidate_evaluations enable row level security;
alter table public.career_candidate_interviews enable row level security;

create policy "hr manages application evaluator assignments"
on public.career_application_evaluators for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr() and assigned_by = auth.uid());

create policy "evaluator reads own assignments"
on public.career_application_evaluators for select to authenticated
using (evaluator_id = auth.uid());

create policy "hr manages evaluation templates"
on public.career_evaluation_templates for select to authenticated
using (public.can_manage_hr());

create policy "hr creates evaluation templates"
on public.career_evaluation_templates for insert to authenticated
with check (public.can_manage_hr() and created_by = auth.uid());

create policy "assigned evaluator reads job evaluation template"
on public.career_evaluation_templates for select to authenticated
using (
  exists (
    select 1
    from public.career_job_applications application
    where application.job_id = career_evaluation_templates.job_id
      and public.is_assigned_application_evaluator(application.id)
  )
);

create policy "hr reads candidate evaluations"
on public.career_candidate_evaluations for select to authenticated
using (public.can_manage_hr());

create policy "assigned evaluator reads candidate evaluations"
on public.career_candidate_evaluations for select to authenticated
using (public.is_assigned_application_evaluator(application_id));

create policy "authorized evaluator creates own evaluation"
on public.career_candidate_evaluations for insert to authenticated
with check (
  evaluator_id = auth.uid()
  and (
    public.can_manage_hr()
    or public.is_assigned_application_evaluator(application_id)
  )
);

create policy "hr manages candidate interviews"
on public.career_candidate_interviews for select to authenticated
using (public.can_manage_hr());

create policy "hr creates candidate interviews"
on public.career_candidate_interviews for insert to authenticated
with check (public.can_manage_hr() and created_by = auth.uid());

create policy "assigned evaluator reads candidate interviews"
on public.career_candidate_interviews for select to authenticated
using (public.is_assigned_application_evaluator(application_id));

create policy "assigned evaluator reads application snapshot"
on public.career_job_applications for select to authenticated
using (public.is_assigned_application_evaluator(id));

create policy "assigned evaluator reads application job"
on public.career_jobs for select to authenticated
using (
  exists (
    select 1
    from public.career_job_applications application
    where application.job_id = career_jobs.id
      and public.is_assigned_application_evaluator(application.id)
  )
);

create policy "assigned evaluator reads matching runs"
on public.career_application_match_runs for select to authenticated
using (public.is_assigned_application_evaluator(application_id));

create policy "hr participants read evaluator profiles"
on public.profiles for select to authenticated
using (
  public.has_hr_access()
  and (role in ('super_admin', 'admin') or hr_role is not null)
);

grant select, insert, delete on public.career_application_evaluators to authenticated;
grant select, insert on public.career_evaluation_templates to authenticated;
grant select, insert on public.career_candidate_evaluations to authenticated;
grant select, insert on public.career_candidate_interviews to authenticated;

grant execute on function public.is_assigned_application_evaluator(uuid)
to authenticated;
revoke execute on function public.validate_career_evaluation_template()
from public, anon, authenticated;
revoke execute on function public.validate_career_candidate_evaluation()
from public, anon, authenticated;
revoke execute on function public.prevent_career_evaluation_history_changes()
from public, anon, authenticated;

comment on table public.career_candidate_evaluations is
  'Avaliações humanas estruturadas e versionadas. Não se misturam ao indicador automático de aderência.';

commit;
