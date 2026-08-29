-- Permissões do módulo Experiência e Pesquisas.
alter table public.profiles drop constraint if exists profiles_permissions_check;

update public.profiles
set permissions = permissions || array[
  'surveys.view', 'surveys.manage', 'surveys.reports',
  'surveys.qrcode', 'surveys.admin'
]::text[]
where active
  and (role::text in ('super_admin', 'admin') or access_profile in ('super_admin', 'manager'))
  and not ('surveys.admin' = any(permissions));

alter table public.profiles add constraint profiles_permissions_check check (
  permissions <@ array[
    'publications.view', 'publications.edit', 'publications.publish',
    'hr.view', 'hr.evaluate', 'hr.manage',
    'scheduling.view', 'scheduling.manage',
    'contact.view', 'contact.manage', 'users.manage', 'audit.view',
    'settings.manage', 'surveys.view', 'surveys.manage', 'surveys.reports',
    'surveys.qrcode', 'surveys.admin'
  ]::text[]
  and (not ('publications.edit' = any(permissions)) or 'publications.view' = any(permissions))
  and (not ('publications.publish' = any(permissions)) or (
    'publications.view' = any(permissions) and 'publications.edit' = any(permissions)
  ))
  and (not ('hr.evaluate' = any(permissions)) or 'hr.view' = any(permissions))
  and (not ('hr.manage' = any(permissions)) or (
    'hr.view' = any(permissions) and 'hr.evaluate' = any(permissions)
  ))
  and (not ('scheduling.manage' = any(permissions)) or 'scheduling.view' = any(permissions))
  and (not ('contact.manage' = any(permissions)) or 'contact.view' = any(permissions))
  and (not ('surveys.manage' = any(permissions)) or 'surveys.view' = any(permissions))
  and (not ('surveys.reports' = any(permissions)) or 'surveys.view' = any(permissions))
  and (not ('surveys.admin' = any(permissions)) or (
    'surveys.view' = any(permissions)
    and 'surveys.manage' = any(permissions)
    and 'surveys.reports' = any(permissions)
    and 'surveys.qrcode' = any(permissions)
  ))
);

create or replace function public.current_admin_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when not active then array[]::text[]
        when role::text = 'super_admin' or access_profile = 'super_admin' then array[
          'publications.view', 'publications.edit', 'publications.publish',
          'hr.view', 'hr.evaluate', 'hr.manage',
          'scheduling.view', 'scheduling.manage',
          'contact.view', 'contact.manage', 'users.manage', 'audit.view',
          'settings.manage', 'surveys.view', 'surveys.manage',
          'surveys.reports', 'surveys.qrcode', 'surveys.admin'
        ]
        else permissions
      end
      from public.profiles
      where id = auth.uid()
    ),
    array[]::text[]
  );
$$;
revoke all on function public.current_admin_permissions() from public, anon;
grant execute on function public.current_admin_permissions() to authenticated;

create table public.survey_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_organizations_name_check check (char_length(btrim(name)) between 2 and 120)
);

create table public.survey_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.survey_organizations(id),
  name text not null,
  slug text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.survey_profile_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.survey_organizations(id),
  unit_id uuid references public.survey_units(id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create unique index survey_profile_access_scope_uidx
on public.survey_profile_access (
  profile_id,
  organization_id,
  coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table public.survey_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.survey_organizations(id),
  unit_id uuid references public.survey_units(id),
  name text not null,
  slug text not null,
  title text not null,
  description text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
  starts_at timestamptz,
  ends_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (organization_id, slug),
  constraint survey_campaign_dates_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.survey_campaigns(id),
  stable_key text not null,
  category text not null,
  question_type text not null check (question_type in (
    'STAR_5', 'NPS_10', 'NUMBER_SCALE', 'YES_NO', 'SINGLE_CHOICE',
    'MULTIPLE_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'AUDIO'
  )),
  title text not null,
  description text,
  required boolean not null default false,
  allow_na boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  current_version_id uuid,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (campaign_id, stable_key)
);

create table public.survey_question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id),
  version_number integer not null,
  category text not null,
  question_type text not null check (question_type in (
    'STAR_5', 'NPS_10', 'NUMBER_SCALE', 'YES_NO', 'SINGLE_CHOICE',
    'MULTIPLE_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'AUDIO'
  )),
  title text not null,
  description text,
  required boolean not null,
  allow_na boolean not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique (question_id, version_number)
);

alter table public.survey_questions
  add constraint survey_questions_current_version_fkey
  foreign key (current_version_id) references public.survey_question_versions(id);

create table public.survey_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id),
  version_id uuid not null references public.survey_question_versions(id),
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (version_id, value)
);

create table public.survey_question_rules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.survey_campaigns(id),
  source_question_id uuid references public.survey_questions(id),
  operator text not null check (operator in (
    'EQ', 'NEQ', 'LTE', 'GTE', 'CONTAINS', 'ANY_DIMENSION_LTE', 'AVERAGE_GTE'
  )),
  comparison_value jsonb not null default 'null'::jsonb,
  target_question_id uuid not null references public.survey_questions(id),
  action text not null default 'SHOW' check (action in ('SHOW', 'HIDE')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  constraint survey_question_rules_not_self check (source_question_id is null or source_question_id <> target_question_id),
  unique nulls not distinct (source_question_id, target_question_id, operator, action)
);

create table public.survey_qr_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.survey_organizations(id),
  unit_id uuid references public.survey_units(id),
  campaign_id uuid references public.survey_campaigns(id),
  stable_token text not null unique,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  constraint survey_qr_token_check check (char_length(stable_token) >= 48)
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.survey_organizations(id),
  unit_id uuid references public.survey_units(id),
  campaign_id uuid not null references public.survey_campaigns(id),
  qr_code_id uuid not null references public.survey_qr_codes(id),
  access_token_hash text not null,
  status text not null default 'STARTED' check (status in ('STARTED', 'COMPLETED', 'ABANDONED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  overall_score numeric(4,2),
  nps_score smallint check (nps_score between 0 and 10),
  critical boolean not null default false,
  wants_contact boolean not null default false,
  contact_name text,
  contact_phone text,
  contact_consent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint survey_response_contact_check check (
    (not wants_contact and contact_name is null and contact_phone is null and contact_consent_at is null)
    or (wants_contact and char_length(btrim(coalesce(contact_name, ''))) between 2 and 100
      and char_length(regexp_replace(coalesce(contact_phone, ''), '[^0-9]', '', 'g')) between 10 and 13
      and contact_consent_at is not null)
  )
);

create table public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses(id),
  question_id uuid not null references public.survey_questions(id),
  question_version_id uuid not null references public.survey_question_versions(id),
  numeric_value numeric(8,2),
  text_value text,
  option_value jsonb,
  not_applicable boolean not null default false,
  created_at timestamptz not null default now(),
  unique (response_id, question_id),
  constraint survey_answer_has_value check (
    not_applicable or numeric_value is not null or text_value is not null or option_value is not null
  )
);

create table public.survey_feedback (
  response_id uuid primary key references public.survey_responses(id),
  mode text not null default 'NONE' check (mode in ('TEXT', 'AUDIO', 'NONE')),
  text_content text,
  audio_storage_path text,
  audio_mime_type text,
  audio_duration_seconds integer,
  transcript text,
  ai_analysis jsonb,
  created_at timestamptz not null default now(),
  constraint survey_feedback_content_check check (
    (mode = 'NONE' and text_content is null and audio_storage_path is null)
    or (mode = 'TEXT' and char_length(btrim(coalesce(text_content, ''))) between 1 and 1500 and audio_storage_path is null)
    or (mode = 'AUDIO' and audio_storage_path is not null and text_content is null
      and audio_duration_seconds between 1 and 90)
  )
);

create table public.survey_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.survey_organizations(id),
  unit_id uuid references public.survey_units(id),
  campaign_id uuid not null references public.survey_campaigns(id),
  qr_code_id uuid not null references public.survey_qr_codes(id),
  response_id uuid references public.survey_responses(id),
  event_type text not null check (event_type in ('OPENED', 'STARTED', 'COMPLETED')),
  created_at timestamptz not null default now()
);

create table public.survey_monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.survey_organizations(id),
  unit_id uuid references public.survey_units(id),
  year integer not null check (year between 2020 and 2200),
  month integer not null check (month between 1 and 12),
  snapshot_data jsonb not null,
  response_count integer not null default 0,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id)
);

create unique index survey_monthly_snapshots_tenant_period_uidx
on public.survey_monthly_snapshots (
  organization_id,
  coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
  year,
  month
);
create index survey_campaign_status_idx on public.survey_campaigns (organization_id, unit_id, status);
create index survey_response_campaign_completed_idx on public.survey_responses (campaign_id, completed_at desc);
create index survey_response_tenant_completed_idx on public.survey_responses (organization_id, unit_id, completed_at desc);
create index survey_answer_response_idx on public.survey_answers (response_id);
create index survey_answer_question_idx on public.survey_answers (question_id, created_at);
create index survey_question_campaign_active_order_idx on public.survey_questions (campaign_id, active, sort_order) where deleted_at is null;
create index survey_rules_campaign_idx on public.survey_question_rules (campaign_id, active);
create index survey_events_campaign_created_idx on public.survey_events (campaign_id, created_at);
