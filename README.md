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
| `/app/campaigns/:campaignId` | authenticated | Campaign workspace shell       |
| `/app/settings`              | authenticated | Account settings (placeholder) |

## Database

Migrations live in `supabase/migrations/` and are applied by pasting them into the
Supabase dashboard SQL editor (or with `npx supabase db push` once the project is
linked). They must be run in filename order.

```
auth.users  <->  campaign_memberships (role: owner | gm | player)  <->  campaigns
```

Row level security is the only access control: a user sees a campaign because a
membership row connects them to it. Campaigns are created through the
`create_campaign(p_name)` function so the campaign and its owner membership are
written in one transaction.

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
  campaigns/              campaign types, queries and data-loading hooks
  lib/supabase/client.ts  the only place Supabase is constructed
  components/ui/          Alert, Button, Card, Input, Page primitives
  components/layout/      PublicLayout, AppLayout (application shell)
  pages/public|auth|app/  one file per page
  styles/global.css       CSS custom properties and base styles
```
