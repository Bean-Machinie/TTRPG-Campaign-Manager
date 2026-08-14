-- Entities: player characters, NPCs and creatures.
--
-- This replaces `campaign_characters`, which was a name, a kind and a
-- paragraph. What makes an entity different is that it carries *rules* — an
-- ability score is a number the game does arithmetic with, not prose — and the
-- whole design question is where those rules live.
--
-- They do not live in this file. There is no `strength` column here, and there
-- will not be one. A game system is a row in `game_systems` whose `definition`
-- says which abilities exist, which skills they govern, and how the derived
-- numbers are worked out; an entity references that row and keeps its own
-- numbers in `data`. Adding Pathfinder or Call of Cthulhu later is writing a
-- second row, not writing a second migration. Postgres therefore treats `data`
-- as opaque: it is validated at the application boundary by Zod, and the only
-- things pulled out of it here are the three fields worth filtering a list by.
--
-- Two rules that are decided elsewhere and only obeyed here:
--
--   1. Visibility is the documents rule, unchanged. `can_read_visibility()` and
--      `can_write_visibility()` from 20260809130000_documents.sql are the only
--      access control in this file, because a second copy of that comparison
--      would drift from the first. Note in particular that `author_only` is
--      still opaque to owners and GMs.
--   2. A row can hold GM-only fields alongside player-visible ones, and row
--      level security cannot protect one column of a row it has already let you
--      read. So `secrets` is handled exactly the way document bodies are: the
--      blanket `select` grant is revoked, every other column is granted back by
--      name, and the one function that can return `secrets` decides for itself
--      who gets it. A player cannot read that column, and cannot filter on it
--      either — Postgres checks column privileges inside `where` too, which is
--      what stops the obvious guessing attack.
--
-- Depends on: 20260808090000_campaigns.sql (is_campaign_member),
-- 20260808160000_sessions.sql (can_manage_campaign), 20260809130000_documents.sql
-- (can_read_visibility, can_write_visibility, touch_updated_at).

-- ---------------------------------------------------------- game systems --
--
-- Global content, not campaign content: `dnd5e` is the same ruleset in every
-- campaign, so this table is not scoped to one. There is deliberately no insert,
-- update or delete policy — a system is seeded by pasting this file, the way a
-- campaign is created by calling a function. Homebrew systems, when they come,
-- add a nullable `campaign_id` and one clause to the read policy.

create table if not exists public.game_systems (
  id uuid primary key default gen_random_uuid(),
  -- The stable handle. Code refers to a system by this, never by uuid.
  key text not null unique check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Which printing of the rules this definition transcribes. Free text; it ends
  -- up in the attribution line, so it has to say what a reader would check.
  version text not null default '1',
  -- The ruleset itself. See the seed at the foot of this file for its shape.
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists game_systems_touch_updated_at on public.game_systems;
create trigger game_systems_touch_updated_at
  before update on public.game_systems
  for each row execute function public.touch_updated_at();

alter table public.game_systems enable row level security;

-- Readable by anyone signed in. A ruleset is not a secret, and every entity
-- page needs one to render at all.
drop policy if exists "Signed-in users read game systems" on public.game_systems;
create policy "Signed-in users read game systems"
  on public.game_systems for select to authenticated
  using (true);

-- ------------------------------------------------------------- entities --

create table if not exists public.campaign_entities (
  -- The id a TipTap mention node will point at. Stable for the life of the row,
  -- and preserved when the old `campaign_characters` rows are copied in below,
  -- so nothing that already refers to a character breaks.
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,

  -- One table, three kinds. They share every query and every renderer; what
  -- separates them is whether their numbers are derived or simply asserted,
  -- and that is a flag inside `data`, not a different shape of row.
  kind text not null default 'npc' check (kind in ('pc', 'npc', 'creature')),

  name text not null check (char_length(btrim(name)) between 1 and 120),

  -- Which ruleset `data` is written in. Restricted rather than cascaded: a
  -- system with entities pointing at it is not something to delete by accident.
  system_id uuid not null references public.game_systems (id) on delete restrict,

  -- The member who plays this one. Only ever a PC — see the check — and null
  -- for an unassigned one. A plain reference to auth.users rather than into
  -- campaign_memberships, because a composite key with `on delete set null`
  -- would try to null campaign_id too.
  player_user_id uuid references auth.users (id) on delete set null,
  check (kind = 'pc' or player_user_id is null),

  -- The one line a list row shows. Prose, not rules.
  summary text check (summary is null or char_length(summary) <= 2000),

  -- Everything the rules care about: ability scores, level, proficiencies,
  -- resource pools, and the overrides that beat any derived value. The check is
  -- a shape guard, not validation — Zod owns this column's contents, and a
  -- constraint here would be a second, weaker copy of that schema.
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),

  -- The GM's half of the same entity: the true name, the motivation, and a
  -- partial `data` overlay for stats that differ from what the party has been
  -- told. Unreadable by anyone who cannot manage the campaign, and unreadable
  -- through PostgREST by anyone at all — see the grants below.
  secrets jsonb not null default '{}'::jsonb check (jsonb_typeof(secrets) = 'object'),

  visibility text not null default 'shared'
    check (visibility in ('shared', 'gm_only', 'author_only')),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------ filterable fields --
--
-- The three questions a list actually asks of the blob — "level 5 and up",
-- "CR 1/2 or less", "every undead" — lifted into columns that can be indexed.
-- Everything else in `data` stays opaque, which is the point: indexing the
-- whole document would make its shape the database's business again.
--
-- Guarded by a type test rather than a bare cast. A cast would be immutable and
-- would work, right up until something wrote `"level": "3rd"` and the *insert*
-- failed with a cast error rather than the field simply not being filterable.
-- Validation belongs to Zod; this column's job is only to answer when it can.

alter table public.campaign_entities
  drop column if exists level,
  drop column if exists challenge_rating,
  drop column if exists creature_type;

alter table public.campaign_entities
  add column level integer generated always as (
    case when jsonb_typeof(data -> 'level') = 'number'
      then (data ->> 'level')::integer
    end
  ) stored,
  add column challenge_rating numeric generated always as (
    case when jsonb_typeof(data -> 'challengeRating') = 'number'
      then (data ->> 'challengeRating')::numeric
    end
  ) stored,
  add column creature_type text generated always as (
    case when jsonb_typeof(data -> 'creatureType') = 'string'
      then data ->> 'creatureType'
    end
  ) stored;

-- --------------------------------------------------------------- indexes --

-- The list page: one campaign, grouped by kind, ordered by name.
create index if not exists campaign_entities_campaign_kind_name_idx
  on public.campaign_entities (campaign_id, kind, name);

-- Recently edited first, and the hook the block index will hang off later.
create index if not exists campaign_entities_campaign_updated_at_idx
  on public.campaign_entities (campaign_id, updated_at desc);

-- Partial, because most rows have no level and no CR: a PC has one and no
-- creature does, a creature has the other and no PC does.
create index if not exists campaign_entities_campaign_level_idx
  on public.campaign_entities (campaign_id, level)
  where level is not null;

create index if not exists campaign_entities_campaign_cr_idx
  on public.campaign_entities (campaign_id, challenge_rating)
  where challenge_rating is not null;

create index if not exists campaign_entities_campaign_creature_type_idx
  on public.campaign_entities (campaign_id, creature_type)
  where creature_type is not null;

-- "My character", from anywhere.
create index if not exists campaign_entities_player_user_id_idx
  on public.campaign_entities (player_user_id)
  where player_user_id is not null;

-- --------------------------------------------------------------- updated --

drop trigger if exists campaign_entities_touch_updated_at on public.campaign_entities;
create trigger campaign_entities_touch_updated_at
  before update on public.campaign_entities
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- rls --

alter table public.campaign_entities enable row level security;

drop policy if exists "Members read entities they may see" on public.campaign_entities;
create policy "Members read entities they may see"
  on public.campaign_entities for select to authenticated
  using (public.can_read_visibility(campaign_id, visibility, author_id));

-- Two rules composed, not merged.
--
-- `can_write_visibility()` is the documents rule: you may write what you may
-- read, and only if it is yours or you manage the campaign. The second half is
-- what `campaign_characters` had: a player may add their own PC and nothing
-- else. Neither is weakened by the other, and neither is restated here.
drop policy if exists "Managers and players create entities" on public.campaign_entities;
create policy "Managers and players create entities"
  on public.campaign_entities for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_write_visibility(campaign_id, visibility, author_id)
    and (
      public.can_manage_campaign(campaign_id)
      or (kind = 'pc' and player_user_id = (select auth.uid()))
    )
  );

-- `using` checks the row as it stands and `with check` the row as it would be,
-- so both are needed: the first stops editing an entity you cannot write, the
-- second stops editing one into a state you could not have created — handing it
-- to another author, turning your PC into an NPC, or raising it to a tier you
-- would then be unable to open.
drop policy if exists "Managers and players update entities" on public.campaign_entities;
create policy "Managers and players update entities"
  on public.campaign_entities for update to authenticated
  using (
    public.can_write_visibility(campaign_id, visibility, author_id)
    and (
      public.can_manage_campaign(campaign_id)
      or (kind = 'pc' and player_user_id = (select auth.uid()))
    )
  )
  with check (
    public.can_write_visibility(campaign_id, visibility, author_id)
    and (
      public.can_manage_campaign(campaign_id)
      or (kind = 'pc' and player_user_id = (select auth.uid()))
    )
  );

drop policy if exists "Managers and players delete entities" on public.campaign_entities;
create policy "Managers and players delete entities"
  on public.campaign_entities for delete to authenticated
  using (
    public.can_write_visibility(campaign_id, visibility, author_id)
    and (
      public.can_manage_campaign(campaign_id)
      or (kind = 'pc' and player_user_id = (select auth.uid()))
    )
  );

-- ----------------------------------------------------------- reading one --
--
-- The same shape as get_campaign_document(): a security definer function is the
-- only way `secrets` leaves the database, and it hands them over only to
-- someone who manages the campaign. Everyone else gets an empty object, not a
-- null and not an error — "there is nothing here for you" and "there is nothing
-- here" should look identical from the outside.
--
-- The row itself is still gated by can_read_visibility(), so this cannot be
-- used to read an entity the select policy would have hidden.

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
    e.author_id,
    e.created_at,
    e.updated_at
  from public.campaign_entities as e
  where e.id = p_entity_id
    and public.can_read_visibility(e.campaign_id, e.visibility, e.author_id);
$$;

revoke all on function public.get_campaign_entity(uuid) from public;
grant execute on function public.get_campaign_entity(uuid) to authenticated;

-- Prevent bypassing that function with a direct PostgREST column select. Every
-- column is granted back except `secrets`; because Postgres checks column
-- privileges on anything referenced in a `where` clause as well as in the
-- select list, this also stops `?secrets->>trueName=eq.Vecna` being used to
-- guess at the contents one query at a time.
revoke select on public.campaign_entities from authenticated;
grant select (
  id,
  campaign_id,
  kind,
  name,
  system_id,
  player_user_id,
  summary,
  data,
  visibility,
  author_id,
  level,
  challenge_rating,
  creature_type,
  created_at,
  updated_at
) on public.campaign_entities to authenticated;

-- ----------------------------------------------------- the 5e definition --
--
-- Seeded rather than migrated: re-pasting this file updates the definition in
-- place, which is how a ruleset is meant to be edited.
--
-- What is *in* here is the shape of the game — which abilities exist, which
-- ability governs each skill, what proficiency bonus a level grants. What is
-- not in here are the three rules that are structural rather than editorial:
-- a modifier from a score, a save as modifier plus proficiency, a skill as
-- modifier plus proficiency times rank. Those live in the derivation module,
-- driven off these lists, because writing them out eighteen times as formulas
-- would be transcription rather than configuration.
--
-- `derived` is for what genuinely differs between systems. Each formula is a
-- tree of closed operations — const, level, proficiency, abilityMod,
-- abilityScore, stat, sum, min, max — evaluated by that same pure module. It is
-- deliberately not an expression language: a system definition is data, and
-- data that can compute arbitrarily is a program.
--
-- The mechanics below are from the SRD 5.2.1, which is CC-BY-4.0. The notice
-- travels with the definition so the attribution has a single source; the app
-- renders it from `definition -> 'license'`.

insert into public.game_systems (key, name, version, definition)
values (
  'dnd5e',
  'D&D 5e (SRD 5.2.1)',
  '5.2.1',
  jsonb_build_object(
    'abilityModifier', jsonb_build_object('offset', 10, 'divisor', 2),

    'abilities', jsonb_build_array(
      jsonb_build_object('key', 'str', 'name', 'Strength', 'abbr', 'STR'),
      jsonb_build_object('key', 'dex', 'name', 'Dexterity', 'abbr', 'DEX'),
      jsonb_build_object('key', 'con', 'name', 'Constitution', 'abbr', 'CON'),
      jsonb_build_object('key', 'int', 'name', 'Intelligence', 'abbr', 'INT'),
      jsonb_build_object('key', 'wis', 'name', 'Wisdom', 'abbr', 'WIS'),
      jsonb_build_object('key', 'cha', 'name', 'Charisma', 'abbr', 'CHA')
    ),

    'abilityScoreRange', jsonb_build_object('min', 1, 'max', 30),

    'skills', jsonb_build_array(
      jsonb_build_object('key', 'acrobatics', 'name', 'Acrobatics', 'ability', 'dex'),
      jsonb_build_object('key', 'animalHandling', 'name', 'Animal Handling', 'ability', 'wis'),
      jsonb_build_object('key', 'arcana', 'name', 'Arcana', 'ability', 'int'),
      jsonb_build_object('key', 'athletics', 'name', 'Athletics', 'ability', 'str'),
      jsonb_build_object('key', 'deception', 'name', 'Deception', 'ability', 'cha'),
      jsonb_build_object('key', 'history', 'name', 'History', 'ability', 'int'),
      jsonb_build_object('key', 'insight', 'name', 'Insight', 'ability', 'wis'),
      jsonb_build_object('key', 'intimidation', 'name', 'Intimidation', 'ability', 'cha'),
      jsonb_build_object('key', 'investigation', 'name', 'Investigation', 'ability', 'int'),
      jsonb_build_object('key', 'medicine', 'name', 'Medicine', 'ability', 'wis'),
      jsonb_build_object('key', 'nature', 'name', 'Nature', 'ability', 'int'),
      jsonb_build_object('key', 'perception', 'name', 'Perception', 'ability', 'wis'),
      jsonb_build_object('key', 'performance', 'name', 'Performance', 'ability', 'cha'),
      jsonb_build_object('key', 'persuasion', 'name', 'Persuasion', 'ability', 'cha'),
      jsonb_build_object('key', 'religion', 'name', 'Religion', 'ability', 'int'),
      jsonb_build_object('key', 'sleightOfHand', 'name', 'Sleight of Hand', 'ability', 'dex'),
      jsonb_build_object('key', 'stealth', 'name', 'Stealth', 'ability', 'dex'),
      jsonb_build_object('key', 'survival', 'name', 'Survival', 'ability', 'wis')
    ),

    -- Which skills also get a passive score, at 10 + the skill's modifier.
    -- Perception is the one the rules lean on; the other two come up often
    -- enough that a GM should not have to work them out at the table.
    'passiveSkills', jsonb_build_array('perception', 'insight', 'investigation'),

    -- Indexed by level, so element 0 is level 1.
    'proficiencyBonusByLevel', jsonb_build_array(
      2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6
    ),
    'levelRange', jsonb_build_object('min', 1, 'max', 20),

    -- Proficiency ranks, as multipliers of the proficiency bonus.
    'proficiencyRanks', jsonb_build_array(
      jsonb_build_object('key', 'none', 'name', 'Not proficient', 'multiplier', 0),
      jsonb_build_object('key', 'proficient', 'name', 'Proficient', 'multiplier', 1),
      jsonb_build_object('key', 'expertise', 'name', 'Expertise', 'multiplier', 2)
    ),

    -- The system-specific arithmetic. Everything here can be overridden on any
    -- entity; a statblock is an entity where all of it is.
    'derived', jsonb_build_array(
      jsonb_build_object(
        'key', 'armorClass',
        'label', 'Armor Class',
        -- Unarmoured. Armour is out of scope for this pass, so a character in
        -- plate sets an override until inventory exists to compute it.
        'formula', jsonb_build_object('op', 'sum', 'of', jsonb_build_array(
          jsonb_build_object('op', 'const', 'value', 10),
          jsonb_build_object('op', 'abilityMod', 'ability', 'dex')
        ))
      ),
      jsonb_build_object(
        'key', 'initiative',
        'label', 'Initiative',
        -- Written `+2` rather than `2`. Which of those a stat is cannot be
        -- worked out from its formula — Armor Class is built from a modifier
        -- and is not one — so the system says.
        'display', 'modifier',
        'formula', jsonb_build_object('op', 'abilityMod', 'ability', 'dex')
      ),
      jsonb_build_object(
        'key', 'spellSaveDc',
        'label', 'Spell save DC',
        -- 8 + proficiency + the spellcasting ability modifier. Which ability
        -- that is depends on class, which this pass does not model, so the
        -- computed value assumes none and the sheet expects an override from
        -- anyone who casts. Present because leaving it out would make the
        -- override impossible rather than merely manual.
        'formula', jsonb_build_object('op', 'sum', 'of', jsonb_build_array(
          jsonb_build_object('op', 'const', 'value', 8),
          jsonb_build_object('op', 'proficiency')
        ))
      )
    ),

    -- Pools the sheet tracks between rests. Not derived: maximum hit points
    -- depend on class hit dice, which this pass does not model.
    'resources', jsonb_build_array(
      jsonb_build_object('key', 'hitPoints', 'label', 'Hit points', 'track', 'pool'),
      jsonb_build_object('key', 'hitDice', 'label', 'Hit dice', 'track', 'pool'),
      jsonb_build_object('key', 'temporaryHitPoints', 'label', 'Temporary HP', 'track', 'counter')
    ),

    'sizes', jsonb_build_array(
      'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'
    ),

    'creatureTypes', jsonb_build_array(
      'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
      'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant',
      'undead'
    ),

    'damageTypes', jsonb_build_array(
      'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
      'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
    ),

    'conditions', jsonb_build_array(
      'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
      'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
      'prone', 'restrained', 'stunned', 'unconscious'
    ),

    'license', jsonb_build_object(
      'name', 'CC BY 4.0',
      'url', 'https://creativecommons.org/licenses/by/4.0/legalcode',
      'sourceUrl', 'https://www.dndbeyond.com/srd',
      'notice',
        'This work includes material from the System Reference Document 5.2.1 '
        '("SRD 5.2.1") by Wizards of the Coast LLC, available at '
        'https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the '
        'Creative Commons Attribution 4.0 International License, available at '
        'https://creativecommons.org/licenses/by/4.0/legalcode.'
    )
  )
)
on conflict (key) do update
  set name = excluded.name,
      version = excluded.version,
      definition = excluded.definition;

-- ------------------------------------------------- carrying the old rows --
--
-- Every existing character becomes an entity, keeping its id so that anything
-- already pointing at one still resolves. `campaign_characters` is left in
-- place and simply stops being read: dropping a table with somebody's campaign
-- in it is not something a migration should decide on its own.
--
-- Guarded twice — the table may already be gone, and the rows may already have
-- been copied — so the file can be pasted again without doing anything a second
-- time.

do $$
declare
  v_system_id uuid;
begin
  if to_regclass('public.campaign_characters') is null then
    return;
  end if;

  select id into v_system_id from public.game_systems where key = 'dnd5e';

  insert into public.campaign_entities (
    id, campaign_id, kind, name, system_id, player_user_id, summary,
    data, secrets, visibility, author_id, created_at, updated_at
  )
  select
    c.id,
    c.campaign_id,
    c.kind,
    c.name,
    v_system_id,
    c.player_user_id,
    c.description,
    -- No stats to carry: the old table had none. A PC starts derived, an NPC
    -- starts as a statblock, which is what each of them almost always is.
    jsonb_build_object('derive', c.kind = 'pc'),
    '{}'::jsonb,
    'shared',
    -- author_id is not nullable and `created_by` was; a row whose creator has
    -- since deleted their account is attributed to the campaign's owner, who is
    -- guaranteed to exist because the owner membership cannot be deleted.
    coalesce(
      c.created_by,
      (
        select m.user_id
        from public.campaign_memberships m
        where m.campaign_id = c.campaign_id and m.role = 'owner'
        limit 1
      )
    ),
    c.created_at,
    c.created_at
  from public.campaign_characters c
  where not exists (
    select 1 from public.campaign_entities e where e.id = c.id
  );
end;
$$;
