begin;

-- A limpeza dos objetos antigos é executada antes desta migration pela API do
-- Storage. A migration recusa avançar se ainda houver metadados duplicados.
do $$
begin
  if exists (
    select 1
    from public.candidate_resumes
    group by candidate_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'candidate_resume_duplicates_exist';
  end if;
end $$;

create unique index if not exists candidate_resumes_candidate_unique_idx
on public.candidate_resumes (candidate_id);

create or replace function public.replace_candidate_resume(
  p_original_name text,
  p_storage_path text,
  p_size_bytes bigint,
  p_extraction_status text,
  p_extracted_data jsonb,
  p_warnings jsonb,
  p_parser_version text,
  p_text_sha256 text default null,
  p_total_pages integer default null
)
returns table (
  resume_id uuid,
  review_id uuid,
  old_storage_path text,
  resume_version integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate uuid := auth.uid();
  current_resume public.candidate_resumes%rowtype;
begin
  if candidate is null or not exists (
    select 1 from public.candidate_accounts where id = candidate
  ) then
    raise exception using errcode = '42501', message = 'candidate_account_required';
  end if;
  if p_original_name is null
    or char_length(trim(p_original_name)) not between 1 and 255
    or p_storage_path is null
    or p_storage_path not like candidate::text || '/%'
    or p_size_bytes not between 1 and 10485760
    or p_extraction_status not in ('ready', 'partial', 'failed')
    or jsonb_typeof(p_extracted_data) <> 'object'
    or jsonb_typeof(p_warnings) <> 'array'
    or char_length(coalesce(p_parser_version, '')) not between 1 and 40
    or (p_text_sha256 is not null and p_text_sha256 !~ '^[a-f0-9]{64}$')
    or (p_total_pages is not null and p_total_pages < 1) then
    raise exception using errcode = '22023', message = 'invalid_candidate_resume';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(candidate::text, 0));
  select * into current_resume
  from public.candidate_resumes
  where candidate_id = candidate
  for update;

  if current_resume.id is not null
    and current_resume.storage_path = p_storage_path then
    select extraction.id into review_id
    from public.candidate_resume_extractions extraction
    where extraction.resume_id = current_resume.id;
    resume_id := current_resume.id;
    old_storage_path := null;
    resume_version := current_resume.version;
    return next;
    return;
  end if;

  if current_resume.id is null then
    insert into public.candidate_resumes (
      candidate_id,
      original_name,
      storage_path,
      size_bytes,
      mime_type,
      version
    ) values (
      candidate,
      trim(p_original_name),
      p_storage_path,
      p_size_bytes,
      'application/pdf',
      1
    )
    returning id, version into resume_id, resume_version;
    old_storage_path := null;
  else
    resume_id := current_resume.id;
    old_storage_path := current_resume.storage_path;
    resume_version := current_resume.version + 1;

    delete from public.candidate_resume_extractions extraction
    where extraction.resume_id = current_resume.id
      and extraction.candidate_id = candidate;

    update public.candidate_resumes
    set
      original_name = trim(p_original_name),
      storage_path = p_storage_path,
      size_bytes = p_size_bytes,
      mime_type = 'application/pdf',
      version = resume_version,
      created_at = now()
    where id = current_resume.id
      and candidate_id = candidate;
  end if;

  insert into public.candidate_resume_extractions (
    candidate_id,
    resume_id,
    status,
    extracted_data,
    warnings,
    parser_version,
    text_sha256,
    total_pages
  ) values (
    candidate,
    resume_id,
    p_extraction_status,
    p_extracted_data,
    p_warnings,
    p_parser_version,
    p_text_sha256,
    p_total_pages
  )
  returning id into review_id;

  insert into public.candidate_consents (
    candidate_id,
    consent_type,
    purpose,
    text_version,
    granted
  ) values (
    candidate,
    'resume_processing',
    'Processamento do currículo PDF para identificar informações profissionais que serão revisadas pelo candidato.',
    '2026-08-v1',
    true
  );

  return next;
end;
$$;

revoke execute on function public.replace_candidate_resume(
  text, text, bigint, text, jsonb, jsonb, text, text, integer
) from public, anon;
grant execute on function public.replace_candidate_resume(
  text, text, bigint, text, jsonb, jsonb, text, text, integer
) to authenticated;

drop policy if exists "candidate deletes own resume extractions"
on public.candidate_resume_extractions;
create policy "candidate deletes own resume extractions"
on public.candidate_resume_extractions for delete to authenticated
using (candidate_id = auth.uid());
grant delete on public.candidate_resume_extractions to authenticated;

create or replace function public.require_candidate_resume_for_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.candidate_resumes
    where candidate_id = new.candidate_id
  ) then
    raise exception using errcode = '23514', message = 'resume_required';
  end if;
  return new;
end;
$$;

drop trigger if exists career_job_applications_require_resume
on public.career_job_applications;
create trigger career_job_applications_require_resume
before insert on public.career_job_applications
for each row execute function public.require_candidate_resume_for_application();

create or replace function public.require_candidate_resume_for_talent_pool()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and not exists (
    select 1 from public.candidate_resumes
    where candidate_id = new.candidate_id
  ) then
    raise exception using errcode = '23514', message = 'resume_required';
  end if;
  return new;
end;
$$;

drop trigger if exists career_talent_pool_memberships_require_resume
on public.career_talent_pool_memberships;
create trigger career_talent_pool_memberships_require_resume
before insert or update of candidate_id, status
on public.career_talent_pool_memberships
for each row execute function public.require_candidate_resume_for_talent_pool();

revoke execute on function public.require_candidate_resume_for_application()
from public, anon, authenticated;
revoke execute on function public.require_candidate_resume_for_talent_pool()
from public, anon, authenticated;

drop trigger if exists talent_pool_touch_candidate_resume
on public.candidate_resumes;
create trigger talent_pool_touch_candidate_resume
after insert or update or delete on public.candidate_resumes
for each row execute function public.touch_talent_pool_professional_update();

commit;
