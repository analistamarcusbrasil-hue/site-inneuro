begin;

-- Espelha o hotfix de produção sem remover candidatos, operadores ou histórico.
do $$
begin
  if exists (
    select 1
    from public.candidate_accounts ca
    join public.profiles p on p.id = ca.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'candidate_operator_overlap_requires_manual_review';
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_type text := coalesce(
    new.raw_app_meta_data ->> 'account_type',
    new.raw_user_meta_data ->> 'account_type',
    ''
  );
begin
  if account_type = 'candidate' then
    return new;
  end if;

  -- Operadores são provisionados exclusivamente pelo fluxo administrativo.
  if account_type not in ('staff', 'admin') then
    return new;
  end if;

  insert into public.profiles (
    id, full_name, email, role, access_profile, permissions
  ) values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'editor',
    'publications',
    array['publications.view', 'publications.edit']
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user()
from public, anon, authenticated;

create or replace function public.prevent_candidate_profile_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (
    select 1 from public.candidate_accounts ca where ca.id = new.id
  ) or exists (
    select 1
    from auth.users u
    where u.id = new.id
      and coalesce(
        u.raw_app_meta_data ->> 'account_type',
        u.raw_user_meta_data ->> 'account_type',
        ''
      ) = 'candidate'
  ) then
    raise exception using errcode = '23514', message = 'candidate_cannot_be_operator';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_operator_candidate_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.id) then
    raise exception using errcode = '23514', message = 'operator_cannot_be_candidate';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reject_candidates on public.profiles;
create trigger profiles_reject_candidates
before insert or update of id on public.profiles
for each row execute function public.prevent_candidate_profile_overlap();

drop trigger if exists candidate_accounts_reject_operators
on public.candidate_accounts;
create trigger candidate_accounts_reject_operators
before insert or update of id on public.candidate_accounts
for each row execute function public.prevent_operator_candidate_overlap();

revoke execute on function public.prevent_candidate_profile_overlap()
from public, anon, authenticated;
revoke execute on function public.prevent_operator_candidate_overlap()
from public, anon, authenticated;

-- hr.manage implica avaliar e visualizar; hr.evaluate implica visualizar.
alter table public.profiles
drop constraint if exists profiles_access_profile_check;
alter table public.profiles
drop constraint if exists profiles_permissions_check;

update public.profiles
set permissions = array_append(permissions, 'hr.evaluate')
where 'hr.manage' = any(permissions)
  and not ('hr.evaluate' = any(permissions));

update public.profiles
set permissions = array_append(permissions, 'hr.view')
where 'hr.evaluate' = any(permissions)
  and not ('hr.view' = any(permissions));

alter table public.profiles
add constraint profiles_access_profile_check
check (access_profile in (
  'super_admin', 'manager', 'reception', 'hr', 'evaluator',
  'publications', 'attendance', 'custom'
));

alter table public.profiles
add constraint profiles_permissions_check
check (
  permissions <@ array[
    'publications.view', 'publications.edit', 'publications.publish',
    'hr.view', 'hr.evaluate', 'hr.manage',
    'scheduling.view', 'scheduling.manage',
    'contact.view', 'contact.manage', 'users.manage', 'audit.view',
    'settings.manage'
  ]::text[]
  and (
    not ('publications.edit' = any(permissions))
    or 'publications.view' = any(permissions)
  )
  and (
    not ('publications.publish' = any(permissions))
    or (
      'publications.view' = any(permissions)
      and 'publications.edit' = any(permissions)
    )
  )
  and (
    not ('hr.evaluate' = any(permissions))
    or 'hr.view' = any(permissions)
  )
  and (
    not ('hr.manage' = any(permissions))
    or (
      'hr.view' = any(permissions)
      and 'hr.evaluate' = any(permissions)
    )
  )
  and (
    not ('scheduling.manage' = any(permissions))
    or 'scheduling.view' = any(permissions)
  )
  and (
    not ('contact.manage' = any(permissions))
    or 'contact.view' = any(permissions)
  )
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
        when role::text = 'super_admin' or access_profile = 'super_admin'
          then array[
            'publications.view', 'publications.edit', 'publications.publish',
            'hr.view', 'hr.evaluate', 'hr.manage',
            'scheduling.view', 'scheduling.manage',
            'contact.view', 'contact.manage', 'users.manage', 'audit.view',
            'settings.manage'
          ]
        else permissions
      end
      from public.profiles
      where id = auth.uid()
    ),
    array[]::text[]
  );
$$;

revoke execute on function public.current_admin_permissions()
from public, anon;
grant execute on function public.current_admin_permissions()
to authenticated;
revoke execute on function public.has_admin_permission(text)
from public, anon;
grant execute on function public.has_admin_permission(text)
to authenticated;
revoke execute on function public.can_manage_hr()
from public, anon;
grant execute on function public.can_manage_hr()
to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_authorized_hr_evaluator(requested_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = requested_id
      and p.active
      and not exists (
        select 1 from public.candidate_accounts ca where ca.id = p.id
      )
      and (
        p.role::text = 'super_admin'
        or p.access_profile = 'super_admin'
        or 'hr.evaluate' = any(p.permissions)
        or 'hr.manage' = any(p.permissions)
      )
  );
$$;

revoke execute on function private.is_authorized_hr_evaluator(uuid)
from public, anon;
grant execute on function private.is_authorized_hr_evaluator(uuid)
to authenticated;

create or replace function public.can_evaluate_hr()
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select public.has_admin_permission('hr.evaluate')
    and private.is_authorized_hr_evaluator(auth.uid());
$$;

revoke execute on function public.can_evaluate_hr() from public, anon;
grant execute on function public.can_evaluate_hr() to authenticated;

create or replace function public.is_assigned_application_evaluator(
  requested_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select public.can_evaluate_hr() and exists (
    select 1
    from public.career_application_evaluators assignment
    where assignment.application_id = requested_application_id
      and assignment.evaluator_id = auth.uid()
  );
$$;

revoke execute on function public.is_assigned_application_evaluator(uuid)
from public, anon;
grant execute on function public.is_assigned_application_evaluator(uuid)
to authenticated;

create or replace function public.enforce_operational_hr_evaluator()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  requested_id uuid;
begin
  requested_id := coalesce(
    nullif(to_jsonb(new) ->> 'evaluator_id', '')::uuid,
    nullif(to_jsonb(new) ->> 'responsible_id', '')::uuid
  );
  if not private.is_authorized_hr_evaluator(requested_id) then
    raise exception using errcode = '23514', message = 'operational_evaluator_required';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_operational_hr_evaluator()
from public, anon, authenticated;

drop trigger if exists career_application_evaluators_require_operator
on public.career_application_evaluators;
create trigger career_application_evaluators_require_operator
before insert or update of evaluator_id on public.career_application_evaluators
for each row execute function public.enforce_operational_hr_evaluator();

drop trigger if exists career_candidate_evaluations_require_operator
on public.career_candidate_evaluations;
create trigger career_candidate_evaluations_require_operator
before insert or update of evaluator_id on public.career_candidate_evaluations
for each row execute function public.enforce_operational_hr_evaluator();

drop trigger if exists career_candidate_interviews_require_operator
on public.career_candidate_interviews;
create trigger career_candidate_interviews_require_operator
before insert or update of responsible_id on public.career_candidate_interviews
for each row execute function public.enforce_operational_hr_evaluator();

drop policy if exists "evaluator reads own assignments"
on public.career_application_evaluators;
create policy "evaluator reads own assignments"
on public.career_application_evaluators for select to authenticated
using (
  evaluator_id = auth.uid()
  and public.can_evaluate_hr()
);

drop policy if exists "authorized evaluator creates own evaluation"
on public.career_candidate_evaluations;
create policy "authorized evaluator creates own evaluation"
on public.career_candidate_evaluations for insert to authenticated
with check (
  evaluator_id = auth.uid()
  and public.can_evaluate_hr()
  and (
    public.can_manage_hr()
    or public.is_assigned_application_evaluator(application_id)
  )
);

drop policy if exists "hr participants read evaluator profiles"
on public.profiles;
create policy "hr participants read evaluator profiles"
on public.profiles for select to authenticated
using (
  public.has_admin_permission('hr.view')
  and private.is_authorized_hr_evaluator(profiles.id)
);

-- Gestão do perfil atual por hr.manage; candidaturas históricas não são tocadas.
drop policy if exists "hr managers update candidate accounts"
on public.candidate_accounts;
create policy "hr managers update candidate accounts"
on public.candidate_accounts for update to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "hr managers manage candidate profiles"
on public.candidate_profiles;
create policy "hr managers manage candidate profiles"
on public.candidate_profiles for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "hr managers manage candidate experiences"
on public.candidate_experiences;
create policy "hr managers manage candidate experiences"
on public.candidate_experiences for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "hr managers manage candidate education"
on public.candidate_education;
create policy "hr managers manage candidate education"
on public.candidate_education for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "hr managers manage candidate certifications"
on public.candidate_certifications;
create policy "hr managers manage candidate certifications"
on public.candidate_certifications for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "hr managers manage candidate skills"
on public.candidate_skills;
create policy "hr managers manage candidate skills"
on public.candidate_skills for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "hr managers manage candidate resume metadata"
on public.candidate_resumes;
create policy "hr managers manage candidate resume metadata"
on public.candidate_resumes for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "hr managers manage resume extractions"
on public.candidate_resume_extractions;
create policy "hr managers manage resume extractions"
on public.candidate_resume_extractions for all to authenticated
using (public.can_manage_hr())
with check (public.can_manage_hr());

drop policy if exists "assigned evaluator reads candidate resume metadata"
on public.candidate_resumes;
create policy "assigned evaluator reads candidate resume metadata"
on public.candidate_resumes for select to authenticated
using (
  public.can_evaluate_hr()
  and exists (
    select 1
    from public.career_application_evaluators assignment
    join public.career_job_applications application
      on application.id = assignment.application_id
    where assignment.evaluator_id = auth.uid()
      and application.candidate_id = candidate_resumes.candidate_id
  )
);

drop policy if exists "hr managers upload candidate resumes"
on storage.objects;
create policy "hr managers upload candidate resumes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'candidate-resumes'
  and public.can_manage_hr()
);

drop policy if exists "hr managers delete candidate resumes"
on storage.objects;
create policy "hr managers delete candidate resumes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'candidate-resumes'
  and public.can_manage_hr()
);

drop policy if exists "assigned evaluator reads candidate resume files"
on storage.objects;
create policy "assigned evaluator reads candidate resume files"
on storage.objects for select to authenticated
using (
  bucket_id = 'candidate-resumes'
  and public.can_evaluate_hr()
  and exists (
    select 1
    from public.career_application_evaluators assignment
    join public.career_job_applications application
      on application.id = assignment.application_id
    where assignment.evaluator_id = auth.uid()
      and application.candidate_id::text = split_part(storage.objects.name, '/', 1)
  )
);

create or replace function public.admin_replace_candidate_resume(
  p_candidate_id uuid,
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
set search_path = public, private
as $$
declare
  current_resume public.candidate_resumes%rowtype;
begin
  if not public.can_manage_hr()
    or not private.is_authorized_hr_evaluator(auth.uid()) then
    raise exception using errcode = '42501', message = 'hr_manage_required';
  end if;
  if not exists (
    select 1 from public.candidate_accounts where id = p_candidate_id
  ) then
    raise exception using errcode = '23503', message = 'candidate_account_required';
  end if;
  if p_original_name is null
    or char_length(trim(p_original_name)) not between 1 and 255
    or p_storage_path is null
    or p_storage_path not like p_candidate_id::text || '/%'
    or p_size_bytes not between 1 and 10485760
    or p_extraction_status not in ('ready', 'partial', 'failed')
    or jsonb_typeof(p_extracted_data) <> 'object'
    or jsonb_typeof(p_warnings) <> 'array'
    or char_length(coalesce(p_parser_version, '')) not between 1 and 40
    or (p_text_sha256 is not null and p_text_sha256 !~ '^[a-f0-9]{64}$')
    or (p_total_pages is not null and p_total_pages < 1) then
    raise exception using errcode = '22023', message = 'invalid_candidate_resume';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_candidate_id::text, 0));
  select * into current_resume
  from public.candidate_resumes
  where candidate_id = p_candidate_id
  for update;

  if current_resume.id is null then
    insert into public.candidate_resumes (
      candidate_id, original_name, storage_path, size_bytes, mime_type, version
    ) values (
      p_candidate_id, trim(p_original_name), p_storage_path,
      p_size_bytes, 'application/pdf', 1
    ) returning id, version into resume_id, resume_version;
    old_storage_path := null;
  else
    resume_id := current_resume.id;
    old_storage_path := current_resume.storage_path;
    resume_version := current_resume.version + 1;
    delete from public.candidate_resume_extractions extraction
    where extraction.resume_id = current_resume.id
      and extraction.candidate_id = p_candidate_id;
    update public.candidate_resumes
    set original_name = trim(p_original_name),
        storage_path = p_storage_path,
        size_bytes = p_size_bytes,
        mime_type = 'application/pdf',
        version = resume_version,
        created_at = now()
    where id = current_resume.id and candidate_id = p_candidate_id;
  end if;

  insert into public.candidate_resume_extractions (
    candidate_id, resume_id, status, extracted_data, warnings,
    parser_version, text_sha256, total_pages
  ) values (
    p_candidate_id, resume_id, p_extraction_status, p_extracted_data,
    p_warnings, p_parser_version, p_text_sha256, p_total_pages
  ) returning id into review_id;
  return next;
end;
$$;

revoke execute on function public.admin_replace_candidate_resume(
  uuid, text, text, bigint, text, jsonb, jsonb, text, text, integer
) from public, anon;
grant execute on function public.admin_replace_candidate_resume(
  uuid, text, text, bigint, text, jsonb, jsonb, text, text, integer
) to authenticated;

create or replace function public.admin_delete_candidate_resume(
  p_candidate_id uuid,
  p_resume_id uuid
)
returns table (resume_id uuid, storage_path text)
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if not public.can_manage_hr()
    or not private.is_authorized_hr_evaluator(auth.uid()) then
    raise exception using errcode = '42501', message = 'hr_manage_required';
  end if;
  delete from public.candidate_resumes resume
  where resume.id = p_resume_id
    and resume.candidate_id = p_candidate_id
  returning resume.id, resume.storage_path
  into resume_id, storage_path;
  if resume_id is null then
    raise exception using errcode = 'P0002', message = 'candidate_resume_not_found';
  end if;
  return next;
end;
$$;

revoke execute on function public.admin_delete_candidate_resume(uuid, uuid)
from public, anon;
grant execute on function public.admin_delete_candidate_resume(uuid, uuid)
to authenticated;

grant select, insert, update, delete on
  public.candidate_profiles,
  public.candidate_experiences,
  public.candidate_education,
  public.candidate_certifications,
  public.candidate_skills,
  public.candidate_resumes,
  public.candidate_resume_extractions
to authenticated;

comment on function public.can_evaluate_hr() is
  'Permissão de avaliação do RH para operador ativo, nunca candidato.';
comment on function public.admin_replace_candidate_resume(
  uuid, text, text, bigint, text, jsonb, jsonb, text, text, integer
) is 'Substitui atomicamente o currículo atual sem alterar snapshots históricos.';

commit;
