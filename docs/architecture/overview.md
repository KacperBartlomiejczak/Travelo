# Overview

How the app is built right now. Product scope: [`context/app-context.md`](../../context/app-context.md); visuals: [`context/design-context.md`](../../context/design-context.md). Update this file when a task changes the architecture.

## Stack
- **App:** React Native + Expo (expo-router, dev builds via EAS), TypeScript strict.
- **Data fetching:** TanStack Query.
- **Local storage:** SQLite on the device (`expo-sqlite`) for offline expenses and the sync outbox.
- **Backend:** Supabase — Postgres, Auth, Row Level Security, Edge Functions.
- **Validation & types:** Zod.
- **External data:** Google Places API (places), Routes API (travel times), an FX rates API.
- **AI:** Google Gemini (Gemini API, key from Google AI Studio), called **only** from Edge Functions, with structured (JSON-schema) output.

Traveling is a mobile app for the person who organizes a trip for a group of friends: trip setup, members, flights and layovers, AI day plans built from real places, offline expenses, and a plan-vs-reality budget summary. The product scope is defined in `context/app-context.md`, the rules in `CLAUDE.md`; the visual system ("Sunline") is defined in `context/design-context.md`.

**Sign-in and profile (auth-onboarding):**
- **Welcome.** The app needs an account; there are no anonymous sessions. A new user sees the welcome screen ("Witaj w Travelo", always dark, a full-screen dimmed cover photo; title, sentence and button slide in one after another).
- **Sign-in.** "Zaloguj się" opens a bottom sheet with Google, Discord or e-mail.
  - Google and Discord open the system browser (PKCE).
  - E-mail takes an address, then a 6-digit code from the e-mail.
- **Profile setup**, on the first sign-in only:
  - a unique nick, at least one interest, and an optional photo from the gallery; "Zapisz i zaczynamy" stays disabled until the nick is valid and an interest is picked;
  - after a Google or Discord sign-in the nick and the photo are pre-filled from that account (suggestions the user can change);
  - the server gives each profile a 6-character friend code, which is not shown yet.
- **A returning user** goes straight to the app, also offline: the profile has a read-only copy in SQLite.
- **Sign-out.** When the app is signed out, everything the previous user left on the phone is erased before the welcome screen shows. The user signs out in Settings (the gear on „Profil” → „Wyloguj się” → a confirmation that also warns when budget changes were not sent yet); the button is disabled offline. The server ending the session, or a one-time background check at startup that finds the account deleted, signs out too.

**Current state: trips in Supabase, a side panel with all trips, the trip budget editable offline.** The organizer creates a trip in a 4-step wizard (`/trips/new`): flights (outbound / return shown one at a time) with layover segments and the number of companions → friends with interests (skipped when travelling alone) → daily budget per person („Razem / Osobno”) → summary with the trip's name and a **required cover photo** (one of five bundled city photos, Auckland preselected, or a photo from the gallery) → save. Saving writes the trip, its friends (with interests) and its flight segments to **Supabase** in one `create_trip` call (needs internet). The new trip becomes the current trip. The home screen (`/`) shows the **current trip** — the one chosen in the side panel, else the default trip (the soonest upcoming or ongoing, else the most recently ended): its cover photo fading over half the screen into the theme's background (paper in light mode, near-black in dark mode), then flights, travellers and budget — the whole trip view, the side panel and the pill follow the phone's light / dark setting. A menu button (top-left, in every state) or a swipe from the left edge opens the **side panel** with all trips in "Nadchodzące" / "Minione"; tapping one makes it the current trip (remembered on the phone), "Nowa podróż" starts the wizard. The daily budgets can be changed from the Budget card ("Zmień" → bottom sheet) **with or without internet**: the change is saved in **SQLite** on the phone and synced to Supabase later (last write wins), with a "Czeka na wysłanie" / "Nie udało się wysłać" indicator. A ⋮ button (top-right, over the photo) opens the trip's menu: „Nazwa i zdjęcie” (rename, change the cover), „Zmień budżet” (the same budget sheet) and „Usuń podróż” (confirmation, then the home screen shows the default trip or the empty state with a „Podróż usunięta.” snackbar). Rename and delete go straight to Supabase and are disabled offline. A cover from the gallery is shrunk and re-encoded on the phone and uploaded to **Supabase Storage**, so other phones and a reinstall show it; if that upload fails while creating a trip, the trip keeps the default cover and the home screen says so in a snackbar. Right under the hero sits the trip's **photo strip**.
- A „+” tile opens the gallery (up to 20 photos at a time).
- Each photo is downscaled and re-encoded without EXIF (so without GPS), then uploaded with a thumbnail to a private **Supabase Storage** bucket, one at a time. It shows at once, with its sending or failed state.
- Tapping a photo opens a full-screen viewer: swipe, a counter, and delete with a confirmation.
- Adding and deleting photos needs internet. The photo list is copied to SQLite, so photos already seen still show offline.
- Deleting a trip deletes its photos from Storage too.

**Pill navigation:** the home screen is the first of four screens in a `(tabs)` group inside the drawer, switched by a floating white pill at the bottom: the selected tab is a coral capsule with icon + label that slides to the tapped tab, the others are round icon buttons — „Podróż” (the current trip), „Wydatki”, „Plan”, „Profil” (`CircleUser` icon). „Plan” is an empty placeholder (a title and „Ten ekran pojawi się wkrótce.”). „Profil” is the user's profile: the title „Profil” with a gear to Settings, the round photo (a pulsing skeleton until it is shown; a person placeholder without a photo) and the nick, then a „Twoje podróże” card with five numbers of the past trips — trips, countries, days travelled, flights, km flown — counted on the phone from the trip list, so they show offline too. The pill overlays the screens, so the home screen leaves room for it (`usePillClearance`). The side panel opens only on „Podróż”. The pill is not shown in the wizard or the photo viewer.

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
├── assets/                     App icon, Android adaptive icon, splash (`images/splash-icon.png` + `splash-icon-dark.png`, from `design/logo/kit/expo/`), favicon; `animations/splash.json` = the Lottie logo animation (exported from LottieFiles Creator, splash-animation); `covers/` = the bundled preset covers (`<id>.jpg` ≤ 2048 px + `<id>_thumb.jpg` ≤ 480 px, JPEG q80, made by `scripts/build-covers.ps1`); `template-images/` = Kacper's originals (not bundled)
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
│   ├── auth-onboarding/plan.md     Sign-in (Google, Discord, e-mail code), profile setup, gate: D1–D24, P1–P6, R1–R16, progress log, device runs
│   ├── theme-split-and-profile-prefill/plan.md  Light / dark split, welcome polish, sheet scrim, chips, profile button, Google / Discord pre-fill: D1–D14, P1–P8, progress log, device runs
│   └── expenses/plan.md            Expenses screen (done 2026-11-02; the pill nav decisions moved to pill-nav-and-dialog)
├── scripts/build-airports.mjs  Dev-only generator of src/data/airports.json (downloads 3 public sources)
├── scripts/build-covers.ps1    One-off Windows tool (System.Drawing): `assets/template-images/` → `assets/covers/` (largest source per id, never upscales, no EXIF)
├── scripts/test-db.sh          `pnpm test:db`: runs supabase/tests/*.sql with psql against $DB_URL
├── supabase/                   Supabase CLI project: config.toml, migrations/ (SQL), tests/ (plain-SQL RLS tests), templates/ (`magic_link.html`, the e-mail with the 6-digit code)
├── src/
│   ├── app/                    Expo Router routes ONLY (every file here becomes a screen)
│   │   ├── _layout.tsx         Root Stack inside AppProviders: fonts, splash screen, i18n init, the sign-in gate (`Stack.Protected`)
│   │   ├── (auth)/             Route group for signed-out users: `_layout` (Stack + e-mail sign-in state), `welcome`, `email`, `code`
│   │   ├── onboarding.tsx      Profile setup (signed in, no profile yet)
│   │   ├── settings.tsx        Settings (signed in, above the drawer): sign-out
│   │   ├── auth/callback.tsx   Landing point of the OAuth redirect; only redirects by state
│   │   ├── (drawer)/           Route group (no URL segment): `_layout` = expo-router Drawer with the side panel
│   │   │   └── (tabs)/         Route group: `_layout` = `Tabs` with the floating pill; `index` = `/` home screen (loading / error / empty / current trip); `expenses` = expenses screen (`src/features/expenses/`); `plan` = empty placeholder screen; `profile` = the profile screen
│   │   ├── trips/new/          Create-trip wizard: nested Stack (`_layout`) + steps index (flights), friends, budget, summary
│   │   └── trips/[tripId]/photos.tsx  Full-screen photo viewer (`fullScreenModal`)
│   ├── components/             Shared UI components (+ `__tests__/`)
│   ├── data/                   airports.json (+ typed export), trip and profile repositories (in-memory, Supabase), rows ↔ entities, generated DB types, auth and session source, SQLite store, budget sync, photo files (+ `__tests__/`)
│   ├── features/auth/          Welcome, sign-in sheet, brand buttons, e-mail and code screens, profile setup, gate view (+ `__tests__/`)
│   ├── features/discover/      `DiscoverScreen` — Discover places (city, interests, result cards) (+ `__tests__/`)
│   ├── features/drawer/        `TripsDrawer` — the side panel's content
│   ├── features/nav/           `NAV_TABS` (the four tabs), `usePillClearance` / `usePillBottomOffset`, `EmptyScreen` (+ `__tests__/`)
│   ├── features/home/          `CurrentTrip` — the home screen's trip view; `HeroMenuButton`, `TripMenuButton`; sheets `TripMenuSheet`, `TripDetailsSheet`, `BudgetSheet`, `DeleteTripSheet` (+ `__tests__/`)
│   ├── features/profile/       `ProfileScreen` (photo, nick, stats), `TravelStatsCard`, `SettingsScreen`, `EditProfileScreen`, `AvatarViewer`, `DeleteAccountDialog` (+ `__tests__/`)
│   ├── features/trip-create/   Wizard state and pieces: draft, steps, context, frame, cards, errors (+ `__tests__/`)
│   ├── features/trip-photos/   `PhotoStrip`, `PhotoTile`, `pickTripPhotos`, `PhotoViewer`, `DeletePhotoSheet` (+ `__tests__/`)
│   ├── hooks/                  TanStack Query hooks (`useTripList`, `useCurrentTrip`, `useSelectTrip`, `useCreateTrip`, `useSetTripBudget`, `useUpdateTripDetails`, `useDeleteTrip`; `useTripPhotos`, `usePhotoUploads`, `useDeleteTripPhoto`; `useMyProfile`, `useCreateProfile`, `useUpdateProfile`, `useChangeAvatar`, `useRemoveAvatar`; `usePreferences`, `usePickAvatar`, `useDeleteAccount`; `useSignIn`, `useSendEmailCode`, `useVerifyEmailCode`; `useSignOut`; `useReduceMotion`)
│   ├── i18n/                   i18next setup and pl/en dictionaries (+ `__tests__/`)
│   ├── lib/                    Pure logic: time zones, layovers, dates, money, airport search, trip sections, travel stats, trip photos, cover presets, avatar size and path (+ `__tests__/`)
│   ├── providers/              AppProviders: QueryClient + trip and profile repository contexts + budget sync (BudgetSync) + session (Session)
│   ├── schemas/                Zod schemas — single source of truth (+ `__tests__/`)
│   ├── test/                   Test helpers: fixtures (wizard → trip), node-sqlite (real SQLite for tests), reordering-db (random statement delays), fake-supabase, fake-session-source, fake-profile-repository, settle-gate, user-epoch, auth-email-flow, mock-network, drawer-status
│   ├── theme/                  Design tokens, light/dark themes, `useTheme` (+ `__tests__/`)
│   └── __tests__/app/          Route tests, mirroring `src/app/` (kept outside `app/`)
├── .mcp.json                   MCP server `mobile-mcp` (drives a phone / emulator for the `tester` agent)
├── .npmrc                      pnpm: `node-linker=hoisted`
├── AGENTS.md                   Thin pointer to CLAUDE.md (Codex entry)
├── CLAUDE.md                   Main project rules + router to docs/
├── docs/                       architecture/ (how the app works), agents/ (harness), development/ (how we work)
├── GLOSSARY.md                 Domain terms (organizer, friend, traveller, member, layover, …)
├── app.json                    Expo config (plugins: expo-router, expo-splash-screen — paper `#F8F4EC` / dark `#171716` with the logo symbol, `imageWidth` 58 —, expo-sqlite, expo-localization)
├── eslint.config.js            ESLint flat config (eslint-config-expo)
├── jest.setup.ts               Jest: app trip / profile repositories → in-memory, app session source → a signed-in fake, `app-auth` mocked, a strict wait for the gate in `renderRouter`, expo-network → test mock (online), gesture-handler / worklets / Reanimated test mocks, `expo-image-manipulator` / `expo-file-system` mocks, `lottie-react-native` mock (host View `splash-lottie`, props passed through)
├── package.json                Dependencies, scripts, Jest config
├── pnpm-lock.yaml              pnpm lockfile
└── tsconfig.json               TypeScript strict, `@/*` → `src/*`, `types: ["jest", "node"]`, `allowImportingTsExtensions` (the Edge Function imports `src/schemas/account.ts` by path); `supabase/functions/**/index.ts` (Deno entry points) excluded
```

## Planned monorepo layout (not adopted yet)
The original plan was a monorepo (`apps/mobile/`, `packages/schemas/`, `supabase/`). The Expo app still sits at the repository root.

| Planned path | Planned purpose | Current equivalent |
|---|---|---|
| `apps/mobile/` | Expo app | repository root (`src/`) |
| `packages/schemas/` | Zod schemas | `src/schemas/` |
| `supabase/migrations/` | SQL migrations | exists (at the root, as planned) |
| `supabase/functions/` | Edge Functions | exists: `delete-account`, `recommend-places` |


## Modules

| Module | Path | Responsibility | Depends on |
|---|---|---|---|
| Routes | `src/app/` | Root Stack layout with the sign-in gate (`Stack.Protected`), the `(auth)` group (welcome, e-mail, code), `onboarding` (profile setup), `auth/callback`, the `(drawer)` group (Drawer layout) with its `(tabs)` group (Tabs layout with the pill + home screen + the expenses screen + one empty screen + the profile screen), `settings`, create-trip wizard screens, the photo viewer (`trips/[tripId]/photos`) | `expo-router` (incl. `expo-router/drawer`), features, components, hooks, theme, i18n |
| Schemas | `src/schemas/` | Zod schemas and inferred types: common (money, codes, dates), interests, airport (with coordinates), flight segment / flight route, member, trip / trip summary / trip overview / trip list item / trip list / selected trip, wizard inputs, Supabase client config, sync status, trip budget change / current trip, trip photo / shown photo / photo list / picked photo, cover / cover choice / cover urls, profile (username, friend code, profile, shown profile, setup input), auth (e-mail, OTP code, sign-in inputs), provider profile (`ProviderMetadataSchema` — lenient parse of Supabase's `user_metadata`; `ProviderProfileSchema` — nick suggestion + photo URL, https on `lh3.googleusercontent.com` / `cdn.discordapp.com` only; pure `suggestUsername` and `providerProfile(provider, metadata)`, which never throws) | `zod`, `lib/time` |
| Data | `src/data/` | Repositories, local store, session and auth (details in "Data module" below) | schemas, lib, `expo-crypto`, `@supabase/supabase-js`, `expo-sqlite`, `react-native-url-polyfill`, `expo-image-manipulator`, `expo-file-system`, `expo-image`, `expo-web-browser`, `expo-linking` |
| Lib | `src/lib/` | Pure functions: airport-local time ↔ instants and pickers (`isExistingLocalTime`: round-trip check for DST gaps; `isoToLocal`: stored instant → airport wall clock), date display formatters, layovers (`layoverMinutes` from wall clocks — none for an impossible or skipped time; `savedLayoverMinutes` from stored instants), trip dates/days, default trip name (`defaultTripName`), money parse/format (ISO 4217 digits), airport search, text folding, trip sections (`tripSections`, `defaultTripId`, `deviceToday`), trip photos (`takenAtFromExif`, `compareTakenAt`, `sortTripPhotos`, `photoPaths`, `fitWithin`; `PHOTO_MAX_SIDE` 2048, `THUMBNAIL_MAX_SIDE` 480), avatar (`AVATAR_MAX_SIDE` 512, `avatarPath`), travel stats (`travelStats(trips, today, airports)` → `{ trips, countries, days, flights, km }` of the past trips: `tripSections().past`, countries of the destination airports, days inclusive by `tripDayCount`, one flight per segment, km = great-circle distance (R 6371) summed then rounded once; an IATA missing from the list counts as a trip and a flight, not a country or km) | schemas, data (airports) |
| Hooks | `src/hooks/` | `useTripList` (query `['trips', 'list']`), `useCurrentTrip` (query `['trips', 'current']`) — both `networkMode: 'always'`; `useSelectTrip` (mutation, `networkMode: 'always'`, resets `['trips', 'current']`), `useCreateTrip` (mutation, invalidates `['trips']`), `useSetTripBudget` (saves on the device, `networkMode: 'always'`, invalidates `['trips']`, requests a sync); `useUpdateTripDetails` (mutation, online, awaits the invalidation of `['trips']`); `useDeleteTrip` (mutation, online; cancels in-flight `['trips']` fetches, then resets `['trips', 'current']` and invalidates `['trips', 'list']`). Trip photos: `useTripPhotos` (query `['trip-photos', tripId]`, outside `['trips']`, `networkMode: 'always'`); `usePhotoUploads` (an in-memory queue per trip, one upload at a time; items `waiting \| sending \| failed`; retrying one or all reuses the same id; waiting items fail offline; invalidates the photos query after each success); `useDeleteTripPhoto` (online only, awaits the invalidation). Profile: `useMyProfile` (query `['profile', 'me']`, only while signed in, `networkMode: 'always'`, `retry: false`) and `useCreateProfile` (writes the query only if no sign-out began meanwhile, by the user epoch). Sign-in: `useSignIn` (OAuth provider), `useSendEmailCode`, `useVerifyEmailCode`. Sign-out: `useSignOut` (one call at a time, never rejects; `pending` stays true after a success and goes back after a rejection). Motion: `useReduceMotion` (`true`, `false`, or `null` until the system answers, `true` when the call rejects, follows `reduceMotionChanged`, and a change event that arrives before the first answer wins over it; used by `BottomSheet`, `ConfirmDialog`, `CoverImage`, `PillNav`, `Snackbar` — which treat `null` as "animate" — and `WelcomeScreen`, which waits on `null`) | `@tanstack/react-query`, providers |
| Providers | `src/providers/` | `AppProviders`: `QueryClientProvider` + trip repository context (`useTripRepository`; default `createAppTripRepository()`) + profile repository context (`useProfileRepository`; default `createAppProfileRepository()`) + `BudgetSyncProvider` (sync on start / reconnect / foreground / after save / backoff timer; `useRequestBudgetSync`, `useIsOffline`) + `SessionProvider` (`useSession`: `loading \| signedOut \| signedIn \| error`, `retry`, `signOut`; see Data flow) | data, `@tanstack/react-query`, `expo-network` |
| Auth feature | `src/features/auth/` | `useGateView` (`loading \| startError \| signedOut \| onboarding \| profileError \| app`), `FullScreenError`, `AppLoading` (the gate's loading view: `HomeSkeleton` + a round placeholder with the icon button's size (`components.iconButton`) where the menu button sits + a placeholder with the pill's geometry (`components.tabs.height`, `PillNav`'s width, at `usePillBottomOffset()`), both `border.default`, on `background.canvas` (sunline-merge-main D1); one busy element „Wczytywanie”); `WelcomeScreen`, `SignInSheet`, `BrandButton` / `GoogleButton` / `DiscordButton` with `GoogleLogo` / `DiscordLogo`; `AuthFormScreen` (frame of the e-mail, code and profile screens, `FormError`), `EmailSignInContext`, `EmailScreen`, `CodeScreen`, `useResendCountdown`; `ProfileSetupScreen`, `AvatarPicker` | components, hooks, providers, schemas, theme, i18n, `expo-image`, `expo-image-picker`, `expo-status-bar`, `react-native-svg` |
| Home feature | `src/features/home/` | `CurrentTrip`: menu button (☰) and trip menu button (⋮) over the hero + hero + `PhotoStrip` + "Loty" / "Podróżni" / "Budżet" (with "Zmień" and the sync indicator) cards + pinned offline banner when offline; owns one `sheet` state (`menu` / `details` / `budget` / `delete`), so only one sheet is open; `HeroMenuButton` (pinned under the status bar, also over the loading skeleton); `HomeSkeleton` (the trip view's loading skeleton: `TripHeroSkeleton`, then the „Loty” / „Podróżni” / „Budżet” cards in `Section`'s look with pulsing title, button and line blocks; no photo strip; the cards are the shared `Card` (`surface.primary`, 1dp `border.subtle`), every block `skeleton.base` in both schemes (sunline-merge-main D2), gutters `layout.screenGutterCompact` / `screenGutter`; hidden from screen readers); `TripMenuButton` (⋮, top-right, trip view only); `TripMenuSheet`, `TripDetailsSheet` (rename, cover), `BudgetSheet` (change the daily budgets, „Razem / Osobno”), `DeleteTripSheet` (confirm the delete) | components, hooks, providers, lib, theme, `expo-router`, `expo-router/drawer`, `expo-status-bar` |
| Profile feature | `src/features/profile/` | `ProfileScreen`: header „Profil” + gear (`IconButton` → `/settings`), the photo + nick row, `TravelStatsCard`, the offline banner above the pill; refetches the own profile on offline → online (D18). `ProfilePhoto` (inside it): 96dp circle; tapping it with a photo pushes `/avatar`, without one opens the gallery, disabled during the skeleton and offline without a photo; no `avatarId` → person placeholder; with one → `profile-photo-skeleton` (`SkeletonBlock`) until the `Image` has loaded, then the skeleton fades over `duration.small` (D22, none with reduced motion); a failed url is retried once per offline → online change; a photo already shown stays when a later url fails or a read has none (D21, D23). `TravelStatsCard`: `Card` „Twoje podróże”, 2-column grid (one column above `fontScale` 1.3), lucide icons, numbers by `Intl.NumberFormat`, one screen-reader element per stat; loading → five `SkeletonBlock`s, failed with no copy → „–”. `SettingsScreen` (Sunline): one list with Konto („Edytuj profil”), Wygląd („Motyw”, „Język”, three-option `SegmentedControl`s through `usePreferences`), O aplikacji (version from `expo-constants`), then „Wyloguj się” and „Usuń konto”, both disabled offline with a reason; `ConfirmDialog` „Wylogować się?” whose message adds the unsent-budget warning when `hasUnsentChanges()` is true or fails. `DeleteAccountDialog`: the warning, a field for the own nick, confirm enabled only on a match (`trim` + lowercase, like the function). `EditProfileScreen` (nick, interests). `AvatarViewer` + `AvatarSheet`: the full-screen preview with change and remove | components, hooks, providers, lib, data (airports), theme, i18n, `expo-image`, `expo-router`, `react-native-reanimated` |
| Trip photos feature | `src/features/trip-photos/` | `PhotoStrip`: under the hero; the „+” tile, then photos and uploads merged by date taken (`mergeStripItems`), with loading, empty, error, sending, failed and offline lines. `PhotoTile`: a thumbnail, a scrim with a spinner while sending, a failed icon, disabled offline. `pickTripPhotos`: the gallery, ≤ 20 photos, reads only the EXIF date. `PhotoViewer`: a full-screen pager with a counter pill, delete and an offline hint pill; it keeps the photo in view by id. `DeletePhotoSheet` | components, hooks, providers, lib, schemas, theme, `expo-image`, `expo-image-picker`, `expo-status-bar` |
| Drawer feature | `src/features/drawer/` | `TripsDrawer`: "Twoje podróże", "Nadchodzące" / "Minione" rows (thumbnail, name, dates, the open trip marked), "Nowa podróż"; loading / error / empty / offline | components, hooks, providers, lib, theme, `expo-image` |
| Nav feature | `src/features/nav/` | `NAV_TABS` (route key, i18n label key, lucide icon for the four tabs), `usePillClearance` (space the floating pill occupies: inset + 12 + `PILL_HEIGHT` 64) and `usePillBottomOffset`, `EmptyScreen` (title + one sentence, bottom padding above the pill) | components, theme, i18n, `react-native-safe-area-context` |
| Expenses feature | `src/features/expenses/`, `src/hooks/useExpenses.ts` | Expenses screen, budget card, per-person chart, timeline, add / edit sheet; read and write hooks, edit rule | schemas, lib, data, components |
| Discover feature | `src/features/discover/`, `src/hooks/usePlaceRecommendations.ts`, `src/data/places.ts` | `/discover` screen; the hook calls the `recommend-places` Edge Function through `fetchPlaceRecommendations` (Zod on the response, errors as `PlacesError` kinds `limit_reached \| offline \| unauthorized \| failed`) | schemas, lib (`place-types`, `place-picks`), data, components |
| Expense data | `src/schemas/expense.ts`, `src/data/expense-repository.ts`, `expense-rows.ts`, `expense-sync.ts`, `app-expense.ts` | Expense schemas; local writes and reads in SQLite; row mapping; push and pull with Supabase; app instances | Zod, `expo-sqlite`, Supabase |
| Expense budget | `src/lib/expense-budget.ts` | Pure totals, daily limit with carryover (D7), category sums, timeline days | schemas, `trip-days` |
| Create-trip feature | `src/features/trip-create/` | Draft type and helpers, step routing, draft context (dirty/complete), wizard frame, segment/friend cards, field errors | schemas, lib, components |
| Theme | `src/theme/` | Primitive tokens (`tokens.ts`, incl. the `gradient` and `duration` groups), type scale (`typography.styles` in `tokens.ts`), semantic `lightTheme` / `darkTheme` and `Theme` type (`theme.ts`), `useTheme()` hook and `DarkThemeScope` | `react-native` (`useColorScheme`) |
| i18n | `src/i18n/` | One i18next instance with `pl` / `en` resources; the saved language, or the device's on `system` (`resolveLanguage`) | `i18next`, `react-i18next`, `expo-localization` |
| Components | `src/components/` | Buttons (incl. the round `HeroIconButton`), `Fab`, fields, chips, interest chips (`InterestChips`), cards, step indicator, stepper, segmented control, cover picker, cover image, trip hero, bottom sheet, confirm dialog, pill nav, snackbar, sync indicator, offline banner (see Frontend) | theme, i18n, lib, `lucide-react-native`, `react-native-svg`, `@expo/ui`, `expo-image`, `expo-image-picker`, `react-native-safe-area-context` |

### Data module
`AIRPORTS` (bundled list); `TripRepository` interface (incl. `hasUnsentChanges`: a budget change or an expense that is not `synced`) + `buildTrip` + in-memory repository (tests); `createSupabaseTripRepository`; `createAppTripRepository` (the app's: Supabase + SQLite); `trip-rows` (rows ↔ entities, Zod-parsed); generated `database.types.ts`; `auth`:
  - `ensureSession` (never signs in) and `dropAnonymousSession`;
  - `signInWithProvider` (Google / Discord, PKCE), `sendEmailCode` / `verifyEmailCode`;
  - `keepSessionFresh`;
  - errors `NotSignedInError`, `OAuthSignInError`, `InvalidCodeError`.

`app-auth`: the app's sign-in on the shared client, with `expo-web-browser` and an `expo-linking` redirect. `errors` (`ServerUnreachableError`).

`session-source` + `app-session-source`: who is signed in, sign-in / sign-out events, `checkStoredSession`, `clearUserData`, `signOut` (this phone only).

`preferences` (theme and language on `expo-sqlite/kv-store`, a separate database that `clearUserData` does not touch; unknown value or failed read = `system`). `clear-user-data` (`clearUserDataOnPhone`: image caches and `Paths.cache`, errors ignored, then SQLite, whose error rejects).

`ProfileRepository` (also `updateProfile`, `changeAvatar`, `removeAvatar`, `deleteAccount`; `UsernameMismatchError`) + in-memory, `createSupabaseProfileRepository`, `createAppProfileRepository`, `profile-rows`.

`provider-profile-source` (`readProviderProfile(auth)`: the stored session's `app_metadata.provider` + `user_metadata` through `providerProfile`; never rejects — `getSession()` may refresh an expiring token, and without it there is no suggestion), `avatar-download` (`downloadAvatar(url)`: re-checks the URL with `ProviderProfileSchema`, then `File.downloadFileAsync` into `Paths.cache` as `avatar-<uuid>` with a 20 s abort timeout; returns a `file://` URI), `app-provider-profile` (the app's wiring of both; mocked globally in `jest.setup.ts`).

`local-db` (expo-sqlite + versioned migrations, v1–v6); `app-local-store` (one shared store); `local-store`:
  - list copy, a copy per opened trip, the chosen trip, budget changes, a photo-list copy per trip, the own-profile copy;
  - `forgetTrip`, `clearUserData`;
  - a serial queue and the user epoch.

`budget-sync` (send, backoff). `photo-files` (`preparePhoto`; `prepareAvatar` ≤ 512 px). `supabase` client (also registers `keepSessionFresh`; installs `web-crypto` first). `web-crypto` (`installWebCrypto`: fills a missing global `crypto.getRandomValues` and `crypto.subtle.digest` — SHA-256 only — from `expo-crypto`, so auth-js PKCE uses S256).



## External services

| Service | Used for | Called from | Secrets |
|---|---|---|---|
| Supabase (project `hwsqdlxojllclbwlhuwb`) | Trips (Postgres + RLS), trip photos and avatars (private Storage buckets, signed URLs), profiles, auth (Google / Discord OAuth, e-mail code), `delete-account` | `src/data/supabase-trip-repository.ts`, `src/data/budget-sync.ts`, `src/data/supabase-profile-repository.ts`, `src/data/session-source.ts`, `src/data/auth.ts` via `src/data/supabase.ts` | Publishable key in `.env.local` (public by design); the service role key only in Edge Function secrets; no secret key or DB password in the repo |
| Google and Discord OAuth | Sign-in (through Supabase Auth; the app never talks to them directly) | the system browser, opened by `src/data/app-auth.ts` | Client IDs and secrets only in the Supabase dashboard; Google's consent screen is in testing mode (test users only, R4) |
| OurAirports, mwgg/Airports, datasets/country-codes | Airport list (generated once at dev time, bundled) | `scripts/build-airports.mjs` only | — |

