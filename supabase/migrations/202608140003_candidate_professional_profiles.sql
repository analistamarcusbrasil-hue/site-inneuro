begin;

create table if not exists public.candidate_profiles (
  candidate_id uuid primary key references public.candidate_accounts(id) on delete cascade,
  whatsapp text,
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  professional_objective text check (
    professional_objective is null or char_length(professional_objective) <= 500
  ),
  about text check (about is null or char_length(about) <= 3000),
  availability text check (
    availability is null or char_length(availability) <= 800
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_experiences (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  company text not null check (char_length(trim(company)) between 2 and 160),
  job_title text not null check (char_length(trim(job_title)) between 2 and 160),
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  activities text not null check (char_length(trim(activities)) between 2 and 3000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (not is_current or end_date is null)
);

create table if not exists public.candidate_education (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  education_level text not null check (char_length(trim(education_level)) between 2 and 80),
  course text not null check (char_length(trim(course)) between 2 and 180),
  institution text not null check (char_length(trim(institution)) between 2 and 180),
  start_date date not null,
  end_date date,
  in_progress boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (not in_progress or end_date is null)
);

create table if not exists public.candidate_certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 180),
  institution text not null check (char_length(trim(institution)) between 2 and 180),
  completion_year integer not null check (completion_year between 1900 and 2100),
  expires_at date,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  original_name text not null check (char_length(trim(original_name)) between 1 and 255),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  unique (candidate_id, version)
);

create index if not exists candidate_experiences_order_idx
on public.candidate_experiences (candidate_id, sort_order, start_date desc);

create index if not exists candidate_education_order_idx
on public.candidate_education (candidate_id, sort_order, start_date desc);

create index if not exists candidate_certifications_order_idx
on public.candidate_certifications (candidate_id, sort_order, completion_year desc);

create unique index if not exists candidate_skills_unique_name_idx
on public.candidate_skills (candidate_id, lower(name));

create index if not exists candidate_resumes_version_idx
on public.candidate_resumes (candidate_id, version desc);

drop trigger if exists candidate_profiles_updated_at on public.candidate_profiles;
create trigger candidate_profiles_updated_at
before update on public.candidate_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists candidate_experiences_updated_at on public.candidate_experiences;
create trigger candidate_experiences_updated_at
before update on public.candidate_experiences
for each row execute procedure public.set_updated_at();

drop trigger if exists candidate_education_updated_at on public.candidate_education;
create trigger candidate_education_updated_at
before update on public.candidate_education
for each row execute procedure public.set_updated_at();

drop trigger if exists candidate_certifications_updated_at on public.candidate_certifications;
create trigger candidate_certifications_updated_at
before update on public.candidate_certifications
for each row execute procedure public.set_updated_at();

alter table public.candidate_profiles enable row level security;
alter table public.candidate_experiences enable row level security;
alter table public.candidate_education enable row level security;
alter table public.candidate_certifications enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.candidate_resumes enable row level security;

create policy "candidate manages own professional profile"
on public.candidate_profiles for all to authenticated
using (candidate_id = auth.uid())
with check (candidate_id = auth.uid());
create policy "hr reads candidate professional profiles"
on public.candidate_profiles for select to authenticated
using (public.can_manage_hr());

create policy "candidate manages own experiences"
on public.candidate_experiences for all to authenticated
using (candidate_id = auth.uid())
with check (candidate_id = auth.uid());
create policy "hr reads candidate experiences"
on public.candidate_experiences for select to authenticated
using (public.can_manage_hr());

create policy "candidate manages own education"
on public.candidate_education for all to authenticated
using (candidate_id = auth.uid())
with check (candidate_id = auth.uid());
create policy "hr reads candidate education"
on public.candidate_education for select to authenticated
using (public.can_manage_hr());

create policy "candidate manages own certifications"
on public.candidate_certifications for all to authenticated
using (candidate_id = auth.uid())
with check (candidate_id = auth.uid());
create policy "hr reads candidate certifications"
on public.candidate_certifications for select to authenticated
using (public.can_manage_hr());

create policy "candidate manages own skills"
on public.candidate_skills for all to authenticated
using (candidate_id = auth.uid())
with check (candidate_id = auth.uid());
create policy "hr reads candidate skills"
on public.candidate_skills for select to authenticated
using (public.can_manage_hr());

create policy "candidate manages own resume metadata"
on public.candidate_resumes for all to authenticated
using (candidate_id = auth.uid())
with check (candidate_id = auth.uid());
create policy "hr reads candidate resume metadata"
on public.candidate_resumes for select to authenticated
using (public.can_manage_hr());

grant select, insert, update, delete on
  public.candidate_profiles,
  public.candidate_experiences,
  public.candidate_education,
  public.candidate_certifications,
  public.candidate_skills,
  public.candidate_resumes
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-resumes',
  'candidate-resumes',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "candidate reads own resume files"
on storage.objects for select to authenticated
using (
  bucket_id = 'candidate-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "candidate uploads own resume files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'candidate-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "candidate deletes own resume files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'candidate-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "hr reads candidate resume files"
on storage.objects for select to authenticated
using (
  bucket_id = 'candidate-resumes'
  and public.can_manage_hr()
);

commit;
