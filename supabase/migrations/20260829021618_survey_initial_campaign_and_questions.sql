do $$
declare
  v_organization_id uuid;
  v_unit_id uuid;
  v_campaign_id uuid;
  v_question_id uuid;
  v_version_id uuid;
  item jsonb;
  option_item jsonb;
  option_order integer;
  v_source_id uuid;
  v_target_id uuid;
begin
  insert into public.survey_organizations (name, slug)
  values ('INNEURO', 'inneuro')
  on conflict (slug) do update set name = excluded.name, active = true, updated_at = now()
  returning id into v_organization_id;

  insert into public.survey_units (organization_id, name, slug)
  values (v_organization_id, 'Macapá', 'macapa')
  on conflict (organization_id, slug) do update set name = excluded.name, active = true, updated_at = now()
  returning id into v_unit_id;

  insert into public.survey_campaigns (
    organization_id, unit_id, name, slug, title, description,
    status, starts_at, settings
  ) values (
    v_organization_id, v_unit_id, 'Pesquisa de Satisfação do Cliente',
    'satisfacao-cliente', 'Como foi sua experiência conosco? 💚',
    'Sua opinião nos ajuda a melhorar continuamente cada etapa da sua jornada.',
    'ACTIVE', now(),
    jsonb_build_object(
      'estimated_minutes', 1,
      'feedback_max_length', 1500,
      'audio_max_seconds', 90,
      'critical_rule', jsonb_build_object('overall_lte', 2, 'nps_lte', 6, 'low_dimensions', 2)
    )
  )
  on conflict (organization_id, slug) do update set
    unit_id = excluded.unit_id, name = excluded.name, title = excluded.title,
    description = excluded.description, status = 'ACTIVE', updated_at = now()
  returning id into v_campaign_id;

  insert into public.survey_qr_codes (
    organization_id, unit_id, campaign_id, stable_token, label
  )
  select v_organization_id, v_unit_id, v_campaign_id,
    encode(gen_random_bytes(36), 'hex'), 'Satisfação do Cliente — Macapá'
  where not exists (
    select 1 from public.survey_qr_codes qr
    where qr.organization_id = v_organization_id and qr.unit_id = v_unit_id
  );

  for item in select value from jsonb_array_elements($questions$[
    {"key":"experiencia_geral","category":"EXPERIENCIA_GERAL","type":"STAR_5","title":"Como você avalia sua experiência geral na INNEURO?","required":true,"allowNa":false},
    {"key":"agendamento","category":"AGENDAMENTO","type":"STAR_5","title":"Como você avalia sua experiência com o agendamento e as informações recebidas antes do atendimento?","required":true,"allowNa":true},
    {"key":"recepcao","category":"RECEPCAO","type":"STAR_5","title":"Como você avalia a agilidade, cordialidade e organização da nossa recepção?","required":true,"allowNa":false},
    {"key":"tempo_espera","category":"TEMPO_ESPERA","type":"STAR_5","title":"Como você avalia o tempo de espera até o início do seu atendimento?","required":true,"allowNa":false},
    {"key":"profissionais","category":"PROFISSIONAIS","type":"STAR_5","title":"Durante seu atendimento, você se sentiu tratado com atenção, respeito e segurança pelos nossos profissionais?","required":true,"allowNa":false},
    {"key":"execucao_exame","category":"EXECUCAO_EXAME","type":"STAR_5","title":"Como você avalia a realização do seu exame ou procedimento?","required":true,"allowNa":true},
    {"key":"seguranca_conforto","category":"SEGURANCA_CONFORTO","type":"STAR_5","title":"Durante o exame ou procedimento, você se sentiu seguro(a), confortável e bem orientado(a)?","required":true,"allowNa":true},
    {"key":"comunicacao","category":"COMUNICACAO","type":"STAR_5","title":"As informações e orientações recebidas foram claras e fáceis de entender?","required":true,"allowNa":false},
    {"key":"infraestrutura","category":"INFRAESTRUTURA","type":"STAR_5","title":"Como você avalia a limpeza, o conforto, a organização e a estrutura da clínica?","required":true,"allowNa":false},
    {"key":"resolucao","category":"RESOLUCAO","type":"STAR_5","title":"Ao final do atendimento, sua necessidade foi resolvida ou encaminhada adequadamente?","required":true,"allowNa":false},
    {"key":"nps","category":"NPS","type":"NPS_10","title":"De 0 a 10, quanto você recomendaria a INNEURO para um amigo ou familiar?","required":true,"allowNa":false},
    {"key":"problema_principal","category":"DIAGNOSTICO","type":"SINGLE_CHOICE","title":"Onde ocorreu o principal problema?","description":"Quer nos ajudar a entender onde podemos melhorar?","required":false,"allowNa":false,"conditional":true,"options":["Agendamento","Recepção","Tempo de espera","Profissionais","Execução do exame","Informações/orientações","Convênio/autorização","Infraestrutura","Organização entre setores","Finalização do atendimento","Outro"]},
    {"key":"problema_ocorrido","category":"DIAGNOSTICO","type":"MULTIPLE_CHOICE","title":"O que aconteceu?","required":false,"allowNa":false,"conditional":true,"options":["Demora","Falta de informação","Informação incorreta","Dificuldade para agendar","Atendimento pouco cordial","Falta de atenção","Problema com documentação","Problema com convênio/autorização","Falta de organização","Desconforto durante o exame","Falta de explicação sobre o exame","Problema de estrutura/conforto","Necessidade não resolvida","Outro"]},
    {"key":"detalhe_execucao_exame","category":"DIAGNOSTICO","type":"MULTIPLE_CHOICE","title":"Em quais pontos da realização do exame podemos melhorar?","required":false,"allowNa":false,"conditional":true,"options":["Tempo para iniciar","Explicação do procedimento","Conforto","Privacidade","Atenção da equipe","Comunicação durante o exame","Organização do setor","Outro"]},
    {"key":"detalhe_infraestrutura","category":"DIAGNOSTICO","type":"MULTIPLE_CHOICE","title":"Em quais pontos da infraestrutura podemos melhorar?","required":false,"allowNa":false,"conditional":true,"options":["Limpeza","Banheiros","Assentos/conforto","Temperatura","Sinalização","Acessibilidade","Estacionamento/acesso","Organização","Privacidade","Outro"]},
    {"key":"detalhe_profissionais","category":"DIAGNOSTICO","type":"MULTIPLE_CHOICE","title":"Em quais pontos da experiência com os profissionais podemos melhorar?","required":false,"allowNa":false,"conditional":true,"options":["Cordialidade","Atenção","Clareza das explicações","Segurança transmitida","Privacidade","Comunicação","Organização","Outro"]},
    {"key":"destaque_positivo","category":"DESTAQUE","type":"MULTIPLE_CHOICE","title":"O que mais contribuiu para sua boa experiência?","required":false,"allowNa":false,"conditional":true,"options":["Atendimento da equipe","Recepção","Agilidade","Qualidade da realização do exame","Organização","Estrutura","Clareza das informações","Segurança/confiança","Outro"]}
  ]$questions$::jsonb) loop
    insert into public.survey_questions (
      campaign_id, stable_key, category, question_type, title, description,
      required, allow_na, active, sort_order
    ) values (
      v_campaign_id, item->>'key', item->>'category', item->>'type',
      item->>'title', nullif(item->>'description', ''),
      coalesce((item->>'required')::boolean, false),
      coalesce((item->>'allowNa')::boolean, false), true,
      (select count(*) from public.survey_questions question where question.campaign_id = v_campaign_id)
    )
    on conflict (campaign_id, stable_key) do update set
      category = excluded.category, question_type = excluded.question_type,
      title = excluded.title, description = excluded.description,
      required = excluded.required, allow_na = excluded.allow_na,
      active = true, deleted_at = null, updated_at = now()
    returning id into v_question_id;

    select version.id into v_version_id from public.survey_question_versions version
    where version.question_id = v_question_id and version.version_number = 1;
    if v_version_id is null then
      insert into public.survey_question_versions (
        question_id, version_number, category, question_type, title,
        description, required, allow_na, configuration
      ) values (
        v_question_id, 1, item->>'category', item->>'type', item->>'title',
        nullif(item->>'description', ''),
        coalesce((item->>'required')::boolean, false),
        coalesce((item->>'allowNa')::boolean, false),
        jsonb_build_object('conditional', coalesce((item->>'conditional')::boolean, false))
      ) returning id into v_version_id;
    end if;
    update public.survey_questions set current_version_id = v_version_id
    where id = v_question_id and current_version_id is null;

    option_order := 0;
    for option_item in select value from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb)) loop
      insert into public.survey_question_options (
        question_id, version_id, label, value, sort_order
      ) values (
        v_question_id, v_version_id, trim(both '"' from option_item::text),
        lower(regexp_replace(trim(both '"' from option_item::text), '[^[:alnum:]]+', '_', 'g')),
        option_order
      ) on conflict (version_id, value) do nothing;
      option_order := option_order + 1;
    end loop;
  end loop;

  select question.id into v_target_id from public.survey_questions question
  where question.campaign_id = v_campaign_id and question.stable_key = 'problema_principal';
  insert into public.survey_question_rules (
    campaign_id, operator, comparison_value, target_question_id, action
  ) select v_campaign_id, 'ANY_DIMENSION_LTE', '3'::jsonb, v_target_id, 'SHOW'
  where not exists (select 1 from public.survey_question_rules rule where rule.target_question_id = v_target_id);

  select question.id into v_target_id from public.survey_questions question
  where question.campaign_id = v_campaign_id and question.stable_key = 'problema_ocorrido';
  insert into public.survey_question_rules (
    campaign_id, operator, comparison_value, target_question_id, action
  ) select v_campaign_id, 'ANY_DIMENSION_LTE', '3'::jsonb, v_target_id, 'SHOW'
  where not exists (select 1 from public.survey_question_rules rule where rule.target_question_id = v_target_id);

  select question.id into v_source_id from public.survey_questions question where question.campaign_id = v_campaign_id and question.stable_key = 'execucao_exame';
  select question.id into v_target_id from public.survey_questions question where question.campaign_id = v_campaign_id and question.stable_key = 'detalhe_execucao_exame';
  insert into public.survey_question_rules (campaign_id, source_question_id, operator, comparison_value, target_question_id)
  select v_campaign_id, v_source_id, 'LTE', '3'::jsonb, v_target_id
  where not exists (select 1 from public.survey_question_rules rule where rule.target_question_id = v_target_id);

  select question.id into v_source_id from public.survey_questions question where question.campaign_id = v_campaign_id and question.stable_key = 'infraestrutura';
  select question.id into v_target_id from public.survey_questions question where question.campaign_id = v_campaign_id and question.stable_key = 'detalhe_infraestrutura';
  insert into public.survey_question_rules (campaign_id, source_question_id, operator, comparison_value, target_question_id)
  select v_campaign_id, v_source_id, 'LTE', '3'::jsonb, v_target_id
  where not exists (select 1 from public.survey_question_rules rule where rule.target_question_id = v_target_id);

  select question.id into v_source_id from public.survey_questions question where question.campaign_id = v_campaign_id and question.stable_key = 'profissionais';
  select question.id into v_target_id from public.survey_questions question where question.campaign_id = v_campaign_id and question.stable_key = 'detalhe_profissionais';
  insert into public.survey_question_rules (campaign_id, source_question_id, operator, comparison_value, target_question_id)
  select v_campaign_id, v_source_id, 'LTE', '3'::jsonb, v_target_id
  where not exists (select 1 from public.survey_question_rules rule where rule.target_question_id = v_target_id);

  select question.id into v_target_id from public.survey_questions question
  where question.campaign_id = v_campaign_id and question.stable_key = 'destaque_positivo';
  insert into public.survey_question_rules (
    campaign_id, operator, comparison_value, target_question_id, action
  ) select v_campaign_id, 'AVERAGE_GTE', '4'::jsonb, v_target_id, 'SHOW'
  where not exists (select 1 from public.survey_question_rules rule where rule.target_question_id = v_target_id);

  insert into public.survey_profile_access (profile_id, organization_id, unit_id)
  select profile.id, v_organization_id, null
  from public.profiles profile
  where profile.active and (
    profile.role::text in ('super_admin', 'admin')
    or profile.access_profile in ('super_admin', 'manager')
    or profile.permissions && array[
      'surveys.view', 'surveys.manage', 'surveys.reports',
      'surveys.qrcode', 'surveys.admin'
    ]::text[]
  )
  on conflict do nothing;
end $$;
