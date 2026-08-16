begin;

alter table public.profiles
  add column if not exists access_profile text,
  add column if not exists permissions text[],
  add column if not exists must_change_password boolean not null default false,
  add column if not exists last_login_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_access_profile_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_access_profile_check
      check (access_profile in (
        'super_admin', 'manager', 'reception', 'hr',
        'publications', 'attendance', 'custom'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_permissions_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_permissions_check
      check (
        permissions <@ array[
          'publications.view', 'publications.edit', 'publications.publish',
          'hr.view', 'hr.manage', 'scheduling.view', 'scheduling.manage',
          'contact.view', 'contact.manage', 'users.manage', 'audit.view',
          'settings.manage'
        ]::text[]
        and (
          not ('publications.edit' = any(permissions))
          or 'publications.view' = any(permissions)
        )
        and (
          not ('publications.publish' = any(permissions))
          or (
            'publications.view' = any(permissions)
            and 'publications.edit' = any(permissions)
          )
        )
        and (
          not ('hr.manage' = any(permissions))
          or 'hr.view' = any(permissions)
        )
        and (
          not ('scheduling.manage' = any(permissions))
          or 'scheduling.view' = any(permissions)
        )
        and (
          not ('contact.manage' = any(permissions))
          or 'contact.view' = any(permissions)
        )
      );
  end if;
end $$;

update public.profiles
set access_profile = case
  when role::text = 'super_admin' then 'super_admin'
  when role::text = 'admin' then 'manager'
  when role::text = 'reception' then 'reception'
  when hr_role is not null then 'hr'
  else 'publications'
end
where access_profile is null;

update public.profiles
set permissions = case
  when access_profile = 'super_admin' then array[
    'publications.view', 'publications.edit', 'publications.publish',
    'hr.view', 'hr.manage', 'scheduling.view', 'scheduling.manage',
    'contact.view', 'contact.manage', 'users.manage', 'audit.view',
    'settings.manage'
  ]
  when access_profile = 'manager' then array[
    'publications.view', 'publications.edit', 'publications.publish',
    'hr.view', 'hr.manage', 'scheduling.view', 'scheduling.manage',
    'contact.view', 'contact.manage', 'settings.manage'
  ]
  when access_profile = 'reception'
    then array['scheduling.view', 'scheduling.manage']
  when access_profile = 'hr' then array['hr.view', 'hr.manage']
  when access_profile = 'publications' and role::text = 'editor'
    then array['publications.view', 'publications.edit']
  when access_profile = 'publications' then array[
    'publications.view', 'publications.edit', 'publications.publish'
  ]
  when access_profile = 'attendance'
    then array['contact.view', 'contact.manage']
  else array[]::text[]
end
where permissions is null;

alter table public.profiles
  alter column access_profile set default 'publications',
  alter column access_profile set not null,
  alter column permissions set default array[]::text[],
  alter column permissions set not null;

create or replace function public.current_admin_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when not active then array[]::text[]
        when role::text = 'super_admin' or access_profile = 'super_admin'
          then array[
            'publications.view', 'publications.edit', 'publications.publish',
            'hr.view', 'hr.manage', 'scheduling.view', 'scheduling.manage',
            'contact.view', 'contact.manage', 'users.manage', 'audit.view',
            'settings.manage'
          ]
        else permissions
      end
      from public.profiles
      where id = auth.uid()
    ),
    array[]::text[]
  );
$$;

create or replace function public.has_admin_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(requested_permission = any(public.current_admin_permissions()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_permission('publications.view');
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_permission('settings.manage');
$$;

create or replace function public.can_access_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_permission('hr.view');
$$;

create or replace function public.can_manage_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_permission('hr.manage');
$$;

create or replace function public.is_scheduling_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_permission('scheduling.view');
$$;

create or replace function public.can_manage_scheduling()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_permission('scheduling.manage');
$$;

create or replace function public.protect_admin_profile_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_active_super_admins integer;
begin
  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.hr_role is distinct from old.hr_role
    or new.access_profile is distinct from old.access_profile
    or new.permissions is distinct from old.permissions
    or new.active is distinct from old.active
  ) then
    raise exception 'A própria conta não pode alterar seus acessos';
  end if;

  if old.active
    and (old.role::text = 'super_admin' or old.access_profile = 'super_admin')
    and (
      not new.active
      or not (
        new.role::text = 'super_admin'
        or new.access_profile = 'super_admin'
      )
    ) then
    select count(*) into other_active_super_admins
    from public.profiles
    where id <> old.id
      and active
      and (role::text = 'super_admin' or access_profile = 'super_admin');
    if other_active_super_admins = 0 then
      raise exception 'O último superadministrador ativo deve ser preservado';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_profile_access on public.profiles;
create trigger protect_admin_profile_access
before update of role, hr_role, access_profile, permissions, active
on public.profiles
for each row execute procedure public.protect_admin_profile_access();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, email, role, access_profile, permissions
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'editor',
    'publications',
    array['publications.view', 'publications.edit']
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "profile own read" on public.profiles;
drop policy if exists "super admin manages profiles" on public.profiles;
drop policy if exists "scheduling staff reads scheduling profiles" on public.profiles;
drop policy if exists "administrators manage reception profiles" on public.profiles;
create policy "authorized profiles read"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.has_admin_permission('users.manage')
  or public.has_admin_permission('audit.view')
  or (
    public.has_admin_permission('scheduling.view')
    and 'scheduling.view' = any(permissions)
  )
  or (
    public.has_admin_permission('hr.view')
    and 'hr.view' = any(permissions)
  )
);
create policy "super administrators manage profiles"
on public.profiles for all to authenticated
using (
  public.has_admin_permission('users.manage')
  and public.current_app_role() = 'super_admin'
)
with check (
  public.has_admin_permission('users.manage')
  and public.current_app_role() = 'super_admin'
);

drop policy if exists "super admin reads audit" on public.audit_logs;
drop policy if exists "staff writes audit" on public.audit_logs;
create policy "authorized administrators read audit"
on public.audit_logs for select to authenticated
using (public.has_admin_permission('audit.view'));
create policy "active administrators write own audit"
on public.audit_logs for insert to authenticated
with check (
  actor_id = auth.uid()
  and cardinality(public.current_admin_permissions()) > 0
);

drop policy if exists "staff reads contact messages" on public.contact_messages;
drop policy if exists "staff updates contact messages" on public.contact_messages;
create policy "contact staff reads messages"
on public.contact_messages for select to authenticated
using (public.has_admin_permission('contact.view'));
create policy "contact managers update messages"
on public.contact_messages for update to authenticated
using (public.has_admin_permission('contact.manage'))
with check (public.has_admin_permission('contact.manage'));

drop policy if exists "scheduling staff reads appointment requests" on public.appointment_requests;
drop policy if exists "scheduling staff updates appointment requests" on public.appointment_requests;
drop policy if exists "staff reads appointment requests" on public.appointment_requests;
drop policy if exists "staff updates appointment requests" on public.appointment_requests;
create policy "scheduling viewers read appointment requests"
on public.appointment_requests for select to authenticated
using (public.has_admin_permission('scheduling.view'));
create policy "scheduling managers update appointment requests"
on public.appointment_requests for update to authenticated
using (public.has_admin_permission('scheduling.manage'))
with check (public.has_admin_permission('scheduling.manage'));

drop policy if exists "scheduling staff reads request exams" on public.appointment_request_exams;
drop policy if exists "scheduling staff updates request exams" on public.appointment_request_exams;
drop policy if exists "staff reads request exams" on public.appointment_request_exams;
drop policy if exists "staff updates request exams" on public.appointment_request_exams;
create policy "scheduling viewers read request exams"
on public.appointment_request_exams for select to authenticated
using (public.has_admin_permission('scheduling.view'));
create policy "scheduling managers update request exams"
on public.appointment_request_exams for update to authenticated
using (public.has_admin_permission('scheduling.manage'))
with check (public.has_admin_permission('scheduling.manage'));

drop policy if exists "scheduling staff reads request documents" on public.appointment_request_documents;
drop policy if exists "scheduling staff updates request documents" on public.appointment_request_documents;
drop policy if exists "scheduling staff inserts request documents" on public.appointment_request_documents;
drop policy if exists "staff reads request documents" on public.appointment_request_documents;
drop policy if exists "staff updates request documents" on public.appointment_request_documents;
create policy "scheduling viewers read request documents"
on public.appointment_request_documents for select to authenticated
using (public.has_admin_permission('scheduling.view'));
create policy "scheduling managers update request documents"
on public.appointment_request_documents for update to authenticated
using (public.has_admin_permission('scheduling.manage'))
with check (public.has_admin_permission('scheduling.manage'));
create policy "scheduling managers insert request documents"
on public.appointment_request_documents for insert to authenticated
with check (public.has_admin_permission('scheduling.manage'));

drop policy if exists "scheduling staff reads request history" on public.appointment_request_history;
drop policy if exists "scheduling staff creates request history" on public.appointment_request_history;
drop policy if exists "staff reads request history" on public.appointment_request_history;
drop policy if exists "staff creates request history" on public.appointment_request_history;
create policy "scheduling viewers read request history"
on public.appointment_request_history for select to authenticated
using (public.has_admin_permission('scheduling.view'));
create policy "scheduling managers create request history"
on public.appointment_request_history for insert to authenticated
with check (
  public.has_admin_permission('scheduling.manage')
  and actor_id = auth.uid()
);

drop policy if exists "scheduling staff reads communications" on public.appointment_request_communications;
drop policy if exists "scheduling staff creates communications" on public.appointment_request_communications;
drop policy if exists "scheduling staff updates communications" on public.appointment_request_communications;
create policy "scheduling viewers read communications"
on public.appointment_request_communications for select to authenticated
using (public.has_admin_permission('scheduling.view'));
create policy "scheduling managers create communications"
on public.appointment_request_communications for insert to authenticated
with check (
  public.has_admin_permission('scheduling.manage')
  and created_by = auth.uid()
);
create policy "scheduling managers update communications"
on public.appointment_request_communications for update to authenticated
using (public.has_admin_permission('scheduling.manage'))
with check (public.has_admin_permission('scheduling.manage'));

drop policy if exists "staff reads settings" on public.site_settings;
drop policy if exists "managers create settings" on public.site_settings;
drop policy if exists "managers update settings" on public.site_settings;
create policy "authorized administrators read settings"
on public.site_settings for select to authenticated
using (
  is_public
  or public.has_admin_permission('settings.manage')
  or public.has_admin_permission('publications.view')
  or public.has_admin_permission('scheduling.view')
);
create policy "settings managers create settings"
on public.site_settings for insert to authenticated
with check (public.has_admin_permission('settings.manage') and updated_by = auth.uid());
create policy "settings managers update settings"
on public.site_settings for update to authenticated
using (public.has_admin_permission('settings.manage'))
with check (public.has_admin_permission('settings.manage') and updated_by = auth.uid());

drop policy if exists "staff reads media" on public.media_assets;
drop policy if exists "staff uploads media" on public.media_assets;
drop policy if exists "staff updates media" on public.media_assets;
drop policy if exists "super admin deletes media" on public.media_assets;
create policy "publication viewers read media"
on public.media_assets for select to authenticated
using (public.has_admin_permission('publications.view'));
create policy "publication editors upload media"
on public.media_assets for insert to authenticated
with check (
  public.has_admin_permission('publications.edit')
  and uploaded_by = auth.uid()
);
create policy "publication editors update media"
on public.media_assets for update to authenticated
using (public.has_admin_permission('publications.edit'))
with check (public.has_admin_permission('publications.edit'));
create policy "publication publishers delete media"
on public.media_assets for delete to authenticated
using (public.has_admin_permission('publications.publish'));

drop policy if exists "staff uploads site media" on storage.objects;
drop policy if exists "staff updates site media" on storage.objects;
drop policy if exists "super admin deletes site media" on storage.objects;
create policy "publication editors upload site media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-media'
  and public.has_admin_permission('publications.edit')
);
create policy "publication editors update site media"
on storage.objects for update to authenticated
using (
  bucket_id = 'site-media'
  and public.has_admin_permission('publications.edit')
)
with check (
  bucket_id = 'site-media'
  and public.has_admin_permission('publications.edit')
);
create policy "publication publishers delete site media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-media'
  and public.has_admin_permission('publications.publish')
);

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('carousel_slides', 'carousel'),
      ('news_posts', 'news'),
      ('health_partners', 'partners'),
      ('social_posts', 'social'),
      ('equipment', 'equipment'),
      ('exams', 'exams'),
      ('preparations', 'preparations')
    ) as modules(table_name, policy_suffix)
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'staff reads all ' || item.policy_suffix,
      item.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'staff creates ' || item.policy_suffix,
      item.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'staff updates ' || item.policy_suffix,
      item.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'super admin deletes ' || item.policy_suffix,
      item.table_name
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_admin_permission(''publications.view''))',
      'publication viewers read ' || item.table_name,
      item.table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.has_admin_permission(''publications.edit'')
        and created_by = auth.uid()
        and updated_by = auth.uid()
        and (
          status::text not in (''published'', ''scheduled'')
          or public.has_admin_permission(''publications.publish'')
        )
      )',
      'publication editors create ' || item.table_name,
      item.table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        public.has_admin_permission(''publications.edit'')
      ) with check (
        public.has_admin_permission(''publications.edit'')
        and updated_by = auth.uid()
        and (
          status::text not in (''published'', ''scheduled'')
          or public.has_admin_permission(''publications.publish'')
        )
      )',
      'publication editors update ' || item.table_name,
      item.table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.has_admin_permission(''publications.publish'')
      )',
      'publication publishers delete ' || item.table_name,
      item.table_name
    );
  end loop;
end $$;

grant execute on function public.current_admin_permissions() to authenticated;
grant execute on function public.has_admin_permission(text) to authenticated;
grant execute on function public.can_manage_scheduling() to authenticated;

commit;
