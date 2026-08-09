-- Documents.
--
-- The first table whose payload is structured rather than flat text: a TipTap
-- (ProseMirror) document, stored as JSON. Everything before this was a `text`
-- column rendered as-is; a document has block nodes, and later a per-block
-- search index anchored to them.
--
-- Two things are new here:
--
--   1. Visibility becomes a three-value enum instead of the boolean
--      `campaign_notes.is_private`. `author_only` is that boolean's meaning,
--      unchanged: hidden from everyone else, the campaign owner included.
--      `gm_only` is the new tier — content the GMs share with each other but
--      not with players.
--   2. Access control is expressed once, in two functions, rather than being
--      spelled out in each policy. Every later feature that reads documents or
--      their blocks must go through them rather than writing its own
--      comparison, because the per-block search index will filter on exactly
--      this rule and a second copy of it would eventually drift.
--
-- The restriction order is author_only > gm_only > shared. When a block's
-- inherited visibility and its document's flag disagree, the more restrictive
-- of the two wins. That combination lives with the block walker; what lives
-- here is the question the combination is asked afterwards: may the caller
-- read this?

-- ------------------------------------------------------------- predicates --
--
-- Not security definer: both call the membership helpers, which already are.

-- The single read rule. Anything that returns document or block content must
-- ask this and nothing else.
--
-- `author_only` is deliberately not readable by owners and GMs. That is the
-- entire point of the tier, and it is the clause most likely to be "fixed"
-- later by someone who assumes a GM should see everything. They should not.
--
-- Unknown tiers fall through to false, so adding a value to the check
-- constraint without teaching this function about it denies access rather than
-- granting it.
create or replace function public.can_read_visibility(
  p_campaign_id uuid,
  p_visibility text,
  p_author_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_visibility
    when 'shared' then
      public.is_campaign_member(p_campaign_id)
    when 'gm_only' then
      public.can_manage_campaign(p_campaign_id)
    when 'author_only' then
      p_author_id = (select auth.uid()) and public.is_campaign_member(p_campaign_id)
    else
      false
  end;
$$;

-- The single write rule: you may write what you may read, and only if it is
-- yours or you manage the campaign.
--
-- Building on the read rule is what stops a player creating a `gm_only`
-- document they would immediately be unable to open, and what stops an owner
-- editing somebody's `author_only` document.
create or replace function public.can_write_visibility(
  p_campaign_id uuid,
  p_visibility text,
  p_author_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.can_read_visibility(p_campaign_id, p_visibility, p_author_id)
    and (
      p_author_id = (select auth.uid())
      or (
        p_visibility <> 'author_only'
        and public.can_manage_campaign(p_campaign_id)
      )
    );
$$;

-- ----------------------------------------------------------------- table --

create table if not exists public.campaign_documents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- Groups the search results later. Not an entity kind: entities are their own
  -- feature and do not exist yet.
  doc_type text not null default 'page'
    check (doc_type in ('page', 'session_log', 'handout', 'lore')),
  -- A ProseMirror document node. The check is a shape guard, not validation:
  -- the editor owns this column and nothing else writes it.
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb
    check (content ->> 'type' = 'doc'),
  visibility text not null default 'shared'
    check (visibility in ('shared', 'gm_only', 'author_only')),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The document list is ordered by recency, and the block index will be rebuilt
-- from `updated_at`.
create index if not exists campaign_documents_campaign_id_updated_at_idx
  on public.campaign_documents (campaign_id, updated_at desc);

-- --------------------------------------------------------------- updated --

-- Autosave needs a timestamp it cannot forge, so this is a trigger rather than
-- a column the client sets.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists campaign_documents_touch_updated_at on public.campaign_documents;
create trigger campaign_documents_touch_updated_at
  before update on public.campaign_documents
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- rls --

alter table public.campaign_documents enable row level security;

drop policy if exists "Members read documents they may see" on public.campaign_documents;
create policy "Members read documents they may see"
  on public.campaign_documents for select to authenticated
  using (public.can_read_visibility(campaign_id, visibility, author_id));

-- A document is always created as its author's own; `author_id` defaults to
-- auth.uid() and the policy insists on it.
drop policy if exists "Members create their own documents" on public.campaign_documents;
create policy "Members create their own documents"
  on public.campaign_documents for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_write_visibility(campaign_id, visibility, author_id)
  );

-- `using` checks the row as it stands, `with check` the row as it would be, so
-- both are needed: the first stops editing a document you cannot write, the
-- second stops editing one into a state you could not have created — handing it
-- to another author, or raising it to a tier you have no access to.
drop policy if exists "Authors and managers update documents" on public.campaign_documents;
create policy "Authors and managers update documents"
  on public.campaign_documents for update to authenticated
  using (public.can_write_visibility(campaign_id, visibility, author_id))
  with check (public.can_write_visibility(campaign_id, visibility, author_id));

drop policy if exists "Authors and managers delete documents" on public.campaign_documents;
create policy "Authors and managers delete documents"
  on public.campaign_documents for delete to authenticated
  using (public.can_write_visibility(campaign_id, visibility, author_id));
