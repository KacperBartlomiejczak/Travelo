# Task: Flights step tabs, trip name, cover photo and the nearest-trip home screen
Status: in progress (approved by Kacper 2026-10-06)

## Understanding & assumptions
Kacper's request (2026-10-06), in short:
1. **Flights step without the long scroll.** Step 1 (`/trips/new`) gets a switch at the top: **"Lot tam" / "Powrót"**, "Lot tam" selected by default. Only the selected direction's form is shown. The switch only changes what is visible — both directions stay required and are kept in the draft.
2. **Trip name**, default "from → to".
3. **Optional cover photo** from the phone's gallery.
4. **Home screen like CheckMyTrip:** the home screen (`/`) shows **only the nearest trip**. Its photo takes about **50 % of the screen** and **fades into black**; the screen scrolls. **No new functionality — it only displays data.** **Example trips** are added (development builds only).

**Done means:** step 1 shows one direction at a time with a working switch; on the summary step the organizer sets a name (pre-filled "Kraków → Barcelona") and optionally a cover photo; the saved trip carries both; the home screen shows the nearest trip with the photo hero (or a plain dark hero without a photo) and its data below; development builds start with 3 example trips; pl/en, light/dark; full suite, typecheck and lint green; `Architecture.md` updated.

### Decisions (Kacper, 2026-10-06)
- **D1 (Q1)** — Cover photo from the phone's gallery via `expo-image-picker`; the photo is **optional**.
- **D2 (Q2, Q6)** — Name + photo on the **summary step**, as a new first card "Nazwa i zdjęcie". Still 4 steps.
- **D3 (Q3)** — Default name "Kraków → Barcelona": city of the first outbound departure → city of the last outbound arrival.
- **D4 (Q4, Q7)** — Home screen shows only the nearest trip. The photo takes ~50 % of the screen height and fades into black; the screen scrolls; data only, no actions on the trip (like CheckMyTrip).
- **D5 (Q5)** — "Dalej" with an error on the hidden tab: switch to the tab with the first error (outbound first), scroll to it, announce "Popraw zaznaczone pola".
- **D6 (Q8)** — Trip without a photo: the same hero height with a plain dark background.
- **D7 (Q9)** — "Black" = Sunline ink `#17211B` (`neutral.900`).
- **D8 (Q10)** — 3 example trips only in development builds (`__DEV__`), photos bundled in `assets/` (free licence, e.g. Unsplash).

### Assumptions — approving the plan confirms them
- A1 — The switch reuses the existing `SegmentedControl` (52dp) with the labels "Lot tam" / "Powrót". The ticket button stays above it; the companions stepper stays below the form on both tabs. The return suggestion (D25 of the wizard) keeps working.
- A2 — Name field: pre-filled with the default; until the organizer edits it, it follows changes to the flights; once edited it is kept; an empty field shows "Podaj nazwę podróży" and blocks saving; max 60 characters.
- A3 — The photo is stored as the device-local URI returned by the picker (trips are in memory, D1 of the wizard). Uploading to Supabase Storage is a later decision.
- A4 — **Home screen with a trip is always dark** (in light mode too), because the photo fades into ink and the content continues on it: background `neutral.900`, cards on the dark secondary surface, text in dark-theme text colours. Loading / empty / error states stay as they are today (with the "Twoje podróże" title).
- A5 — **Layout with a trip** (top → bottom, all in one scroll view):
  1. Hero, height 50 % of the window: photo edge to edge from the very top (under the status bar, light status-bar content), a gradient from transparent to ink over its lower part; on the gradient: trip name (Heading 1, Fraunces), dates + number of days. Without a photo: plain ink.
  2. "Loty" card: outbound and return segments ("KRK 08:15 → BCN 11:05", airport-local times) with layover labels, as on the summary step.
  3. "Podróżni" card: "Ty" + friends' names.
  4. "Budżet" card: per person, group total, ~per person per day.
  5. The pinned "Utwórz podróż" button stays, so new trips can still be created.
- A6 — Other trips are not shown anywhere for now (only the nearest one, D4). "Nearest" = the same order as today: soonest start date first; trips that have already ended are still listed (no past/upcoming split yet).
- A7 — Because the list disappears from the home screen, code that only served it becomes unused and is removed (rule: clean up what your change made unused): `TripCard` (+ test), `useTrips`, `TripRepository.list()`. `TripCardSkeleton` is replaced by a hero skeleton. Git keeps them for a future "all trips" screen.
- A8 — Example trips: 3 trips (e.g. Lisbon, Bangkok, Rome) with dates relative to today, so they are always in the future; the nearest has a photo, one has none (to show D6). Seeding is off in tests.
- A9 — Gradient drawn with `react-native-svg` (`LinearGradient`, installed). RN 0.86 style types have no `backgroundImage`, so no new dependency for it. Photo shown with `expo-image` (installed, not used yet).

## Approach
- **Flights tabs (frontend only):** `useState<'outbound' | 'return'>('outbound')` in the flights screen; render `section(selected)`. On a failed "Dalej", select the tab holding the first error, then scroll to the card (existing scroll logic, per direction).
- **Name + photo:** a new wizard slice `details: { name, coverImageUri? }` with its own Zod schema in `CreateTripInputSchema`; `buildTrip` takes the name from it (replaces wizard D13). Default name = pure function `defaultTripName(outbound)` in `src/lib/`. UI: "Nazwa i zdjęcie" card on the summary step with `TextField` + `CoverPicker` (wraps `launchImageLibraryAsync`, images only, crop on; mocked in tests).
- **Home screen:** the repository gets `nearest(): Promise<TripOverview | null>` (trip summary + members + segments, parsed with a new `TripOverviewSchema`); `useNearestTrip()` (query key `['trips', 'nearest']`, invalidated by `useCreateTrip` through the `['trips']` prefix). New `NearestTrip` view (hero + three cards) rendered with the dark theme (A4).
- **Example trips:** `src/data/example-trips.ts` builds 3 `CreateTripInput`s relative to today; `AppProviders` seeds the default repository with them when `__DEV__` and not under Jest.
- Rejected: keeping the trip list below the hero — Kacper wants only the nearest trip on the home screen.

## Data structures (Zod)
```ts
// src/schemas/trip.ts
export const TRIP_NAME_MAX_LENGTH = 60;
const tripShape = {
  ...,
  /** Organizer's name for the trip; defaults to "<from city> → <destination city>" (D3, replaces wizard D13). */
  name: z.string().min(1).max(TRIP_NAME_MAX_LENGTH),
  /** Device-local image URI while trips live in memory (A3). */
  coverImageUri: z.string().min(1).optional(),
  ...
};
// TripSummarySchema inherits both through tripShape.

/** Everything the home screen shows about one trip (D4). */
export const TripOverviewSchema = z.object({
  trip: TripSummarySchema,
  members: z.array(TripMemberSchema),
  segments: z.array(FlightSegmentSchema),
});
export type TripOverview = z.infer<typeof TripOverviewSchema>;

// src/schemas/create-trip-form.ts
/** Name and cover — summary step (D2). */
export const TripDetailsInputSchema = z.object({
  name: z.string().trim()
    .min(1, { error: 'validation.tripNameRequired' })
    .max(TRIP_NAME_MAX_LENGTH, { error: 'validation.tripNameTooLong' }),
  coverImageUri: z.string().min(1).optional(),
});
export type TripDetailsInput = z.infer<typeof TripDetailsInputSchema>;

export const CreateTripInputSchema = z
  .object({ flights, friends, budget, details: TripDetailsInputSchema })
  .refine(/* unchanged friend count check */);
```
Draft (`src/features/trip-create/draft.ts`):
```ts
TripDraft = ... & {
  /** null = not edited yet; the default name follows the flights (A2). */
  name: string | null;
  coverImageUri?: string;
};
```
Theme roles (new, values from the palette, D7): `colors.hero.background` = `neutral.900`, `colors.hero.gradientEnd` = `neutral.900` (gradient from 0 % to 100 % opacity), `colors.hero.text` = `neutral.50`. Same in light and dark.
CLAUDE.md "Data structures" → `Trip` gets `name` (organizer's, default from → to) and `coverImageUri?`.

## Tests
- **Step 1 (schemas)** — `create-trip-form.test.ts`: `TripDetailsInputSchema` accepts name only / name + cover; trims; rejects empty and whitespace-only (`validation.tripNameRequired`), 61 characters (`validation.tripNameTooLong`), empty cover; `CreateTripInputSchema` requires `details`. `entities.test.ts`: `TripSchema` / `TripSummarySchema` accept a cover and no cover, reject a 61-char name and an empty cover; `TripOverviewSchema` valid fixture, rejects a bad member / segment.
- **Step 2 (lib + data)** — `trip-name.test.ts`: KRK→BCN = "Kraków → Barcelona" (whatever the airport list's city names are, asserted from the list); with layovers uses first departure and last arrival; unknown code → IATA; empty airports → ''. `trip-repository.test.ts`: saved name = `details.name` trimmed; cover stored; no cover → no field; `nearest()` → null when empty; returns the soonest trip with its members and segments (parsed with `TripOverviewSchema`); ties by `createdAt`. `example-trips.test.ts`: 3 inputs, each parses with `CreateTripInputSchema` for a given "today" (future dates), exactly one without a cover.
- **Step 3 (flights tabs)** — `flights.test.tsx`: "Lot tam" selected and only the outbound section shown; "Powrót" shows only the return section (with suggested airports); typed data survives switching back; companions stepper on both tabs; error only in return → "Dalej" switches to "Powrót", announces, does not advance; errors in both → "Lot tam"; a valid form advances. Existing tests that assumed both sections visible are updated to switch tabs (logged as a deviation; no assertion weakened).
- **Step 4 (name + photo)** — `draft.test.ts`: `tripName(draft)` = default while `name` is null, typed text once edited; `toCreateTripInput` includes `details`. `CoverPicker.test.tsx` (picker mocked): "Dodaj zdjęcie" opens the library with images only + crop; picked → preview + "Zmień zdjęcie" / "Usuń zdjęcie"; cancel changes nothing; picker error → message, old photo kept. `summary.test.tsx`: field pre-filled "Kraków → Barcelona"; edited name saved; cleared → error, not saved; picked cover saved; changing flights before editing updates the default.
- **Step 5 (hero component + theme)** — `theme.test.ts`: hero roles in both themes. `TripHero.test.tsx`: height = 50 % of the window (mocked dimensions); with a cover → image with that URI, hidden from screen readers, gradient present; without → no image, ink background; name is a header in `hero.text`; dates + day count shown; pl/en.
- **Step 6 (home screen)** — `index.test.tsx` / `trips-list.test.tsx` (rewritten for the new screen): loading → hero skeleton announced "Wczytywanie podróży"; error → retry (unchanged behaviour); empty → unchanged; with trips → only the nearest trip's name shown (the later one is not), "Loty" card with segment lines and layovers in airport-local time, "Podróżni" with "Ty" + names, "Budżet" with per person / total / per day; dark colours in light mode (A4); "Utwórz podróż" still navigates to `/trips/new`; after creating a sooner trip the home screen shows it. `AppProviders` test: seeding off under Jest.

## Files
- Modified: `src/schemas/trip.ts`, `create-trip-form.ts`, `index.ts`, `src/schemas/__tests__/*`, `src/data/trip-repository.ts` (+ test), `src/test/fixtures.ts`, `src/features/trip-create/draft.ts` (+ test), `src/app/trips/new/index.tsx`, `summary.tsx`, `src/app/index.tsx`, `src/__tests__/app/index.test.tsx`, `trips-list.test.tsx`, `trips/new/flights.test.tsx`, `summary.test.tsx`, `src/hooks/useTrips.ts` (+ test), `src/providers/AppProviders.tsx`, `src/theme/tokens.ts`, `theme.ts` (+ test), `src/i18n/locales/pl.json`, `en.json`, `package.json`, `pnpm-lock.yaml`, `app.json` (image-picker plugin: `photosPermission`, `cameraPermission` / `microphonePermission` off), `CLAUDE.md` (Data structures), `GLOSSARY.md`, `Architecture.md`.
- Created: `src/lib/trip-name.ts` (+ test), `src/data/example-trips.ts` (+ test), `src/components/CoverPicker.tsx` (+ test), `src/components/TripHero.tsx` (+ test), `src/components/TripHeroSkeleton.tsx`, `src/features/home/NearestTrip.tsx` (hero + cards), `assets/images/examples/*.jpg` (3 example photos, ≤ 300 KB each, licence noted in the plan).
- Removed (A7): `src/components/TripCard.tsx` (+ test), `src/components/TripCardSkeleton.tsx`, `useTrips` and `TripRepository.list()`.

## Skills
- `stack-review` — before approval (done) — `expo-image-picker` is a new dependency; Kacper chose it (D1).
- `domain-modeling` — step 1 — trip name, cover photo, "nearest trip" in `GLOSSARY.md`.
- `frontend-design` — steps 4–6 — `CoverPicker`, `TripHero`, home screen.
- `ui-taste` — steps 3–6 — visual review (verifier).

## Steps
- [x] 1. [backend] Schemas: trip name max + `coverImageUri?`, `TripDetailsInputSchema`, `CreateTripInputSchema.details`, `TripOverviewSchema`; i18n validation keys (pl/en); fixtures. — skill: domain-modeling — tests first: step 1 — verify: full suite, typecheck, lint.
- [x] 2. [backend] `defaultTripName`; `buildTrip` uses `details`; repository `nearest()`; `example-trips.ts`. — skill: none — tests first: step 2 — verify: full suite, typecheck, lint.
- [x] 3. [frontend] Flights step "Lot tam" / "Powrót" switch (D5). — skill: ui-taste — tests first: step 3 — verify: full suite, typecheck, lint, manual.
- [x] 4. [frontend] `expo-image-picker` (`npx expo install`) + `app.json`; draft `name` / `coverImageUri`; `CoverPicker`; "Nazwa i zdjęcie" card on the summary step. — skill: frontend-design, ui-taste — tests first: step 4 — verify: full suite, typecheck, lint, manual on device.
- [ ] 5. [frontend] Hero theme roles; `TripHero` (photo / plain ink, gradient, name, dates) + skeleton. — skill: frontend-design, ui-taste — tests first: step 5 — verify: full suite, typecheck, lint.
- [ ] 6. [frontend] Home screen: `useNearestTrip`, `NearestTrip` (hero + Loty / Podróżni / Budżet), states, remove unused list code (A7), example photos in `assets/`, dev seeding in `AppProviders`. — skill: frontend-design, ui-taste — tests first: step 6 — verify: full suite, typecheck, lint, manual light/dark.
- [ ] 7. Docs: `CLAUDE.md` Data structures, `GLOSSARY.md`, `Architecture.md`. — skill: none — no tests (docs only) — verify: every statement checked against the code; full suite green.

## Verification
Per step: red seen for the expected reason → green → `pnpm test` (full), `pnpm typecheck`, `pnpm lint` → verifier PASS. No migrations / RLS / AI / sync in this task. Manual steps for Kacper (device): switching tabs; picking a photo on iOS and Android (crop, cancel); home screen hero with a bright and a dark photo and without a photo; scrolling; light and dark system mode; large Dynamic Type.

## Progress log
- 2026-10-06 — plan drafted; Q1–Q5 answered (D1, D3, D5), Q2 clarified (D2), Q4 replaced by the home-screen hero (D4), Q8–Q10 answered (D6–D8). Approved by Kacper ("akceptuje"). Baseline: 42 suites, 404 tests, typecheck and lint green.
- Step 1 — tests written (red ✓: 16 failing for the expected reasons — schemas undefined, cover stripped, no max/empty-cover check) · `src/schemas/trip.ts` (`TRIP_NAME_MAX_LENGTH`, `name` max, `coverImageUri?`, `TripOverviewSchema`), `create-trip-form.ts` (`TripDetailsInputSchema`, `CreateTripInputSchema.details`), pl/en `validation.tripNameRequired` / `tripNameTooLong`, fixture `details`, `GLOSSARY.md` (Trip name, Cover photo, Nearest trip; Destination no longer names the trip) · green ✓ 421/421, typecheck 0, lint clean · verifier PASS · skill used: domain-modeling · deviation: `toCreateTripInput` sends `details: { name: destinationName(destination) }` (today's D13 name) until step 4 adds the field — required by the type, behaviour unchanged.
- Step 2 — tests written (red ✓: `trip-name` / `example-trips` modules missing; buildTrip still named by destination, cover dropped; `nearest` missing) · `src/lib/trip-name.ts` (`defaultTripName`), `src/data/trip-repository.ts` (`buildTrip` uses `details.name` + `coverImageUri`; `nearest()` → `TripOverview | null`, soonest first, ties by `createdAt`), `src/data/example-trips.ts` (3 trips relative to `today`: Kraków → Lisbon, Warsaw → Bangkok with a Dubai layover, Warsaw → Rome solo) · green ✓ 441/441, typecheck 0, lint clean · verifier PASS · skill used: none · deviations: (1) the example-trips "exactly one without a cover" test moves to step 6, with the bundled photos; (2) existing tests changed because D3 changed behaviour — `trip-repository.test.ts` (fixture name, IATA fallback now tested in `trip-name.test.ts`, names set in the sort test), `useTrips.test.tsx` (names; stubs gained `nearest`); no assertion weakened. Verifier follow-up: the createdAt tie test now uses a clock going backwards so it fails without the tie-break (checked); `destinationName`'s D13 comment to be corrected in step 4.
- Step 3 — tests written (red ✓: 12 of 19 failing — no "Kierunek lotu" switch / "Powrót" radio) · `src/app/trips/new/index.tsx`: `SegmentedControl` under the ticket button, only the shown direction rendered, D5 error handling (switch to the failing tab; the card on the other tab scrolls into view from its `onLayout`), one `sectionY` (the section sits at the same place on both tabs); i18n `newTrip.flights.direction` (pl/en) · green ✓ 446/446, typecheck 0, lint clean · verifier PASS (incl. mutation checks of the D5 scroll and outbound-first order; code-level ui-taste review) · skill used: ui-taste (verifier review) · deviation: existing flights tests switch to "Powrót" before using the return card; the first test now asserts the switch and that only the outbound is shown; no assertion weakened. Notes for the manual check: the section heading repeats the selected tab's label; switching tabs by hand keeps the scroll position.
- Step 4 — tests written (red ✓: `tripName` missing, no `name: null`, no cover in `details`, `CoverPicker` missing, no "Nazwa i zdjęcie" card, saved name still "Bangkok") · `expo-image-picker@~57.0.20` added with `pnpm add` (version from `expo/bundledNativeModules.json`; `npx expo install` cannot reach the Expo API — proxy 403) + `app.json` plugin (photos text; camera/microphone off); `draft.ts` (`name: string | null`, `coverImageUri?`, `tripName`, `details` in `toCreateTripInput`); `src/components/CoverPicker.tsx`; summary step: first card "Nazwa i zdjęcie" (name field, max 60, empty → "Podaj nazwę podróży" + announce, no save; cover picker); the incomplete-draft guard ignores the name; i18n pl/en (`newTrip.summary.detailsTitle` / `name`, `coverPicker.*`); `destinationName` comment corrected · green ✓ 460/460, typecheck 0, lint clean · verifier PASS (mutation check of the guard) · skills used: frontend-design, ui-taste (verifier review) · deviations: "changing flights updates the default" tested at unit level (`tripName` in `draft.test.ts`) because the summary test uses a stand-in for step 1; summary test probe now expects the D3 name "Warsaw → Bangkok" and shows the cover URI. Verifier follow-up: cover preview made an accessibility element (`accessible`, test red → green). Known limitation: iOS crops the cover square (Expo ignores `aspect` there); the preview shows 16:9 with `cover` fit. Two longest city names could give a 61-character default name (practically unreachable).
- Risk hit (2026-10-06): the network policy blocks Unsplash, Pexels, Pixabay, Wikimedia and Picsum — example photos must come from Kacper (asked).

## Risks & open questions
- The picker's file URI lives in the app cache; the OS may clear it. Acceptable while data is in memory; must be solved (upload to storage) with Supabase.
- `app.json` permission text is English only; localising native permission strings is out of scope unless Kacper wants it.
- Example photos must be downloaded from a free-licence source (Unsplash licence: free use, no attribution required). If the network blocks it, I ask Kacper to drop 3 photos into `assets/images/examples/`.
- City names come from the airport list, mostly in English ("Warsaw", but "Kraków"), so the default name can read e.g. "Warsaw → Barcelona" — a known limitation of the list, not fixed here.
- Removing the list (A7) means a trip that is not the nearest cannot be seen until an "all trips" screen exists.
