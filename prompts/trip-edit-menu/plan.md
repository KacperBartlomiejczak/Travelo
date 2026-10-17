# Task: Trip edit menu (⋮)
Status: done (2026-10-15) — all steps `[x]`; steps 2, 6, 8 and manual 12 on Kacper's confirmation (see the last progress entry)

## Understanding & assumptions
Kacper wants a **three-vertical-dots button** (lucide `EllipsisVertical`, from `lucide-react-native` 1.50, checked in
`node_modules`) on the trip screen. It opens the actions for the open trip. Order: feature 2 of 4
(`prompts/trips-drawer/plan.md` D1); trips-drawer is done, so this plan is unblocked.

**Done means:** on the home screen's trip view, ⋮ in the top-right corner of the hero opens a bottom sheet with three
actions: „Nazwa i zdjęcie” (edit name and cover in a sheet), „Zmień budżet” (the existing budget sheet) and „Usuń
podróż” (confirmation sheet → server delete → home shows the default trip or the empty state, plus a snackbar
„Podróż usunięta.”). Offline, the name/cover and delete items are disabled with a short explanation; budget stays
enabled (it works offline).

Assumptions (to confirm with the plan):
- **A1** — ⋮ is shown only on the trip view (`CurrentTrip`), not in the loading, empty or error states. It is shown
  also when the trip comes from the phone's copy (offline), because the budget item works offline.
- **A2** — The edit form is the same shape as the wizard's „Nazwa i zdjęcie” card: name (trimmed, 1–60 chars) and an
  optional cover. `TripDetailsInputSchema` is reused as is; no new schema.
- **A3** — Removing the cover writes `cover_image_uri = null` on the server (D12).
- **A4** — Name/cover and delete are plain Supabase table calls under the RLS policies that already exist
  (owner update / owner delete, `20261006090351_trips.sql:104-110`). No migration, no RPC. Cascades remove members and
  flight segments (`:25`, `:47`).
- **A5** — After a delete, the phone forgets everything it kept for that trip: its overview copy, the chosen-trip
  row (if it was this trip), a pending budget change for it, and its entry in the list copy. A pending budget change is
  dropped on purpose: the trip is gone, so syncing it would only fail (`budget-sync.ts:49`).
- **A6** — Only one sheet is open at a time. Choosing an item closes the menu sheet first, then opens the next sheet
  (no Modal on top of a Modal).
- **A7** — The ⋮ menu replaces nothing: the existing „Zmień budżet” button in the budget section stays.
- **A8** — Proposed copy (Kacper approves with the plan, can change it):

  | key | PL | EN |
  |---|---|---|
  | `tripMenu.open` (⋮ label) | Opcje podróży | Trip options |
  | `tripMenu.title` | Podróż | Trip |
  | `tripMenu.editDetails` | Nazwa i zdjęcie | Name and photo |
  | `tripMenu.changeBudget` | Zmień budżet | Change budget |
  | `tripMenu.delete` | Usuń podróż | Delete trip |
  | `tripMenu.offlineHint` | Bez internetu nie zmienisz nazwy ani nie usuniesz podróży. | You need internet to rename or delete the trip. |
  | `tripDetails.title` | Nazwa i zdjęcie | Name and photo |
  | `tripDetails.save` | Zapisz | Save |
  | `tripDetails.saveError` | Nie udało się zapisać. Spróbuj ponownie. | Couldn't save. Try again. |
  | `deleteTrip.title` | Usunąć podróż „{{name}}”? | Delete trip “{{name}}”? |
  | `deleteTrip.body` | Znikną loty, uczestnicy i budżet. Tego nie da się cofnąć. | Flights, members and budget will be gone. This can't be undone. |
  | `deleteTrip.confirm` | Usuń podróż | Delete trip |
  | `deleteTrip.cancel` | Anuluj | Cancel |
  | `deleteTrip.error` | Nie udało się usunąć podróży. Spróbuj ponownie. | Couldn't delete the trip. Try again. |
  | `deleteTrip.deleted` | Podróż usunięta. | Trip deleted. |

## Decisions (Kacper, 2026-10-08)
- **D1 — Menu items in this task:**
  - change the trip's **name and cover photo**;
  - change the **budget** (opens the existing budget sheet, which works offline);
  - **trip photos** (the entry point; the photos themselves are `prompts/trip-photos/plan.md`);
  - **delete the trip**.
- **D2 — Budget meaning.** "Aktualizowanie budżetu" in the original request turned out to mean *adding expenses*. That is `prompts/expenses/plan.md`, not this feature. Here "budget" is only the existing change of the budget per person.

## Decisions (Kacper, 2026-10-14)
- **D3 — Menu form:** a bottom sheet with a list of actions (thumb zone), built on the existing `BottomSheet`.
- **D4 — Placement:** the ⋮ button sits in the top-right corner over the cover photo, mirroring the menu button (`HeroMenuButton`, `HeroIconButton` style).
- **D5 — Name and cover editing:** in a bottom sheet. Offline, the menu item is disabled with a short explanation (trips are server-first); no save attempt offline.
- **D6 — Trip photos entry:** hidden until `prompts/trip-photos/plan.md` ships it. The menu has three items in this task: name and cover, budget, delete.
- **D7 — Delete confirmation:** a bottom sheet. Title „Usunąć podróż „{name}”?”, body „Znikną loty, uczestnicy i budżet. Tego nie da się cofnąć.”, a destructive „Usuń podróż” button and „Anuluj”, not adjacent (design-context §5). English copy in A8.
- **D8 — Delete is online only:** like D5, the item is disabled offline with an explanation. No offline delete queue (offline scope unchanged).
- **D9 — After delete:** the home screen shows the default trip (`trips-drawer` A1), or the empty state when no trip is left, plus a short „Podróż usunięta.” message.
- **D10 — Destructive button:** looks like the secondary button (transparent, 1dp border, pressed background as secondary), only the label is in the `error` token. No new colors.
- **D11 — Snackbar (design-context §10.16 gives size, placement and timing, not colors):** inverse: light mode background `neutral.900`, text `neutral.50`; dark mode background `neutral.50`, text `neutral.900`. Min height 48dp, max width 360dp, bottom safe-area + 16dp, auto-dismiss 3500 ms. No new primitive colors.
- **D12 — Cover can be removed** in the edit sheet, as in the wizard (`CoverPicker` already supports it).
- **Plan approved** by Kacper on 2026-10-14 ("Akceptuję plan trip-edit-menu"), including A1–A8 and the copy in A8.
- **D14 (2026-10-14) — Snackbar shape:** `radius.md` (12dp), text Body M, padding 16dp; fades in and out over
  180 ms (§9 "small transition"), no animation with reduced motion.
- **D15 (2026-10-14) — Menu rows:** list rows per §10.8 (min 64dp, 16dp horizontal padding, press feedback
  `surface.secondary`), each with a lucide icon + label: `Pencil` „Nazwa i zdjęcie”, `Wallet` „Zmień budżet”,
  `Trash2` „Usuń podróż”. The delete row's icon and label use the `error` token (like D10) and a 1dp divider separates
  it from the other two. Disabled rows (offline) use `text.tertiary`; the offline hint is shown under the list only
  when offline.
- **D13 (Q1, 2026-10-14) — a delete that finds the trip already gone is a success:** the phone forgets its copies
  and the snackbar shows. Implementation: when the server deletes 0 rows, the repository checks whether the trip is
  still visible; not visible → success + `forgetTrip`; still visible (not the owner) → error, copies kept. This
  changes step 1's "0 rows on delete → reject"; done as a step 1 follow-up before step 2.

## Approach
- **Data (step 1):** add two methods to `TripRepository`: `updateDetails(tripId, input)` and `delete(tripId)`.
  Supabase: `update({ name, cover_image_uri })` / `delete()` on `trips` filtered by id, after `signedIn()`; a network
  failure throws `ServerUnreachableError` like the rest. `update` asks for the changed row back (`.select('id')`) so
  „no row changed” (deleted elsewhere, not the owner) becomes an error instead of a silent success. After a delete,
  `LocalStore.forgetTrip(tripId)` removes the trip's local rows in one SQLite transaction (A5). The in-memory
  repository gets the same two methods for tests.
- **Server (step 2):** no schema change. SQL tests in `supabase/tests/trips_rls.sql` add the owner's side, which is
  missing today: the owner can update name and cover (and set cover to null), and the owner's delete removes the
  trip's members and flight segments (cascade). These are characterization tests: the policies already exist, so they
  pass on first run (see Tests).
- **Hooks (step 3):** `useUpdateTripDetails` and `useDeleteTrip` in `src/hooks/useTrips.ts`, default `networkMode`
  (online; the UI disables them offline anyway). On success they invalidate `['trips']` so the hero, the side panel
  and the home screen refetch; after a delete the current trip query is reset so `current()` falls back to the
  default trip (it already forgets a chosen trip that is gone, `supabase-trip-repository.ts:80-89`).
- **UI building blocks (step 4):** `TextButton` gets a `destructive` variant (D10). New `Snackbar` component with two
  semantic tokens `colors.snackbar.background` / `colors.snackbar.text` (D11), auto-dismiss 3500 ms, announced to
  screen readers.
- **Menu (step 5):** `TripMenuButton` (⋮, `HeroIconButton`, top-right, mirrors `HeroMenuButton`). `CurrentTrip` owns
  one `sheet` state (`'menu' | 'details' | 'budget' | 'delete' | null`); the budget section's local `changing` state
  moves up into it, so both the „Zmień budżet” button and the menu open the same `BudgetSheet`. `TripMenuSheet` lists
  the three items; offline, items 1 and 3 are disabled and the offline hint is shown under them.
- **Edit (step 6):** `TripDetailsSheet` — `TextField` (name, max 60) + `CoverPicker` + full-width „Zapisz”, validated
  with `TripDetailsInputSchema`, the same error keys as the wizard. Success closes the sheet; error stays inline.
- **Delete (step 7):** `DeleteTripSheet` — title with the name, body, destructive „Usuń podróż” and „Anuluj” separated
  (D7). Success: the home screen shows the snackbar „Podróż usunięta.” and whatever `current()` returns next (default
  trip or empty state). The snackbar lives in the home route (`src/app/(drawer)/index.tsx`), not in `CurrentTrip`,
  because `CurrentTrip` unmounts when no trip is left.

Rejected: one sheet that swaps its content between menu / edit / delete (no Modal hand-off, but one component with
four jobs); we start with separate sheets and one-at-a-time (A6), and switch only if the device check shows a problem
(see Risks).

## Data structures (Zod)
No new or changed schemas.
- Edit form and `updateDetails` input: existing `TripDetailsInputSchema` (`src/schemas/create-trip-form.ts:120-128`):
  `{ name: string (trimmed, 1–60), coverImageUri?: string (min 1) }`. Missing `coverImageUri` = no cover → `null`
  on the server (A3).
- Rows written: `trips.name`, `trips.cover_image_uri` (already mirrored: `20261006090351_trips.sql:10-11`).
- `delete(tripId)`: the id comes from an already parsed `TripSummary`; no new payload shape.
- Interface sketch (`src/data/trip-repository.ts`):
  ```ts
  /** Changes the trip's name and cover on the server; online only (D5). */
  updateDetails(tripId: string, input: z.input<typeof TripDetailsInputSchema>): Promise<void>;
  /** Deletes the trip on the server, then forgets the phone's copies of it (A5); online only (D8). */
  delete(tripId: string): Promise<void>;
  ```
  `LocalStore.forgetTrip(tripId: string): Promise<void>`.

## Tests
Written first in every step, run, seen failing for the missing behavior.

**Step 1 — data**
- `src/data/__tests__/supabase-trip-repository.test.ts` (fake Supabase + node SQLite):
  - `updateDetails` sends `update({ name, cover_image_uri })` on `trips` with `eq('id', tripId)`; name is trimmed.
  - no cover → `cover_image_uri: null`.
  - invalid name (empty / 61 chars) rejects with a Zod error and sends nothing.
  - server returns no row → rejects (not a silent success).
  - network failure → `ServerUnreachableError`.
  - `delete` sends `delete()` on `trips` with `eq('id', tripId)`, then the trip's overview copy, chosen-trip row,
    pending budget change and list entry are gone; another trip's copies are untouched.
  - server error on delete → rejects and the phone's copies are untouched.
- `src/data/__tests__/local-store.test.ts`: `forgetTrip` removes the four kinds of rows for that trip only; on an
  unknown id it does nothing.
- `src/data/__tests__/trip-repository.test.ts` (in-memory): `updateDetails` changes name/cover seen by `current()` and
  `list()`; `delete` removes the trip, the next `current()` returns the default trip, or null when none is left.

**Step 2 — server (characterization, pass on first run)**
- `supabase/tests/trips_rls.sql`: owner A updates name and cover, and sets cover to null; owner A's delete removes the
  trip and its `trip_members` and `flight_segments` rows. Existing B/C denial tests unchanged. These do not go red
  first because they cover policies that already exist; this is named here so it is approved, not a TDD gap.
  Mutation check instead: temporarily drop the cascade expectation (assert members remain) → the test must fail.

**Step 3 — hooks** (`src/hooks/__tests__/useTrips.test.tsx`)
- `useUpdateTripDetails` calls `repository.updateDetails` and then `current` / `list` are refetched with the new name.
- `useDeleteTrip` calls `repository.delete`; afterwards the current trip query shows the default trip.
- error from the repository surfaces as `isError`, no refetch of a stale success.

**Step 4 — building blocks**
- `src/components/__tests__/TextButton.test.tsx` (new or existing): `destructive` label uses `colors.status.error`
  (or the existing semantic name), border and pressed background as `secondary`; light and dark.
- `src/components/__tests__/Snackbar.test.tsx`: shows the message with snackbar tokens (light and dark), min height 48,
  max width 360, bottom = safe-area + 16; hides itself after 3500 ms (fake timers); announces the message.
- `src/theme` test (existing theme test if any): both themes define `snackbar.background` / `snackbar.text`.

**Step 5 — menu** (`src/__tests__/app/home.test.tsx`)
- the trip view shows a button labelled „Opcje podróży” (not in loading / empty / error).
- pressing it opens a sheet with „Nazwa i zdjęcie”, „Zmień budżet”, „Usuń podróż” and no photos item (D6).
- „Zmień budżet” in the menu closes the menu and opens the budget sheet; the budget section's own button still works
  (regression on the existing budget tests, unedited).
- offline (`setNetwork({ isConnected: false })`): „Nazwa i zdjęcie” and „Usuń podróż” are disabled
  (`accessibilityState.disabled`), the offline hint is shown, „Zmień budżet” is enabled.
- i18n parity test stays green with the new keys (pl/en).

**Step 6 — edit** (`home.test.tsx` + `src/features/home/__tests__/TripDetailsSheet.test.tsx`)
- the sheet opens with the trip's current name and cover.
- saving a new name calls `updateDetails` with the trimmed name, closes the sheet, the hero shows the new name.
- empty name / 61 chars → the wizard's validation message, no call.
- removing the cover → `updateDetails` without `coverImageUri`.
- repository error → inline `tripDetails.saveError`, the sheet stays open with the typed values.

**Step 7 — delete** (`home.test.tsx` + `src/features/home/__tests__/DeleteTripSheet.test.tsx`)
- the confirmation shows the trip's name in the title, the body, „Usuń podróż” and „Anuluj”, not adjacent.
- „Anuluj” closes it without calling `delete`.
- „Usuń podróż” calls `delete`; the home screen then shows the default trip and the snackbar „Podróż usunięta.”.
- deleting the last trip → empty state and the snackbar.
- repository error → inline `deleteTrip.error`, nothing removed, the sheet stays open.

## Files
- Modified: `src/data/trip-repository.ts`, `src/data/supabase-trip-repository.ts`, `src/data/local-store.ts`,
  `src/hooks/useTrips.ts`, `src/components/TextButton.tsx`, `src/theme/theme.ts`, `src/features/home/CurrentTrip.tsx`,
  `src/app/(drawer)/index.tsx`, `src/i18n/locales/pl.json`, `src/i18n/locales/en.json`,
  `supabase/tests/trips_rls.sql`.
- New: `src/components/Snackbar.tsx`, `src/features/home/TripMenuButton.tsx`, `src/features/home/TripMenuSheet.tsx`,
  `src/features/home/TripDetailsSheet.tsx`, `src/features/home/DeleteTripSheet.tsx`, their tests.
- Tests modified: `src/data/__tests__/{supabase-trip-repository,local-store,trip-repository}.test.ts`,
  `src/hooks/__tests__/useTrips.test.tsx`, `src/__tests__/app/home.test.tsx` (repository mock gets the two new
  methods), `src/components/__tests__/TextButton.test.tsx`.
- After the task: `Architecture.md`, `GLOSSARY.md` only if a new term appears (none planned).

## Skills
- `test-driven-development` — every step — red → green.
- `api-and-interface-design` — step 1 — the two repository methods and `forgetTrip`.
- `security-and-hardening` + `doubt-driven-development` — steps 1–2 — deleting data and the owner-only RLS path.
- `source-driven-development` — steps 1, 3 — supabase-js `update().select()` / `delete()` behavior, TanStack Query
  invalidation; cited in the progress log.
- `frontend-ui-engineering` — steps 4–7 — sheets, disabled states, accessibility.
- `ui-taste` — verifier, steps 5–7 — visual polish against design-context.

## Steps
- [x] 1. [backend] Repository: `updateDetails`, `delete`, `LocalStore.forgetTrip` (Supabase + in-memory) — skill:
  test-driven-development, api-and-interface-design, security-and-hardening, doubt-driven-development,
  source-driven-development — tests first: step 1 — verify: full `pnpm test`, `pnpm typecheck`, `pnpm lint`; verifier.
- [x] 2. [backend] SQL tests for the owner's update and delete (cascade) — skill: doubt-driven-development — tests:
  step 2 (characterization + mutation check) — verify: `pnpm test:db` if a local Supabase is running, otherwise the
  run is a manual step for Kacper; verifier.
- [x] 3. [frontend] Hooks `useUpdateTripDetails`, `useDeleteTrip` — skill: test-driven-development,
  source-driven-development — tests first: step 3 — verify: full suite, typecheck, lint; verifier.
- [x] 4. [frontend] `TextButton` destructive variant + `Snackbar` + snackbar tokens — skill: test-driven-development,
  frontend-ui-engineering — tests first: step 4 — verify: full suite, typecheck, lint; verifier.
- [x] 5. [frontend] ⋮ button, menu sheet, budget sheet lifted, offline disabling, i18n — skill:
  test-driven-development, frontend-ui-engineering — tests first: step 5 — verify: full suite, typecheck, lint;
  verifier (+ ui-taste); tester on a device if connected (manual 1–4).
- [x] 5b. [frontend] Swipe down closes every bottom sheet (D18, added 2026-10-14) — skill:
  debugging-and-error-recovery (root cause first), test-driven-development, frontend-ui-engineering — tests first:
  `src/components/__tests__/BottomSheet.test.tsx` (new cases; existing ones unedited): a downward drag that starts on
  the sheet's top (handle **or** title) moves the sheet with the finger (`translateY` = drag distance, never above
  its resting place); release past 60dp → `onClose`; release before → the sheet goes back to 0 and stays open
  (no `onClose`); a sideways or upward move does not move or close the sheet; a tap on the title is still not a close; with
  reduce motion the sheet still follows the finger but goes back without animation; the cause found on the device is
  covered by a regression test where Jest can express it — verify: full suite, typecheck, lint; verifier; tester on
  the emulator (Verification 2, both the menu and the budget sheet); Kacper on his phone.
- [x] 6. [frontend] Edit name and cover sheet — skill: test-driven-development, frontend-ui-engineering — tests
  first: step 6 — verify: full suite, typecheck, lint; verifier; tester (manual 5–7).
- [x] 7. [frontend] Delete confirmation, snackbar after delete — skill: test-driven-development,
  frontend-ui-engineering — tests first: step 7 — verify: full suite, typecheck, lint; verifier; tester (manual 8–11).
- [x] 7b. [frontend] The delete sheet cannot be dismissed while the delete runs (PR #10 review, 2026-10-15; approved
  by Kacper 2026-10-15, without TripDetailsSheet) — skill: test-driven-development, frontend-ui-engineering — tests first: see "PR #10 review" below —
  verify: full suite, typecheck, lint; verifier; tester (manual 12) if the emulator is connected.
- [x] 8. [tester] Device run of the whole feature (Kacper, 2026-10-14) — the `tester` agent drives the app on the
  connected Android emulator (`Medium_Phone_API_37.0`, via the `mobile-mcp` server in `.mcp.json`) and walks manual
  steps 1–12 below (12 added by step 7b) plus the snackbar checks from step 4 (look in light / dark, ~3.5 s auto-hide, reduced motion);
  only test data, no real personal data — skill: none (no code; the tester reports PASS / FAIL per scenario with
  screenshots) — verify: every scenario PASS; a FAIL goes back to the step's implementer, then the tester re-runs
  the failed scenarios. iPhone checks stay with Kacper (no iOS device here).

## Verification
Automated after every step: `pnpm test` (full), `pnpm typecheck`, `pnpm lint`; step 2 also `pnpm test:db`.

Manual (device, Kacper or the tester agent):
1. Home with a trip → ⋮ in the top-right of the photo, same size and style as ☰ on the left; with and without a cover
   photo; light and dark.
2. ⋮ → the sheet shows three items, none for photos; swipe down / scrim closes it.
3. Menu → „Zmień budżet” → the menu closes and the budget sheet opens (no flicker or stuck sheet on iOS and Android).
4. Airplane mode → ⋮ → „Nazwa i zdjęcie” and „Usuń podróż” are greyed out with the hint; „Zmień budżet” works.
5. „Nazwa i zdjęcie” → change the name → „Zapisz” → the hero and the side panel show the new name.
6. Change the cover, then remove it → the hero shows the photo, then the no-photo version.
7. Clear the name → the validation message; type 61 characters → the field stops at 60.
8. „Usuń podróż” → the confirmation with the trip's name; „Anuluj” keeps the trip.
9. Delete a trip when you have others → the default trip opens and „Podróż usunięta.” shows for ~3.5 s above the
   bottom edge.
10. Delete the last trip → the empty state „Utwórz podróż” and the snackbar.
11. Snackbar in dark mode: light background, dark text.
12. (step 7b) „Usuń podróż” → right after tapping it, while the buttons are greyed: tap the scrim, press back, swipe
    the header down past 60dp → the sheet stays (a swipe springs back). Needs a slow network to have time for it.

## Risks & open questions
- **Modal hand-off (A6):** opening a sheet right after closing another can fail on iOS (one Modal still dismissing).
  Mitigation: open the next sheet on the closing sheet's dismiss; if the device check still fails, the fallback is
  one sheet that swaps its content — a plan change for Kacper.
- **Server `update` and RLS:** a row the user cannot update returns 0 rows, not an error; covered by asking the row
  back (step 1). A linked viewer (read-only) would only reach this if viewer trips show up on the home screen; today
  every user is anonymous and sees only own trips.
- **Cover URIs are device-local** (Architecture known limitation): editing the cover keeps that limitation; upload to
  Storage stays a later task.
- **Step 2 needs a database:** `pnpm test:db` needs `DB_URL` (local Supabase). If none is running here, Kacper runs
  it; the step is not `[x]` until it ran green.
- **Snackbar placement** when the home screen has the pinned offline banner at the bottom: the snackbar sits above it
  (§10.16 "above bottom navigation if present"); delete is online-only, so both are rarely visible together.

- **Residual race (step 3 verifier, N7):** `cancelQueries` drops an in-flight trips fetch from the query cache, but
  the repository call keeps running and can write the deleted trip back into the SQLite copies after `forgetTrip`.
  Effect: rare, and only offline afterwards — the deleted trip can show from the copy until the next online list
  fetch prunes it. Not fixed in this task; raised with Kacper as a known limitation.
- **Q1 (answered D13):** the server deleted the trip but the phone failed to clean its copies (rare,
  disk error) → the user sees „Nie udało się usunąć podróży”, and a retry finds no row on the server. Options:
  (A, recommended) a retry that finds the trip already gone counts as success: the phone forgets its copies, the
  snackbar shows; (B) keep the error; the copies disappear by themselves on the next list refresh.

## PR #10 review (CodeRabbit, 2026-10-15) — step 7b
**Decision (Kacper, 2026-10-15) — D22:** approved with the `dismissible` prop; `TripDetailsSheet` stays out of scope.

**Comment** (`src/features/home/DeleteTripSheet.tsx:32`, Minor): `pending` disables both buttons, but the backdrop,
the swipe and the Android back button still call `onClose`. Dismissed during the delete, a failed delete is only
announced to a screen reader; no inline error stays. Proposed code, as attached to the comment:

```diff
-    <BottomSheet visible title={t('deleteTrip.title', { name: trip.name })} onClose={onClose}>
+    <BottomSheet visible title={t('deleteTrip.title', { name: trip.name })} onClose={pending ? () => {} : onClose}>
```

**Verdict: valid.** Checked in the code: `BottomSheet` calls `onClose` from the backdrop (`BottomSheet.tsx:77`),
`onRequestClose` (`:70`) and the swipe release (`:63`), none of them knows about `pending`. Closing unmounts
`DeleteTripSheet` (`CurrentTrip.tsx:88`); on failure only `announceForAccessibility` runs (`DeleteTripSheet.tsx:28`),
so a sighted user sees the trip still there and no message. The step 7 verifier already logged it as non-blocking.

**Why not the attached code as-is:** with a no-op `onClose`, a swipe past 60dp while pending calls the no-op instead
of `settle()` (`BottomSheet.tsx:63`), so the sheet stays pulled down where the finger let go until the next touch.
Backdrop and back would be fixed; the swipe would leave a stuck sheet.

**Approach (recommended):** `BottomSheet` gets an optional `dismissible` prop (default `true`, so every other sheet
is unchanged). When `false`: backdrop and back do nothing, a swipe still follows the finger but always springs back
like a short drag (release → `settle()`). `DeleteTripSheet` passes `dismissible={!pending}`. Rejected: the no-op
`onClose` (stuck swipe, above); calling `settle()` after every `onClose` (changes the device-checked D18 close for
every sheet).

Sketch:
```tsx
// BottomSheet.tsx
type Props = { visible: boolean; title: string; onClose: () => void; dismissible?: boolean; children: ReactNode };
const close = dismissible ? onClose : () => {};             // backdrop + onRequestClose
onPanResponderRelease: (_, g) => (latest.current.dismissible && pulled(g) > SWIPE_TO_CLOSE ? latest.current.onClose() : settle()),
// DeleteTripSheet.tsx
<BottomSheet visible dismissible={!pending} title={...} onClose={onClose}>
```

**Tests first (red before code):**
- `src/components/__tests__/BottomSheet.test.tsx` (new cases, existing ones unedited): `dismissible={false}` → a
  backdrop tap does not call `onClose`; the back button does not call `onClose`; a swipe released past 60dp does not
  call `onClose` and the sheet goes back to 0; switching `dismissible` back to `true` during the life of the sheet
  closes again through the latest value (the gesture is created once, so it must read it from `latest`).
- `src/features/home/__tests__/DeleteTripSheet.test.tsx`: while the delete is pending, backdrop and back do not call
  `onClose`; after the delete fails, the inline error is visible and backdrop closes again.

**Files:** `src/components/BottomSheet.tsx`, `src/features/home/DeleteTripSheet.tsx`, the two test files; after the
step `Architecture.md` (BottomSheet entry) if it lists the component's behavior.

**Out of scope (noted, not fixed):** `TripDetailsSheet` (`:47`, `:65`) has the same pattern while saving; Kacper
decided to leave it out (D22).

## Progress log
- Step 1 (2026-10-14), by the `backend` agent: tests written first (red ✓: 29 failing, all "is not a function"
  for the missing methods). `TripRepository` + in-memory: `updateDetails`, `delete`
  (`src/data/trip-repository.ts`); Supabase (`src/data/supabase-trip-repository.ts`): `updateDetails` =
  `update({ name, cover_image_uri: coverImageUri ?? null }).eq('id').select('id')`, `delete` =
  `delete().eq('id').select('id')`, 0 rows → `Error('trip-not-found')`, local copies forgotten only after a server
  success; `LocalStore.forgetTrip` (`src/data/local-store.ts`) removes the overview copy, chosen-trip row, pending
  budget change and list entry in one `begin`/`commit` transaction (rollback on error). Tests: 16 in
  `supabase-trip-repository.test.ts`, 6 in `local-store.test.ts`, 7 in `trip-repository.test.ts`; typecheck-only
  additions in `TripsDrawer.test.tsx` and `useTrips.test.tsx`. Three of the agent's own new tests had wrong fixture
  ids at first green; fixed, no assertion weakened. Green ✓; full suite 789/789 (65 suites), typecheck ✓, lint ✓
  (implementer and verifier). No schema, dependency or server change. `fake-supabase.ts` unchanged.
  Skill used: test-driven-development, api-and-interface-design, security-and-hardening, doubt-driven-development,
  source-driven-development. Source: postgrest-js 2.117.2 types (`update`/`delete` return a filter builder;
  `.select()` after them returns the affected rows; plain `delete()` is 204 with no data), same pattern as
  `budget-sync.ts:32-41`.
  Decision inside the brief: delete asks the row back so a 0-row delete (RLS hides a trip that is not the user's)
  never makes the phone forget a trip that still exists.
  Verifier: PASS. Non-blocking notes: (N1) raw `begin`/`commit` on the shared expo-sqlite connection — a concurrent
  write inside the window is rolled back too if `forgetTrip` fails (same pattern as `migrateLocalDb`); (N2) server
  delete succeeds but `forgetTrip` fails → UI says "couldn't delete", a retry gets 0 rows → `trip-not-found` until
  the next list fetch prunes the copies — asked Kacper (Q1 below); (N3) `forgetTrip` calls `this.cachedList()`
  (breaks if destructured); (N4) redundant `selectedId = null` in the in-memory `delete`; (N5) one vacuous
  assertion in the offline `updateDetails` test, `ServerUnreachableError` checked by `constructor.name`; (N7) for
  step 3: an in-flight `current()`/`list()` can write the deleted trip back into SQLite after `forgetTrip` →
  `useDeleteTrip` must `cancelQueries(['trips'])` before invalidating.
- Step 1 follow-up (2026-10-14, D13), by the `backend` agent: `delete` on 0 deleted rows checks
  `select('id').eq('id').maybeSingle()`: not visible → success + `forgetTrip`; still visible →
  `Error('trip-not-deletable')`, copies kept; check error → `failure()` (offline → `ServerUnreachableError`), copies
  kept. In-memory `delete` of an unknown id resolves. N3 (`cachedList` closure helper, no `this`), N4 (redundant
  reset removed), N5 (offline `updateDetails` test caches first) fixed. Tests changed by D13 (not weakened): the
  Supabase "rejects when the server deleted no row" test → a describe with 3 cases (gone → success, still visible →
  rejects, check offline → unreachable); the in-memory "rejects deleting an unknown trip" → resolves. Red ✓ (4
  failing for the old behavior) → green ✓. Full suite 791/791 (65 suites), typecheck ✓, lint ✓ (implementer and
  verifier). Verifier: PASS. Still open from step 1: N1 (raw `begin`/`commit`), N7 (for step 3: `cancelQueries`
  before invalidating after a delete). `trip-not-deletable` is shown in the UI as the generic delete error.
- Step 2 (2026-10-14, written, not `[x]`), by the `backend` agent: `supabase/tests/trips_rls.sql:298-345`, section
  "Owner A edits and deletes a trip": dedicated trip `…e1` (one member, one segment) via `create_trip`; A updates
  name + cover; A sets cover to null (name unchanged); A deletes → after `reset role`, 0 rows in `trips`,
  `trip_members`, `flight_segments` for it; the fixture trip `…001` keeps 1 trip / 3 members / 3 segments.
  Additions only; B/C denial tests untouched. Characterization tests (approved to pass on first run). Not run:
  this machine has no `psql`, Docker or `DB_URL`. Verifier: PASS by reading (syntax, every check through
  `test_helpers.ok`, role switching, fixture counts, no collision with later assertions). Notes: add a
  `logout()` at the end of the block for clarity (behavior already correct, the next section logs out first);
  the cascade mutation check runs with the DB run. Skill used: doubt-driven-development.
  **Pending for Kacper:** `DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db` (needs
  local Supabase running and `psql` on PATH). Step 2 gets `[x]` only after it runs green.
- 2026-10-14: Kacper allowed step 3 to start before step 2's DB run ("rób krok 3 równolegle"); step 2 gets `[x]`
  after his green `pnpm test:db`.
- Step 3 (2026-10-14), by the `frontend` agent: `src/hooks/useTrips.ts` — `useUpdateTripDetails` (`({ tripId, input })`
  → `updateDetails`, default online `networkMode`, `onSuccess` returns `invalidateQueries(['trips'])`) and
  `useDeleteTrip` (`onMutate` returns `cancelQueries(['trips'])` (N7); `onSuccess` returns `resetQueries(current)` +
  `invalidateQueries(list)`; default online `networkMode`). Tests in `useTrips.test.tsx` (`setup` got an optional
  `queryClient`): update shows the new name in current + list; update error → `isError`, name kept; delete →
  default trip, list loses it, current goes through pending (never the deleted trip); last trip → null / `[]`;
  delete error → `isError`, trip kept; `cancelQueries` runs before `repository.delete`. Red ✓ (6 failing:
  hooks not exported) → green ✓. Full suite 797/797 (65 suites), typecheck ✓, lint ✓ (implementer and verifier).
  Source: installed `@tanstack/query-core` 5.104.1 `mutation.ts` (awaits `onMutate` and `onSuccess`; mutations
  default to `networkMode: 'online'`). Skill used: test-driven-development, source-driven-development.
  Verifier: PASS. Fixed after the verifier: an unrelated whitespace edit (`type SetBudget = {`) reverted; the
  `onMutate` comment no longer overclaims; a test now catches invalidate-instead-of-reset on the current trip
  (mutation checked: swap → fails). Deviation in wording only: delete resets current + invalidates list instead of
  "invalidate `['trips']`" — same queries, the reset keeps the deleted trip off the screen (like `useSelectTrip`).
  Open (non-blocking gaps): no test that the update's `onSuccess` is awaited, none that both hooks pause offline
  (the UI disables them, step 5).
- 2026-10-14: Kacper asked for a step in which the `tester` agent runs on the device through `mobile-mcp`. Step 7 is
  the delete confirmation (needed before the whole feature can be tested), so it was added as step 8.
- Step 4 (2026-10-14, not `[x]`), by the `frontend` agent: `TextButton` `destructive` (D10), `colors.snackbar`
  (D11), tokens `size.snackbarMinHeight` / `snackbarMaxWidth` (§10.16) and `duration.small` 180 (§9.1), new
  `Snackbar` (D14). Tests: 4 TextButton, 11 Snackbar, 3 theme; red ✓ → green ✓; full suite 815/815 (66 suites),
  typecheck ✓, lint ✓. Verifier: FAIL — (1) blocker: auto-dismiss 3500 ms hardcoded in `Snackbar.tsx`, not a token;
  (2) major: the snackbar only calls `onHide`, it does not hide itself as the plan's step 4 tests say;
  non-blocking: double announcement on Android (`announceForAccessibility` + live region). Sent back to the same
  implementer for all three.
- Step 4, second round: fixes 1–3 done (token `duration.snackbarAutoDismiss` 3500, self-hiding, live region removed;
  817/817). Re-verify: FAIL — the self-hide state (`dismissed`) drops the same text shown twice (step 7's second
  "Podróż usunięta.") unless the owner clears it, and the component grew three state flags. Orchestrator decision
  (deviation in the plan's step 4 wording, no visible change for Kacper): the Snackbar is controlled — it calls
  `onHide` after 3500 ms and the owner clears `message`, then it fades out; "hides itself after 3500 ms" is tested
  through a small owner in the test. Sent back to the implementer (attempt 3 of 3 on this problem).
- Step 4, third round: the `frontend` agent simplified `Snackbar` to the controlled contract (state: `rendered`,
  `reduceMotion`; `dismissed`/`last`/`faded` removed). Tests: two no-op-owner self-hide tests removed (they asserted
  the dropped contract) and replaced by an `Owner` harness: gone after 3500 ms + fade; gone at once with reduce
  motion; same text again → shown and announced again, hides again; different text → shown. Full suite 819/819
  (66 suites), typecheck ✓, lint ✓ (implementer and verifier). Verifier: PASS on the code; process gate: the
  contract change is a deviation from the plan's step 4 wording ("hides itself") and needs Kacper's approval
  before `[x]` — asked. Carried non-blocking notes: JS animation driver, reduce-motion subscription duplicated from
  `BottomSheet`, `reduceMotion` starts `false` for one frame.
- 2026-10-14: Kacper approved the Snackbar contract change ("Zatwierdzam zmianę kontraktu snackbara (ekran czyści
  komunikat w onHide)"). Step 4 marked `[x]`. Skill used: test-driven-development, frontend-ui-engineering.
  Step 7 must own `message` in the home route and clear it in `onHide`.
- Step 5 (2026-10-14, not `[x]`), by the `frontend` agent: `TripMenuButton` (⋮, mirrors `HeroMenuButton` on the
  right), `TripMenuSheet` (D15 rows, `minHeight` `spacing[16]` = 64 like `TripsDrawer`, no new token), `CurrentTrip`
  owns one `sheet` state, `Budget` gets `onChangeBudget`, `tripMenu.*` keys (A8). Tests: 9 in `TripMenuSheet.test.tsx`,
  13 in `home.test.tsx` (red ✓: 9 failing on the missing button), existing tests unedited. Full suite 841/841 (67
  suites), typecheck ✓, lint ✓ (implementer and verifier). Verifier: FAIL — blocker: menu → budget is a same-render
  Modal swap, not A6's "close the menu first, then open" (the orchestrator's brief asked for the simplest switch
  first — the deviation should have gone to Kacper). Notes: rows inset 36dp vs title 20dp and a square pressed
  block; comment in `CurrentTrip.tsx` claims the menu "closes before"; a test name claims top-right placement
  without asserting it.
- **D16 (Kacper, 2026-10-14) — A6 deviation approved for now:** the same-render swap stays; the device decides
  (tester on the Android emulator, Kacper on the iPhone, Verification 3). If it flickers or hangs, switch to
  "close the menu, then open" (needs an `onDismiss` in `BottomSheet`).
- **D17 (Kacper, 2026-10-14) — row inset:** decided after Kacper sees the menu on the device (tester screenshot).
- Step 5 re-verify: the comment now says the Modals swap in one render (D16); the "top right" test asserts the
  placement (mutation right → left fails). Verifier: PASS (841/841, typecheck ✓, lint ✓).
- Step 5 device run (2026-10-14), `tester` agent on the Android emulator (Expo Go, Metro on 8081, UI in English):
  created a test trip "Warsaw → Barcelona" (WAW → BCN 2026-10-30, return 2026-11-03, TEST123, 1000 PLN, no cover,
  no companions — the wizard has only a traveller count, so no friend "Test"). Results: 1 ⋮ placement PASS (same
  size and inset as ☰, fixed while scrolling; the trip view is always dark by design, A4 of
  trip-flight-tabs-name-cover); 2 menu content PASS, backdrop and Android back close it, **swipe down did not close
  it** (also not the budget sheet — the shared `BottomSheet`, unchanged by this task; emulator input or a real
  bug, to check on a phone); 3 menu → budget hand-off PASS (frames at ~150 ms: menu, then only the budget sheet, no
  overlap — D16 holds on Android); 4 offline PASS; 6 interim close PASS. D17 screenshots copied to
  `prompts/trip-edit-menu/screens/`. No crash or red box. Expo's own "Cannot connect to Expo CLI" toast appeared in
  airplane mode.
- **D17 answered (Kacper, 2026-10-14): rows stay as they are** (icons at 36dp, title at 20dp, square pressed block).
- 2026-10-14: Kacper checked swipe down on his phone: it does not close the sheet there either („przeciągnięcie w dół
  też nic nie da”). So `BottomSheet`'s swipe-to-close (PanResponder on the 20dp handle strip,
  `src/components/BottomSheet.tsx:36-45`, `:73`) is broken on real devices — a pre-existing bug (the component is
  from trips-supabase; Architecture.md already lists "Swipe-to-close on the sheet is not covered by an automated
  test"), not caused by this task. Asked Kacper whether to fix it inside this plan.
- **D18 (Kacper, 2026-10-14) — fix swipe-to-close in this plan, as step 5b before step 6:** the sheet follows the
  finger while dragged down from its top (handle and title, not only the thin handle strip); released past the
  threshold it closes, otherwise it springs back. Built with React Native `Animated` / `PanResponder`, no new
  dependency. Applies to every `BottomSheet` (menu, budget, and the coming edit and delete sheets).
- Step 5 marked `[x]` (2026-10-14): code verified (PASS), device scenarios 1, 3, 4, 6 PASS on the emulator; the
  swipe-down failure in scenario 2 is the pre-existing `BottomSheet` bug, moved to step 5b. Skill used:
  test-driven-development, frontend-ui-engineering.
- Step 5b, attempt 1 (2026-10-14), by the `frontend` agent: root-cause hypothesis — the old drag View (no
  background) was flattened out of the native tree, so only the 4dp handle could start a drag; plus the
  PanResponder was rebuilt on parent re-renders (inline `onClose`). Fix: header View (`collapsable={false}`,
  handle + title) with one PanResponder (created in an effect, `onClose` from a ref), sheet `Animated.View` with
  `translateY`, spring back over `duration.small`, close past 60dp, instant with reduce motion. 14 new tests (a
  `finger()` helper drives the real PanResponder handlers); red 13/14 → green 22/22; full suite 855/855, typecheck ✓,
  lint ✓. Verifier: PASS (code). **Tester on the emulator: FAIL** — the sheet does not move at all on a drag from the
  handle or the title, long drags don't close it (menu and budget sheet, with and without keyboard); taps, backdrop
  and back work. Orchestrator checked the new code is loaded (`bottom-sheet-header` present as a native view), so
  flattening was not the only cause. Sent back to the same implementer to debug on the emulator with logs (attempt 2
  of 3).
- Step 5b, attempt 2 (2026-10-14), same `frontend` agent, debugged on the emulator with temporary logs (removed):
  **real cause — RN's `<Modal>` host claims every touch at its start** (`react-native/Libraries/Modal/Modal.js:347`,
  `_shouldSetResponder` returns true, `:366-369`); once a responder exists, moves are only offered to the common
  ancestor (`ReactFabric-dev.js`, `accumulateTwoPhaseDispatchesSingleSkipTarget`), so the header's
  `onMoveShouldSetPanResponder` was never asked. Log: start-should-set → false, then no move/grant/release while ~40
  `touchMove` events reached JS. Same on iOS (shared Modal.js). Fix: the header PanResponder claims at start
  (`onStartShouldSetPanResponder: () => true`); `onMoveShouldSetPanResponder` and the 8dp slop removed; a
  `pulled(gesture)` helper counts only downward, mostly vertical drags (sideways/upward moves are claimed but do
  nothing). Test helper rewritten to negotiate the responder like RN, every swipe test renders under a `modal-host`
  stand-in that claims at start; regression test: the header is the responder after touch down. Red 14/16 → green
  24/24; full suite 857/857, typecheck ✓, lint ✓. Implementer's emulator captures: follows the finger, springs back,
  closes (menu and budget sheet, also with the keyboard open). Verifier: PASS (cause confirmed in RN source;
  claiming at start does not affect content below the header). Plan wording of step 5b adjusted from "does not take
  the gesture" to "does not move or close the sheet" (same visible behavior). Open notes: comment in
  `BottomSheet.tsx:96-98` contradicts itself about Android; a 1–3dp jitter on a tap visibly follows the finger and
  springs back (device check). Waiting for the tester re-run; Kacper's iPhone check still open.
- Step 5b tester re-run (2026-10-14, Android emulator, held-finger captures): all 8 scenarios PASS — the menu and
  budget sheets follow the finger from the first pixel, spring back after a short drag (~74 px), close after a long
  drag from the handle or the title, also with the keyboard open; upward/sideways drags and a title tap do nothing;
  backdrop and back close; rows work. Observation: once, a blue "Refreshing…" banner showed on the home screen
  behind the sheet (also seen in the step 5 run when the budget sheet opened) — not caused by the sheet as far as
  known; noted for the home screen. Remaining gate before `[x]`: Kacper's check on his phone.
- Step 5b: the `BottomSheet.tsx` header comment reworded (no contradiction about Android; comment only). Orchestrator
  re-ran the full suite: 857/857 (67 suites), typecheck ✓, lint ✓. Waiting for Kacper's phone check before `[x]`.
- 2026-10-14: Kacper checked step 5b on his phone („arkusz podąża za palcem, wraca i zamyka się”). Step 5b marked
  `[x]`. Skill used: debugging-and-error-recovery, test-driven-development, frontend-ui-engineering.
- Step 6 (2026-10-14, not `[x]`), by the `frontend` agent: new `TripDetailsSheet` (built like `BudgetSheet`):
  `TextField` (name, max 60) + `CoverPicker` (removal allowed, D12) + full-width `PrimaryButton` „Zapisz” with
  loading; `TripDetailsInputSchema` validation with the wizard's messages; input built explicitly (`{ name }` when
  the cover is removed — Zod keeps an `undefined` key otherwise); success closes, error inline + announce, values
  kept; offline: save disabled + `tripMenu.offlineHint` (D5). `CurrentTrip` renders it for `'details'`;
  `tripDetails.*` keys (A8). **Deviation (layout only, verifier: no approval needed):** the form sits in a
  `ScrollView` (`keyboardShouldPersistTaps="handled"`) with the button outside it, so „Zapisz” stays reachable with
  the keyboard and a tall cover preview. Tests: 12 new in `TripDetailsSheet.test.tsx`; in `home.test.tsx` the step 5
  interim „Nazwa i zdjęcie closes the menu” replaced by "opens the details sheet prefilled" (plan behavior), the
  „Usuń podróż” interim kept; new "saving a new name → hero shows it". Red ✓ → green ✓; full suite 870/870 (68
  suites), typecheck ✓, lint ✓ (implementer and verifier). Verifier: PASS. Non-blocking: double announcement on a
  save error (same as `BudgetSheet`); the 60-char test checks only `maxLength`.
  Tester (emulator): 1 sheet prefilled PASS; 2 rename → hero and side panel PASS; 4 empty name message and stop at
  60 chars PASS; 6 swipe PASS; 7 offline disable + hint PASS; 8 test trip restored to "Warsaw → Barcelona", no cover
  PASS. **Not verified:** 3 cover set/remove (the emulator gallery is empty, nothing downloaded) and 5 the keyboard
  (the emulator draws no soft keyboard) — need Kacper's phone. Note: one Save tap during restore did not register
  while Expo's LogBox overlay was on screen; the second did.
- 2026-10-14: Kacper started step 7 before his phone check of step 6 (cover, keyboard); step 6 gets `[x]` after his
  result.
- **D19 (Kacper, 2026-10-14) — delete sheet buttons:** full width, stacked: „Usuń podróż” (destructive, D10) first,
  16dp gap, „Anuluj” (secondary) below it, nearest the thumb.
- Step 7 (2026-10-14, not `[x]`), by the `frontend` agent: new `DeleteTripSheet` (title with the name, body,
  destructive „Usuń podróż” above „Anuluj”, gap `spacing[4]`, D19; confirm = `mutateAsync(trip.id).then(onDeleted)`
  because per-call `mutate` callbacks are dropped once the component unmounts — `@tanstack/query-core` 5.104.1
  `mutationObserver.ts:243`, `:135`; the reset of the current trip unmounts `CurrentTrip` during the delete; pending
  disables both buttons; error inline + announce; offline: confirm disabled + hint). `HomeScreen` owns the snackbar
  message, `CurrentTrip` gets `onDeleted`, `<Snackbar>` rendered in all four states; on the trip view it sits inside
  `DarkThemeScope`, so it uses the dark-theme snackbar (light pill) on the always-dark trip view even on a light
  phone. `deleteTrip.*` keys (A8). Tests: 8 in `DeleteTripSheet.test.tsx`; `home.test.tsx`: the step 5 interim
  „Usuń podróż closes the menu” replaced by „opens the confirmation (D7)” (plan behavior), new describe "deleting the
  trip" (8: cancel, unmount path with a deferred `current()`, last trip → empty + snackbar, auto-dismiss and the same
  text again, error, offline, snackbar theme per state, English); mutation check: per-call `onSuccess` fails the
  unmount test. Red ✓ → green ✓; full suite 886/886 (69 suites), typecheck ✓, lint ✓ (implementer and verifier).
  Verifier: PASS (code), asks Kacper to confirm the D11 reading on the trip view. Non-blocking: double announcement
  of the delete error (live region + announce); the sheet can be dismissed while the delete is in flight.
  Tester (emulator): all scenarios PASS — sheet layout (gap ≈16dp), cancel, swipe, back, offline disable + hint,
  delete with another trip left (default trip shown, snackbar in the tree, side panel without it), delete the last
  trip (empty state + dark snackbar, readable, gone after ~3.5 s). Not captured visually: the snackbar on the dark
  trip view; dark-mode empty-state snackbar not run. Observation: on the empty state the snackbar covers the
  „Utwórz podróż” button for ~3.5 s. Test trips restored to one "Warsaw → Barcelona". The wizard has no flight
  number field on this path (TEST456 not entered).
- **D20 (Kacper, 2026-10-14) — D11 clarified:** the snackbar is always the inverse of the screen behind it: light
  pill on the always-dark trip view (also on a light phone), dark pill on the light empty / loading / error screens.
- **D21 (Kacper, 2026-10-14) — snackbar above the CTA:** on the empty state the snackbar sits above the
  „Utwórz podróż” button (§10.16 "above bottom navigation if present"), not over it; on the trip view it stays at the
  bottom edge.
- Step 7 follow-up (D20, D21): `Snackbar` got an optional `bottomOffset` (default 0); the home route passes
  `size.buttonPrimary + spacing[3]` on the empty / error state, so the snackbar sits 12dp above „Utwórz podróż”;
  trip view and loading unchanged. `DeleteTripSheet` error: live region dropped, announced once. Tests: Snackbar
  offset, home "above the pinned button" (delta check), delete error announced once; red ✓ → green ✓; full suite
  888/888, typecheck ✓, lint ✓. Verifier: PASS. Not handled (rare, delete is online-only): if the connection drops
  within 3.5 s of a delete, the snackbar overlaps the offline banner (the Risks line "sits above it" is not
  implemented). Step 7 marked `[x]`. Skill used: test-driven-development, frontend-ui-engineering.
- Step 8 (2026-10-14), `tester` on the Android emulator, Verification 1–11 in one pass: no FAIL. PASS — placement
  (no cover), menu content, swipe on the menu / budget / delete sheets, menu → budget hand-off (D16), offline
  disabling, rename trimmed → hero and side panel, empty name and 60-char limit, delete sheet + cancel, delete with
  another trip → default trip + snackbar (light pill on the dark trip view, D20), delete the last trip → empty state
  + snackbar above „Create trip” (≈33 px gap, D21) in light (dark pill) and dark (light pill). NOT RUN on the
  emulator: cover photo (no image) and the soft keyboard (not drawn) — Kacper's phone, same as step 6. Screenshots
  copied to `prompts/trip-edit-menu/screens/` (`delete-sheet`, `snackbar-dark-trip-view`, `snackbar-empty-light`,
  `snackbar-empty-dark`). Test data: the tester also deleted and recreated the test trip "Warsaw → Barcelona" (new
  id, same data) to reach the empty state. Step 8 stays `[ ]` until Kacper's phone check of the cover and keyboard.
- Step 7b (2026-10-15), by the `frontend` agent (PR #10 review, D22): `BottomSheet` optional `dismissible` (default
  `true`): when `false`, a local `dismiss()` ignores the backdrop and `onRequestClose` (still passed, so Android's Modal
  keeps a handler), and the swipe release reads `latest.current.dismissible` and `settle()`s instead of closing.
  `DeleteTripSheet` passes `dismissible={!pending}`. Tests: `BottomSheet.test.tsx` nested "when not dismissible" (6:
  backdrop, back, swipe past 60dp springs back, same with reduce motion, true → false locks, false → true closes
  again), `sheetWith` gained an optional 4th argument; `DeleteTripSheet.test.tsx` 2 (pending: backdrop and back do not
  close; after a failure the error shows and the backdrop closes). Red ✓: 6 failed, all "Expected number of calls: 0";
  the 2 tests of today's behavior (false → true, close after failure) passed before, as regression guards. Green:
  69 suites / 896 tests, typecheck ✓, lint ✓ (implementer and verifier). Verifier: PASS. Non-blocking: (1) while
  locked the backdrop still reads as a "Zamknij" button that does nothing (brief, only during a delete); (2) true →
  false is asserted for the swipe only; (3) an `act()` warning in `DeleteTripSheet.test` (baseline not checked).
  Tester: blocked — Expo Go on the emulator had no dev server (Metro not running), so manual 12 did not run; it joins
  step 8's remaining device checks. Deviation: none in code; the device check moved to step 8. For the final
  `Architecture.md` update: `BottomSheet` `dismissible`, and drop the stale "Swipe-to-close … not covered by an
  automated test" line (covered since step 5b). Step 7b marked `[x]`. Skill used: test-driven-development,
  frontend-ui-engineering.
- Step 7b device re-run (2026-10-15, `tester`, Android emulator, Travelo started by Kacper from Metro
  `exp://192.168.5.179:8081`): A (menu and budget sheets close by backdrop, back, swipe) PASS; B (delete sheet, not
  pending, closes by all three) PASS; C (manual 12, dismiss while the delete is pending) NOT TESTABLE — the delete
  finished inside one command batch, faster than the tools can act, so the lock could not be observed. Caveat: Expo
  showed "Cannot connect to Expo CLI" toasts, so the tester could not confirm the working-tree bundle was loaded (A and
  B behave the same in old and new code). Test data: the tester created and deleted "Warsaw → Barcelona"; the emulator
  now has no trips. Screenshot: `screens/7b-c-after-batch-empty-state.png`. Manual 12 stays open for step 8: Kacper checks it on
  his phone on a slow network (decided 2026-10-15), together with the cover and keyboard checks.
- Closing (2026-10-15): Kacper confirmed that the remaining checks are done ("Tak, wszystko sprawdziłem"):
  `pnpm test:db` green (step 2), the cover and keyboard on his phone (step 6, step 8) and manual 12 on a slow network
  (step 7b). Those runs were his, not repeated here; their output is not in this log. Steps 2, 6, 8 marked `[x]` on his
  word. Before closing, the orchestrator ran `pnpm test` (69 suites, 896 tests), `pnpm typecheck` and `pnpm lint`: all
  green. `Architecture.md` updated for the whole feature (incl. `BottomSheet` `dismissible` and the stale swipe line).
- Later check (2026-10-15, during trip-photos): local Supabase started on this machine (`pnpm supabase start`).
  `supabase/tests/trips_rls.sql`, including this feature's step 2 checks, was run through the database container's
  `psql` and printed "trips_rls: all checks passed". `supabase gen types` matched `src/data/database.types.ts`.
