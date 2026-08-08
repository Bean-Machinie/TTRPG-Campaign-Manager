-- Campaigns and campaign membership.
--
--   auth.users  <->  campaign_memberships (role)  <->  campaigns
--
-- A user may belong to many campaigns; a campaign may contain many users.
-- Everything campaign-scoped added later (sessions, characters, locations,
-- quests, notes, maps) should reference campaigns(id) and reuse the
-- public.is_campaign_member() / public.is_campaign_owner() helpers in its
-- own row level security policies.

-- ---------------------------------------------------------------- tables --

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Kept for auditing only. Ownership is expressed by the membership role.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_memberships (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'player' check (role in ('owner', 'gm', 'player')),
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index if not exists campaign_memberships_user_id_idx
  on public.campaign_memberships (user_id);

create index if not exists campaign_memberships_campaign_id_idx
  on public.campaign_memberships (campaign_id);

-- --------------------------------------------------------------- helpers --

-- These are security definer so that policies on campaign_memberships can ask
-- about campaign_memberships without triggering recursive policy evaluation.

create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_memberships m
    where m.campaign_id = p_campaign_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_campaign_owner(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_memberships m
    where m.campaign_id = p_campaign_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- ------------------------------------------------------------------- rls --

alter table public.campaigns enable row level security;
alter table public.campaign_memberships enable row level security;

-- There is deliberately no INSERT policy on campaigns: they are created through
-- public.create_campaign() below, so that the owner membership is always written
-- in the same transaction and no orphaned campaign can exist.

-- The drops keep this file safe to run more than once.
drop policy if exists "Members can read their campaigns" on public.campaigns;
create policy "Members can read their campaigns"
  on public.campaigns for select to authenticated
  using (public.is_campaign_member(id));

drop policy if exists "Owners can update their campaigns" on public.campaigns;
create policy "Owners can update their campaigns"
  on public.campaigns for update to authenticated
  using (public.is_campaign_owner(id))
  with check (public.is_campaign_owner(id));

drop policy if exists "Owners can delete their campaigns" on public.campaigns;
create policy "Owners can delete their campaigns"
  on public.campaigns for delete to authenticated
  using (public.is_campaign_owner(id));

-- Members can see who else is in the campaign. Writing memberships belongs to
-- the invitation feature and gets its own policies in a later migration.
drop policy if exists "Members can read memberships of their campaigns" on public.campaign_memberships;
create policy "Members can read memberships of their campaigns"
  on public.campaign_memberships for select to authenticated
  using (public.is_campaign_member(campaign_id));

-- ---------------------------------------------------------------- create --

-- Creates a campaign and makes the caller its owner, atomically.
create or replace function public.create_campaign(p_name text)
returns public.campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_campaign public.campaigns;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.campaigns (name, created_by)
  values (btrim(p_name), v_user_id)
  returning * into v_campaign;

  insert into public.campaign_memberships (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'owner');

  return v_campaign;
end;
$$;

revoke execute on function public.create_campaign(text) from public, anon;
grant execute on function public.create_campaign(text) to authenticated;
