begin;

-- O funil possui quatro etapas ativas e dois resultados finais.
alter table public.career_job_applications
  drop constraint if exists career_job_applications_candidate_stage_check;

update public.career_job_applications
set candidate_stage = case candidate_stage
  when 'registered' then 'resume'
  when 'screening' then 'resume'
  when 'interview' then 'interview'
  when 'evaluation' then 'practical_test'
  when 'finalists' then 'hiring'
  when 'selected' then 'hired'
  when 'talent_pool' then 'not_approved'
  when 'not_selected' then 'not_approved'
  else 'resume'
end;

alter table public.career_job_applications
  alter column candidate_stage set default 'resume';
alter table public.career_job_applications
  add constraint career_job_applications_candidate_stage_check
  check (candidate_stage in (
    'resume', 'interview', 'practical_test', 'hiring', 'hired', 'not_approved'
  ));

update public.career_job_applications
set status = 'finalized'
where candidate_stage in ('hired', 'not_approved')
  and status not in ('finalized', 'withdrawn');

alter table public.career_selection_process_candidates
  drop constraint if exists career_selection_process_candidates_stage_check;
alter table public.career_selection_movements
  drop constraint if exists career_selection_movements_from_stage_check;
alter table public.career_selection_movements
  drop constraint if exists career_selection_movements_to_stage_check;

-- A conversão de valores legados não representa uma nova decisão humana.
drop trigger if exists career_selection_candidate_integrity
on public.career_selection_process_candidates;
drop trigger if exists career_selection_movement_history
on public.career_selection_process_candidates;
drop trigger if exists career_selection_candidate_public_stage
on public.career_selection_process_candidates;

update public.career_selection_process_candidates
set stage = case stage
  when 'registered' then 'resume'
  when 'screening' then 'resume'
  when 'interview' then 'interview'
  when 'evaluation' then 'practical_test'
  when 'finalists' then 'hiring'
  when 'selected' then 'hired'
  when 'talent_pool' then 'not_approved'
  when 'not_selected' then 'not_approved'
  else 'resume'
end;

update public.career_selection_movements
set
  from_stage = case from_stage
    when 'registered' then 'resume'
    when 'screening' then 'resume'
    when 'interview' then 'interview'
    when 'evaluation' then 'practical_test'
    when 'finalists' then 'hiring'
    when 'selected' then 'hired'
    when 'talent_pool' then 'not_approved'
    when 'not_selected' then 'not_approved'
    else null
  end,
  to_stage = case to_stage
    when 'registered' then 'resume'
    when 'screening' then 'resume'
    when 'interview' then 'interview'
    when 'evaluation' then 'practical_test'
    when 'finalists' then 'hiring'
    when 'selected' then 'hired'
    when 'talent_pool' then 'not_approved'
    when 'not_selected' then 'not_approved'
    else 'resume'
  end;

alter table public.career_selection_process_candidates
  alter column stage set default 'resume';
alter table public.career_selection_process_candidates
  add constraint career_selection_process_candidates_stage_check
  check (stage in (
    'resume', 'interview', 'practical_test', 'hiring', 'hired', 'not_approved'
  ));
alter table public.career_selection_movements
  add constraint career_selection_movements_from_stage_check
  check (from_stage is null or from_stage in (
    'resume', 'interview', 'practical_test', 'hiring', 'hired', 'not_approved'
  ));
alter table public.career_selection_movements
  add constraint career_selection_movements_to_stage_check
  check (to_stage in (
    'resume', 'interview', 'practical_test', 'hiring', 'hired', 'not_approved'
  ));

create trigger career_selection_candidate_integrity
before insert or update on public.career_selection_process_candidates
for each row execute procedure public.validate_career_selection_candidate();
create trigger career_selection_movement_history
after insert or update of stage on public.career_selection_process_candidates
for each row execute procedure public.log_career_selection_movement();
create trigger career_selection_candidate_public_stage
after insert or update of stage on public.career_selection_process_candidates
for each row execute procedure public.sync_career_application_candidate_stage();

create table if not exists public.career_application_stage_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.career_job_applications(id) on delete restrict,
  from_stage text check (from_stage is null or from_stage in (
    'resume', 'interview', 'practical_test', 'hiring', 'hired', 'not_approved'
  )),
  to_stage text not null check (to_stage in (
    'resume', 'interview', 'practical_test', 'hiring', 'hired', 'not_approved'
  )),
  decision text not null check (decision in (
    'submitted', 'approved', 'not_approved', 'hired', 'migrated'
  )),
  admin_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists career_application_stage_history_idx
on public.career_application_stage_history (application_id, created_at desc);

insert into public.career_application_stage_history (
  application_id, from_stage, to_stage, decision, admin_id, created_at
)
select application.id, null, application.candidate_stage, 'migrated', null,
  coalesce(application.stage_updated_at, application.submitted_at)
from public.career_job_applications application
where not exists (
  select 1 from public.career_application_stage_history history
  where history.application_id = application.id
);

create or replace function public.validate_career_application_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.candidate_stage is not distinct from old.candidate_stage then
    return new;
  end if;

  if not (
    (old.candidate_stage = 'resume' and new.candidate_stage in ('interview', 'not_approved'))
    or (old.candidate_stage = 'interview' and new.candidate_stage in ('practical_test', 'not_approved'))
    or (old.candidate_stage = 'practical_test' and new.candidate_stage in ('hiring', 'not_approved'))
    or (old.candidate_stage = 'hiring' and new.candidate_stage in ('hired', 'not_approved'))
  ) then
    raise exception using errcode = '23514', message = 'invalid_candidate_stage_transition';
  end if;
  new.stage_updated_at := now();
  return new;
end;
$$;

drop trigger if exists career_application_stage_guard
on public.career_job_applications;
create trigger career_application_stage_guard
before update of candidate_stage on public.career_job_applications
for each row execute procedure public.validate_career_application_stage();

create or replace function public.log_career_application_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  stage_decision text;
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
  insert into public.career_application_stage_history (
    application_id, from_stage, to_stage, decision, admin_id
  ) values (
    new.id,
    case when tg_op = 'UPDATE' then old.candidate_stage else null end,
    new.candidate_stage,
    stage_decision,
    case when stage_decision = 'submitted' then null else actor end
  );
  return new;
end;
$$;

drop trigger if exists career_application_stage_history_trigger
on public.career_job_applications;
create trigger career_application_stage_history_trigger
after insert or update of candidate_stage on public.career_job_applications
for each row execute procedure public.log_career_application_stage();

create or replace function public.decide_career_application_stage(
  p_application_id uuid,
  p_decision text,
  p_expected_stage text
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
begin
  if auth.uid() is null or not public.can_manage_hr() then
    raise exception using errcode = '42501', message = 'hr_authorization_required';
  end if;
  if p_decision not in ('approve', 'not_approve') then
    raise exception using errcode = '22023', message = 'invalid_stage_decision';
  end if;

  select candidate_stage into current_stage
  from public.career_job_applications
  where id = p_application_id
  for update;
  if current_stage is null then
    raise exception using errcode = 'P0002', message = 'career_application_not_found';
  end if;
  if current_stage <> p_expected_stage then
    raise exception using errcode = '40001', message = 'candidate_stage_changed';
  end if;

  if p_decision = 'not_approve' then
    next_stage := 'not_approved';
    next_status := 'finalized';
  else
    next_stage := case current_stage
      when 'resume' then 'interview'
      when 'interview' then 'practical_test'
      when 'practical_test' then 'hiring'
      when 'hiring' then 'hired'
      else null
    end;
    next_status := case when next_stage = 'hired' then 'finalized' else 'in_process' end;
  end if;
  if next_stage is null then
    raise exception using errcode = '23514', message = 'candidate_stage_is_final';
  end if;

  update public.career_job_applications
  set candidate_stage = next_stage, status = next_status
  where id = p_application_id;

  update public.career_selection_process_candidates
  set stage = next_stage
  where application_id = p_application_id
    and stage = current_stage;
  return next_stage;
end;
$$;

create or replace function public.get_candidate_application_stage_count(
  p_application_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  application_job uuid;
  current_stage text;
  result integer;
begin
  select candidate_id, job_id, candidate_stage
    into owner_id, application_job, current_stage
  from public.career_job_applications
  where id = p_application_id;
  if owner_id is null or owner_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'application_access_denied';
  end if;
  select count(*)::integer into result
  from public.career_job_applications
  where job_id = application_job
    and candidate_stage = current_stage
    and status not in ('finalized', 'withdrawn');
  return result;
end;
$$;

create table if not exists public.career_application_stage_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.career_job_applications(id) on delete cascade,
  stage text not null check (stage in ('interview', 'practical_test')),
  scheduled_date date not null,
  scheduled_time time not null,
  location text not null check (char_length(trim(location)) between 2 and 240),
  instructions text check (instructions is null or char_length(instructions) <= 2000),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  invitation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, stage)
);

create trigger career_application_stage_events_updated_at
before update on public.career_application_stage_events
for each row execute procedure public.set_updated_at();

alter table public.career_application_stage_history enable row level security;
alter table public.career_application_stage_events enable row level security;
create policy "hr reads application stage history"
on public.career_application_stage_history for select to authenticated
using (public.can_manage_hr());
create policy "hr manages application stage events"
on public.career_application_stage_events for all to authenticated
using (public.can_manage_hr()) with check (public.can_manage_hr());

grant select on public.career_application_stage_history to authenticated;
grant select, insert, update on public.career_application_stage_events to authenticated;
grant all on public.career_application_stage_history to service_role;
grant all on public.career_application_stage_events to service_role;
revoke all on function public.validate_career_application_stage() from public, anon, authenticated;
revoke all on function public.log_career_application_stage() from public, anon, authenticated;
revoke all on function public.decide_career_application_stage(uuid, text, text) from public, anon;
grant execute on function public.decide_career_application_stage(uuid, text, text) to authenticated;
revoke all on function public.get_candidate_application_stage_count(uuid) from public, anon;
grant execute on function public.get_candidate_application_stage_count(uuid) to authenticated;

-- Amplia a outbox existente para os eventos específicos do funil.
alter table public.career_communications
  drop constraint if exists career_communications_type_check;
alter table public.career_communications
  drop constraint if exists career_communications_template_key_check;
alter table public.career_communications
  add constraint career_communications_type_check check (type in (
    'APPLICATION_RECEIVED', 'UNDER_REVIEW', 'NEXT_STAGE',
    'STAGE_1_APPROVED', 'STAGE_2_APPROVED', 'STAGE_3_APPROVED',
    'FINAL_APPROVED', 'INTERVIEW_INVITE', 'PRACTICAL_TEST_INVITE',
    'INTERVIEW_REMINDER', 'APPROVED', 'TALENT_POOL', 'REJECTED',
    'PROCESS_CLOSED', 'CUSTOM_MESSAGE', 'INTERNAL_NEW_APPLICATION',
    'PASSWORD_RECOVERY'
  ));
alter table public.career_communications
  add constraint career_communications_template_key_check check (template_key = type);

commit;
