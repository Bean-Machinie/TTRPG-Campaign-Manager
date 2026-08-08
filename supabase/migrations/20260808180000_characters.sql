-- Characters: player characters and NPCs.
--
-- Follows the campaign_sessions template, with one addition: a row can belong to
-- a specific member. That makes this the first table where a *player* may write,
-- but only to their own character. Notes and anything else with per-row
-- ownership should copy these policies rather than the session ones.

create table if not exists public.campaign_characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null default 'pc' check (kind in ('pc', 'npc')),
  -- The member who plays this character. Null for NPCs and unassigned PCs.
  -- Deliberately a plain reference to auth.users rather than a composite key
  -- into campaign_memberships: a composite foreign key with `on delete set null`
  -- would try to null campaign_id too, which is not nullable.
  player_user_id uuid references auth.users (id) on delete set null,
  description text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_characters_campaign_id_idx
  on public.campaign_characters (campaign_id);

-- ------------------------------------------------------------------ rls --

alter table public.campaign_characters enable row level security;

drop policy if exists "Members read characters" on public.campaign_characters;
create policy "Members read characters"
  on public.campaign_characters for select to authenticated
  using (public.is_campaign_member(campaign_id));

-- Owners and GMs add anything. A player may add a PC, but only their own.
drop policy if exists "Managers and players create characters" on public.campaign_characters;
create policy "Managers and players create characters"
  on public.campaign_characters for insert to authenticated
  with check (
    public.is_campaign_member(campaign_id)
    and (
      public.can_manage_campaign(campaign_id)
      or (kind = 'pc' and player_user_id = (select auth.uid()))
    )
  );

-- The `with check` clause stops a player from editing their character into
-- someone else's, or into an NPC.
drop policy if exists "Managers and players update characters" on public.campaign_characters;
create policy "Managers and players update characters"
  on public.campaign_characters for update to authenticated
  using (
    public.can_manage_campaign(campaign_id)
    or player_user_id = (select auth.uid())
  )
  with check (
    public.can_manage_campaign(campaign_id)
    or (kind = 'pc' and player_user_id = (select auth.uid()))
  );

drop policy if exists "Managers and players delete characters" on public.campaign_characters;
create policy "Managers and players delete characters"
  on public.campaign_characters for delete to authenticated
  using (
    public.can_manage_campaign(campaign_id)
    or player_user_id = (select auth.uid())
  );
