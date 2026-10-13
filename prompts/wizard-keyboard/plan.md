# Task: Keyboard must not cover the field being typed in (trip wizard)
Status: done

## Understanding & assumptions
- **Problem (Kacper, 2026-10-13):** on the wizard's first step (`src/app/trips/new/index.tsx`, "Loty"), tapping
  "Numer lotu" opens the keyboard over the field, so the user cannot see what they type.
- **Cause:** `WizardScreen` (`src/features/trip-create/WizardScreen.tsx`) renders a plain `View` → `ScrollView` +
  a bottom action. Nothing reacts to the keyboard: no `KeyboardAvoidingView`, no keyboard insets on the
  `ScrollView`. The only keyboard handling in the app is in `BottomSheet` (`KeyboardAvoidingView`,
  `behavior="padding"` on iOS).
- **Done means:** on every wizard step, when a text field gets focus, the keyboard adds space at the bottom of
  the screen (the content area shrinks by the keyboard height) and the focused field scrolls into view above the
  keyboard. When the keyboard hides, the layout returns to what it is today.
- **A1 (confirmed, Q1):** the fix goes into `WizardScreen`, so all four wizard steps get it
  (flights, friends, budget, summary — friends and budget also have text fields). Not only the flights step.
- **A2 (confirmed, Q2 = A):** the bottom action ("Dalej") moves up with the keyboard and stays visible
  right above it (the keyboard "pushes" the whole screen up, as Kacper described: padding).
- **Assumption A3:** no data changes. No Zod schema, migration or SQLite change.
- **Out of scope:** other screens (home, drawer, `BudgetSheet` — it already has its own keyboard avoiding),
  a "Next field" keyboard toolbar, dismissing the keyboard on scroll.

## Approach
Wrap the content of `WizardScreen` (the `ScrollView` and the bottom action) in React Native's
`KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`, as the Expo keyboard
handling guide recommends and as `BottomSheet` already does (on Android the default `adjustResize` resizes the
window by itself). On top of that, turn on `automaticallyAdjustKeyboardInsets` on the wizard's `ScrollView`
(iOS) so the focused field is scrolled into view when it would still be hidden after the padding (e.g. the
flight number at the bottom of a long card). If the native header makes the padding too small or too large on
iOS, pass `keyboardVerticalOffset` = header height (`useHeaderHeight`), checked in the simulator.

Rejected: `react-native-keyboard-controller` (`KeyboardAwareScrollView`). It works better but it is a new
native dependency, and the built-in components are enough for one form screen.

## Data structures (Zod)
None. This is layout only; no data shape changes.

## Tests
Jest cannot show a real keyboard, so tests check the wiring; the look is checked by hand (Verification).

Step 1 — `src/features/trip-create/__tests__/WizardScreen.test.tsx` (new), written first and seen failing:
- On iOS (`Platform.OS` = `'ios'`, jest-expo default), `WizardScreen` renders a `KeyboardAvoidingView` with
  `behavior="padding"` that contains **both** the step content (a test child) **and** the bottom action
  button (so "Dalej" moves up with the keyboard).
- On Android (`Platform.OS` mocked to `'android'`), the `KeyboardAvoidingView` has no `behavior`
  (the window resize does the work).
- The wizard's `ScrollView` has `automaticallyAdjustKeyboardInsets` set and still has
  `keyboardShouldPersistTaps="handled"` (regression: taps on buttons still work while the keyboard is open).
- Without `action`, the `KeyboardAvoidingView` still wraps the content (summary-like steps).

Existing suites that must stay green without edits: `src/__tests__/app/trips/new/*.test.tsx`
(flights, friends, budget, summary, layout — e.g. the "scroll to the first error" test in flights uses the same
`ScrollView` ref).

## Files
- Modified: `src/features/trip-create/WizardScreen.tsx`
- New: `src/features/trip-create/__tests__/WizardScreen.test.tsx`
- After the task: `Architecture.md` (one line on `WizardScreen` keyboard handling + changelog)

Not touched: the uncommitted work already in the tree (`src/schemas/trip-details.ts`, `src/data/*`, …).

## Skills
- `test-driven-development` — step 1 — red → green for the wiring tests.
- `source-driven-development` — step 1 — `KeyboardAvoidingView` / `automaticallyAdjustKeyboardInsets` checked
  against the Expo keyboard handling guide and React Native 0.86 docs; cited in the progress log.
- `frontend-ui-engineering` — step 1 — keyboard + focus behavior on a form screen, accessibility unchanged.

## Steps
- [x] 1. [frontend] `WizardScreen` avoids the keyboard — skill: test-driven-development, source-driven-development,
  frontend-ui-engineering — tests first: `WizardScreen.test.tsx` (above) — verify: full `pnpm test`,
  `pnpm typecheck`, `pnpm lint` green; verifier PASS; manual check on the iOS simulator (steps below).

## Verification
Automated: `pnpm test` (full suite), `pnpm typecheck`, `pnpm lint`.

Manual (iOS simulator, then Android if available), for Kacper:
1. Home → "Nowa podróż" → step "Loty". Tap "Numer lotu" in segment 1.
   Expect: the keyboard opens, the field and what you type are visible above it, "Dalej" sits right above the
   keyboard.
2. "Dodaj przesiadkę", then tap "Numer lotu" in segment 2 (lower on the screen). Expect: the screen scrolls so
   the field is visible.
3. Hide the keyboard. Expect: "Dalej" goes back to the bottom, no empty gap left.
4. With the keyboard open, scroll the form up and down. Expect: all fields reachable, nothing cut off at the top.
5. Repeat the "type in a field" check on "Znajomi" (a friend's name) and "Budżet" (amount).
6. Dark mode: no white strip between content and keyboard.

## Decisions (Kacper, 2026-10-13)
- D1 (Q1): all wizard steps, via `WizardScreen`.
- D2 (Q2): option A — "Dalej" moves up and stays right above the keyboard.
- D3 (Q3): the bug is seen on both Android and iOS, so the step is checked on both before it is done.
- Plan approved 2026-10-13.
- D4 (Q4): `behavior="padding"` on both platforms and `keyboardVerticalOffset` = header height approved; Kacper
  checked it on Android ("działa na androidzie") and asked to finish the task. The plan's Android test
  (`behavior` undefined) no longer applies, so it is not written; Android is covered by Kacper's device check.

## Risks & open questions
- **Q1 (scope, answered D1):** fix all wizard steps via `WizardScreen` (recommended) or only the flights step?
- **Q2 ("Dalej" while typing, answered D2):** (A, recommended) the button moves up and stays above the keyboard — always
  reachable, but less room for the form on small phones; or (B) the button stays under the keyboard and only
  the form scrolls — more room for the form, "Dalej" visible after closing the keyboard.
- **Q3 (platform, answered D3):** did you see it on iOS, Android, or both? Android with edge-to-edge may need
  `behavior="height"` instead of `undefined`; that would be checked on a device before marking the step done.
- **Risk:** `KeyboardAvoidingView` under a native stack header can be off by the header height on iOS
  (gap or still covered). Mitigation: `keyboardVerticalOffset` from the header height, decided in the
  simulator and logged here.
- **Q4 (Android, answered D4):** the plan said no `behavior` on Android (the window resizes itself). But the bug is seen
  on Android (D3), and RN 0.86 / Expo 57 Android runs edge-to-edge, where the window is not resized for the
  keyboard, so `undefined` would most likely leave it covered. Proposal: `padding` on both platforms + a Jest
  test for Android (`Platform.OS = 'android'`, `keyboardDidShow` → bottom padding), confirmed on an Android
  device by Kacper.
- **Risk:** tests check only the wiring; the real result is confirmed by the manual steps.

## Progress log
- Step 1 (in progress, not `[x]`): tests written in `src/features/trip-create/__tests__/WizardScreen.test.tsx`
  (red ✓: 4 failing, no `wizard-screen` / `wizard-scroll`; one harness fix — the fake `layout` event needed
  `persist()`). `WizardScreen.tsx`: root `View` → `KeyboardAvoidingView` (`behavior="padding"`,
  `keyboardVerticalOffset={useHeaderHeight()}`), ScrollView `automaticallyAdjustKeyboardInsets`. Green ✓ (4/4).
  Mutation check: offset 0 → both padding tests fail, so they cover the header offset. Full suite 790/790,
  typecheck ✓, lint ✓ (one earlier full run had 1 failure each in `flights.test.tsx` and `app/layout.test.tsx`;
  both passed alone and in two later full runs — looks like a flake under load, not caused by this step).
  Sources: Expo keyboard handling guide (KAV `padding` on iOS); RN `KeyboardAvoidingView` docs ("setting
  `behavior` is recommended on both iOS and Android"); RN 0.86 source `KeyboardAvoidingView.js`
  `_relativeKeyboardHeight` (overlap from the onLayout frame, relative to the parent → header offset needed).
  Skill used: test-driven-development, source-driven-development.
  **Deviations (approved by Kacper as D4):** (1) `behavior="padding"` on Android too, not `undefined`; (2)
  `keyboardVerticalOffset` = header height always (planned as "only if needed"). Verifier: FAIL — process
  (deviation not approved, no Android test). Manual check on devices: not done (no native build / Android
  emulator on this Mac).
- Step 1 done (2026-10-13): Kacper approved the deviations and confirmed the fix on Android (D4); the verifier's
  FAIL was about the missing approval and the obsolete Android test, both resolved by D4. Verifier's own run on
  this code: typecheck ✓, lint ✓, full suite 790/790 ✓. Manual iOS check (Verification 1–6) not reported
  yet. `Architecture.md` updated.
