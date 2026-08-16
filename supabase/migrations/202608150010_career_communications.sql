begin;

create table if not exists public.career_communications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidate_accounts(id) on delete restrict,
  application_id uuid references public.career_job_applications(id) on delete restrict,
  job_id uuid references public.career_jobs(id) on delete restrict,
  type text not null check (type in (
    'APPLICATION_RECEIVED',
    'UNDER_REVIEW',
    'NEXT_STAGE',
    'INTERVIEW_INVITE',
    'INTERVIEW_REMINDER',
    'APPROVED',
    'TALENT_POOL',
    'REJECTED',
    'PROCESS_CLOSED',
    'CUSTOM_MESSAGE',
    'INTERNAL_NEW_APPLICATION',
    'PASSWORD_RECOVERY'
  )),
  template_key text not null check (template_key = type),
  recipient_kind text not null check (recipient_kind in ('candidate', 'internal')),
  recipient_email text not null check (
    char_length(trim(recipient_email)) between 5 and 254
    and recipient_email !~ E'[\\r\\n]'
  ),
  subject text not null check (
    char_length(trim(subject)) between 3 and 160
    and subject !~ E'[\\r\\n]'
  ),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  idempotency_key text check (
    idempotency_key is null
    or char_length(idempotency_key) between 8 and 200
  ),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error_code text check (
    last_error_code is null
    or char_length(last_error_code) between 3 and 80
  ),
  triggered_by text not null default 'system'
    check (triggered_by in ('candidate', 'admin', 'system')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'SENT' and sent_at is not null and failed_at is null)
    or (status = 'FAILED' and sent_at is null and failed_at is not null)
    or (status not in ('SENT', 'FAILED') and sent_at is null and failed_at is null)
  )
);

create unique index if not exists career_communications_idempotency_idx
on public.career_communications (idempotency_key)
where idempotency_key is not null;

create index if not exists career_communications_application_idx
on public.career_communications (application_id, created_at desc);

create index if not exists career_communications_candidate_idx
on public.career_communications (candidate_id, created_at desc);

create index if not exists career_communications_outbox_idx
on public.career_communications (status, created_at)
where status in ('PENDING', 'FAILED');

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'career_communications_updated_at'
      and tgrelid = 'public.career_communications'::regclass
  ) then
    create trigger career_communications_updated_at
    before update on public.career_communications
    for each row execute procedure public.set_updated_at();
  end if;
end
$$;

create table if not exists public.career_communication_events (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null
    references public.career_communications(id) on delete cascade,
  event_type text not null check (event_type in (
    'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'RETRY', 'CANCELLED'
  )),
  error_code text check (
    error_code is null or char_length(error_code) between 3 and 80
  ),
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists career_communication_events_history_idx
on public.career_communication_events (communication_id, created_at desc);

alter table public.career_job_applications
add column if not exists candidate_stage text not null default 'registered'
  check (candidate_stage in (
    'registered',
    'screening',
    'interview',
    'evaluation',
    'finalists',
    'selected',
    'talent_pool',
    'not_selected'
  ));

alter table public.career_job_applications
add column if not exists stage_updated_at timestamptz not null default now();

create or replace function public.sync_career_application_candidate_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.career_job_applications
  set candidate_stage = new.stage, stage_updated_at = now()
  where id = new.application_id;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'career_selection_candidate_public_stage'
      and tgrelid = 'public.career_selection_process_candidates'::regclass
  ) then
    create trigger career_selection_candidate_public_stage
    after insert or update of stage
    on public.career_selection_process_candidates
    for each row execute procedure public.sync_career_application_candidate_stage();
  end if;
end
$$;

update public.career_job_applications application
set
  candidate_stage = (
    select participant.stage
    from public.career_selection_process_candidates participant
    where participant.application_id = application.id
    order by participant.updated_at desc
    limit 1
  ),
  stage_updated_at = (
    select participant.updated_at
    from public.career_selection_process_candidates participant
    where participant.application_id = application.id
    order by participant.updated_at desc
    limit 1
  )
where exists (
  select 1
  from public.career_selection_process_candidates participant
  where participant.application_id = application.id
);

insert into public.career_communications (
  candidate_id,
  application_id,
  job_id,
  type,
  template_key,
  recipient_kind,
  recipient_email,
  subject,
  status,
  payload,
  attempt_count,
  idempotency_key,
  last_attempt_at,
  sent_at,
  failed_at,
  last_error_code,
  triggered_by,
  created_at,
  updated_at
)
select
  application.candidate_id,
  notification.application_id,
  application.job_id,
  'INTERNAL_NEW_APPLICATION',
  'INTERNAL_NEW_APPLICATION',
  'internal',
  notification.recipient_email,
  '[CARREIRAS] Nova candidatura',
  case notification.status
    when 'sent' then 'SENT'
    when 'failed' then 'FAILED'
    else 'PENDING'
  end,
  jsonb_build_object('migrated_from', 'career_application_notifications'),
  least(notification.attempt_count, 3),
  'legacy-application-notification:' || notification.application_id::text,
  notification.last_attempt_at,
  case
    when notification.status = 'sent'
      then coalesce(notification.sent_at, notification.updated_at)
    else null
  end,
  case when notification.status = 'failed' then notification.updated_at else null end,
  notification.last_error_code,
  'system',
  notification.created_at,
  notification.updated_at
from public.career_application_notifications notification
join public.career_job_applications application
  on application.id = notification.application_id
on conflict (idempotency_key) where idempotency_key is not null do nothing;

alter table public.career_communications enable row level security;
alter table public.career_communication_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'career_communications'
      and policyname = 'hr manages career communications'
  ) then
    create policy "hr manages career communications"
    on public.career_communications for all to authenticated
    using (public.can_manage_hr())
    with check (public.can_manage_hr());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'career_communication_events'
      and policyname = 'hr reads career communication events'
  ) then
    create policy "hr reads career communication events"
    on public.career_communication_events for select to authenticated
    using (public.can_manage_hr());
  end if;
end
$$;

grant select, insert, update on public.career_communications to authenticated;
grant select on public.career_communication_events to authenticated;
grant all on public.career_communications to service_role;
grant all on public.career_communication_events to service_role;

create or replace function public.claim_career_communication(
  p_communication_id uuid
)
returns setof public.career_communications
language sql
security definer
set search_path = public
as $$
  update public.career_communications
  set
    status = 'PROCESSING',
    attempt_count = attempt_count + 1,
    last_attempt_at = now(),
    sent_at = null,
    failed_at = null,
    last_error_code = null,
    updated_at = now()
  where id = p_communication_id
    and status in ('PENDING', 'FAILED')
    and attempt_count < 3
  returning *;
$$;

revoke all on function public.claim_career_communication(uuid)
from public, anon, authenticated;
grant execute on function public.claim_career_communication(uuid)
to service_role;

create or replace function public.get_candidate_recovery_target(p_email text)
returns table (
  candidate_id uuid,
  recipient_email text,
  candidate_name text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select account.id, users.email::text, account.full_name
  from public.candidate_accounts account
  join auth.users users on users.id = account.id
  where lower(users.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.get_candidate_recovery_target(text)
from public, anon, authenticated;
grant execute on function public.get_candidate_recovery_target(text)
to service_role;

revoke all on function public.sync_career_application_candidate_stage()
from public, anon, authenticated;

comment on table public.career_communications is
  'Outbox de comunicações do Carreiras. SENT significa aceite pelo servidor SMTP.';
comment on table public.career_communication_events is
  'Histórico operacional da outbox, sem conteúdo de mensagem ou credenciais.';
comment on table public.career_application_notifications is
  'Tabela legada preservada. Novos envios utilizam career_communications.';

commit;
