begin;

create table if not exists public.career_job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.career_jobs(id) on delete restrict,
  candidate_id uuid not null references public.candidate_accounts(id) on delete restrict,
  status text not null default 'submitted'
    check (status in ('submitted', 'screening', 'in_process', 'finalized', 'withdrawn')),
  profile_snapshot jsonb not null check (jsonb_typeof(profile_snapshot) = 'object'),
  process_label text check (
    process_label is null or char_length(trim(process_label)) between 2 and 160
  ),
  submitted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'withdrawn' and withdrawn_at is not null)
    or (status <> 'withdrawn' and withdrawn_at is null)
  )
);

create unique index if not exists career_job_applications_active_unique_idx
on public.career_job_applications (job_id, candidate_id)
where status not in ('finalized', 'withdrawn');

create index if not exists career_job_applications_job_idx
on public.career_job_applications (job_id, submitted_at desc);

create index if not exists career_job_applications_candidate_idx
on public.career_job_applications (candidate_id, submitted_at desc);

create table if not exists public.career_job_application_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.career_job_applications(id) on delete cascade,
  from_status text check (
    from_status is null or from_status in ('submitted', 'screening', 'in_process', 'finalized', 'withdrawn')
  ),
  to_status text not null
    check (to_status in ('submitted', 'screening', 'in_process', 'finalized', 'withdrawn')),
  changed_by uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('candidate', 'admin', 'system')),
  changed_at timestamptz not null default now()
);

create index if not exists career_job_application_history_idx
on public.career_job_application_history (application_id, changed_at desc);

create or replace function public.protect_career_job_application_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.job_id is distinct from old.job_id
    or new.candidate_id is distinct from old.candidate_id
    or new.profile_snapshot is distinct from old.profile_snapshot
    or new.submitted_at is distinct from old.submitted_at then
    raise exception using errcode = '23514', message = 'application_snapshot_is_immutable';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'submitted' and new.status in ('screening', 'in_process', 'finalized', 'withdrawn'))
    or (old.status = 'screening' and new.status in ('in_process', 'finalized', 'withdrawn'))
    or (old.status = 'in_process' and new.status in ('finalized', 'withdrawn'))
  ) then
    raise exception using errcode = '23514', message = 'invalid_application_status_transition';
  end if;

  return new;
end;
$$;

drop trigger if exists career_job_application_snapshot_guard
on public.career_job_applications;
create trigger career_job_application_snapshot_guard
before update on public.career_job_applications
for each row execute procedure public.protect_career_job_application_snapshot();

drop trigger if exists career_job_applications_updated_at
on public.career_job_applications;
create trigger career_job_applications_updated_at
before update on public.career_job_applications
for each row execute procedure public.set_updated_at();

create or replace function public.log_career_job_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  kind text := 'system';
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  if actor is not null and actor = new.candidate_id then
    kind := 'candidate';
  elsif actor is not null and exists (
    select 1 from public.profiles where id = actor
  ) then
    kind := 'admin';
  end if;

  insert into public.career_job_application_history (
    application_id,
    from_status,
    to_status,
    changed_by,
    actor_kind
  ) values (
    new.id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    actor,
    kind
  );
  return new;
end;
$$;

drop trigger if exists career_job_application_status_history
on public.career_job_applications;
create trigger career_job_application_status_history
after insert or update of status on public.career_job_applications
for each row
execute procedure public.log_career_job_application_status();

create or replace function public.submit_career_job_application(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  candidate uuid := auth.uid();
  account_name text;
  account_email text;
  application_id uuid;
  snapshot jsonb;
begin
  if candidate is null then
    raise exception using errcode = '42501', message = 'candidate_auth_required';
  end if;

  select ca.full_name, u.email
    into account_name, account_email
  from public.candidate_accounts ca
  join auth.users u on u.id = ca.id
  where ca.id = candidate;

  if account_name is null then
    raise exception using errcode = '42501', message = 'candidate_account_required';
  end if;

  if not exists (
    select 1
    from public.career_jobs
    where id = p_job_id
      and status = 'published'
      and opens_on <= current_date
      and (closes_on is null or closes_on >= current_date)
  ) then
    raise exception using errcode = 'P0002', message = 'job_not_available';
  end if;

  if exists (
    select 1
    from public.career_job_applications
    where job_id = p_job_id
      and candidate_id = candidate
      and status not in ('finalized', 'withdrawn')
  ) then
    raise exception using errcode = '23505', message = 'active_application_exists';
  end if;

  snapshot := jsonb_build_object(
    'captured_at', now(),
    'candidate', jsonb_build_object(
      'full_name', account_name,
      'email', account_email
    ),
    'profile', (
      select jsonb_build_object(
        'whatsapp', cp.whatsapp,
        'city', cp.city,
        'state', cp.state,
        'professional_objective', cp.professional_objective,
        'about', cp.about,
        'availability', cp.availability
      )
      from public.candidate_profiles cp
      where cp.candidate_id = candidate
    ),
    'experiences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'company', ce.company,
        'job_title', ce.job_title,
        'start_date', ce.start_date,
        'end_date', ce.end_date,
        'is_current', ce.is_current,
        'activities', ce.activities
      ) order by ce.sort_order, ce.start_date desc)
      from public.candidate_experiences ce
      where ce.candidate_id = candidate
    ), '[]'::jsonb),
    'education', coalesce((
      select jsonb_agg(jsonb_build_object(
        'education_level', ed.education_level,
        'course', ed.course,
        'institution', ed.institution,
        'start_date', ed.start_date,
        'end_date', ed.end_date,
        'in_progress', ed.in_progress
      ) order by ed.sort_order, ed.start_date desc)
      from public.candidate_education ed
      where ed.candidate_id = candidate
    ), '[]'::jsonb),
    'certifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', cc.name,
        'institution', cc.institution,
        'completion_year', cc.completion_year,
        'expires_at', cc.expires_at
      ) order by cc.sort_order, cc.completion_year desc)
      from public.candidate_certifications cc
      where cc.candidate_id = candidate
    ), '[]'::jsonb),
    'skills', coalesce((
      select jsonb_agg(cs.name order by cs.sort_order, cs.name)
      from public.candidate_skills cs
      where cs.candidate_id = candidate
    ), '[]'::jsonb),
    'resume', (
      select jsonb_build_object(
        'original_name', cr.original_name,
        'size_bytes', cr.size_bytes,
        'mime_type', cr.mime_type,
        'version', cr.version,
        'created_at', cr.created_at
      )
      from public.candidate_resumes cr
      where cr.candidate_id = candidate
      order by cr.version desc
      limit 1
    )
  );

  insert into public.career_job_applications (
    job_id,
    candidate_id,
    profile_snapshot
  ) values (
    p_job_id,
    candidate,
    snapshot
  ) returning id into application_id;

  return application_id;
end;
$$;

create or replace function public.withdraw_career_job_application(
  p_application_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'candidate_auth_required';
  end if;

  update public.career_job_applications
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_application_id
    and candidate_id = auth.uid()
    and status in ('submitted', 'screening', 'in_process');

  if not found then
    raise exception using errcode = 'P0002', message = 'application_not_withdrawable';
  end if;
end;
$$;

alter table public.career_job_applications enable row level security;
alter table public.career_job_application_history enable row level security;

create policy "candidate reads own applications"
on public.career_job_applications for select to authenticated
using (candidate_id = auth.uid());

create policy "hr reads job applications"
on public.career_job_applications for select to authenticated
using (public.can_manage_hr());

create policy "hr updates job applications"
on public.career_job_applications for update to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

create policy "hr reads application history"
on public.career_job_application_history for select to authenticated
using (public.can_manage_hr());

grant select, update on public.career_job_applications to authenticated;
grant select on public.career_job_application_history to authenticated;
revoke execute on function public.submit_career_job_application(uuid) from public, anon;
revoke execute on function public.withdraw_career_job_application(uuid) from public, anon;
grant execute on function public.submit_career_job_application(uuid) to authenticated;
grant execute on function public.withdraw_career_job_application(uuid) to authenticated;

commit;
