alter type public.app_role add value if not exists 'reception';

begin;

alter table public.profiles
  add column if not exists email text,
  add column if not exists active boolean not null default true;

update public.profiles set hr_role = null where role::text = 'reception';

alter table public.profiles
  add constraint reception_has_no_hr_access
  check (role::text <> 'reception' or hr_role is null);

alter table public.appointment_requests
  add column if not exists workflow_status text not null default 'NOVO'
    check (workflow_status in (
      'NOVO', 'EM_ANALISE', 'AGUARDANDO_CONVENIO', 'PENDENCIA',
      'RECUSADO', 'AUTORIZADO', 'CONCLUIDO', 'CANCELADO'
    )),
  add column if not exists claimed_at timestamptz,
  add column if not exists insurer_reference text,
  add column if not exists authorization_number text,
  add column if not exists authorization_valid_until date,
  add column if not exists pending_reason text,
  add column if not exists pending_correction text,
  add column if not exists pending_guidance text,
  add column if not exists documents_received_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists unit_name text not null default 'INNEURO — Santa Rita';

update public.appointment_requests
set workflow_status = case status
  when 'NEW' then 'NOVO'
  when 'IN_REVIEW' then 'EM_ANALISE'
  when 'DOCUMENT_PENDING' then 'PENDENCIA'
  when 'AUTHORIZATION_PENDING' then 'AGUARDANDO_CONVENIO'
  when 'SCHEDULED' then 'CONCLUIDO'
  when 'COMPLETED' then 'CONCLUIDO'
  when 'CANCELLED' then 'CANCELADO'
  else workflow_status
end
where workflow_status = 'NOVO';

alter table public.appointment_request_exams
  add column if not exists scheduled_time time,
  add column if not exists preparation_text text,
  add column if not exists documents_to_bring text[] not null default '{}';

alter table public.appointment_request_documents
  add column if not exists source text not null default 'PATIENT_INITIAL'
    check (source in ('PATIENT_INITIAL', 'PATIENT_CORRECTION', 'STAFF')),
  add column if not exists supersedes_document_id uuid
    references public.appointment_request_documents(id) on delete set null;

create table if not exists public.appointment_request_communications (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  communication_type text not null check (communication_type in (
    'PENDING', 'INSURANCE_REJECTED', 'AUTHORIZED', 'DOCUMENT_RECEIVED',
    'SCHEDULE_CONFIRMED', 'GUIDANCE', 'CUSTOM'
  )),
  recipient_email text not null,
  subject text not null,
  text_body text not null,
  html_body text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  idempotency_key text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_request_patient_tokens (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null default 'PENDING_CORRECTION' check (purpose = 'PENDING_CORRECTION'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists appointment_requests_workflow_queue_idx
  on public.appointment_requests (workflow_status, documents_received_at desc, created_at asc);
create index if not exists appointment_requests_assigned_queue_idx
  on public.appointment_requests (assigned_to, workflow_status, created_at asc);
create index if not exists appointment_communications_request_idx
  on public.appointment_request_communications (appointment_request_id, created_at desc);
create index if not exists appointment_patient_tokens_request_idx
  on public.appointment_request_patient_tokens (appointment_request_id, expires_at desc);

create or replace function public.is_scheduling_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active and role::text in ('super_admin', 'admin', 'reception')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

alter table public.appointment_request_communications enable row level security;
alter table public.appointment_request_patient_tokens enable row level security;

create policy "scheduling staff reads appointment requests"
  on public.appointment_requests for select to authenticated
  using (public.is_scheduling_staff());
create policy "scheduling staff updates appointment requests"
  on public.appointment_requests for update to authenticated
  using (public.is_scheduling_staff()) with check (public.is_scheduling_staff());
create policy "scheduling staff reads request exams"
  on public.appointment_request_exams for select to authenticated
  using (public.is_scheduling_staff());
create policy "scheduling staff updates request exams"
  on public.appointment_request_exams for update to authenticated
  using (public.is_scheduling_staff()) with check (public.is_scheduling_staff());
create policy "scheduling staff reads request documents"
  on public.appointment_request_documents for select to authenticated
  using (public.is_scheduling_staff());
create policy "scheduling staff updates request documents"
  on public.appointment_request_documents for update to authenticated
  using (public.is_scheduling_staff()) with check (public.is_scheduling_staff());
create policy "scheduling staff inserts request documents"
  on public.appointment_request_documents for insert to authenticated
  with check (public.is_scheduling_staff());
create policy "scheduling staff reads request history"
  on public.appointment_request_history for select to authenticated
  using (public.is_scheduling_staff());
create policy "scheduling staff creates request history"
  on public.appointment_request_history for insert to authenticated
  with check (public.is_scheduling_staff() and actor_id = auth.uid());
create policy "scheduling staff reads communications"
  on public.appointment_request_communications for select to authenticated
  using (public.is_scheduling_staff());
create policy "scheduling staff creates communications"
  on public.appointment_request_communications for insert to authenticated
  with check (public.is_scheduling_staff() and created_by = auth.uid());
create policy "scheduling staff updates communications"
  on public.appointment_request_communications for update to authenticated
  using (public.is_scheduling_staff()) with check (public.is_scheduling_staff());
create policy "scheduling staff reads published exams"
  on public.exams for select to authenticated
  using (public.is_scheduling_staff() and active and status = 'published' and deleted_at is null);
create policy "scheduling staff reads published preparations"
  on public.preparations for select to authenticated
  using (public.is_scheduling_staff() and active and status = 'published' and deleted_at is null);
create policy "scheduling staff reads scheduling profiles"
  on public.profiles for select to authenticated
  using (public.is_scheduling_staff() and role::text in ('super_admin', 'admin', 'reception'));
create policy "administrators manage reception profiles"
  on public.profiles for update to authenticated
  using (public.current_app_role() in ('super_admin', 'admin') and role::text = 'reception')
  with check (public.current_app_role() in ('super_admin', 'admin') and role::text = 'reception');

grant execute on function public.is_scheduling_staff() to authenticated;
grant select, update on public.appointment_requests, public.appointment_request_exams,
  public.appointment_request_documents to authenticated;
grant insert on public.appointment_request_documents to authenticated;
grant select, insert on public.appointment_request_history to authenticated;
grant select, insert, update on public.appointment_request_communications to authenticated;
grant select on public.appointment_request_patient_tokens to authenticated;

create trigger appointment_request_communications_updated_at
before update on public.appointment_request_communications
for each row execute procedure public.set_updated_at();

commit;
