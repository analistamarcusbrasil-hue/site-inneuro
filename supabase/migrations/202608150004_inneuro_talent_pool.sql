begin;

create table if not exists public.career_talent_pool_memberships (
  candidate_id uuid primary key references public.candidate_accounts(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'left', 'deletion_requested')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  deletion_requested_at timestamptz,
  professional_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and left_at is null and deletion_requested_at is null)
    or (status = 'left' and left_at is not null and deletion_requested_at is null)
    or (status = 'deletion_requested' and deletion_requested_at is not null)
  )
);

create table if not exists public.career_talent_pool_interests (
  candidate_id uuid not null references public.career_talent_pool_memberships(candidate_id) on delete cascade,
  area_id uuid not null references public.career_job_areas(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (candidate_id, area_id)
);

create index if not exists career_talent_pool_status_idx
on public.career_talent_pool_memberships (status, professional_updated_at desc);

create index if not exists career_talent_pool_interest_area_idx
on public.career_talent_pool_interests (area_id, candidate_id);

drop trigger if exists career_talent_pool_memberships_updated_at
on public.career_talent_pool_memberships;
create trigger career_talent_pool_memberships_updated_at
before update on public.career_talent_pool_memberships
for each row execute procedure public.set_updated_at();

create or replace function public.set_talent_pool_membership(p_area_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate uuid := auth.uid();
  requested_count integer;
  valid_count integer;
begin
  if candidate is null or not exists (
    select 1 from public.candidate_accounts where id = candidate
  ) then
    raise exception using errcode = '42501', message = 'candidate_account_required';
  end if;

  if exists (
    select 1
    from public.career_talent_pool_memberships
    where candidate_id = candidate
      and status = 'deletion_requested'
  ) then
    raise exception using errcode = '55000', message = 'talent_pool_deletion_pending';
  end if;

  select count(distinct area_id)
    into requested_count
  from unnest(coalesce(p_area_ids, '{}'::uuid[])) as area_id;

  if requested_count < 1 or requested_count > 20 then
    raise exception using errcode = '22023', message = 'talent_pool_areas_required';
  end if;

  select count(*)
    into valid_count
  from public.career_job_areas
  where id = any(p_area_ids)
    and is_active = true;

  if valid_count <> requested_count then
    raise exception using errcode = '22023', message = 'invalid_talent_pool_area';
  end if;

  insert into public.career_talent_pool_memberships (
    candidate_id,
    status,
    joined_at,
    left_at,
    deletion_requested_at,
    professional_updated_at
  ) values (
    candidate,
    'active',
    now(),
    null,
    null,
    now()
  )
  on conflict (candidate_id) do update set
    status = 'active',
    joined_at = case
      when career_talent_pool_memberships.status = 'active'
        then career_talent_pool_memberships.joined_at
      else now()
    end,
    left_at = null,
    deletion_requested_at = null,
    professional_updated_at = now();

  delete from public.career_talent_pool_interests
  where candidate_id = candidate;

  insert into public.career_talent_pool_interests (candidate_id, area_id)
  select candidate, area_id
  from (
    select distinct unnest(p_area_ids) as area_id
  ) selected_areas;
end;
$$;

create or replace function public.leave_talent_pool()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.career_talent_pool_memberships
  set
    status = 'left',
    left_at = now(),
    deletion_requested_at = null
  where candidate_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception using errcode = 'P0002', message = 'active_talent_pool_membership_not_found';
  end if;

  delete from public.career_talent_pool_interests
  where candidate_id = auth.uid();
end;
$$;

create or replace function public.request_talent_pool_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.career_talent_pool_memberships
  set
    status = 'deletion_requested',
    left_at = case when status = 'active' then now() else left_at end,
    deletion_requested_at = now()
  where candidate_id = auth.uid()
    and status in ('active', 'left');

  if not found then
    raise exception using errcode = 'P0002', message = 'talent_pool_membership_not_found';
  end if;

  delete from public.career_talent_pool_interests
  where candidate_id = auth.uid();
end;
$$;

create or replace function public.touch_talent_pool_professional_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate uuid;
begin
  if tg_op = 'DELETE' then
    candidate := coalesce(
      nullif(to_jsonb(old) ->> 'candidate_id', '')::uuid,
      nullif(to_jsonb(old) ->> 'id', '')::uuid
    );
  else
    candidate := coalesce(
      nullif(to_jsonb(new) ->> 'candidate_id', '')::uuid,
      nullif(to_jsonb(new) ->> 'id', '')::uuid
    );
  end if;

  if candidate is not null then
    update public.career_talent_pool_memberships
    set professional_updated_at = now()
    where candidate_id = candidate;
  end if;

  return null;
end;
$$;

drop trigger if exists talent_pool_touch_candidate_account
on public.candidate_accounts;
create trigger talent_pool_touch_candidate_account
after update on public.candidate_accounts
for each row execute procedure public.touch_talent_pool_professional_update();

drop trigger if exists talent_pool_touch_candidate_profile
on public.candidate_profiles;
create trigger talent_pool_touch_candidate_profile
after insert or update or delete on public.candidate_profiles
for each row execute procedure public.touch_talent_pool_professional_update();

drop trigger if exists talent_pool_touch_candidate_experience
on public.candidate_experiences;
create trigger talent_pool_touch_candidate_experience
after insert or update or delete on public.candidate_experiences
for each row execute procedure public.touch_talent_pool_professional_update();

drop trigger if exists talent_pool_touch_candidate_education
on public.candidate_education;
create trigger talent_pool_touch_candidate_education
after insert or update or delete on public.candidate_education
for each row execute procedure public.touch_talent_pool_professional_update();

drop trigger if exists talent_pool_touch_candidate_certification
on public.candidate_certifications;
create trigger talent_pool_touch_candidate_certification
after insert or update or delete on public.candidate_certifications
for each row execute procedure public.touch_talent_pool_professional_update();

drop trigger if exists talent_pool_touch_candidate_skill
on public.candidate_skills;
create trigger talent_pool_touch_candidate_skill
after insert or update or delete on public.candidate_skills
for each row execute procedure public.touch_talent_pool_professional_update();

drop trigger if exists talent_pool_touch_candidate_resume
on public.candidate_resumes;
create trigger talent_pool_touch_candidate_resume
after insert or delete on public.candidate_resumes
for each row execute procedure public.touch_talent_pool_professional_update();

alter table public.career_talent_pool_memberships enable row level security;
alter table public.career_talent_pool_interests enable row level security;

create policy "candidate reads own talent pool membership"
on public.career_talent_pool_memberships for select to authenticated
using (candidate_id = auth.uid());

create policy "hr reads talent pool memberships"
on public.career_talent_pool_memberships for select to authenticated
using (public.can_manage_hr());

create policy "hr deletes requested talent pool memberships"
on public.career_talent_pool_memberships for delete to authenticated
using (public.can_manage_hr() and status = 'deletion_requested');

create policy "candidate reads own talent pool interests"
on public.career_talent_pool_interests for select to authenticated
using (candidate_id = auth.uid());

create policy "hr reads talent pool interests"
on public.career_talent_pool_interests for select to authenticated
using (public.can_manage_hr());

grant select, delete on public.career_talent_pool_memberships to authenticated;
grant select on public.career_talent_pool_interests to authenticated;

revoke execute on function public.set_talent_pool_membership(uuid[]) from public, anon;
revoke execute on function public.leave_talent_pool() from public, anon;
revoke execute on function public.request_talent_pool_deletion() from public, anon;
revoke execute on function public.touch_talent_pool_professional_update() from public, anon, authenticated;
grant execute on function public.set_talent_pool_membership(uuid[]) to authenticated;
grant execute on function public.leave_talent_pool() to authenticated;
grant execute on function public.request_talent_pool_deletion() to authenticated;

commit;
