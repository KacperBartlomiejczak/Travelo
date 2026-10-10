# Architecture
Last updated: 2026-10-10 · after task: trips-drawer (side panel with all trips; step 9, D8)

## Overview
Traveling is a mobile app for the person who organizes a trip for a group of friends: trip setup, members, flights and layovers, AI day plans built from real places, offline expenses, and a plan-vs-reality budget summary. The product scope and rules are defined in `CLAUDE.md`; the visual system ("Sunline") is defined in `context/design-context.md`.

**Current state: trips in Supabase, a side panel with all trips, the trip budget editable offline.** The organizer creates a trip in a 4-step wizard (`/trips/new`): flights (outbound / return shown one at a time) with layover segments and the number of companions → friends with interests (skipped when travelling alone) → budget per person → summary with the trip's name and an optional cover photo → save. Saving signs in anonymously on first launch and writes the trip, its friends (with interests) and its flight segments to **Supabase** in one `create_trip` call (needs internet). The new trip becomes the current trip. The home screen (`/`) shows the **current trip** — the one chosen in the side panel, else the default trip (the soonest upcoming or ongoing, else the most recently ended): its cover photo fading into ink over half the screen, then flights, travellers and budget. A menu button (top-left, in every state) or a swipe from the left edge opens the **side panel** with all trips in "Nadchodzące" / "Minione"; tapping one makes it the current trip (remembered on the phone), "Nowa podróż" starts the wizard. The budget per person can be changed from the Budget card ("Zmień" → bottom sheet) **with or without internet**: the change is saved in **SQLite** on the phone and synced to Supabase later (last write wins), with a "Czeka na wysłanie" / "Nie udało się wysłać" indicator. The trip list and every trip opened on the phone are kept as copies in SQLite, so the home screen and the panel work offline after a restart, with an offline banner. Data shapes are Zod schemas (`src/schemas/`); trips are read/written through a `TripRepository` with TanStack Query. Feature plans live in `prompts/<feature-name>/plan.md`; domain terms in `GLOSSARY.md`.

## Folder tree
```
Travelo/
├── .agents/skills/             Real skill files (installed by the `skills` CLI)
├── .claude/
│   ├── agents/                 Subagent definitions (Explorer, Planner, Backend, Frontend, Verifier)
│   ├── skills/                 Symlinks to ../.agents/skills/* so Claude Code finds them, plus the addyosmani/agent-skills copied in place
│   ├── launch.json             Preview config: Expo web on port 8081 (dev tooling only)
│   └── settings.json           Enables the official `expo` Claude plugin
├── .vscode/                    Editor settings + recommended Expo extension
├── assets/                     App icon, Android adaptive icon, splash, favicon, template images
├── context/design-context.md   Design system — single source of truth for visuals
├── prompts/
│   ├── trips-empty-state/plan.md   Plan + progress log of the first feature
│   ├── merge-pr-conflicts/plan.md  Plan for resolving the merge conflicts of `feature/supabase-client` (status: awaiting approval)
│   ├── trip-create-wizard/plan.md  Plan, decisions D1–D42, progress log, manual test steps
│   ├── trip-flight-tabs-name-cover/plan.md  Flights tabs, trip name, cover photo, home screen: D1–D10, progress log
│   ├── supabase-client/plan.md     Supabase client and configuration
│   ├── trips-supabase/plan.md      Trips in Supabase, offline budget: D1–D13, progress log, manual steps
│   ├── trips-drawer/plan.md        Side panel with all trips: D0–D5, P1–P6, progress log, manual steps
│   ├── trip-edit-menu/plan.md      ⋮ menu for editing a trip (drafting)
│   ├── trip-photos/plan.md         Trip photos in Supabase Storage (drafting)
│   └── expenses/plan.md            Expenses screen + pill nav (drafting)
├── scripts/build-airports.mjs  Dev-only generator of src/data/airports.json (downloads 3 public sources)
├── scripts/test-db.sh          `pnpm test:db`: runs supabase/tests/*.sql with psql against $DB_URL
├── supabase/                   Supabase CLI project: config.toml, migrations/ (SQL), tests/ (plain-SQL RLS tests)
├── src/
│   ├── app/                    Expo Router routes ONLY (every file here becomes a screen)
│   │   ├── _layout.tsx         Root Stack inside AppProviders: fonts, splash screen, i18n init
│   │   ├── (drawer)/           Route group (no URL segment): `_layout` = expo-router Drawer with the side panel; `index` = `/` home screen (loading / error / empty / current trip)
│   │   └── trips/new/          Create-trip wizard: nested Stack (`_layout`) + steps index (flights), friends, budget, summary
│   ├── components/             Shared UI components (+ `__tests__/`)
│   ├── data/                   airports.json (+ typed export), trip repositories (in-memory, Supabase), rows ↔ entities, generated DB types, auth, SQLite store, budget sync (+ `__tests__/`)
│   ├── features/drawer/        `TripsDrawer` — the side panel's content
│   ├── features/home/          `CurrentTrip` — the home screen's trip view; `HeroMenuButton`; `BudgetSheet`
│   ├── features/trip-create/   Wizard state and pieces: draft, steps, context, frame, cards, errors (+ `__tests__/`)
│   ├── hooks/                  TanStack Query hooks (`useTripList`, `useCurrentTrip`, `useSelectTrip`, `useCreateTrip`, `useSetTripBudget`)
│   ├── i18n/                   i18next setup and pl/en dictionaries (+ `__tests__/`)
│   ├── lib/                    Pure logic: time zones, layovers, dates, money, airport search, trip sections (+ `__tests__/`)
│   ├── providers/              AppProviders: QueryClient + trip repository context + budget sync (BudgetSync)
│   ├── schemas/                Zod schemas — single source of truth (+ `__tests__/`)
│   ├── test/                   Test helpers: fixtures (wizard → trip), node-sqlite (real SQLite for tests), fake-supabase, mock-network, drawer-status
│   ├── theme/                  Design tokens, light/dark themes, `useTheme` (+ `__tests__/`)
│   └── __tests__/app/          Route tests, mirroring `src/app/` (kept outside `app/`)
├── .npmrc                      pnpm: `node-linker=hoisted`
├── AGENTS.md                   Expo-specific rules for coding agents
├── Architecture.md             This file
├── CLAUDE.md                   Project rules
├── GLOSSARY.md                 Domain terms (organizer, friend, traveller, member, layover, …)
├── app.json                    Expo config (plugins: expo-router, expo-splash-screen, expo-sqlite, expo-localization)
├── eslint.config.js            ESLint flat config (eslint-config-expo)
├── jest.setup.ts               Jest: app repository → in-memory, expo-network → test mock (online), gesture-handler / worklets / Reanimated test mocks
├── package.json                Dependencies, scripts, Jest config
├── pnpm-lock.yaml              pnpm lockfile
└── tsconfig.json               TypeScript strict, `@/*` → `src/*`, `types: ["jest"]`
```

### Folders named in `CLAUDE.md` that do not exist yet
`CLAUDE.md` describes a monorepo layout. The Expo app still sits at the repository root.

| Planned path | Planned purpose | Current equivalent |
|---|---|---|
| `apps/mobile/` | Expo app | repository root (`src/`) |
| `packages/schemas/` | Zod schemas | `src/schemas/` |
| `supabase/migrations/` | SQL migrations | exists (at the root, as planned) |
| `supabase/functions/` | Edge Functions | none |

## Modules
| Module | Path | Responsibility | Depends on |
|---|---|---|---|
| Routes | `src/app/` | Root Stack layout, the `(drawer)` group (Drawer layout + home screen), create-trip wizard screens | `expo-router` (incl. `expo-router/drawer`), features, components, hooks, theme, i18n |
| Schemas | `src/schemas/` | Zod schemas and inferred types: common (money, codes, dates), interests, airport, flight segment, member, trip / trip summary / trip overview / trip list item / trip list / selected trip, wizard inputs, Supabase client config, sync status, trip budget change / current trip | `zod`, `lib/time` |
| Data | `src/data/` | `AIRPORTS` (bundled list); `TripRepository` interface + `buildTrip` + in-memory repository (tests); `createSupabaseTripRepository`; `createAppTripRepository` (the app's: Supabase + SQLite); `trip-rows` (rows ↔ entities, Zod-parsed); generated `database.types.ts`; `auth` (`ensureSession`, `keepSessionFresh`); `local-db` (expo-sqlite + versioned migrations) and `local-store` (list copy, a copy per opened trip, the chosen trip, budget changes); `budget-sync` (send, backoff); `supabase` client | schemas, lib, `expo-crypto`, `@supabase/supabase-js`, `expo-sqlite`, `react-native-url-polyfill` |
| Lib | `src/lib/` | Pure functions: airport-local time ↔ instants and pickers (`isExistingLocalTime`: round-trip check for DST gaps; `isoToLocal`: stored instant → airport wall clock), date display formatters, layovers (`layoverMinutes` from wall clocks — none for an impossible or skipped time; `savedLayoverMinutes` from stored instants), trip dates/days, default trip name (`defaultTripName`), money parse/format (ISO 4217 digits), airport search, text folding, trip sections (`tripSections`, `defaultTripId`, `deviceToday`) | schemas, data (airports) |
| Hooks | `src/hooks/` | `useTripList` (query `['trips', 'list']`), `useCurrentTrip` (query `['trips', 'current']`) — both `networkMode: 'always'`; `useSelectTrip` (mutation, `networkMode: 'always'`, resets `['trips', 'current']`), `useCreateTrip` (mutation, invalidates `['trips']`), `useSetTripBudget` (saves on the device, `networkMode: 'always'`, invalidates `['trips']`, requests a sync) | `@tanstack/react-query`, providers |
| Providers | `src/providers/` | `AppProviders`: `QueryClientProvider` + trip repository context (`useTripRepository`; default `createAppTripRepository()`) + `BudgetSyncProvider` (sync on start / reconnect / foreground / after save / backoff timer; `useRequestBudgetSync`, `useIsOffline`) | data, `@tanstack/react-query`, `expo-network` |
| Home feature | `src/features/home/` | `CurrentTrip`: menu button over the hero + hero + "Loty" / "Podróżni" / "Budżet" (with "Zmień" and the sync indicator) cards + pinned offline banner when offline; `HeroMenuButton` (pinned under the status bar, also over the loading skeleton); `BudgetSheet` (change the budget per person) | components, hooks, providers, lib, theme, `expo-router`, `expo-router/drawer`, `expo-status-bar` |
| Drawer feature | `src/features/drawer/` | `TripsDrawer`: "Twoje podróże", "Nadchodzące" / "Minione" rows (thumbnail, name, dates, the open trip marked), "Nowa podróż"; loading / error / empty / offline | components, hooks, providers, lib, theme, `expo-image` |
| Create-trip feature | `src/features/trip-create/` | Draft type and helpers, step routing, draft context (dirty/complete), wizard frame, segment/friend cards, field errors, leave confirmation | schemas, lib, components |
| Theme | `src/theme/` | Primitive tokens (`tokens.ts`, incl. the `gradient` group), type scale (`typography.ts`), semantic `lightTheme` / `darkTheme` and `Theme` type (`theme.ts`), `useTheme()` hook and `DarkThemeScope` | `react-native` (`useColorScheme`) |
| i18n | `src/i18n/` | One i18next instance with `pl` / `en` resources; language picked from the device | `i18next`, `react-i18next`, `expo-localization` |
| Components | `src/components/` | Buttons (incl. the round `HeroIconButton`), fields, chips, cards, step indicator, stepper, segmented control, cover picker, trip hero, bottom sheet, sync indicator, offline banner (see Frontend) | theme, i18n, lib, `lucide-react-native`, `react-native-svg`, `@expo/ui`, `expo-image`, `expo-image-picker`, `react-native-safe-area-context` |

## Data model
Zod schemas in `src/schemas/` (constants `XSchema`, types `X = z.infer<typeof XSchema>`):
- `common.ts` — `CurrencyCodeSchema`, `IataCodeSchema`, `IanaTimezoneSchema`, `IsoDateTimeSchema` (with offset), `IsoDateSchema`, `LocalDateTimeSchema` (airport-local wall clock from forms; must be a real calendar date — `isLocalDateTime`), `MoneySchema` (integer minor units + ISO 4217).
- `interests.ts` — `InterestTagSchema` (17 tags), `InterestGroupSchema` (6 groups), `INTEREST_GROUPS`.
- `airport.ts` — `AirportSchema` (iata, name, city, countryCode, IANA timezone, currency, large).
- `flight.ts` — `FlightSegmentSchema` (arrival after departure as instants).
- `member.ts` — `TripMemberSchema` (friends: `userId: null`, role `viewer`; `budgetLevel`/`pace` optional).
- `trip.ts` — `TripSchema` (`name` 1–60 chars, optional `coverImageUri`, `budgetPerPerson`, `budgetUpdatedAt`, end ≥ start, budget in base currency), `TripSummarySchema` (+ `travellerCount`), `TripOverviewSchema` (`{ trip: TripSummary, members, segments }`), `TripListItemSchema` (`id`, `name`, optional `coverImageUri`, `startDate`, `endDate` — one row of the side panel), `TripListSchema` (array; also the device copy), `SelectedTripSchema` (`{ tripId }` — device only, the chosen trip).
- `sync.ts` — `SyncStatusSchema` (`synced | pending | failed`).
- `trip-budget.ts` — `TripBudgetChangeSchema` (`tripId`, `budgetPerPerson`, `updatedAt`), `LocalTripBudgetChangeSchema` (+ `syncStatus`, `syncError?`, `attempts`, `lastAttemptAt?`), `TripBudgetFormSchema` (= the wizard's `BudgetStepInputSchema`, amount > 0), `CurrentTripSchema` (`{ overview, budgetSyncStatus, fromCache }` — what the home screen shows).
- `supabase-config.ts` — `SupabaseConfigSchema` (`url`: https URL, `key`: must start with `sb_publishable_`, so a secret key cannot ship in the app).
- `create-trip-form.ts` — wizard input: `SegmentInputSchema` (each time must exist in its airport's zone — a time skipped when clocks go forward gives `validation.timeDoesNotExist`; arrival vs departure compared only when both exist), `FlightsStepInputSchema` (segment chain, return after outbound, first departure not before today at the departure airport, 0–19 companions), `FriendInputSchema`, `FriendsStepInputSchema`, `BudgetStepInputSchema`, `TripDetailsInputSchema` (name trimmed, required, ≤ 60; optional cover URI), `CreateTripInputSchema` (flights, friends, budget, details). Messages are i18n keys (`validation.*`).

**Server tables** (`supabase/migrations/20261006090351_trips.sql`, mirroring the schemas; row types generated into `src/data/database.types.ts`):
- `trips` — `id`, `owner_id` (= `auth.uid()`), `name` (1–60), `cover_image_uri` (device-local URI as-is), `destination`, `start_date`, `end_date` (≥ start), `base_currency`, `budget_per_person_minor` (bigint ≥ 0; currency = `base_currency`), `budget_updated_at`, `created_at`.
- `trip_members` — `id`, `trip_id`, `user_id` (null = friend), `display_name` (trimmed, 1–40), `role`, `interests text[]` (⊆ the 17 tags), `budget_level`, `pace`, `dietary_notes` (≤ 200).
- `flight_segments` — `id`, `trip_id`, `direction`, `position` (= `order`), `flight_number` (2–8), `from_iata`, `to_iata`, `depart_at`, `depart_tz`, `arrive_at` (> depart), `arrive_tz`; unique `(trip_id, direction, position)`.

**SQLite tables** (`src/data/local-db.ts`, migrations v1–v2, `pragma user_version`):
- `trip_overview_cache (trip_id, overview_json, cached_at)` — a copy of every trip read from Supabase on this phone; parsed with `TripOverviewSchema` (a corrupt copy counts as none). Copies of trips no longer on the server's list are deleted when the list is read.
- `trip_list_cache (id = 1, list_json, cached_at)` (v2) — the last list read from Supabase; parsed with `TripListSchema`.
- `selected_trip (id = 1, trip_id)` (v2) — the trip chosen in the side panel; parsed with `SelectedTripSchema`; forgotten when a new server list no longer has it.
- `trip_budget_changes (trip_id, amount_minor INTEGER, currency, updated_at, sync_status, sync_error, attempts, last_attempt_at)` — one unsynced budget change per trip (its own outbox); parsed with `LocalTripBudgetChangeSchema`.

The airport list is a static bundled file, validated row by row in its test (not parsed at runtime).

## Data flow
- Server-first: screens use `useTripList` / `useCurrentTrip` / `useSelectTrip` / `useCreateTrip` / `useSetTripBudget` → `TripRepository` from `AppProviders` (the app's is `createSupabaseTripRepository` with the shared client and `openLocalDb().then(createLocalStore)`; tests use the in-memory one).
  - **Create:** parse `CreateTripInputSchema` → `ensureSession` (anonymous sign-in on first launch; concurrent callers share one sign-in) → `buildTrip` (client UUIDs from `expo-crypto`, times as ISO with offset, `ownerId` = the user id, `budgetUpdatedAt = createdAt`) → `toCreateTripArgs` → `rpc('create_trip')`, then the new trip becomes the chosen trip (SQLite). Any error rejects; nothing is queued (creating needs internet).
  - **List:** `ensureSession` → `trips.select('id, name, cover_image_uri, start_date, end_date').order('start_date').order('created_at')` → `listItemFromRow` (Zod) → written to the list copy (also prunes the copies and the choice of trips no longer listed). Unreachable (postgrest `status: 0` or `AuthRetryableFetchError`, including the 20 s timeout) → the list copy; no copy → rejects; other errors reject.
  - **Current:** the chosen trip (SQLite) → `trips.select('*, trip_members(*), flight_segments(*)').eq('id', …).maybeSingle()` → `overviewFromRows` (Zod; segments outbound → return by position, members by name) → written to its copy. Gone (no row) → the choice is forgotten. With no choice: the list is read and `defaultTripId(list, deviceToday(now))` picks the trip (soonest upcoming or ongoing, else the most recently ended), read the same way; no trips → `null`. Unreachable → offline: the chosen trip's copy, else the default trip from the list copy, an empty list copy → `null` (no trips), no copy → rejects (error state). A budget change still on the device is laid over the trip when it is newer than the server's (`budgetSyncStatus` = its status), otherwise `synced`.
  - **Select:** stores the choice in SQLite (no network); `useSelectTrip` then resets the current-trip query, so the home screen shows its skeleton, then the chosen trip — never the previous trip.
- Offline budget: `setBudget(trip, amountMinor)` validates with `TripBudgetFormSchema` in the trip's base currency and upserts a `pending` row in `trip_budget_changes` (no network). `syncBudgets()` (serialized: one run at a time) sends each change with `update trips … eq(id) lt(budget_updated_at, updatedAt) select(id)` (last write wins); 0 rows → it reads the server's `budget_updated_at` to tell "already there / newer" (synced) from "trip not visible" (`failed`, `trip-not-found`). Unreachable → stays `pending` with the attempt counted; refused → `failed` with its error. A synced change is written into the SQLite copy of that trip, then removed. It returns `nextAttemptAt` (backoff 1 s × 2ⁿ, max 5 min). `BudgetSyncProvider` runs it on start and whenever the network comes back (`expo-network`), on app foreground, after each save, and at `nextAttemptAt`; afterwards it cancels any in-flight trips read and refetches `['trips']`.
- Create-trip wizard: the draft lives in `TripDraftProvider` (wizard layout) as airport-local strings and typed text; each step validates its slice with its Zod schema on "Next"; the summary validates the name with `TripDetailsInputSchema` and saves `toCreateTripInput(draft)`. The name follows the flights (`defaultTripName`) until the organizer types one; the cover photo is the URI returned by the gallery picker. Leaving with unsaved input asks via the system dialog (`usePreventRemove`); after saving it does not.
- Offline expenses: not implemented (the budget change is the only offline write so far).
- AI day plan: not implemented.

## Backend
- Supabase project: `hwsqdlxojllclbwlhuwb` (URL + publishable key in git-ignored `.env.local`; variable names in `.env.example`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`). Anonymous sign-ins were disabled in the project when last checked (`prompts/supabase-client/plan.md` R3) — Kacper enables them for this task.
- Supabase client: `src/data/supabase.ts` loads `react-native-url-polyfill/auto`, parses both env values with `SupabaseConfigSchema` at module load (throws `Invalid Supabase env variables: <names>`), then `createClient` with the auth session in SQLite-backed `localStorage` (`expo-sqlite/localStorage/install`), `persistSession`, `autoRefreshToken`, `detectSessionInUrl: false`, and `global.fetch` = `withTimeout(fetch, REQUEST_TIMEOUT_MS)` from `src/data/fetch-timeout.ts`: every request (database, RPC, auth) is aborted after 20 s, which postgrest-js reports as `status: 0` and auth-js as `AuthRetryableFetchError` — both handled as "unreachable". Imported only by `src/data/app-trip-repository.ts`, which also ties token refresh to `AppState` on phones (`keepSessionFresh`, not on web).
- Auth: anonymous sign-in at first launch (`ensureSession`); the project setting "Anonymous sign-ins" must be on (local `supabase/config.toml` has it on).
- Tables & RLS policies (all three tables, `to authenticated`, `(select auth.uid())`): owner — select / insert / update / delete on `trips` (`owner_id`), and on `trip_members` / `flight_segments` via `private.is_trip_owner(trip_id)`; linked member (`trip_members.user_id`) — select only via `private.is_trip_viewer(trip_id)`. The helpers are `security definer`, `search_path = ''`, in the non-exposed `private` schema, executable only by `authenticated`. Grants: `authenticated` select / insert / update / delete, `service_role` all, nothing for `anon`.
- RPC: `public.create_trip(trip jsonb, members jsonb, segments jsonb)` — `security invoker` (RLS applies), inserts the three in one transaction with `on conflict (id) do nothing` (idempotent), owner always the caller; executable by `authenticated`, `service_role`.
- Edge Functions: none.
- Tooling: Supabase CLI (`pnpm supabase …`); `pnpm test:db` runs `supabase/tests/*.sql` (plain SQL with `ok` / `throws` helpers, rolled back) against `$DB_URL`; `pnpm db:types` regenerates `src/data/database.types.ts` from local Supabase. The migration has been verified on plain Postgres 16 with a stub of Supabase's `auth` schema; it has not been pushed to the project yet.
- Trip storage: `TripRepository` (`src/data/trip-repository.ts`) — Supabase implementation in the app, in-memory implementation (`LOCAL_OWNER_ID` as owner) for tests.

## Frontend
### Screens & routes
| Route | File | What it shows |
|---|---|---|
| (root) | `src/app/_layout.tsx` | Stack navigator. Keeps the splash screen until DM Sans (400/500/600/700) and Fraunces (500/600/700) are loaded; on a font error it renders with system fonts. Imports `@/i18n`. Wraps the Stack in `AppProviders`. Header hidden on `(drawer)` and on `trips/new` (the wizard's nested stack draws its own). |
| `(drawer)` (layout) | `src/app/(drawer)/_layout.tsx` | expo-router `Drawer` (`drawerType: 'front'`, header hidden) around the home screen; the wizard stays in the root stack above it, so the edge swipe works only on the home screen. Panel: 85 % of the window up to `size.drawerMaxWidth` (360dp), `surface.elevated`, `radius.xl` right corners, follows the system theme; scrim `overlay.scrim` labelled "Zamknij"; its content (`TripsDrawer`) is `aria-hidden` while closed. "Nowa podróż" closes the panel and pushes `/trips/new`. |
| `/` | `src/app/(drawer)/index.tsx` | Home screen (`HomeScreen`), by query state. Every state has the menu button "Otwórz listę podróży" that opens the panel. **Trip** (always dark, inside `DarkThemeScope`): `CurrentTrip` — the round menu button pinned over the photo (first for screen readers), `TripHero` (50 % of the window, cover photo fading into ink or plain ink, name in Display XL, dates + days), then scrollable cards on `surface.secondary`: "Loty" (outbound / return lines in airport-local time, layover labels from stored instants), "Podróżni · N" (Ty + names), "Budżet" (per person, total, ~per person per day; ghost "Zmień" — screen reader "Zmień budżet" — opens `BudgetSheet`; `SyncIndicator` while a change is not sent); light status bar while focused and the panel is closed; the offline banner pinned at the bottom when offline. No pinned "Utwórz podróż" (a new trip starts from the panel). Offline the trip comes from the SQLite copy. **Loading**: full-bleed `TripHeroSkeleton` (one accessible "Wczytywanie podróży" element) with the round menu button over it. **Error** (`CircleX`, "Nie udało się wczytać podróży.", announced, "Spróbuj ponownie" refetches) and **empty** (suitcase + 2 lines) show the menu `IconButton` left of the title "Twoje podróże" and keep "Utwórz podróż", with the offline banner above it when offline. Safe-area aware; side padding 20dp, 16dp below 360dp; content max width 720dp. |
| `/trips/new` (layout) | `src/app/trips/new/_layout.tsx` | Nested Stack inside `TripDraftProvider`; header "Nowa podróż" (theme tokens); step 1 gets a `HeaderBackButton` "Twoje podróże", later steps the native back "Wstecz". `LeaveGuard` asks "Odrzucić wpisane dane?" (native `Alert`, `confirm` on web) when the draft changed and the trip is not saved. |
| `/trips/new` | `src/app/trips/new/index.tsx` | Step 1 — flights: disabled "Wyślij bilet · wkrótce", a "Lot tam" / "Powrót" switch (`SegmentedControl`, outbound first) showing one direction's section of segment cards (airport search, date/time pickers, optional flight number), amber layover labels between segments, "Dodaj przesiadkę"/"Usuń", return suggested as the outbound reversed, companions stepper (0–19) on both tabs. "Dalej" validates (`FlightsStepInputSchema`), switches to the tab with the first error (outbound first), scrolls to that card and announces. |
| `/trips/new/friends` | `src/app/trips/new/friends.tsx` | Step 2 (skipped at 0 companions): one card per friend with name and 17 interest chips in 6 groups; validates names. |
| `/trips/new/budget` | `src/app/trips/new/budget.tsx` | Step 3: amount per person (whole trip, without flights) + currency segmented control (destination currency, PLN, EUR, USD); group total and ~per person per day; solo wording. |
| `/trips/new/summary` | `src/app/trips/new/summary.tsx` | Step 4: first a "Nazwa i zdjęcie" card (name field pre-filled "<from city> → <destination city>", max 60, empty → "Podaj nazwę podróży" on save; `CoverPicker`), then trip / travellers / budget cards with "Zmień" back to each step; "Utwórz podróż" saves (loading, error announced), then returns to `/`. Redirects to step 1 when the draft is incomplete (the name is not part of that check). |

### Shared components / hooks
- `Field` (label + error frame, input border/box/text styles), `TextField`, `AirportField` (search over the bundled list), `DateTimeField` (`.tsx` iOS wheel in UTC, `.android.tsx` date→time dialogs, `.web.tsx` browser input; shared `DateTimeFieldBase`), `AmountField` (§10.5), `TextButton` (secondary / ghost), `IconButton`, `Stepper` (adjustable for screen readers), `SegmentedControl`, `Chip` (checkbox), `Card`, `StepIndicator` ("Krok 2 z 4" + bar), `LayoverLabel`, `CoverPicker` (optional cover photo from the gallery via `expo-image-picker`, crop 16:9 on Android, preview + change / remove, error message), `TripHero` + `TripHeroSkeleton`.
- Wizard pieces in `src/features/trip-create/`: `WizardScreen` (step indicator, scroll, pinned action with optional error) + `useGoToNextStep`, `SegmentCard`, `FriendCard`, `TripDraftProvider` / `useTripDraft`, `draft.ts` (types incl. `name: string | null` and `coverImageUri?`, `withCompanionCount`, `addLayover`, `withOutbound`, `budgetCurrency*`, `tripName`, `toCreateTripInput`), `steps.ts`, `field-errors.ts`, `confirm-discard.ts`.
- `useTripList`, `useCurrentTrip`, `useSelectTrip`, `useCreateTrip`, `useSetTripBudget` (`src/hooks/useTrips.ts`); `useTripRepository` (`src/providers/AppProviders.tsx`); `useRequestBudgetSync`, `useIsOffline` (`src/providers/BudgetSync.tsx`).
- `BottomSheet` (§10.12: RN `Modal`, scrim backdrop "Zamknij", 36×4 handle, swipe down on the handle area, system back, 24dp top corners, ≤ 90 %, safe-area padding, keyboard avoiding on iOS, no slide with reduced motion), `SyncIndicator` (D10: `Clock` + "Czeka na wysłanie" in info / `CircleX` + "Nie udało się wysłać" in error + ghost "Spróbuj ponownie"; nothing when synced), `OfflineBanner` (D11: `WifiOff` + design-context copy, polite live region), `BudgetSheet` (`src/features/home/`: the wizard's heading / hint / amount label, amount pre-filled with `formatAmountInput`, the wizard's validation rules, "Zapisz", device-save error announced).
- `PrimaryButton` (`src/components/PrimaryButton.tsx`) — design-context §10.1: min height 52dp (grows with Dynamic Type), 16dp horizontal padding, 12dp radius; states default / pressed / focused (2dp brand ring, 4dp offset) / disabled / loading (spinner, `busy`); optional leading lucide icon (20dp, stroke 2, hidden from screen readers).
- `HeroIconButton` (`src/components/HeroIconButton.tsx`) — trips-drawer P5: 44dp circle on `hero.control` (ink 50 %), solid ink when pressed, 24dp icon in `hero.text`, always labelled. `HeroMenuButton` (`src/features/home/`) places it under the status bar at the screen's side padding.
- `TripsDrawer` (`src/features/drawer/TripsDrawer.tsx`) — the side panel's content (trips-drawer D4, P1): "Twoje podróże" (heading1); sections "Nadchodzące" (not ended yet, soonest first) / "Minione" (most recently ended first) by the device's date, a section without trips left out; rows per §10.8 (≥ 64dp, 16dp side padding, 1dp divider, `surface.secondary` pressed or selected) with a 48dp thumbnail (cover on the placeholder surface, or a `Plane` placeholder; that surface is `surface.secondary`, and `surface.elevated` on the open trip's row so it stays visible there — D8), name (2 lines) and dates, `Check` in the brand colour on the open trip, screen reader "<name>, <dates>" + selected; tapping another trip selects it and closes the panel, the open trip only closes it; footer: offline banner above "Nowa podróż". Loading: 3 static skeleton rows in one busy element; error + retry; no trips: "Nie masz jeszcze żadnej podróży." / "Zaplanuj pierwszą i zaproś znajomych." (D5).
- `TripsEmptyIllustration` (`src/components/TripsEmptyIllustration.tsx`) — 160×160 SVG suitcase with a luggage tag in theme colours (brand body, `text.primary` outline, `category.transport` tag), wrapped in a `View` with `aria-hidden` so it is hidden from screen readers on iOS, Android and web.
- `useTheme()` (`src/theme/useTheme.ts`) — returns `darkTheme` when the system colour scheme is `dark`, otherwise `lightTheme`; inside `DarkThemeScope` always `darkTheme`.

### Theme & i18n
- **Tokens** live in `src/theme/tokens.ts` (palette, dark roles, semantic/budget/category colours, spacing, radius incl. `segmented`, size incl. `drawerMaxWidth` 360 and `thumbnail` 48, breakpoints, elevation, `gradient.heroFade`) and `src/theme/typography.ts` (type scale; font weight is encoded in the `@expo-google-fonts` family name). Components consume semantic tokens from `theme.ts` (`colors.background`, `colors.text.*`, `colors.action.*` incl. `link`, `colors.input.border`, `colors.hero.*` — ink background, light text and `control` (ink 50 % behind the menu button over the photo), same in both themes, `colors.overlay.scrim` — ink at 50 % behind sheets (D12), `elevation.card` — shadow in light, none in dark, `gradient`), never raw palette values.
- **i18n**: `src/i18n/index.ts` creates its own i18next instance (`createInstance()` + `initReactI18next`, synchronous init). Language = the device's first preferred locale if it is `pl` or `en`, otherwise `en`. It is read once at startup. Dictionaries: `src/i18n/locales/pl.json`, `en.json` (same keys, checked by a test).

## Testing
- Jest (`jest-expo` preset) + React Native Testing Library 14 (async `render` / `fireEvent`); route tests use `renderRouter` from `expo-router/testing-library` with the real root layout.
- Test files never live under `src/app/` (Expo Router would turn them into routes); route tests sit in `src/__tests__/app/`.
- `package.json` → `jest.moduleNameMapper` maps `lucide-react-native` to its CommonJS build, because its React Native entry is `.mjs`, which jest-expo does not transform.
- `useColorScheme` / `useWindowDimensions` are mocked at `react-native/Libraries/Utilities/*` (RN imports them internally, so spying on `Appearance` / `Dimensions` does not work).
- Jest mocks RN `View` as a pass-through, so `aria-*` → native accessibility prop conversion is not observable in tests.
- Pickers (`@expo/ui`, `expo-image-picker`), `expo-crypto` and (in the home tests) `expo-status-bar` are mocked; the Supabase client test mocks `createClient` and `expo-sqlite/localStorage/install` and loads the module with `jest.isolateModules` per env (no network in tests); route tests use stand-in screens for steps they don't test; image `require`s are stubs carrying their path.
- `jest.setup.ts` (`setupFilesAfterEnv`): `@/data/app-trip-repository` → the in-memory repository, `expo-network` → `src/test/mock-network.ts` (online unless a test calls `setNetwork`), and the test mocks of `react-native-gesture-handler`, `react-native-worklets` and `react-native-reanimated` (the drawer). Route tests that need a specific repository mock `@/data/app-trip-repository`. Route tests mount the home screen through the `(drawer)` group; `src/test/drawer-status.ts` reads the panel's open / closed status from the router state. The Reanimated mock does not apply animated props, so in Jest the drawer's scrim is not hidden while closed (the panel's own content is, through its `aria-hidden` wrapper).
- Data-layer tests use a real SQLite (`node:sqlite`, Node 22) behind the `LocalDb` interface (`src/test/node-sqlite.ts`) and a fake Supabase client that records every query chain (`src/test/fake-supabase.ts`). The request-timeout tests in `supabase-trip-repository.test.ts` use the real `createClient` over a stub server that never answers (session pre-stored, fake timers, no network).
- Database tests: `supabase/tests/trips_rls.sql` (RLS for owner / stranger / linked viewer / anon, constraints, idempotent `create_trip`, last write wins) — `pnpm test:db`, not part of `pnpm test`. aria-hidden elements need `includeHiddenElements: true`. Some date/time tests set `process.env.TZ` inside the test, which does not change Node's time zone under Jest (next point); device-time-zone independence is checked by running the whole suite under `TZ=…`.
- Jest cannot switch the time zone inside a test (`process.env.TZ` set in a test does not reach Node); time-zone checks need the whole run under `TZ=…`.
- Current suite: 64 suites, 747 tests (also green with `TZ=Pacific/Auckland`).

## Tooling
| Area | Setup |
|---|---|
| Runtime | Expo SDK 57, React Native 0.86, React 19.2, New Architecture, React Compiler and typed routes enabled in `app.json` |
| Language | TypeScript 6 strict; `types: ["jest"]` (TS 6 no longer includes `@types/*` automatically); aliases `@/*` → `src/*`, `@/assets/*` → `assets/*` |
| Package manager | **pnpm** (`pnpm-lock.yaml`, `.npmrc` with `node-linker=hoisted`). Add dependencies with `npx expo install` (it detects pnpm); where it cannot reach the Expo API, `pnpm add <pkg>@<version from node_modules/expo/bundledNativeModules.json>`. |
| Lint | `pnpm lint` (`expo lint`) |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) |
| Tests | `pnpm test` (Jest); `pnpm test:db` (SQL tests, needs `DB_URL`) |
| Supabase | `pnpm supabase …` (CLI, devDependency); `pnpm db:types` (types from local Supabase) |
| Web preview | `.claude/launch.json` → `expo-web` (Expo web on :8081) |
| Native projects | `ios/` and `android/` are generated (Continuous Native Generation) and git-ignored |

### Dependencies in use
`expo-router` (incl. `expo-router/drawer`, on `react-native-drawer-layout` + `react-native-gesture-handler` + `react-native-reanimated` / `react-native-worklets`, already installed), `expo-font`, `expo-splash-screen`, `expo-localization`, `i18next`, `react-i18next`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/fraunces`, `lucide-react-native`, `react-native-svg`, `react-native-safe-area-context`, `zod`, `@tanstack/react-query`, `@expo/ui` (date/time pickers), `expo-crypto` (UUIDs), `expo-image-picker` (cover photo from the gallery), `expo-image` (cover preview, trip hero, side panel thumbnails), `expo-status-bar` (light bar over the hero), `@supabase/supabase-js` (trips, auth), `expo-sqlite` (auth session `localStorage`, and the database for budget changes, trip copies and the chosen trip), `expo-network` (offline detection, reconnect), `react-native-url-polyfill` (Supabase on React Native). Dev: `supabase` (CLI), `@types/node` (tests: `fs`, `node:sqlite`).

### Dependencies installed for planned features (not used by any code yet)
| Package | Intended use |
|---|---|
| `expo-asset` | Was used only for the example trip photos (removed in trips-supabase); no code imports it now — keep or remove is Kacper's call |

## Claude Code configuration
### Subagents (`.claude/agents/`)
| Agent | Model | Tools | Role |
|---|---|---|---|
| `explorer` | `claude-haiku-5-5` (Haiku 5.5) | Read, Grep, Glob | Read-only scout: finds code, schemas and patterns |
| `planner` | opus | Read, Grep, Glob | Read-only: drafts a plan in the plan template format |
| `backend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one backend step test-first (schemas, migrations, RLS, Edge Functions) |
| `frontend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one frontend step test-first, following the design context |
| `verifier` | `claude-haiku-5-5` (Haiku 5.5) | Read, Grep, Glob, Bash | Independent PASS/FAIL review of a finished step; never fixes |

### Skills (`.claude/skills/`)
| Skill | Source | Purpose |
|---|---|---|
| `domain-modeling` | mattpocock/skills | Sharpen domain terms; write `GLOSSARY.md` and ADRs |
| `grill-me` | mattpocock/skills | Interview the user to sharpen a plan (user-invoked only) |
| `improve-codebase-architecture` | mattpocock/skills | Find refactoring opportunities and report them (user-invoked only) |
| `frontend-design` | anthropics/skills | Guidance for building distinctive UI |
| `ui-taste` | uizze.sh | UI polish and review playbooks for web and iOS |
| `find-skills` | vercel-labs/skills | Discover and install further skills |
| 25 engineering workflow skills (`interview-me`, `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `source-driven-development`, `frontend-ui-engineering`, `code-review-and-quality`, `security-and-hardening`, …) | addyosmani/agent-skills | Workflow per development phase; when each one is used and its limits are listed in `CLAUDE.md` → Skills. Copied straight into `.claude/skills/` (not symlinked from `.agents/skills/` like the others) |

## External services
| Service | Used for | Called from | Secrets |
|---|---|---|---|
| Supabase (project `hwsqdlxojllclbwlhuwb`) | Trips (Postgres + RLS), anonymous auth | `src/data/supabase-trip-repository.ts`, `src/data/budget-sync.ts` via `src/data/supabase.ts` | Publishable key in `.env.local` (public by design); no secret key or DB password in the repo |
| OurAirports, mwgg/Airports, datasets/country-codes | Airport list (generated once at dev time, bundled) | `scripts/build-airports.mjs` only | — |

## Key decisions
- 2026-10-10 — On the open trip's row the panel's thumbnail takes the panel's surface (`surface.elevated`), the other rows keep `surface.secondary`, so the placeholder never blends into the selected background (`prompts/trips-drawer/plan.md` D8). P2 (a) and the step 7 deviations confirmed by Kacper (D6, D7).
- 2026-10-08 — Side panel (expo-router Drawer, no new dependency) with all trips in "Nadchodzące" / "Minione"; the home screen shows the current trip — the one chosen there (remembered in SQLite on the phone, never sent to Supabase), else the default trip (soonest upcoming or ongoing, else the most recently ended); a new trip becomes the chosen one; offline copies of the list and of every trip opened on the phone; the pinned "Utwórz podróż" leaves the trip view; the menu button sits over the photo on ink at 50 %; the panel follows the system theme; its slide does not follow reduced motion (accepted, P2 (a)) (`prompts/trips-drawer/plan.md` D0–D5, A1–A8, P1–P6).
- 2026-10-07 — Every Supabase request gives up after 20 s (shared client's `global.fetch`), so a silent network (captive portal; RN Android fetch has no default timeout) ends as "unreachable": the budget sync queue is never stuck and the home screen falls back to the device copy (`prompts/trips-supabase/plan.md` D14, CodeRabbit review on PR #5).
- 2026-10-06 — Trips live in Supabase; creating a trip needs internet. Only the trip's budget per person is editable offline (SQLite first, synced later, last write wins by `budgetUpdatedAt`); the nearest trip is copied to SQLite for offline reading. Anonymous sign-in at first launch; migrations through the Supabase CLI, pushed by Kacper; cover photo URI stored as-is; example trips removed (`prompts/trips-supabase/plan.md` D1–D8). *Extended 2026-10-08: copies of the trip list and of every trip opened on the phone, and the chosen trip (trips-drawer D2, D3).*
- 2026-10-06 — Budget UI: "Zmień" on the Budget card → bottom sheet with the amount (currency fixed); sync indicator line under the amount; offline banner above the pinned button; scrim token ink 50 %; the sheet closes after saving (D5, D10–D13).
- 2026-10-06 — Home screen shows only the nearest trip, CheckMyTrip-style: cover photo over ~50 % of the screen fading into ink (`#17211B`), data only; always dark (`DarkThemeScope`); the trips list was removed (`prompts/trip-flight-tabs-name-cover/plan.md` D4, D6, D7, A4, A7). *Superseded 2026-10-08: the home screen shows the current trip (chosen in the side panel, else the default trip); all trips are in the side panel (trips-drawer).*
- 2026-10-06 — Trip name is the organizer's, default "<from city> → <destination city>", set on the summary step; optional cover photo from the gallery via `expo-image-picker`, stored as a device-local URI while trips are in memory (D1–D3). Flights step shows one direction at a time (D5).
- 2026-10-06 — Gradients only as theme tokens (§20 rule 20): `gradient.heroFade`; hero roles `colors.hero.*`; the hero title uses Display XL (§4.2 "Trip hero").
- 2026-10-06 — Example trips in development builds only, photos bundled and resolved with `expo-asset` so web works too (D8–D10). *Superseded 2026-10-06: example trips removed (trips-supabase D8).*
- 2026-10-06 — Supabase connected at client level only; trips stay in memory. Session storage: `expo-sqlite/localStorage`, not AsyncStorage (no new dependency). For the next feature: anonymous sign-in at first launch, Supabase CLI + local Supabase in Docker for migrations and RLS tests (`prompts/supabase-client/plan.md` D1–D4).
- 2026-10-04 — Create-trip wizard as a nested stack under `/trips/new` with a draft context in its layout; trips behind a `TripRepository` interface, in memory for now — Supabase replaces only the implementation (`prompts/trip-create-wizard/plan.md` D1).
- 2026-10-04 — Layovers are flight segments; durations are derived (D3). Trip dates come from flights (D4). Budget is one amount per person for the whole trip, without flights; daily budget is derived (D5, D33, D35).
- 2026-10-04 — Times are stored as airport-local wall clock + IANA zone; no conversion through the device time zone anywhere (pickers shown in UTC on iOS) (step 6).
- 2026-10-06 — An airport-local time that does not exist (DST gap) is rejected with a field error, never shifted; an impossible calendar date is rejected as a missing date-time (`prompts/trip-create-wizard/plan.md` D42, Q14–Q16).
- 2026-10-04 — Money minor digits from a static ISO 4217 table, not `Intl` (step 3).
- 2026-10-04 — Bundled airport list from public sources, generated by a dev script and validated in tests, not at runtime (D9, D17, D18, D20).
- 2026-10-04 — New theme roles `input.border`, `action.link`, `radius.segmented`, `elevation.card` (D26, D28, step 8).
- 2026-10-03 — Plans live in `prompts/<feature-name>/plan.md`, one folder per feature — Kacper's rule, added to `CLAUDE.md`.
- 2026-10-03 — Package manager switched from npm to pnpm (`node-linker=hoisted`) — npm was too slow (D6 in `prompts/trips-empty-state/plan.md`).
- 2026-10-03 — i18n with `i18next` + `react-i18next` + `expo-localization`; unsupported device languages fall back to English (D4, D5).
- 2026-10-03 — Trips screen is UI-only for now; loading / error / offline states arrive with the data task (D1). *Superseded 2026-10-04: loading / error / list added by trip-create-wizard; offline still pending. Superseded 2026-10-06: the list became the nearest-trip home screen (trip-flight-tabs-name-cover).*
- 2026-10-03 — Design-context gaps decided by Kacper: back button label (D7), native header style (D8), dark disabled button colours (D9), focus ring offset (D10), screen spacing (D11), empty-state illustration (D12) — see `prompts/trips-empty-state/plan.md`.

## Known limitations & tech debt
- The migration is not pushed to the project yet and the app has not talked to Supabase from a device yet (manual steps in `prompts/trips-supabase/plan.md`). Anonymous sign-ins must be enabled in the dashboard.
- Anonymous users only: deleting the app or its data loses the session and with it access to the trips (no e-mail / Apple linking yet). A refresh token the server rejects makes every request fail until the app data is cleared.
- Retrying "Utwórz podróż" after a lost response can create a second trip (new ids per attempt); `create_trip` itself is idempotent per id.
- The 20 s request timeout covers the wait for the response, not a body that stalls after the headers. On phones React Native's fetch resolves only after the whole body, so this only matters on web.
- Members have no stored order; they are shown sorted by name. The organizer is not a `TripMember` row; `travellerCount` = members + 1.
- Offline, a trip never opened on this phone has no copy: choosing it in the panel shows the error state until the phone is online. On web, `expo-sqlite`'s database needs extra setup that has not been checked — the web preview may not load trips; the list pruning uses SQLite's JSON functions (`json_each`), checked under Node's SQLite only.
- The side panel's slide always animates (the drawer library ignores reduced motion; P2 (a)). Edge swipe, scrim tap, Android back, focus moving into the panel and the slide feel are covered only by the manual steps (`prompts/trips-drawer/plan.md`); Jest mocks gesture-handler and Reanimated. Jest prints `react-native-drawer-layout`'s "InteractionManager has been deprecated" warning.
- Two rare races (`prompts/trips-drawer/plan.md` Risks): the default trip deleted between the list read and the trip read shows the empty state once; a list read that answers after a new trip was created may forget that trip as the choice. `cacheList` runs its three statements without a transaction.
- The `deviceToday` test only catches a UTC-based bug when the suite runs outside UTC.
- The budget sheet repeats the wizard budget step's amount validation (8 lines) instead of sharing it. Swipe-to-close on the sheet is not covered by an automated test.
- Airport list (3,153 airports, ~470 KB): city names come from merged sources with hand overrides for large airports; some small airports keep odd names, 91 airports are dropped (no time zone / city). City names are in English ("Warsaw").
- Pickers are mocked in tests; device checks are pending (see the manual steps in `prompts/trip-create-wizard/plan.md`). On web, browser back/forward may bypass the leave confirmation.
- A trip whose return local date is before the outbound arrival date (open-jaw across the date line) breaks the per-day figure and is rejected on save.
- The home screen's trip view is data only (no actions on the trip yet; editing comes with `prompts/trip-edit-menu/plan.md`).
- Cover photos are device-local URIs from the picker's cache, stored as-is in Supabase (D4); the OS may clear them and other devices cannot show them. Upload to Supabase Storage is a later task. On iOS the picker crops square (Expo ignores `aspect` there); the preview and hero show it with `cover` fit.
- City names in default trip names come from the airport list (mostly English, e.g. "Warsaw → Barcelona"). A default name can exceed 60 characters (PKY → NLI is 61); the summary then shows it and asks to shorten it ("Nazwa może mieć do 60 znaków") — the redirect guard ignores the name.
- Manual device checks pending (`prompts/trip-flight-tabs-name-cover/plan.md`): long name / largest Dynamic Type over a bright photo, status bar during the push into the wizard, the light → ink switch when the home screen finishes loading, tablet layout.
- `src/hooks/useTrips.ts` exports `useTripList`, `useCurrentTrip`, `useSelectTrip`, `useCreateTrip` and `useSetTripBudget`.
- `CLAUDE.md` and the agent definitions assume a monorepo (`apps/mobile`, `packages/schemas`, `supabase/`); the app is a single package at the repo root.
- `.claude/agents/Planner.md`, `Frontend.md` and `Backend.md` still mention a root `PLAN.md`; plans now live in `prompts/<feature-name>/plan.md` (awaiting Kacper's decision whether to update them).
- The home screen's empty and error states are not scrollable (the trip view is); at very large Dynamic Type on a small phone they may not fit (manual check pending).
- Language is read once at startup; on Android a system-language change may only apply after an app restart.
- Peer-range warnings: `lucide-react-native@1.50` declares `react-native ^0.87.1` (project has 0.86.3); `test-renderer` (RNTL 14) wants `react ^19.3.0` (project has 19.2.3). Both work in tests; device check pending.
- `pnpm install` skipped the `unrs-resolver` build script (pnpm build-script approval); lint works without it.
- `package.json` has a `reset-project` script pointing at `scripts/reset-project.js`, which does not exist.
- `README.md` is the unmodified Expo template (mentions npm).
- Template images in `assets/images/` (React/Expo logos, `tabIcons/`, `tutorial-web.png`) are not referenced by any code.

## Changelog
- 2026-10-10 — trips-drawer step 9 (D8) — on the open trip's row the side panel's thumbnail sits on `surface.elevated` instead of `surface.secondary`; no architectural change.
- 2026-10-08 — trips-drawer — schemas `TripListItemSchema`, `TripListSchema`, `SelectedTripSchema`, `NearestTripSchema` → `CurrentTripSchema`; `src/lib/trip-sections.ts`; SQLite migration v2 (`trip_list_cache`, `selected_trip`), a copy per opened trip, list pruning; `TripRepository.list` / `current` (replaces `nearest`) / `select`, create selects; hooks `useTripList`, `useCurrentTrip` (replaces `useNearestTrip`), `useSelectTrip`; home route moved to `src/app/(drawer)/` with an expo-router Drawer; `TripsDrawer`, `HeroIconButton`, `HeroMenuButton`; `NearestTrip` → `CurrentTrip`; pinned "Utwórz podróż" removed from the trip view and loading; theme `hero.control`, `size.drawerMaxWidth`, `size.thumbnail`; i18n `trips.openList`, `drawer.*`; Jest mocks for gesture-handler / worklets / Reanimated; `GLOSSARY.md` (current / default / upcoming / past trip); `CLAUDE.md` offline scope. No new dependency, no server change.
- 2026-10-08 — skills — installed `addyosmani/agent-skills` (25 skills, `skills-lock.json`), added to `CLAUDE.md` with usage rules; `CLAUDE.md` now says when to use the explorer agent (step 0 of the step flow) and lists each agent's model. No change to the app.
- 2026-10-08 — agent models — `explorer` and `verifier` now run on Haiku 5.5 (`claude-haiku-5-5`, Kacper's decision); no change to the app's architecture.
- 2026-10-07 — trips-supabase follow-up (CodeRabbit review on PR #5) — `src/data/fetch-timeout.ts` (`withTimeout`, `REQUEST_TIMEOUT_MS` = 20 s) used as the shared Supabase client's `global.fetch`; no schema, table or dependency change.
- 2026-10-06 — trips-supabase — Supabase CLI project (`supabase/`), migration with `trips` / `trip_members` / `flight_segments`, RLS, `private` helpers and `create_trip`; SQL tests + `pnpm test:db`; generated `database.types.ts`; schemas `sync.ts`, `trip-budget.ts`, `Trip.budgetUpdatedAt`; data: `trip-rows`, `auth`, `local-db`, `local-store`, `budget-sync`, `supabase-trip-repository`, `app-trip-repository`; `TripRepository` now returns `NearestTrip` and has `setBudget` / `syncBudgets`; `BudgetSyncProvider`; `useSetTripBudget`; UI `BottomSheet`, `SyncIndicator`, `OfflineBanner`, `BudgetSheet`; theme `colors.overlay.scrim`; `formatAmountInput`; `jest.setup.ts`; example trips and photos removed; added `expo-network`, `react-native-url-polyfill`, dev `supabase`, `@types/node`; `CLAUDE.md` offline scope and data structures; `GLOSSARY.md` "Budget change", "Sync status".
- 2026-10-06 — supabase-client — `SupabaseConfigSchema` (`src/schemas/supabase-config.ts`), shared Supabase client `src/data/supabase.ts` (session in `expo-sqlite` localStorage), `.env.example`; `@supabase/supabase-js` moved from "planned" to "in use". No tables, no auth, no consumers yet.
- 2026-10-06 — trip-flight-tabs-name-cover — schemas: trip name ≤ 60, optional `coverImageUri`, `TripDetailsInputSchema`, `TripOverviewSchema`; `defaultTripName`, `isoToLocal`, `savedLayoverMinutes`; repository `nearest()` + starting trips (`list()` removed); example trips + covers; `useNearestTrip` (replaces `useTrips`); flights step outbound/return switch; summary "Nazwa i zdjęcie" card with `CoverPicker`; home screen `NearestTrip` + `TripHero` / `TripHeroSkeleton`; theme `colors.hero`, `gradient`, `DarkThemeScope`; removed `TripCard`, `TripCardSkeleton`; added `expo-image-picker`, `expo-asset` (and now use `expo-image`, `expo-status-bar`); `GLOSSARY.md` (trip name, cover photo, nearest trip); CLAUDE.md data structures (`Trip.name`, `coverImageUri?`).
- 2026-10-06 — trip-create-wizard follow-up (PR #2 review) — `isLocalDateTime` in `src/schemas/common.ts` (calendar check, shared by `LocalDateTimeSchema`, the wizard and layovers); `isExistingLocalTime` in `src/lib/time.ts`; `SegmentInputSchema` rejects DST-gap times (`validation.timeDoesNotExist`, pl/en); `layoverMinutes` ignores impossible / skipped times. No new modules or dependencies.
- 2026-10-04 — trip-create-wizard — added Zod schemas (`src/schemas/`), bundled airport list + generator script, pure logic in `src/lib/`, in-memory trip repository with TanStack Query hooks and `AppProviders`, the 4-step create-trip wizard (`src/app/trips/new/`, `src/features/trip-create/`), new shared components, Trips screen states and list, `GLOSSARY.md`; added `expo-crypto`; CLAUDE.md data structures updated (`budgetPerPerson`, optional `pace`/`budgetLevel`, `Airport`).
- 2026-10-03 — Initial workspace audit and dependency setup — first version of this document; added runtime dependencies, ESLint, Jest and the `typecheck`/`test` scripts.
- 2026-10-03 — trips-empty-state — switched to pnpm; added theme tokens + `useTheme`, i18n (pl/en), font loading in the root layout, `PrimaryButton`, `TripsEmptyIllustration`, the Trips empty screen at `/` and the placeholder `/trips/new`; first test suite (40 tests); route tests live in `src/__tests__/app/`.
