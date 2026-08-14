begin;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  protocol text not null unique check (protocol ~ '^FC-[0-9]{8}-[A-HJ-NP-Z2-9]{6}$'),
  name text not null check (char_length(name) between 3 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text check (phone is null or char_length(phone) <= 20),
  category text not null check (category in (
    'QUESTION', 'SUGGESTION', 'PRAISE', 'COMPLAINT',
    'SERVICE', 'INSURANCE', 'FINANCIAL', 'OTHER'
  )),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'NEW' check (status in ('NEW', 'IN_REVIEW', 'ANSWERED', 'CLOSED')),
  email_delivery_status text not null default 'PENDING' check (email_delivery_status in ('PENDING', 'SENT', 'FAILED')),
  consent_given_at timestamptz not null default now(),
  email_attempted_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx
  on public.contact_messages (status, created_at desc);
create index if not exists contact_messages_category_idx
  on public.contact_messages (category, created_at desc);
create index if not exists contact_messages_email_delivery_idx
  on public.contact_messages (email_delivery_status, created_at desc);

drop trigger if exists contact_messages_updated_at on public.contact_messages;
create trigger contact_messages_updated_at before update on public.contact_messages
for each row execute procedure public.set_updated_at();

alter table public.contact_messages enable row level security;

drop policy if exists "staff reads contact messages" on public.contact_messages;
create policy "staff reads contact messages" on public.contact_messages
for select to authenticated using (public.is_staff());

drop policy if exists "staff updates contact messages" on public.contact_messages;
create policy "staff updates contact messages" on public.contact_messages
for update to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, update on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;

create table if not exists public.contact_rate_limits (
  key text primary key check (key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  expires_at timestamptz not null
);

alter table public.contact_rate_limits enable row level security;
revoke all on public.contact_rate_limits from anon, authenticated;
grant all on public.contact_rate_limits to service_role;

create or replace function public.consume_contact_rate_limit(
  p_key text,
  p_limit integer default 5,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  if p_key !~ '^[a-f0-9]{64}$'
    or p_limit < 1
    or p_limit > 20
    or p_window_seconds < 60
    or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.contact_rate_limits (
    key,
    window_started_at,
    attempt_count,
    expires_at
  ) values (
    p_key,
    now(),
    1,
    now() + make_interval(secs => p_window_seconds)
  )
  on conflict (key) do update set
    window_started_at = case
      when contact_rate_limits.expires_at <= now() then now()
      else contact_rate_limits.window_started_at
    end,
    attempt_count = case
      when contact_rate_limits.expires_at <= now() then 1
      else contact_rate_limits.attempt_count + 1
    end,
    expires_at = case
      when contact_rate_limits.expires_at <= now()
        then now() + make_interval(secs => p_window_seconds)
      else contact_rate_limits.expires_at
    end
  returning attempt_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_contact_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_contact_rate_limit(text, integer, integer)
  to service_role;

commit;
