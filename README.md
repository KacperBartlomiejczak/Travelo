# Travelo

A mobile app for **the one person who organizes a trip for a group of friends**.

Only the organizer needs the app. Friends are added to a trip by name and interests, with no account. A friend who has an account can optionally be linked by user ID to follow the plan read-only.

Built with React Native + Expo, Supabase and Zod. It runs on iOS and Android, in Polish and English, in light and dark mode.

> **Status:** early development. The trip setup, trip list, photos and the offline budget work today. Expenses, AI day plans and the budget summary are still to come (see [Roadmap](#roadmap)).

## Table of contents

- [What the app does](#what-the-app-does)
- [Roadmap](#roadmap)
- [Screens](#screens)
- [Offline behavior](#offline-behavior)
- [Tech stack](#tech-stack)
- [Installation](#installation)
- [Running the app](#running-the-app)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)

## What the app does

Planning a trip for friends means juggling flights, who likes what, a budget, and later, who paid for what. Travelo keeps all of it with the person who does the organizing.

- **Trip setup.** A 4-step wizard: flights → friends → budget per person → name and cover photo.
- **Flights and layovers.** The organizer enters flight segments by hand: airport (searched in a bundled list of about 3,150 airports), airport-local date and time, and an optional flight number. Layovers are never typed in. They are derived from consecutive segments, with correct time zones, and a time that does not exist because of a clock change is rejected.
- **Friends.** Each friend has a name and interests, chosen from 17 tags in 6 groups. A friend needs no account.
- **Budget.** One amount per person for the whole trip, without flights, in the destination's currency, PLN, EUR or USD. The group total and the per-day figure are derived.
- **All your trips.** A side panel lists trips as "Nadchodzące" (upcoming) and "Minione" (past). The home screen shows the one you picked.
- **Trip photos.** Add photos from the gallery to a trip. They are shrunk on the phone, stripped of GPS and other metadata, and stored in private storage.
- **Trip menu.** Rename a trip, change its cover or budget, or delete it.

## Roadmap

| Feature | Status |
|---|---|
| Trip setup wizard, friends, flights and layovers | Done |
| Trips in Supabase (anonymous sign-in, Row Level Security) | Done |
| Side panel with all trips, trip menu (rename, cover, budget, delete) | Done |
| Trip photos (strip, full-screen viewer, private storage) | Done |
| Budget per person editable offline, synced later, with a visible sync status | Done |
| Offline reading of the trip list and every trip opened on the phone | Done |
| Floating pill navigation with five screens (four are placeholders for now) | Done |
| Ready-made trip covers bundled in the app | In progress |
| Profile tab (replaces "Ustawienia") | In progress |
| **Expenses during the trip**: added in seconds, multi-currency, works offline | Planned |
| **AI day plans** built from real Google Places, with cost ranges and group splits | Planned |
| **Plan vs reality**: a live daily budget and an end-of-trip summary, shareable as an image | Planned |
| "Rebuild the rest of today" (rain, closed place, tired group) | Later |
| Receipt photo or one-sentence expense entry parsed by AI | Later |

**Not planned:** flight or hotel booking, a social feed, user reviews, and settlements ("who owes whom").

## Screens

| Screen | What it is |
|---|---|
| **Podróż** (home) | The current trip: a cover photo fading into ink, the photo strip, flights with layovers, travellers and the budget card. |
| **Side panel** | All trips. Swipe from the left edge on the home screen, or tap the menu button. |
| **Create-trip wizard** | Flights, friends, budget, summary. Leaving with entered data asks for confirmation. |
| **Photo viewer** | Full screen, swipe between photos, delete. |
| **Wydatki / Miejsca / Plan / Profil** | Empty placeholders until their features are built. |

The bottom navigation is a floating pill. It is hidden in the wizard and in the photo viewer.

## Offline behavior

The app is built to be useful with a bad connection. Only some things work offline, by design.

| What | Offline? |
|---|---|
| Change the budget per person | **Yes.** Saved on the phone (SQLite), sent to the server later. The newest change wins. A sync status shows whether it has been sent. |
| Read the trip list and any trip opened before | **Yes.** Read-only copies are kept in SQLite. |
| Expenses (when built) | **Yes.** Saved locally first, synced when the connection returns. |
| Create, rename or delete a trip; add or delete photos | No. These need internet. |

A trip that was never opened on the phone has no copy, so it cannot be opened offline.

## Tech stack

| Area | Choice |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19, expo-router, TypeScript (strict) |
| Data fetching | TanStack Query |
| Validation and types | Zod: the single source of truth for every data shape |
| On-device storage | SQLite (`expo-sqlite`) |
| Backend | Supabase: Postgres, Auth, Row Level Security, Storage |
| i18n | i18next (Polish and English) |
| Icons and fonts | lucide, DM Sans, Fraunces |
| Planned | Edge Functions, Google Places and Routes APIs, an FX rates API, Google Gemini (called only from Edge Functions) |

## Installation

### Prerequisites

- **Node.js 22 or newer.** The tests use Node's built-in SQLite.
- **[pnpm](https://pnpm.io/installation).** The repo uses pnpm. Do not use npm or yarn.
- **An Android emulator or iOS simulator, or a phone**, to run the app:
  - Android: [Android Studio](https://docs.expo.dev/workflow/android-studio-emulator/)
  - iOS (macOS only): [Xcode and a simulator](https://docs.expo.dev/workflow/ios-simulator/)
- **A Supabase project**, hosted or local (see below).
- Optional, for the database tests: [Docker](https://docs.docker.com/get-docker/) (for local Supabase) and `psql`.

### 1. Clone and install

```bash
git clone https://github.com/KacperBartlomiejczak/Travelo.git
cd Travelo
pnpm install
```

Add dependencies with `npx expo install <package>`, not `pnpm add`, so versions match the Expo SDK.

### 2. Set up Supabase

The app needs a Supabase project. Pick one of the two options.

**Option A: a hosted project**

1. Create a project at [supabase.com](https://supabase.com).
2. In **Authentication → Sign In / Providers**, turn on **Anonymous sign-ins**. The app signs in anonymously on first launch, and trips cannot be saved without it.
3. Apply the migrations from `supabase/migrations/` (for example with `pnpm supabase link` and `pnpm supabase db push`).
4. Copy the project URL and the **publishable** key (`sb_publishable_…`) from **Project Settings → API**.

**Option B: a local project** (needs Docker)

```bash
pnpm supabase start
```

This applies the migrations and prints the API URL and the publishable key. Run `pnpm supabase status` to see them again. Anonymous sign-ins are already on in `supabase/config.toml`. The Android emulator reaches your computer at `http://10.0.2.2:54321`. The app allows plain `http` only for `127.0.0.1`, `localhost` and `10.0.2.2`.

### 3. Add the environment variables

Copy `.env.example` to `.env.local` (it is git-ignored) and fill it in:

```bash
cp .env.example .env.local
```

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
```

The app checks both values at startup. The key must start with `sb_publishable_`, so a secret key can never ship in the app. Never put a secret key in `.env.local`.

## Running the app

```bash
pnpm start
```

Then press `a` for Android or `i` for iOS in the Expo terminal. You can also run `pnpm android` or `pnpm ios` directly.

The app uses native modules, so use a **development build** rather than Expo Go. To build and install one on a connected device or emulator:

```bash
npx expo run:android
npx expo run:ios
```

The `android/` and `ios/` folders are generated and git-ignored. Do not edit them by hand. Run `pnpm web` for a browser preview. It is a convenience only: trips may not load there because SQLite on the web needs extra setup that has not been checked.

## Scripts

| Command | What it does |
|---|---|
| `pnpm start` | Start the Expo dev server |
| `pnpm android` / `pnpm ios` / `pnpm web` | Start the dev server and open the platform |
| `pnpm test` | Run the whole Jest suite |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm lint` | Run `expo lint` |
| `pnpm test:db` | Run the SQL tests in `supabase/tests/` (needs `DB_URL`) |
| `pnpm db:types` | Regenerate `src/data/database.types.ts` from a local Supabase |
| `pnpm supabase <args>` | Run the Supabase CLI |

## Testing

A change is finished only when **tests, typecheck and lint are all green**:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- **App tests** use Jest and React Native Testing Library. They run without a network. The data layer is tested against a real SQLite and a fake Supabase client.
- **Database tests** are plain SQL files in `supabase/tests/` that check Row Level Security and constraints. Each one rolls back, so it leaves no data. Run them against a local Supabase:

  ```bash
  DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db
  ```

  The Storage tests need `pnpm supabase start` (Docker).

## Project structure

```
src/
  app/           Expo Router routes only (every file here is a screen)
  components/    Shared UI components
  features/      drawer, home, nav, trip-create, trip-photos
  hooks/         TanStack Query hooks
  data/          Repositories, Supabase client, SQLite store, sync
  lib/           Pure logic: time zones, layovers, money, airport search
  schemas/       Zod schemas, the single source of truth
  providers/     App-wide providers
  i18n/          Polish and English dictionaries
  theme/         Design tokens, light and dark themes
  test/          Test helpers and fakes
  __tests__/app/ Route tests
supabase/        Migrations and SQL (RLS) tests
context/         app-context.md and design-context.md
prompts/         One plan.md per feature
scripts/         Dev-only scripts (airport list generator, database test runner)
```

## Documentation

| File | What is in it |
|---|---|
| [`context/app-context.md`](context/app-context.md) | What the app is and does: features, screens, domain model, offline behavior, backend |
| [`Architecture.md`](Architecture.md) | How the code is built right now: modules, data flow, decisions, known limitations |
| [`context/design-context.md`](context/design-context.md) | The Sunline design system |
| [`GLOSSARY.md`](GLOSSARY.md) | Domain terms |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute |
| [`CLAUDE.md`](CLAUDE.md) | Project rules and the working process (also read by AI coding agents) |
| `prompts/<feature>/plan.md` | The plan, decisions and progress log of each feature |

## Contributing

Contributions are welcome. Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** first. It explains how to propose a change, the branch and commit conventions, the test-first rule, and what a pull request must contain.

In short: open an issue before you start, write tests before code, and keep every change small.
