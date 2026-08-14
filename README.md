# TTRPG-Campaign-Manager

A lightweight TTRPG campaign companion. This repository currently contains only the
**first architectural iteration**: routing, authentication and empty page shells.
No campaign data is persisted yet.

## Stack

React 19 · TypeScript · Vite · React Router 7/8 · plain CSS · Supabase Auth ·
TipTap (ProseMirror) · Vitest

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Other scripts: `npm run build` (type check + production build), `npm run preview`,
`npm run lint`, `npm test` (`npm run test:watch` while working).

The app runs without Supabase configured — the public site works and the auth pages
explain what is missing instead of failing with an obscure error.

## Environment variables

| Variable                  | Where to find it                                    |
| ------------------------- | --------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Supabase dashboard → Project Settings → API → URL    |
| `VITE_SUPABASE_ANON_KEY`  | Same page → anon / publishable key                   |

Only `.env.example` is committed; `.env*` files are git-ignored.

## Routes

| Route                        | Access        | Purpose                        |
| ---------------------------- | ------------- | ------------------------------ |
| `/`                          | public        | Landing page                   |
| `/login`                     | public only   | Sign in                        |
| `/signup`                    | public only   | Create account                 |
| `/app`                       | authenticated | Campaign dashboard             |
| `/app/campaigns/new`         | authenticated | Create a campaign              |
| `/app/campaigns/:campaignId` | authenticated | Campaign workspace (Overview)  |
| `/app/campaigns/:campaignId/sessions` | authenticated | Game sessions          |
| `/app/campaigns/:campaignId/entities` | authenticated | Player characters, NPCs and creatures |
| `/app/campaigns/:campaignId/entities/new` | authenticated | Create one |
| `/app/campaigns/:campaignId/entities/:entityId` | authenticated | One entity's sheet |
| `/app/campaigns/:campaignId/entities/:entityId/edit` | authenticated | Edit one |
| `/app/campaigns/:campaignId/locations` | authenticated | Locations              |
| `/app/campaigns/:campaignId/quests` | authenticated | Quests                    |
| `/app/campaigns/:campaignId/notes` | authenticated | Notes, shared or private   |
| `/app/campaigns/:campaignId/documents` | authenticated | Rich-text documents    |
| `/app/campaigns/:campaignId/documents/:documentId` | authenticated | One document, in the editor |
| `/app/campaigns/:campaignId/maps` | authenticated | Uploaded map images         |
| `/app/campaigns/:campaignId/members` | authenticated | Members and invitations |
| `/app/settings`              | authenticated | Account settings (placeholder) |

Campaign sections are child routes of `:campaignId`. The layout loads the campaign
once and passes it down through the router outlet context, so `Locations`,
`Quests` and the rest are added the same way `sessions` and `characters` were.

## Database

Migrations live in `supabase/migrations/` and are applied by pasting them into the
Supabase dashboard SQL editor (or with `npx supabase db push` once the project is
linked). They must be run in filename order.

```
auth.users  <->  campaign_memberships (role: owner | gm | player)  <->  campaigns
     |                                                              /        \
  profiles (email)                    campaign_invitations (email, role)   campaign_sessions
```

Content tables (`campaign_sessions`, `campaign_characters`, `campaign_locations`,
`campaign_quests`, and later notes) all follow one shape: a `campaign_id` foreign
key, and policies built only from the membership helpers — `is_campaign_member()`
to read, `can_manage_campaign()` (owner or GM) to write. Rows are inserted
directly by the client, because unlike memberships there is no companion row to
keep in step.

There are four variants to copy from:

- **`campaign_sessions`** — only owners and GMs write. The simpler case, and what
  locations and quests copy verbatim.
- **`campaign_characters`** — adds per-row ownership through `player_user_id`, so
  a player may write their own character and nothing else. Superseded by
  `campaign_entities`, which composes this rule with the documents one; the
  table is left in place but nothing reads it.
- **`campaign_notes`** — every member writes, only the author edits or deletes,
  and `is_private` narrows the read policy to the author alone.
- **`campaign_documents`** — the same idea as notes, but with three tiers
  instead of a boolean, and the rule factored out of the policies. Copy this one
  for anything with a visibility flag.

Maps are the exception to "everything is a row": the image lives in the private
`campaign-maps` storage bucket and `campaign_maps` records it, optionally tied to
a location (`location_id`, nullable — a map either depicts one location or the
whole campaign). Object paths are always `<campaign_id>/<uuid>.<ext>`; the
policies on `storage.objects` parse the campaign id out of the path and call the
same membership helpers, so storage access mirrors table access. Size and MIME
limits live on the bucket. Images are displayed through hour-long signed URLs.

### Documents

`campaign_documents` holds a TipTap (ProseMirror) tree in a `jsonb` column
rather than a `text` body. It is the groundwork for search: a document is later
split into per-block index rows, and every result anchors to a block rather than
to the document.

Visibility is a three-value enum, not a boolean:

| tier          | who reads it                                            |
| ------------- | ------------------------------------------------------- |
| `shared`      | every member                                            |
| `gm_only`     | owners and GMs                                          |
| `author_only` | the author, and nobody else — not the GM, not the owner |

`author_only` is `campaign_notes.is_private` under a new name, with its meaning
unchanged. **A GM does not get to read it.** That is the point of the tier, and
it is the clause most likely to be "fixed" later by someone who assumes an owner
should see everything.

Two rules carry all of it, and both live in SQL:

- `can_read_visibility(campaign_id, visibility, author_id)` — the only read rule.
  Unknown tiers fall through to false, so extending the check constraint without
  teaching this function denies access rather than granting it.
- `can_write_visibility(...)` — you may write what you may read, and only if it
  is yours or you manage the campaign. Building on the read rule is what stops a
  player creating a `gm_only` document they could not then open.

Every policy on the table is one of those two calls. Anything added later that
reads documents or their blocks should call them rather than writing its own
comparison — the search index will filter on exactly this rule, and a second
copy of it would drift.

A `secret` node inside a document narrows its subtree to `gm_only`. Nesting only
ever narrows: `mostRestrictive()` in `src/documents/visibility.ts` combines a
block's inherited visibility with its document's tier, so a secret inside an
`author_only` document stays `author_only`.

### Entities

`campaign_entities` holds player characters, NPCs and creatures in one table,
told apart by `kind`. It replaces `campaign_characters`, which is left in place
but no longer read.

**No rule is a column.** There is no `strength` field and there will not be one.
A ruleset is a row in `game_systems` whose `definition` jsonb says which
abilities exist, which ability governs each skill, what proficiency bonus a
level grants, and how the system's own derived stats are worked out. An entity
references that row and keeps its numbers in `data`. Adding a second system is
writing a second row, not writing a migration.

Three rules divide the work, and getting them confused is the likely future
mistake:

- **The definition** holds what varies between systems — the lists, the tables,
  and `derived` formulas as trees of closed operations (`const`, `level`,
  `proficiency`, `abilityMod`, `abilityScore`, `stat`, `sum`, `min`, `max`).
  Deliberately not an expression language: data that can compute arbitrarily is
  a program.
- **`src/entities/derive.ts`** holds what is structural — a modifier from a
  score, a save as modifier plus proficiency, a skill as modifier plus
  proficiency times rank, a passive as `passiveBase` plus a skill. Pure, and
  covered by tests that need no database.
- **Zod** (`src/entities/system.ts`, `src/entities/entityData.ts`) validates
  both blobs at the application boundary. Postgres treats `data` as opaque apart
  from three generated columns — `level`, `challenge_rating`, `creature_type` —
  which exist so a list can filter and sort without the blob being indexed.

Store inputs, derive outputs, allow overrides. Nothing computed is ever written
to the database. Every derived value is a `Derived<T>`:

```ts
type Derived<T> = { computed: T | null; override: T | null }  // display = override ?? computed
```

That is what lets one table and one renderer hold a level 3 rogue and an adult
red dragon. A statblock is an entity with `derive: false` and its numbers in
`data.overrides`: the computed half is null, the display value is the assertion,
and no second code path exists.

Visibility is the documents rule, unchanged — `can_read_visibility()` and
`can_write_visibility()`, composed with the per-row ownership clause
`campaign_characters` had, so a player may still write their own PC and nothing
else. GM-only fields live in a `secrets` column protected the way document
bodies are: the blanket `select` grant is revoked, every other column is granted
back by name, and `get_campaign_entity()` decides who gets `secrets`. Because
Postgres checks column privileges inside `where` clauses too, that also closes
the `?secrets->>trueName=eq.…` guessing channel. **Never `select('*')` on this
table** — it will fail rather than quietly omit the column, which is the point.

Secrets are written through `saveEntitySecrets()` rather than as part of
`updateEntity()`. A player is sent an empty secrets object, and a combined save
would write that emptiness back over the GM's notes with no error raised.

On the UI side the matching pages share one stylesheet,
`pages/app/campaign/entryList.css`. The pages themselves stay separate and
explicit — they differ in fields, grouping and permissions, and a generic
"section" component would hide more than it saved.

Row level security is the only access control: a user sees a campaign because a
membership row connects them to it.

Memberships are never inserted directly. Two `security definer` functions own
that, so a campaign and its first member always appear together:

- `create_campaign(p_name)` — creates the campaign and the caller's owner membership
- `accept_invitation(p_invitation_id)` — creates the membership and consumes the invitation

`profiles` exists because `auth.users` is not reachable through the API; a trigger
keeps `email` in step. `display_name` is the one field a user writes themselves,
and a column level grant — not a policy — is what stops them touching `email`:
policies cannot compare against the old row. `campaign_invitations` is addressed to an email because the
invited person may not have an account yet — a pending invitation is simply a row
that still exists. Nothing sends email; the invitee sees it on their dashboard.

The `owner` membership row cannot be deleted, so a campaign can never be orphaned.

Everything campaign-scoped added later (sessions, characters, locations, quests,
notes, maps) should reference `campaigns(id)`, reuse the `is_campaign_member()` /
`is_campaign_owner()` helpers in its policies, and live beneath
`/app/campaigns/:campaignId/...` in the UI.

## Source layout

```
src/
  App.tsx                 route table
  main.tsx                entry: BrowserRouter + AuthProvider
  auth/                   session state and route guards
  campaigns/              types, queries (campaignsApi.ts) and hooks
  documents/              visibility rules, the block walker, autosave
  entities/               ruleset schema, entity data schema, the derivation
  editor/                 TipTap: the editor, block uids, the secret node
  profile/                the signed-in user's own profile
  lib/supabase/client.ts  the only place Supabase is constructed
  lib/useAsyncData.ts     the app's entire data-loading strategy
  components/ui/          Alert, Button, Card, Input, Select, Textarea, Checkbox, Page
  components/layout/      PublicLayout, AppLayout (application shell)
  pages/public|auth|app/  one file per page
  pages/app/campaign/     the campaign workspace layout and its child routes
  styles/global.css       CSS custom properties and base styles
```

## Tests

`npm test` runs Vitest over `src/**/*.test.ts`. Tests sit next to what they test.

What is covered today is the pure logic the document and entity features rest
on. For entities that is the derivation module — ability modifiers, proficiency
by level, saves, skills, expertise, passives, null propagation, override
precedence, statblock mode and a system definition that names itself in a circle
— plus the two Zod schemas, tested for the mistakes a hand-written ruleset
actually makes: a skill governed by an ability that does not exist, a
proficiency table shorter than the game has levels, an ability keyed `strength`
in a system whose ability is `str`.

For documents it is the
visibility resolver, the block walker, and block uid assignment. The walker is
deliberately a pure function — `(pmDoc, visibility) => blocks`, no database, no
clock — because anchors, snippets and secret isolation are all decided in it.
Block uids are tested against a headless ProseMirror state; a real browser would
only be testing the browser.

Access control is not covered by these. Policies can only be tested against a
database that is enforcing them, which needs two signed-in accounts with
different roles, and arrives with the search feature.

## Licences

The 5e ruleset seeded by `supabase/migrations/20260814090000_entities.sql`
transcribes mechanics from the SRD. The notice travels inside the system
definition itself, so the app renders it from the same row that creates the
obligation — see Settings → Rulesets and licences.

> This work includes material from the System Reference Document 5.2.1
> ("SRD 5.2.1") by Wizards of the Coast LLC, available at
> https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative
> Commons Attribution 4.0 International License, available at
> https://creativecommons.org/licenses/by/4.0/legalcode.

Only the mechanics are used. The published character sheet's layout is not
reproduced, and the entity pages are deliberately plain fields rather than an
imitation of it.
