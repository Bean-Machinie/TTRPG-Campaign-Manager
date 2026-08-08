-- Locations and quests.
--
-- Both are straight copies of the campaign_sessions template: members read,
-- owners and GMs write. Nothing new is introduced here.

create table if not exists public.campaign_locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_locations_campaign_id_idx
  on public.campaign_locations (campaign_id);

create table if not exists public.campaign_quests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  description text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_quests_campaign_id_idx
  on public.campaign_quests (campaign_id);

-- ------------------------------------------------------------------ rls --

alter table public.campaign_locations enable row level security;
alter table public.campaign_quests enable row level security;

drop policy if exists "Members read locations" on public.campaign_locations;
create policy "Members read locations"
  on public.campaign_locations for select to authenticated
  using (public.is_campaign_member(campaign_id));

drop policy if exists "Owners and GMs create locations" on public.campaign_locations;
create policy "Owners and GMs create locations"
  on public.campaign_locations for insert to authenticated
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs update locations" on public.campaign_locations;
create policy "Owners and GMs update locations"
  on public.campaign_locations for update to authenticated
  using (public.can_manage_campaign(campaign_id))
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs delete locations" on public.campaign_locations;
create policy "Owners and GMs delete locations"
  on public.campaign_locations for delete to authenticated
  using (public.can_manage_campaign(campaign_id));

drop policy if exists "Members read quests" on public.campaign_quests;
create policy "Members read quests"
  on public.campaign_quests for select to authenticated
  using (public.is_campaign_member(campaign_id));

drop policy if exists "Owners and GMs create quests" on public.campaign_quests;
create policy "Owners and GMs create quests"
  on public.campaign_quests for insert to authenticated
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs update quests" on public.campaign_quests;
create policy "Owners and GMs update quests"
  on public.campaign_quests for update to authenticated
  using (public.can_manage_campaign(campaign_id))
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs delete quests" on public.campaign_quests;
create policy "Owners and GMs delete quests"
  on public.campaign_quests for delete to authenticated
  using (public.can_manage_campaign(campaign_id));
