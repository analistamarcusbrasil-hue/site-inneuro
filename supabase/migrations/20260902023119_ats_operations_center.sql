begin;

create or replace function public.normalize_career_search_text(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(regexp_replace(
    translate(lower(value),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

create or replace function public.career_application_search_text(snapshot jsonb)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select public.normalize_career_search_text(concat_ws(' ',
    snapshot #>> '{candidate,full_name}',
    snapshot #>> '{candidate,email}',
    snapshot #>> '{profile,professional_objective}',
    snapshot #>> '{profile,about}',
    snapshot #>> '{profile,city}',
    snapshot #>> '{profile,state}',
    snapshot #>> '{profile,availability}',
    snapshot -> 'skills',
    snapshot -> 'experiences',
    snapshot -> 'education',
    snapshot -> 'certifications'
  ));
$$;

alter table public.career_job_applications
  add column if not exists is_referred boolean not null default false,
  add column if not exists referred_by text,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists availability_shifts text[] not null default '{}'::text[],
  add column if not exists available_from date,
  add column if not exists hiring_checklist jsonb not null default '{}'::jsonb,
  add column if not exists search_text text generated always as
    (public.career_application_search_text(profile_snapshot)) stored;

alter table public.career_job_applications
  drop constraint if exists career_job_applications_referral_check,
  add constraint career_job_applications_referral_check check (
    (is_referred and referred_by is not null and char_length(trim(referred_by)) between 2 and 160)
    or (not is_referred and referred_by is null)
  ),
  drop constraint if exists career_job_applications_tags_check,
  add constraint career_job_applications_tags_check check (
    cardinality(tags) <= 20
    and array_to_string(tags, '') !~ '[[:cntrl:]]'
    and char_length(array_to_string(tags, '')) <= 800
  ) not valid,
  drop constraint if exists career_job_applications_shifts_check,
  add constraint career_job_applications_shifts_check check (
    availability_shifts <@ array['morning', 'afternoon', 'night', 'flexible']::text[]
  ),
  drop constraint if exists career_job_applications_hiring_checklist_check,
  add constraint career_job_applications_hiring_checklist_check check (
    jsonb_typeof(hiring_checklist) = 'object'
  );

alter table public.career_job_applications
  validate constraint career_job_applications_tags_check;

create or replace function public.validate_career_job_match_matrix()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  criterion_count integer;
  distinct_count integer;
  scoring_weight integer;
begin
  if jsonb_typeof(new.criteria) <> 'array'
    or jsonb_array_length(new.criteria) not between 1 and 17 then
    raise exception using errcode = '22023', message = 'matching_criteria_must_be_array';
  end if;

  select
    count(*),
    count(distinct item ->> 'key'),
    coalesce(sum(
      case
        when coalesce((item ->> 'active')::boolean, true)
          and coalesce(item ->> 'kind', 'scoring') = 'scoring'
          then (item ->> 'weight')::integer
        else 0
      end
    ), 0)
  into criterion_count, distinct_count, scoring_weight
  from jsonb_array_elements(new.criteria) item
  where item ->> 'key' in (
    'related_experience', 'technical_skills', 'education',
    'specific_course', 'specialty', 'sector_experience',
    'healthcare_experience', 'similar_role_experience',
    'customer_service_experience', 'certifications',
    'professional_registration', 'availability', 'shift_availability',
    'operational_compatibility', 'languages', 'leadership', 'computer_skills'
  )
    and jsonb_typeof(item -> 'label') = 'string'
    and char_length(trim(item ->> 'label')) between 3 and 120
    and jsonb_typeof(item -> 'weight') = 'number'
    and (item ->> 'weight') ~ '^\d+$'
    and (item ->> 'weight')::integer between 0 and 100
    and (not (item ? 'active') or jsonb_typeof(item -> 'active') = 'boolean')
    and coalesce(item ->> 'kind', 'scoring') in ('scoring', 'minimum')
    and coalesce(item ->> 'priority', 'important') in ('required', 'important', 'differential');

  if criterion_count <> jsonb_array_length(new.criteria)
    or distinct_count <> criterion_count
    or scoring_weight <> 100
    or exists (
      select 1
      from jsonb_array_elements(new.criteria) item
      where (
        not coalesce((item ->> 'active')::boolean, true)
        or coalesce(item ->> 'kind', 'scoring') = 'minimum'
      ) and (item ->> 'weight')::integer <> 0
    ) then
    raise exception using errcode = '22023', message = 'invalid_matching_matrix';
  end if;

  return new;
end;
$$;

create or replace function public.submit_career_job_application_with_logistics(
  p_job_id uuid,
  p_commute_feasibility text default null,
  p_commute_time text default null,
  p_transport_modes text[] default '{}'::text[],
  p_transit_benefit text default null,
  p_source text default 'site_inneuro',
  p_recruitment_consent boolean default false,
  p_automated_support_consent boolean default false,
  p_availability_shifts text[] default '{}'::text[],
  p_available_from date default null,
  p_is_referred boolean default false,
  p_referred_by text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_id uuid;
  normalized_referred_by text := nullif(trim(coalesce(p_referred_by, '')), '');
begin
  if not (coalesce(p_availability_shifts, '{}'::text[]) <@ array[
    'morning', 'afternoon', 'night', 'flexible'
  ]::text[]) or cardinality(coalesce(p_availability_shifts, '{}'::text[])) = 0 then
    raise exception using errcode = '22023', message = 'availability_shift_required';
  end if;
  if p_available_from is null then
    raise exception using errcode = '22023', message = 'available_from_required';
  end if;
  if p_is_referred and (
    normalized_referred_by is null
    or char_length(normalized_referred_by) not between 2 and 160
  ) then
    raise exception using errcode = '22023', message = 'referred_by_required';
  end if;

  application_id := public.submit_career_job_application_with_logistics(
    p_job_id,
    p_commute_feasibility,
    p_commute_time,
    p_transport_modes,
    p_transit_benefit,
    p_source,
    p_recruitment_consent,
    p_automated_support_consent
  );

  update public.career_job_applications
  set
    availability_shifts = p_availability_shifts,
    available_from = p_available_from,
    is_referred = p_is_referred,
    referred_by = case when p_is_referred then normalized_referred_by else null end
  where id = application_id and candidate_id = auth.uid();

  return application_id;
end;
$$;

create index if not exists career_job_applications_stage_page_idx
on public.career_job_applications (job_id, candidate_stage, submitted_at desc);

create index if not exists career_job_applications_status_page_idx
on public.career_job_applications (job_id, status, submitted_at desc);

create index if not exists career_job_applications_tags_idx
on public.career_job_applications using gin (tags);

create index if not exists career_job_applications_search_idx
on public.career_job_applications
using gin (to_tsvector('simple', search_text));

create or replace function public.career_snapshot_experience_months(snapshot jsonb)
returns integer
language sql
stable
strict
set search_path = ''
as $$
  select coalesce(sum(
    case
      when experience ->> 'start_date' ~ '^\d{4}-\d{2}-\d{2}$' then
        greatest(0, (
          extract(year from age(
            case
              when experience ->> 'end_date' ~ '^\d{4}-\d{2}-\d{2}$'
                then (experience ->> 'end_date')::date
              else current_date
            end,
            (experience ->> 'start_date')::date
          )) * 12
          + extract(month from age(
            case
              when experience ->> 'end_date' ~ '^\d{4}-\d{2}-\d{2}$'
                then (experience ->> 'end_date')::date
              else current_date
            end,
            (experience ->> 'start_date')::date
          ))
        )::integer)
      else 0
    end
  ), 0)::integer
  from jsonb_array_elements(coalesce(snapshot -> 'experiences', '[]'::jsonb)) experience;
$$;

create or replace function public.search_career_job_applications(
  p_job_id uuid,
  p_search text default null,
  p_stage text default null,
  p_status text default null,
  p_education text default null,
  p_customer_service text default null,
  p_similar_role text default null,
  p_health_experience text default null,
  p_shift text default null,
  p_referral text default null,
  p_tag text default null,
  p_score_min integer default null,
  p_score_max integer default null,
  p_experience_min_months integer default null,
  p_submitted_from date default null,
  p_submitted_to date default null,
  p_sort text default 'best_match',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  application_id uuid,
  candidate_id uuid,
  status text,
  candidate_stage text,
  profile_snapshot jsonb,
  submitted_at timestamptz,
  source text,
  is_referred boolean,
  referred_by text,
  is_favorite boolean,
  tags text[],
  availability_shifts text[],
  available_from date,
  hiring_checklist jsonb,
  experience_months integer,
  match_score integer,
  match_result jsonb,
  resume_id uuid,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := nullif(public.normalize_career_search_text(coalesce(p_search, '')), '');
  normalized_tag text := nullif(trim(coalesce(p_tag, '')), '');
  safe_limit integer := case when p_limit in (25, 50, 100) then p_limit else 25 end;
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.can_manage_hr() then
    raise exception using errcode = '42501', message = 'hr_authorization_required';
  end if;
  if p_stage is not null and p_stage not in ('resume', 'interview', 'practical_test', 'hiring', 'hired', 'not_approved') then
    raise exception using errcode = '22023', message = 'invalid_candidate_stage';
  end if;
  if p_status is not null and p_status not in ('submitted', 'screening', 'in_process', 'finalized', 'withdrawn') then
    raise exception using errcode = '22023', message = 'invalid_application_status';
  end if;
  if p_sort not in ('best_match', 'newest', 'oldest', 'name') then
    raise exception using errcode = '22023', message = 'invalid_sort';
  end if;

  return query
  with candidates as (
    select
      application.*,
      public.career_snapshot_experience_months(application.profile_snapshot) as calculated_experience_months,
      latest_match.overall_score as latest_match_score,
      latest_match.result as latest_match_result,
      latest_resume.id as latest_resume_id,
      public.normalize_career_search_text(job.title) as normalized_job_title
    from public.career_job_applications application
    join public.career_jobs job on job.id = application.job_id
    left join lateral (
      select run.overall_score, run.result
      from public.career_application_match_runs run
      where run.application_id = application.id
      order by run.calculated_at desc, run.id desc
      limit 1
    ) latest_match on true
    left join lateral (
      select resume.id
      from public.candidate_resumes resume
      where resume.candidate_id = application.candidate_id
      order by resume.version desc, resume.created_at desc
      limit 1
    ) latest_resume on true
    where application.job_id = p_job_id
      and (normalized_search is null
        or to_tsvector('simple', application.search_text) @@ plainto_tsquery('simple', normalized_search)
        or application.search_text like '%' || normalized_search || '%')
      and (p_stage is null or application.candidate_stage = p_stage)
      and (p_status is null or application.status = p_status)
      and (p_education is null
        or (p_education = 'informed' and jsonb_array_length(coalesce(application.profile_snapshot -> 'education', '[]'::jsonb)) > 0)
        or (p_education = 'not_identified' and jsonb_array_length(coalesce(application.profile_snapshot -> 'education', '[]'::jsonb)) = 0))
      and (p_customer_service is null
        or (p_customer_service = 'yes' and application.search_text ~ '\m(atendimento|atendente|recepcao|cliente|publico)\M')
        or (p_customer_service = 'not_identified' and application.search_text !~ '\m(atendimento|atendente|recepcao|cliente|publico)\M'))
      and (p_health_experience is null
        or (p_health_experience = 'yes' and application.search_text ~ '\m(clinica|saude|hospital|consultorio|laboratorio)\M')
        or (p_health_experience = 'not_identified' and application.search_text !~ '\m(clinica|saude|hospital|consultorio|laboratorio)\M'))
      and (p_similar_role is null
        or (p_similar_role = 'yes' and application.search_text like '%' || split_part(public.normalize_career_search_text(job.title), ' ', 1) || '%')
        or (p_similar_role = 'not_identified' and application.search_text not like '%' || split_part(public.normalize_career_search_text(job.title), ' ', 1) || '%'))
      and (p_shift is null or p_shift = any(application.availability_shifts))
      and (p_referral is null
        or (p_referral = 'referred' and application.is_referred)
        or (p_referral = 'not_referred' and not application.is_referred))
      and (normalized_tag is null or normalized_tag = any(application.tags))
      and (p_score_min is null or latest_match.overall_score >= p_score_min)
      and (p_score_max is null or latest_match.overall_score <= p_score_max)
      and (p_experience_min_months is null or public.career_snapshot_experience_months(application.profile_snapshot) >= p_experience_min_months)
      and (p_submitted_from is null or application.submitted_at >= p_submitted_from::timestamptz)
      and (p_submitted_to is null or application.submitted_at < (p_submitted_to + 1)::timestamptz)
  )
  select
    candidate.id,
    candidate.candidate_id,
    candidate.status,
    candidate.candidate_stage,
    candidate.profile_snapshot,
    candidate.submitted_at,
    candidate.source,
    candidate.is_referred,
    candidate.referred_by,
    candidate.is_favorite,
    candidate.tags,
    candidate.availability_shifts,
    candidate.available_from,
    candidate.hiring_checklist,
    candidate.calculated_experience_months,
    candidate.latest_match_score,
    candidate.latest_match_result,
    candidate.latest_resume_id,
    count(*) over()
  from candidates candidate
  order by
    case when p_sort = 'best_match' then candidate.latest_match_score end desc nulls last,
    case when p_sort = 'newest' then candidate.submitted_at end desc,
    case when p_sort = 'oldest' then candidate.submitted_at end asc,
    case when p_sort = 'name' then public.normalize_career_search_text(candidate.profile_snapshot #>> '{candidate,full_name}') end asc,
    candidate.submitted_at desc,
    candidate.id
  limit safe_limit offset safe_offset;
end;
$$;

create or replace function public.career_job_pipeline_summary(p_job_id uuid)
returns table (candidate_stage text, candidate_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_manage_hr() then
    raise exception using errcode = '42501', message = 'hr_authorization_required';
  end if;
  return query
  select application.candidate_stage, count(*)
  from public.career_job_applications application
  where application.job_id = p_job_id
    and application.status <> 'withdrawn'
  group by application.candidate_stage;
end;
$$;

create or replace function public.bulk_decide_career_applications(
  p_job_id uuid,
  p_application_ids uuid[],
  p_decision text,
  p_expected_stage text,
  p_internal_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_id uuid;
  unique_ids uuid[];
  next_stage text;
  moved_count integer := 0;
begin
  if auth.uid() is null or not public.can_manage_hr() then
    raise exception using errcode = '42501', message = 'hr_authorization_required';
  end if;
  select array_agg(distinct id) into unique_ids from unnest(coalesce(p_application_ids, '{}'::uuid[])) id;
  if coalesce(cardinality(unique_ids), 0) = 0 or cardinality(unique_ids) > 100 then
    raise exception using errcode = '22023', message = 'invalid_bulk_selection';
  end if;
  if exists (
    select 1 from unnest(unique_ids) selected_id
    left join public.career_job_applications application on application.id = selected_id
    where application.id is null or application.job_id <> p_job_id
  ) then
    raise exception using errcode = '22023', message = 'bulk_selection_job_mismatch';
  end if;

  foreach application_id in array unique_ids loop
    next_stage := public.decide_career_application_stage(
      application_id,
      p_decision,
      p_expected_stage,
      p_internal_note
    );
    moved_count := moved_count + 1;
  end loop;

  return jsonb_build_object(
    'movedCount', moved_count,
    'nextStage', next_stage,
    'atomic', true
  );
end;
$$;

create or replace function public.update_career_applications_metadata(
  p_job_id uuid,
  p_application_ids uuid[],
  p_operation text,
  p_value text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  unique_ids uuid[];
  affected integer;
  normalized_value text := nullif(trim(coalesce(p_value, '')), '');
begin
  if auth.uid() is null or not public.can_manage_hr() then
    raise exception using errcode = '42501', message = 'hr_authorization_required';
  end if;
  select array_agg(distinct id) into unique_ids from unnest(coalesce(p_application_ids, '{}'::uuid[])) id;
  if coalesce(cardinality(unique_ids), 0) = 0 or cardinality(unique_ids) > 100 then
    raise exception using errcode = '22023', message = 'invalid_bulk_selection';
  end if;
  if p_operation not in ('add_tag', 'remove_tag', 'favorite', 'unfavorite') then
    raise exception using errcode = '22023', message = 'invalid_metadata_operation';
  end if;
  if p_operation in ('add_tag', 'remove_tag') and (normalized_value is null or char_length(normalized_value) > 40) then
    raise exception using errcode = '22023', message = 'invalid_tag';
  end if;
  if exists (
    select 1 from unnest(unique_ids) selected_id
    left join public.career_job_applications application on application.id = selected_id
    where application.id is null or application.job_id <> p_job_id
  ) then
    raise exception using errcode = '22023', message = 'bulk_selection_job_mismatch';
  end if;

  update public.career_job_applications application
  set
    tags = case
      when p_operation = 'add_tag' and not normalized_value = any(application.tags)
        then array_append(application.tags, normalized_value)
      when p_operation = 'remove_tag'
        then array_remove(application.tags, normalized_value)
      else application.tags
    end,
    is_favorite = case
      when p_operation = 'favorite' then true
      when p_operation = 'unfavorite' then false
      else application.is_favorite
    end
  where application.id = any(unique_ids)
    and application.job_id = p_job_id;
  get diagnostics affected = row_count;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  select
    auth.uid(),
    'CAREER_APPLICATION_METADATA_BULK_UPDATED',
    'career_job_application',
    selected_id,
    '{}'::jsonb,
    jsonb_build_object('job_id', p_job_id, 'operation', p_operation, 'value', normalized_value)
  from unnest(unique_ids) selected_id;

  return affected;
end;
$$;

revoke all on function public.normalize_career_search_text(text) from public, anon, authenticated;
revoke all on function public.career_application_search_text(jsonb) from public, anon, authenticated;
revoke all on function public.career_snapshot_experience_months(jsonb) from public, anon, authenticated;
revoke all on function public.search_career_job_applications(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer, integer, date, date, text, integer, integer) from public, anon;
revoke all on function public.career_job_pipeline_summary(uuid) from public, anon;
revoke all on function public.bulk_decide_career_applications(uuid, uuid[], text, text, text) from public, anon;
revoke all on function public.update_career_applications_metadata(uuid, uuid[], text, text) from public, anon;
revoke all on function public.submit_career_job_application_with_logistics(uuid, text, text, text[], text, text, boolean, boolean, text[], date, boolean, text) from public, anon;

grant execute on function public.search_career_job_applications(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer, integer, date, date, text, integer, integer) to authenticated;
grant execute on function public.career_job_pipeline_summary(uuid) to authenticated;
grant execute on function public.bulk_decide_career_applications(uuid, uuid[], text, text, text) to authenticated;
grant execute on function public.update_career_applications_metadata(uuid, uuid[], text, text) to authenticated;
grant execute on function public.submit_career_job_application_with_logistics(uuid, text, text, text[], text, text, boolean, boolean, text[], date, boolean, text) to authenticated;

commit;
