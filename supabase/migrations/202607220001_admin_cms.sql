begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin', 'admin', 'editor');
create type public.content_status as enum ('draft', 'scheduled', 'published', 'archived');
create type public.partner_kind as enum ('convenio', 'parceria');
create type public.media_kind as enum ('photo', 'logo', 'thumbnail');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'site-media' check (bucket = 'site-media'),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  kind public.media_kind not null,
  alt_text text not null default '',
  caption text,
  credit text,
  license text,
  uploaded_by uuid not null references public.profiles(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.carousel_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  desktop_media_id uuid references public.media_assets(id),
  mobile_media_id uuid references public.media_assets(id),
  image_alt text not null,
  cta_label text,
  cta_url text,
  status public.content_status not null default 'draft',
  active boolean not null default false,
  sort_order integer not null default 0,
  publish_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  summary text not null,
  category text,
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  cover_media_id uuid references public.media_assets(id),
  seo_title text,
  seo_description text,
  featured_on_home boolean not null default false,
  show_in_carousel boolean not null default false,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.health_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind public.partner_kind not null default 'convenio',
  website_url text,
  logo_media_id uuid references public.media_assets(id),
  active boolean not null default false,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  network text not null,
  url text not null,
  title text not null,
  callout text,
  thumbnail_media_id uuid references public.media_assets(id),
  occurred_at timestamptz,
  cta_label text,
  featured boolean not null default false,
  active boolean not null default false,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  modality text not null,
  description text not null,
  cover_media_id uuid references public.media_assets(id),
  gallery_media_ids uuid[] not null default '{}',
  featured boolean not null default false,
  active boolean not null default false,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index carousel_public_idx on public.carousel_slides (status, active, sort_order) where deleted_at is null;
create index news_public_idx on public.news_posts (status, published_at desc) where deleted_at is null;
create index partners_public_idx on public.health_partners (status, active, sort_order) where deleted_at is null;
create index social_public_idx on public.social_posts (status, active, sort_order) where deleted_at is null;
create index equipment_public_idx on public.equipment (status, active, sort_order) where deleted_at is null;
create index media_search_idx on public.media_assets (kind, created_at desc) where deleted_at is null;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('super_admin', 'admin', 'editor'), false);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('super_admin', 'admin'), false);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'editor')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger media_assets_updated_at before update on public.media_assets for each row execute procedure public.set_updated_at();
create trigger carousel_slides_updated_at before update on public.carousel_slides for each row execute procedure public.set_updated_at();
create trigger news_posts_updated_at before update on public.news_posts for each row execute procedure public.set_updated_at();
create trigger health_partners_updated_at before update on public.health_partners for each row execute procedure public.set_updated_at();
create trigger social_posts_updated_at before update on public.social_posts for each row execute procedure public.set_updated_at();
create trigger equipment_updated_at before update on public.equipment for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.carousel_slides enable row level security;
alter table public.news_posts enable row level security;
alter table public.health_partners enable row level security;
alter table public.social_posts enable row level security;
alter table public.equipment enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile own read" on public.profiles for select to authenticated using (id = auth.uid() or public.current_app_role() = 'super_admin');
create policy "super admin manages profiles" on public.profiles for all to authenticated using (public.current_app_role() = 'super_admin') with check (public.current_app_role() = 'super_admin');

create policy "staff reads media" on public.media_assets for select to authenticated using (public.is_staff());
create policy "public reads active media metadata" on public.media_assets for select to anon, authenticated using (archived_at is null and deleted_at is null);
create policy "staff uploads media" on public.media_assets for insert to authenticated with check (public.is_staff() and uploaded_by = auth.uid());
create policy "staff updates media" on public.media_assets for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "super admin deletes media" on public.media_assets for delete to authenticated using (public.current_app_role() = 'super_admin');

create policy "public reads carousel" on public.carousel_slides for select to anon, authenticated using ((status = 'published' or (status = 'scheduled' and publish_at <= now())) and active and deleted_at is null and (publish_at is null or publish_at <= now()));
create policy "staff reads all carousel" on public.carousel_slides for select to authenticated using (public.is_staff());
create policy "staff creates carousel" on public.carousel_slides for insert to authenticated with check (public.is_staff() and created_by = auth.uid() and updated_by = auth.uid());
create policy "staff updates carousel" on public.carousel_slides for update to authenticated using (public.is_staff()) with check (public.is_staff() and updated_by = auth.uid());
create policy "super admin deletes carousel" on public.carousel_slides for delete to authenticated using (public.current_app_role() = 'super_admin');

create policy "public reads news" on public.news_posts for select to anon, authenticated using ((status = 'published' or (status = 'scheduled' and publish_at <= now())) and deleted_at is null and coalesce(published_at, publish_at, now()) <= now());
create policy "staff reads all news" on public.news_posts for select to authenticated using (public.is_staff());
create policy "staff creates news" on public.news_posts for insert to authenticated with check (public.is_staff() and created_by = auth.uid() and updated_by = auth.uid());
create policy "staff updates news" on public.news_posts for update to authenticated using (public.is_staff()) with check (public.is_staff() and updated_by = auth.uid());
create policy "super admin deletes news" on public.news_posts for delete to authenticated using (public.current_app_role() = 'super_admin');

create policy "public reads partners" on public.health_partners for select to anon, authenticated using (status = 'published' and active and deleted_at is null);
create policy "staff reads all partners" on public.health_partners for select to authenticated using (public.is_staff());
create policy "staff creates partners" on public.health_partners for insert to authenticated with check (public.is_staff() and created_by = auth.uid() and updated_by = auth.uid());
create policy "staff updates partners" on public.health_partners for update to authenticated using (public.is_staff()) with check (public.is_staff() and updated_by = auth.uid());
create policy "super admin deletes partners" on public.health_partners for delete to authenticated using (public.current_app_role() = 'super_admin');

create policy "public reads social" on public.social_posts for select to anon, authenticated using (status = 'published' and active and deleted_at is null);
create policy "staff reads all social" on public.social_posts for select to authenticated using (public.is_staff());
create policy "staff creates social" on public.social_posts for insert to authenticated with check (public.is_staff() and created_by = auth.uid() and updated_by = auth.uid());
create policy "staff updates social" on public.social_posts for update to authenticated using (public.is_staff()) with check (public.is_staff() and updated_by = auth.uid());
create policy "super admin deletes social" on public.social_posts for delete to authenticated using (public.current_app_role() = 'super_admin');

create policy "public reads equipment" on public.equipment for select to anon, authenticated using (status = 'published' and active and deleted_at is null);
create policy "staff reads all equipment" on public.equipment for select to authenticated using (public.is_staff());
create policy "staff creates equipment" on public.equipment for insert to authenticated with check (public.is_staff() and created_by = auth.uid() and updated_by = auth.uid());
create policy "staff updates equipment" on public.equipment for update to authenticated using (public.is_staff()) with check (public.is_staff() and updated_by = auth.uid());
create policy "super admin deletes equipment" on public.equipment for delete to authenticated using (public.current_app_role() = 'super_admin');

create policy "super admin reads audit" on public.audit_logs for select to authenticated using (public.current_app_role() = 'super_admin');
create policy "staff writes audit" on public.audit_logs for insert to authenticated with check (public.is_staff() and actor_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads site media" on storage.objects for select to public using (bucket_id = 'site-media');
create policy "staff uploads site media" on storage.objects for insert to authenticated with check (bucket_id = 'site-media' and public.is_staff());
create policy "staff updates site media" on storage.objects for update to authenticated using (bucket_id = 'site-media' and public.is_staff()) with check (bucket_id = 'site-media' and public.is_staff());
create policy "super admin deletes site media" on storage.objects for delete to authenticated using (bucket_id = 'site-media' and public.current_app_role() = 'super_admin');

grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_manager() to anon, authenticated;

grant select on public.media_assets, public.carousel_slides, public.news_posts, public.health_partners, public.social_posts, public.equipment to anon;
grant select, insert, update, delete on public.profiles, public.media_assets, public.carousel_slides, public.news_posts, public.health_partners, public.social_posts, public.equipment, public.audit_logs to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;

commit;
