-- Notes.
--
-- The first table where *every* member writes, and the first with a visibility
-- flag. A note belongs to the person who wrote it: only its author may edit or
-- delete it, and a private note is visible to nobody else — not even the owner
-- of the campaign. That is deliberate. A GM keeping secret plot notes and a
-- player keeping their own are the same feature.

create table if not exists public.campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists campaign_notes_campaign_id_idx
  on public.campaign_notes (campaign_id);

-- ------------------------------------------------------------------ rls --

alter table public.campaign_notes enable row level security;

drop policy if exists "Members read shared notes and their own" on public.campaign_notes;
create policy "Members read shared notes and their own"
  on public.campaign_notes for select to authenticated
  using (
    public.is_campaign_member(campaign_id)
    and (not is_private or author_id = (select auth.uid()))
  );

-- Any member may write a note, but only as themselves.
drop policy if exists "Members write their own notes" on public.campaign_notes;
create policy "Members write their own notes"
  on public.campaign_notes for insert to authenticated
  with check (
    public.is_campaign_member(campaign_id)
    and author_id = (select auth.uid())
  );

-- Note that owners and GMs are absent here on purpose: nobody edits or removes
-- someone else's note.
drop policy if exists "Authors update their own notes" on public.campaign_notes;
create policy "Authors update their own notes"
  on public.campaign_notes for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "Authors delete their own notes" on public.campaign_notes;
create policy "Authors delete their own notes"
  on public.campaign_notes for delete to authenticated
  using (author_id = (select auth.uid()));
