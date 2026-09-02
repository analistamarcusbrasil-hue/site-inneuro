begin;

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
      latest_match.information_coverage as latest_match_coverage,
      latest_match.overall_score * latest_match.information_coverage as evidence_weighted_score,
      latest_match.result as latest_match_result,
      latest_resume.id as latest_resume_id,
      public.normalize_career_search_text(job.title) as normalized_job_title
    from public.career_job_applications application
    join public.career_jobs job on job.id = application.job_id
    left join lateral (
      select
        run.overall_score,
        run.result,
        case
          when run.result ->> 'informationCoverage' ~ '^\d{1,3}$'
            then least(100, greatest(0, (run.result ->> 'informationCoverage')::integer))
          else 0
        end as information_coverage
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
    case when p_sort = 'best_match' then candidate.evidence_weighted_score end desc nulls last,
    case when p_sort = 'best_match' then candidate.latest_match_score end desc nulls last,
    case when p_sort = 'best_match' then candidate.latest_match_coverage end desc nulls last,
    case when p_sort = 'best_match' then candidate.calculated_experience_months end desc,
    case when p_sort = 'newest' then candidate.submitted_at end desc,
    case when p_sort = 'oldest' then candidate.submitted_at end asc,
    case when p_sort = 'name' then public.normalize_career_search_text(candidate.profile_snapshot #>> '{candidate,full_name}') end asc,
    candidate.submitted_at desc,
    candidate.id
  limit safe_limit offset safe_offset;
end;
$$;

revoke all on function public.search_career_job_applications(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer, integer, date, date, text, integer, integer) from public, anon;
grant execute on function public.search_career_job_applications(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer, integer, date, date, text, integer, integer) to authenticated;

commit;
