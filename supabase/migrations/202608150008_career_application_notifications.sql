begin;

create table if not exists public.career_application_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique
    references public.career_job_applications(id) on delete cascade,
  recipient_email text not null
    check (char_length(trim(recipient_email)) between 5 and 254),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error_code text check (
    last_error_code is null
    or last_error_code in ('email_not_configured', 'delivery_failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index if not exists career_application_notifications_status_idx
on public.career_application_notifications (status, created_at desc);

drop trigger if exists career_application_notifications_updated_at
on public.career_application_notifications;
create trigger career_application_notifications_updated_at
before update on public.career_application_notifications
for each row execute procedure public.set_updated_at();

alter table public.career_application_notifications enable row level security;

create policy "hr reads application notification status"
on public.career_application_notifications for select to authenticated
using (public.can_manage_hr());

grant select on public.career_application_notifications to authenticated;
grant all on public.career_application_notifications to service_role;

comment on table public.career_application_notifications is
  'Controle operacional da notificação de novas candidaturas, sem armazenar currículo no e-mail.';

commit;
