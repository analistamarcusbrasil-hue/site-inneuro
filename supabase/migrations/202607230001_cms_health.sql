begin;

-- Registro público e não sensível usado apenas para confirmar que a API do CMS
-- e o banco estão acessíveis. Esta migração também elimina a divergência entre
-- o esquema versionado e a tabela já provisionada no ambiente remoto.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  category text not null default 'general',
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at
before update on public.site_settings
for each row execute procedure public.set_updated_at();

drop policy if exists "public reads public settings" on public.site_settings;
create policy "public reads public settings"
on public.site_settings for select
to anon, authenticated
using (is_public);

drop policy if exists "staff reads settings" on public.site_settings;
create policy "staff reads settings"
on public.site_settings for select
to authenticated
using (public.is_staff());

drop policy if exists "managers create settings" on public.site_settings;
create policy "managers create settings"
on public.site_settings for insert
to authenticated
with check (public.is_manager() and updated_by = auth.uid());

drop policy if exists "managers update settings" on public.site_settings;
create policy "managers update settings"
on public.site_settings for update
to authenticated
using (public.is_manager())
with check (public.is_manager() and updated_by = auth.uid());

grant select on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;

insert into public.site_settings (key, value, category, is_public)
values ('cms_connection_status', '"connected"', 'system', true)
on conflict (key) do update set is_public = true;

commit;
