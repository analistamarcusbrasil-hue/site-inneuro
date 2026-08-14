begin;

create table if not exists public.candidate_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.candidate_accounts is
  'Conta mínima do candidato vinculada ao Supabase Auth. Dados profissionais pertencem a fases futuras.';

drop trigger if exists candidate_accounts_updated_at on public.candidate_accounts;
create trigger candidate_accounts_updated_at
before update on public.candidate_accounts
for each row execute procedure public.set_updated_at();

alter table public.candidate_accounts enable row level security;

drop policy if exists "candidate reads own account" on public.candidate_accounts;
create policy "candidate reads own account"
on public.candidate_accounts
for select
to authenticated
using (id = auth.uid());

drop policy if exists "candidate creates own account" on public.candidate_accounts;
create policy "candidate creates own account"
on public.candidate_accounts
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "candidate updates own account" on public.candidate_accounts;
create policy "candidate updates own account"
on public.candidate_accounts
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

revoke all on public.candidate_accounts from anon;
grant select, insert, update on public.candidate_accounts to authenticated;
grant all on public.candidate_accounts to service_role;

-- O gatilho anterior criava um perfil administrativo com papel editor para
-- todo novo usuário. A partir desta fase, cadastros públicos são direcionados
-- somente para candidate_accounts. Perfis administrativos continuam sendo
-- criados explicitamente pelo fluxo de convite do painel.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_name text;
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'candidate' then
    candidate_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
    if char_length(candidate_name) < 2 then
      candidate_name := 'Candidato';
    end if;

    insert into public.candidate_accounts (id, full_name)
    values (new.id, left(candidate_name, 120))
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

commit;
