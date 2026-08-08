-- Maps.
--
-- The first feature whose payload is a file rather than a row. Two things are
-- new here:
--
--   1. Access control moves to policies on storage.objects, a different surface
--      from the table policies everywhere else. They can still call the same
--      membership helpers, provided the object path starts with the campaign id.
--   2. Size and MIME limits live on the bucket, not in a check constraint.
--
-- Object paths are always `<campaign_id>/<uuid>.<ext>`. That convention is what
-- makes the storage policies below possible, so do not change it without
-- changing them.

-- ---------------------------------------------------------------- bucket --

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-maps',
  'campaign-maps',
  false, -- private: images are reached through short-lived signed URLs
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------- table --

create table if not exists public.campaign_maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  storage_path text not null unique,
  -- A map either depicts one location, or is a campaign-wide map and has none.
  -- The foreign key points this way so a location can have several maps.
  location_id uuid references public.campaign_locations (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_maps_campaign_id_idx
  on public.campaign_maps (campaign_id);

alter table public.campaign_maps enable row level security;

drop policy if exists "Members read maps" on public.campaign_maps;
create policy "Members read maps"
  on public.campaign_maps for select to authenticated
  using (public.is_campaign_member(campaign_id));

drop policy if exists "Owners and GMs create maps" on public.campaign_maps;
create policy "Owners and GMs create maps"
  on public.campaign_maps for insert to authenticated
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs update maps" on public.campaign_maps;
create policy "Owners and GMs update maps"
  on public.campaign_maps for update to authenticated
  using (public.can_manage_campaign(campaign_id))
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs delete maps" on public.campaign_maps;
create policy "Owners and GMs delete maps"
  on public.campaign_maps for delete to authenticated
  using (public.can_manage_campaign(campaign_id));

-- ------------------------------------------------------- storage policies --

-- Reads the campaign id out of the object path. Returns null rather than raising
-- when the first segment is not a uuid, so a malformed path fails the policy
-- cleanly instead of erroring: is_campaign_member(null) is false.
create or replace function public.campaign_id_from_storage_path(p_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

drop policy if exists "Members read campaign maps" on storage.objects;
create policy "Members read campaign maps"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-maps'
    and public.is_campaign_member(public.campaign_id_from_storage_path(name))
  );

drop policy if exists "Owners and GMs upload campaign maps" on storage.objects;
create policy "Owners and GMs upload campaign maps"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'campaign-maps'
    and public.can_manage_campaign(public.campaign_id_from_storage_path(name))
  );

drop policy if exists "Owners and GMs delete campaign maps" on storage.objects;
create policy "Owners and GMs delete campaign maps"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'campaign-maps'
    and public.can_manage_campaign(public.campaign_id_from_storage_path(name))
  );
