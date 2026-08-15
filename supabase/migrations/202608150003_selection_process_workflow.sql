begin;

create table if not exists public.career_selection_processes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.career_jobs(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 3 and 160),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'in_progress', 'closed', 'cancelled')),
  opened_at timestamptz,
  started_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists career_selection_processes_status_idx
on public.career_selection_processes (status, starts_on desc, updated_at desc);

create index if not exists career_selection_processes_job_idx
on public.career_selection_processes (job_id, created_at desc);

create table if not exists public.career_selection_process_candidates (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.career_selection_processes(id) on delete cascade,
  application_id uuid not null references public.career_job_applications(id) on delete restrict,
  candidate_id uuid not null references public.candidate_accounts(id) on delete restrict,
  stage text not null default 'registered'
    check (stage in (
      'registered',
      'screening',
      'interview',
      'evaluation',
      'finalists',
      'selected',
      'talent_pool',
      'not_selected'
    )),
  internal_note text check (
    internal_note is null or char_length(internal_note) <= 4000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (process_id, application_id),
  unique (process_id, candidate_id)
);

create index if not exists career_selection_candidates_stage_idx
on public.career_selection_process_candidates (process_id, stage, updated_at desc);

create table if not exists public.career_selection_movements (
  id uuid primary key default gen_random_uuid(),
  process_candidate_id uuid not null references public.career_selection_process_candidates(id) on delete cascade,
  process_id uuid not null references public.career_selection_processes(id) on delete cascade,
  candidate_id uuid not null references public.candidate_accounts(id) on delete restrict,
  from_stage text check (
    from_stage is null or from_stage in (
      'registered',
      'screening',
      'interview',
      'evaluation',
      'finalists',
      'selected',
      'talent_pool',
      'not_selected'
    )
  ),
  to_stage text not null check (to_stage in (
    'registered',
    'screening',
    'interview',
    'evaluation',
    'finalists',
    'selected',
    'talent_pool',
    'not_selected'
  )),
  moved_by uuid not null references public.profiles(id) on delete restrict,
  moved_at timestamptz not null default now()
);

create index if not exists career_selection_movements_process_idx
on public.career_selection_movements (process_id, moved_at desc);

create index if not exists career_selection_movements_candidate_idx
on public.career_selection_movements (candidate_id, moved_at desc);

create or replace function public.validate_career_selection_process_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.job_id is distinct from old.job_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception using errcode = '23514', message = 'selection_process_identity_is_immutable';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('open', 'cancelled'))
    or (old.status = 'open' and new.status in ('in_progress', 'closed', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('closed', 'cancelled'))
  ) then
    raise exception using errcode = '23514', message = 'invalid_selection_process_transition';
  end if;

  return new;
end;
$$;

drop trigger if exists career_selection_process_update_guard
on public.career_selection_processes;
create trigger career_selection_process_update_guard
before update on public.career_selection_processes
for each row execute procedure public.validate_career_selection_process_update();

drop trigger if exists career_selection_processes_updated_at
on public.career_selection_processes;
create trigger career_selection_processes_updated_at
before update on public.career_selection_processes
for each row execute procedure public.set_updated_at();

drop trigger if exists career_selection_candidates_updated_at
on public.career_selection_process_candidates;
create trigger career_selection_candidates_updated_at
before update on public.career_selection_process_candidates
for each row execute procedure public.set_updated_at();

create or replace function public.validate_career_selection_candidate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  application_candidate uuid;
  application_status text;
  process_status text;
begin
  if tg_op = 'UPDATE' and (
    new.process_id is distinct from old.process_id
    or new.application_id is distinct from old.application_id
    or new.candidate_id is distinct from old.candidate_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception using errcode = '23514', message = 'selection_candidate_identity_is_immutable';
  end if;

  select a.candidate_id, a.status, p.status
    into application_candidate, application_status, process_status
  from public.career_job_applications a
  join public.career_selection_processes p
    on p.id = new.process_id and p.job_id = a.job_id
  where a.id = new.application_id;

  if application_candidate is null or application_candidate <> new.candidate_id then
    raise exception using errcode = '23514', message = 'application_process_candidate_mismatch';
  end if;

  if tg_op = 'INSERT' and application_status in ('finalized', 'withdrawn') then
    raise exception using errcode = '23514', message = 'inactive_application_cannot_join_process';
  end if;

  if tg_op = 'INSERT' and process_status not in ('open', 'in_progress') then
    raise exception using errcode = '23514', message = 'inactive_process_cannot_receive_candidates';
  end if;

  if tg_op = 'UPDATE'
    and new.stage is distinct from old.stage
    and process_status not in ('open', 'in_progress') then
    raise exception using errcode = '23514', message = 'inactive_process_cannot_move_candidates';
  end if;

  return new;
end;
$$;

drop trigger if exists career_selection_candidate_integrity
on public.career_selection_process_candidates;
create trigger career_selection_candidate_integrity
before insert or update on public.career_selection_process_candidates
for each row execute procedure public.validate_career_selection_candidate();

create or replace function public.sync_career_selection_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  process_name text;
begin
  select name into process_name
  from public.career_selection_processes
  where id = new.process_id;

  update public.career_job_applications
  set
    status = case
      when status in ('submitted', 'screening') then 'in_process'
      else status
    end,
    process_label = process_name
  where id = new.application_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'selection_application_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists career_selection_application_sync
on public.career_selection_process_candidates;
create trigger career_selection_application_sync
after insert on public.career_selection_process_candidates
for each row execute procedure public.sync_career_selection_application();

create or replace function public.log_career_selection_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and old.stage is not distinct from new.stage then
    return new;
  end if;

  if actor is null or not exists (
    select 1 from public.profiles where id = actor
  ) then
    raise exception using errcode = '42501', message = 'selection_movement_requires_admin';
  end if;

  insert into public.career_selection_movements (
    process_candidate_id,
    process_id,
    candidate_id,
    from_stage,
    to_stage,
    moved_by
  ) values (
    new.id,
    new.process_id,
    new.candidate_id,
    case when tg_op = 'UPDATE' then old.stage else null end,
    new.stage,
    actor
  );
  return new;
end;
$$;

drop trigger if exists career_selection_movement_history
on public.career_selection_process_candidates;
create trigger career_selection_movement_history
after insert or update of stage on public.career_selection_process_candidates
for each row execute procedure public.log_career_selection_movement();

alter table public.career_selection_processes enable row level security;
alter table public.career_selection_process_candidates enable row level security;
alter table public.career_selection_movements enable row level security;

create policy "hr manages selection processes"
on public.career_selection_processes for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

create policy "hr manages selection process candidates"
on public.career_selection_process_candidates for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

create policy "hr reads selection movement history"
on public.career_selection_movements for select to authenticated
using (public.can_manage_hr());

grant select, insert, update on public.career_selection_processes to authenticated;
grant select, insert, update on public.career_selection_process_candidates to authenticated;
grant select on public.career_selection_movements to authenticated;

revoke execute on function public.validate_career_selection_candidate() from public, anon, authenticated;
revoke execute on function public.validate_career_selection_process_update() from public, anon, authenticated;
revoke execute on function public.sync_career_selection_application() from public, anon, authenticated;
revoke execute on function public.log_career_selection_movement() from public, anon, authenticated;

commit;
