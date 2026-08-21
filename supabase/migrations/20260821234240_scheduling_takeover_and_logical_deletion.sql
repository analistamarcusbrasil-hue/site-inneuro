alter table public.appointment_requests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text;

create index if not exists appointment_requests_operational_queue_idx
  on public.appointment_requests (workflow_status, created_at)
  where deleted_at is null;

create or replace function public.take_over_appointment_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  request_record record;
  actor_record record;
  previous_name text;
  event_time timestamptz := now();
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null then
    raise exception using errcode = '22023', message = 'take_over_input_invalid';
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
  if request_record.assigned_to is null or request_record.assigned_to = p_actor_id then
    raise exception using errcode = '23514', message = 'appointment_take_over_not_required';
  end if;

  select full_name into previous_name
  from public.profiles
  where id = request_record.assigned_to;

  update public.appointment_requests
  set assigned_to = p_actor_id, claimed_at = event_time
  where id = p_request_id;

  insert into public.appointment_request_history (
    appointment_request_id, actor_id, action, details
  ) values (
    p_request_id,
    p_actor_id,
    'AGENDAMENTO ASSUMIDO POR OUTRO ATENDENTE',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'previous_assigned_to', request_record.assigned_to,
      'new_assigned_to', p_actor_id,
      'actor_id', p_actor_id,
      'actor_name', actor_record.full_name,
      'previous_actor_name', coalesce(previous_name, 'Atendente anterior'),
      'timestamp', event_time,
      'message', concat(actor_record.full_name, ' assumiu este agendamento, anteriormente atribuído a ', coalesce(previous_name, 'outro atendente'), '.')
    )
  );

  return jsonb_build_object(
    'previous_assigned_to', request_record.assigned_to,
    'previous_actor_name', coalesce(previous_name, 'Atendente anterior'),
    'new_assigned_to', p_actor_id,
    'actor_name', actor_record.full_name,
    'claimed_at', event_time
  );
end;
$$;
revoke all on function public.take_over_appointment_request(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.take_over_appointment_request(uuid, uuid, uuid)
to service_role;

create or replace function public.delete_appointment_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  request_record record;
  actor_name text;
  event_time timestamptz := now();
  justification text := btrim(coalesce(p_justification, ''));
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null
    or char_length(justification) not between 20 and 500 then
    raise exception using errcode = '22023', message = 'deletion_justification_invalid';
  end if;
  if not private.can_override_scheduling_assignment(p_actor_id) then
    raise exception using errcode = '42501', message = 'scheduling_override_required';
  end if;
  select full_name into actor_name from public.profiles where id = p_actor_id;

  select id, deleted_at
  into request_record
  from public.appointment_requests
  where id = p_request_id
  for update;
  if request_record.id is null or request_record.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'appointment_request_not_found';
  end if;

  update public.appointment_requests
  set deleted_at = event_time, deleted_by = p_actor_id, deletion_reason = justification
  where id = p_request_id;

  insert into public.appointment_request_history (
    appointment_request_id, actor_id, action, details
  ) values (
    p_request_id,
    p_actor_id,
    'AGENDAMENTO EXCLUÍDO',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'justification', justification,
      'actor_id', p_actor_id,
      'actor_name', actor_name,
      'timestamp', event_time
    )
  );

  return jsonb_build_object('deleted_at', event_time, 'deleted_by', p_actor_id);
end;
$$;
revoke all on function public.delete_appointment_request(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.delete_appointment_request(uuid, uuid, uuid, text)
to service_role;

create or replace function public.mark_appointment_not_schedulable(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_exam_ids uuid[],
  p_reason text,
  p_detail text,
  p_guidance text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  request_record record;
  actor_record record;
  selected_count integer;
  remaining_count integer;
  all_closed boolean;
  event_time timestamptz := now();
  justification text := btrim(coalesce(p_detail, ''));
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null
    or coalesce(cardinality(p_exam_ids), 0) = 0
    or p_reason not in (
      'clinic_does_not_offer', 'insurance_not_covered',
      'insurance_not_authorized', 'contract_not_covered', 'other'
    )
    or char_length(btrim(coalesce(p_guidance, ''))) not between 1 and 1600
    or char_length(justification) not between 20 and 800 then
    raise exception using errcode = '22023', message = 'not_schedulable_input_invalid';
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

  select id, assigned_to, workflow_status, deleted_at
  into request_record
  from public.appointment_requests
  where id = p_request_id
  for update;
  if request_record.id is null or request_record.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'appointment_request_not_found';
  end if;
  if request_record.workflow_status in ('CONCLUIDO', 'CANCELADO', 'NAO_AGENDAVEL') then
    raise exception using errcode = '23514', message = 'appointment_already_closed';
  end if;

  select count(*)::integer into selected_count
  from public.appointment_request_exams exam
  where exam.appointment_request_id = p_request_id
    and exam.id = any(p_exam_ids)
    and exam.status <> 'NOT_SCHEDULABLE';
  if selected_count <> cardinality(p_exam_ids) or selected_count <> (
    select count(distinct exam_id) from unnest(p_exam_ids) exam_id
  ) then
    raise exception using errcode = '22023', message = 'not_schedulable_exams_invalid';
  end if;

  update public.appointment_request_exams
  set status = 'NOT_SCHEDULABLE',
      not_schedulable_reason = p_reason,
      not_schedulable_detail = justification,
      not_schedulable_guidance = btrim(p_guidance),
      not_schedulable_at = event_time,
      not_schedulable_by = p_actor_id
  where appointment_request_id = p_request_id and id = any(p_exam_ids);

  select count(*)::integer into remaining_count
  from public.appointment_request_exams
  where appointment_request_id = p_request_id and status <> 'NOT_SCHEDULABLE';
  all_closed := remaining_count = 0;

  update public.appointment_requests
  set not_schedulable_reason = case when all_closed then p_reason else not_schedulable_reason end,
      not_schedulable_detail = case when all_closed then justification else not_schedulable_detail end,
      not_schedulable_guidance = case when all_closed then btrim(p_guidance) else not_schedulable_guidance end,
      not_schedulable_at = case when all_closed then event_time else not_schedulable_at end,
      not_schedulable_by = case when all_closed then p_actor_id else not_schedulable_by end,
      not_schedulable_communication_status = 'PENDING',
      not_schedulable_communication_id = null,
      workflow_status = case when all_closed then 'NAO_AGENDAVEL' else workflow_status end,
      status = case when all_closed then 'CANCELLED' else status end,
      confirmation_status = case when all_closed then 'PENDING' else confirmation_status end,
      completed_by = case when all_closed then p_actor_id else completed_by end,
      completed_at = case when all_closed then event_time else completed_at end
  where id = p_request_id;

  insert into public.appointment_request_history (
    appointment_request_id, actor_id, action, details
  ) values (
    p_request_id,
    p_actor_id,
    'NÃO FOI POSSÍVEL AGENDAR',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'exam_ids', to_jsonb(p_exam_ids),
      'reason', p_reason,
      'justification', justification,
      'guidance', btrim(p_guidance),
      'all_closed', all_closed,
      'actor_id', p_actor_id,
      'actor_name', actor_record.full_name,
      'timestamp', event_time
    )
  );

  return jsonb_build_object('all_closed', all_closed, 'remaining_exams', remaining_count);
end;
$$;
revoke all on function public.mark_appointment_not_schedulable(
  uuid, uuid, uuid, uuid[], text, text, text
) from public, anon, authenticated;
grant execute on function public.mark_appointment_not_schedulable(
  uuid, uuid, uuid, uuid[], text, text, text
) to service_role;
