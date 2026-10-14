# Task: Keyboard must not cover the field being typed in (trip wizard)
Status: in progress — steps 1–3 code done and verified (verifier PASS for 2 and 3); waiting for Kacper's device checks (iPhone 1–8, Android 8–9, D3) before `[x]`

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
- **Out of scope:** other screens (home, drawer), a "Next field" keyboard toolbar, dismissing the keyboard on
  scroll. `BudgetSheet` was out of scope until D5 (2026-10-14): Kacper sees the keyboard cover it on Android,
  so it is step 3.

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

Step 2 (proposed, option B of Q5) — `src/features/trip-create/__tests__/WizardScreen.test.tsx`, written first and
seen failing:
- The wizard's `ScrollView` does **not** set `automaticallyAdjustKeyboardInsets` and still has
  `keyboardShouldPersistTaps="handled"`. This replaces the step 1 assertion `automaticallyAdjustKeyboardInsets`
  = `true`: the assertion was right for the approved step 1, and the Q5 decision makes it wrong (logged).
- iOS: after `keyboardDidShow`, a focused field whose bottom is below the visible part of the scroll view is
  scrolled into view: `scrollTo` puts the field's bottom plus spacing at the bottom of the visible part
  (above "Dalej").
- iOS: a focused field that is already fully visible → no scroll.
- iOS: no focused text field when the keyboard shows → no scroll, no error.
- Android (`Platform.OS` = `'android'`): no scroll call (Android stays as Kacper checked it, D4).

Step 3 (proposed, D5) — `src/components/__tests__/BottomSheet.test.tsx` (existing, new cases), written first and
seen failing:
- Android (`Platform.OS` = `'android'`): after `keyboardDidShow` with a 300 tall keyboard at the bottom of the
  screen, the part of the sheet that makes room for the keyboard gets `paddingBottom` 300 and contains the title,
  the content and the sheet itself; after `keyboardDidHide` the padding is back to 0. Today it fails: no
  `behavior` on Android, so no padding.
- iOS: the same with `keyboardWillShow` / `keyboardWillHide` (regression: iOS keeps working as today).
- The existing cases (title, handle, scrim, close on backdrop / back button, reduce motion) stay green unedited.

Existing suites that must stay green without edits: `src/__tests__/app/trips/new/*.test.tsx`
(flights, friends, budget, summary, layout — e.g. the "scroll to the first error" test in flights uses the same
`ScrollView` ref).

## Files
- Modified: `src/features/trip-create/WizardScreen.tsx`
- New: `src/features/trip-create/__tests__/WizardScreen.test.tsx`
- Step 3: modified `src/components/BottomSheet.tsx` (`behavior="padding"` on both platforms, a `testID` on the
  `KeyboardAvoidingView`) and `src/components/__tests__/BottomSheet.test.tsx` (new cases only)
- After the task: `Architecture.md` (one line on `WizardScreen` keyboard handling + changelog)

Not touched: the uncommitted work already in the tree (`src/schemas/trip-details.ts`, `src/data/*`, …).

## Skills
- `test-driven-development` — step 1 — red → green for the wiring tests.
- `source-driven-development` — step 1 — `KeyboardAvoidingView` / `automaticallyAdjustKeyboardInsets` checked
  against the Expo keyboard handling guide and React Native 0.86 docs; cited in the progress log.
- `frontend-ui-engineering` — step 1 — keyboard + focus behavior on a form screen, accessibility unchanged.

## Steps
- [ ] 1. [frontend] `WizardScreen` avoids the keyboard — skill: test-driven-development, source-driven-development,
  frontend-ui-engineering — tests first: `WizardScreen.test.tsx` (above) — verify: full `pnpm test`,
  `pnpm typecheck`, `pnpm lint` green; verifier PASS; manual check on the iOS simulator (steps below).
- [ ] 2. [frontend] iOS: one keyboard adjustment instead of two (Q5, option B, proposed) — skill:
  test-driven-development, source-driven-development — tests first: step 2 tests (above) — verify: full
  `pnpm test`, `pnpm typecheck`, `pnpm lint` green; verifier PASS; manual check 1–7 on Kacper's iPhone (this
  machine is Windows, no iOS simulator), which also closes step 1's iOS check (D3); Android check 1–5 repeated
  once to confirm nothing changed there.
- [ ] 3. [frontend] The budget sheet (and every `BottomSheet`) moves above the keyboard on Android (D5, proposed)
  — skill: test-driven-development, source-driven-development — tests first: step 3 tests (above) — verify:
  full `pnpm test`, `pnpm typecheck`, `pnpm lint` green; verifier PASS; manual check 8–9 on Kacper's Android
  phone and 8 once on the iPhone.

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
7. (step 2, iOS) With the keyboard open, scroll to the end of the form. Expect: no empty space about the
   keyboard's height below the last field, and the focused field is never hidden behind "Dalej".
8. (step 3) Home → change the budget → tap the amount. Expect: the whole sheet sits right above the keyboard,
   the amount and "Zapisz budżet" are visible, nothing is cut off at the top of the sheet.
9. (step 3) Hide the keyboard. Expect: the sheet goes back to the bottom of the screen, no gap below it.

## Decisions (Kacper, 2026-10-13)
- D1 (Q1): all wizard steps, via `WizardScreen`.
- D2 (Q2): option A — "Dalej" moves up and stays right above the keyboard.
- D3 (Q3): the bug is seen on both Android and iOS, so the step is checked on both before it is done.
- Plan approved 2026-10-13.
- D4 (Q4): `behavior="padding"` on both platforms and `keyboardVerticalOffset` = header height approved; Kacper
  checked it on Android ("działa na androidzie") and asked to finish the task. The plan's Android test
  (`behavior` undefined) no longer applies, so it is not written; Android is covered by Kacper's device check.
- D5 (Q6, 2026-10-14): the keyboard also covers the budget sheet on the home screen ("change the budget"), seen on
  Android. Wanted: the whole sheet moves up and sits right above the keyboard, with the amount and the save
  button visible (like D2). The fix goes into the shared `BottomSheet`, so later sheets (e.g. add expense)
  get it too.
- D6 (Q5, 2026-10-14): option B — remove `automaticallyAdjustKeyboardInsets`, `WizardScreen` scrolls the
  focused field into view itself on iOS. Steps 2 and 3 approved 2026-10-14.
- D7 (Q7, 2026-10-14): nothing added for switching fields while the keyboard stays open; checked on the iPhone
  (Verification 2 and 5).
- D8 (Q8, 2026-10-14): keep the safe-area bottom + 16dp gap under the sheet's button while the keyboard is open.
  (Kacper wrote "q5: nic"; Q5 was already decided as D6, so it was read as Q8 — confirm if that is wrong.)

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
- **Q5 (iOS, open — CodeRabbit on PR #6):** on iOS the `ScrollView`'s `automaticallyAdjustKeyboardInsets` and the
  `KeyboardAvoidingView` both react to the keyboard. RN 0.86 `RCTScrollViewComponentView.mm`
  `_keyboardWillChangeFrame` computes the bottom inset (and the scroll to the focused field) from the scroll
  view's frame when the keyboard notification arrives, before the `KeyboardAvoidingView` padding shrinks it, and
  does not recompute after that. Result on iOS: a blank space about the keyboard's height at the end of the form,
  and a field scrolled to just above the keyboard can end up behind "Dalej" (cut off by the shrunken scroll
  view). Android is not affected (the prop is iOS only). Fix needs a decision (beyond the approved step).
  Re-checked 2026-10-14 in `node_modules/react-native` 0.86.3 `RCTScrollViewComponentView.mm` lines 187–236:
  confirmed, and that method returns early when the prop is off, so React Native's own scroll to the focused
  field lives only behind this prop. Options:
  - **A — remove `automaticallyAdjustKeyboardInsets`, keep the `KeyboardAvoidingView` alone.** One prop. Fixes
    the empty space. Risk: nothing in React Native scrolls a field low on the screen (segment 2's flight number)
    into view after the frame shrinks, so on iOS it can be hidden again. Whether iOS itself scrolls it when
    typing starts is not verified.
  - **B (recommended) — A + the wizard scrolls the focused field into view itself, iOS only.** On
    `keyboardDidShow` (after the padding is applied) `WizardScreen` finds the focused input, measures it
    against the scroll view and calls `scrollTo` only if it is below the visible part. About 25 lines, no new
    dependency, covered by Jest, Android untouched. Risk: switching fields while the keyboard stays open, checked
    on the iPhone.
  - **C — `react-native-keyboard-controller`** (`KeyboardAwareScrollView` + a sticky "Dalej",
    `KeyboardProvider` in the root layout). Most robust on both platforms. Cost: new native dependency
    (stack-review, new EAS dev build), it replaces the Android fix Kacper already checked, more files. If
    chosen, step 2 is rewritten and goes back for approval.
- **Q6 (budget sheet, answered D5):** where, which platform, and what should happen. Cause found in the code:
  `BottomSheet` uses `KeyboardAvoidingView` with no `behavior` on Android. RN 0.86 `ReactModalHostView.kt` sets
  `SOFT_INPUT_ADJUST_RESIZE` on the modal's window (line 332), but with the edge-to-edge flag the window is
  made edge-to-edge (lines 394–395) and is not resized, the same cause as Q4. Proposal: `behavior="padding"` on
  both platforms. No `keyboardVerticalOffset`: the modal is translucent, so its frame starts at the top of the
  window, like the keyboard's coordinates. To confirm on the Android phone.
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
- 2026-10-13, CodeRabbit review on PR #6: (1) `Status: done` before the iOS check breaks D3 — valid; status set
  back to in progress and step 1 unchecked until the iOS check is recorded. (2) double keyboard adjustment on
  iOS — valid (checked in the RN source), recorded as Q5, waiting for Kacper.
- 2026-10-14: work continues on branch `fix/wizard-keyboard-ios` (from `origin/claude/quirky-lovelace-xtofeh`,
  where PR #6 was merged). Q5 options A–C written, step 2 proposed with option B, waiting for approval.
  Kacper added the budget sheet (Q6 → D5), proposed as step 3. Steps 2 and 3 wait for approval; Q5's option is
  not chosen yet.
- 2026-10-14: steps 2 (option B, D6) and 3 approved. The orchestrator started step 2 inline by mistake; Kacper
  stopped it (steps go to the `frontend` agent, which writes the tests too). The inline test and code changes
  were reverted with `git checkout`, nothing was kept; step 2 is sent to the `frontend` agent from scratch.
- Step 2 (code done, verifier PASS, not `[x]` — waits for the iPhone check, D3), by the `frontend` agent:
  `WizardScreen.tsx`: `automaticallyAdjustKeyboardInsets` removed; internal iOS-only hook
  `useScrollFocusedFieldIntoView` listens to `keyboardDidShow`, measures the focused input
  (`TextInput.State.currentlyFocusedInput()`) and the scroll view (`getNativeScrollRef()`) with `measureInWindow`;
  if the field bottom + `theme.spacing[4]` is below the visible bottom, `scrollTo({ y: scrolledY + hidden })`,
  `scrolledY` from `onScroll` (`scrollEventThrottle` 16, iOS only). Android: no listener, no extra props (D4).
  Tests in `WizardScreen.test.tsx`: test 4 changed `automaticallyAdjustKeyboardInsets` `true` → falsy (D6), 7 new
  (scroll after `keyboardDidShow` only, scroll offset added, gap boundary, already visible, no focused field,
  listener removed on unmount, Android). Red ✓: 5 failed for missing behavior; 3 negative cases passed before by
  design and are proven by mutations. Harness: the fake `Keyboard` subscription's `remove()` now really removes.
  Green ✓ 11/11. Mutations: 10 by the implementer, 8 re-run by the verifier, all killed.
  Full suite 758/758 (65 suites), typecheck ✓, lint ✓ (implementer and verifier).
  Sources (RN 0.86.3): `ScrollView.js` `getNativeScrollRef` (typed in the legacy `ScrollView.d.ts`, unlike
  `getInnerViewRef`), `TextInputState.js` (`currentlyFocusedInput` can be null), `KeyboardAvoidingView.js` (iOS pads
  on `keyboardWillShow`, so the padding is in place by `keyboardDidShow`), `RCTKeyboardObserver.mm`,
  `ScrollViewShadowNode.cpp` (window coordinates include the scroll offset).
  Skill used: test-driven-development, source-driven-development.
  Deviation (design detail, inside the approved approach): measured in window coordinates (`measureInWindow`)
  instead of `measureLayout` against the scroll content, because the legacy types have no `getInnerViewRef` and
  Fabric's `measureLayout` rejects a numeric node handle; no cast or `any` needed.
  Non-blocking notes from the verifier: `scrollEventThrottle` 16 is a literal (one frame, not a design token);
  new comment lines slightly over 120 chars.
  Test count: the step 1 entry says 790/790; the verifier counts 65 suites = 65 tracked test files and 751 tests
  before step 2. Step 1 ran with other uncommitted work in the tree (see Files: "Not touched: the uncommitted
  work already in the tree"), the likely cause; 758 is the current figure.
  Typecheck quirk: Jest's `renderRouter` rewrites the gitignored `.expo/types/router.d.ts`; after a partial Jest
  run `pnpm typecheck` can fail in `summary.tsx:55`. After the full suite it is clean; `expo start` regenerates
  the file. Not caused by this step.
  Open for Kacper (Q7): switching to another field while the keyboard stays open — the agents say no
  `keyboardDidShow` is sent then, so no scroll; to confirm on the iPhone (Verification 2 and 5).
- Step 3 (code done, verifier PASS, not `[x]` — waits for the Android check 8–9 and iPhone 8), by the `frontend`
  agent: `BottomSheet.tsx` KAV `behavior="padding"` on both platforms, no `keyboardVerticalOffset`,
  `testID="bottom-sheet-keyboard"`, D5 comment, unused `Platform` import removed. Tests in `BottomSheet.test.tsx`
  (new describe, existing six untouched, imports extended): Android `keyboardDidShow`/`DidHide` → paddingBottom
  300 → 0 with title, content and sheet inside the KAV; iOS `keyboardWillShow`/`WillHide` as a regression guard.
  Red ✓: Android `Expected 300 / Received 0`; iOS passed before by design. Harness: `emitKeyboard` wrapped in
  `act`. Green ✓ 8/8. Mutations (implementer 2, verifier 4: Android `undefined`, no `behavior`, offset 50,
  `behavior="height"`): all killed. Full suite 760/760 (65 suites), typecheck ✓, lint ✓ (implementer and
  verifier). Skill used: test-driven-development, source-driven-development.
  Deviation: the first red failed on the missing `testID` (a test hook), so the `testID` was added alone and
  the tests re-run before the behavior change; the recorded red is the behavioral one (verifier reproduced it on
  HEAD + `testID` only). Accepted by the verifier as a non-behavioral hook.
  Sources (RN 0.86.3): `KeyboardAvoidingView.js` (Android listens to `keyboardDidShow`/`DidHide`, padding =
  frame bottom − keyboard `screenY`), `ReactModalHostView.kt` (adjustResize line 332; edge-to-edge lines 394–395;
  `statusBarTranslucent` skips `fitsSystemWindows`, line 361, so the modal content starts at y = 0 and no offset
  is needed — if `statusBarTranslucent` is ever removed, a status-bar offset is needed), `ReactRootView.java`
  `checkForKeyboardEvents` (the only Android source of `keyboardDidShow`, from the activity's root view).
  Risk (device only): whether `keyboardDidShow` reaches JS while the Modal dialog has focus; RN has no fallback.
  If the sheet does not move on the phone, any alternative is a new decision (e.g. a new dependency).
  Open for Kacper (Q8): with the keyboard open, the gap under "Zapisz budżet" is the safe-area bottom + 16dp
  (`BottomSheet.tsx:69`, same as iOS today) — keep, or drop the safe-area part while the keyboard is open.
  Noted, outside this step: `WizardScreen.test.tsx` `emitKeyboard` fires listeners without `act` (one act()
  warning in the full run, from step 1's harness).
