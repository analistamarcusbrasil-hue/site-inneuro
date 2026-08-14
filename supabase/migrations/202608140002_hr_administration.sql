begin;

do $$
begin
  create type public.hr_access_role as enum (
    'administrator',
    'hr_manager',
    'reviewer'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.profiles
add column if not exists hr_role public.hr_access_role;

comment on column public.profiles.hr_role is
  'Permissão adicional para o módulo RH. Candidatos não possuem perfil administrativo.';

create or replace function public.current_hr_role()
returns public.hr_access_role
language sql
stable
security definer
set search_path = public
as $$
  select case
    when role in ('super_admin', 'admin')
      then 'administrator'::public.hr_access_role
    else hr_role
  end
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.has_hr_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_hr_role() is not null, false);
$$;

create or replace function public.can_manage_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_hr_role() in ('administrator', 'hr_manager'),
    false
  );
$$;

drop policy if exists "hr managers read candidate accounts"
on public.candidate_accounts;
create policy "hr managers read candidate accounts"
on public.candidate_accounts
for select
to authenticated
using (public.can_manage_hr());

grant execute on function public.current_hr_role() to authenticated;
grant execute on function public.has_hr_access() to authenticated;
grant execute on function public.can_manage_hr() to authenticated;

commit;
