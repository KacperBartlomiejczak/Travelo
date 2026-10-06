# Task: Flights step tabs, trip name and cover photo
Status: awaiting answers (Q6–Q10), then approval

## Understanding & assumptions
Kacper's request (2026-10-06), in short:
1. **Flights step without the long scroll.** Today step 1 (`/trips/new`) shows the outbound section and the return section one under the other. Instead, a switch at the top: **"Lot tam" / "Powrót"**, "Lot tam" selected by default. Only the selected direction's form is shown. The switch only changes what is visible — both directions are still required and kept in the draft.
2. **Cover photo.** The organizer can pick a cover photo for the trip. On the trips list, the photo sits behind the card's content, darkened so the text stays readable.
3. **Trip name.** The organizer can name the trip. The default is "from → to" (it replaces D13, which used only the destination city).

**Done means:** step 1 shows one direction at a time with a working switch; the organizer can set a name (pre-filled with the default) and optionally a cover photo; the saved trip carries both; the trip card shows the name and, when there is a photo, the darkened photo behind the content; everything in pl/en and light/dark; full suite, typecheck and lint green; `Architecture.md` updated.

### Assumptions (to confirm with the plan)
- A1 — The switch reuses the existing `SegmentedControl` (52dp, decided in the wizard task) with the existing labels `newTrip.flights.outbound` / `newTrip.flights.return`. The ticket button stays above the switch; the companions stepper stays below the form, visible on both tabs.
- A2 — The return suggestion (D25: outbound reversed) keeps working; it is draft logic, independent of what is visible.
- A3 — The cover photo is **optional**. Without one, the trip card looks exactly as today.
- A4 — Trips are still in memory (D1), so the photo is stored as the **device-local URI** returned by the picker. Uploading to Supabase Storage is a separate decision when Supabase arrives.
- A5 — Trip name max length 60 characters (same order as `DISPLAY_NAME_MAX_LENGTH`).
- A6 — Renaming an existing trip or changing its photo after saving is out of scope (no trip details/edit screen yet).

## Open questions — Kacper decides (see "Risks & open questions")
Q1 cover source · Q2 where name + photo go · Q3 default name format and behaviour · Q4 how the darkened card looks (new theme tokens) · Q5 what happens when "Dalej" finds an error on the hidden tab.
The plan below is written with the **recommended** answers; it changes if Kacper picks differently.

### Decisions (Kacper, 2026-10-06)
- **D1 (Q1)** — Cover photo from the phone's gallery via `expo-image-picker`; the photo is **optional**.
- **D2 (Q2)** — Answer "c : podsumowanie": the letter (C = step 1) and the word (summary = option A) disagree — **asked again** (Q6).
- **D3 (Q3)** — Default name format "Kraków → Barcelona" (cities with an arrow). Behaviour as recommended (not contradicted; to be confirmed with the plan approval).
- **D4 (Q4)** — Replaces the recommended scrim: the photo takes about **50 % of the screen** and **fades into black**; it can be scrolled; **no new functionality for now — the cards only display data**; **add example cards**. Details asked as Q7–Q10. Gradient can be drawn with `react-native-svg` (installed); RN 0.86 types have no `backgroundImage`, so no new dependency for it.
- **D5 (Q5)** — As recommended: switch to the tab with the first error, scroll to it, announce.

### Follow-up questions (2026-10-06)
- **Q6** — Name + photo on the summary step (option A)? (Recommended: yes.)
- **Q7** — Is the 50 % the **height of each trip card on the trips list** (photo fills the card, bottom fades to black, name/dates/people/budget on the dark part, the list scrolls, cards not pressable)? Or something else (e.g. a trip screen)?
- **Q8** — Card without a photo: A (recommended) same tall card with a plain dark background, so the list looks even; B the compact card as today; C a placeholder graphic.
- **Q9** — "Black": A (recommended) Sunline ink `#17211B` (`neutral.900`, darkest colour of the design system); B pure `#000000` (new colour outside the design context).
- **Q10** — Example cards: A (recommended) 3 example trips added to the in-memory list only in development builds (`__DEV__`), photos bundled in `assets/` (free-licence photos, e.g. Unsplash); B always shown until Supabase arrives (the empty state disappears); C photos as remote URLs instead of bundled files (no files in the repo, but need internet).

## Approach
- **Flights tabs (frontend only):** local `useState<'outbound' | 'return'>('outbound')` in the flights screen; render `section(direction)` for the selected one. On a failed "Dalej", switch to the tab holding the first error (outbound first), then scroll to the card (Q5).
- **Name + photo (data → UI):** a new wizard slice `details: { name, coverImageUri? }` with its own Zod schema, part of `CreateTripInputSchema`; `buildTrip` takes the name from it instead of `destinationName`. The default name is a pure function `defaultTripName(outbound)` in `src/lib/`. The UI goes on the summary step (Q2) as a new first card "Nazwa i zdjęcie".
- **Photo picking:** `expo-image-picker` (`launchImageLibraryAsync`, images only, crop on, 16:9 on Android — iOS crops square, per Expo docs) behind a small `CoverPicker` component; the picker is mocked in tests. Displaying uses `expo-image` (already installed, not used yet).
- **Card:** `TripCard` with `coverImageUri` renders an `expo-image` filling the card (`contentFit="cover"`), a scrim layer over it, and the existing content on top with "on image" text colours (Q4).
- Rejected: bundled preset covers instead of the gallery (no dependency, but needs licensed photos and is less personal) — only if Kacper picks Q1 option B.

## Data structures (Zod)
```ts
// src/schemas/trip.ts
export const TRIP_NAME_MAX_LENGTH = 60;
const tripShape = {
  ...,
  /** Organizer's name for the trip; defaults to "<from city> → <destination city>" (replaces D13). */
  name: z.string().min(1).max(TRIP_NAME_MAX_LENGTH),
  /** Device-local image URI while trips live in memory (A4). */
  coverImageUri: z.string().min(1).optional(),
  ...
};
// TripSummarySchema inherits both through tripShape.

// src/schemas/create-trip-form.ts
/** Name and cover — summary step (Q2). */
export const TripDetailsInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'validation.tripNameRequired' })
    .max(TRIP_NAME_MAX_LENGTH, { error: 'validation.tripNameTooLong' }),
  coverImageUri: z.string().min(1).optional(),
});
export type TripDetailsInput = z.infer<typeof TripDetailsInputSchema>;

export const CreateTripInputSchema = z
  .object({ flights: ..., friends: ..., budget: ..., details: TripDetailsInputSchema })
  .refine(/* unchanged friend count check */);
```
Draft (`src/features/trip-create/draft.ts`, derived from the schema input type):
```ts
TripDraft = ... & {
  /** null = not edited yet, the default name follows the flights (Q3). */
  name: string | null;
  coverImageUri?: string;
};
```
CLAUDE.md "Data structures" → `Trip` gets `name` (organizer's, default from → to) and `coverImageUri?`.

## Tests
- **Step 1 (schemas)** — `create-trip-form.test.ts`: `TripDetailsInputSchema` accepts a name + no cover, a name + cover URI; trims; rejects empty / whitespace-only (`validation.tripNameRequired`), 61 chars (`validation.tripNameTooLong`), empty cover string; `CreateTripInputSchema` requires `details`. `entities.test.ts`: `TripSchema` / `TripSummarySchema` accept `coverImageUri`, accept no cover, reject a 61-char name and an empty cover string.
- **Step 2 (lib + data)** — `trip-name.test.ts`: `defaultTripName` gives "Kraków → Barcelona" for KRK→BCN, uses the first departure and the last arrival with layovers (KRK→WAW→BKK = "Kraków → Bangkok"), falls back to IATA for an unknown code, returns '' while airports are empty. `trip-repository.test.ts`: the saved trip's name is `details.name` (trimmed), `coverImageUri` is stored and listed, no cover → no field.
- **Step 3 (flights tabs)** — `flights.test.tsx`: the switch shows "Lot tam" selected and only the outbound section; tapping "Powrót" shows only the return section (with the suggested airports); data typed on one tab survives switching back; companions stepper visible on both tabs; "Dalej" with an error only in the return → switches to "Powrót", announces, does not advance; errors in both → stays on / goes to "Lot tam"; a valid form still advances. Existing flights tests updated where they assumed both sections are visible (logged as a deviation, assertions not weakened).
- **Step 4 (name + photo on summary)** — `draft.test.ts`: `tripName(draft)` = default while `name` is null, the typed text once edited; `toCreateTripInput` includes `details`. `CoverPicker.test.tsx` (picker mocked): "Dodaj zdjęcie" opens the library with images only + crop; a picked image shows a preview and "Zmień zdjęcie" / "Usuń zdjęcie"; cancel changes nothing; a picker error shows a message and keeps the old photo. `summary.test.tsx`: the name field is pre-filled "Kraków → Barcelona"; editing it is saved; clearing it shows `validation.tripNameRequired` and does not save; the picked cover is saved; changing the flights before editing the name updates the default; the 4-step indicator is unchanged.
- **Step 5 (card with cover + tokens)** — `theme.test.ts`: new roles exist in both themes. `TripCard.test.tsx`: without a cover — unchanged (existing tests stay); with a cover — an image with that URI, hidden from screen readers, a scrim layer with the scrim colour, title / dates / travellers / budget in the on-image colour; the card name is the trip's `name`.

## Files
- Modified: `src/schemas/trip.ts`, `src/schemas/create-trip-form.ts`, `src/schemas/index.ts`, `src/schemas/__tests__/*`, `src/data/trip-repository.ts` (+ test), `src/test/fixtures.ts`, `src/features/trip-create/draft.ts` (+ test), `src/app/trips/new/index.tsx`, `src/app/trips/new/summary.tsx`, `src/__tests__/app/trips/new/flights.test.tsx`, `summary.test.tsx`, `src/components/TripCard.tsx` (+ test), `src/theme/tokens.ts`, `src/theme/theme.ts` (+ test), `src/i18n/locales/pl.json`, `en.json`, `package.json`, `pnpm-lock.yaml`, `app.json` (image-picker plugin, `photosPermission`, microphone permission off), `CLAUDE.md` (Data structures), `GLOSSARY.md` (trip name, cover photo), `Architecture.md`.
- Created: `src/lib/trip-name.ts` (+ test), `src/components/CoverPicker.tsx` (+ test).

## Skills
- `stack-review` — before approval — `expo-image-picker` is a new dependency (Q1).
- `domain-modeling` — step 1 — trip name and cover photo enter the domain; `GLOSSARY.md` entries.
- `frontend-design` — steps 4, 5 — new `CoverPicker` and the card with a photo.
- `ui-taste` — steps 3–5 — visual review of the tabs, the summary card and the trip card (verifier).

## Steps
- [ ] 1. [backend] Schemas: `TRIP_NAME_MAX_LENGTH`, `TripSchema.name` max + `coverImageUri?`, `TripDetailsInputSchema`, `CreateTripInputSchema.details`; i18n keys `validation.tripNameRequired` / `tripNameTooLong` (pl/en); fixtures. — skill: domain-modeling — tests first: step 1 schema tests — verify: full suite, typecheck, lint.
- [ ] 2. [backend] `defaultTripName` in `src/lib/trip-name.ts`; `buildTrip` takes `name` and `coverImageUri` from `details`. — skill: none — tests first: step 2 — verify: full suite, typecheck, lint.
- [ ] 3. [frontend] Flights step: "Lot tam" / "Powrót" switch, one direction visible, error → switch to the failing tab. — skill: ui-taste (review) — tests first: step 3 — verify: full suite, typecheck, lint, manual check.
- [ ] 4. [frontend] Add `expo-image-picker` (`npx expo install`) + `app.json` plugin; draft `name` / `coverImageUri`; `CoverPicker`; "Nazwa i zdjęcie" card on the summary step. — skill: frontend-design, ui-taste — tests first: step 4 — verify: full suite, typecheck, lint, manual check on device (picker).
- [ ] 5. [frontend] Theme roles for the scrim and on-image text; `TripCard` with the darkened cover. — skill: frontend-design, ui-taste — tests first: step 5 — verify: full suite, typecheck, lint, manual check light/dark.
- [ ] 6. Docs: `CLAUDE.md` Data structures, `GLOSSARY.md`, `Architecture.md`. — skill: none — no tests (docs only) — verify: every statement checked against the code; full suite green.

## Verification
Per step: red seen for the expected reason → green → `pnpm test` (full), `pnpm typecheck`, `pnpm lint` → verifier PASS. No migrations / RLS / AI / sync in this task. Manual steps for Kacper (device): switching tabs, picking a photo on iOS and Android (permission prompt, crop, cancel), the card in light and dark with a bright and a dark photo, large Dynamic Type on the card with a photo.

## Progress log
- (empty)

## Risks & open questions
- **Q1 — Where does the cover photo come from?**
  - A (recommended): from the phone's gallery via `expo-image-picker` (new dependency, official Expo module, works in Expo Go, config plugin for the permission text; no permission prompt needed to open the library per Expo docs). Trade-off: one more native module; picked files live in the app cache, which is fine while trips are in memory (A4).
  - B: a few bundled photos to choose from — no dependency, but we need licensed photos and it is less personal.
  - C: both (gallery + presets) — most work.
- **Q2 — Where do the name and the photo go?**
  - A (recommended): on the summary step, a new first card "Nazwa i zdjęcie" — still 4 steps, and the default "from → to" is already known there.
  - B: a new step "Nazwa i zdjęcie" before the summary — 5 steps, more room, one more tap.
  - C: on step 1, above the switch — the default updates live, but step 1 gets longer again.
- **Q3 — Default name and behaviour.**
  - Format A (recommended): cities with an arrow, "Kraków → Barcelona". B: IATA codes "KRK → BCN". C: cities with a dash "Kraków – Barcelona". (City names are English from the airport list: "Warsaw", "Cracow"/"Krakow" — known limitation.)
  - Behaviour (recommended): the field is pre-filled with the default; until the organizer edits it, it follows changes to the flights; once edited it is kept; an empty field shows an error and blocks saving.
- **Q4 — The darkened card (new theme tokens, not in `design-context.md`).** Recommended: the photo fills the whole card (radius 16dp as today), a scrim `neutral.900` (#17211B) at **55 %** opacity over it in both light and dark mode, and all card text in `neutral.50` (#F7F3EA). New roles `colors.overlay.scrim` and `colors.text.onImage`. Alternative: a gradient scrim (dark only at the bottom) — the photo shows more, but text at the top needs care. Kacper may give other values.
- **Q5 — "Dalej" with an error on the hidden tab.** Recommended: switch to the tab with the first error (outbound first), scroll to the card and announce "Popraw zaznaczone pola" (existing). Alternative: also mark the tab label (e.g. "Powrót · błąd").
- Risk: the picker's file URI is in the app cache; the OS may clear it. Acceptable while data is in memory; must be solved (upload to storage) with Supabase.
- Risk: `app.json` permission text is English only; localising native permission strings needs `expo-localization` locale files — out of scope unless Kacper wants it.
