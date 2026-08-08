-- Game sessions: the first campaign-scoped content table.
--
-- This is the pattern every later content table (characters, locations, quests,
-- notes) should copy: a campaign_id foreign key, and policies built entirely on
-- the membership helpers rather than new access rules of their own.
--
-- Unlike memberships, rows here are inserted directly by the client. There is no
-- companion row to keep in step, so no security definer function is needed.

-- Owner or GM. Players read but do not write.
create or replace function public.can_manage_campaign(p_campaign_id uuid)
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
      and m.role in ('owner', 'gm')
  );
$$;

-- Named campaign_sessions, not sessions, to stay clear of auth sessions.
create table if not exists public.campaign_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- A date, not a timestamp: time of day belongs with real scheduling.
  scheduled_for date,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_sessions_campaign_id_scheduled_for_idx
  on public.campaign_sessions (campaign_id, scheduled_for desc);

-- ------------------------------------------------------------------ rls --

alter table public.campaign_sessions enable row level security;

drop policy if exists "Members read sessions" on public.campaign_sessions;
create policy "Members read sessions"
  on public.campaign_sessions for select to authenticated
  using (public.is_campaign_member(campaign_id));

drop policy if exists "Owners and GMs create sessions" on public.campaign_sessions;
create policy "Owners and GMs create sessions"
  on public.campaign_sessions for insert to authenticated
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs update sessions" on public.campaign_sessions;
create policy "Owners and GMs update sessions"
  on public.campaign_sessions for update to authenticated
  using (public.can_manage_campaign(campaign_id))
  with check (public.can_manage_campaign(campaign_id));

drop policy if exists "Owners and GMs delete sessions" on public.campaign_sessions;
create policy "Owners and GMs delete sessions"
  on public.campaign_sessions for delete to authenticated
  using (public.can_manage_campaign(campaign_id));
