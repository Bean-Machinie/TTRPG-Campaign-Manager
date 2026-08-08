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
| `/app/campaigns/new`         | authenticated | Create campaign (placeholder)  |
| `/app/campaigns/:campaignId` | authenticated | Campaign workspace shell       |
| `/app/settings`              | authenticated | Account settings (placeholder) |

## Source layout

```
src/
  App.tsx                 route table
  main.tsx                entry: BrowserRouter + AuthProvider
  auth/                   session state and route guards
  lib/supabase/client.ts  the only place Supabase is constructed
  components/ui/          Button, Card, Input, Page primitives
  components/layout/      PublicLayout, AppLayout (application shell)
  pages/public|auth|app/  one file per page
  data/demoCampaigns.ts   temporary demo data, delete once persisted
  styles/global.css       CSS custom properties and base styles
```

## Future data model (not implemented)

```
User  <->  CampaignMembership (role: owner | gm | player)  <->  Campaign
```

Everything campaign-scoped (sessions, characters, locations, quests, notes, maps)
will belong to a campaign and live beneath `/app/campaigns/:campaignId/...`.
