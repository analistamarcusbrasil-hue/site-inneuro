begin;

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  access_token_hash text not null unique,
  patient_name text not null,
  cpf text,
  birth_date date not null,
  phone text not null,
  email text,
  city text,
  responsible_name text,
  service_type text not null check (service_type in ('PARTICULAR', 'INSURANCE', 'SUS')),
  insurance_id uuid references public.health_partners(id) on delete set null,
  insurance_name text,
  insurance_card_number text,
  insurance_card_expiry date,
  insurance_holder_name text,
  sus_cns text,
  sus_authorization_number text,
  sus_regulation_number text,
  sus_request_number text,
  sisreg_code text,
  origin_city text,
  requesting_unit text,
  requesting_professional text,
  authorization_date date,
  authorization_expiry date,
  authorization_pending boolean not null default false,
  preferred_dates date[] not null default '{}',
  preferred_periods text[] not null default '{}',
  notes text,
  status text not null default 'NEW' check (status in (
    'NEW', 'IN_REVIEW', 'DOCUMENT_PENDING', 'AUTHORIZATION_PENDING',
    'AWAITING_CONTACT', 'CONTACTED', 'PARTIALLY_SCHEDULED', 'SCHEDULED',
    'COMPLETED', 'CANCELLED'
  )),
  assigned_to uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_request_exams (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  exam_name text not null,
  modality text,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED')),
  scheduled_date date,
  scheduled_period text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_request_id, exam_id)
);

create table if not exists public.appointment_request_documents (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  document_type text not null check (document_type in (
    'photo_id', 'medical_request', 'sus_authorization',
    'insurance_card_front', 'insurance_card_back', 'other'
  )),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  checked_at timestamptz,
  checked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.appointment_request_history (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists appointment_requests_status_idx on public.appointment_requests(status, created_at desc);
create index if not exists appointment_requests_service_idx on public.appointment_requests(service_type, created_at desc);
create index if not exists appointment_request_exams_request_idx on public.appointment_request_exams(appointment_request_id);
create index if not exists appointment_request_exams_exam_idx on public.appointment_request_exams(exam_id);
create index if not exists appointment_request_documents_request_idx on public.appointment_request_documents(appointment_request_id);
create index if not exists appointment_request_history_request_idx on public.appointment_request_history(appointment_request_id, created_at desc);

drop trigger if exists appointment_requests_updated_at on public.appointment_requests;
create trigger appointment_requests_updated_at before update on public.appointment_requests
for each row execute procedure public.set_updated_at();
drop trigger if exists appointment_request_exams_updated_at on public.appointment_request_exams;
create trigger appointment_request_exams_updated_at before update on public.appointment_request_exams
for each row execute procedure public.set_updated_at();

alter table public.appointment_requests enable row level security;
alter table public.appointment_request_exams enable row level security;
alter table public.appointment_request_documents enable row level security;
alter table public.appointment_request_history enable row level security;

drop policy if exists "staff reads appointment requests" on public.appointment_requests;
create policy "staff reads appointment requests" on public.appointment_requests for select to authenticated using (public.is_staff());
drop policy if exists "staff updates appointment requests" on public.appointment_requests;
create policy "staff updates appointment requests" on public.appointment_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff reads request exams" on public.appointment_request_exams;
create policy "staff reads request exams" on public.appointment_request_exams for select to authenticated using (public.is_staff());
drop policy if exists "staff updates request exams" on public.appointment_request_exams;
create policy "staff updates request exams" on public.appointment_request_exams for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff reads request documents" on public.appointment_request_documents;
create policy "staff reads request documents" on public.appointment_request_documents for select to authenticated using (public.is_staff());
drop policy if exists "staff updates request documents" on public.appointment_request_documents;
create policy "staff updates request documents" on public.appointment_request_documents for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff reads request history" on public.appointment_request_history;
create policy "staff reads request history" on public.appointment_request_history for select to authenticated using (public.is_staff());
drop policy if exists "staff creates request history" on public.appointment_request_history;
create policy "staff creates request history" on public.appointment_request_history for insert to authenticated with check (public.is_staff());

grant select, update on public.appointment_requests, public.appointment_request_exams, public.appointment_request_documents to authenticated;
grant select, insert on public.appointment_request_history to authenticated;

alter table public.preparations
  add column if not exists use_general_schedule boolean not null default true,
  add column if not exists override_days text[],
  add column if not exists override_periods text[],
  add column if not exists schedule_note text;

insert into public.site_settings (key, value)
values (
  'scheduling',
  '{"days":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"periods":["morning","afternoon","evening"],"public_text":"Realizamos exames de segunda a domingo, nos períodos da manhã, tarde e noite, mediante agendamento.","short_text":"Exames todos os dias — manhã, tarde e noite.","note":"A data e o horário serão confirmados pela equipe da INNEURO.","sus_authorization_required":false,"updated_at":"2026-08-06T00:00:00.000Z"}'::jsonb
)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- As modalidades passam a herdar a fonte única. Exceções futuras podem usar
-- override_days, override_periods e schedule_note sem repetir o horário geral.
update public.preparations
set use_general_schedule = true,
    schedules = '[]'::jsonb,
    override_days = null,
    override_periods = null
where use_general_schedule is distinct from true or schedules <> '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scheduling-documents', 'scheduling-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/json']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
