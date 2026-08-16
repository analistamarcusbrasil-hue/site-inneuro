begin;

create sequence if not exists public.career_vacancy_number_seq;

create or replace function public.next_career_vacancy_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select format(
    'INN-%s-%s',
    to_char(timezone('America/Belem', clock_timestamp()), 'YYYY'),
    lpad(nextval('public.career_vacancy_number_seq'::regclass)::text, 6, '0')
  );
$$;

alter table public.career_jobs
  add column if not exists vacancy_number text;

update public.career_jobs
set vacancy_number = public.next_career_vacancy_number()
where vacancy_number is null;

alter table public.career_jobs
  alter column vacancy_number set default public.next_career_vacancy_number(),
  alter column vacancy_number set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'career_jobs_vacancy_number_format_check'
      and conrelid = 'public.career_jobs'::regclass
  ) then
    alter table public.career_jobs
      add constraint career_jobs_vacancy_number_format_check
      check (vacancy_number ~ '^INN-[0-9]{4}-[0-9]{6,}$');
  end if;
end $$;

create unique index if not exists career_jobs_vacancy_number_unique_idx
on public.career_jobs (vacancy_number);

create or replace function public.protect_career_vacancy_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vacancy_number is distinct from old.vacancy_number then
    raise exception using errcode = '23514', message = 'vacancy_number_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists career_jobs_vacancy_number_immutable
on public.career_jobs;
create trigger career_jobs_vacancy_number_immutable
before update of vacancy_number on public.career_jobs
for each row execute procedure public.protect_career_vacancy_number();

-- A candidatura é única durante toda a vida da vaga, inclusive depois de
-- retirada, encerrada, reprovada ou contratada.
create unique index if not exists career_job_applications_candidate_job_unique_idx
on public.career_job_applications (candidate_id, job_id);

drop policy if exists "public reads available jobs" on public.career_jobs;
create policy "public reads available jobs"
on public.career_jobs for select to anon, authenticated
using (
  (
    status in ('published', 'closed')
    and opens_on <= (now() at time zone 'America/Belem')::date
  )
  or exists (
    select 1
    from public.career_job_applications application
    where application.job_id = career_jobs.id
      and application.candidate_id = auth.uid()
  )
  or public.can_manage_hr()
);

alter table public.career_application_stage_history
  add column if not exists candidate_id uuid,
  add column if not exists job_id uuid,
  add column if not exists vacancy_number text,
  add column if not exists internal_note text;

update public.career_application_stage_history history
set
  candidate_id = application.candidate_id,
  job_id = application.job_id,
  vacancy_number = job.vacancy_number
from public.career_job_applications application
join public.career_jobs job on job.id = application.job_id
where history.application_id = application.id
  and (
    history.candidate_id is null
    or history.job_id is null
    or history.vacancy_number is null
  );

alter table public.career_application_stage_history
  alter column candidate_id set not null,
  alter column job_id set not null,
  alter column vacancy_number set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'career_application_stage_history_candidate_id_fkey'
      and conrelid = 'public.career_application_stage_history'::regclass
  ) then
    alter table public.career_application_stage_history
      add constraint career_application_stage_history_candidate_id_fkey
      foreign key (candidate_id) references public.candidate_accounts(id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'career_application_stage_history_job_id_fkey'
      and conrelid = 'public.career_application_stage_history'::regclass
  ) then
    alter table public.career_application_stage_history
      add constraint career_application_stage_history_job_id_fkey
      foreign key (job_id) references public.career_jobs(id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'career_application_stage_history_internal_note_check'
      and conrelid = 'public.career_application_stage_history'::regclass
  ) then
    alter table public.career_application_stage_history
      add constraint career_application_stage_history_internal_note_check
      check (internal_note is null or char_length(internal_note) <= 4000);
  end if;
end $$;

create index if not exists career_application_stage_history_reference_idx
on public.career_application_stage_history
  (job_id, candidate_id, created_at desc);

create or replace function public.log_career_application_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  stage_decision text;
  vacancy_reference text;
begin
  if tg_op = 'UPDATE' and old.candidate_stage is not distinct from new.candidate_stage then
    return new;
  end if;
  stage_decision := case
    when tg_op = 'INSERT' then 'submitted'
    when new.candidate_stage = 'not_approved' then 'not_approved'
    when new.candidate_stage = 'hired' then 'hired'
    else 'approved'
  end;
  select vacancy_number into vacancy_reference
  from public.career_jobs
  where id = new.job_id;

  insert into public.career_application_stage_history (
    application_id,
    candidate_id,
    job_id,
    vacancy_number,
    from_stage,
    to_stage,
    decision,
    admin_id
  ) values (
    new.id,
    new.candidate_id,
    new.job_id,
    vacancy_reference,
    case when tg_op = 'UPDATE' then old.candidate_stage else null end,
    new.candidate_stage,
    stage_decision,
    case when stage_decision = 'submitted' then null else actor end
  );
  return new;
end;
$$;

create or replace function public.decide_career_application_stage(
  p_application_id uuid,
  p_decision text,
  p_expected_stage text,
  p_internal_note text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stage text;
  next_stage text;
  next_status text;
  application_candidate uuid;
  application_job uuid;
  vacancy_reference text;
  decision_event text;
  normalized_note text := nullif(trim(coalesce(p_internal_note, '')), '');
begin
  if auth.uid() is null or not public.can_manage_hr() then
    raise exception using errcode = '42501', message = 'hr_authorization_required';
  end if;
  if p_decision not in ('approve', 'not_approve') then
    raise exception using errcode = '22023', message = 'invalid_stage_decision';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 4000 then
    raise exception using errcode = '22023', message = 'internal_note_too_long';
  end if;
  if p_decision = 'approve' and normalized_note is not null then
    raise exception using errcode = '22023', message = 'approval_internal_note_not_allowed';
  end if;

  select
    application.candidate_stage,
    application.candidate_id,
    application.job_id,
    job.vacancy_number
  into
    current_stage,
    application_candidate,
    application_job,
    vacancy_reference
  from public.career_job_applications application
  join public.career_jobs job on job.id = application.job_id
  where application.id = p_application_id
  for update of application;

  if current_stage is null then
    raise exception using errcode = 'P0002', message = 'career_application_not_found';
  end if;
  if current_stage <> p_expected_stage then
    raise exception using errcode = '40001', message = 'candidate_stage_changed';
  end if;

  if p_decision = 'not_approve' then
    next_stage := 'not_approved';
    next_status := 'finalized';
    decision_event := 'CANDIDATE_REJECTED';
  else
    next_stage := case current_stage
      when 'resume' then 'interview'
      when 'interview' then 'practical_test'
      when 'practical_test' then 'hiring'
      when 'hiring' then 'hired'
      else null
    end;
    next_status := case when next_stage = 'hired' then 'finalized' else 'in_process' end;
    decision_event := case
      when next_stage = 'hired' then 'CANDIDATE_HIRED'
      else 'CANDIDATE_APPROVED_STAGE'
    end;
  end if;
  if next_stage is null then
    raise exception using errcode = '23514', message = 'candidate_stage_is_final';
  end if;

  update public.career_job_applications
  set candidate_stage = next_stage, status = next_status
  where id = p_application_id;

  update public.career_application_stage_history
  set internal_note = normalized_note
  where id = (
    select history.id
    from public.career_application_stage_history history
    where history.application_id = p_application_id
      and history.from_stage = current_stage
      and history.to_stage = next_stage
      and history.admin_id = auth.uid()
    order by history.created_at desc, history.id desc
    limit 1
  );

  update public.career_selection_process_candidates
  set stage = next_stage,
      internal_note = case
        when p_decision = 'not_approve' then normalized_note
        else internal_note
      end
  where application_id = p_application_id
    and stage = current_stage;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    auth.uid(),
    decision_event,
    'career_job_application',
    p_application_id,
    jsonb_build_object(
      'candidate_id', application_candidate,
      'job_id', application_job,
      'vacancy_number', vacancy_reference,
      'stage', current_stage
    ),
    jsonb_build_object(
      'candidate_id', application_candidate,
      'job_id', application_job,
      'vacancy_number', vacancy_reference,
      'stage', next_stage,
      'decision', p_decision,
      'internal_note', normalized_note
    )
  );

  return next_stage;
end;
$$;

create or replace function public.decide_career_application_stage(
  p_application_id uuid,
  p_decision text,
  p_expected_stage text
)
returns text
language sql
security definer
set search_path = public
as $$
  select public.decide_career_application_stage(
    p_application_id,
    p_decision,
    p_expected_stage,
    null
  );
$$;

revoke all on function public.next_career_vacancy_number()
from public, anon;
grant execute on function public.next_career_vacancy_number()
to authenticated, service_role;
revoke all on function public.protect_career_vacancy_number()
from public, anon, authenticated;
revoke all on function public.decide_career_application_stage(uuid, text, text, text)
from public, anon;
grant execute on function public.decide_career_application_stage(uuid, text, text, text)
to authenticated;

commit;
