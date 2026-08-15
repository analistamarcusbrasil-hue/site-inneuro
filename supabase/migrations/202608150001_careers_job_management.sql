begin;

create table if not exists public.career_job_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_jobs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(trim(title)) between 3 and 120),
  area_id uuid not null references public.career_job_areas(id),
  positions integer not null check (positions between 1 and 100),
  location text not null check (char_length(trim(location)) between 2 and 160),
  work_mode text not null check (work_mode in ('onsite', 'hybrid', 'remote')),
  work_schedule text check (work_schedule is null or char_length(work_schedule) <= 500),
  description text not null check (char_length(trim(description)) between 20 and 800),
  activities text not null check (char_length(trim(activities)) between 20 and 5000),
  schooling text not null check (char_length(trim(schooling)) between 2 and 1000),
  desirable_experience text check (
    desirable_experience is null or char_length(desirable_experience) <= 1500
  ),
  required_requirements text not null check (
    char_length(trim(required_requirements)) between 2 and 3000
  ),
  desirable_requirements text check (
    desirable_requirements is null or char_length(desirable_requirements) <= 3000
  ),
  skills text not null check (char_length(trim(skills)) between 2 and 2000),
  certifications text check (
    certifications is null or char_length(certifications) <= 1500
  ),
  opens_on date not null,
  closes_on date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'closed')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  published_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_on is null or closes_on >= opens_on),
  check (status <> 'published' or published_at is not null)
);

create index if not exists career_job_areas_order_idx
on public.career_job_areas (is_active desc, sort_order, name);

create index if not exists career_jobs_admin_idx
on public.career_jobs (status, updated_at desc);

create index if not exists career_jobs_public_idx
on public.career_jobs (opens_on desc, published_at desc)
where status = 'published';

drop trigger if exists career_job_areas_updated_at on public.career_job_areas;
create trigger career_job_areas_updated_at
before update on public.career_job_areas
for each row execute procedure public.set_updated_at();

drop trigger if exists career_jobs_updated_at on public.career_jobs;
create trigger career_jobs_updated_at
before update on public.career_jobs
for each row execute procedure public.set_updated_at();

alter table public.career_job_areas enable row level security;
alter table public.career_jobs enable row level security;

create policy "public reads active job areas"
on public.career_job_areas for select to anon, authenticated
using (is_active or public.can_manage_hr());

create policy "hr manages job areas"
on public.career_job_areas for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

create policy "public reads available jobs"
on public.career_jobs for select to anon, authenticated
using (
  (
    status = 'published'
    and opens_on <= current_date
    and (closes_on is null or closes_on >= current_date)
  )
  or public.can_manage_hr()
);

create policy "hr manages jobs"
on public.career_jobs for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

grant select on public.career_job_areas, public.career_jobs
to anon, authenticated;
grant insert, update on public.career_job_areas, public.career_jobs
to authenticated;

insert into public.career_job_areas (name, slug, sort_order)
values
  ('Corpo Médico', 'corpo-medico', 10),
  ('Radiologia', 'radiologia', 20),
  ('Enfermagem', 'enfermagem', 30),
  ('Recepção', 'recepcao', 40),
  ('Atendimento', 'atendimento', 50),
  ('Faturamento', 'faturamento', 60),
  ('Convênios', 'convenios', 70),
  ('Administrativo', 'administrativo', 80),
  ('Financeiro', 'financeiro', 90),
  ('Tecnologia', 'tecnologia', 100),
  ('Comercial', 'comercial', 110),
  ('Apoio', 'apoio', 120)
on conflict (slug) do nothing;

commit;
