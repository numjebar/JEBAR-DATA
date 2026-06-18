-- JEBAR DATA full-system sync for the old app structure.
-- Run once in Supabase SQL Editor.
-- This uses one JSON table so menus, recipes, master data, settings, and sales stay together.
-- It does not touch HR tables or the older jebar_daily_sales / jebar_menus tables.
-- Version 2 adds image storage and media metadata for future normalized data work.

create table if not exists public.jebar_app_state (
  shop_code text primary key,
  db jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.jebar_media_assets (
  id text primary key,
  shop_code text not null default 'jebar',
  bucket text not null default 'jebar-images',
  storage_path text not null,
  public_url text,
  entity_type text,
  entity_id text,
  role text not null default 'image',
  file_name text,
  mime text,
  size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.jebar_app_state enable row level security;
alter table public.jebar_media_assets enable row level security;

drop policy if exists "jebar anon select app state" on public.jebar_app_state;
drop policy if exists "jebar anon insert app state" on public.jebar_app_state;
drop policy if exists "jebar anon update app state" on public.jebar_app_state;
drop policy if exists "jebar anon delete app state" on public.jebar_app_state;
drop policy if exists "jebar anon select media assets" on public.jebar_media_assets;
drop policy if exists "jebar anon insert media assets" on public.jebar_media_assets;
drop policy if exists "jebar anon update media assets" on public.jebar_media_assets;
drop policy if exists "jebar anon delete media assets" on public.jebar_media_assets;

create policy "jebar anon select app state" on public.jebar_app_state
for select to anon using (true);

create policy "jebar anon insert app state" on public.jebar_app_state
for insert to anon with check (true);

create policy "jebar anon update app state" on public.jebar_app_state
for update to anon using (true) with check (true);

create policy "jebar anon delete app state" on public.jebar_app_state
for delete to anon using (true);

create policy "jebar anon select media assets" on public.jebar_media_assets
for select to anon using (true);

create policy "jebar anon insert media assets" on public.jebar_media_assets
for insert to anon with check (true);

create policy "jebar anon update media assets" on public.jebar_media_assets
for update to anon using (true) with check (true);

create policy "jebar anon delete media assets" on public.jebar_media_assets
for delete to anon using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jebar-images',
  'jebar-images',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "jebar anon read images" on storage.objects;
drop policy if exists "jebar anon upload images" on storage.objects;
drop policy if exists "jebar anon update images" on storage.objects;
drop policy if exists "jebar anon delete images" on storage.objects;

create policy "jebar anon read images" on storage.objects
for select to anon using (bucket_id = 'jebar-images');

create policy "jebar anon upload images" on storage.objects
for insert to anon with check (bucket_id = 'jebar-images');

create policy "jebar anon update images" on storage.objects
for update to anon using (bucket_id = 'jebar-images') with check (bucket_id = 'jebar-images');

create policy "jebar anon delete images" on storage.objects
for delete to anon using (bucket_id = 'jebar-images');
