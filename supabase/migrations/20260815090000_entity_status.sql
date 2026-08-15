-- Draft entities.
--
-- Character creation is a sequence of seven steps with real dependencies
-- between them, and a sequence has to survive a closed tab. The alternative
-- places to keep a half-built character are component state, which does not
-- survive a refresh, and localStorage, which does not survive a different
-- machine and cannot be resumed by the person the character belongs to. So a
-- draft is a row, from the moment it has a name.
--
-- That makes `status` a filter rather than a workflow. There are exactly two
-- values and no transitions worth modelling: a row is either finished, and
-- appears everywhere a character appears, or it is not, and appears only in the
-- one list that offers to finish it.
--
-- Depends on: 20260814090000_entities.sql.

alter table public.campaign_entities
  add column if not exists status text not null default 'complete'
    check (status in ('draft', 'complete'));

-- Default 'complete' rather than 'draft', and the direction matters. Every row
-- that already exists is a finished character, and anything that writes to this
-- table without knowing about drafts — the quick-create path, a future import —
-- should produce something visible rather than something silently withheld. A
-- draft is the deliberate case, so it is the one that has to say so.
comment on column public.campaign_entities.status is
  'complete: a finished entity, listed everywhere. draft: mid-creation, listed only to be resumed.';

-- The whole point of the column: the list query, which now asks for one status.
-- The existing (campaign_id, kind, name) index still serves it, so what is
-- added here is the other half — somebody's unfinished drafts, which is a small
-- set inside a small set and would otherwise be a scan of the campaign.
create index if not exists campaign_entities_campaign_drafts_idx
  on public.campaign_entities (campaign_id, author_id)
  where status = 'draft';

-- Readable, and — because Postgres checks column privileges inside `where` as
-- well as in the select list — filterable. Without this grant the column exists
-- and every query that mentions it fails, which is the loud failure the entities
-- migration set up deliberately by revoking the blanket select.
grant select (status) on public.campaign_entities to authenticated;

-- ----------------------------------------------------------- reading one --
--
-- Unchanged except for the new column. Restated in full rather than patched,
-- because `create or replace function` cannot alter a return type: the function
-- is dropped and rebuilt, and a partial copy here would quietly become the
-- authoritative one.

drop function if exists public.get_campaign_entity(uuid);

create or replace function public.get_campaign_entity(p_entity_id uuid)
returns table (
  id uuid,
  campaign_id uuid,
  kind text,
  name text,
  system_id uuid,
  player_user_id uuid,
  summary text,
  data jsonb,
  secrets jsonb,
  visibility text,
  status text,
  author_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.campaign_id,
    e.kind,
    e.name,
    e.system_id,
    e.player_user_id,
    e.summary,
    e.data,
    case
      when public.can_manage_campaign(e.campaign_id) then e.secrets
      else '{}'::jsonb
    end,
    e.visibility,
    e.status,
    e.author_id,
    e.created_at,
    e.updated_at
  from public.campaign_entities as e
  where e.id = p_entity_id
    and public.can_read_visibility(e.campaign_id, e.visibility, e.author_id);
$$;

revoke all on function public.get_campaign_entity(uuid) from public;
grant execute on function public.get_campaign_entity(uuid) to authenticated;
