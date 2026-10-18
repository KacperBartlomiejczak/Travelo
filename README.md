# Travelo

A mobile app for **the one person who organizes a trip for a group of friends**. Only the organizer needs the app. Friends are added to a trip by name and interests, with no account. A friend who has an account can optionally be linked by user ID to follow the plan read-only.

Built with React Native + Expo, Supabase and Zod. Platforms: iOS and Android. Languages: Polish and English. Light and dark mode.

## What it does

| Feature | Status |
|---|---|
| **Trip setup** — a 4-step wizard: flights → friends → budget → name and cover | Done |
| **Members** — friends with interests (17 tags in 6 groups), no account needed | Done |
| **Flights and layovers** — manual entry; layovers are derived from consecutive segments, with airport-local times and time zones | Done |
| **Trips in Supabase** — anonymous sign-in, Postgres with Row Level Security | Done |
| **Side panel** with all trips ("Nadchodzące" / "Minione") and a trip menu: rename, change the cover, change the budget, delete | Done |
| **Trip photos** — a strip under the cover, a full-screen viewer, private storage, GPS removed from every photo | Done |
| **Budget per person**, editable **offline** and synced later (last write wins), with a visible sync status | Done |
| **Offline reading** — the trip list and every trip opened on the phone are kept in SQLite | Done |
| **Floating pill navigation** with five screens: Podróż, Wydatki, Miejsca, Plan, Profil (the last four are placeholders for now) | Done |
| **Trip covers** — ready-made covers bundled in the app, or a photo from the gallery | In progress |
| **Expenses during the trip** — added in seconds, multi-currency, works offline | Planned |
| **AI day plans** — a per-day schedule built from real Google Places, with cost ranges and group splits | Planned |
| **Plan vs reality** — a live daily budget and an end-of-trip summary, shareable as an image | Planned |

Not planned: flight or hotel booking, a social feed, user reviews, and settlements ("who owes whom").

## Screens

- **Podróż (home)** — the current trip: a cover photo fading into ink, the photo strip, flights with layovers, travellers, and the budget card.
- **Side panel** — all trips; choose the current trip or start a new one.
- **Create-trip wizard** — flights, friends, budget, summary.
- **Photo viewer** — full-screen, swipe, delete.
- **Wydatki / Miejsca / Plan / Profil** — empty placeholders until their features are built.

## Offline behavior

| What | Offline? |
|---|---|
| Change the budget per person | **Yes** — saved in SQLite, synced when the connection is back |
| Read the trip list and any trip opened before | **Yes** — read-only copies in SQLite |
| Create, rename or delete a trip; add or delete photos | No — needs internet |
| Expenses (when built) | **Yes** — SQLite first, synced later |

## Tech stack

- **App:** Expo SDK 57, React Native 0.86, React 19, expo-router, TypeScript (strict)
- **Data fetching:** TanStack Query
- **Validation and types:** Zod — the single source of truth for every data shape
- **Local storage:** SQLite (`expo-sqlite`)
- **Backend:** Supabase — Postgres, Auth, Row Level Security, Storage (Edge Functions are planned)
- **i18n:** i18next (`pl`, `en`)
- **Planned:** Google Places and Routes APIs, an FX rates API, Google Gemini (called only from Edge Functions)

## Getting started

Requirements: Node.js 22+, [pnpm](https://pnpm.io), and an Android emulator, an iOS simulator or a development build. Some native modules mean Expo Go is not enough.

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` (git-ignored) and fill in your Supabase project:

   ```
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_KEY=
   ```

   The key must be a publishable key (`sb_publishable_…`). The app refuses to start with anything else. In the Supabase dashboard, enable **Anonymous sign-ins** and apply the migrations from `supabase/migrations/`.

3. Start the app

   ```bash
   pnpm start
   ```

   Or `pnpm android`, `pnpm ios`, `pnpm web`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm start` / `android` / `ios` / `web` | Start the Expo dev server |
| `pnpm test` | Run the Jest suite |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `expo lint` |
| `pnpm test:db` | Run the SQL tests in `supabase/tests/` (needs `DB_URL`; Storage tests need a local Supabase) |
| `pnpm db:types` | Regenerate `src/data/database.types.ts` from a local Supabase |

A change is done only when tests, typecheck and lint are all green.

## Project structure

```
src/
  app/           Expo Router routes only
  components/    Shared UI
  features/      drawer, home, nav, trip-create, trip-photos
  hooks/         TanStack Query hooks
  data/          Repositories, Supabase client, SQLite store, sync
  lib/           Pure logic: time zones, layovers, money, airport search
  schemas/       Zod schemas
  providers/     App-wide providers
  i18n/          pl / en dictionaries
  theme/         Design tokens, light and dark themes
supabase/        Migrations and SQL (RLS) tests
context/         app-context.md, design-context.md
prompts/         One plan.md per feature
```

## Documentation

| File | What is in it |
|---|---|
| [`context/app-context.md`](context/app-context.md) | What the app is and does: features, screens, domain model, offline behavior, backend |
| [`Architecture.md`](Architecture.md) | How the code is built right now: modules, data flow, decisions, tech debt |
| [`context/design-context.md`](context/design-context.md) | The Sunline design system |
| [`GLOSSARY.md`](GLOSSARY.md) | Domain terms |
| [`CLAUDE.md`](CLAUDE.md) | Project rules and the working process |
| `prompts/<feature>/plan.md` | The plan, decisions and progress log of each feature |

## How it is built

Every feature gets a written plan in `prompts/<feature>/plan.md` that is approved before any code. Work is test-first (red, green, refactor). Data shapes are Zod schemas, and SQL migrations mirror them.
