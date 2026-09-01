begin;

alter table public.appointment_requests
  add column if not exists first_contact_at timestamptz,
  add column if not exists follow_up_at timestamptz,
  add column if not exists operational_outcome_reason text,
  add column if not exists operational_outcome_note text,
  add column if not exists scheduling_note text;

alter table public.appointment_requests
  drop constraint if exists appointment_requests_scheduling_note_length_check;
alter table public.appointment_requests
  add constraint appointment_requests_scheduling_note_length_check check (
    scheduling_note is null or char_length(scheduling_note) <= 1000
  );

alter table public.appointment_requests
  drop constraint if exists appointment_requests_operational_outcome_reason_check;
alter table public.appointment_requests
  add constraint appointment_requests_operational_outcome_reason_check check (
    operational_outcome_reason is null or operational_outcome_reason in (
      'no_contact', 'whatsapp_no_response', 'invalid_phone',
      'patient_declined', 'exam_already_completed',
      'patient_unavailable', 'insurance_not_authorized',
      'exam_unavailable', 'duplicate_request', 'other'
    )
  );

create table if not exists public.appointment_request_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null
    references public.appointment_requests(id) on delete cascade,
  operation_id uuid not null unique,
  actor_id uuid references public.profiles(id) on delete set null,
  contact_type text not null check (
    contact_type in ('phone', 'whatsapp', 'email', 'other')
  ),
  result text not null check (
    result in (
      'no_answer', 'voicemail', 'invalid_number', 'message_sent',
      'no_response', 'follow_up_requested', 'contact_made', 'other'
    )
  ),
  note text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 1000),
  check (result <> 'follow_up_requested' or follow_up_at is not null)
);

create index if not exists appointment_contact_attempts_request_idx
  on public.appointment_request_contact_attempts (
    appointment_request_id, created_at desc
  );
create index if not exists appointment_requests_follow_up_queue_idx
  on public.appointment_requests (follow_up_at, created_at)
  where follow_up_at is not null
    and deleted_at is null
    and workflow_status not in ('CONCLUIDO', 'NAO_AGENDAVEL', 'CANCELADO');

alter table public.appointment_request_contact_attempts enable row level security;

create policy "scheduling staff reads contact attempts"
  on public.appointment_request_contact_attempts for select to authenticated
  using (public.is_scheduling_staff());
create policy "scheduling staff creates contact attempts"
  on public.appointment_request_contact_attempts for insert to authenticated
  with check (public.is_scheduling_staff() and actor_id = (select auth.uid()));

grant select, insert on public.appointment_request_contact_attempts
  to authenticated;

create or replace function public.register_scheduling_contact_attempt(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_contact_type text,
  p_result text,
  p_note text,
  p_follow_up_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record record;
  actor_record record;
  attempt_id uuid;
  event_time timestamptz := now();
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null
    or p_contact_type not in ('phone', 'whatsapp', 'email', 'other')
    or p_result not in (
      'no_answer', 'voicemail', 'invalid_number', 'message_sent',
      'no_response', 'follow_up_requested', 'contact_made', 'other'
    )
    or char_length(coalesce(clean_note, '')) > 1000
    or (p_result = 'follow_up_requested' and p_follow_up_at is null) then
    raise exception using errcode = '22023', message = 'contact_attempt_input_invalid';
  end if;

  select id, role::text as role, permissions, active, full_name
  into actor_record
  from public.profiles
  where id = p_actor_id;
  if actor_record.id is null or not actor_record.active or not (
    actor_record.role in ('super_admin', 'admin')
    or 'scheduling.manage' = any(coalesce(actor_record.permissions, '{}'::text[]))
  ) then
    raise exception using errcode = '42501', message = 'scheduling_authorization_required';
  end if;

  select id, assigned_to, workflow_status, deleted_at, follow_up_at
  into request_record
  from public.appointment_requests
  where id = p_request_id
  for update;
  if request_record.id is null or request_record.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'appointment_request_not_found';
  end if;
  if request_record.workflow_status in ('CONCLUIDO', 'NAO_AGENDAVEL', 'CANCELADO') then
    raise exception using errcode = '23514', message = 'appointment_already_closed';
  end if;
  if request_record.assigned_to is distinct from p_actor_id
    and not private.can_override_scheduling_assignment(p_actor_id) then
    raise exception using errcode = '42501', message = 'appointment_assigned_to_another_attendant';
  end if;

  insert into public.appointment_request_contact_attempts (
    appointment_request_id, operation_id, actor_id, contact_type, result, note,
    follow_up_at
  ) values (
    p_request_id, p_operation_id, p_actor_id, p_contact_type, p_result,
    clean_note,
    case when p_result = 'follow_up_requested' then p_follow_up_at else null end
  ) on conflict (operation_id) do nothing
  returning id into attempt_id;

  if attempt_id is null then
    select id into attempt_id
    from public.appointment_request_contact_attempts
    where operation_id = p_operation_id;
    return jsonb_build_object(
      'id', attempt_id,
      'duplicate', true,
      'follow_up_at', request_record.follow_up_at
    );
  end if;

  update public.appointment_requests
  set
    first_contact_at = coalesce(first_contact_at, event_time),
    follow_up_at = case
      when p_result = 'follow_up_requested' then p_follow_up_at
      when p_result = 'contact_made' then null
      else follow_up_at
    end
  where id = p_request_id;

  insert into public.appointment_request_history (
    appointment_request_id, actor_id, action, details
  ) values (
    p_request_id,
    p_actor_id,
    'Tentativa de contato registrada',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'contact_attempt_id', attempt_id,
      'contact_type', p_contact_type,
      'result', p_result,
      'follow_up_at', case
        when p_result = 'follow_up_requested' then p_follow_up_at
        else null
      end,
      'actor_name', actor_record.full_name,
      'previous_status', request_record.workflow_status,
      'new_status', request_record.workflow_status,
      'timestamp', event_time
    )
  );

  return jsonb_build_object(
    'id', attempt_id,
    'first_contact_at', event_time,
    'follow_up_at', case
      when p_result = 'follow_up_requested' then p_follow_up_at
      when p_result = 'contact_made' then null
      else request_record.follow_up_at
    end
  );
end;
$$;
revoke all on function public.register_scheduling_contact_attempt(
  uuid, uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.register_scheduling_contact_attempt(
  uuid, uuid, uuid, text, text, text, timestamptz
) to service_role;

create or replace function public.close_appointment_unscheduled(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_reason text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record record;
  actor_record record;
  event_time timestamptz := now();
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  reason_label text;
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null
    or p_reason not in (
      'no_contact', 'whatsapp_no_response', 'invalid_phone',
      'patient_declined', 'exam_already_completed',
      'patient_unavailable', 'insurance_not_authorized',
      'exam_unavailable', 'duplicate_request', 'other'
    )
    or char_length(coalesce(clean_note, '')) > 1000
    or (p_reason = 'other' and clean_note is null) then
    raise exception using errcode = '22023', message = 'unscheduled_input_invalid';
  end if;

  reason_label := case p_reason
    when 'no_contact' then 'Não conseguimos contato'
    when 'whatsapp_no_response' then 'WhatsApp sem retorno'
    when 'invalid_phone' then 'Telefone inválido'
    when 'patient_declined' then 'Paciente desistiu'
    when 'exam_already_completed' then 'Paciente já realizou o exame'
    when 'patient_unavailable' then 'Paciente sem disponibilidade'
    when 'insurance_not_authorized' then 'Convênio não autorizado'
    when 'exam_unavailable' then 'Exame indisponível'
    when 'duplicate_request' then 'Solicitação duplicada'
    else 'Outro'
  end;

  select id, role::text as role, permissions, active, full_name
  into actor_record
  from public.profiles
  where id = p_actor_id;
  if actor_record.id is null or not actor_record.active or not (
    actor_record.role in ('super_admin', 'admin')
    or 'scheduling.manage' = any(coalesce(actor_record.permissions, '{}'::text[]))
  ) then
    raise exception using errcode = '42501', message = 'scheduling_authorization_required';
  end if;

  select id, assigned_to, workflow_status, deleted_at
  into request_record
  from public.appointment_requests
  where id = p_request_id
  for update;
  if request_record.id is null or request_record.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'appointment_request_not_found';
  end if;
  if request_record.workflow_status in ('CONCLUIDO', 'NAO_AGENDAVEL', 'CANCELADO') then
    raise exception using errcode = '23514', message = 'appointment_already_closed';
  end if;
  if request_record.assigned_to is distinct from p_actor_id
    and not private.can_override_scheduling_assignment(p_actor_id) then
    raise exception using errcode = '42501', message = 'appointment_assigned_to_another_attendant';
  end if;

  update public.appointment_request_exams
  set
    status = 'NOT_SCHEDULABLE',
    not_schedulable_reason = 'other',
    not_schedulable_detail = coalesce(clean_note, reason_label),
    not_schedulable_at = event_time,
    not_schedulable_by = p_actor_id
  where appointment_request_id = p_request_id
    and status <> 'NOT_SCHEDULABLE';

  update public.appointment_requests
  set
    workflow_status = 'NAO_AGENDAVEL',
    status = 'CANCELLED',
    assigned_to = coalesce(assigned_to, p_actor_id),
    claimed_at = coalesce(claimed_at, event_time),
    completed_by = p_actor_id,
    completed_at = event_time,
    follow_up_at = null,
    operational_outcome_reason = p_reason,
    operational_outcome_note = clean_note,
    not_schedulable_reason = 'other',
    not_schedulable_detail = coalesce(clean_note, reason_label),
    not_schedulable_at = event_time,
    not_schedulable_by = p_actor_id,
    not_schedulable_communication_status = 'NOT_REQUIRED',
    confirmation_status = 'NOT_REQUIRED'
  where id = p_request_id;

  insert into public.appointment_request_history (
    appointment_request_id, actor_id, action, details
  ) values (
    p_request_id,
    p_actor_id,
    'Solicitação registrada como não agendada',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'reason', p_reason,
      'reason_label', reason_label,
      'observation', clean_note,
      'actor_name', actor_record.full_name,
      'previous_status', request_record.workflow_status,
      'new_status', 'NAO_AGENDAVEL',
      'timestamp', event_time
    )
  );

  return jsonb_build_object('completed_at', event_time, 'reason', p_reason);
end;
$$;
revoke all on function public.close_appointment_unscheduled(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.close_appointment_unscheduled(
  uuid, uuid, uuid, text, text
) to service_role;

create or replace function public.get_scheduling_indicators(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped as (
    select request.*
    from public.appointment_requests request
    where request.deleted_at is null
      and (p_from is null or request.created_at >= p_from)
      and (p_to is null or request.created_at < p_to)
  ), totals as (
    select
      count(*)::integer as total,
      count(*) filter (where workflow_status = 'NOVO')::integer as waiting,
      count(*) filter (
        where workflow_status not in ('NOVO', 'CONCLUIDO', 'NAO_AGENDAVEL', 'CANCELADO')
      )::integer as in_service,
      count(*) filter (where workflow_status = 'CONCLUIDO')::integer as scheduled,
      count(*) filter (
        where workflow_status in ('NAO_AGENDAVEL', 'CANCELADO')
      )::integer as unscheduled,
      count(*) filter (
        where follow_up_at is not null and follow_up_at <= now()
          and workflow_status not in ('CONCLUIDO', 'NAO_AGENDAVEL', 'CANCELADO')
      )::integer as pending_follow_ups,
      count(*) filter (
        where workflow_status = 'CONCLUIDO'
          and completed_at >= date_trunc('day', now())
          and completed_at < date_trunc('day', now()) + interval '1 day'
      )::integer as scheduled_today,
      round(avg(extract(epoch from (first_contact_at - created_at)) / 60)
        filter (where first_contact_at is not null), 1) as average_first_contact_minutes,
      round(avg(extract(epoch from (completed_at - created_at)) / 60)
        filter (where completed_at is not null), 1) as average_completion_minutes
    from scoped
  ), reasons as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'reason', operational_outcome_reason,
      'total', reason_total
    ) order by reason_total desc), '[]'::jsonb) as items
    from (
      select operational_outcome_reason, count(*)::integer as reason_total
      from scoped
      where operational_outcome_reason is not null
      group by operational_outcome_reason
    ) grouped_reasons
  ), responsibles as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', completed_by,
      'name', responsible_name,
      'total', responsible_total,
      'scheduled', scheduled_total,
      'unscheduled', unscheduled_total
    ) order by responsible_total desc), '[]'::jsonb) as items
    from (
      select
        scoped.completed_by,
        coalesce(profile.full_name, 'Não atribuído') as responsible_name,
        count(*)::integer as responsible_total,
        count(*) filter (where scoped.workflow_status = 'CONCLUIDO')::integer
          as scheduled_total,
        count(*) filter (
          where scoped.workflow_status in ('NAO_AGENDAVEL', 'CANCELADO')
        )::integer as unscheduled_total
      from scoped
      left join public.profiles profile on profile.id = scoped.completed_by
      where scoped.workflow_status in ('CONCLUIDO', 'NAO_AGENDAVEL', 'CANCELADO')
      group by scoped.completed_by, profile.full_name
    ) grouped_responsibles
  )
  select to_jsonb(totals) || jsonb_build_object(
    'reasons', reasons.items,
    'responsibles', responsibles.items
  )
  from totals cross join reasons cross join responsibles;
$$;
revoke all on function public.get_scheduling_indicators(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_scheduling_indicators(timestamptz, timestamptz)
  to service_role;

commit;
