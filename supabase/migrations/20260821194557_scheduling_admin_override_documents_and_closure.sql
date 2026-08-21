begin;

alter table public.appointment_request_documents
  add column if not exists preview_storage_path text,
  add column if not exists preview_mime_type text,
  add column if not exists preview_file_size bigint;

alter table public.appointment_request_documents
  drop constraint if exists appointment_request_documents_file_size_check,
  drop constraint if exists appointment_request_documents_preview_mime_type_check,
  drop constraint if exists appointment_request_documents_preview_file_size_check;
alter table public.appointment_request_documents
  add constraint appointment_request_documents_file_size_check
    check (file_size > 0 and file_size <= 15728640),
  add constraint appointment_request_documents_preview_mime_type_check
    check (preview_mime_type is null or preview_mime_type = 'image/webp'),
  add constraint appointment_request_documents_preview_file_size_check
    check (
      (preview_storage_path is null and preview_mime_type is null and preview_file_size is null)
      or (
        preview_storage_path is not null
        and preview_mime_type = 'image/webp'
        and preview_file_size between 1 and 3145728
      )
    );
create unique index if not exists appointment_request_documents_preview_path_idx
  on public.appointment_request_documents (preview_storage_path)
  where preview_storage_path is not null;

alter table public.appointment_requests
  add column if not exists not_schedulable_reason text,
  add column if not exists not_schedulable_detail text,
  add column if not exists not_schedulable_guidance text,
  add column if not exists not_schedulable_at timestamptz,
  add column if not exists not_schedulable_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists not_schedulable_communication_status text
    not null default 'NOT_REQUIRED',
  add column if not exists not_schedulable_communication_id uuid
    references public.appointment_request_communications(id) on delete set null;

alter table public.appointment_requests
  drop constraint if exists appointment_requests_workflow_status_check,
  drop constraint if exists appointment_requests_not_schedulable_reason_check,
  drop constraint if exists appointment_requests_not_schedulable_communication_status_check;
alter table public.appointment_requests
  add constraint appointment_requests_workflow_status_check check (
    workflow_status in (
      'NOVO', 'EM_ANALISE', 'AGUARDANDO_CONVENIO', 'PENDENCIA',
      'RECUSADO', 'AUTORIZADO', 'NAO_AGENDAVEL', 'CONCLUIDO', 'CANCELADO'
    )
  ),
  add constraint appointment_requests_not_schedulable_reason_check check (
    not_schedulable_reason is null or not_schedulable_reason in (
      'clinic_does_not_offer', 'insurance_not_covered',
      'insurance_not_authorized', 'contract_not_covered', 'other'
    )
  ),
  add constraint appointment_requests_not_schedulable_communication_status_check
    check (
      not_schedulable_communication_status in (
        'NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED'
      )
    );

alter table public.appointment_request_exams
  add column if not exists not_schedulable_reason text,
  add column if not exists not_schedulable_detail text,
  add column if not exists not_schedulable_guidance text,
  add column if not exists not_schedulable_at timestamptz,
  add column if not exists not_schedulable_by uuid
    references public.profiles(id) on delete set null;
alter table public.appointment_request_exams
  drop constraint if exists appointment_request_exams_status_check,
  drop constraint if exists appointment_request_exams_not_schedulable_reason_check;
alter table public.appointment_request_exams
  add constraint appointment_request_exams_status_check check (
    status in (
      'REQUESTED', 'NOT_SCHEDULABLE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'
    )
  ),
  add constraint appointment_request_exams_not_schedulable_reason_check check (
    not_schedulable_reason is null or not_schedulable_reason in (
      'clinic_does_not_offer', 'insurance_not_covered',
      'insurance_not_authorized', 'contract_not_covered', 'other'
    )
  );
create index if not exists appointment_request_exams_open_idx
  on public.appointment_request_exams (appointment_request_id, status);

alter table public.appointment_request_communications
  drop constraint if exists appointment_request_communications_communication_type_check;
alter table public.appointment_request_communications
  add constraint appointment_request_communications_communication_type_check check (
    communication_type in (
      'PENDING', 'INSURANCE_REJECTED', 'AUTHORIZED', 'DOCUMENT_RECEIVED',
      'SCHEDULE_CONFIRMED', 'NOT_SCHEDULABLE', 'GUIDANCE', 'CUSTOM'
    )
  );

create schema if not exists private;
create or replace function private.can_override_scheduling_assignment(
  p_actor_id uuid
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
    where profile.id = p_actor_id
      and profile.active
      and (
        profile.role::text in ('super_admin', 'admin')
        or profile.access_profile in ('super_admin', 'manager')
      )
  );
$$;
revoke all on function private.can_override_scheduling_assignment(uuid)
from public, anon, authenticated;

create or replace function public.enforce_new_appointment_contact()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  phone_digits text;
  normalized_email text;
begin
  phone_digits := regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g');
  if left(phone_digits, 2) = '55' and char_length(phone_digits) in (12, 13) then
    phone_digits := substr(phone_digits, 3);
  end if;
  normalized_email := lower(btrim(coalesce(new.email, '')));
  if phone_digits ~ '^([0-9])\1+$'
    or phone_digits !~ '^[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' then
    raise exception using errcode = '23514', message = 'valid_whatsapp_required';
  end if;
  if char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '23514', message = 'valid_email_required';
  end if;
  new.phone := phone_digits;
  new.email := normalized_email;
  return new;
end;
$$;
revoke execute on function public.enforce_new_appointment_contact()
from public, anon, authenticated;
drop trigger if exists appointment_requests_require_new_contact
on public.appointment_requests;
create trigger appointment_requests_require_new_contact
before insert on public.appointment_requests
for each row execute function public.enforce_new_appointment_contact();

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
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null
    or coalesce(cardinality(p_exam_ids), 0) = 0
    or p_reason not in (
      'clinic_does_not_offer', 'insurance_not_covered',
      'insurance_not_authorized', 'contract_not_covered', 'other'
    )
    or char_length(btrim(coalesce(p_guidance, ''))) not between 1 and 1600
    or (p_reason = 'other' and char_length(btrim(coalesce(p_detail, ''))) not between 1 and 800)
    or char_length(coalesce(p_detail, '')) > 800 then
    raise exception using errcode = '22023', message = 'not_schedulable_input_invalid';
  end if;

  select id, role::text as role, access_profile, permissions, active, full_name
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

  select id, assigned_to, workflow_status
  into request_record
  from public.appointment_requests
  where id = p_request_id
  for update;
  if request_record.id is null then
    raise exception using errcode = 'P0002', message = 'appointment_request_not_found';
  end if;
  if request_record.assigned_to is not null
    and request_record.assigned_to <> p_actor_id
    and not private.can_override_scheduling_assignment(p_actor_id) then
    raise exception using errcode = '42501', message = 'appointment_assigned_to_another_attendant';
  end if;
  if request_record.workflow_status in ('CONCLUIDO', 'CANCELADO', 'NAO_AGENDAVEL') then
    raise exception using errcode = '23514', message = 'appointment_already_closed';
  end if;

  select count(*)::integer
  into selected_count
  from public.appointment_request_exams exam
  where exam.appointment_request_id = p_request_id
    and exam.id = any(p_exam_ids)
    and exam.status <> 'NOT_SCHEDULABLE';
  if selected_count <> cardinality(p_exam_ids)
    or selected_count <> (
      select count(distinct exam_id) from unnest(p_exam_ids) exam_id
    ) then
    raise exception using errcode = '22023', message = 'not_schedulable_exams_invalid';
  end if;

  update public.appointment_request_exams
  set
    status = 'NOT_SCHEDULABLE',
    not_schedulable_reason = p_reason,
    not_schedulable_detail = nullif(btrim(coalesce(p_detail, '')), ''),
    not_schedulable_guidance = btrim(p_guidance),
    not_schedulable_at = now(),
    not_schedulable_by = p_actor_id
  where appointment_request_id = p_request_id
    and id = any(p_exam_ids);

  select count(*)::integer
  into remaining_count
  from public.appointment_request_exams
  where appointment_request_id = p_request_id
    and status <> 'NOT_SCHEDULABLE';
  all_closed := remaining_count = 0;

  update public.appointment_requests
  set
    not_schedulable_reason = case when all_closed then p_reason else not_schedulable_reason end,
    not_schedulable_detail = case
      when all_closed then nullif(btrim(coalesce(p_detail, '')), '')
      else not_schedulable_detail
    end,
    not_schedulable_guidance = case
      when all_closed then btrim(p_guidance)
      else not_schedulable_guidance
    end,
    not_schedulable_at = case when all_closed then now() else not_schedulable_at end,
    not_schedulable_by = case when all_closed then p_actor_id else not_schedulable_by end,
    not_schedulable_communication_status = 'PENDING',
    not_schedulable_communication_id = null,
    workflow_status = case when all_closed then 'NAO_AGENDAVEL' else workflow_status end,
    status = case when all_closed then 'CANCELLED' else status end,
    confirmation_status = case when all_closed then 'PENDING' else confirmation_status end,
    completed_by = case when all_closed then p_actor_id else completed_by end,
    completed_at = case when all_closed then now() else completed_at end
  where id = p_request_id;

  insert into public.appointment_request_history (
    appointment_request_id, actor_id, action, details
  ) values (
    p_request_id,
    p_actor_id,
    'Exame marcado como não agendável',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'exam_ids', to_jsonb(p_exam_ids),
      'reason', p_reason,
      'all_closed', all_closed,
      'actor_name', actor_record.full_name,
      'administrative_override',
        request_record.assigned_to is not null
        and request_record.assigned_to <> p_actor_id
        and private.can_override_scheduling_assignment(p_actor_id)
    )
  );

  return jsonb_build_object(
    'all_closed', all_closed,
    'remaining_exams', remaining_count
  );
end;
$$;
revoke all on function public.mark_appointment_not_schedulable(
  uuid, uuid, uuid, uuid[], text, text, text
) from public, anon, authenticated;
grant execute on function public.mark_appointment_not_schedulable(
  uuid, uuid, uuid, uuid[], text, text, text
) to service_role;

create or replace function public.prepare_appointment_completion(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation_id uuid,
  p_schedules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
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
  seen_exams uuid[] := '{}'::uuid[];
  history_exams jsonb := '[]'::jsonb;
begin
  if p_request_id is null or p_actor_id is null or p_operation_id is null then
    raise exception using errcode = '22023', message = 'completion_input_invalid';
  end if;
  if jsonb_typeof(p_schedules) <> 'array'
    or jsonb_array_length(p_schedules) = 0 then
    raise exception using errcode = '22023', message = 'completion_schedules_invalid';
  end if;

  select id, role::text as role, access_profile, permissions, active, full_name
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
  if request_record.assigned_to is not null
    and request_record.assigned_to <> p_actor_id
    and not private.can_override_scheduling_assignment(p_actor_id) then
    raise exception using errcode = '42501', message = 'appointment_assigned_to_another_attendant';
  end if;

  select count(*)::integer into expected_exams
  from public.appointment_request_exams
  where appointment_request_id = p_request_id
    and status <> 'NOT_SCHEDULABLE';
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
    select coalesce(array_agg(trim(document_value)), '{}'::text[])
    into schedule_documents
    from jsonb_array_elements_text(schedule_item -> 'documents')
      as document(document_value);

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
      and status <> 'NOT_SCHEDULABLE'
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
    appointment_request_id, actor_id, action, details
  ) values (
    p_request_id,
    p_actor_id,
    'Agendamento definido',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'completed_by', p_actor_id,
      'completed_by_name', actor_record.full_name,
      'actor_name', actor_record.full_name,
      'administrative_override',
        request_record.assigned_to is not null
        and request_record.assigned_to <> p_actor_id
        and private.can_override_scheduling_assignment(p_actor_id),
      'exams', history_exams
    )
  );

  return jsonb_build_object('duplicate', false, 'status', 'PENDING');
end;
$$;
revoke all on function public.prepare_appointment_completion(
  uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.prepare_appointment_completion(
  uuid, uuid, uuid, jsonb
) to service_role;

commit;
