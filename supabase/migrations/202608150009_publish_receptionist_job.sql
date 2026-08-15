begin;

-- A quantidade de posições é opcional para evitar publicar um número não
-- confirmado pela INNEURO.
alter table public.career_jobs
alter column positions drop not null;

alter table public.career_jobs
drop constraint if exists career_jobs_positions_check;

alter table public.career_jobs
add constraint career_jobs_positions_check
check (positions is null or positions between 1 and 100);

-- Datas públicas e disponibilidade usam o fuso local de Macapá (UTC-3),
-- evitando que uma vaga encerre três horas antes do fim do dia local.
drop policy if exists "public reads available jobs" on public.career_jobs;
create policy "public reads available jobs"
on public.career_jobs for select to anon, authenticated
using (
  (
    status = 'published'
    and opens_on <= (now() at time zone 'America/Belem')::date
    and (
      closes_on is null
      or closes_on >= (now() at time zone 'America/Belem')::date
    )
  )
  or public.can_manage_hr()
);

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
  today_macapa date := (now() at time zone 'America/Belem')::date;
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
      and opens_on <= today_macapa
      and (closes_on is null or closes_on >= today_macapa)
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

insert into public.company_units (
  name,
  address,
  neighborhood,
  city,
  state,
  postal_code,
  active
)
select
  'INNEURO',
  'Rua Marcelo Cândia, 535',
  'Santa Rita',
  'Macapá',
  'AP',
  null,
  true
where not exists (
  select 1
  from public.company_units
  where lower(trim(name)) = 'inneuro'
    and lower(trim(address)) = lower('Rua Marcelo Cândia, 535')
    and city = 'Macapá'
    and state = 'AP'
);

do $$
declare
  receptionist_area_id uuid;
  inneuro_unit_id uuid;
  publisher_id uuid;
begin
  select id into receptionist_area_id
  from public.career_job_areas
  where slug = 'recepcao'
  limit 1;

  select id into inneuro_unit_id
  from public.company_units
  where lower(trim(name)) = 'inneuro'
    and lower(trim(address)) = lower('Rua Marcelo Cândia, 535')
    and city = 'Macapá'
    and state = 'AP'
  order by created_at
  limit 1;

  select id into publisher_id
  from public.profiles
  where role in ('super_admin', 'admin')
  order by case when role = 'super_admin' then 0 else 1 end, created_at
  limit 1;

  if receptionist_area_id is null then
    raise exception 'career_job_area_recepcao_not_found';
  end if;
  if inneuro_unit_id is null then
    raise exception 'inneuro_company_unit_not_found';
  end if;
  if publisher_id is null then
    raise exception 'career_job_publisher_not_found';
  end if;

  insert into public.career_jobs (
    slug,
    title,
    area_id,
    unit_id,
    positions,
    location,
    work_mode,
    work_schedule,
    description,
    activities,
    schooling,
    desirable_experience,
    required_requirements,
    desirable_requirements,
    skills,
    certifications,
    opens_on,
    closes_on,
    status,
    published_at,
    created_by,
    updated_by,
    published_by
  ) values (
    'recepcionista',
    'Recepcionista',
    receptionist_area_id,
    inneuro_unit_id,
    null,
    'Macapá - AP',
    'onsite',
    null,
    'A INNEURO está recebendo candidaturas para a função de Recepcionista. Buscamos profissionais com boa comunicação, facilidade no atendimento ao público, organização, cordialidade e disposição para proporcionar um atendimento acolhedor aos nossos pacientes.',
    'Atendimento ao público e organização das rotinas de recepção, com cordialidade e postura profissional.',
    'Ensino Médio Completo',
    'Experiência anterior na função de recepcionista ou em atendimento ao público será considerada um diferencial.',
    E'Ensino Médio Completo;\nFacilidade com atendimento ao público;\nBoa comunicação;\nOrganização;\nCordialidade;\nPostura profissional.',
    null,
    E'Facilidade com atendimento ao público;\nBoa comunicação;\nOrganização;\nCordialidade;\nPostura profissional.',
    null,
    date '2026-08-15',
    date '2026-09-30',
    'published',
    timestamptz '2026-08-15 03:00:00+00',
    publisher_id,
    publisher_id,
    publisher_id
  )
  on conflict (slug) do update set
    title = excluded.title,
    area_id = excluded.area_id,
    unit_id = excluded.unit_id,
    positions = excluded.positions,
    location = excluded.location,
    work_mode = excluded.work_mode,
    work_schedule = excluded.work_schedule,
    description = excluded.description,
    activities = excluded.activities,
    schooling = excluded.schooling,
    desirable_experience = excluded.desirable_experience,
    required_requirements = excluded.required_requirements,
    desirable_requirements = excluded.desirable_requirements,
    skills = excluded.skills,
    certifications = excluded.certifications,
    opens_on = excluded.opens_on,
    closes_on = excluded.closes_on,
    status = excluded.status,
    published_at = excluded.published_at,
    updated_by = excluded.updated_by,
    published_by = excluded.published_by;
end;
$$;

commit;
