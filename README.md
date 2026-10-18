# Travelo

**A mobile app for the one person who organizes a trip for a group of friends.**

Only the organizer needs the app. Friends are added to a trip by name and interests, with no accounts and no invite links. A friend who does have an account can optionally be linked by user ID to follow the plan read-only.

![TypeScript](https://img.shields.io/badge/TypeScript_6-strict-3178C6?logo=typescript&logoColor=white)
![Expo](https://img.shields.io/badge/Expo_SDK_57-React_Native_0.86-000020?logo=expo&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_RLS_%2B_Storage-3FCF8E?logo=supabase&logoColor=white)
![SQLite](https://img.shields.io/badge/Offline--first-SQLite-003B57?logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-1%2C300%2B-2ea44f)

> **Status:** early development. The trip wizard, flights with time-zone-safe layovers, the multi-trip side panel, the private photo gallery and the offline budget work today. Expenses, AI day plans and the budget summary are next (see the [roadmap](#roadmap)).

## Screenshots

Taken on an Android emulator with test data. The app is shown in Polish.

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/home-details.png" width="220" alt="Home screen with flights, travellers and the budget card"><br><sub><b>Trip</b><br>flights, travellers, budget</sub></td>
    <td align="center"><img src="docs/screenshots/side-panel.png" width="220" alt="Side panel with the list of trips"><br><sub><b>Side panel</b><br>all your trips</sub></td>
    <td align="center"><img src="docs/screenshots/trip-menu.png" width="220" alt="Trip menu with rename, budget and delete"><br><sub><b>Trip menu</b><br>rename, budget, delete</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/wizard-budget.png" width="220" alt="Create-trip wizard, budget step"><br><sub><b>New trip: budget</b><br>per person, with a daily figure</sub></td>
    <td align="center"><img src="docs/screenshots/wizard-summary.png" width="220" alt="Create-trip wizard, summary step"><br><sub><b>New trip: summary</b><br>name, cover, flights</sub></td>
    <td></td>
  </tr>
</table>

## Table of contents

- [Screenshots](#screenshots)
- [What the app does](#what-the-app-does)
- [Engineering highlights](#engineering-highlights)
- [Roadmap](#roadmap)
- [Screens and navigation](#screens-and-navigation)
- [Offline behavior](#offline-behavior)
- [Tech stack](#tech-stack)
- [Installation](#installation)
- [Running the app](#running-the-app)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project structure](#project-structure)
- [AI-assisted engineering workflow](#ai-assisted-engineering-workflow)
- [Documentation](#documentation)
- [Contributing](#contributing)

## What the app does

Planning a group trip means juggling flights, who likes what, a shared budget and, later, who paid for what. Travelo keeps all of it with the person who does the organizing. It is built for one hand, on the move.

- **Trip setup wizard.** Flights → friends and interests → budget per person → summary with the trip name and cover. Leaving with entered data asks for confirmation in an in-app dialog, so nothing is lost by accident.
- **Time-zone-accurate flights and layovers.** Search a bundled list of about 3,150 airports, which works offline. Enter departure and arrival in each airport's local time. Layovers are never typed in; they are derived from consecutive segments across time zones. A local time that does not exist because the clocks jump forward is rejected on the spot.
- **Friends without accounts.** Add up to 19 companions with a name and interests, chosen from 17 tags in 6 groups. Friends do not install the app or sign up.
- **Budget.** One amount per person for the whole trip, without flights, in the destination's currency, PLN, EUR or USD. The group total and the per-day figure are derived. It can be changed offline at any time.
- **All your trips.** A side panel lists trips as "Nadchodzące" (upcoming or ongoing) and "Minione" (past). The app remembers which trip you picked.
- **Private trip photos.** Add up to 20 photos at a time. Each one is shrunk on the phone (longer side ≤ 2048 px, plus a 480 px thumbnail), re-encoded as JPEG **without EXIF or GPS data**, and uploaded to a private Supabase Storage bucket. It is shown through signed URLs that last one hour.
- **Trip menu.** Rename a trip, change its cover or budget, or delete it.

## Engineering highlights

The project follows production-grade rules rather than prototype shortcuts. The details are in [`Architecture.md`](Architecture.md).

1. **Zod is the single source of truth.** Every boundary is parsed with Zod: wizard forms, Supabase responses, rows read from the on-device SQLite cache (a corrupt row reads as "no copy"), gallery picker results and the startup environment variables. The Supabase key must start with `sb_publishable_`, so a secret key cannot ship in the app.
2. **Wall-clock time and clock-change gaps.** Flight times are stored as the airport's local wall clock plus its IANA time zone. They are never converted through the phone's time zone. A round-trip check catches local times that do not exist during a daylight-saving jump (`src/lib/time.ts`). The suite can be run under a shifted device time zone to prove it.
3. **No floats for money.** Amounts are integer minor units (`bigint` in Postgres, integers in SQLite and TypeScript) plus an ISO 4217 code, with the decimal digits taken from a static table instead of `Intl`.
4. **Offline budget with an outbox and bad-network protection.** A budget change is written to SQLite first (`trip_budget_changes`) and synced in the background. Last write wins by `budget_updated_at`. A failed send retries with exponential backoff (1 s × 2ⁿ, at most 5 minutes) and stays visible as `pending` or `failed`. Every Supabase request gives up after 20 seconds, so a silent network such as an airport captive portal ends as "offline" instead of hanging.
5. **Row Level Security and private Storage.** The app signs in anonymously on first launch. `trips`, `trip_members`, `flight_segments`, `trip_photos` and the `trip-photos` Storage bucket are protected by RLS, with `security definer` helpers in a non-exposed `private` schema. A trip is created in one idempotent database call (`create_trip`).
6. **Tests at every layer.** More than 1,300 Jest tests, a data layer tested against a real SQLite engine, and plain-SQL tests for RLS and Storage policies.

## Roadmap

| Feature | Status |
|---|---|
| Trip setup wizard, friends with interests, flights and derived layovers | Done |
| Supabase backend: anonymous auth, `create_trip` RPC, RLS | Done |
| Side panel with all trips, trip menu (rename, cover, budget, delete) | Done |
| Trip photos: strip, upload queue, EXIF/GPS removal, full-screen viewer | Done |
| Budget per person editable offline, synced later, with a visible sync status | Done |
| Offline reading of the trip list and every trip opened on the phone | Done |
| Floating pill navigation with five screens (four are placeholders for now) | Done |
| Ready-made trip covers bundled in the app, and gallery covers in Storage | In progress |
| Profile tab (replaces "Ustawienia") | In progress |
| **Expenses during the trip**: added in seconds, multi-currency, works offline | Planned |
| **AI day plans** built from real Google Places, with cost ranges and group splits | Planned |
| **Plan vs reality**: a live daily budget and an end-of-trip summary, shareable as an image | Planned |
| "Rebuild the rest of today" (rain, closed place, tired group), keeping locked activities | Later |
| Receipt photo or one-sentence expense entry parsed by AI | Later |

**Not planned:** flight or hotel booking, a social feed, user reviews, and settlements ("who owes whom").

## Screens and navigation

```text
Root Stack
├── (drawer)                    Side panel with all trips (swipe from the left edge on "Podróż")
│   └── (tabs)                  Floating pill navigation, five tabs
│       ├── /                   Podróż    current trip: hero, photo strip, flights, travellers, budget
│       ├── /expenses           Wydatki   placeholder
│       ├── /places             Miejsca   placeholder
│       ├── /plan               Plan      placeholder
│       └── /settings           Ustawienia (becoming "Profil") placeholder
├── /trips/new/*                Create-trip wizard: flights → friends → budget → summary
└── /trips/[tripId]/photos      Full-screen photo viewer
```

The pill is hidden in the wizard and in the photo viewer. The home screen is always dark: the cover photo fades into ink under a serif title. The rest of the app follows the system light or dark theme.

The look is the **Sunline** design system ([`context/design-context.md`](context/design-context.md)). Every color, spacing and type value is a theme token, and all text goes through i18n, so the whole app is available in **Polish and English** and follows the device language.

## Offline behavior

Travelo is built for roaming and airport Wi-Fi. What works offline is decided on purpose.

| Action | Offline? | How |
|---|---|---|
| Read the trip list and any trip opened before | **Yes** | Read-only copies in SQLite. The app falls back to them when a request fails or takes more than 20 s. |
| Switch the current trip | **Yes** | The choice is stored on the phone and never sent to the server. Works for trips opened before. |
| View trip photos already seen | **Yes** | The photo list is copied to SQLite and the images stay in the image cache. |
| Change the budget per person | **Yes** | Saved to SQLite as `pending`, then synced on reconnect, on app foreground, after each save and on a backoff timer. |
| Add expenses (planned) | **Yes** | SQLite plus an outbox, synced later. |
| Create, rename or delete a trip; add or delete photos | **No** | Server-first. The controls are disabled offline. |

A trip that was never opened on the phone has no copy, so it cannot be opened offline.

## Tech stack

| Layer | Technology |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19.2 (New Architecture and React Compiler on), TypeScript 6 (strict) |
| Navigation | `expo-router` with typed routes: Stack, Drawer and JS Tabs |
| State and fetching | TanStack Query |
| Validation and types | Zod: forms, database rows, cache, environment |
| On-device storage | `expo-sqlite` with versioned migrations (also the auth session storage) |
| Backend | Supabase: Postgres, anonymous Auth, Row Level Security, private Storage, a PL/pgSQL RPC |
| Media and device | `expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-network` |
| UI | The Sunline token system, `lucide-react-native`, DM Sans and Fraunces fonts |
| i18n | i18next (`pl`, `en`) |
| Testing | Jest (`jest-expo`), React Native Testing Library, Node's built-in `node:sqlite`, plain-SQL tests |
| Planned | Edge Functions, Google Places and Routes APIs, an FX rates API, Google Gemini (called only from Edge Functions) |

## Installation

### Prerequisites

- **Node.js 22 or newer.** The data-layer tests use Node's built-in SQLite.
- **[pnpm](https://pnpm.io/installation).** The repo uses pnpm. Do not use npm or yarn.
- **An Android emulator, an iOS simulator, or a phone**:
  - Android: [Android Studio](https://docs.expo.dev/workflow/android-studio-emulator/)
  - iOS (macOS only): [Xcode and a simulator](https://docs.expo.dev/workflow/ios-simulator/)
- **A Supabase project**, hosted or local (see below).
- Optional, for the database tests: [Docker](https://docs.docker.com/get-docker/) and `psql`.

### 1. Clone and install

```bash
git clone https://github.com/KacperBartlomiejczak/Travelo.git
cd Travelo
pnpm install
```

Add dependencies with `npx expo install <package>`, not `pnpm add`, so versions match the Expo SDK.

### 2. Set up Supabase

Pick one of the two options.

**Option A: a hosted project**

1. Create a project at [supabase.com](https://supabase.com).
2. In **Authentication → Sign In / Providers**, turn on **Anonymous sign-ins**. The app signs in anonymously on first launch, and trips cannot be saved without it.
3. Apply the migrations from `supabase/migrations/`, for example with `pnpm supabase link` and `pnpm supabase db push`.
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

The app checks both values at startup and refuses to start if the key does not begin with `sb_publishable_`. Never put a secret key in `.env.local`.

## Running the app

```bash
pnpm start
```

Then press `a` for Android or `i` for iOS in the Expo terminal. You can also run `pnpm android` or `pnpm ios` directly.

The screenshots above were taken with the app running in **Expo Go** on an Android emulator. To use a development build instead, build and install it on a connected device or emulator:

```bash
npx expo run:android
npx expo run:ios
```

The `android/` and `ios/` folders are generated and git-ignored. Do not edit them by hand. `pnpm web` gives a browser preview, but it is a convenience only: trips may not load there because SQLite on the web needs extra setup that has not been checked.

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

Every feature is built test-first. A change is finished only when **tests, typecheck and lint are all green**:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- **App tests** (`pnpm test`) use Jest and React Native Testing Library and run without a network. Route tests mount the real Expo Router layout. The data layer is tested against a **real SQLite** (`node:sqlite`) and a fake Supabase client that records every query and Storage call.
- **Time-zone independence.** To check that airport clock calculations never depend on the device's time zone, run the whole suite under another zone. On macOS or Linux:

  ```bash
  TZ=Pacific/Auckland pnpm test
  ```

- **Database tests** (`pnpm test:db`) are plain SQL files in `supabase/tests/`. They check Row Level Security for the owner, a stranger, a linked viewer and the anonymous role, plus constraints and cascade deletes. Each one rolls back, so it leaves no data. Run them against a local Supabase:

  ```bash
  DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db
  ```

  The Storage tests need `pnpm supabase start` (Docker).

## Project structure

```text
src/
  app/           Expo Router routes only (every file here is a screen)
  components/    Shared UI: PillNav, BottomSheet, ConfirmDialog, form fields
  features/      drawer, home, nav, trip-create, trip-photos
  hooks/         TanStack Query hooks
  data/          Repositories, Supabase client, SQLite store, budget sync, photo preparation
  lib/           Pure logic: time zones, layovers, money, airport search
  schemas/       Zod schemas, the single source of truth
  providers/     App-wide providers (query client, repository, budget sync)
  i18n/          Polish and English dictionaries
  theme/         Design tokens, light and dark themes
  test/          Test helpers and fakes (node-sqlite adapter, fake Supabase)
  __tests__/app/ Route tests
supabase/        Migrations and SQL (RLS) tests
context/         app-context.md and design-context.md
prompts/         One plan.md per feature: decisions, progress log, manual test steps
scripts/         Dev-only scripts (airport list generator, database test runner)
.claude/         Subagent definitions
```

## AI-assisted engineering workflow

The repo is also an example of spec-driven work with [Claude Code](https://claude.com/claude-code).

- **Context files stay in sync with the code:** product scope (`context/app-context.md`), the design system (`context/design-context.md`), the current architecture (`Architecture.md`) and domain terms (`GLOSSARY.md`).
- **A written plan before any code.** Each feature has a `prompts/<feature>/plan.md` with numbered decisions, risks, a progress log and manual device test steps. The plan is approved first.
- **Scoped subagents** in `.claude/agents/`: `explorer` (read-only scout), `planner` (drafts plans), `backend` and `frontend` (each runs one approved step test-first), `verifier` (independent PASS/FAIL review) and `tester` (drives an emulator or phone through `mobile-mcp`; it took the screenshots in this README).

The rules for this process are in [`CLAUDE.md`](CLAUDE.md).

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
