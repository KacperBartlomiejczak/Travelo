# Task: Trips drawer — side panel with all trips
Status: in progress — plan approved by Kacper on 2026-10-08

## Understanding & assumptions
Today the home screen (`/`) shows only the **nearest trip** (soonest start date). Other trips cannot be seen at all (Architecture "Known limitations", `prompts/trip-flight-tabs-name-cover/plan.md` A6). Kacper wants navigation: a **menu button in the top-left corner** that slides out a **side panel** (drawer) listing **all the organizer's trips**. Tapping a trip opens it on the home screen.

"Done" means:
- A menu button (lucide `Menu`) sits in the top-left corner of the home screen in every state (loading, empty, error, trip). Tapping it, or swiping from the left edge, slides the panel in from the left over a scrim. A scrim tap, a swipe left, or the system back button closes it.
- The panel shows "Twoje podróże", then the trips in two sections: **"Nadchodzące"** (ongoing and future trips, soonest first) and **"Minione"** (ended trips, most recently ended first). Each row has the cover photo thumbnail (or a placeholder), the name and the dates. The trip open on the home screen is marked. **"Nowa podróż"** is pinned at the bottom of the panel.
- Tapping a trip makes it the **current trip**: the panel closes and the home screen shows it. The choice is remembered on the phone, so after a restart the app opens on the same trip.
- The pinned "Utwórz podróż" button disappears from the trip view (Kacper, 2026-10-08). Creating a trip now starts from "Nowa podróż" in the panel, or from the empty state when there are no trips.
- Offline, the panel shows the copy of the list kept on the phone, and the home screen shows the copy of the current trip. Both are read-only.
- The panel has loading, empty, error and offline states.
- **No trips never means a blank screen** (D5). When the organizer has no trips, the panel shows the "no trips" message and "Nowa podróż", and the home screen shows its empty state with the menu button and "Utwórz podróż". Every combination of data and connection ends in exactly one visible state: loading, trip, empty or error.
- Full suite, typecheck and lint are green. Manual device steps are written for Kacper.

Assumptions (Kacper confirms them together with the plan, see "Proposals to confirm"):
- **A1 — Default trip.** When nothing has been chosen yet, or the chosen trip no longer exists (deleted or no longer visible), the home screen shows the **soonest upcoming or ongoing trip**, and if there is none, the **most recently ended** one. This changes today's rule ("soonest start date", which picks the *oldest past* trip once past trips exist). See P3.
- **A2 — Sections use the device's local date.** A trip is "Nadchodzące" while `endDate ≥ today`, so an ongoing trip stays in "Nadchodzące". It is "Minione" from the day after its `endDate`.
- **A3 — A newly created trip becomes the current trip,** so after "Utwórz podróż" in the wizard the home screen shows it. See P4.
- **A4 — The choice is device-only.** It is stored in SQLite and never sent to Supabase, so no server change and no migration are needed.
- **A5 — Offline copies.** The list copy is replaced after every successful read from Supabase. A copy of a trip's details is kept for **every trip opened on this phone**. Copies of trips that are no longer on the server list are deleted. A trip that has never been opened on this phone has no copy, so offline it shows the existing error state with the offline banner. See P6.
- **A6 — Only the trip view loses the pinned "Utwórz podróż".** The empty state keeps it, because an empty state needs one action (§10.19). The error state also keeps it, unchanged. The loading skeleton drops it, because a skeleton must match the final geometry (§10.18), and the final screen is usually a trip.
- **A7 — The panel follows the system theme** (light/dark), like the wizard. Only the trip view itself stays always dark (`DarkThemeScope`, earlier decision A4). See P1.
- **A8 — Swipe from the left edge opens the panel** only on the home screen, not in the wizard.

## Decisions (Kacper, 2026-10-08)
- **D0 — Plan approved as written** (2026-10-08). The plan says A1–A8 and P1–P6 are confirmed together with it, so they are implemented as written. P2 lists two options; the plan's recommended option **(a)** is implemented (the drawer's slide is accepted as a gesture-driven navigation transition). If Kacper prefers (b), that changes step 6 and needs a plan update. Only this feature is in scope; trip-edit-menu waits.
- **D1 — Split and order.** The request ("navigation + trip card update + ⋮ edit button") is four features. Each has **its own plan file** and its own approval, done in this order:
  1. **trips-drawer** (this plan);
  2. **trip-edit-menu** (`prompts/trip-edit-menu/plan.md`);
  3. **trip-photos** (`prompts/trip-photos/plan.md`);
  4. **expenses** (`prompts/expenses/plan.md`).
  What was agreed for 2–4 is recorded in their own plans, not here.
- **D2 — Remember the chosen trip** across restarts. If it is gone, show the default trip.
- **D3 — Offline: keep a copy of the list on the phone** (name, dates, cover) and of the chosen trip. This extends trips-supabase D6, which kept only the nearest trip.
- **D4 — Panel content:** sections "Nadchodzące" / "Minione". Each row is cover thumbnail + name + dates. The open trip is marked. "Nowa podróż" sits at the bottom of the panel. The pinned "Utwórz podróż" leaves the bottom of the home screen.
- **D5 — No trips must always show "no trips"** (Kacper's review of this plan): the user must never see an empty, blank screen when they have no trips.
  - **Panel:** the "no trips" text from `context/design-context.md` §13.2 — "Nie masz jeszcze żadnej podróży." / "Zaplanuj pierwszą i zaproś znajomych." (en: "You don't have any trips yet." / "Plan your first one and invite your friends.") — above "Nowa podróż".
  - **Home screen:** the existing empty state (suitcase illustration + the same two lines + "Utwórz podróż"), now with the menu button.
  - It also applies when the last trip disappears from the server (the copies are cleared, so offline does not show a deleted trip either).

## Approach
1. **Navigation:** the built-in `expo-router/drawer` (expo-router 57 ships it; it uses `react-native-drawer-layout`, which expo-router already depends on, plus `react-native-gesture-handler` and `react-native-reanimated`, which are already in `package.json`). **No new dependency.** The home route moves into a route group: `src/app/(drawer)/_layout.tsx` (Drawer) + `src/app/(drawer)/index.tsx`. The URL stays `/`. The wizard stays in the root Stack above the drawer. The panel content is our own component (`drawerContent`). The trips-expenses pill nav (feature 4) will later sit inside this group.
2. **Current trip instead of nearest trip:** `TripRepository.nearest()` becomes `current()`. It returns the chosen trip if it still exists, otherwise the default trip (A1). Two new methods: `list()` (all trips, for the panel) and `select(tripId)` (remember the choice on the device). `create()` also selects the new trip (A3).
3. **Device (SQLite):** local migration **v2** adds `trip_list_cache` (one row: the list as JSON) and `selected_trip` (one row: the trip id). `trip_overview_cache` keeps its structure (it is already keyed by `trip_id`) but now holds one row per opened trip instead of one row in total (A5). Every row read is parsed with Zod.
4. **Pure logic:** `src/lib/trip-sections.ts` holds the section rule (A2) and the default-trip rule (A1). The panel and the repository both use it, so the two never disagree.
5. **UI:** the panel content `TripsDrawer`, the hero menu button `HeroIconButton`, and the home screen without the pinned button. Selecting a trip resets the current-trip query, so the home screen shows the skeleton, then the chosen trip, and never the previous trip with the new trip's highlight.

Rejected: a custom panel built on `Modal` (like `BottomSheet`). It would respect reduced motion but have no edge-swipe and would need more code. See P2, which asks about exactly this trade-off. Rejected: putting the trip id in the URL (`/trips/[id]`). It is not needed for "remember the chosen trip", and it would make every future screen (expenses) take the id from the route.

## Data structures (Zod)
`src/schemas/trip.ts` — new, built from the existing `tripShape` entries so the constraints stay in one place:
```ts
/** One trip in the side panel (trips-drawer D4): enough to show and sort it. */
export const TripListItemSchema = z
  .object({
    id: tripShape.id,
    name: tripShape.name,
    coverImageUri: tripShape.coverImageUri,
    startDate: tripShape.startDate,
    endDate: tripShape.endDate,
  })
  .refine((trip) => trip.endDate >= trip.startDate, { path: ['endDate'], message: 'End date is before start date' });
export type TripListItem = z.infer<typeof TripListItemSchema>;

/** The side panel's list, also what the device keeps as its copy (D3). */
export const TripListSchema = z.array(TripListItemSchema);
export type TripList = z.infer<typeof TripListSchema>;

/** Device only: the trip the organizer chose in the side panel (D2). Row of SQLite `selected_trip`. */
export const SelectedTripSchema = z.object({ tripId: z.uuid() });
export type SelectedTrip = z.infer<typeof SelectedTripSchema>;
```
`src/schemas/trip-budget.ts` — rename only, same shape: `NearestTripSchema` / `NearestTrip` → **`CurrentTripSchema` / `CurrentTrip`** (`{ overview, budgetSyncStatus, fromCache }`). The home screen is no longer about the nearest trip, so the old name would mislead.

### SQLite (device, local migration v2 — v1 is never edited)
```sql
create table trip_list_cache (
  id integer primary key not null check (id = 1),  -- one row
  list_json text not null,                         -- TripListSchema
  cached_at text not null
);
create table selected_trip (
  id integer primary key not null check (id = 1),  -- one row
  trip_id text not null                            -- SelectedTripSchema
);
```
`trip_overview_cache` is unchanged: `trip_id` primary key, `overview_json` parsed with `TripOverviewSchema`. It now holds one row per opened trip.

### Server
No change. The list uses the existing `trips` select policy (owner, linked viewer). There is no migration, so no type regeneration and no RLS change.

## Tests
Written before the code of each step, run, and seen failing for the expected reason.

- **Step 1 — schemas** (`src/schemas/__tests__/trip.test.ts` (new) or `entities.test.ts`, and `trip-budget.test.ts`): `TripListItemSchema` accepts a valid item with and without a cover, and rejects end before start, an empty name, a name of 61 characters, a non-uuid id, and an impossible date. `TripListSchema` accepts `[]` and rejects a list with one bad item. `SelectedTripSchema` rejects a non-uuid. `CurrentTripSchema` keeps the fixtures that `NearestTripSchema` had (renamed, not weakened).
- **Step 2 — `src/lib/__tests__/trip-sections.test.ts`:**
  - `tripSections(trips, today)`: an ongoing trip (start < today < end), one ending today, and one starting today are all in upcoming. Upcoming is sorted by start ascending, ties keep their list order. Past means end < today, sorted by end descending. An empty list gives two empty sections.
  - `defaultTripId(trips, today)`: the first upcoming trip, else the most recently ended, else `null`.
- **Step 3 — `src/data/__tests__/local-db.test.ts`, `local-store.test.ts`** (real SQLite through `node:sqlite`):
  - Migration v1 → v2 keeps existing rows (overview copy, budget change) and sets `user_version` 2. A fresh database migrates straight to 2.
  - `cacheList` / `cachedList` round-trip. A corrupt or invalid copy reads as `null`. `cacheList` deletes the overview copies of trips missing from the new list and keeps the others.
  - `cacheOverview` upserts per trip: two trips give two copies, and a second save of one trip replaces only that one. `cachedOverview(id)` returns that trip, or `null`.
  - `selectTrip` / `selectedTripId` / `clearSelectedTrip` round-trip. A newer choice replaces the older one. A stored non-uuid reads as `null`.
  - `markBudgetSynced` writes the amount into the copy of *that* trip and leaves the other copies alone.
- **Step 4 — `src/data/__tests__/supabase-trip-repository.test.ts`, `trip-repository.test.ts`** (fake Supabase + real SQLite; in-memory repository):
  - `list()`: one query on `trips` selecting `id, name, cover_image_uri, start_date, end_date`, ordered by `start_date`, `created_at`. Rows are parsed into `TripListItem`, the copy is written, and a bad row rejects. When the server is unreachable (status 0 / `AuthRetryableFetchError`) it returns the copy. When unreachable with no copy, it rejects. Other errors reject.
  - `current()`:
    - The chosen trip is fetched by id (`eq('id', …)`) and its copy is written.
    - When the chosen trip is gone, the choice is cleared and the default (A1) is shown.
    - With nothing chosen, the default comes from the list: upcoming before past, never the oldest past trip.
    - With no trips at all it returns `null`, and the list copy becomes empty, which removes the overview copies.
    - Offline it returns the chosen trip's copy with `fromCache: true`. Offline with nothing chosen it uses the default from the list copy. Offline with no copy it rejects.
    - A pending budget change still overlays the amount and status, as before.
  - `select(id)` stores the choice without any network call. `create()` selects the new trip.
  - The in-memory repository gives the same answers for `list`, `current`, `select` and create-selects.
- **Step 5 — `src/hooks/__tests__/useTrips.test.tsx`:**
  - `useTripList` returns the list.
  - `useCurrentTrip` returns the current trip (replaces the `useNearestTrip` tests).
  - `useSelectTrip` stores the choice, works offline (`networkMode: 'always'`), and afterwards `useCurrentTrip` shows the chosen trip without first returning the previous one.
  - `useCreateTrip` → `useCurrentTrip` shows the new trip.
- **Step 6 — route tests** (`src/__tests__/app/layout.test.tsx`, `home.test.tsx` → routes `(drawer)/_layout`, `(drawer)/index`), `src/theme/__tests__/theme.test.ts`:
  - The home screen still renders at `/` inside the drawer group.
  - In each state (loading, empty, error, trip) there is a button "Otwórz listę podróży", and pressing it opens the panel (drawer status `open`).
  - The trip view and the loading state no longer have "Utwórz podróż". The empty and error states still do.
  - **No trips (D5):** when the repository has no trips, the home screen shows the heading "Nie masz jeszcze żadnej podróży.", the line "Zaplanuj pierwszą i zaproś znajomych.", "Utwórz podróż" and the menu button. The same holds after the last trip disappears: `current()` → `null` → empty state, never a blank screen.
  - The offline banner still shows in the trip view when offline.
  - New theme roles exist in both themes with the agreed values (P1, P5).
- **Step 7 — `src/features/drawer/__tests__/TripsDrawer.test.tsx`** + route test for the full flow:
  - Shows "Twoje podróże", the section headers, and the rows in the right sections and order (fixed `today`). A section with no trips is not shown.
  - A row shows its name and date range, and the cover image when there is one, otherwise the placeholder.
  - The current trip is marked (`selected` state + check icon) and no other row is.
  - Tapping another trip calls `select` with its id, closes the panel, and the home screen then shows that trip's hero. Tapping the current trip only closes the panel.
  - "Nowa podróż" closes the panel and opens `/trips/new`.
  - Loading: one busy element "Wczytywanie podróży". Error: the message is shown and "Spróbuj ponownie" refetches. Offline: the banner above "Nowa podróż", with the list from the copy.
  - **No trips (D5):** no section headers, but the text "Nie masz jeszcze żadnej podróży." and "Zaplanuj pierwszą i zaproś znajomych." above "Nowa podróż". Also offline with an empty list copy: the same text plus the banner. The panel is never empty.
  - The row's screen reader label is "<name>, <dates>".

## Files
- **Create:** `src/app/(drawer)/_layout.tsx`, `src/lib/trip-sections.ts` (+ test), `src/features/drawer/TripsDrawer.tsx` (+ test), `src/components/HeroIconButton.tsx` (+ test).
- **Move:** `src/app/index.tsx` → `src/app/(drawer)/index.tsx`. `src/features/home/NearestTrip.tsx` → `src/features/home/CurrentTrip.tsx` (component renamed with the schema).
- **Modify:** `src/app/_layout.tsx` (Stack screen `(drawer)` instead of `index`); `src/schemas/trip.ts`, `src/schemas/trip-budget.ts`, `src/schemas/index.ts`; `src/data/local-db.ts` (v2), `src/data/local-store.ts`, `src/data/trip-repository.ts`, `src/data/supabase-trip-repository.ts`, `src/data/trip-rows.ts` (`listItemFromRow`); `src/hooks/useTrips.ts`; `src/providers/__tests__/BudgetSync.test.tsx` (mock repository shape); `src/theme/tokens.ts`, `src/theme/theme.ts` (P1, P5); `src/i18n/locales/pl.json`, `en.json`; `jest.setup.ts` (gesture-handler, reanimated, worklets test mocks); existing tests that mock the repository (`home`, `summary`, `layout`, `useTrips`).
- **Docs:** `Architecture.md`, `GLOSSARY.md` ("Nearest trip" → "Current trip", new "Default trip"), `CLAUDE.md` ("Decisions made": offline scope extended by D3), this plan.

## Skills
- `domain-modeling` — step 1 — replace "Nearest trip" in `GLOSSARY.md` with "Current trip" and add "Default trip" (A1), so code, plan and UI use one term.
- `supabase` — step 4 — check current supabase-js docs for `.eq(…).maybeSingle()` and selected-column typing before writing the queries.
- `frontend-design` — steps 6–7 — structure of the panel, rows and states within `context/design-context.md`.
- `ui-taste` — step 7 — final visual review of the panel and the hero menu button.

## Steps
- [x] 1. [backend] Schemas: `TripListItemSchema`, `TripListSchema`, `SelectedTripSchema`; rename `NearestTripSchema` → `CurrentTripSchema`; glossary. — skill: domain-modeling — tests first: step 1 — verify: full suite, typecheck, lint.
- [ ] 2. [backend] `src/lib/trip-sections.ts`: `tripSections`, `defaultTripId`. — skill: none — tests first: step 2 — verify: full suite, typecheck, lint.
- [ ] 3. [backend] SQLite v2 + local store: list copy (with pruning), overview copy per trip, chosen trip, budget sync per trip. — skill: none — tests first: step 3 — verify: full suite, typecheck, lint.
- [ ] 4. [backend] Repositories: `list`, `current` (replaces `nearest`), `select`, create-selects; Supabase and in-memory; `listItemFromRow`. — skill: supabase — tests first: step 4 — verify: full suite, typecheck, lint.
- [ ] 5. [frontend] Hooks: `useTripList`, `useCurrentTrip` (replaces `useNearestTrip`), `useSelectTrip`. — skill: none — tests first: step 5 — verify: full suite, typecheck, lint.
- [ ] 6. [frontend] Drawer route group, menu button in every home state (`HeroIconButton` over the hero), pinned "Utwórz podróż" removed from the trip view and loading, theme roles. The test mocks in `jest.setup.ts` (gesture-handler `jestSetup`, `react-native-reanimated/mock`, `react-native-worklets/src/mock`) are **pure test setup without behavior**. They are added first, and the full suite must stay green with them before the red tests of this step are written. — skill: frontend-design — tests first: step 6 — verify: full suite, typecheck, lint.
- [ ] 7. [frontend] `TripsDrawer`: header, sections, rows, mark of the current trip, select → close → home shows it, "Nowa podróż", loading / error / empty / offline. — skill: frontend-design, ui-taste — tests first: step 7 — verify: full suite, typecheck, lint, manual steps.
- [ ] 8. Docs: `Architecture.md`, `GLOSSARY.md`, `CLAUDE.md` decisions, manual test steps for Kacper. — skill: none — verify: every statement checked against the code.

## Verification
- After every step: `pnpm test` (full suite), `pnpm typecheck` (0 errors), `pnpm lint`. Then the **verifier** subagent checks the step against this plan, `CLAUDE.md` and `context/design-context.md`.
- No migration on the server → no type regeneration, no parity check, no RLS test needed (the list only reads `trips` through the existing policies; `pnpm test:db` is unchanged).
- Offline: covered by the repository and local-store tests (copy used when unreachable, chosen trip remembered, pruning).
- Manual device steps (step 8) for what tests cannot show:
  - The slide feels right, and edge-swipe, scrim tap and Android back all close the panel.
  - The menu button stays readable over a bright cover photo.
  - Light and dark mode.
  - A long trip name at the largest Dynamic Type.
  - VoiceOver / TalkBack focus moves into the panel and back.
  - Reduced motion (P2).
  - The app restarts on the chosen trip.
  - Airplane mode: the panel shows the copy, and opening a trip never opened on this phone shows the error state.
  - With no trips at all: the panel shows "Nie masz jeszcze żadnej podróży." and the home screen shows its empty state (D5).

## Proposals to confirm (P1–P6) — the design context has no side panel, so these are new visual and behaviour rules
- **P1 — Panel look.** Width = 85 % of the screen, at most **360dp** (new token `size.drawerMaxWidth`). Background `surface.elevated`, like bottom sheets. Right corners `radius.xl` (24dp), mirroring the sheet's top corners. Scrim = the existing `overlay.scrim` (ink 50 %). Follows the system theme (A7). Rows follow §10.8: min 64dp, 16dp side padding, `surface.secondary` when pressed. Thumbnail 48×48dp (new token `size.thumbnail`), `radius.sm`, `cover` fit. Without a cover: a `surface.secondary` square with a `Plane` icon (20dp, `text.secondary`). Name: `bodyMMedium`, up to 2 lines. Dates: `bodyS` `text.secondary`. Section labels: `caption` `text.secondary`. The current trip has a `surface.secondary` background **and** a `Check` icon in the brand colour, never colour alone (§15).
- **P2 — Reduced motion.** `expo-router/drawer` always slides (the library hard-codes `ReduceMotion.Never`; the animation follows the finger, about 300 ms, with no bounce). §9.4 asks for no movement under reduced motion. Options:
  - **(a) accept it** as a gesture-driven navigation transition (recommended, because edge swipe comes for free);
  - **(b) a custom panel on `Modal`** (respects reduced motion, but no edge swipe and more code).
- **P3 — Default trip** = soonest upcoming or ongoing, else the most recently ended (A1), instead of "soonest start date".
- **P4 — A newly created trip becomes the current trip** (A3).
- **P5 — Menu button over the photo.** A 44×44dp circle, **pinned** (it does not scroll away with the photo) in the top-left corner under the status bar. Icon `Menu` 24dp in `hero.text`. Background: new role `hero.control` = ink 50 % (same value as the scrim), so the icon stays readable on a bright photo. Pressed: solid ink (`hero.background`). In the empty and error states it is a plain `IconButton` next to the "Twoje podróże" title.
- **P6 — Offline copies:** one per trip opened on this phone, deleted when the trip leaves the server list (A5).

## Risks & open questions
- Two queries at launch when no trip has been chosen yet (the list, then the default trip's details). The list is also read by the panel. This is acceptable now. It can be merged later if it proves slow.
- An update from the current version, opened offline before the first online read, has no list copy and no choice yet. It shows the error state until the phone is online once. Kacper's phone is the only install, so this is accepted.
- `react-native-drawer-layout` gestures and focus handling are covered only by the manual steps (Jest mocks gesture-handler and reanimated).

## Progress log
- Step 1: tests written — `src/schemas/__tests__/trip.test.ts` (new, 13 cases: `TripListItem` with / without cover and one-day trip, keeps only the panel's fields, rejects end before start / empty name / 61-character name / non-uuid id / impossible date `2026-02-30` / empty cover URI; `TripList` accepts `[]` and several trips, rejects one bad item; `SelectedTrip` accepts a uuid, rejects a non-uuid and a missing id), `trip-budget.test.ts` (`NearestTrip` block renamed to `CurrentTrip`, same fixtures and assertions) · red ✓ (`TypeError: Cannot read properties of undefined (reading 'parse')` — schemas missing) · added `TripListItemSchema`, `TripListSchema`, `SelectedTripSchema` to `src/schemas/trip.ts`; `NearestTripSchema` / `NearestTrip` → `CurrentTripSchema` / `CurrentTrip` in `src/schemas/trip-budget.ts` · green ✓ · suite 60/649, typecheck, lint ✓ · verifier PASS · skill used: `domain-modeling` (`GLOSSARY.md`: "Nearest trip" → "Current trip", new "Default trip") · Deviations: (1) the rename had to reach its callers to compile: `src/data/trip-repository.ts`, `src/data/supabase-trip-repository.ts` and their two tests (rename only; `nearest()` and `useNearestTrip` keep their names until steps 4–5); (2) `GLOSSARY.md` also gained "Upcoming trip / Past trip" (the panel's two sections, from A2), so the panel's words are defined too.
