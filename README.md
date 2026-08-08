# TTRPG-Campaign-Manager

A lightweight TTRPG campaign companion. This repository currently contains only the
**first architectural iteration**: routing, authentication and empty page shells.
No campaign data is persisted yet.

## Stack

React 19 · TypeScript · Vite · React Router 7/8 · plain CSS · Supabase Auth

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Other scripts: `npm run build` (type check + production build), `npm run preview`,
`npm run lint`.

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
| `/app/campaigns/:campaignId/members` | authenticated | Members and invitations |
| `/app/settings`              | authenticated | Account settings (placeholder) |

Campaign sections are child routes of `:campaignId`. The layout loads the campaign
once and passes it down through the router outlet context, so `Sessions`,
`Characters` and the rest are added the same way `members` was.

## Database

Migrations live in `supabase/migrations/` and are applied by pasting them into the
Supabase dashboard SQL editor (or with `npx supabase db push` once the project is
linked). They must be run in filename order.

```
auth.users  <->  campaign_memberships (role: owner | gm | player)  <->  campaigns
     |                                                                    |
  profiles (email)                              campaign_invitations (email, role)
```

Row level security is the only access control: a user sees a campaign because a
membership row connects them to it.

Memberships are never inserted directly. Two `security definer` functions own
that, so a campaign and its first member always appear together:

- `create_campaign(p_name)` — creates the campaign and the caller's owner membership
- `accept_invitation(p_invitation_id)` — creates the membership and consumes the invitation

`profiles` exists because `auth.users` is not reachable through the API; a trigger
keeps it in step. `campaign_invitations` is addressed to an email because the
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
  lib/supabase/client.ts  the only place Supabase is constructed
  lib/useAsyncData.ts     the app's entire data-loading strategy
  components/ui/          Alert, Button, Card, Input, Select, Page primitives
  components/layout/      PublicLayout, AppLayout (application shell)
  pages/public|auth|app/  one file per page
  pages/app/campaign/     the campaign workspace layout and its child routes
  styles/global.css       CSS custom properties and base styles
```
