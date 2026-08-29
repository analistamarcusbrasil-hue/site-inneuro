create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_access_survey_tenant(
  p_organization_id uuid,
  p_unit_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.survey_profile_access access
      on access.profile_id = profile.id
     and access.organization_id = p_organization_id
     and (access.unit_id is null or p_unit_id is null or access.unit_id = p_unit_id)
    where profile.id = (select auth.uid())
      and profile.active
      and (
        profile.role::text = 'super_admin'
        or profile.access_profile = 'super_admin'
        or 'surveys.admin' = any(coalesce(profile.permissions, '{}'::text[]))
        or p_permission = any(coalesce(profile.permissions, '{}'::text[]))
      )
  );
$$;
revoke all on function private.can_access_survey_tenant(uuid, uuid, text)
from public, anon;
grant execute on function private.can_access_survey_tenant(uuid, uuid, text)
to authenticated;

create or replace function private.validate_survey_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  unit_org uuid;
  campaign_record record;
  qr_record record;
  row_data jsonb := to_jsonb(new);
begin
  if new.unit_id is not null then
    select organization_id into unit_org from public.survey_units where id = new.unit_id;
    if unit_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'survey_unit_organization_mismatch';
    end if;
  end if;
  if tg_table_name in ('survey_qr_codes', 'survey_responses')
    and row_data->>'campaign_id' is not null then
    select organization_id, unit_id into campaign_record
    from public.survey_campaigns where id = (row_data->>'campaign_id')::uuid;
    if campaign_record.organization_id is distinct from new.organization_id
      or (campaign_record.unit_id is not null and campaign_record.unit_id is distinct from new.unit_id) then
      raise exception using errcode = '23514', message = 'survey_campaign_scope_mismatch';
    end if;
  end if;
  if tg_table_name = 'survey_responses' then
    select organization_id, unit_id, campaign_id into qr_record
    from public.survey_qr_codes where id = (row_data->>'qr_code_id')::uuid;
    if qr_record.organization_id is distinct from new.organization_id
      or qr_record.unit_id is distinct from new.unit_id
      or qr_record.campaign_id is distinct from (row_data->>'campaign_id')::uuid then
      raise exception using errcode = '23514', message = 'survey_qr_scope_mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger survey_campaigns_validate_scope
before insert or update of organization_id, unit_id on public.survey_campaigns
for each row execute function private.validate_survey_scope();
create trigger survey_qr_codes_validate_scope
before insert or update of organization_id, unit_id, campaign_id on public.survey_qr_codes
for each row execute function private.validate_survey_scope();
create trigger survey_responses_validate_scope
before insert or update of organization_id, unit_id, campaign_id, qr_code_id on public.survey_responses
for each row execute function private.validate_survey_scope();
create trigger survey_snapshots_validate_scope
before insert or update of organization_id, unit_id on public.survey_monthly_snapshots
for each row execute function private.validate_survey_scope();

create or replace function private.protect_survey_question_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception using errcode = '55000', message = 'survey_question_versions_are_immutable';
end;
$$;
create trigger survey_question_versions_immutable
before update or delete on public.survey_question_versions
for each row execute function private.protect_survey_question_version();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'survey_organizations', 'survey_units', 'survey_profile_access',
    'survey_campaigns', 'survey_questions', 'survey_question_versions',
    'survey_question_options', 'survey_question_rules', 'survey_qr_codes',
    'survey_responses', 'survey_answers', 'survey_feedback', 'survey_events',
    'survey_monthly_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "survey users read organizations" on public.survey_organizations
for select to authenticated using (
  private.can_access_survey_tenant(id, null, 'surveys.view')
  or private.can_access_survey_tenant(id, null, 'surveys.qrcode')
);
create policy "survey users read units" on public.survey_units
for select to authenticated using (
  private.can_access_survey_tenant(organization_id, id, 'surveys.view')
  or private.can_access_survey_tenant(organization_id, id, 'surveys.qrcode')
);
create policy "survey admins manage tenant access" on public.survey_profile_access
for all to authenticated
using (private.can_access_survey_tenant(organization_id, unit_id, 'surveys.admin'))
with check (private.can_access_survey_tenant(organization_id, unit_id, 'surveys.admin'));
create policy "survey users read campaigns" on public.survey_campaigns
for select to authenticated using (
  private.can_access_survey_tenant(organization_id, unit_id, 'surveys.view')
  or private.can_access_survey_tenant(organization_id, unit_id, 'surveys.qrcode')
);
create policy "survey managers manage campaigns" on public.survey_campaigns
for all to authenticated
using (private.can_access_survey_tenant(organization_id, unit_id, 'surveys.manage'))
with check (private.can_access_survey_tenant(organization_id, unit_id, 'surveys.manage'));
create policy "survey users read questions" on public.survey_questions
for select to authenticated using (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.view')
));
create policy "survey managers manage questions" on public.survey_questions
for all to authenticated
using (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.manage')
))
with check (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.manage')
));
create policy "survey users read question versions" on public.survey_question_versions
for select to authenticated using (exists (
  select 1 from public.survey_questions question
  join public.survey_campaigns campaign on campaign.id = question.campaign_id
  where question.id = question_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.view')
));
create policy "survey users read options" on public.survey_question_options
for select to authenticated using (exists (
  select 1 from public.survey_questions question
  join public.survey_campaigns campaign on campaign.id = question.campaign_id
  where question.id = question_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.view')
));
create policy "survey users read rules" on public.survey_question_rules
for select to authenticated using (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.view')
));
create policy "survey users read qr codes" on public.survey_qr_codes
for select to authenticated using (
  private.can_access_survey_tenant(organization_id, unit_id, 'surveys.qrcode')
  or private.can_access_survey_tenant(organization_id, unit_id, 'surveys.view')
);
create policy "survey users read responses" on public.survey_responses
for select to authenticated using (
  private.can_access_survey_tenant(organization_id, unit_id, 'surveys.view')
);
create policy "survey users read answers" on public.survey_answers
for select to authenticated using (exists (
  select 1 from public.survey_responses response where response.id = response_id
  and private.can_access_survey_tenant(response.organization_id, response.unit_id, 'surveys.view')
));
create policy "survey users read feedback" on public.survey_feedback
for select to authenticated using (exists (
  select 1 from public.survey_responses response where response.id = response_id
  and private.can_access_survey_tenant(response.organization_id, response.unit_id, 'surveys.view')
));
create policy "survey users read events" on public.survey_events
for select to authenticated using (
  private.can_access_survey_tenant(organization_id, unit_id, 'surveys.view')
);
create policy "survey reporters read snapshots" on public.survey_monthly_snapshots
for select to authenticated using (
  private.can_access_survey_tenant(organization_id, unit_id, 'surveys.reports')
);

grant select on public.survey_organizations, public.survey_units,
  public.survey_campaigns, public.survey_questions, public.survey_question_versions,
  public.survey_question_options, public.survey_question_rules, public.survey_qr_codes,
  public.survey_responses, public.survey_answers, public.survey_feedback,
  public.survey_events, public.survey_monthly_snapshots to authenticated;
grant select, insert, update, delete on public.survey_profile_access to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'survey-feedback-audio', 'survey-feedback-audio', false, 8388608,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "survey users read authorized audio" on storage.objects
for select to authenticated using (
  bucket_id = 'survey-feedback-audio'
  and exists (
    select 1
    from public.survey_feedback feedback
    join public.survey_responses response on response.id = feedback.response_id
    where feedback.audio_storage_path = name
      and private.can_access_survey_tenant(response.organization_id, response.unit_id, 'surveys.view')
  )
);

create or replace function public.survey_dashboard_metrics(
  p_organization_id uuid,
  p_unit_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select response.*
    from public.survey_responses response
    where response.organization_id = p_organization_id
      and (p_unit_id is null or response.unit_id = p_unit_id)
      and response.status = 'COMPLETED'
      and response.completed_at >= p_start
      and response.completed_at < p_end
  ), answer_rows as (
    select answer.*, version.category, version.question_type
    from public.survey_answers answer
    join scoped response on response.id = answer.response_id
    join public.survey_question_versions version on version.id = answer.question_version_id
  ), dimensions as (
    select category,
      round(avg(numeric_value)::numeric, 2) as average,
      count(*)::integer as response_count,
      count(*) filter (where numeric_value <= 3)::integer as negative_count,
      count(*) filter (where numeric_value >= 4)::integer as positive_count,
      jsonb_build_object(
        '1', count(*) filter (where numeric_value = 1),
        '2', count(*) filter (where numeric_value = 2),
        '3', count(*) filter (where numeric_value = 3),
        '4', count(*) filter (where numeric_value = 4),
        '5', count(*) filter (where numeric_value = 5)
      ) as distribution
    from answer_rows
    where question_type = 'STAR_5' and not not_applicable
      and category not in ('DIAGNOSTICO', 'DESTAQUE')
    group by category
  ), nps as (
    select
      count(*)::integer as total,
      count(*) filter (where nps_score between 9 and 10)::integer as promoters,
      count(*) filter (where nps_score between 7 and 8)::integer as passives,
      count(*) filter (where nps_score between 0 and 6)::integer as detractors
    from scoped where nps_score is not null
  ), events as (
    select
      count(*) filter (where event_type = 'OPENED')::integer as openings,
      count(*) filter (where event_type = 'STARTED')::integer as starts,
      count(*) filter (where event_type = 'COMPLETED')::integer as completions
    from public.survey_events event
    where event.organization_id = p_organization_id
      and (p_unit_id is null or event.unit_id = p_unit_id)
      and event.created_at >= p_start and event.created_at < p_end
  ), problems as (
    select coalesce(option_row.label, option_item.value) as label, count(*)::integer as total
    from answer_rows answer
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(answer.option_value) = 'array' then answer.option_value
        when answer.option_value is null then '[]'::jsonb
        else jsonb_build_array(answer.option_value)
      end
    ) option_item(value)
    left join public.survey_question_options option_row
      on option_row.version_id = answer.question_version_id
     and option_row.value = option_item.value
    where answer.category = 'DIAGNOSTICO'
    group by coalesce(option_row.label, option_item.value)
    order by total desc, label
    limit 10
  ), praise as (
    select coalesce(option_row.label, option_item.value) as label, count(*)::integer as total
    from answer_rows answer
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(answer.option_value) = 'array' then answer.option_value
        when answer.option_value is null then '[]'::jsonb
        else jsonb_build_array(answer.option_value)
      end
    ) option_item(value)
    left join public.survey_question_options option_row
      on option_row.version_id = answer.question_version_id
     and option_row.value = option_item.value
    where answer.category = 'DESTAQUE'
    group by coalesce(option_row.label, option_item.value)
    order by total desc, label
    limit 10
  )
  select jsonb_build_object(
    'responseCount', (select count(*) from scoped),
    'overallScore', (select round(avg(overall_score)::numeric, 2) from scoped),
    'criticalCount', (select count(*) from scoped where critical),
    'positiveRate', (
      select case when count(*) = 0 then null
        else round(100.0 * count(*) filter (where numeric_value >= 4) / count(*), 1) end
      from answer_rows where question_type = 'STAR_5' and not not_applicable
    ),
    'nps', (select case when total = 0 then null else round(100.0 * (promoters - detractors) / total) end from nps),
    'npsBreakdown', (select to_jsonb(nps) from nps),
    'completion', (select jsonb_build_object(
      'openings', openings, 'starts', starts, 'completions', completions,
      'rate', case when starts = 0 then null else round(100.0 * completions / starts, 1) end
    ) from events),
    'dimensions', coalesce((select jsonb_agg(to_jsonb(dimensions) order by category) from dimensions), '[]'::jsonb),
    'problems', coalesce((select jsonb_agg(to_jsonb(problems)) from problems), '[]'::jsonb),
    'praise', coalesce((select jsonb_agg(to_jsonb(praise)) from praise), '[]'::jsonb)
  );
$$;
revoke all on function public.survey_dashboard_metrics(uuid, uuid, timestamptz, timestamptz)
from public, anon;
grant execute on function public.survey_dashboard_metrics(uuid, uuid, timestamptz, timestamptz)
to authenticated, service_role;

create or replace function public.complete_survey_response(
  p_response_id uuid,
  p_access_token_hash text,
  p_answers jsonb,
  p_feedback jsonb,
  p_contact jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  response_record record;
  overall numeric(4,2);
  nps smallint;
  low_dimensions integer;
  is_critical boolean;
  feedback_mode text := coalesce(p_feedback->>'mode', 'NONE');
  audio_path text := nullif(p_feedback->>'audioStoragePath', '');
  inserted_answers integer := 0;
begin
  select * into response_record from public.survey_responses
  where id = p_response_id and access_token_hash = p_access_token_hash
  for update;
  if response_record.id is null then
    raise exception using errcode = 'P0002', message = 'survey_response_not_found';
  end if;
  if response_record.status <> 'STARTED' then
    raise exception using errcode = '23514', message = 'survey_response_already_completed';
  end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception using errcode = '22023', message = 'survey_answers_invalid';
  end if;

  insert into public.survey_answers (
    response_id, question_id, question_version_id, numeric_value,
    text_value, option_value, not_applicable
  )
  select response_record.id, question.id, version.id,
    case when item->>'numericValue' = '' then null else (item->>'numericValue')::numeric end,
    nullif(btrim(item->>'textValue'), ''),
    item->'optionValue',
    coalesce((item->>'notApplicable')::boolean, false)
  from jsonb_array_elements(p_answers) item
  join public.survey_questions question on question.id = (item->>'questionId')::uuid
    and question.campaign_id = response_record.campaign_id
  join public.survey_question_versions version on version.id = (item->>'questionVersionId')::uuid
    and version.question_id = question.id;
  get diagnostics inserted_answers = row_count;
  if inserted_answers <> jsonb_array_length(p_answers) then
    raise exception using errcode = '22023', message = 'survey_answers_scope_invalid';
  end if;
  if exists (
    select 1
    from public.survey_answers answer
    join public.survey_question_versions version on version.id = answer.question_version_id
    where answer.response_id = response_record.id and (
      (answer.not_applicable and not version.allow_na)
      or (version.question_type = 'STAR_5' and not answer.not_applicable
        and (answer.numeric_value is null or answer.numeric_value <> trunc(answer.numeric_value)
          or answer.numeric_value not between 1 and 5))
      or (version.question_type = 'NPS_10'
        and (answer.numeric_value is null or answer.numeric_value <> trunc(answer.numeric_value)
          or answer.numeric_value not between 0 and 10))
      or (version.question_type in ('SHORT_TEXT', 'LONG_TEXT')
        and (answer.text_value is null or char_length(answer.text_value) > 1500))
      or (version.question_type in ('SINGLE_CHOICE', 'YES_NO') and not answer.not_applicable
        and (jsonb_typeof(answer.option_value) is distinct from 'string' or not exists (
          select 1 from public.survey_question_options option
          where option.version_id = version.id and option.active
            and to_jsonb(option.value) = answer.option_value
        )))
      or (version.question_type = 'MULTIPLE_CHOICE' and not answer.not_applicable
        and (jsonb_typeof(answer.option_value) is distinct from 'array' or exists (
          select 1 from jsonb_array_elements_text(
            case when jsonb_typeof(answer.option_value) = 'array'
              then answer.option_value else '[]'::jsonb end
          ) chosen(value)
          where not exists (
            select 1 from public.survey_question_options option
            where option.version_id = version.id and option.active
              and option.value = chosen.value
          )
        )))
    )
  ) then
    raise exception using errcode = '22023', message = 'survey_answer_value_invalid';
  end if;

  if exists (
    select 1 from public.survey_questions question
    join public.survey_question_versions version on version.id = question.current_version_id
    where question.campaign_id = response_record.campaign_id
      and question.active and question.deleted_at is null and version.required
      and version.configuration->>'conditional' is distinct from 'true'
      and not exists (
        select 1 from public.survey_answers answer
        where answer.response_id = response_record.id and answer.question_id = question.id
      )
  ) then
    raise exception using errcode = '23514', message = 'survey_required_answers_missing';
  end if;

  select round(avg(answer.numeric_value)::numeric, 2)
  into overall
  from public.survey_answers answer
  join public.survey_question_versions version on version.id = answer.question_version_id
  where answer.response_id = response_record.id and version.question_type = 'STAR_5'
    and version.category not in ('DIAGNOSTICO', 'DESTAQUE') and not answer.not_applicable;
  select answer.numeric_value::smallint into nps
  from public.survey_answers answer
  join public.survey_question_versions version on version.id = answer.question_version_id
  where answer.response_id = response_record.id and version.question_type = 'NPS_10'
  limit 1;
  select count(*) into low_dimensions
  from public.survey_answers answer
  join public.survey_question_versions version on version.id = answer.question_version_id
  where answer.response_id = response_record.id and version.question_type = 'STAR_5'
    and answer.numeric_value <= 2 and not answer.not_applicable;
  is_critical := coalesce(overall <= 2, false) or coalesce(nps <= 6, false) or low_dimensions >= 2;

  if feedback_mode = 'AUDIO' and (
    audio_path is null
    or audio_path not like response_record.organization_id::text || '/' || response_record.id::text || '/%'
    or not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'survey-feedback-audio' and object.name = audio_path
    )
  ) then
    raise exception using errcode = '22023', message = 'survey_audio_path_invalid';
  end if;
  insert into public.survey_feedback (
    response_id, mode, text_content, audio_storage_path, audio_mime_type,
    audio_duration_seconds
  ) values (
    response_record.id,
    feedback_mode,
    nullif(btrim(p_feedback->>'textContent'), ''),
    audio_path,
    nullif(p_feedback->>'audioMimeType', ''),
    nullif(p_feedback->>'audioDurationSeconds', '')::integer
  );

  update public.survey_responses set
    status = 'COMPLETED', completed_at = now(), overall_score = overall,
    nps_score = nps, critical = is_critical,
    wants_contact = coalesce((p_contact->>'wantsContact')::boolean, false),
    contact_name = case when coalesce((p_contact->>'wantsContact')::boolean, false)
      then nullif(btrim(p_contact->>'name'), '') else null end,
    contact_phone = case when coalesce((p_contact->>'wantsContact')::boolean, false)
      then regexp_replace(coalesce(p_contact->>'phone', ''), '[^0-9]', '', 'g') else null end,
    contact_consent_at = case when coalesce((p_contact->>'wantsContact')::boolean, false)
      then now() else null end
  where id = response_record.id;

  insert into public.survey_events (
    organization_id, unit_id, campaign_id, qr_code_id, response_id, event_type
  ) values (
    response_record.organization_id, response_record.unit_id,
    response_record.campaign_id, response_record.qr_code_id,
    response_record.id, 'COMPLETED'
  );
  return jsonb_build_object('completed', true, 'overallScore', overall, 'npsScore', nps, 'critical', is_critical);
end;
$$;
revoke all on function public.complete_survey_response(uuid, text, jsonb, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.complete_survey_response(uuid, text, jsonb, jsonb, jsonb)
to service_role;

create or replace function public.generate_survey_monthly_snapshot(
  p_organization_id uuid,
  p_unit_id uuid,
  p_year integer,
  p_month integer,
  p_actor_id uuid default null,
  p_force boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_record record;
  start_at timestamptz;
  end_at timestamptz;
  metrics jsonb;
  payload jsonb;
  result_id uuid;
  actor_allowed boolean := false;
begin
  if p_year not between 2020 and 2200 or p_month not between 1 and 12 then
    raise exception using errcode = '22023', message = 'survey_snapshot_period_invalid';
  end if;
  if p_actor_id is not null then
    select active and (
      role::text = 'super_admin' or access_profile = 'super_admin'
      or 'surveys.admin' = any(coalesce(permissions, '{}'::text[]))
    ) into actor_allowed from public.profiles where id = p_actor_id;
  end if;
  if p_force and not coalesce(actor_allowed, false) then
    raise exception using errcode = '42501', message = 'survey_admin_required';
  end if;
  select * into existing_record from public.survey_monthly_snapshots
  where organization_id = p_organization_id
    and unit_id is not distinct from p_unit_id and year = p_year and month = p_month
  for update;
  if existing_record.id is not null and not p_force then return existing_record.id; end if;

  start_at := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'America/Belem');
  end_at := start_at + interval '1 month';
  metrics := public.survey_dashboard_metrics(p_organization_id, p_unit_id, start_at, end_at);
  payload := jsonb_build_object(
    'period', jsonb_build_object('year', p_year, 'month', p_month, 'start', start_at, 'end', end_at),
    'metrics', metrics,
    'questionVersions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', question.id, 'stableKey', question.stable_key,
        'versionId', version.id, 'version', version.version_number,
        'category', version.category, 'title', version.title, 'type', version.question_type
      ) order by question.sort_order)
      from public.survey_questions question
      join public.survey_campaigns campaign on campaign.id = question.campaign_id
      join public.survey_question_versions version on version.id = question.current_version_id
      where campaign.organization_id = p_organization_id
        and (p_unit_id is null or campaign.unit_id = p_unit_id)
    ), '[]'::jsonb)
  );

  if existing_record.id is null then
    insert into public.survey_monthly_snapshots (
      organization_id, unit_id, year, month, snapshot_data,
      response_count, generated_by
    ) values (
      p_organization_id, p_unit_id, p_year, p_month, payload,
      coalesce((metrics->>'responseCount')::integer, 0), p_actor_id
    ) returning id into result_id;
  else
    update public.survey_monthly_snapshots set snapshot_data = payload,
      response_count = coalesce((metrics->>'responseCount')::integer, 0),
      generated_at = now(), generated_by = p_actor_id
    where id = existing_record.id returning id into result_id;
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_id,
    case when existing_record.id is null then 'SURVEY_MONTHLY_SNAPSHOT_CREATED'
      else 'SURVEY_MONTHLY_SNAPSHOT_REGENERATED' end,
    'survey_monthly_snapshot', result_id::text,
    jsonb_build_object('organization_id', p_organization_id, 'unit_id', p_unit_id, 'year', p_year, 'month', p_month)
  );
  return result_id;
end;
$$;
revoke all on function public.generate_survey_monthly_snapshot(uuid, uuid, integer, integer, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.generate_survey_monthly_snapshot(uuid, uuid, integer, integer, uuid, boolean)
to service_role;
