# Architecture
Last updated: 2026-10-06 · after task: trip-flight-tabs-name-cover (flights step tabs, trip name, cover photo, nearest-trip home screen)

## Overview
Traveling is a mobile app for the person who organizes a trip for a group of friends: trip setup, members, flights and layovers, AI day plans built from real places, offline expenses, and a plan-vs-reality budget summary. The product scope and rules are defined in `CLAUDE.md`; the visual system ("Sunline") is defined in `context/design-context.md`.

**Current state: create a trip + the nearest trip on the home screen, data in memory.** The organizer creates a trip in a 4-step wizard (`/trips/new`): flights (outbound / return shown one at a time) with layover segments and the number of companions → friends with interests (skipped when travelling alone) → budget per person → summary with the trip's name and an optional cover photo → save. The home screen (`/`) shows only the nearest trip: its cover photo fading into ink over half the screen, then flights, travellers and budget (data only). Development builds start with 3 example trips. Data shapes are Zod schemas (`src/schemas/`); trips are stored by an **in-memory repository** behind an interface and read/written with TanStack Query, so they are lost when the app restarts (Supabase, SQLite and auth do not exist yet). Feature plans live in `prompts/<feature-name>/plan.md`; domain terms in `GLOSSARY.md`.

## Folder tree
```
Travelo/
├── .agents/skills/             Real skill files (installed by the `skills` CLI)
├── .claude/
│   ├── agents/                 Subagent definitions (Explorer, Planner, Backend, Frontend, Verifier)
│   ├── skills/                 Symlinks to ../.agents/skills/* so Claude Code finds them
│   ├── launch.json             Preview config: Expo web on port 8081 (dev tooling only)
│   └── settings.json           Enables the official `expo` Claude plugin
├── .vscode/                    Editor settings + recommended Expo extension
├── assets/                     App icon, Android adaptive icon, splash, favicon, template images, `images/examples/` (example trip photos)
├── context/design-context.md   Design system — single source of truth for visuals
├── prompts/
│   ├── trips-empty-state/plan.md   Plan + progress log of the first feature
│   ├── trip-create-wizard/plan.md  Plan, decisions D1–D42, progress log, manual test steps
│   └── trip-flight-tabs-name-cover/plan.md  Flights tabs, trip name, cover photo, home screen: D1–D10, progress log
├── scripts/build-airports.mjs  Dev-only generator of src/data/airports.json (downloads 3 public sources)
├── src/
│   ├── app/                    Expo Router routes ONLY (every file here becomes a screen)
│   │   ├── _layout.tsx         Root Stack inside AppProviders: fonts, splash screen, i18n init
│   │   ├── index.tsx           `/` — home screen (loading / error / empty / nearest trip)
│   │   └── trips/new/          Create-trip wizard: nested Stack (`_layout`) + steps index (flights), friends, budget, summary
│   ├── components/             Shared UI components (+ `__tests__/`)
│   ├── data/                   airports.json (+ typed export), trip repository, example trips and covers (+ `__tests__/`)
│   ├── features/home/          `NearestTrip` — the home screen's trip view
│   ├── features/trip-create/   Wizard state and pieces: draft, steps, context, frame, cards, errors (+ `__tests__/`)
│   ├── hooks/                  TanStack Query hooks (`useNearestTrip`, `useCreateTrip`)
│   ├── i18n/                   i18next setup and pl/en dictionaries (+ `__tests__/`)
│   ├── lib/                    Pure logic: time zones, layovers, dates, money, airport search (+ `__tests__/`)
│   ├── providers/              AppProviders: QueryClient + trip repository context
│   ├── schemas/                Zod schemas — single source of truth (+ `__tests__/`)
│   ├── test/fixtures.ts        Shared test input (wizard → trip)
│   ├── theme/                  Design tokens, light/dark themes, `useTheme` (+ `__tests__/`)
│   └── __tests__/app/          Route tests, mirroring `src/app/` (kept outside `app/`)
├── .npmrc                      pnpm: `node-linker=hoisted`
├── AGENTS.md                   Expo-specific rules for coding agents
├── Architecture.md             This file
├── CLAUDE.md                   Project rules
├── GLOSSARY.md                 Domain terms (organizer, friend, traveller, member, layover, …)
├── app.json                    Expo config (plugins: expo-router, expo-splash-screen, expo-sqlite, expo-localization)
├── eslint.config.js            ESLint flat config (eslint-config-expo)
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
| `supabase/migrations/` | SQL migrations | none |
| `supabase/functions/` | Edge Functions | none |

## Modules
| Module | Path | Responsibility | Depends on |
|---|---|---|---|
| Routes | `src/app/` | Root Stack layout, home screen, create-trip wizard screens | `expo-router`, features, components, hooks, theme, i18n |
| Schemas | `src/schemas/` | Zod schemas and inferred types: common (money, codes, dates), interests, airport, flight segment, member, trip / trip summary / trip overview, wizard inputs | `zod`, `lib/time` |
| Data | `src/data/` | `AIRPORTS` (bundled list), `TripRepository` interface, `buildTrip`, in-memory repository (optional starting trips), example trips (`exampleTrips`, `startingTrips`) and their bundled photos (`exampleCovers`) | schemas, lib, `expo-crypto`, `expo-asset` |
| Lib | `src/lib/` | Pure functions: airport-local time ↔ instants and pickers (`isExistingLocalTime`: round-trip check for DST gaps; `isoToLocal`: stored instant → airport wall clock), date display formatters, layovers (`layoverMinutes` from wall clocks — none for an impossible or skipped time; `savedLayoverMinutes` from stored instants), trip dates/days, default trip name (`defaultTripName`), money parse/format (ISO 4217 digits), airport search, text folding | schemas, data (airports) |
| Hooks | `src/hooks/` | `useNearestTrip` (query `['trips', 'nearest']`), `useCreateTrip` (mutation, invalidates `['trips']`) | `@tanstack/react-query`, providers |
| Providers | `src/providers/` | `AppProviders`: `QueryClientProvider` + trip repository context (`useTripRepository`); the default repository starts with the example trips in development builds only | data, `@tanstack/react-query` |
| Home feature | `src/features/home/` | `NearestTrip`: hero + "Loty" / "Podróżni" / "Budżet" cards + pinned "Utwórz podróż" | components, lib, theme, `expo-router`, `expo-status-bar` |
| Create-trip feature | `src/features/trip-create/` | Draft type and helpers, step routing, draft context (dirty/complete), wizard frame, segment/friend cards, field errors, leave confirmation | schemas, lib, components |
| Theme | `src/theme/` | Primitive tokens (`tokens.ts`, incl. the `gradient` group), type scale (`typography.ts`), semantic `lightTheme` / `darkTheme` and `Theme` type (`theme.ts`), `useTheme()` hook and `DarkThemeScope` | `react-native` (`useColorScheme`) |
| i18n | `src/i18n/` | One i18next instance with `pl` / `en` resources; language picked from the device | `i18next`, `react-i18next`, `expo-localization` |
| Components | `src/components/` | Buttons, fields, chips, cards, step indicator, stepper, segmented control, cover picker, trip hero (see Frontend) | theme, i18n, lib, `lucide-react-native`, `react-native-svg`, `@expo/ui`, `expo-image`, `expo-image-picker` |

## Data model
Zod schemas in `src/schemas/` (constants `XSchema`, types `X = z.infer<typeof XSchema>`):
- `common.ts` — `CurrencyCodeSchema`, `IataCodeSchema`, `IanaTimezoneSchema`, `IsoDateTimeSchema` (with offset), `IsoDateSchema`, `LocalDateTimeSchema` (airport-local wall clock from forms; must be a real calendar date — `isLocalDateTime`), `MoneySchema` (integer minor units + ISO 4217).
- `interests.ts` — `InterestTagSchema` (17 tags), `InterestGroupSchema` (6 groups), `INTEREST_GROUPS`.
- `airport.ts` — `AirportSchema` (iata, name, city, countryCode, IANA timezone, currency, large).
- `flight.ts` — `FlightSegmentSchema` (arrival after departure as instants).
- `member.ts` — `TripMemberSchema` (friends: `userId: null`, role `viewer`; `budgetLevel`/`pace` optional).
- `trip.ts` — `TripSchema` (`name` 1–60 chars, optional `coverImageUri`, `budgetPerPerson`, end ≥ start, budget in base currency), `TripSummarySchema` (+ `travellerCount`), `TripOverviewSchema` (`{ trip: TripSummary, members, segments }` — what the home screen shows).
- `create-trip-form.ts` — wizard input: `SegmentInputSchema` (each time must exist in its airport's zone — a time skipped when clocks go forward gives `validation.timeDoesNotExist`; arrival vs departure compared only when both exist), `FlightsStepInputSchema` (segment chain, return after outbound, first departure not before today at the departure airport, 0–19 companions), `FriendInputSchema`, `FriendsStepInputSchema`, `BudgetStepInputSchema`, `TripDetailsInputSchema` (name trimmed, required, ≤ 60; optional cover URI), `CreateTripInputSchema` (flights, friends, budget, details). Messages are i18n keys (`validation.*`).

No server tables and no SQLite tables exist yet. The airport list is a static bundled file, validated row by row in its test (not parsed at runtime).

## Data flow
- Server-first (in memory for now): screens use `useNearestTrip` / `useCreateTrip` → `TripRepository` from `AppProviders`. The in-memory implementation parses input with `CreateTripInputSchema`, builds `Trip` + `TripMember[]` + `FlightSegment[]` with `buildTrip` (ids from `expo-crypto`, times converted to ISO with offset, name and cover from `details`), parses each with its schema, and `nearest()` returns the soonest trip (ties by `createdAt`) as a `TripOverview` parsed with its schema, or `null`. Data is lost on restart.
- Example trips: in development builds (`__DEV__`, not under Jest) the repository starts with `exampleTrips(today in Warsaw, exampleCovers())` — Kraków → Lisbon (photo), Warsaw → Beijing via Dubai (photo), Warsaw → Rome (no photo); the photos are bundled files resolved to URIs with `expo-asset`.
- Create-trip wizard: the draft lives in `TripDraftProvider` (wizard layout) as airport-local strings and typed text; each step validates its slice with its Zod schema on "Next"; the summary validates the name with `TripDetailsInputSchema` and saves `toCreateTripInput(draft)`. The name follows the flights (`defaultTripName`) until the organizer types one; the cover photo is the URI returned by the gallery picker. Leaving with unsaved input asks via the system dialog (`usePreventRemove`); after saving it does not.
- Offline expenses: not implemented.
- AI day plan: not implemented.

## Backend
- Tables & RLS policies: none. No Supabase project is configured in the repo.
- Edge Functions: none.
- Trip storage: `TripRepository` interface (`src/data/trip-repository.ts`) with an in-memory implementation (`createInMemoryTripRepository`); `ownerId` is the constant `LOCAL_OWNER_ID` until auth exists.

## Frontend
### Screens & routes
| Route | File | What it shows |
|---|---|---|
| (root) | `src/app/_layout.tsx` | Stack navigator. Keeps the splash screen until DM Sans (400/500/600/700) and Fraunces (500/600/700) are loaded; on a font error it renders with system fonts. Imports `@/i18n`. Wraps the Stack in `AppProviders`. Header hidden on `index` and on `trips/new` (the wizard's nested stack draws its own). |
| `/` | `src/app/index.tsx` | Home screen, by query state. **Trip** (always dark, inside `DarkThemeScope`): `NearestTrip` — `TripHero` (50 % of the window, cover photo fading into ink or plain ink, name in Display XL, dates + days), then scrollable cards on `surface.secondary`: "Loty" (outbound / return lines in airport-local time, layover labels from stored instants), "Podróżni · N" (Ty + names), "Budżet" (per person, total, ~per person per day); light status bar while focused; pinned "Utwórz podróż" → `/trips/new`. **Loading**: full-bleed `TripHeroSkeleton` (one accessible "Wczytywanie podróży" element) + pinned button. **Error** (`CircleX`, "Nie udało się wczytać podróży.", announced, "Spróbuj ponownie" refetches) and **empty** (suitcase + 2 lines) keep the title "Twoje podróże". Other trips are not shown. Safe-area aware; side padding 20dp, 16dp below 360dp; content and pinned button max width 720dp. |
| `/trips/new` (layout) | `src/app/trips/new/_layout.tsx` | Nested Stack inside `TripDraftProvider`; header "Nowa podróż" (theme tokens); step 1 gets a `HeaderBackButton` "Twoje podróże", later steps the native back "Wstecz". `LeaveGuard` asks "Odrzucić wpisane dane?" (native `Alert`, `confirm` on web) when the draft changed and the trip is not saved. |
| `/trips/new` | `src/app/trips/new/index.tsx` | Step 1 — flights: disabled "Wyślij bilet · wkrótce", a "Lot tam" / "Powrót" switch (`SegmentedControl`, outbound first) showing one direction's section of segment cards (airport search, date/time pickers, optional flight number), amber layover labels between segments, "Dodaj przesiadkę"/"Usuń", return suggested as the outbound reversed, companions stepper (0–19) on both tabs. "Dalej" validates (`FlightsStepInputSchema`), switches to the tab with the first error (outbound first), scrolls to that card and announces. |
| `/trips/new/friends` | `src/app/trips/new/friends.tsx` | Step 2 (skipped at 0 companions): one card per friend with name and 17 interest chips in 6 groups; validates names. |
| `/trips/new/budget` | `src/app/trips/new/budget.tsx` | Step 3: amount per person (whole trip, without flights) + currency segmented control (destination currency, PLN, EUR, USD); group total and ~per person per day; solo wording. |
| `/trips/new/summary` | `src/app/trips/new/summary.tsx` | Step 4: first a "Nazwa i zdjęcie" card (name field pre-filled "<from city> → <destination city>", max 60, empty → "Podaj nazwę podróży" on save; `CoverPicker`), then trip / travellers / budget cards with "Zmień" back to each step; "Utwórz podróż" saves (loading, error announced), then returns to `/`. Redirects to step 1 when the draft is incomplete (the name is not part of that check). |

### Shared components / hooks
- `Field` (label + error frame, input border/box/text styles), `TextField`, `AirportField` (search over the bundled list), `DateTimeField` (`.tsx` iOS wheel in UTC, `.android.tsx` date→time dialogs, `.web.tsx` browser input; shared `DateTimeFieldBase`), `AmountField` (§10.5), `TextButton` (secondary / ghost), `IconButton`, `Stepper` (adjustable for screen readers), `SegmentedControl`, `Chip` (checkbox), `Card`, `StepIndicator` ("Krok 2 z 4" + bar), `LayoverLabel`, `CoverPicker` (optional cover photo from the gallery via `expo-image-picker`, crop 16:9 on Android, preview + change / remove, error message), `TripHero` + `TripHeroSkeleton`.
- Wizard pieces in `src/features/trip-create/`: `WizardScreen` (step indicator, scroll, pinned action with optional error) + `useGoToNextStep`, `SegmentCard`, `FriendCard`, `TripDraftProvider` / `useTripDraft`, `draft.ts` (types incl. `name: string | null` and `coverImageUri?`, `withCompanionCount`, `addLayover`, `withOutbound`, `budgetCurrency*`, `tripName`, `toCreateTripInput`), `steps.ts`, `field-errors.ts`, `confirm-discard.ts`.
- `useNearestTrip`, `useCreateTrip` (`src/hooks/useTrips.ts`); `useTripRepository` (`src/providers/AppProviders.tsx`).
- `PrimaryButton` (`src/components/PrimaryButton.tsx`) — design-context §10.1: min height 52dp (grows with Dynamic Type), 16dp horizontal padding, 12dp radius; states default / pressed / focused (2dp brand ring, 4dp offset) / disabled / loading (spinner, `busy`); optional leading lucide icon (20dp, stroke 2, hidden from screen readers).
- `TripsEmptyIllustration` (`src/components/TripsEmptyIllustration.tsx`) — 160×160 SVG suitcase with a luggage tag in theme colours (brand body, `text.primary` outline, `category.transport` tag), wrapped in a `View` with `aria-hidden` so it is hidden from screen readers on iOS, Android and web.
- `useTheme()` (`src/theme/useTheme.ts`) — returns `darkTheme` when the system colour scheme is `dark`, otherwise `lightTheme`; inside `DarkThemeScope` always `darkTheme`.

### Theme & i18n
- **Tokens** live in `src/theme/tokens.ts` (palette, dark roles, semantic/budget/category colours, spacing, radius incl. `segmented`, size, breakpoints, elevation, `gradient.heroFade`) and `src/theme/typography.ts` (type scale; font weight is encoded in the `@expo-google-fonts` family name). Components consume semantic tokens from `theme.ts` (`colors.background`, `colors.text.*`, `colors.action.*` incl. `link`, `colors.input.border`, `colors.hero.*` — ink background and light text, same in both themes, `elevation.card` — shadow in light, none in dark, `gradient`), never raw palette values.
- **i18n**: `src/i18n/index.ts` creates its own i18next instance (`createInstance()` + `initReactI18next`, synchronous init). Language = the device's first preferred locale if it is `pl` or `en`, otherwise `en`. It is read once at startup. Dictionaries: `src/i18n/locales/pl.json`, `en.json` (same keys, checked by a test).

## Testing
- Jest (`jest-expo` preset) + React Native Testing Library 14 (async `render` / `fireEvent`); route tests use `renderRouter` from `expo-router/testing-library` with the real root layout.
- Test files never live under `src/app/` (Expo Router would turn them into routes); route tests sit in `src/__tests__/app/`.
- `package.json` → `jest.moduleNameMapper` maps `lucide-react-native` to its CommonJS build, because its React Native entry is `.mjs`, which jest-expo does not transform.
- `useColorScheme` / `useWindowDimensions` are mocked at `react-native/Libraries/Utilities/*` (RN imports them internally, so spying on `Appearance` / `Dimensions` does not work).
- Jest mocks RN `View` as a pass-through, so `aria-*` → native accessibility prop conversion is not observable in tests.
- Pickers (`@expo/ui`, `expo-image-picker`), `expo-crypto` and (in the home tests) `expo-status-bar` are mocked; route tests use stand-in screens for steps they don't test. Example trips are off under Jest; image `require`s are stubs carrying their path. aria-hidden elements need `includeHiddenElements: true`. Date/time tests switch `process.env.TZ` to check device-time-zone independence.
- Current suite: 46 suites, 490 tests (also green with `TZ=Europe/Warsaw` and `TZ=America/Los_Angeles`).

## Tooling
| Area | Setup |
|---|---|
| Runtime | Expo SDK 57, React Native 0.86, React 19.2, New Architecture, React Compiler and typed routes enabled in `app.json` |
| Language | TypeScript 6 strict; `types: ["jest"]` (TS 6 no longer includes `@types/*` automatically); aliases `@/*` → `src/*`, `@/assets/*` → `assets/*` |
| Package manager | **pnpm** (`pnpm-lock.yaml`, `.npmrc` with `node-linker=hoisted`). Add dependencies with `npx expo install` (it detects pnpm); where it cannot reach the Expo API, `pnpm add <pkg>@<version from node_modules/expo/bundledNativeModules.json>`. |
| Lint | `pnpm lint` (`expo lint`) |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) |
| Tests | `pnpm test` (Jest) |
| Web preview | `.claude/launch.json` → `expo-web` (Expo web on :8081) |
| Native projects | `ios/` and `android/` are generated (Continuous Native Generation) and git-ignored |

### Dependencies in use
`expo-router`, `expo-font`, `expo-splash-screen`, `expo-localization`, `i18next`, `react-i18next`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/fraunces`, `lucide-react-native`, `react-native-svg`, `react-native-safe-area-context`, `zod`, `@tanstack/react-query`, `@expo/ui` (date/time pickers), `expo-crypto` (UUIDs), `expo-image-picker` (cover photo from the gallery), `expo-image` (cover preview, trip hero), `expo-asset` (example photos → URIs), `expo-status-bar` (light bar over the hero).

### Dependencies installed for planned features (not used by any code yet)
| Package | Intended use |
|---|---|
| `expo-sqlite` | Offline expenses and sync outbox |
| `@supabase/supabase-js` | Supabase client |

## Claude Code configuration
### Subagents (`.claude/agents/`)
| Agent | Model | Tools | Role |
|---|---|---|---|
| `explorer` | haiku | Read, Grep, Glob | Read-only scout: finds code, schemas and patterns |
| `planner` | opus | Read, Grep, Glob | Read-only: drafts a plan in the plan template format |
| `backend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one backend step test-first (schemas, migrations, RLS, Edge Functions) |
| `frontend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one frontend step test-first, following the design context |
| `verifier` | opus | Read, Grep, Glob, Bash | Independent PASS/FAIL review of a finished step; never fixes |

### Skills (`.claude/skills/`)
| Skill | Source | Purpose |
|---|---|---|
| `domain-modeling` | mattpocock/skills | Sharpen domain terms; write `GLOSSARY.md` and ADRs |
| `grill-me` | mattpocock/skills | Interview the user to sharpen a plan (user-invoked only) |
| `improve-codebase-architecture` | mattpocock/skills | Find refactoring opportunities and report them (user-invoked only) |
| `frontend-design` | anthropics/skills | Guidance for building distinctive UI |
| `ui-taste` | uizze.sh | UI polish and review playbooks for web and iOS |
| `find-skills` | vercel-labs/skills | Discover and install further skills |

## External services
| Service | Used for | Called from | Secrets |
|---|---|---|---|
| OurAirports, mwgg/Airports, datasets/country-codes | Airport list (generated once at dev time, bundled) | `scripts/build-airports.mjs` only | — |

## Key decisions
- 2026-10-06 — Home screen shows only the nearest trip, CheckMyTrip-style: cover photo over ~50 % of the screen fading into ink (`#17211B`), data only; always dark (`DarkThemeScope`); the trips list was removed (`prompts/trip-flight-tabs-name-cover/plan.md` D4, D6, D7, A4, A7).
- 2026-10-06 — Trip name is the organizer's, default "<from city> → <destination city>", set on the summary step; optional cover photo from the gallery via `expo-image-picker`, stored as a device-local URI while trips are in memory (D1–D3). Flights step shows one direction at a time (D5).
- 2026-10-06 — Gradients only as theme tokens (§20 rule 20): `gradient.heroFade`; hero roles `colors.hero.*`; the hero title uses Display XL (§4.2 "Trip hero").
- 2026-10-06 — Example trips in development builds only, photos bundled and resolved with `expo-asset` so web works too (D8–D10).
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
- Trips are stored in memory only (D1) and disappear on restart; no Supabase, auth or SQLite yet. The organizer is not a `TripMember` yet; `ownerId` is `LOCAL_OWNER_ID`.
- Airport list (3,153 airports, ~470 KB): city names come from merged sources with hand overrides for large airports; some small airports keep odd names, 91 airports are dropped (no time zone / city). City names are in English ("Warsaw").
- Pickers are mocked in tests; device checks are pending (see the manual steps in `prompts/trip-create-wizard/plan.md`). On web, browser back/forward may bypass the leave confirmation and an offline browser would pause the nearest-trip query (skeleton).
- A trip whose return local date is before the outbound arrival date (open-jaw across the date line) breaks the per-day figure and is rejected on save.
- Only the nearest trip is shown; other trips cannot be seen until an "all trips" screen exists (A6, A7). The home screen's trip view is data only (no actions on the trip).
- Cover photos are device-local URIs from the picker's cache; the OS may clear them. Must be uploaded (e.g. Supabase Storage) once trips are stored on the server. On iOS the picker crops square (Expo ignores `aspect` there); the preview and hero show it with `cover` fit.
- City names in default trip names come from the airport list (mostly English, e.g. "Warsaw → Barcelona"). A default name can exceed 60 characters (PKY → NLI is 61); the summary then shows it and asks to shorten it ("Nazwa może mieć do 60 znaków") — the redirect guard ignores the name.
- Release builds still bundle the ~280 KB example photos (Metro bundles static `require`s even though only development builds use them).
- `src/data/example-covers.ts` uses a relative `require('../../assets/…')`, because tsconfig and Jest map `@/` only to `src/`.
- Manual device checks pending (`prompts/trip-flight-tabs-name-cover/plan.md`): long name / largest Dynamic Type over a bright photo, status bar during the push into the wizard, the light → ink switch when the home screen finishes loading, tablet layout.
- `src/hooks/useTrips.ts` now exports `useNearestTrip` and `useCreateTrip`; the file name is historical.
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
- 2026-10-06 — trip-flight-tabs-name-cover — schemas: trip name ≤ 60, optional `coverImageUri`, `TripDetailsInputSchema`, `TripOverviewSchema`; `defaultTripName`, `isoToLocal`, `savedLayoverMinutes`; repository `nearest()` + starting trips (`list()` removed); example trips + covers; `useNearestTrip` (replaces `useTrips`); flights step outbound/return switch; summary "Nazwa i zdjęcie" card with `CoverPicker`; home screen `NearestTrip` + `TripHero` / `TripHeroSkeleton`; theme `colors.hero`, `gradient`, `DarkThemeScope`; removed `TripCard`, `TripCardSkeleton`; added `expo-image-picker`, `expo-asset` (and now use `expo-image`, `expo-status-bar`); `GLOSSARY.md` (trip name, cover photo, nearest trip); CLAUDE.md data structures (`Trip.name`, `coverImageUri?`).
- 2026-10-06 — trip-create-wizard follow-up (PR #2 review) — `isLocalDateTime` in `src/schemas/common.ts` (calendar check, shared by `LocalDateTimeSchema`, the wizard and layovers); `isExistingLocalTime` in `src/lib/time.ts`; `SegmentInputSchema` rejects DST-gap times (`validation.timeDoesNotExist`, pl/en); `layoverMinutes` ignores impossible / skipped times. No new modules or dependencies.
- 2026-10-04 — trip-create-wizard — added Zod schemas (`src/schemas/`), bundled airport list + generator script, pure logic in `src/lib/`, in-memory trip repository with TanStack Query hooks and `AppProviders`, the 4-step create-trip wizard (`src/app/trips/new/`, `src/features/trip-create/`), new shared components, Trips screen states and list, `GLOSSARY.md`; added `expo-crypto`; CLAUDE.md data structures updated (`budgetPerPerson`, optional `pace`/`budgetLevel`, `Airport`).
- 2026-10-03 — Initial workspace audit and dependency setup — first version of this document; added runtime dependencies, ESLint, Jest and the `typecheck`/`test` scripts.
- 2026-10-03 — trips-empty-state — switched to pnpm; added theme tokens + `useTheme`, i18n (pl/en), font loading in the root layout, `PrimaryButton`, `TripsEmptyIllustration`, the Trips empty screen at `/` and the placeholder `/trips/new`; first test suite (40 tests); route tests live in `src/__tests__/app/`.
