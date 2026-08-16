begin;

alter table public.appointment_requests
  add column if not exists completed_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists confirmation_status text not null default 'NOT_REQUIRED'
    check (confirmation_status in ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED')),
  add column if not exists confirmation_communication_id uuid
    references public.appointment_request_communications(id) on delete set null,
  add column if not exists completion_operation_id uuid;

-- Registros concluídos antes desta evolução permanecem como atendidos. Não há
-- reenvio retroativo nem alteração de dados clínicos/operacionais históricos.
update public.appointment_requests
set
  completed_by = coalesce(completed_by, assigned_to),
  completed_at = coalesce(completed_at, updated_at)
where workflow_status = 'CONCLUIDO';

create unique index if not exists appointment_requests_completion_operation_idx
on public.appointment_requests (completion_operation_id)
where completion_operation_id is not null;

create index if not exists appointment_requests_active_queue_v2_idx
on public.appointment_requests (
  confirmation_status,
  workflow_status,
  documents_received_at desc,
  created_at asc
);

create or replace function public.prepare_appointment_completion(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_schedules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record record;
  actor_record record;
  schedule_item jsonb;
  schedule_exam_id uuid;
  schedule_date date;
  schedule_time time;
  schedule_preparation text;
  schedule_documents text[];
  expected_exams integer;
  updated_exam uuid;
  seen_exams uuid[] := '{}';
  history_exams jsonb := '[]'::jsonb;
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null then
    raise exception using errcode = '22023', message = 'completion_input_invalid';
  end if;
  if jsonb_typeof(p_schedules) <> 'array' or jsonb_array_length(p_schedules) = 0 then
    raise exception using errcode = '22023', message = 'completion_schedules_invalid';
  end if;

  select id, role::text as role, permissions, active, full_name
  into actor_record
  from public.profiles
  where id = p_actor_id;
  if actor_record.id is null
    or not actor_record.active
    or not (
      actor_record.role in ('super_admin', 'admin')
      or 'scheduling.manage' = any(coalesce(actor_record.permissions, '{}'::text[]))
    ) then
    raise exception using errcode = '42501', message = 'scheduling_authorization_required';
  end if;

  select id, workflow_status, assigned_to, completion_operation_id
  into request_record
  from public.appointment_requests
  where id = p_request_id
  for update;
  if request_record.id is null then
    raise exception using errcode = 'P0002', message = 'appointment_request_not_found';
  end if;
  if request_record.completion_operation_id = p_operation_id then
    return jsonb_build_object('duplicate', true, 'status', 'PENDING');
  end if;
  if request_record.workflow_status <> 'AUTORIZADO' then
    raise exception using errcode = '23514', message = 'appointment_not_authorized';
  end if;
  if actor_record.role = 'reception'
    and request_record.assigned_to is not null
    and request_record.assigned_to <> p_actor_id then
    raise exception using errcode = '42501', message = 'appointment_assigned_to_another_attendant';
  end if;

  select count(*)::integer into expected_exams
  from public.appointment_request_exams
  where appointment_request_id = p_request_id;
  if expected_exams <> jsonb_array_length(p_schedules) then
    raise exception using errcode = '22023', message = 'completion_exam_count_mismatch';
  end if;

  for schedule_item in select value from jsonb_array_elements(p_schedules)
  loop
    if jsonb_typeof(schedule_item) <> 'object'
      or jsonb_typeof(schedule_item -> 'documents') <> 'array' then
      raise exception using errcode = '22023', message = 'completion_schedule_invalid';
    end if;
    schedule_exam_id := (schedule_item ->> 'examId')::uuid;
    schedule_date := (schedule_item ->> 'date')::date;
    schedule_time := (schedule_item ->> 'time')::time;
    schedule_preparation := coalesce(schedule_item ->> 'preparation', '');
    select coalesce(array_agg(trim(document_value)), '{}') into schedule_documents
    from jsonb_array_elements_text(schedule_item -> 'documents') as document(document_value);

    if schedule_exam_id = any(seen_exams)
      or char_length(schedule_preparation) > 5000
      or cardinality(schedule_documents) > 20
      or exists (
        select 1 from unnest(schedule_documents) document
        where char_length(trim(document)) not between 1 and 200
      ) then
      raise exception using errcode = '22023', message = 'completion_schedule_invalid';
    end if;
    seen_exams := array_append(seen_exams, schedule_exam_id);

    updated_exam := null;
    update public.appointment_request_exams
    set
      status = 'SCHEDULED',
      scheduled_date = schedule_date,
      scheduled_time = schedule_time,
      scheduled_period = null,
      preparation_text = schedule_preparation,
      documents_to_bring = schedule_documents
    where id = schedule_exam_id
      and appointment_request_id = p_request_id
    returning id into updated_exam;
    if updated_exam is null then
      raise exception using errcode = '22023', message = 'completion_exam_invalid';
    end if;
    history_exams := history_exams || jsonb_build_array(jsonb_build_object(
      'exam_id', schedule_exam_id,
      'date', schedule_date,
      'time', to_char(schedule_time, 'HH24:MI')
    ));
  end loop;

  update public.appointment_requests
  set
    workflow_status = 'CONCLUIDO',
    status = 'SCHEDULED',
    assigned_to = coalesce(assigned_to, p_actor_id),
    claimed_at = coalesce(claimed_at, now()),
    completed_by = p_actor_id,
    completed_at = now(),
    confirmation_status = 'PENDING',
    confirmation_communication_id = null,
    completion_operation_id = p_operation_id,
    documents_received_at = null
  where id = p_request_id;

  insert into public.appointment_request_history (
    appointment_request_id,
    actor_id,
    action,
    details
  ) values (
    p_request_id,
    p_actor_id,
    'Agendamento definido',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'completed_by', p_actor_id,
      'completed_by_name', actor_record.full_name,
      'exams', history_exams
    )
  );

  return jsonb_build_object('duplicate', false, 'status', 'PENDING');
end;
$$;

revoke all on function public.prepare_appointment_completion(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.prepare_appointment_completion(uuid, uuid, uuid, jsonb)
to service_role;

commit;
