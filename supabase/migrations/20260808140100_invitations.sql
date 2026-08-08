-- Campaign invitations.
--
-- A membership cannot be created for someone who has not signed up yet, so an
-- invitation is addressed to an email instead. The invited person sees it on
-- their dashboard once they sign in with that address and accepts it, which
-- creates the membership and deletes the invitation. A pending invitation is
-- simply a row that still exists.
--
-- Nothing here sends email. Delivery can be added later (an edge function on
-- insert) without changing this model.

-- The address of the caller, taken from their JWT. No table access, so this
-- does not need to be security definer.
create or replace function public.current_user_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(btrim(auth.jwt() ->> 'email'));
$$;

create table if not exists public.campaign_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  -- Ownership is not transferable through an invitation.
  role text not null default 'player' check (role in ('gm', 'player')),
  -- A plain function call: DEFAULT does not accept a subquery.
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists campaign_invitations_email_idx
  on public.campaign_invitations (email);

-- --------------------------------------------------------------- helper --

create or replace function public.has_pending_invitation(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_invitations i
    where i.campaign_id = p_campaign_id
      and i.email = public.current_user_email()
  );
$$;

-- ------------------------------------------------------------------ rls --

alter table public.campaign_invitations enable row level security;

drop policy if exists "Owners manage invitations" on public.campaign_invitations;
create policy "Owners manage invitations"
  on public.campaign_invitations for all to authenticated
  using (public.is_campaign_owner(campaign_id))
  with check (public.is_campaign_owner(campaign_id));

drop policy if exists "Invitees can read their invitations" on public.campaign_invitations;
create policy "Invitees can read their invitations"
  on public.campaign_invitations for select to authenticated
  using (email = public.current_user_email());

drop policy if exists "Invitees can decline their invitations" on public.campaign_invitations;
create policy "Invitees can decline their invitations"
  on public.campaign_invitations for delete to authenticated
  using (email = public.current_user_email());

-- An invitee needs the campaign's name before they are a member of it.
drop policy if exists "Members can read their campaigns" on public.campaigns;
drop policy if exists "Members and invitees can read campaigns" on public.campaigns;
create policy "Members and invitees can read campaigns"
  on public.campaigns for select to authenticated
  using (public.is_campaign_member(id) or public.has_pending_invitation(id));

-- Owners remove members; members leave on their own. The `role <> 'owner'`
-- guard means the owner row can never be deleted, so a campaign cannot be
-- orphaned. An owner who is done deletes the campaign instead.
--
-- There is still no INSERT policy: memberships are only ever written by
-- create_campaign() and accept_invitation(). Role changes get their own policy
-- when promoting a player to GM becomes a feature.
drop policy if exists "Owners remove members and members can leave" on public.campaign_memberships;
create policy "Owners remove members and members can leave"
  on public.campaign_memberships for delete to authenticated
  using (
    role <> 'owner'
    and (public.is_campaign_owner(campaign_id) or user_id = (select auth.uid()))
  );

-- --------------------------------------------------------------- accept --

-- Joins the caller to the campaign and consumes the invitation, atomically.
create or replace function public.accept_invitation(p_invitation_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := public.current_user_email();
  v_invitation public.campaign_invitations;
  v_campaign public.campaigns;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invitation
  from public.campaign_invitations
  where id = p_invitation_id
    and email = v_email
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  insert into public.campaign_memberships (campaign_id, user_id, role)
  values (v_invitation.campaign_id, v_user_id, v_invitation.role)
  on conflict (campaign_id, user_id) do nothing;

  delete from public.campaign_invitations where id = v_invitation.id;

  select * into v_campaign
  from public.campaigns
  where id = v_invitation.campaign_id;

  return v_campaign;
end;
$$;

revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;
