# Architecture
Last updated: 2026-10-18 · after tasks: profile-tab and trip-covers, incl. its PR #18 review fixes (all code steps verified; device run in `prompts/trip-covers/plan.md`)

## Overview
Traveling is a mobile app for the person who organizes a trip for a group of friends: trip setup, members, flights and layovers, AI day plans built from real places, offline expenses, and a plan-vs-reality budget summary. The product scope and rules are defined in `CLAUDE.md`; the visual system ("Sunline") is defined in `context/design-context.md`.

**Current state: trips in Supabase, a side panel with all trips, the trip budget editable offline.** The organizer creates a trip in a 4-step wizard (`/trips/new`): flights (outbound / return shown one at a time) with layover segments and the number of companions → friends with interests (skipped when travelling alone) → budget per person → summary with the trip's name and a **required cover photo** (one of five bundled city photos, Auckland preselected, or a photo from the gallery) → save. Saving signs in anonymously on first launch and writes the trip, its friends (with interests) and its flight segments to **Supabase** in one `create_trip` call (needs internet). The new trip becomes the current trip. The home screen (`/`) shows the **current trip** — the one chosen in the side panel, else the default trip (the soonest upcoming or ongoing, else the most recently ended): its cover photo fading into ink over half the screen, then flights, travellers and budget. A menu button (top-left, in every state) or a swipe from the left edge opens the **side panel** with all trips in "Nadchodzące" / "Minione"; tapping one makes it the current trip (remembered on the phone), "Nowa podróż" starts the wizard. The budget per person can be changed from the Budget card ("Zmień" → bottom sheet) **with or without internet**: the change is saved in **SQLite** on the phone and synced to Supabase later (last write wins), with a "Czeka na wysłanie" / "Nie udało się wysłać" indicator. A ⋮ button (top-right, over the photo) opens the trip's menu: „Nazwa i zdjęcie” (rename, change the cover), „Zmień budżet” (the same budget sheet) and „Usuń podróż” (confirmation, then the home screen shows the default trip or the empty state with a „Podróż usunięta.” snackbar). Rename and delete go straight to Supabase and are disabled offline. A cover from the gallery is shrunk and re-encoded on the phone and uploaded to **Supabase Storage**, so other phones and a reinstall show it; if that upload fails while creating a trip, the trip keeps the default cover and the home screen says so in a snackbar. Right under the hero sits the trip's **photo strip**.
- A „+” tile opens the gallery (up to 20 photos at a time).
- Each photo is downscaled and re-encoded without EXIF (so without GPS), then uploaded with a thumbnail to a private **Supabase Storage** bucket, one at a time. It shows at once, with its sending or failed state.
- Tapping a photo opens a full-screen viewer: swipe, a counter, and delete with a confirmation.
- Adding and deleting photos needs internet. The photo list is copied to SQLite, so photos already seen still show offline.
- Deleting a trip deletes its photos from Storage too.

**Pill navigation:** the home screen is the first of five screens in a `(tabs)` group inside the drawer, switched by a floating dark **pill** at the bottom with icon + label: „Podróż” (the current trip), „Wydatki”, „Miejsca”, „Plan”, „Profil” (screen title „Profil użytkownika”, `CircleUser` icon). The last four are empty placeholders (a title and „Ten ekran pojawi się wkrótce.”). The pill overlays the screens, so the home screen leaves room for it (`usePillClearance`). The side panel opens only on „Podróż”. The pill is not shown in the wizard or the photo viewer.

**Confirm dialog:** leaving the create-trip wizard with entered data asks through the in-app `ConfirmDialog` („Odrzucić wpisane dane?”), not a system alert.

The trip list and every trip opened on the phone are kept as copies in SQLite, so the home screen and the panel work offline after a restart, with an offline banner. Data shapes are Zod schemas (`src/schemas/`); trips are read/written through a `TripRepository` with TanStack Query. Feature plans live in `prompts/<feature-name>/plan.md`; domain terms in `GLOSSARY.md`.

## Folder tree
```
Travelo/
├── .agents/skills/             Real skill files (installed by the `skills` CLI)
├── .claude/
│   ├── agents/                 Subagent definitions (Explorer, Planner, Backend, Frontend, Verifier, Tester)
│   ├── skills/                 Symlinks to ../.agents/skills/* so Claude Code finds them, plus the addyosmani/agent-skills copied in place
│   ├── launch.json             Preview config: Expo web on port 8081 (dev tooling only)
│   └── settings.json           Enables the official `expo` Claude plugin
├── .vscode/                    Editor settings + recommended Expo extension
├── assets/                     App icon, Android adaptive icon, splash, favicon; `covers/` = the bundled preset covers (`<id>.jpg` ≤ 2048 px + `<id>_thumb.jpg` ≤ 480 px, JPEG q80, made by `scripts/build-covers.ps1`); `template-images/` = Kacper's originals (not bundled)
├── context/design-context.md   Design system — single source of truth for visuals
├── prompts/
│   ├── trips-empty-state/plan.md   Plan + progress log of the first feature
│   ├── merge-pr-conflicts/plan.md  Plan for resolving the merge conflicts of `feature/supabase-client` (status: awaiting approval)
│   ├── trip-create-wizard/plan.md  Plan, decisions D1–D42, progress log, manual test steps
│   ├── trip-flight-tabs-name-cover/plan.md  Flights tabs, trip name, cover photo, home screen: D1–D10, progress log
│   ├── supabase-client/plan.md     Supabase client and configuration
│   ├── trips-supabase/plan.md      Trips in Supabase, offline budget: D1–D13, progress log, manual steps
│   ├── trips-drawer/plan.md        Side panel with all trips: D0–D5, P1–P6, progress log, manual steps
│   ├── wizard-keyboard/plan.md     Keyboard avoiding in the create-trip wizard and the bottom sheet: D1–D8, progress log, manual steps
│   ├── trip-edit-menu/plan.md      ⋮ menu: rename / cover, budget, delete; swipe-to-close sheets: D1–D22, progress log, manual steps, screens/
│   ├── trip-photos/plan.md         Trip photos in Supabase Storage (strip, upload queue, viewer): D1–D37, P1–P8, progress log, manual steps
│   ├── pill-nav-and-dialog/plan.md Pill navigation with 5 screens + confirm dialog: D1–D4, A1–A8, R1–R5, progress log, manual test steps
│   ├── profile-tab/plan.md         „Ustawienia” → „Profil”: D1–D2, progress log
│   ├── trip-covers/plan.md         Required trip cover (presets + gallery in Storage): D1–D14, P1, Q1–Q3, R1–R7, progress log, manual test steps
│   └── expenses/plan.md            Expenses screen (drafting; the pill nav decisions moved to pill-nav-and-dialog)
├── scripts/build-airports.mjs  Dev-only generator of src/data/airports.json (downloads 3 public sources)
├── scripts/build-covers.ps1    One-off Windows tool (System.Drawing): `assets/template-images/` → `assets/covers/` (largest source per id, never upscales, no EXIF)
├── scripts/test-db.sh          `pnpm test:db`: runs supabase/tests/*.sql with psql against $DB_URL
├── supabase/                   Supabase CLI project: config.toml, migrations/ (SQL), tests/ (plain-SQL RLS tests)
├── src/
│   ├── app/                    Expo Router routes ONLY (every file here becomes a screen)
│   │   ├── _layout.tsx         Root Stack inside AppProviders: fonts, splash screen, i18n init
│   │   ├── (drawer)/           Route group (no URL segment): `_layout` = expo-router Drawer with the side panel
│   │   │   └── (tabs)/         Route group: `_layout` = `Tabs` with the floating pill; `index` = `/` home screen (loading / error / empty / current trip); `expenses`, `places`, `plan`, `profile` = empty placeholder screens
│   │   ├── trips/new/          Create-trip wizard: nested Stack (`_layout`) + steps index (flights), friends, budget, summary
│   │   └── trips/[tripId]/photos.tsx  Full-screen photo viewer (`fullScreenModal`)
│   ├── components/             Shared UI components (+ `__tests__/`)
│   ├── data/                   airports.json (+ typed export), trip repositories (in-memory, Supabase), rows ↔ entities, generated DB types, auth, SQLite store, budget sync, photo files (+ `__tests__/`)
│   ├── features/drawer/        `TripsDrawer` — the side panel's content
│   ├── features/nav/           `NAV_TABS` (the five tabs), `usePillClearance` / `usePillBottomOffset`, `EmptyScreen` (+ `__tests__/`)
│   ├── features/home/          `CurrentTrip` — the home screen's trip view; `HeroMenuButton`, `TripMenuButton`; sheets `TripMenuSheet`, `TripDetailsSheet`, `BudgetSheet`, `DeleteTripSheet` (+ `__tests__/`)
│   ├── features/trip-create/   Wizard state and pieces: draft, steps, context, frame, cards, errors (+ `__tests__/`)
│   ├── features/trip-photos/   `PhotoStrip`, `PhotoTile`, `pickTripPhotos`, `PhotoViewer`, `DeletePhotoSheet` (+ `__tests__/`)
│   ├── hooks/                  TanStack Query hooks (`useTripList`, `useCurrentTrip`, `useSelectTrip`, `useCreateTrip`, `useSetTripBudget`, `useUpdateTripDetails`, `useDeleteTrip`; `useTripPhotos`, `usePhotoUploads`, `useDeleteTripPhoto`)
│   ├── i18n/                   i18next setup and pl/en dictionaries (+ `__tests__/`)
│   ├── lib/                    Pure logic: time zones, layovers, dates, money, airport search, trip sections, trip photos, cover presets (+ `__tests__/`)
│   ├── providers/              AppProviders: QueryClient + trip repository context + budget sync (BudgetSync)
│   ├── schemas/                Zod schemas — single source of truth (+ `__tests__/`)
│   ├── test/                   Test helpers: fixtures (wizard → trip), node-sqlite (real SQLite for tests), fake-supabase, mock-network, drawer-status
│   ├── theme/                  Design tokens, light/dark themes, `useTheme` (+ `__tests__/`)
│   └── __tests__/app/          Route tests, mirroring `src/app/` (kept outside `app/`)
├── .mcp.json                   MCP server `mobile-mcp` (drives a phone / emulator for the `tester` agent)
├── .npmrc                      pnpm: `node-linker=hoisted`
├── AGENTS.md                   Expo-specific rules for coding agents
├── Architecture.md             This file
├── CLAUDE.md                   Project rules
├── GLOSSARY.md                 Domain terms (organizer, friend, traveller, member, layover, …)
├── app.json                    Expo config (plugins: expo-router, expo-splash-screen, expo-sqlite, expo-localization)
├── eslint.config.js            ESLint flat config (eslint-config-expo)
├── jest.setup.ts               Jest: app repository → in-memory, expo-network → test mock (online), gesture-handler / worklets / Reanimated test mocks, `expo-image-manipulator` / `expo-file-system` mocks
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
| Routes | `src/app/` | Root Stack layout, the `(drawer)` group (Drawer layout) with its `(tabs)` group (Tabs layout with the pill + home screen + four empty screens), create-trip wizard screens, the photo viewer (`trips/[tripId]/photos`) | `expo-router` (incl. `expo-router/drawer`), features, components, hooks, theme, i18n |
| Schemas | `src/schemas/` | Zod schemas and inferred types: common (money, codes, dates), interests, airport, flight segment, member, trip / trip summary / trip overview / trip list item / trip list / selected trip, wizard inputs, Supabase client config, sync status, trip budget change / current trip, trip photo / shown photo / photo list / picked photo, cover / cover choice / cover urls | `zod`, `lib/time` |
| Data | `src/data/` | `AIRPORTS` (bundled list); `TripRepository` interface + `buildTrip` + in-memory repository (tests); `createSupabaseTripRepository`; `createAppTripRepository` (the app's: Supabase + SQLite); `trip-rows` (rows ↔ entities, Zod-parsed); generated `database.types.ts`; `auth` (`ensureSession`, `keepSessionFresh`); `local-db` (expo-sqlite + versioned migrations) and `local-store` (list copy, a copy per opened trip, the chosen trip, budget changes, a photo-list copy per trip; `forgetTrip` drops all five for a deleted trip); `budget-sync` (send, backoff); `photo-files` (`preparePhoto`: downscale, thumbnail, JPEG re-encode without EXIF, bytes); `supabase` client | schemas, lib, `expo-crypto`, `@supabase/supabase-js`, `expo-sqlite`, `react-native-url-polyfill`, `expo-image-manipulator`, `expo-file-system`, `expo-image` |
| Lib | `src/lib/` | Pure functions: airport-local time ↔ instants and pickers (`isExistingLocalTime`: round-trip check for DST gaps; `isoToLocal`: stored instant → airport wall clock), date display formatters, layovers (`layoverMinutes` from wall clocks — none for an impossible or skipped time; `savedLayoverMinutes` from stored instants), trip dates/days, default trip name (`defaultTripName`), money parse/format (ISO 4217 digits), airport search, text folding, trip sections (`tripSections`, `defaultTripId`, `deviceToday`), trip photos (`takenAtFromExif`, `compareTakenAt`, `sortTripPhotos`, `photoPaths`, `fitWithin`; `PHOTO_MAX_SIDE` 2048, `THUMBNAIL_MAX_SIDE` 480) | schemas, data (airports) |
| Hooks | `src/hooks/` | `useTripList` (query `['trips', 'list']`), `useCurrentTrip` (query `['trips', 'current']`) — both `networkMode: 'always'`; `useSelectTrip` (mutation, `networkMode: 'always'`, resets `['trips', 'current']`), `useCreateTrip` (mutation, invalidates `['trips']`), `useSetTripBudget` (saves on the device, `networkMode: 'always'`, invalidates `['trips']`, requests a sync); `useUpdateTripDetails` (mutation, online, awaits the invalidation of `['trips']`); `useDeleteTrip` (mutation, online; cancels in-flight `['trips']` fetches, then resets `['trips', 'current']` and invalidates `['trips', 'list']`). Trip photos: `useTripPhotos` (query `['trip-photos', tripId]`, outside `['trips']`, `networkMode: 'always'`); `usePhotoUploads` (an in-memory queue per trip, one upload at a time; items `waiting \| sending \| failed`; retrying one or all reuses the same id; waiting items fail offline; invalidates the photos query after each success); `useDeleteTripPhoto` (online only, awaits the invalidation) | `@tanstack/react-query`, providers |
| Providers | `src/providers/` | `AppProviders`: `QueryClientProvider` + trip repository context (`useTripRepository`; default `createAppTripRepository()`) + `BudgetSyncProvider` (sync on start / reconnect / foreground / after save / backoff timer; `useRequestBudgetSync`, `useIsOffline`) | data, `@tanstack/react-query`, `expo-network` |
| Home feature | `src/features/home/` | `CurrentTrip`: menu button (☰) and trip menu button (⋮) over the hero + hero + `PhotoStrip` + "Loty" / "Podróżni" / "Budżet" (with "Zmień" and the sync indicator) cards + pinned offline banner when offline; owns one `sheet` state (`menu` / `details` / `budget` / `delete`), so only one sheet is open; `HeroMenuButton` (pinned under the status bar, also over the loading skeleton); `TripMenuButton` (⋮, top-right, trip view only); `TripMenuSheet`, `TripDetailsSheet` (rename, cover), `BudgetSheet` (change the budget per person), `DeleteTripSheet` (confirm the delete) | components, hooks, providers, lib, theme, `expo-router`, `expo-router/drawer`, `expo-status-bar` |
| Trip photos feature | `src/features/trip-photos/` | `PhotoStrip`: under the hero; the „+” tile, then photos and uploads merged by date taken (`mergeStripItems`), with loading, empty, error, sending, failed and offline lines. `PhotoTile`: a thumbnail, a scrim with a spinner while sending, a failed icon, disabled offline. `pickTripPhotos`: the gallery, ≤ 20 photos, reads only the EXIF date. `PhotoViewer`: a full-screen pager with a counter pill, delete and an offline hint pill; it keeps the photo in view by id. `DeletePhotoSheet` | components, hooks, providers, lib, schemas, theme, `expo-image`, `expo-image-picker`, `expo-status-bar` |
| Drawer feature | `src/features/drawer/` | `TripsDrawer`: "Twoje podróże", "Nadchodzące" / "Minione" rows (thumbnail, name, dates, the open trip marked), "Nowa podróż"; loading / error / empty / offline | components, hooks, providers, lib, theme, `expo-image` |
| Nav feature | `src/features/nav/` | `NAV_TABS` (route key, i18n label key, lucide icon for the five tabs), `usePillClearance` (space the floating pill occupies: inset + 16 + 64) and `usePillBottomOffset`, `EmptyScreen` (title + one sentence, bottom padding above the pill) | components, theme, i18n, `react-native-safe-area-context` |
| Create-trip feature | `src/features/trip-create/` | Draft type and helpers, step routing, draft context (dirty/complete), wizard frame, segment/friend cards, field errors | schemas, lib, components |
| Theme | `src/theme/` | Primitive tokens (`tokens.ts`, incl. the `gradient` and `duration` groups), type scale (`typography.ts`), semantic `lightTheme` / `darkTheme` and `Theme` type (`theme.ts`), `useTheme()` hook and `DarkThemeScope` | `react-native` (`useColorScheme`) |
| i18n | `src/i18n/` | One i18next instance with `pl` / `en` resources; language picked from the device | `i18next`, `react-i18next`, `expo-localization` |
| Components | `src/components/` | Buttons (incl. the round `HeroIconButton`), fields, chips, cards, step indicator, stepper, segmented control, cover picker, cover image, trip hero, bottom sheet, confirm dialog, pill nav, snackbar, sync indicator, offline banner (see Frontend) | theme, i18n, lib, `lucide-react-native`, `react-native-svg`, `@expo/ui`, `expo-image`, `expo-image-picker`, `react-native-safe-area-context` |

## Data model
Zod schemas in `src/schemas/` (constants `XSchema`, types `X = z.infer<typeof XSchema>`):
- `common.ts` — `CurrencyCodeSchema`, `IataCodeSchema`, `IanaTimezoneSchema`, `IsoDateTimeSchema` (with offset), `IsoDateSchema`, `LocalDateTimeSchema` (airport-local wall clock from forms; must be a real calendar date — `isLocalDateTime`), `MoneySchema` (integer minor units + ISO 4217).
- `interests.ts` — `InterestTagSchema` (17 tags), `InterestGroupSchema` (6 groups), `INTEREST_GROUPS`.
- `airport.ts` — `AirportSchema` (iata, name, city, countryCode, IANA timezone, currency, large).
- `flight.ts` — `FlightSegmentSchema` (arrival after departure as instants).
- `member.ts` — `TripMemberSchema` (friends: `userId: null`, role `viewer`; `budgetLevel`/`pace` optional).
- `cover.ts` — `COVER_PRESET_IDS` (auckland, bali, beijing, jakarta, majorka), `CoverSchema` (`preset:<id>` | `photo:<lowercase uuid>`, a `z.templateLiteral`), `DEFAULT_COVER` (`preset:auckland`), `CoverChoiceSchema` (a cover, or `file://<path>` = a gallery photo picked but not sent; no whitespace-only or line breaks), `CoverUrlsSchema` (`{ url, thumbnailUrl }`, http(s) only via `HttpUrlSchema` in `common.ts`).
- `trip.ts` — `TripSchema` (`name` 1–60 chars, required `coverImageUri: Cover`, `budgetPerPerson`, `budgetUpdatedAt`, end ≥ start, budget in base currency), `TripSummarySchema` (+ `travellerCount`, optional `coverUrls` — only on a `photo:` cover), `TripOverviewSchema` (`{ trip: TripSummary, members, segments }`), `TripListItemSchema` (`id`, `name`, `coverImageUri`, optional `coverUrls` as above, `startDate`, `endDate` — one row of the side panel), `TripListSchema` (array; also the device copy), `SelectedTripSchema` (`{ tripId }` — device only, the chosen trip).
- `sync.ts` — `SyncStatusSchema` (`synced | pending | failed`).
- `trip-budget.ts` — `TripBudgetChangeSchema` (`tripId`, `budgetPerPerson`, `updatedAt`), `LocalTripBudgetChangeSchema` (+ `syncStatus`, `syncError?`, `attempts`, `lastAttemptAt?`), `TripBudgetFormSchema` (= the wizard's `BudgetStepInputSchema`, amount > 0), `CurrentTripSchema` (`{ overview, budgetSyncStatus, fromCache }` — what the home screen shows).
- `supabase-config.ts` — `SupabaseConfigSchema`:
  - `url`: an https URL. http is accepted only for the hosts `127.0.0.1`, `localhost` and `10.0.2.2`, so a local Supabase can be reached from the machine or the Android emulator (trip-photos D36).
  - `key`: must start with `sb_publishable_`, so a secret key cannot ship in the app.
- `trip-photo.ts`:
  - `TripPhotoSchema`: `id` (a client UUID), `tripId`, optional `takenAt` and `createdAt`. `takenAt` is the camera's clock as `LocalDateTimeSchema`, a written exception to "timestamps with offset" (D12).
  - `ShownTripPhotoSchema`: adds the signed `url` and `thumbnailUrl` (http(s) only).
  - `TripPhotoListSchema`: the photos in display order; also the copy on the phone.
  - `PickedPhotoSchema`: `uri` and an optional `takenAt`. The gallery result is a boundary, so it is parsed.
  - GPS is never read or stored.
- `create-trip-form.ts` — wizard input: `SegmentInputSchema` (each time must exist in its airport's zone — a time skipped when clocks go forward gives `validation.timeDoesNotExist`; arrival vs departure compared only when both exist), `FlightsStepInputSchema` (segment chain, return after outbound, first departure not before today at the departure airport, 0–19 companions), `FriendInputSchema`, `FriendsStepInputSchema`, `BudgetStepInputSchema`, `TripDetailsInputSchema` (name trimmed, required, ≤ 60; required cover, `CoverChoiceSchema`), `CreateTripInputSchema` (flights, friends, budget, details). Messages are i18n keys (`validation.*`).

**Server tables** (`supabase/migrations/20261006090351_trips.sql`, `20261015182337_trip_photos.sql`, `20261015184306_trip_photos_storage.sql` and `20261018120000_trip_covers.sql`, mirroring the schemas; row types generated into `src/data/database.types.ts`):
- `trips` — `id`, `owner_id` (= `auth.uid()`), `name` (1–60), `cover_image_uri` (not null, default `preset:auckland`, check = the exact `CoverSchema` shape; a `photo:<uuid>` cover lives in Storage at `<tripId>/<uuid>.jpg` + `_thumb.jpg`, next to the trip's photos), `destination`, `start_date`, `end_date` (≥ start), `base_currency`, `budget_per_person_minor` (bigint ≥ 0; currency = `base_currency`), `budget_updated_at`, `created_at`.
- `trip_members` — `id`, `trip_id`, `user_id` (null = friend), `display_name` (trimmed, 1–40), `role`, `interests text[]` (⊆ the 17 tags), `budget_level`, `pace`, `dietary_notes` (≤ 200).
- `flight_segments` — `id`, `trip_id`, `direction`, `position` (= `order`), `flight_number` (2–8), `from_iata`, `to_iata`, `depart_at`, `depart_tz`, `arrive_at` (> depart), `arrive_tz`; unique `(trip_id, direction, position)`.
- `trip_photos` — `id`, `trip_id` (deleted with its trip by cascade), `taken_at` (`timestamp without time zone`, nullable), `created_at`; an index on `trip_id`; no updates.

**Storage** (`20261015184306_trip_photos_storage.sql`):
- A private bucket `trip-photos`, JPEG only, 10 MiB per file.
- Objects are `<tripId>/<photoId>.jpg` and `<tripId>/<photoId>_thumb.jpg`, with lowercase UUIDs. `private.trip_id_of_object(name)` returns null for any other name.

**SQLite tables** (`src/data/local-db.ts`, migrations v1–v3, `pragma user_version`):
- `trip_overview_cache (trip_id, overview_json, cached_at)` — a copy of every trip read from Supabase on this phone; parsed with `TripOverviewSchema` (a corrupt copy counts as none). Copies of trips no longer on the server's list are deleted when the list is read.
- `trip_list_cache (id = 1, list_json, cached_at)` (v2) — the last list read from Supabase; parsed with `TripListSchema`.
- `selected_trip (id = 1, trip_id)` (v2) — the trip chosen in the side panel; parsed with `SelectedTripSchema`; forgotten when a new server list no longer has it.
- `trip_budget_changes (trip_id, amount_minor INTEGER, currency, updated_at, sync_status, sync_error, attempts, last_attempt_at)` — one unsynced budget change per trip (its own outbox); parsed with `LocalTripBudgetChangeSchema`.
- `trip_photos_cache (trip_id, photos_json, cached_at)` (v3) — the last photo list read for a trip, parsed with `TripPhotoListSchema`.
  - The signed URLs in it expire after 1 h. The images themselves stay in expo-image's disk cache.
  - An invalid list is never written, and a corrupt one reads as none.
  - It is pruned with the list and dropped by `forgetTrip`.

The airport list is a static bundled file, validated row by row in its test (not parsed at runtime).

## Data flow
- Server-first: screens use `useTripList` / `useCurrentTrip` / `useSelectTrip` / `useCreateTrip` / `useSetTripBudget` → `TripRepository` from `AppProviders` (the app's is `createSupabaseTripRepository` with the shared client and `openLocalDb().then(createLocalStore)`; tests use the in-memory one).
  - **Create:** parse `CreateTripInputSchema` → `ensureSession` (anonymous sign-in on first launch; concurrent callers share one sign-in) → `buildTrip` (client UUIDs from `expo-crypto`, times as ISO with offset, `ownerId` = the user id, `budgetUpdatedAt = createdAt`) → `toCreateTripArgs` → `rpc('create_trip')`, then the new trip becomes the chosen trip (SQLite). Any error rejects; nothing is queued (creating needs internet).
  - **List:** `ensureSession` → `trips.select('id, name, cover_image_uri, start_date, end_date').order('start_date').order('created_at')` → `photo:` covers signed (file + thumbnail, batches of ≤ 1000, `coverUrls`; presets need no Storage call) → `listItemFromRow` (Zod) → written to the list copy (also prunes the copies and the choice of trips no longer listed). Unreachable (postgrest `status: 0` or `AuthRetryableFetchError`, including the 20 s timeout) → the list copy; no copy → rejects; other errors reject.
  - **Current:** the chosen trip (SQLite) → `trips.select('*, trip_members(*), flight_segments(*)').eq('id', …).maybeSingle()` → a `photo:` cover signed as for the list → `overviewFromRows` (Zod; segments outbound → return by position, members by name) → written to its copy. Gone (no row) → the choice is forgotten. With no choice: the list is read and `defaultTripId(list, deviceToday(now))` picks the trip (soonest upcoming or ongoing, else the most recently ended), read the same way; no trips → `null`. Unreachable → offline: the chosen trip's copy, else the default trip from the list copy, an empty list copy → `null` (no trips), no copy → rejects (error state). A budget change still on the device is laid over the trip when it is newer than the server's (`budgetSyncStatus` = its status), otherwise `synced`.
  - **Select:** stores the choice in SQLite (no network); `useSelectTrip` then resets the current-trip query, so the home screen shows its skeleton, then the chosen trip — never the previous trip.
  - **Rename / cover** (`updateDetails`): parse `TripDetailsInputSchema` (name trimmed, 1–60, cover required) → `ensureSession` → read the stored cover (gone → `trip-not-found`) → a `photo:` value that is not the stored cover rejects `cover-not-current`; a `file://` choice is prepared (`preparePhoto`) and uploaded (thumbnail, then file, `upsert: false`) → `trips.update({ name, cover_image_uri })` `.eq('id', …).select('id')`; 0 rows → `trip-not-found`; unreachable → `ServerUnreachableError`; a failed upload or update rejects and removes the new files, except when the update is unreachable: it may have been applied, so the new files are kept (left-overs go with the trip folder). After a success that replaced a `photo:` cover, the old two files are removed (best effort). Online only; the UI disables it offline.
  - **Create with a gallery cover** (trip-covers Q1): the trip is created on `DEFAULT_COVER` (Storage rules need the trip), then the photo is prepared, uploaded and the trip updated to `photo:<uuid>`. Any failure there keeps the default, removes what was uploaded (kept when the update is unreachable, as in `updateDetails`) and still resolves; the caller tells it by "asked `file://`, got a preset". The summary then closes the wizard with `coverUploadFailed=1`, and `HomeScreen` shows its snackbar „Nie udało się wysłać zdjęcia okładki. Zmień je w „Nazwa i zdjęcie”.” once and clears the param (`navigation.setParams`).
  - **Delete** (`delete`): `ensureSession` → the trip's Storage folder is listed (pages of 1000) and its files removed (chunks of ≤ 1000) **before** the row; any error rejects and keeps the trip and its copies (P7) → `trips.delete().eq('id', …).select('id')` (members and segments go by cascade). 0 rows → a read of the trip tells "already gone" (success, D13) from "still visible, not deletable" (`trip-not-deletable`, copies kept). On success `LocalStore.forgetTrip` removes the trip's copy, the choice of it, its pending budget change and its list entry in one SQLite transaction. The hook then resets the current-trip query, so the home screen shows the default trip or the empty state. Online only. After the row is gone, the folder is checked once more, best effort.
  - **Photos** (`photos(tripId)`):
    1. Read the rows: `order('id').range()`, in pages of 1000 (= PostgREST `max_rows`).
    2. Sign the files: one `createSignedUrls` call per ≤ 1000 paths, valid 1 h.
    3. Parse with `TripPhotoListSchema`, then `sortTripPhotos`: date taken, oldest first; the same minute by when added; photos without a date last.
    4. Write the SQLite copy.
    - Unreachable → the copy; no copy → rejects.
  - **Add photo** (`addPhoto(tripId, photoId, picked)`):
    1. Validate: lowercase UUIDs, `PickedPhotoSchema`.
    2. `preparePhoto`: render once; the longer side ≤ 2048 (the thumbnail ≤ 480), never upscaled; JPEG 0.8 without the source metadata; native refs released.
    3. Upload the thumbnail, then the file (`upsert: true`).
    4. Insert the row (`ignoreDuplicates`).
    5. Seed expo-image's cache with the local thumbnail.
    - Retrying the same id never creates a duplicate.
    - `usePhotoUploads` drives it one photo at a time from `PhotoStrip`. Queued photos live in memory only, so they are lost when the app closes or the trip changes.
  - **Delete photo** (`deletePhoto`):
    1. Delete the row by id and trip. 0 rows → a visibility check: `photo-not-deletable` while the photo is still visible.
    2. Remove both files, best effort.
- Offline budget: `setBudget(trip, amountMinor)` validates with `TripBudgetFormSchema` in the trip's base currency and upserts a `pending` row in `trip_budget_changes` (no network). `syncBudgets()` (serialized: one run at a time) sends each change with `update trips … eq(id) lt(budget_updated_at, updatedAt) select(id)` (last write wins); 0 rows → it reads the server's `budget_updated_at` to tell "already there / newer" (synced) from "trip not visible" (`failed`, `trip-not-found`). Unreachable → stays `pending` with the attempt counted; refused → `failed` with its error. A synced change is written into the SQLite copy of that trip, then removed. It returns `nextAttemptAt` (backoff 1 s × 2ⁿ, max 5 min). `BudgetSyncProvider` runs it on start and whenever the network comes back (`expo-network`), on app foreground, after each save, and at `nextAttemptAt`; afterwards it cancels any in-flight trips read and refetches `['trips']`.
- Create-trip wizard: the draft lives in `TripDraftProvider` (wizard layout) as airport-local strings and typed text; each step validates its slice with its Zod schema on "Next"; the summary validates the name with `TripDetailsInputSchema` and saves `toCreateTripInput(draft)`. The name follows the flights (`defaultTripName`) until the organizer types one; the cover starts on `DEFAULT_COVER` and is a preset or a gallery photo (`CoverChoice`). Leaving with unsaved input is blocked by `usePreventRemove`: `LeaveGuard` keeps the blocked navigation action in state and shows the in-app `ConfirmDialog` („Zostań” / „Odrzuć”); „Odrzuć” dispatches the stored action, anything else drops it. A second attempt while the dialog is open keeps the first action. After saving there is no dialog.
- Offline expenses: not implemented (the budget change is the only offline write so far).
- AI day plan: not implemented.

## Backend
- Supabase project: `hwsqdlxojllclbwlhuwb` (URL + publishable key in git-ignored `.env.local`; variable names in `.env.example`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`). Anonymous sign-ins were disabled in the project when last checked (`prompts/supabase-client/plan.md` R3) — Kacper enables them for this task.
- Supabase client: `src/data/supabase.ts` loads `react-native-url-polyfill/auto`, parses both env values with `SupabaseConfigSchema` at module load (throws `Invalid Supabase env variables: <names>`), then `createClient` with the auth session in SQLite-backed `localStorage` (`expo-sqlite/localStorage/install`), `persistSession`, `autoRefreshToken`, `detectSessionInUrl: false`, and `global.fetch` = `withTimeout(fetch, REQUEST_TIMEOUT_MS)` from `src/data/fetch-timeout.ts`: every request (database, RPC, auth) is aborted after 20 s, which postgrest-js reports as `status: 0` and auth-js as `AuthRetryableFetchError` — both handled as "unreachable". Imported only by `src/data/app-trip-repository.ts`, which also ties token refresh to `AppState` on phones (`keepSessionFresh`, not on web).
- Auth: anonymous sign-in at first launch (`ensureSession`); the project setting "Anonymous sign-ins" must be on (local `supabase/config.toml` has it on).
- Tables & RLS policies (`trips`, `trip_members`, `flight_segments`, `to authenticated`, `(select auth.uid())`): owner — select / insert / update / delete on `trips` (`owner_id`), and on `trip_members` / `flight_segments` via `private.is_trip_owner(trip_id)`; linked member (`trip_members.user_id`) — select only via `private.is_trip_viewer(trip_id)`. The helpers are `security definer`, `search_path = ''`, in the non-exposed `private` schema, executable only by `authenticated`. Grants: `authenticated` select / insert / update / delete, `service_role` all, nothing for `anon`.
- `trip_photos` RLS: select = owner or linked member; insert / delete = owner; no update policy. Grants: `authenticated` select / insert / delete, `service_role` all, nothing for `anon`.
- Storage policies on `storage.objects` (bucket `trip-photos`, `to authenticated`):
  - insert: your own `owner_id`, into a trip you own (the trip comes from the path);
  - select: your own files, or files of a trip you are linked to;
  - update: your own files, and only inside a trip you own;
  - delete: your own files. This lets the organizer clean up even after the trip is gone.
- RPC: `public.create_trip(trip jsonb, members jsonb, segments jsonb)` — `security invoker` (RLS applies), inserts the three in one transaction with `on conflict (id) do nothing` (idempotent), owner always the caller; executable by `authenticated`, `service_role`.
- Edge Functions: none.
- Tooling: Supabase CLI (`pnpm supabase …`); `pnpm test:db` runs `supabase/tests/*.sql` (plain SQL with `ok` / `throws` helpers, rolled back) against `$DB_URL`; `pnpm db:types` regenerates `src/data/database.types.ts` from local Supabase. SQL test files: `trips_rls`, `trip_photos_rls`, `trip_photos_storage`, `trip_covers`. The Storage tests need a local Supabase (`pnpm supabase start`, Docker). All four migrations are pushed to the project; Kacper pushed the photo ones on 2026-10-17 (trip-photos D37), and the covers one was pushed on 2026-10-18 (trip-covers step 6).
- Trip storage: `TripRepository` (`src/data/trip-repository.ts`) — Supabase implementation in the app, in-memory implementation (`LOCAL_OWNER_ID` as owner) for tests.

## Frontend
### Screens & routes
| Route | File | What it shows |
|---|---|---|
| (root) | `src/app/_layout.tsx` | Stack navigator. Keeps the splash screen until DM Sans (400/500/600/700) and Fraunces (500/600/700) are loaded; on a font error it renders with system fonts. Imports `@/i18n`. Wraps the Stack in `AppProviders`. Header hidden on `(drawer)` and on `trips/new` (the wizard's nested stack draws its own); `trips/[tripId]/photos` is a `fullScreenModal` without a header. |
| `(drawer)` (layout) | `src/app/(drawer)/_layout.tsx` | expo-router `Drawer` (`drawerType: 'front'`, header hidden) around the `(tabs)` group; the wizard and the photo viewer stay in the root stack above it. `swipeEnabled` is true only on the path `/` (and not on web), so the panel opens only from „Podróż” (pill-nav-and-dialog R3); it opens over the pill. Panel: 85 % of the window up to `size.drawerMaxWidth` (360dp), `surface.elevated`, `radius.xl` right corners, follows the system theme; scrim `overlay.scrim` labelled "Zamknij"; its content (`TripsDrawer`) is `aria-hidden` while closed. "Nowa podróż" closes the panel and pushes `/trips/new`. |
| (tabs) (layout) | `src/app/(drawer)/(tabs)/_layout.tsx` | `Tabs` from `expo-router/js-tabs` (the `expo-router` `Tabs` export is deprecated in 57.0.24), `headerShown: false`, five screens in `NAV_TABS` order, custom `tabBar` = `PillTabBar` → `PillNav`. A tap emits `tabPress` (cancellable) and then navigates, like the library's own bar. The bar is absolutely positioned, so the scenes keep the full height and the pill floats over them. Blurred screens stay mounted (the home screen's photo upload queue relies on it). Android back from another tab goes to „Podróż” (`backBehavior: 'firstRoute'`, the default). |
| `/expenses`, `/places`, `/plan`, `/profile` | `src/app/(drawer)/(tabs)/{expenses,places,plan,profile}.tsx` | `EmptyScreen`: a title (Heading 1, the tab's label; `/profile`: „Profil użytkownika”, `nav.profileTitle`) and „Ten ekran pojawi się wkrótce.”; safe-area aware, side padding 20dp (16dp below 360dp), bottom padding above the pill. No illustration, button, or loading / error / offline states (pill-nav-and-dialog D3, A8: a deliberate exception to design-context §12 and §10.19 until the real features arrive). |
| `/` | `src/app/(drawer)/(tabs)/index.tsx` | Home screen (`HomeScreen`), by query state. Its bottom spacing comes from `usePillClearance()`: the trip view's scroll padding (clearance + 16; when offline the pinned banner ends the scroll, so `spacing[6]`), the pinned offline banner (clearance + 12), the empty / error screen padding (clearance + 16), and the snackbar `bottomOffset` (`navPill` + 16, plus the button when it is pinned). Every state has the menu button "Otwórz listę podróży" that opens the panel. **Trip** (always dark, inside `DarkThemeScope`): `CurrentTrip` — the round menu button pinned over the photo (first for screen readers), `TripHero` (50 % of the window, the cover (`CoverImage`, full size) fading into ink, name in Display XL, dates + days), then `PhotoStrip` (full width, outside the padded column, its first tile aligned with the cards; tapping a photo pushes the viewer), then scrollable cards on `surface.secondary`: "Loty" (outbound / return lines in airport-local time, layover labels from stored instants), "Podróżni · N" (Ty + names), "Budżet" (per person, total, ~per person per day; ghost "Zmień" — screen reader "Zmień budżet" — opens `BudgetSheet`; `SyncIndicator` while a change is not sent); light status bar while focused and the panel is closed; the offline banner pinned at the bottom when offline. No pinned "Utwórz podróż" (a new trip starts from the panel). Offline the trip comes from the SQLite copy. The round ⋮ "Opcje podróży" (top-right, mirroring ☰, read right after it) opens `TripMenuSheet`: rows „Nazwa i zdjęcie” (`Pencil`), „Zmień budżet” (`Wallet`), a divider, „Usuń podróż” (`Trash2`, error colour); offline the first and last are disabled with the hint „Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.” under the list. Choosing a row swaps the menu's sheet for the next one in the same render. `TripDetailsSheet`: name field (≤ 60) + `CoverPicker` (starts on the trip's cover, its `coverUrls` passed) + „Zapisz”, validated with `TripDetailsInputSchema` and the wizard's messages; error inline and announced; closes on success. `DeleteTripSheet`: „Usunąć podróż „{name}”?”, body, destructive „Usuń podróż” above „Anuluj” (full width, 16dp apart); while the delete runs both are disabled and the sheet cannot be dismissed (`dismissible={false}`); a failure shows an inline error. After a delete the route shows the `Snackbar` „Podróż usunięta.”; with the param `coverUploadFailed=1` (from the wizard) it shows the failed-cover snackbar once (it lives in the route, not in `CurrentTrip`, so it survives the reload and the empty state). **Loading**: full-bleed `TripHeroSkeleton` (one accessible "Wczytywanie podróży" element) with the round menu button over it. **Error** (`CircleX`, "Nie udało się wczytać podróży.", announced, "Spróbuj ponownie" refetches) and **empty** (suitcase + 2 lines) show the menu `IconButton` left of the title "Twoje podróże" and keep "Utwórz podróż", with the offline banner above it when offline. The snackbar is drawn in every state, inverse to the screen behind it (light on the dark trip view, dark on the light states), and on the empty / error states it sits above "Utwórz podróż" (`bottomOffset`). Safe-area aware; side padding 20dp, 16dp below 360dp; content max width 720dp. |
| `/trips/[tripId]/photos?photoId=` | `src/app/trips/[tripId]/photos.tsx` | The full-screen photo viewer (`PhotoViewer`) inside `DarkThemeScope`: ink with a light status bar. **Pages:** a paging `FlatList` (`getItemLayout`, `initialScrollIndex` on the tapped photo; an unknown id opens the first). Each page shows the whole photo (`contain`), cached under the file's storage path; a photo that cannot load shows „Nie udało się wczytać zdjęcia.”. **Top bar:** „Zamknij” (`X`), the counter pill „3 z 12” (`hero.control`, Caption) and „Usuń zdjęcie” (`Trash2`, disabled offline). Offline, a hint pill shows at the bottom. When the list changes, the viewer keeps the photo in view (by id). **Delete:** „Usuń zdjęcie” opens `DeletePhotoSheet` (not dismissible while deleting; errors inline); afterwards the viewer shows the next photo, else the previous, else it closes. **Close / back:** `back()`, or `replace('/')` when there is no history. The home screen stays mounted under the viewer, because the upload queue lives there. |
| `/trips/new` (layout) | `src/app/trips/new/_layout.tsx` | Nested Stack inside `TripDraftProvider`; header "Nowa podróż" (theme tokens); step 1 gets a `HeaderBackButton` "Twoje podróże", later steps the native back "Wstecz". `LeaveGuard` shows the in-app `ConfirmDialog` "Odrzucić wpisane dane?" (destructive „Odrzuć” above „Zostań”) when the draft changed and the trip is not saved. |
| `/trips/new` | `src/app/trips/new/index.tsx` | Step 1 — flights: disabled "Wyślij bilet · wkrótce", a "Lot tam" / "Powrót" switch (`SegmentedControl`, outbound first) showing one direction's section of segment cards (airport search, date/time pickers, optional flight number), amber layover labels between segments, "Dodaj przesiadkę"/"Usuń", return suggested as the outbound reversed, companions stepper (0–19) on both tabs. "Dalej" validates (`FlightsStepInputSchema`), switches to the tab with the first error (outbound first), scrolls to that card and announces. |
| `/trips/new/friends` | `src/app/trips/new/friends.tsx` | Step 2 (skipped at 0 companions): one card per friend with name and 17 interest chips in 6 groups; validates names. |
| `/trips/new/budget` | `src/app/trips/new/budget.tsx` | Step 3: amount per person (whole trip, without flights) + currency segmented control (destination currency, PLN, EUR, USD); group total and ~per person per day; solo wording. |
| `/trips/new/summary` | `src/app/trips/new/summary.tsx` | Step 4: first a "Nazwa i zdjęcie" card (name field pre-filled "<from city> → <destination city>", max 60, empty → "Podaj nazwę podróży" on save; `CoverPicker`, Auckland preselected, always sent), then trip / travellers / budget cards with "Zmień" back to each step; "Utwórz podróż" saves (loading, error announced), then returns to `/` (with `coverUploadFailed=1` when a gallery cover came back as a preset). Redirects to step 1 when the draft is incomplete (the name is not part of that check). |

### Shared components / hooks
- `Field` (label + error frame, input border/box/text styles), `TextField`, `AirportField` (search over the bundled list), `DateTimeField` (`.tsx` iOS wheel in UTC, `.android.tsx` date→time dialogs, `.web.tsx` browser input; shared `DateTimeFieldBase`), `AmountField` (§10.5), `TextButton` (secondary / ghost / destructive — secondary with the `status.error` label), `IconButton` (disabled at `opacity.disabled`), `Stepper` (adjustable for screen readers), `SegmentedControl`, `Chip` (checkbox), `Card`, `StepIndicator` ("Krok 2 z 4" + bar), `LayoverLabel`, `CoverPicker` (required cover: presets or a gallery photo, see below), `TripHero` + `TripHeroSkeleton`.
- Wizard pieces in `src/features/trip-create/`: `WizardScreen` (step indicator, scroll, pinned action with optional error; the whole frame is a `KeyboardAvoidingView` with `behavior="padding"` on iOS and Android and `keyboardVerticalOffset` = the stack header height (`useHeaderHeight`), so the keyboard pushes the content and "Dalej" up; the `ScrollView` does not adjust its own keyboard insets, that came on top of the padding on iOS; instead, on iOS only, the internal `useScrollFocusedFieldIntoView` listens to `keyboardDidShow`, measures the focused input (`TextInput.State.currentlyFocusedInput()`) and the scroll view (`getNativeScrollRef()`) with `measureInWindow`, and scrolls a field still below the visible part up to sit `spacing[4]` above "Dalej", using the offset tracked from `onScroll`) + `useGoToNextStep`, `SegmentCard`, `FriendCard`, `TripDraftProvider` / `useTripDraft`, `draft.ts` (types incl. `name: string | null` and a required `coverImageUri: CoverChoice`, `withCompanionCount`, `addLayover`, `withOutbound`, `budgetCurrency*`, `tripName`, `toCreateTripInput`), `steps.ts`, `field-errors.ts`.
- `useTripList`, `useCurrentTrip`, `useSelectTrip`, `useCreateTrip`, `useSetTripBudget`, `useUpdateTripDetails`, `useDeleteTrip` (`src/hooks/useTrips.ts`); `useTripRepository` (`src/providers/AppProviders.tsx`); `useRequestBudgetSync`, `useIsOffline` (`src/providers/BudgetSync.tsx`).
- `BottomSheet` (§10.12: RN `Modal`, scrim backdrop "Zamknij", 36×4 handle, system back, swipe down on the header — handle and title, one native view (`collapsable={false}`) claiming the touch at its start through a `PanResponder` created once; the sheet follows the finger, closes when released past 60dp, otherwise springs back over `duration.small` (at once with reduced motion); optional `dismissible` (default `true`): when `false` the backdrop and back do nothing and a swipe always springs back; 24dp top corners, ≤ 90 %, safe-area padding, keyboard avoiding with a `KeyboardAvoidingView` `padding` on iOS and Android and no offset — the modal is `statusBarTranslucent`, so its content starts at the top of the window like the keyboard's coordinates, no slide with reduced motion), `SyncIndicator` (D10: `Clock` + "Czeka na wysłanie" in info / `CircleX` + "Nie udało się wysłać" in error + ghost "Spróbuj ponownie"; nothing when synced), `OfflineBanner` (D11: `WifiOff` + design-context copy, polite live region), `BudgetSheet` (`src/features/home/`: the wizard's heading / hint / amount label, amount pre-filled with `formatAmountInput`, the wizard's validation rules, "Zapisz", device-save error announced).
- `Snackbar` (`src/components/Snackbar.tsx`) — §10.16, trip-edit-menu D11, D14: shown while `message` is set, announced, `onHide` after `duration.snackbarAutoDismiss` (3500 ms) — the owner clears the message there; fades in / out over `duration.small` (none with reduced motion), keeping the last text during the fade; `colors.snackbar.*`, `radius.md`, Body M, padding 16dp, min height 48 / max width 360 (`size.snackbar*`), bottom = safe area + 16dp + optional `bottomOffset`; role `alert`.
- `ConfirmDialog` (`src/components/ConfirmDialog.tsx`) — §10.17, pill-nav-and-dialog A1–A4:
  - **Props:** `visible`, `title`, `message`, `confirmLabel`, `cancelLabel`, `destructive?`, `onConfirm`, `onCancel`. The caller passes translated strings.
  - **Shell:** RN `Modal` (`transparent`, `statusBarTranslucent`, `animationType="none"`). The scrim `Pressable` (`overlay.scrim`, labelled „Zamknij”) and Android back call `onCancel`, never `onConfirm`.
  - **Box:** width viewport − 40dp up to `size.maxContentWidth`, `radius.lg`, padding 24dp, `surface.elevated`, `elevation.dialog` (no shadow in dark).
  - **Text:** title Heading 3 (accessibility header), message Body M in `text.secondary`.
  - **Actions:** stacked full width, 16dp apart, confirm on top: a destructive `TextButton` (error colour) when `destructive`, else a `PrimaryButton`; cancel is a secondary `TextButton`.
  - **Motion:** fades over `duration.dialog` (220 ms) with its own opacity animation and unmounts after the fade-out; no animation with reduced motion. `accessibilityViewIsModal` on the box.
  - **Used by:** the wizard's `LeaveGuard`.
- `PillNav` (`src/components/PillNav.tsx`) — pill-nav-and-dialog D1–D4, R1:
  - **Props:** `items {key, label, Icon}[]`, `activeKey`, `onSelect(key)`. It is presentational; `NAV_TABS` and the router live in `src/features/nav/` and the tabs layout.
  - **Capsule:** `position: absolute`, `bottom` = safe-area inset + 16dp, width viewport − 32dp up to `size.maxContentWidth`, height `size.navPill` (64), `radius.full`, `colors.nav.background` (ink in both themes) with a 1dp `nav.border`, `elevation.floating`. The wrapper is `pointerEvents="box-none"`.
  - **Items:** `Pressable`s of equal width, each ≥ 44 × 44dp, role `button` with `selected` state and the label as accessibility label. Active: icon 24dp + label in `nav.active` (brand); inactive: icon 20dp in `nav.textInactive`. The pressed state uses `nav.border` as background, the focus ring is 2dp in `nav.active`. The container has no role and is not `accessible`, so each item is its own screen-reader stop.
  - **Animation:** on a change, the new and the old active item scale towards 1 over `duration.small` (180 ms), JS driver; none on mount or with reduced motion (the end state is set at once, also when the setting flips mid-animation).
  - **Font scale (R1):** above 1.3 inactive items show only the icon; the active label may truncate on very large text.
- `usePillClearance` / `usePillBottomOffset` (`src/features/nav/usePillClearance.ts`) — pure hooks, no context: the bottom offset is inset + `spacing[4]`, the clearance is that + `size.navPill`. Used by `PillNav`, `EmptyScreen` and the home screen.
- `PrimaryButton` (`src/components/PrimaryButton.tsx`) — design-context §10.1: min height 52dp (grows with Dynamic Type), 16dp horizontal padding, 12dp radius; states default / pressed / focused (2dp brand ring, 4dp offset) / disabled / loading (spinner, `busy`); optional leading lucide icon (20dp, stroke 2, hidden from screen readers).
- `HeroIconButton` (`src/components/HeroIconButton.tsx`) — trips-drawer P5: 44dp circle on `hero.control` (ink 50 %), solid ink when pressed, 24dp icon in `hero.text`, always labelled; optional `disabled` (`opacity.disabled`, trip-photos D30). `HeroMenuButton` (`src/features/home/`) places it under the status bar at the screen's side padding; `TripMenuButton` (⋮, `EllipsisVertical`, "Opcje podróży") mirrors it on the right.
- `TripsDrawer` (`src/features/drawer/TripsDrawer.tsx`) — the side panel's content (trips-drawer D4, P1): "Twoje podróże" (heading1); sections "Nadchodzące" (not ended yet, soonest first) / "Minione" (most recently ended first) by the device's date, a section without trips left out; rows per §10.8 (≥ 64dp, 16dp side padding, 1dp divider, `surface.secondary` pressed or selected) with a 48dp thumbnail (`CoverImage` thumbnail on the placeholder surface while it loads; that surface is `surface.secondary`, and `surface.elevated` on the open trip's row so it stays visible there — D8), name (2 lines) and dates, `Check` in the brand colour on the open trip, screen reader "<name>, <dates>" + selected; tapping another trip selects it and closes the panel, the open trip only closes it; footer: offline banner above "Nowa podróż". Loading: 3 static skeleton rows in one busy element; error + retry; no trips: "Nie masz jeszcze żadnej podróży." / "Zaplanuj pierwszą i zaproś znajomych." (D5).
- `CoverImage` (`src/components/CoverImage.tsx`) — trip-covers C3: one cover image for the hero (`variant="full"`), the side panel and the picker (`"thumbnail"`). The value is parsed with `CoverChoiceSchema` through `resolveCoverSource` (`src/lib/cover-presets.ts`): a preset → its bundled file (`COVER_PRESETS`, a `Record` over the ids); `photo:` + `urls` → the signed URL with `cacheKey` `cover:<uuid>:<variant>` (disk cache offline and after the URL expires); `photo:` without urls, or anything invalid → the default preset; `file://` → that file. `surface.secondary` behind, `transition` `duration.small` (none with reduced motion), `onError` → the default preset once. `aria-hidden` unless labelled.
- `CoverPicker` (`src/components/CoverPicker.tsx`) — trip-covers P1, D11, D12: field „Zdjęcie okładki” (required), a 16:9 preview, then a sideways-scrolling radiogroup of 16:9 tiles (`size.coverTile` 112dp, `radius.sm`): „Twoje zdjęcie” first when the value is not a preset (it stays after a preset is chosen), the five presets (Auckland, Bali, Pekin, Dżakarta, Majorka), „Z galerii” last (16:9 crop). Selected: 2dp brand border (`size.focusRing`) + `Check`. The row opens scrolled to the selected tile. `value: string`, `onChange(CoverChoice)`, optional `urls`.
- `PhotoStrip` (`src/features/trip-photos/`), trip-photos P1–P3:
  - **Row:** a horizontal `FlatList` of 80dp tiles (`size.photoTile`, `radius.md`, 8dp apart), after the „+” tile.
  - **„+” tile:** labelled „Dodaj zdjęcia”, `ImagePlus` on `surface.secondary`, `surface.elevated` when pressed, disabled offline.
  - **Photos:** thumbnails cropped `cover`, cached under the thumbnail's storage path.
  - **Uploads:** under `overlay.scrim` with a spinner while sending. A failed one shows `CircleX`; tapping it sends it again. Offline it is disabled and labelled without „Stuknij…” (D29).
  - **Lines under the strip:**
    - „Wysyłam zdjęcia: n z N” (polite);
    - „Nie udało się wysłać N zdjęć” + „Spróbuj ponownie” (disabled offline);
    - the load error + retry;
    - the gallery error;
    - the offline hint.
  - **Loading:** 3 static skeleton tiles as one busy element. A failed read keeps a list already shown.
- `TripsEmptyIllustration` (`src/components/TripsEmptyIllustration.tsx`) — 160×160 SVG suitcase with a luggage tag in theme colours (brand body, `text.primary` outline, `category.transport` tag), wrapped in a `View` with `aria-hidden` so it is hidden from screen readers on iOS, Android and web.
- `useTheme()` (`src/theme/useTheme.ts`) — returns `darkTheme` when the system colour scheme is `dark`, otherwise `lightTheme`; inside `DarkThemeScope` always `darkTheme`.

### Theme & i18n
- **Tokens** live in `src/theme/tokens.ts` (palette, dark roles, semantic/budget/category colours, spacing, radius incl. `segmented`, size incl. `drawerMaxWidth` 360, `thumbnail` 48, `photoTile` 80, `snackbarMinHeight` 48 and `snackbarMaxWidth` 360, `size.navPill` 64, `duration` (`small` 180 ms, `dialog` 220 ms, `snackbarAutoDismiss` 3500 ms), `elevation.floating` (§6.1 level 2, the pill) and `elevation.dialog` (level 4) — shadows in light, `{}` in dark, `colors.nav.*` (`background` ink, `border`, `textInactive`, `active` brand — the same in both themes), `opacity` (`disabled` 0.4, §10.2), breakpoints, elevation, `gradient.heroFade`) and `src/theme/typography.ts` (type scale; font weight is encoded in the `@expo-google-fonts` family name). Components consume semantic tokens from `theme.ts` (`colors.background`, `colors.text.*`, `colors.action.*` incl. `link`, `colors.input.border`, `colors.hero.*` — ink background, light text and `control` (ink 50 % behind the menu button over the photo), same in both themes, `colors.overlay.scrim` — ink at 50 % behind sheets (D12), `colors.snackbar.background` / `.text` — inverse: `neutral.900` / `neutral.50` in light, swapped in dark (trip-edit-menu D11), `elevation.card` — shadow in light, none in dark, `gradient`), never raw palette values.
- **i18n**: `src/i18n/index.ts` creates its own i18next instance (`createInstance()` + `initReactI18next`, synchronous init). Language = the device's first preferred locale if it is `pl` or `en`, otherwise `en`. It is read once at startup. Dictionaries: `src/i18n/locales/pl.json`, `en.json` (same keys, checked by a test).

## Testing
- Jest (`jest-expo` preset) + React Native Testing Library 14 (async `render` / `fireEvent`); route tests use `renderRouter` from `expo-router/testing-library` with the real root layout.
- Test files never live under `src/app/` (Expo Router would turn them into routes); route tests sit in `src/__tests__/app/`.
- `package.json` → `jest.moduleNameMapper` maps `lucide-react-native` to its CommonJS build, because its React Native entry is `.mjs`, which jest-expo does not transform.
- `useColorScheme` / `useWindowDimensions` are mocked at `react-native/Libraries/Utilities/*` (RN imports them internally, so spying on `Appearance` / `Dimensions` does not work).
- Jest mocks RN `View` as a pass-through, so `aria-*` → native accessibility prop conversion is not observable in tests.
- Pickers (`@expo/ui`, `expo-image-picker`), `expo-crypto` and (in the home tests) `expo-status-bar` are mocked; the Supabase client test mocks `createClient` and `expo-sqlite/localStorage/install` and loads the module with `jest.isolateModules` per env (no network in tests); route tests use stand-in screens for steps they don't test; image `require`s are stubs carrying their path.
- `jest.setup.ts` (`setupFilesAfterEnv`): `@/data/app-trip-repository` → the in-memory repository, `expo-network` → `src/test/mock-network.ts` (online unless a test calls `setNetwork`), and the test mocks of `react-native-gesture-handler`, `react-native-worklets` and `react-native-reanimated` (the drawer). Route tests that need a specific repository mock `@/data/app-trip-repository`. Route tests mount the home screen through the `(drawer)/(tabs)` groups (route maps need `'(drawer)/(tabs)/_layout': TabsLayout`; maps that omit the four empty screens make expo-router warn "Route … is extraneous"); the wizard guard tests drive the real `ConfirmDialog` (scrim „Zamknij", `requestClose`) instead of spying on `Alert`; `src/test/drawer-status.ts` reads the panel's open / closed status from the router state. The Reanimated mock does not apply animated props, so in Jest the drawer's scrim is not hidden while closed (the panel's own content is, through its `aria-hidden` wrapper).
- Data-layer tests use a real SQLite (`node:sqlite`, Node 22) behind the `LocalDb` interface (`src/test/node-sqlite.ts`) and a fake Supabase client that records every query chain (`src/test/fake-supabase.ts`). The request-timeout tests in `supabase-trip-repository.test.ts` use the real `createClient` over a stub server that never answers (session pre-stored, fake timers, no network).
- `fake-supabase.ts` also records Storage calls (`storage.from(bucket)`: `upload`, `createSignedUrls`, `list`, `remove`). `jest.setup.ts` mocks `expo-image-manipulator` and `expo-file-system`; `src/test/__tests__/native-mocks.test.ts` keeps the mocks in line with the real typings.
- Photo database tests:
  - `trip_photos_rls.sql`: owner, a stranger who owns another trip, a linked member, anon; the idempotent insert; the cascade.
  - `trip_photos_storage.sql`: the bucket, the path helper, the Storage policies. Needs a local Supabase.
  - `trip_covers.sql`: the cover constraint and default, null refused (also through `create_trip`), the migration re-run on old values, RLS on the column, Storage for cover files (owner / viewer / stranger).
  - Counts after `reset role` are scoped to the test's own trips / users, so the SQL tests run on a used local database (trip-covers D13). There is no local `psql` on Kacper's machine; the files were run through `docker exec` in the db container.
- Database tests: `supabase/tests/trips_rls.sql` (RLS for owner / stranger / linked viewer / anon, constraints, idempotent `create_trip`, last write wins, the owner's rename / cover change (removing the cover is refused, 23502) and delete with cascade to members and segments) — `pnpm test:db`, not part of `pnpm test`. aria-hidden elements need `includeHiddenElements: true`. Some date/time tests set `process.env.TZ` inside the test, which does not change Node's time zone under Jest (next point); device-time-zone independence is checked by running the whole suite under `TZ=…`.
- Jest cannot switch the time zone inside a test (`process.env.TZ` set in a test does not reach Node); time-zone checks need the whole run under `TZ=…`.
- Current suite: 89 suites, 1576 tests (2026-10-18, after the trip-covers review fixes). The last run under `TZ=Pacific/Auckland` was at 64 suites / 747 tests.
- A route registered in the root layout but missing from a test's own route map makes expo-router warn "Too many screens defined" (seen for `trips/[tripId]/photos` in the older route suites). It is only a warning.
- `WizardScreen.test.tsx` spies on `Keyboard.addListener` and fires `keyboardWillShow` / `keyboardWillHide` itself, with a fake `layout` event (it needs `persist()`), to check the bottom padding; it also fires `keyboardDidShow` with fake `measureInWindow` views for the focused field and the scroll view (`ScrollView.prototype.getNativeScrollRef`, `TextInput.State.currentlyFocusedInput`) to check the iOS scroll, and redefines `Platform.OS` as `'android'` for the Android case (jest-expo runs as iOS). `BottomSheet.test.tsx` drives the sheet's `KeyboardAvoidingView` the same way, on Android (`jest.replaceProperty(Platform, 'OS', 'android')`, `keyboardDidShow` / `keyboardDidHide`) and iOS. For the swipe it walks the responder chain itself (a `modal-host` view stands in for RN Modal's touch-claiming host, which Jest's Modal lacks) and checks the sheet's `translateY`.

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
`expo-router` (incl. `expo-router/drawer`, on `react-native-drawer-layout` + `react-native-gesture-handler` + `react-native-reanimated` / `react-native-worklets`, already installed), `expo-font`, `expo-splash-screen`, `expo-localization`, `i18next`, `react-i18next`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/fraunces`, `lucide-react-native`, `react-native-svg`, `react-native-safe-area-context`, `zod`, `@tanstack/react-query`, `@expo/ui` (date/time pickers), `expo-crypto` (UUIDs), `expo-image-picker` (cover photo and trip photos from the gallery), `expo-image` (cover preview, trip hero, side panel thumbnails, trip photos and their disk cache), `expo-status-bar` (light bar over the hero), `@supabase/supabase-js` (trips, auth), `expo-sqlite` (auth session `localStorage`, and the database for budget changes, trip copies and the chosen trip), `expo-network` (offline detection, reconnect), `react-native-url-polyfill` (Supabase on React Native), `expo-image-manipulator` (downscale and re-encode trip photos without EXIF), `expo-file-system` (read the photo bytes for upload). Dev: `supabase` (CLI), `@types/node` (tests: `fs`, `node:sqlite`).

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
| `tester` | `claude-haiku-5-5` (Haiku 5.5), effort high | Read, Grep, Glob, Bash, `mcp__mobile-mcp` | Walks a plan's manual steps on a connected phone / emulator (MCP server `mobile-mcp`, `.mcp.json`); PASS / FAIL per scenario; never fixes |

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
| Supabase (project `hwsqdlxojllclbwlhuwb`) | Trips (Postgres + RLS), trip photos (private Storage bucket, signed URLs), anonymous auth | `src/data/supabase-trip-repository.ts`, `src/data/budget-sync.ts` via `src/data/supabase.ts` | Publishable key in `.env.local` (public by design); no secret key or DB password in the repo |
| OurAirports, mwgg/Airports, datasets/country-codes | Airport list (generated once at dev time, bundled) | `scripts/build-airports.mjs` only | — |

## Key decisions
- 2026-10-18 — Trip covers (`prompts/trip-covers/plan.md` D1–D14): every trip has a cover, stored in `cover_image_uri` as `preset:<id>` (bundled, works offline; never a bundle path, which changes between builds) or `photo:<uuid>` (a gallery photo compressed on the phone, in the trip's Storage folder). Default `preset:auckland`, preselected in the wizard; old values were rewritten to it. A failed gallery upload on create keeps the default and shows a snackbar via a route param.
- 2026-10-18 — The fifth pill tab is „Profil” (title „Profil użytkownika”, `CircleUser`, route `/profile`); still a placeholder (`prompts/profile-tab/plan.md`).
- 2026-10-18 — Pill navigation and confirm dialog (`prompts/pill-nav-and-dialog/plan.md` D1–D4, A1–A8, R1–R5):
  - Five screens in a `(tabs)` group under the Drawer, switched by a floating pill. The Tabs sit inside the Drawer so the side panel slides over the pill.
  - The pill is always ink (both themes) with a brand-coloured active item; the active item grows with an animation.
  - It uses `Tabs` from `expo-router/js-tabs`, because the `expo-router` export is deprecated; no new dependency.
  - Home content leaves room for the floating pill through `usePillClearance`.
  - The side panel is limited to „Podróż” (R3).
  - Labels of inactive items hide above font scale 1.3 (R1), and the four empty screens have no illustration or loading / error / offline states (D3, A8). Both are Kacper's deliberate exceptions to design-context §10.13, §10.19 and §12.
  - Leaving the wizard asks through the in-app `ConfirmDialog` instead of a system alert; the web `confirm()` branch is gone.
  - Added token `duration.dialog` (§9.1).
  - Items are `button`s with a selected state; `tab` / `tablist` roles were the alternative, not chosen.
- 2026-10-17 — Trip photos (`prompts/trip-photos/plan.md` D1–D37, P1–P8):
  - Files live in a private Supabase Storage bucket and are shown through signed URLs valid 1 h; a public bucket was rejected.
  - A 480 px thumbnail is stored next to each photo of ≤ 2048 px.
  - The phone re-encodes every photo, which drops its EXIF and so its GPS.
  - The date taken is kept as the camera's clock, without a time zone. Photos are ordered by it; undated photos go last.
  - Uploads run one at a time while the app is open; they are not queued on the phone.
  - Adding and deleting need internet; photos already seen show offline.
  - The entry point is a strip under the hero, not a ⋮ menu item.
  - The full-screen viewer is a route, so its delete sheet never opens over another Modal.
  - Deleting a trip deletes its files first.
  - New dependencies: `expo-image-manipulator`, `expo-file-system`.
  - For device runs, a local Supabase may be reached over http, only at `127.0.0.1`, `localhost` and `10.0.2.2`.
- 2026-10-15 — The delete sheet cannot be dismissed while the delete runs: `BottomSheet` gets `dismissible` (default `true`). CodeRabbit's no-op `onClose` was rejected because a swipe would leave the sheet stuck pulled down (`prompts/trip-edit-menu/plan.md` D22, CodeRabbit review on PR #10).
- 2026-10-14 — Trip menu (⋮ over the photo → bottom sheet): rename / cover, budget, delete; rename and delete are server-first and disabled offline (no offline queue); a delete that finds the trip already gone is a success; after a delete the phone forgets every copy of the trip and the home screen shows the default trip or the empty state with an inverse snackbar; destructive = secondary button with the error label; every `BottomSheet` closes by a swipe from its header (60dp). No new dependency, no schema or migration change (`prompts/trip-edit-menu/plan.md` D1–D21).
- 2026-10-14 — On iOS the wizard's `ScrollView` no longer adjusts its own keyboard insets (they came on top of the `KeyboardAvoidingView` padding: empty space at the end of the form, a field behind "Dalej"); `WizardScreen` scrolls the focused field into view itself after `keyboardDidShow`. `BottomSheet` pads for the keyboard on Android too (edge-to-edge dialog windows are not resized). No new dependency (`prompts/wizard-keyboard/plan.md` Q5, D5–D8).
- 2026-10-13 — The create-trip wizard avoids the keyboard with React Native's `KeyboardAvoidingView` in `WizardScreen` (all four steps), `padding` on Android too because Android runs edge-to-edge and the window is not resized for the keyboard; "Dalej" moves up with the keyboard. `react-native-keyboard-controller` was rejected (new native dependency) (`prompts/wizard-keyboard/plan.md` D1–D4).
- 2026-10-10 — On the open trip's row the panel's thumbnail takes the panel's surface (`surface.elevated`), the other rows keep `surface.secondary`, so the placeholder never blends into the selected background (`prompts/trips-drawer/plan.md` D8). P2 (a) and the step 7 deviations confirmed by Kacper (D6, D7).
- 2026-10-08 — Side panel (expo-router Drawer, no new dependency) with all trips in "Nadchodzące" / "Minione"; the home screen shows the current trip — the one chosen there (remembered in SQLite on the phone, never sent to Supabase), else the default trip (soonest upcoming or ongoing, else the most recently ended); a new trip becomes the chosen one; offline copies of the list and of every trip opened on the phone; the pinned "Utwórz podróż" leaves the trip view; the menu button sits over the photo on ink at 50 %; the panel follows the system theme; its slide does not follow reduced motion (accepted, P2 (a)) (`prompts/trips-drawer/plan.md` D0–D5, A1–A8, P1–P6).
- 2026-10-07 — Every Supabase request gives up after 20 s (shared client's `global.fetch`), so a silent network (captive portal; RN Android fetch has no default timeout) ends as "unreachable": the budget sync queue is never stuck and the home screen falls back to the device copy (`prompts/trips-supabase/plan.md` D14, CodeRabbit review on PR #5).
- 2026-10-06 — Trips live in Supabase; creating a trip needs internet. Only the trip's budget per person is editable offline (SQLite first, synced later, last write wins by `budgetUpdatedAt`); the nearest trip is copied to SQLite for offline reading. Anonymous sign-in at first launch; migrations through the Supabase CLI, pushed by Kacper; cover photo URI stored as-is; example trips removed (`prompts/trips-supabase/plan.md` D1–D8). *Extended 2026-10-08: copies of the trip list and of every trip opened on the phone, and the chosen trip (trips-drawer D2, D3).*
- 2026-10-06 — Budget UI: "Zmień" on the Budget card → bottom sheet with the amount (currency fixed); sync indicator line under the amount; offline banner above the pinned button; scrim token ink 50 %; the sheet closes after saving (D5, D10–D13).
- 2026-10-06 — Home screen shows only the nearest trip, CheckMyTrip-style: cover photo over ~50 % of the screen fading into ink (`#17211B`), data only; always dark (`DarkThemeScope`); the trips list was removed (`prompts/trip-flight-tabs-name-cover/plan.md` D4, D6, D7, A4, A7). *Superseded 2026-10-08: the home screen shows the current trip (chosen in the side panel, else the default trip); all trips are in the side panel (trips-drawer).*
- 2026-10-06 — Trip name is the organizer's, default "<from city> → <destination city>", set on the summary step; optional cover photo from the gallery via `expo-image-picker`, stored as a device-local URI while trips are in memory (D1–D3). *Superseded 2026-10-18 by trip-covers: the cover is required, a preset or a photo in Storage.* Flights step shows one direction at a time (D5).
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
- Pill nav and dialog (`prompts/pill-nav-and-dialog/plan.md`; some device checks listed there are pending):
  - The Android emulator run (2026-10-18) checked the pill floating over the screens, the four empty screens, the side panel opening over the pill on „Podróż” and not on „Wydatki”, Android back from „Wydatki” to „Podróż”, and the wizard's leave dialog. Still unverified on a device: touches passing through the pill's wrapper, the status bar when switching tabs, dark mode, large font size, English labels, the offline banner and the empty-state button above the pill, reduce motion, TalkBack / VoiceOver order, and iOS.
  - A swipe from the very left edge triggers Android's own back gesture; on the emulator the panel opened only from about x = 80 px (open point for Kacper).
  - On Android TalkBack the invisible „Zamknij” scrim of `ConfirmDialog` may be read before its title; if so, move the scrim after the dialog in the tree.
  - The active pill label can truncate at very large font scale (R1).
  - The snackbar covers the offline banner while visible (pre-existing).
  - The reduce-motion subscription now exists in four components (`BottomSheet`, `Snackbar`, `ConfirmDialog`, `PillNav`); a shared hook would remove it.
  - The older route test maps omit the four empty screens, so expo-router logs "Route … is extraneous" warnings.
  - Leaving the wizard with `router.navigate('/')` bypasses the guard (`dismissTo` and `back` are guarded); no code does it today.
- Wizard keyboard (`prompts/wizard-keyboard/plan.md`, checked by Kacper on iPhone and Android): while the keyboard is open, "Dalej" and the bottom sheet keep their safe-area bottom padding above the keyboard (kept, D8). On iOS the wizard scrolls to the focused field only when the keyboard shows, not when focus moves to another field while it stays open (left as is, D7). If the sheet's `Modal` ever loses `statusBarTranslucent`, the sheet needs a status-bar `keyboardVerticalOffset` on Android.
- Anonymous sign-ins must be enabled in the project's dashboard.
- Anonymous users only: deleting the app or its data loses the session and with it access to the trips (no e-mail / Apple linking yet). A refresh token the server rejects makes every request fail until the app data is cleared.
- Retrying "Utwórz podróż" after a lost response can create a second trip (new ids per attempt); `create_trip` itself is idempotent per id.
- The 20 s request timeout covers the wait for the response, not a body that stalls after the headers. On phones React Native's fetch resolves only after the whole body, so this only matters on web.
- Members have no stored order; they are shown sorted by name. The organizer is not a `TripMember` row; `travellerCount` = members + 1.
- Offline, a trip never opened on this phone has no copy: choosing it in the panel shows the error state until the phone is online. On web, `expo-sqlite`'s database needs extra setup that has not been checked — the web preview may not load trips; the list pruning uses SQLite's JSON functions (`json_each`), checked under Node's SQLite only.
- The side panel's slide always animates (the drawer library ignores reduced motion; P2 (a)). Edge swipe, scrim tap, Android back, focus moving into the panel and the slide feel are covered only by the manual steps (`prompts/trips-drawer/plan.md`); Jest mocks gesture-handler and Reanimated. Jest prints `react-native-drawer-layout`'s "InteractionManager has been deprecated" warning.
- Two rare races (`prompts/trips-drawer/plan.md` Risks): the default trip deleted between the list read and the trip read shows the empty state once; a list read that answers after a new trip was created may forget that trip as the choice. `cacheList` runs its three statements without a transaction.
- The `deviceToday` test only catches a UTC-based bug when the suite runs outside UTC.
- The budget sheet repeats the wizard budget step's amount validation (8 lines) instead of sharing it.
- Trip menu (`prompts/trip-edit-menu/plan.md`): a trips fetch already running when a delete starts is dropped from the query cache, but its repository call keeps going and can write the deleted trip back into the SQLite copies; offline afterwards the trip can show from the copy until the next online list read prunes it (N7). The snackbar does not move above the offline banner if the connection drops within 3.5 s of a delete. While a delete runs, the locked backdrop still reads as a "Zamknij" button that does nothing. `TripDetailsSheet` can be dismissed while saving (left as is, D22). `LocalStore.forgetTrip` uses raw `begin` / `commit` on the shared expo-sqlite connection. Choosing a menu row swaps one sheet's `Modal` for the next in one render (D16).
- Trip photos (`prompts/trip-photos/plan.md` Risks):
  - Photos not sent yet are lost when the app closes or the trip changes (A4).
  - A deleted photo's files can stay in Storage if removing them fails after the row is gone (R6).
  - A trip keeps its row but loses its files if the row delete fails after the files were removed (R11).
  - Every upload shares the 20 s request timeout, which a very slow network may not meet (R13).
  - Paging the photo list assumes the project's `max_rows` stays 1000 (R12).
  - A viewer left open for over 1 h cannot load photos the phone has not cached (R5).
  - A photos fetch racing a trip delete can write the deleted trip's photo copy back, until the next list read (R7).
  - The free plan has 1 GB of Storage (R8).
  - The viewer's pager re-renders on every scroll event during a swipe.
  - The emulator could not prove GPS stripping or EXIF orientation, because its camera files have neither; Kacper checked them on his phone.
- Airport list (3,153 airports, ~470 KB): city names come from merged sources with hand overrides for large airports; some small airports keep odd names, 91 airports are dropped (no time zone / city). City names are in English ("Warsaw").
- Pickers are mocked in tests; device checks are pending (see the manual steps in `prompts/trip-create-wizard/plan.md`). On web, browser back/forward may bypass the leave confirmation.
- A trip whose return local date is before the outbound arrival date (open-jaw across the date line) breaks the per-day figure and is rejected on save.
- Covers (`prompts/trip-covers/plan.md`): the Jakarta preset is only 640 px (soft on the hero) until a larger original arrives; preset licences (Q3) are Kacper's to confirm; `updateDetails` reads, then writes (not atomic, R7); old builds that send a null cover to `create_trip` fail with 23502 (R5); after `cover-not-current` the sheet keeps its stale value until reopened; a failed-cover message is dropped if another snackbar is showing. On iOS the picker crops square (Expo ignores `aspect` there); the preview and hero show it with `cover` fit.
- City names in default trip names come from the airport list (mostly English, e.g. "Warsaw → Barcelona"). A default name can exceed 60 characters (PKY → NLI is 61); the summary then shows it and asks to shorten it ("Nazwa może mieć do 60 znaków") — the redirect guard ignores the name.
- Manual device checks pending (`prompts/trip-flight-tabs-name-cover/plan.md`): long name / largest Dynamic Type over a bright photo, status bar during the push into the wizard, the light → ink switch when the home screen finishes loading, tablet layout.
- `src/hooks/useTrips.ts` exports `useTripList`, `useCurrentTrip`, `useSelectTrip`, `useCreateTrip`, `useSetTripBudget`, `useUpdateTripDetails` and `useDeleteTrip`.
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
- 2026-10-18 — profile-tab: route `settings` → `profile`, tab key `profile`, label „Profil”, title „Profil użytkownika”, icon `CircleUser`.
- 2026-10-18 — trip-covers:
  - **Schemas:** new `src/schemas/cover.ts`; `Trip.coverImageUri` required, `coverUrls` on `TripSummary` / `TripListItem`; `TripDetailsInput.coverImageUri: CoverChoice` required; `HttpUrlSchema` moved to `common.ts`.
  - **Database:** migration `20261018120000_trip_covers.sql` (rewrite, default, not null, check), applied locally and to the hosted project; new `supabase/tests/trip_covers.sql`; the photo SQL tests no longer assume an empty database.
  - **Data:** repositories upload / sign / replace gallery covers (reusing `preparePhoto` and the trip-photos bucket), Q1 fallback on create.
  - **Frontend:** new `CoverImage`, `cover-presets.ts`, rewritten `CoverPicker`, token `size.coverTile`; hero and side panel always show a cover (no-cover branches and the `Plane` placeholder removed); failed-cover snackbar via `coverUploadFailed`.
  - **Assets / tooling:** `assets/covers/`, `scripts/build-covers.ps1`.
  - **PR #18 review fixes:** an unreachable cover update (create and `updateDetails`) keeps the uploaded files instead of removing them; stale cover entries in this file corrected.
- 2026-10-18 — pill-nav-and-dialog:
  - **Routes:** home moved to `src/app/(drawer)/(tabs)/index.tsx`; new `(tabs)/_layout.tsx` (`Tabs` + `PillNav`) and the empty screens `expenses`, `places`, `plan`, `settings`; the Drawer's swipe is limited to `/`.
  - **Components:** `PillNav`, `ConfirmDialog`; `src/features/nav/` (`NAV_TABS`, `usePillClearance`, `usePillBottomOffset`, `EmptyScreen`).
  - **Home:** `CurrentTrip` and the home route take their bottom spacing from `usePillClearance()`.
  - **Wizard:** `LeaveGuard` uses `ConfirmDialog`; `confirm-discard.ts` and its test removed.
  - **Theme:** `elevation.floating`, `elevation.dialog`, `colors.nav.*`, `size.navPill`, `duration.dialog`.
  - **i18n:** `nav.*` (labels, `comingSoon`).
  - **Tests:** 86 suites, 1369 tests.
  - No schema, migration or dependency change.
- 2026-10-17 — trip-photos done:
  - **Schemas and logic:** `trip-photo.ts`; `src/lib/trip-photos.ts`; `SupabaseConfigSchema` allows http for local hosts.
  - **Server:** migrations `trip_photos` (table + RLS) and `trip_photos_storage` (bucket + policies), with SQL tests.
  - **Data:** `trip-rows` photo mapping; SQLite v3 `trip_photos_cache`; `photo-files.ts` (`preparePhoto`); `TripRepository.photos` / `addPhoto` / `deletePhoto`; the trip delete removes Storage files first; a fake Storage in `fake-supabase`.
  - **Hooks:** `useTripPhotos`, `usePhotoUploads`, `useDeleteTripPhoto`.
  - **UI:**
    - `features/trip-photos/` (`PhotoStrip`, `PhotoTile`, `pickTripPhotos`, `PhotoViewer`, `DeletePhotoSheet`);
    - route `trips/[tripId]/photos` (`fullScreenModal`);
    - `CurrentTrip` renders the strip under the hero;
    - `HeroIconButton` `disabled`.
  - **Theme and copy:** `size.photoTile`; `opacity.disabled` (also used by `IconButton`); i18n `tripPhotos.*`, `photoViewer.*`, `deletePhoto.*` and a new `deleteTrip.body`; the iOS photo permission text.
  - **Other:** `GLOSSARY.md` "Trip photo"; added `expo-image-manipulator` and `expo-file-system`.
- 2026-10-15 — trip-edit-menu done — `TripRepository.updateDetails` / `delete` (Supabase + in-memory), `LocalStore.forgetTrip`; hooks `useUpdateTripDetails`, `useDeleteTrip`; `TripMenuButton`, `TripMenuSheet`, `TripDetailsSheet`, `DeleteTripSheet`; `CurrentTrip` owns one sheet state and takes `onDeleted`; `Snackbar` in the home route; `TextButton` `destructive`; `BottomSheet` swipe from the header (D18) and `dismissible` (D22); theme `colors.snackbar.*`, `size.snackbarMinHeight` / `snackbarMaxWidth`, `duration`; i18n `tripMenu.*`, `tripDetails.*`, `deleteTrip.*`; SQL tests for the owner's update and delete; `tester` agent + `.mcp.json` (`mobile-mcp`). No schema, migration or dependency change.
- 2026-10-14 — wizard-keyboard done — Kacper's device checks passed; no architectural change.
- 2026-10-14 — wizard-keyboard steps 2–3 — `WizardScreen`: `automaticallyAdjustKeyboardInsets` removed, internal iOS-only `useScrollFocusedFieldIntoView`; `BottomSheet`: `KeyboardAvoidingView` `padding` on both platforms, `testID="bottom-sheet-keyboard"`; new tests in `WizardScreen.test.tsx` and `BottomSheet.test.tsx`. No schema, data or dependency change.
- 2026-10-13 — wizard-keyboard — `WizardScreen` root is a `KeyboardAvoidingView` (`padding`, header-height offset) and its `ScrollView` adjusts keyboard insets; new `src/features/trip-create/__tests__/WizardScreen.test.tsx`. No schema, data or dependency change.
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
