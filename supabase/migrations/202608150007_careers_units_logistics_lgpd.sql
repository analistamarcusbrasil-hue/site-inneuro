begin;

create table if not exists public.company_units (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  address text not null check (char_length(trim(address)) between 2 and 200),
  neighborhood text not null check (char_length(trim(neighborhood)) between 2 and 120),
  city text not null check (char_length(trim(city)) between 2 and 100),
  state text not null check (state ~ '^[A-Z]{2}$'),
  postal_code text check (
    postal_code is null or postal_code ~ '^\d{5}-?\d{3}$'
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_jobs
add column if not exists unit_id uuid references public.company_units(id) on delete restrict;

alter table public.candidate_profiles
add column if not exists neighborhood text check (
  neighborhood is null or char_length(trim(neighborhood)) <= 120
);

alter table public.career_job_applications
add column if not exists source text not null default 'site_inneuro'
  check (source in ('site_inneuro', 'instagram', 'linkedin', 'referral', 'campaign', 'other'));

create table if not exists public.career_application_logistics (
  application_id uuid primary key references public.career_job_applications(id) on delete cascade,
  unit_id uuid references public.company_units(id) on delete restrict,
  unit_snapshot jsonb,
  candidate_neighborhood_snapshot text,
  candidate_city_snapshot text,
  candidate_state_snapshot text,
  commute_feasibility text check (
    commute_feasibility is null or commute_feasibility in ('yes', 'no', 'evaluate')
  ),
  commute_time text check (
    commute_time is null or commute_time in ('up_to_30', '31_to_60', '61_to_90', 'over_90', 'unknown')
  ),
  transport_modes text[] not null default '{}'::text[],
  transit_benefit text check (
    transit_benefit is null or transit_benefit in ('yes', 'no', 'unknown')
  ),
  created_at timestamptz not null default now(),
  check (
    transport_modes <@ array[
      'public_transport', 'car', 'motorcycle', 'bicycle', 'walking',
      'ride_hailing', 'other', 'prefer_not_to_say'
    ]::text[]
  )
);

create table if not exists public.candidate_consents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  consent_type text not null check (
    consent_type in (
      'recruitment_process',
      'talent_pool',
      'resume_processing',
      'automated_screening_support'
    )
  ),
  purpose text not null check (char_length(trim(purpose)) between 10 and 500),
  text_version text not null check (char_length(trim(text_version)) between 1 and 40),
  granted boolean not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.candidate_data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'in_review', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  resolution_note text check (
    resolution_note is null or char_length(resolution_note) <= 1000
  )
);

create unique index if not exists candidate_data_deletion_active_idx
on public.candidate_data_deletion_requests (candidate_id)
where status in ('requested', 'in_review');

create table if not exists public.career_retention_policies (
  data_category text primary key check (
    data_category in ('profiles', 'applications', 'resumes', 'talent_pool')
  ),
  retention_days integer check (retention_days is null or retention_days > 0),
  automatic_deletion_enabled boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

insert into public.career_retention_policies (
  data_category,
  retention_days,
  automatic_deletion_enabled,
  notes
) values
  ('profiles', null, false, 'Prazo aguardando definição formal da política de retenção.'),
  ('applications', null, false, 'Prazo aguardando definição formal da política de retenção.'),
  ('resumes', null, false, 'Prazo aguardando definição formal da política de retenção.'),
  ('talent_pool', null, false, 'Prazo aguardando definição formal da política de retenção.')
on conflict (data_category) do nothing;

create index if not exists career_jobs_unit_idx
on public.career_jobs (unit_id, status, opens_on desc);

create index if not exists career_application_logistics_unit_idx
on public.career_application_logistics (unit_id, commute_feasibility, commute_time);

create index if not exists candidate_consents_candidate_idx
on public.candidate_consents (candidate_id, recorded_at desc);

drop trigger if exists company_units_updated_at on public.company_units;
create trigger company_units_updated_at
before update on public.company_units
for each row execute procedure public.set_updated_at();

drop trigger if exists career_retention_policies_updated_at
on public.career_retention_policies;
create trigger career_retention_policies_updated_at
before update on public.career_retention_policies
for each row execute procedure public.set_updated_at();

create or replace function public.prevent_candidate_consent_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using errcode = '55000', message = 'consent_history_is_immutable';
end;
$$;

drop trigger if exists candidate_consents_immutable
on public.candidate_consents;
create trigger candidate_consents_immutable
before update or delete on public.candidate_consents
for each row execute procedure public.prevent_candidate_consent_changes();

create or replace function public.submit_career_job_application_with_logistics(
  p_job_id uuid,
  p_commute_feasibility text default null,
  p_commute_time text default null,
  p_transport_modes text[] default '{}'::text[],
  p_transit_benefit text default null,
  p_source text default 'site_inneuro',
  p_recruitment_consent boolean default false,
  p_automated_support_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate uuid := auth.uid();
  application_id uuid;
  job_record record;
  profile_record record;
  unit_data jsonb;
begin
  select job.id, job.work_mode, job.unit_id
    into job_record
  from public.career_jobs job
  where job.id = p_job_id;

  if job_record.id is null then
    raise exception using errcode = 'P0002', message = 'job_not_available';
  end if;

  if job_record.work_mode in ('onsite', 'hybrid') then
    if job_record.unit_id is null
      or p_commute_feasibility not in ('yes', 'no', 'evaluate')
      or p_commute_time not in ('up_to_30', '31_to_60', '61_to_90', 'over_90', 'unknown')
      or p_transit_benefit not in ('yes', 'no', 'unknown') then
      raise exception using errcode = '22023', message = 'job_logistics_required';
    end if;
  end if;

  if not (coalesce(p_transport_modes, '{}'::text[]) <@ array[
    'public_transport', 'car', 'motorcycle', 'bicycle', 'walking',
    'ride_hailing', 'other', 'prefer_not_to_say'
  ]::text[]) then
    raise exception using errcode = '22023', message = 'invalid_transport_mode';
  end if;

  if p_source not in ('site_inneuro', 'instagram', 'linkedin', 'referral', 'campaign', 'other') then
    raise exception using errcode = '22023', message = 'invalid_application_source';
  end if;

  if p_recruitment_consent is not true
    or p_automated_support_consent is not true then
    raise exception using errcode = '22023', message = 'application_consent_required';
  end if;

  application_id := public.submit_career_job_application(p_job_id);

  update public.career_job_applications
  set source = p_source
  where id = application_id and candidate_id = candidate;

  select neighborhood, city, state
    into profile_record
  from public.candidate_profiles
  where candidate_id = candidate;

  if job_record.unit_id is not null then
    select jsonb_build_object(
      'id', unit.id,
      'name', unit.name,
      'address', unit.address,
      'neighborhood', unit.neighborhood,
      'city', unit.city,
      'state', unit.state,
      'postal_code', unit.postal_code
    ) into unit_data
    from public.company_units unit
    where unit.id = job_record.unit_id and unit.active = true;
  end if;

  insert into public.career_application_logistics (
    application_id,
    unit_id,
    unit_snapshot,
    candidate_neighborhood_snapshot,
    candidate_city_snapshot,
    candidate_state_snapshot,
    commute_feasibility,
    commute_time,
    transport_modes,
    transit_benefit
  ) values (
    application_id,
    job_record.unit_id,
    unit_data,
    profile_record.neighborhood,
    profile_record.city,
    profile_record.state,
    case when job_record.work_mode in ('onsite', 'hybrid') then p_commute_feasibility else null end,
    case when job_record.work_mode in ('onsite', 'hybrid') then p_commute_time else null end,
    coalesce(p_transport_modes, '{}'::text[]),
    case when job_record.work_mode in ('onsite', 'hybrid') then p_transit_benefit else null end
  );

  insert into public.candidate_consents (
    candidate_id,
    consent_type,
    purpose,
    text_version,
    granted
  ) values
    (
      candidate,
      'recruitment_process',
      'Tratamento dos dados profissionais para participação no processo seletivo desta vaga.',
      '2026-08-v1',
      true
    ),
    (
      candidate,
      'automated_screening_support',
      'Uso de ferramentas automatizadas para organizar dados profissionais e apoiar a triagem, sem decisão automática.',
      '2026-08-v1',
      true
    );

  return application_id;
end;
$$;

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
    or jsonb_array_length(new.criteria) <> 7 then
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
    'availability',
    'operational_compatibility'
  )
    and jsonb_typeof(item -> 'label') = 'string'
    and char_length(trim(item ->> 'label')) between 3 and 120
    and jsonb_typeof(item -> 'weight') = 'number'
    and (item ->> 'weight') ~ '^\d+$'
    and (item ->> 'weight')::integer between 0 and 100;

  if criterion_count <> 7 or distinct_count <> 7 or total_weight <> 100 then
    raise exception using errcode = '22023', message = 'invalid_matching_matrix';
  end if;

  return new;
end;
$$;

alter table public.company_units enable row level security;
alter table public.career_application_logistics enable row level security;
alter table public.candidate_consents enable row level security;
alter table public.candidate_data_deletion_requests enable row level security;
alter table public.career_retention_policies enable row level security;

create policy "public reads active company units"
on public.company_units for select to anon, authenticated
using (active or public.can_manage_hr());

create policy "hr manages company units"
on public.company_units for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

create policy "candidate reads own application logistics"
on public.career_application_logistics for select to authenticated
using (
  exists (
    select 1 from public.career_job_applications application
    where application.id = career_application_logistics.application_id
      and application.candidate_id = auth.uid()
  )
);

create policy "hr reads application logistics"
on public.career_application_logistics for select to authenticated
using (public.can_manage_hr());

create policy "assigned evaluator reads application logistics"
on public.career_application_logistics for select to authenticated
using (public.is_assigned_application_evaluator(application_id));

create policy "candidate reads own consents"
on public.candidate_consents for select to authenticated
using (candidate_id = auth.uid());

create policy "candidate records own consents"
on public.candidate_consents for insert to authenticated
with check (candidate_id = auth.uid());

create policy "hr reads candidate consents"
on public.candidate_consents for select to authenticated
using (public.can_manage_hr());

create policy "candidate reads own deletion requests"
on public.candidate_data_deletion_requests for select to authenticated
using (candidate_id = auth.uid());

create policy "candidate creates own deletion request"
on public.candidate_data_deletion_requests for insert to authenticated
with check (candidate_id = auth.uid() and status = 'requested');

create policy "hr manages data deletion requests"
on public.candidate_data_deletion_requests for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

create policy "hr manages retention policies"
on public.career_retention_policies for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

grant select, insert, update on public.company_units to authenticated;
grant select on public.company_units to anon;
grant select on public.career_application_logistics to authenticated;
grant select, insert on public.candidate_consents to authenticated;
grant select, insert, update on public.candidate_data_deletion_requests to authenticated;
grant select, update on public.career_retention_policies to authenticated;

revoke execute on function public.submit_career_job_application(uuid)
from public, anon, authenticated;
revoke execute on function public.submit_career_job_application_with_logistics(
  uuid, text, text, text[], text, text, boolean, boolean
) from public, anon;
grant execute on function public.submit_career_job_application_with_logistics(
  uuid, text, text, text[], text, text, boolean, boolean
) to authenticated;

revoke execute on function public.prevent_candidate_consent_changes()
from public, anon, authenticated;

comment on table public.career_application_logistics is
  'Informações operacionais autodeclaradas, separadas da avaliação profissional e sem bônus por transporte.';
comment on table public.career_retention_policies is
  'Configuração futura de retenção. Exclusão automática permanece desabilitada até definição formal.';

commit;
