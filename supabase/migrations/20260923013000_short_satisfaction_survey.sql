-- Publish the compatible client before applying this migration.
begin;

do $$
declare
  campaign public.survey_campaigns%rowtype;
  item jsonb;
  v_question_id uuid;
  v_version_id uuid;
  next_version integer;
  before_state jsonb;
  function_sql text;
  active_count integer;
begin
  select c.* into strict campaign
  from public.survey_campaigns c
  join public.survey_organizations o on o.id = c.organization_id
  where o.slug = 'inneuro' and c.slug = 'satisfacao-cliente'
  for update of c;

  if campaign.settings->>'flow_version' = 'short_2026_09' then
    return;
  end if;

  select jsonb_build_object(
    'campaign', to_jsonb(campaign),
    'questions', (select jsonb_agg(to_jsonb(q) order by q.sort_order) from public.survey_questions q where q.campaign_id = campaign.id),
    'rules', (select jsonb_agg(to_jsonb(r)) from public.survey_question_rules r where r.campaign_id = campaign.id)
  ) into before_state;

  -- Existing sessions continue to submit their immutable versions. Do not
  -- require questions created after a respondent started the questionnaire.
  select pg_get_functiondef('public.complete_survey_response(uuid,text,jsonb,jsonb,jsonb)'::regprocedure)
  into function_sql;
  if position('question.created_at <= response_record.started_at' in function_sql) = 0 then
    if position('and question.active and question.deleted_at is null and version.required' in function_sql) = 0 then
      raise exception 'survey_completion_function_requires_review';
    end if;
    function_sql := replace(function_sql,
      'and question.active and question.deleted_at is null and version.required',
      'and question.active and question.deleted_at is null and version.required
      and question.created_at <= response_record.started_at');
    execute function_sql;
  end if;

  update public.survey_questions set active = false, updated_at = now()
  where campaign_id = campaign.id and active;
  update public.survey_question_rules set active = false
  where campaign_id = campaign.id and active;

  for item in select value from jsonb_array_elements($questions$[
    {"key":"recepcao","category":"RECEPCAO","title":"Como você avalia o atendimento da recepção?","type":"STAR_5","na":false,"order":0},
    {"key":"tempo_espera","category":"TEMPO_ESPERA","title":"Como você avalia o tempo de espera para ser atendido?","type":"STAR_5","na":false,"order":1},
    {"key":"limpeza","category":"LIMPEZA","title":"Como você avalia a limpeza dos ambientes?","type":"STAR_5","na":false,"order":2},
    {"key":"atendimento_exame","category":"ATENDIMENTO_EXAME","title":"Como você avalia o atendimento durante seu exame?","type":"STAR_5","na":true,"order":3},
    {"key":"enfermagem","category":"ENFERMAGEM","title":"Como você avalia os cuidados recebidos da equipe de enfermagem?","type":"STAR_5","na":true,"order":4},
    {"key":"nps","category":"NPS","title":"De 0 a 10, qual a probabilidade de você recomendar a INNEURO a um amigo ou familiar?","type":"NPS_10","na":false,"order":5}
  ]$questions$::jsonb) loop
    insert into public.survey_questions (
      campaign_id, stable_key, category, question_type, title, required,
      allow_na, active, sort_order
    ) values (
      campaign.id, item->>'key', item->>'category', item->>'type', item->>'title',
      true, (item->>'na')::boolean, true, (item->>'order')::integer
    ) on conflict (campaign_id, stable_key) do update set
      category = excluded.category, question_type = excluded.question_type,
      title = excluded.title, description = null, required = true,
      allow_na = excluded.allow_na, active = true, deleted_at = null,
      sort_order = excluded.sort_order, updated_at = now()
    returning id into v_question_id;

    select coalesce(max(v.version_number), 0) + 1 into next_version
    from public.survey_question_versions v where v.question_id = v_question_id;

    insert into public.survey_question_versions (
      question_id, version_number, category, question_type, title,
      required, allow_na, configuration
    ) values (
      v_question_id, next_version, item->>'category', item->>'type', item->>'title',
      true, (item->>'na')::boolean,
      '{"conditional":false,"flow_version":"short_2026_09"}'::jsonb
    ) returning id into v_version_id;

    update public.survey_questions set current_version_id = v_version_id
    where id = v_question_id;
  end loop;

  update public.survey_campaigns set
    settings = settings || '{"flow_version":"short_2026_09","contact_enabled":false}'::jsonb,
    updated_at = now()
  where id = campaign.id;

  select count(*) into active_count from public.survey_questions
  where campaign_id = campaign.id and active and deleted_at is null;
  if active_count <> 6 then raise exception 'short_survey_requires_six_questions'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (null, 'SURVEY_SHORT_VERSION_PUBLISHED', 'survey_campaign', campaign.id,
    before_state, jsonb_build_object(
      'actor_kind', 'system', 'reason', 'Versão curta aprovada e publicação em produção autorizada pelo proprietário',
      'flow_version', 'short_2026_09', 'questions', active_count,
      'published_at', now(), 'historical_answers_preserved', true, 'qr_preserved', true
    ));
end;
$$;

commit;

