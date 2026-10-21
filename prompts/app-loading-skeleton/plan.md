# Task: App loading skeleton
Status: done — approved by Kacper 2026-10-21, with assumptions A1–A4

## Understanding & assumptions
When someone signs in on a phone with an existing account, the app shows nothing useful while it loads:
1. After the code is entered the session is ready, but the profile is still being read. The gate (`src/app/_layout.tsx`,
   view `loading`) draws an **empty screen in the background colour**. The splash screen was already hidden on the
   welcome screens, so the user sees a blank screen.
2. When the profile arrives, the home screen reads the trips and shows `TripHeroSkeleton`: **one still grey rectangle**,
   with no sections below it.

"Done" = from the moment the user is signed in until the current trip is shown, they see a pulsing skeleton of the home
screen (hero, menu button, the Flights / Travellers / Budget sections, the navigation pill). It is the same skeleton in the
gate and on the home screen, so nothing jumps when the gate hands over to the app.

Decisions (Kacper, 2026-10-21):
- **D1 — Scope: gate + home screen.** The gate's loading view and the home screen's trip-loading state show the same home
  skeleton. Other tabs (Expenses, Plan, Places) and the side panel are out of scope.
- **D2 — Always the home skeleton in the gate.** Before the profile arrives the app does not know if the account is new.
  The gate always shows the home skeleton; a new account sees it briefly before profile setup.
- **D3 — Pulse like the profile.** Every block uses `SkeletonBlock` (profile-screen D9): opacity 1 → 0.5 → 1 every
  1200 ms, still with reduce motion on. The hero placeholder starts pulsing too. No fade from skeleton to content.

Assumptions (please confirm or correct with the plan):
- **A1 — Cold start unchanged.** On a cold start the splash screen stays while the gate loads (as today); the skeleton
  shows only when the splash is already gone (that is, after signing in). The gate's view is the same in both cases, the
  splash simply covers it on a cold start.
- **A2 — Section placeholders.** Three cards with the `Section` look from `CurrentTrip` (same surface, radius, padding,
  shadow, side padding and max width): a title bar at heading3 height, 40% wide, then body lines at bodyM height:
  Flights 3 lines, Travellers 2 lines. Budget (revised by Kacper 2026-10-21, after step 3): a title row with the title bar
  and, on the right, a block in the place and size of the "Zmień" button; then the amount line at numericL height and two
  body lines at bodyM height. The photo strip is not drawn (a trip may have no
  photos, and drawing it would make the content jump up).
- **A3 — Gate chrome.** The real menu button and pill need the drawer and tabs, which do not exist yet in the gate. The
  gate draws a placeholder in their place: a 44 dp circle where the menu button sits and a pill-shaped block with the
  pill's width, height and position. On the home screen the real menu button and pill stay as they are.
- **A4 — Screen reader.** The gate's view keeps `busy` and gets the label "Wczytywanie" / "Loading" (new key
  `app.loading`). The home screen keeps "Wczytywanie podróży". Every block stays hidden from screen readers.

## Approach
One `HomeSkeleton` component (hero + three sections) used in two places: the home screen's `isPending` state (under the
real menu button and pill) and the gate's `loading` view (with placeholder menu button and pill around it). Built from the
existing `SkeletonBlock`, which gets one optional `radius` prop, because the full-bleed hero has no corners.
Rejected: a separate skeleton screen for the gate only. It would not match the home screen's skeleton, so the content
would jump at the handover.

## Data structures (Zod)
None. The task changes no data, schema or migration.

## Tests
- Step 1: `SkeletonBlock` with `radius` draws that radius; without it, `radius.sm` (unchanged). `TripHeroSkeleton` is a
  pulsing `SkeletonBlock` with the hero's height (`heroHeight`), full width, no radius, hidden from screen readers;
  still with reduce motion on (follow the existing `SkeletonBlock` tests).
- Step 2: `HomeSkeleton` draws the hero skeleton and the three section placeholders (testIDs `home-skeleton-flights`,
  `-travellers`, `-budget`) with the line counts from A2; side padding `spacing[4]` on compact width and `spacing[5]` above
  it, max width `maxContentWidth`; nothing in it is reachable by a screen reader.
- Step 3: home screen while trips load: `trips-loading` contains the hero skeleton **and** the three section placeholders;
  label "Wczytywanie podróży" and `busy` unchanged; the menu button still opens the side panel; the trip replaces it.
- Step 4: gate while the profile loads (signed in, profile pending): `app-loading` shows the home skeleton, the menu button
  placeholder and the pill placeholder; label `app.loading`, `busy`; then an existing account lands on the app, a new
  account on profile setup (D2), a failed read on the error screen. `settle-gate` and the existing gate tests stay green.
  i18n: `app.loading` exists in `pl.json` and `en.json`.

## Files
- `src/components/SkeletonBlock.tsx`, `src/components/__tests__/SkeletonBlock.test.tsx` — `radius` prop (step 1)
- `src/components/TripHeroSkeleton.tsx`, `src/components/__tests__/TripHero.test.tsx` — pulsing hero (step 1)
- `src/features/home/HomeSkeleton.tsx`, `src/features/home/__tests__/HomeSkeleton.test.tsx` — new (step 2)
- `src/app/(drawer)/(tabs)/index.tsx`, `src/__tests__/app/home.test.tsx` — trips-loading state (step 3)
- `src/app/_layout.tsx`, `src/__tests__/app/auth-gate.test.tsx` (or `layout.test.tsx`), `src/i18n/locales/pl.json`,
  `src/i18n/locales/en.json` — gate loading (step 4)
- `Architecture.md` — at the end

## Skills
- `test-driven-development` — steps 1–4 — red → green for every step.
- `frontend-ui-engineering` — steps 2–4 — loading states and screen-reader behaviour, subordinate to design-context §10.18, §12.
- `incremental-implementation` — steps 1–4 — one coherent diff per step.

## Steps
- [x] 1. [frontend] `SkeletonBlock` `radius` prop; `TripHeroSkeleton` pulses — skill: test-driven-development — tests first: Step 1 — verify: verifier, full suite
- [x] 2. [frontend] `HomeSkeleton` (hero + three sections) — skill: test-driven-development, frontend-ui-engineering — tests first: Step 2 — verify: verifier, full suite
- [x] 3. [frontend] Home screen loading state uses `HomeSkeleton` — skill: test-driven-development, frontend-ui-engineering — tests first: Step 3 — verify: verifier, full suite
- [x] 3b. [frontend] Budget card skeleton per revised A2 (title row with button placeholder, amount, two lines) — skill: test-driven-development — tests first: HomeSkeleton.test.tsx — verify: verifier, full suite
- [x] 4. [frontend] Gate loading view shows `HomeSkeleton` + placeholder menu button and pill; `app.loading` — skill: test-driven-development, frontend-ui-engineering — tests first: Step 4 — verify: verifier, full suite, tester on a device if connected

## Verification
Every step: tests red first, then `pnpm typecheck`, `pnpm lint`, `pnpm test` (full suite), then the verifier.
Manual test steps for Kacper / tester (after step 4):
1. Sign out. Sign in with an existing account that has a trip, on a slow network (e.g. emulator network "slow" / 3G).
   After entering the code: no blank screen; a pulsing home skeleton (hero, menu circle, 3 cards, pill), then the trip,
   without the menu button or pill moving.
2. Same with reduce motion on: the skeleton is still.
3. Sign in with a new email: briefly the home skeleton, then profile setup.
4. Light and dark mode: the blocks are neutral.100 / surface.secondary, the cards look like the trip's cards.
5. Cold start of a signed-in user: the splash, then the trip (or the skeleton if trips are still loading).

## Progress log
- Step 1 (2026-10-21, `frontend`): tests written (red ✓: radius ignored, `Expected 0, Received 8`; hero had no width/opacity;
  `withRepeat` never called) · `SkeletonBlock` gained `radius?: number` (default `radius.sm`), `TripHeroSkeleton` is a
  `SkeletonBlock` (full width, `heroHeight`, `radius.none`), unused `View` import removed · the old TripHero test "is a static
  block" renamed and extended (behaviour changed by D3; no assertion removed) · green ✓ · typecheck ✓, lint ✓ · skill used:
  test-driven-development, incremental-implementation. **Not marked done:** verifier FAIL on the full suite only: 2 of 7 runs
  red in `src/__tests__/app/profile.test.tsx` (read-count asserts at :299, :339; one run 19 failed), green in isolation and in
  4 runs. The step's own files passed every check. At the same time another session ("Profile screen plan", steps 6d/6e) was
  editing `profile.test.tsx` and `ProfileScreen.tsx` in this checkout (modified 20:05–20:07 while the runs went), and a second
  one ("Karty ostatnich podróży na profilu") is running here too.
- **D4 (Kacper, 2026-10-21):** steps 2–3 go ahead now (they touch no profile files). Step 1 and the full suite are re-checked
  once the profile sessions finish; step 4 (`_layout.tsx`, also touched by the profile work) waits until then.
- Step 2: the implementer stopped with `Status: question` before writing anything: in dark mode `Section` cards and
  `SkeletonBlock` are both `surface.secondary` (#202A23), so the lines inside the cards would be invisible; the design context
  does not say what to do. **D5 (Kacper, 2026-10-21):** in dark mode only, the blocks inside the three cards are
  `surface.elevated` (#263229); the cards keep `Section`'s look; light mode unchanged. `SkeletonBlock` gets an optional `color`
  prop (default `surface.secondary`), so step 2 also touches `src/components/SkeletonBlock.tsx` and its test.
- Step 2 (2026-10-21, `frontend`): tests written (red ✓: `HomeSkeleton` suite failed on the missing module
  `@/features/home/HomeSkeleton`; `SkeletonBlock` colour test `Expected #263229, Received #202A23`) · new
  `src/features/home/HomeSkeleton.tsx` + test (8 tests), `SkeletonBlock` `color?: string` (default `surface.secondary`) + 1 test
  · one test fixture of the implementer's own fixed mid-step (375 dp is not compact, the breakpoint is 360; now 320 / 375) · not
  wired anywhere yet · green ✓ · typecheck ✓, lint ✓, full suite ✓ (128 suites, 2653 tests) · verifier PASS (its first full run
  had 3 failures only in `profile.test.tsx`, edited by the profile session during the run; rerun green) · skill used:
  test-driven-development, frontend-ui-engineering, incremental-implementation · deviation: `paddingTop: spacing[4]` on the
  column, which stands in for the photo strip's `marginBottom: spacing[4]` in `CurrentTrip` (verifier: correct). Verifier notes
  (non-blocking): the real Budget card has more lines than A2's single numericL line, so it grows when the trip arrives; the
  "no photo strip" test and the dark `elevation.card` assertion cannot fail.
- Step 3 (2026-10-21, `frontend`): tests written (red ✓: `home-skeleton` not found inside `trips-loading`) · the
  `trips.isPending` branch of `src/app/(drawer)/(tabs)/index.tsx` renders `<HomeSkeleton />`, `TripHeroSkeleton` import
  removed, branch comment updated; wrapper, label, busy, menu button and snackbar unchanged · 2 new tests in `home.test.tsx`
  ("loads with the hero skeleton and the three card skeletons…" red → green; "swaps the skeleton for the trip view…" a
  regression guard, green from the start); menu-while-loading already covered (`home.test.tsx:534`, `:557`) · green ✓ ·
  typecheck ✓, lint ✓, full suite ✓ (128 suites, 2655 tests; no profile flake, profile files unchanged during the run) ·
  verifier PASS · skill used: test-driven-development, frontend-ui-engineering, incremental-implementation · verifier note:
  no bottom clearance for the pill (no ScrollView, as approved), so on a short phone the Budget card may sit under the pill —
  check on a device.
- Step 1 re-check (2026-10-21 20:25, orchestrator): typecheck ✓, lint ✓; full suite 3 runs: 1 green (2655/2655), 2 red only in
  `profile.test.tsx` (the D20 "skeleton" tests of profile-screen step 6e: that session was writing them, file modified 20:25:42,
  `ProfileScreen.tsx` 20:26:48). The profile work is not finished, so per D4 step 1 stays `[ ]` and step 4 waits.
- **Plan change (Kacper, 2026-10-21):** the verifier noted the Budget skeleton (one numericL line) is shorter than the real card
  (title + "Zmień" button, amount, totals line, sync indicator). Kacper: match it, title with room for the button, the amount
  and two lines. A2 revised; new step 3b (touches only `HomeSkeleton.tsx` and its test).
- Step 3b (2026-10-21, `frontend`): tests written (red ✓: 4 failed / 8 passed: no `home-skeleton-action`, Budget had 1 line)
  · `Card` draws its title in `Section`'s header row and takes an optional `action`: a block `home-skeleton-action`,
  `size.buttonCompact` tall (the ghost `TextButton`'s min height), 20% wide (the real width depends on the label); Budget =
  action + numericL 50% + bodyM 70% + bodyM 45%; Flights/Travellers unchanged · the old Budget line-count expectation went
  from 1 to 3: a requirement change by Kacper, not a weakening · green ✓ (12/12) · typecheck ✓, lint ✓, full suite ✓ (verifier
  run: 128 suites, 2665 tests; the implementer's own run had 1 failure only in `profile.test.tsx`, the profile session's 6e
  red phase) · verifier PASS · skill used: test-driven-development · `SkeletonBlock.tsx` mtime 20:29:19 checked by the
  orchestrator: content is unchanged (only the step 1 `radius` and step 2 `color`). Not drawn: the `SyncIndicator` row, shown
  only when the budget is pending/failed.
- Step 1 closed (2026-10-21 20:44–20:49, orchestrator): Kacper said the profile session had finished. A first full-suite batch
  still failed only in `profile.test.tsx` (the file was being edited at 20:44 and 20:46); after the profile session went idle:
  typecheck ✓, lint ✓, full suite 3/3 green (128 suites, 2668 tests). Step 1 marked `[x]`.
- Step 4 (2026-10-21, `frontend`): tests written (red ✓: `AppLoading.test.tsx` failed on the missing module
  `@/features/auth/AppLoading`; the 5 new gate tests failed because `home-skeleton` was not inside the old empty `app-loading`)
  · new `src/features/auth/AppLoading.tsx` (root `app-loading`, busy, label `app.loading`; `HomeSkeleton`; `app-loading-menu`,
  a 44 dp round block where `HeroMenuButton` sits; `app-loading-pill` with `PillNav`'s geometry), `Gate` renders it for
  `loading` (splash unchanged, A1), comment above `Gate` updated, unused `View` import removed; `app.loading` "Wczytywanie" /
  "Loading" (the existing pl/en key-parity test covers it) · 11 AppLoading tests + 5 gate tests (`auth-gate.test.tsx`, new
  describe "the loading view while the profile is read": pending → skeleton; existing profile → app; null → profile setup
  (D2); failure → `profile-error`); no existing test changed; one of the implementer's own fixtures fixed mid-step (360 dp is
  not compact) · green ✓ · typecheck ✓, lint ✓, full suite ✓ (verifier: 129 suites, 2689 tests) · verifier PASS · skill used:
  test-driven-development, frontend-ui-engineering, incremental-implementation.
- **D6 (Kacper, 2026-10-21):** the menu and pill placeholders are drawn over the hero skeleton, where the default block colour
  would not show, so they use `colors.border` (light neutral.200, dark #39443B). The implementer chose it and the verifier
  flagged it; Kacper kept it (no new token). The comment in `AppLoading.tsx` that overstated it ("the one colour") reworded.

## Risks & open questions
- **Depends on uncommitted profile-screen work.** `SkeletonBlock` (and its test) is still untracked, part of the
  profile-screen task in progress on `feature/profile-screen`. This task builds on it, so it runs on this branch after
  that work; step 1 adds only the `radius` prop to it.
- The side panel's skeleton rows stay still (no pulse); out of scope by D1.
