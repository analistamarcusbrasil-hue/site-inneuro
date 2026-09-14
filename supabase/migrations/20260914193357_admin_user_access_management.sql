begin;

alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists access_updated_at timestamptz not null default now(),
  add column if not exists access_updated_by uuid references public.profiles(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_deleted_state_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_deleted_state_check check (
        (deleted_at is null and deleted_by is null)
        or (deleted_at is not null and deleted_by is not null and not active)
      );
  end if;
end $$;

create index if not exists profiles_operational_users_idx
  on public.profiles (active, access_updated_at desc)
  where deleted_at is null;

create or replace function public.protect_admin_profile_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_active_super_admins integer;
begin
  if old.deleted_at is not null and (
    new.role is distinct from old.role
    or new.hr_role is distinct from old.hr_role
    or new.access_profile is distinct from old.access_profile
    or new.permissions is distinct from old.permissions
    or new.active is distinct from old.active
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
  ) then
    raise exception 'Um usuário excluído não pode ser alterado';
  end if;

  if new.deleted_at is not null and (new.active or new.deleted_by is null) then
    raise exception 'A exclusão lógica exige usuário inativo e responsável';
  end if;

  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.hr_role is distinct from old.hr_role
    or new.access_profile is distinct from old.access_profile
    or new.permissions is distinct from old.permissions
    or new.active is distinct from old.active
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
  ) then
    raise exception 'A própria conta não pode alterar seus acessos';
  end if;

  if old.active
    and (old.role::text = 'super_admin' or old.access_profile = 'super_admin')
    and (
      not new.active
      or new.deleted_at is not null
      or not (
        new.role::text = 'super_admin'
        or new.access_profile = 'super_admin'
      )
    ) then
    select count(*) into other_active_super_admins
    from public.profiles
    where id <> old.id
      and active
      and deleted_at is null
      and (role::text = 'super_admin' or access_profile = 'super_admin');
    if other_active_super_admins = 0 then
      raise exception 'O último superadministrador ativo deve ser preservado';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_admin_profile_access()
from public, anon, authenticated;

drop trigger if exists protect_admin_profile_access on public.profiles;
create trigger protect_admin_profile_access
before update of role, hr_role, access_profile, permissions, active, deleted_at, deleted_by
on public.profiles
for each row execute function public.protect_admin_profile_access();

create or replace function public.update_admin_user_access(
  p_target_id uuid,
  p_full_name text,
  p_role text,
  p_hr_role text,
  p_access_profile text,
  p_permissions text[],
  p_active boolean,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_profile public.profiles%rowtype;
  next_profile public.profiles%rowtype;
  event_count integer := 0;
begin
  if actor_id is null
    or public.current_app_role() <> 'super_admin'
    or not public.has_admin_permission('users.manage') then
    raise exception using errcode = '42501', message = 'user_manage_required';
  end if;
  if p_target_id = actor_id then
    raise exception using errcode = '42501', message = 'self_user_change_forbidden';
  end if;

  select * into current_profile
  from public.profiles
  where id = p_target_id and deleted_at is null
  for update;
  if current_profile.id is null then
    raise exception using errcode = 'P0002', message = 'admin_user_not_found';
  end if;
  if exists (
    select 1 from public.candidate_accounts where id = p_target_id
  ) then
    raise exception using errcode = '42501', message = 'candidate_account_forbidden';
  end if;
  if current_profile.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'admin_user_concurrent_update';
  end if;
  if p_active is distinct from current_profile.active then
    raise exception using errcode = '22023', message = 'use_status_command';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 120
    or p_role not in ('super_admin', 'admin', 'editor', 'reception')
    or p_access_profile not in (
      'super_admin', 'manager', 'reception', 'hr', 'evaluator',
      'publications', 'attendance', 'custom'
    )
    or (p_hr_role is not null and p_hr_role not in (
      'administrator', 'hr_manager', 'reviewer'
    )) then
    raise exception using errcode = '22023', message = 'invalid_admin_user_access';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      role = p_role::public.app_role,
      hr_role = p_hr_role::public.hr_access_role,
      access_profile = p_access_profile,
      permissions = p_permissions,
      access_updated_at = now(),
      access_updated_by = actor_id
  where id = p_target_id
  returning * into next_profile;

  if current_profile.full_name is distinct from next_profile.full_name then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, before_data, after_data
    ) values (
      actor_id, 'USER_UPDATED', 'profiles', p_target_id::text,
      to_jsonb(current_profile) - array['must_change_password'],
      to_jsonb(next_profile) - array['must_change_password']
    );
    event_count := event_count + 1;
  end if;
  if current_profile.role is distinct from next_profile.role
    or current_profile.hr_role is distinct from next_profile.hr_role
    or current_profile.access_profile is distinct from next_profile.access_profile then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, before_data, after_data
    ) values (
      actor_id, 'USER_ROLE_CHANGED', 'profiles', p_target_id::text,
      to_jsonb(current_profile) - array['must_change_password'],
      to_jsonb(next_profile) - array['must_change_password']
    );
    event_count := event_count + 1;
  end if;
  if current_profile.permissions is distinct from next_profile.permissions then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, before_data, after_data
    ) values (
      actor_id, 'USER_PERMISSIONS_CHANGED', 'profiles', p_target_id::text,
      to_jsonb(current_profile) - array['must_change_password'],
      to_jsonb(next_profile) - array['must_change_password']
    );
    event_count := event_count + 1;
  end if;
  if event_count = 0 then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, before_data, after_data
    ) values (
      actor_id, 'USER_UPDATED', 'profiles', p_target_id::text,
      to_jsonb(current_profile) - array['must_change_password'],
      to_jsonb(next_profile) - array['must_change_password']
    );
  end if;

  return jsonb_build_object(
    'id', next_profile.id,
    'updated_at', next_profile.updated_at
  );
end;
$$;

revoke all on function public.update_admin_user_access(
  uuid, text, text, text, text, text[], boolean, timestamptz
) from public, anon;
grant execute on function public.update_admin_user_access(
  uuid, text, text, text, text, text[], boolean, timestamptz
) to authenticated;

create or replace function public.manage_admin_user_status(
  p_target_id uuid,
  p_command text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_profile public.profiles%rowtype;
  next_profile public.profiles%rowtype;
  active_super_admins integer;
  event_name text;
begin
  if actor_id is null
    or public.current_app_role() <> 'super_admin'
    or not public.has_admin_permission('users.manage') then
    raise exception using errcode = '42501', message = 'user_manage_required';
  end if;
  if p_target_id = actor_id then
    raise exception using errcode = '42501', message = 'self_user_change_forbidden';
  end if;
  if p_command not in ('activate', 'deactivate', 'delete') then
    raise exception using errcode = '22023', message = 'invalid_user_command';
  end if;

  select * into current_profile
  from public.profiles
  where id = p_target_id and deleted_at is null
  for update;
  if current_profile.id is null then
    raise exception using errcode = 'P0002', message = 'admin_user_not_found';
  end if;
  if exists (
    select 1 from public.candidate_accounts where id = p_target_id
  ) then
    raise exception using errcode = '42501', message = 'candidate_account_forbidden';
  end if;
  if current_profile.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'admin_user_concurrent_update';
  end if;

  if p_command in ('deactivate', 'delete')
    and current_profile.active
    and (
      current_profile.role::text = 'super_admin'
      or current_profile.access_profile = 'super_admin'
    ) then
    select count(*) into active_super_admins
    from public.profiles
    where id <> p_target_id
      and active
      and deleted_at is null
      and (role::text = 'super_admin' or access_profile = 'super_admin');
    if active_super_admins = 0 then
      raise exception using errcode = '23514', message = 'last_super_admin';
    end if;
  end if;

  if p_command = 'activate' then
    if current_profile.active then
      raise exception using errcode = '23514', message = 'admin_user_already_active';
    end if;
    update public.profiles
    set active = true,
        access_updated_at = now(),
        access_updated_by = actor_id
    where id = p_target_id
    returning * into next_profile;
    event_name := 'USER_ACTIVATED';
  elsif p_command = 'deactivate' then
    if not current_profile.active then
      raise exception using errcode = '23514', message = 'admin_user_already_inactive';
    end if;
    update public.profiles
    set active = false,
        access_updated_at = now(),
        access_updated_by = actor_id
    where id = p_target_id
    returning * into next_profile;
    event_name := 'USER_DEACTIVATED';
  else
    update public.profiles
    set active = false,
        deleted_at = now(),
        deleted_by = actor_id,
        access_updated_at = now(),
        access_updated_by = actor_id
    where id = p_target_id
    returning * into next_profile;
    event_name := 'USER_DELETED';
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id,
    event_name,
    'profiles',
    p_target_id::text,
    jsonb_build_object(
      'full_name', current_profile.full_name,
      'email', current_profile.email,
      'access_profile', current_profile.access_profile,
      'permissions', current_profile.permissions,
      'active', current_profile.active,
      'deleted_at', current_profile.deleted_at
    ),
    jsonb_build_object(
      'full_name', next_profile.full_name,
      'email', next_profile.email,
      'access_profile', next_profile.access_profile,
      'permissions', next_profile.permissions,
      'active', next_profile.active,
      'deleted_at', next_profile.deleted_at
    )
  );

  return jsonb_build_object(
    'id', next_profile.id,
    'active', next_profile.active,
    'deleted_at', next_profile.deleted_at,
    'event', event_name
  );
end;
$$;

revoke all on function public.manage_admin_user_status(uuid, text, timestamptz)
from public, anon;
grant execute on function public.manage_admin_user_status(uuid, text, timestamptz)
to authenticated;

commit;
