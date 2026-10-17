# Task: Pill navigation (5 screens) + confirm dialog
Status: in progress — steps 1–7 done and verified, `Architecture.md` updated; waiting for Kacper's device check (approved 2026-10-17, incl. R1, R3, A8)

## Understanding & assumptions
Kacper wants two things:
1. A **pill navigation** with 5 items that switches between 5 screens. Only "Podróż" (today's home screen) has content; the other four are **empty placeholder screens**:
   1. Podróż — the current home screen;
   2. Wydatki — will hold adding expenses (empty for now);
   3. Miejsca — places worth checking (empty for now);
   4. Plan — the trip's plan (empty for now);
   5. Ustawienia — settings (empty for now).
2. A reusable **confirm dialog** component in the design-context colours, first used when leaving the "new trip" wizard with entered data (today a native system alert).

**Decisions from Kacper (2026-10-17):**
- **D1** — The pill **floats**: a rounded capsule detached from the bottom edge, with screen content visible beneath it.
- **D2** — The pill is **always dark (ink)** in light and dark mode, like the trip screen. The active item is brand-coloured.
- **D3** — Empty screens show **a title and one sentence** ("coming soon"), no illustration, no button.
- **D4** (from `prompts/expenses/plan.md` D2, 2026-10-08) — Items have icon **and** text. The active item changes colour, and its icon and text grow, with an animation.

**Assumptions I make (tell me if any is wrong — otherwise they stand):**
- A1 — The dialog follows `context/design-context.md` §10.17: width viewport − 40dp (max 720), radius 16, padding 24, title Heading 3, body Body M, elevation level 4, scrim behind it.
- A2 — The dialog is a generic component (title, message, confirm, cancel, optional destructive style). Only the wizard's leave guard uses it now. Existing bottom sheets (e.g. delete trip) stay as they are.
- A3 — Dialog copy is unchanged ("Odrzucić wpisane dane?" / "Podróż nie zostanie zapisana." / "Odrzuć" / "Zostań").
- A4 — Tapping the dialog's backdrop or the Android back button = cancel ("Zostań"): the safe choice.
- A5 — The pill is visible only on the 5 main screens. The wizard and the photo viewer sit in the root stack above them, so they show no pill.
- A6 — The pill has no unread badges, and no "add expense" quick-add button yet (comes with the expenses feature).
- A7 — Tab labels (PL / EN): Podróż / Trip, Wydatki / Expenses, Miejsca / Places, Plan / Plan, Ustawienia / Settings. Icons (lucide, outline, stroke 2): `Plane`, `Receipt`, `MapPin`, `CalendarDays`, `Settings`.
- A8 — The empty screens do not implement loading / error / offline states: there is nothing to load. These states arrive with each screen's real feature. This is a deliberate exception to design-context §12; please confirm.

## Approach
- **Navigation:** expo-router `Tabs` (already in `expo-router`, no new dependency) with a custom `tabBar` that renders the pill. Layout:
  ```
  src/app/(drawer)/_layout.tsx          Drawer (unchanged role)
  src/app/(drawer)/(tabs)/_layout.tsx   NEW  Tabs + PillNav
  src/app/(drawer)/(tabs)/index.tsx     MOVED from (drawer)/index.tsx — URL stays "/"
  src/app/(drawer)/(tabs)/expenses.tsx  NEW  /expenses
  src/app/(drawer)/(tabs)/places.tsx    NEW  /places
  src/app/(drawer)/(tabs)/plan.tsx      NEW  /plan
  src/app/(drawer)/(tabs)/settings.tsx  NEW  /settings
  ```
  Rejected alternative: Tabs outside the Drawer — then the side panel would slide *under* the pill instead of over it.
- **Pill:** absolutely positioned over the content (floating), `pointerEvents="box-none"` around it so only the capsule takes touches. Items share the width equally; the active item animates icon size, label weight/size and colour over `duration.small` (180 ms); with reduced motion it switches at once.
- **Clearance:** because the pill floats, content must not hide under it. The tabs layout provides the pill's total height (pill + gap + safe-area inset) through a small context/hook, and the screens use it for bottom padding. Affected on the home screen: the scrolling cards, the pinned offline banner, the snackbar (`bottomOffset`), and the pinned "Utwórz podróż" button on the empty/error states.
- **Side panel:** the menu button (☰) stays on "Podróż" only. The edge swipe is enabled only while the path is `/`, so the panel cannot be opened from the other four screens (it has no button there).
- **Dialog:** `ConfirmDialog` in `src/components/` built on RN `Modal` (transparent, fade). `LeaveGuard` in the wizard layout keeps the pending navigation action in state, shows the dialog, and dispatches the action on confirm. This works the same on web (the old `confirm()` branch goes away). The native-alert helper `confirm-discard.ts` and its test are removed (they become unused through this change).
  Rejected alternative: keep the native `Alert` and only restyle — the system alert cannot take app colours.

## Data structures (Zod)
None. No data crosses a boundary: no API, no storage, no form. The tab list is a typed constant in the UI (route name, i18n key, icon). New **tokens** (not schemas):
```ts
// tokens.ts — design-context §6.1
elevation.floating = { shadowColor: '#17211B', shadowOpacity: 0.12, shadowRadius: 6,  shadowOffset: { width: 0, height: 2 }, elevation: 3  } // level 2: the pill
elevation.dialog   = { shadowColor: '#17211B', shadowOpacity: 0.20, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 } // level 4: dialogs
// theme.ts — semantic roles, same in both themes
colors.nav = { background: neutral.900, border: dark.border, textInactive: dark.textSecondary, active: dark.brand }
// size: navPill height 64 (spacing 16), navIcon active 24 / inactive 20 (existing iconPrimary / iconStandard)
// dark theme: elevation.floating / dialog are {} (surface contrast instead), as for `card`
```

## Tests
Written **before** each step's code, seen failing for the expected reason.
- **Step 1 tokens:** theme test — both themes expose `colors.nav.*`, the values come from the palette, elevation levels equal §6.1 in light and are empty in dark.
- **Step 2 `ConfirmDialog`:**
  - hidden when `visible` is false; shows title, message and both labels when true;
  - confirm → `onConfirm`; cancel → `onCancel`; Android back / backdrop tap → `onCancel`, never `onConfirm`;
  - destructive style uses the error status colour and the label carries the meaning (not colour only);
  - actions are stacked and full width, ≥ 44dp tall, 16dp apart, the destructive one on top as in `DeleteTripSheet`;
  - dialog and scrim use theme tokens in light and dark; announced to screen readers; reduced motion → no animation.
- **Step 3 `PillNav`:**
  - renders 5 items with the right PL and EN labels, in the order Podróż, Wydatki, Miejsca, Plan, Ustawienia;
  - the focused item is exposed as selected; pressing another calls `onNavigate` with its route;
  - every item is ≥ 44 × 44dp and labelled "<label>, button, selected / not selected";
  - active item uses the active colour, the others the inactive colour (and has a text label, not colour only);
  - active icon 24 / inactive 20; reduced motion → no animation, same end state;
  - total height reported through the clearance hook = pill + gap + bottom inset.
- **Step 4 routes:**
  - `/` still shows the home screen (existing home / index / drawer route tests updated for the new `(tabs)` path, not weakened);
  - `/expenses`, `/places`, `/plan`, `/settings` each show their title and sentence (PL and EN) and the pill;
  - tapping each pill item navigates to that screen and marks it selected;
  - the pill is absent in `/trips/new` and the photo viewer.
- **Step 5 home clearance + drawer:**
  - the home screen's scroll content, offline banner, snackbar and pinned "Utwórz podróż" sit above the pill (bottom offset = clearance);
  - edge swipe enabled on `/`, disabled on the other four paths.
- **Step 6 wizard guard:**
  - leaving with entered data opens the dialog (not `Alert`); "Zostań" / backdrop / back keep the wizard; "Odrzuć" leaves;
  - no dialog when the draft is clean or after saving; works when leaving through any step;
  - `confirm-discard` test deleted together with the file (its behavior moves to this test; logged below).

## Files
Created:
- `src/components/ConfirmDialog.tsx` (+ `src/components/__tests__/ConfirmDialog.test.tsx`)
- `src/components/PillNav.tsx` (+ test) and the tab config next to it
- `src/features/nav/` — `usePillClearance` (context + hook), `EmptyScreen` (title + sentence)
- `src/app/(drawer)/(tabs)/_layout.tsx`, `expenses.tsx`, `places.tsx`, `plan.tsx`, `settings.tsx`
- `src/__tests__/app/tabs.test.tsx`

Modified:
- `src/theme/tokens.ts`, `src/theme/theme.ts` (+ theme test)
- `src/app/(drawer)/index.tsx` → moved to `src/app/(drawer)/(tabs)/index.tsx`
- `src/app/(drawer)/_layout.tsx` (swipe only on `/`)
- `src/features/home/CurrentTrip.tsx` and the home route (clearance)
- `src/app/trips/new/_layout.tsx` (`LeaveGuard` uses `ConfirmDialog`)
- `src/i18n/locales/pl.json`, `en.json` (tab labels, empty-screen titles and sentence)
- Route tests that name the `(drawer)` route map: `layout`, `index`, `home`, `drawer`, `photos`, `trips/new/*` (paths only)
- `Architecture.md`, and `prompts/expenses/plan.md` (pill nav decisions now live here — one line pointing to this plan)

Deleted: `src/features/trip-create/confirm-discard.ts` and its test.

## Skills
- `test-driven-development` — steps 1–6 — red → green → refactor
- `source-driven-development` — step 3–4 — check the current expo-router `Tabs` `tabBar` API and RN `Modal` docs before writing
- `frontend-ui-engineering` — steps 2, 3 — accessibility, states, touch targets (subordinate to `design-context.md`)
- Design context is the only source of visuals; no new fonts, colours or gradients beyond the tokens listed above.

## Steps
All steps are **[frontend]** (no schema, migration or Edge Function). Each goes to a `frontend` subagent, then `verifier`. Tester runs the manual steps at the end when a device is connected.
- [x] 1. [frontend] Tokens: `elevation.floating` / `elevation.dialog`, `colors.nav.*`, nav sizes — skill: test-driven-development — tests first: theme test — verify: full suite, typecheck, lint
- [x] 2. [frontend] `ConfirmDialog` component + i18n keys it needs (none new if the caller passes strings) — skill: test-driven-development, frontend-ui-engineering — tests first: see Tests/Step 2
- [x] 3. [frontend] `PillNav` component + `usePillClearance` — skill: test-driven-development, source-driven-development, frontend-ui-engineering — tests first: see Tests/Step 3
- [x] 4. [frontend] Route structure: `(tabs)` group, move home, 4 empty screens with `EmptyScreen`, i18n — skill: test-driven-development, source-driven-development — tests first: see Tests/Step 4; existing route tests adjusted for the path only
- [x] 5. [frontend] Home screen clearance above the pill and drawer swipe only on `/` — skill: test-driven-development — tests first: see Tests/Step 5
- [x] 6. [frontend] Wizard `LeaveGuard` → `ConfirmDialog`; delete `confirm-discard` — skill: test-driven-development — tests first: see Tests/Step 6
- [x] 7. [orchestrator] `Architecture.md` update, plan progress, point `prompts/expenses/plan.md` at this plan — skill: none

## Verification
Per step: red seen first, then `pnpm typecheck`, `pnpm lint`, full `pnpm test`, then `verifier` (PASS before `[x]`). No schema or DB change, so no parity / RLS checks. Offline behaviour is unchanged (the pill adds no data).

**Manual test steps for Kacper (and `tester` on a device):**
1. Open the app: the pill floats at the bottom, dark, with 5 items. "Podróż" is active (terracotta icon + label, slightly larger).
2. Tap Wydatki, Miejsca, Plan, Ustawienia in turn: each shows its title and "coming soon" sentence; the active item moves and grows smoothly; with "reduce motion" on it jumps.
3. On Podróż: scroll to the bottom — the last card is fully visible above the pill; offline banner and "Utwórz podróż" (empty state) are not covered.
4. Swipe from the left edge on Podróż: the panel opens over the pill. On the other tabs the swipe does nothing.
5. Open "Nowa podróż", type anything, press back: the dialog appears in app colours (light and dark mode). "Zostań" and a tap outside keep you in the wizard; "Odrzuć" leaves. A clean wizard leaves without a dialog. The pill is not visible in the wizard.
6. Switch the phone to Polish / English and to the biggest font size: labels remain readable (see R1).

## Progress log
- Step 1: tests written (red ✓: 5 failed / 41 passed, all for missing tokens → `undefined`) · added `elevation.floating` / `elevation.dialog` and `size.navPill` (`tokens.ts`), `colors.nav` shared by both themes and light-only elevation (`theme.ts`), new `describe` in `theme.test.ts` · green ✓ · typecheck, lint, full suite (79 suites, 1280 tests) green; verifier PASS · skill used: test-driven-development · no deviations. Note from verifier: `theme.ts` line 12 (`darkElevation`) is 122 chars, cosmetic only, left as is.
- Step 2: tests written (red ✓: `ConfirmDialog` module missing; `duration.dialog` `undefined`) · new `src/components/ConfirmDialog.tsx` (RN `Modal` transparent + `statusBarTranslucent`, own opacity fade over `duration.dialog`, scrim `Pressable` "Zamknij", confirm above cancel 16dp apart, destructive `TextButton` or `PrimaryButton`, `accessibilityViewIsModal`), 23 tests in `ConfirmDialog.test.tsx` · green ✓ · typecheck, lint, full suite (80 suites, 1304 tests) green; verifier PASS · skills used: test-driven-development, frontend-ui-engineering, source-driven-development (RN `Modal` docs) · **Deviation:** added token `duration.dialog = 220` (design-context §9.1 "Dialog 220ms", §20 rule 6 no hardcoded durations) — not in the plan's token list; one test in `theme.test.ts`. Open for the device check (step 6): on Android TalkBack the invisible "Zamknij" scrim may be focused before the title; if so, move the scrim after the dialog in the tree.
- Step 3: tests written (red ✓: `../tabs`, `../usePillClearance`, `@/components/PillNav` missing) · new `src/components/PillNav.tsx` (presentational: `items`, `activeKey`, `onSelect`; floating capsule, scale animation 180 ms, reduce motion, R1 label hiding above font scale 1.3), `src/features/nav/tabs.ts` (`NAV_TABS`), `src/features/nav/usePillClearance.ts` (`usePillBottomOffset`, `usePillClearance`), `nav.*` keys in pl/en · first verifier run FAIL (role `tab` instead of the plan's `button`; reduce-motion flip left the scale mid-way; pressed-release assertion dropped; duplicated offset formula) → fixed test-first (red ✓ 7 failed for the role; `Expected 1, Received 0.8333` for the scale) → verifier PASS · full suite 83 suites, 1330 tests, typecheck, lint green · skills used: test-driven-development, source-driven-development, frontend-ui-engineering · **Deviations (logged):** `usePillClearance` is a pure hook, no context/provider; the callback is `onSelect(key)` not `onNavigate`; the tab config lives in `src/features/nav/tabs.ts`; the animation scales icon + label, the colour switches at once; items are `button` (not `tab`) per the plan — `tab`/`tablist` would be the semantically richer alternative if Kacper wants it; `borderWidth: 1` literal (same as `Chip`, `TextButton`). Verifier notes for later: a shared `useReduceMotion` hook (4 copies of the pattern now); active label may truncate at very large font scale (R1) — check on device.
- Step 4: tests written (red ✓: 12 of 12 new/edited suites failed with 0 tests run — missing `EmptyScreen`, `(drawer)/(tabs)/_layout` and the four screens) · `git mv` home to `src/app/(drawer)/(tabs)/index.tsx`; new `(tabs)/_layout.tsx` (`Tabs` from `expo-router/js-tabs` — the `expo-router` `Tabs` export is `@deprecated` in 57.0.24 — with a `PillTabBar` over `NAV_TABS`; `tabPress` emitted before `navigate`, as the library's own bar does; the bar is absolute, so scenes keep full height), `expenses|places|plan|settings.tsx`, `src/features/nav/EmptyScreen.tsx`, `nav.comingSoon` (pl/en); 10 existing route tests re-pointed to the new route map · tests: `EmptyScreen.test.tsx` (8), `tabs.test.tsx` (10) · green ✓ · typecheck, lint, full suite (85 suites, 1348 tests) green; verifier PASS · skills used: test-driven-development, source-driven-development (read `BottomTabView` source) · **Deviations:** one existing expectation changed on purpose, `layout.test.tsx:52` segments `['(drawer)']` → `['(drawer)', '(tabs)']` (the home route now sits in the `(tabs)` group); Jest logs "Route … is extraneous" warnings in older suites whose route maps lack the four empty screens (warnings only). **Design-context overrides decided by Kacper, to record in Architecture.md:** pill nav with icon-only inactive items at large font scale (§10.13, R1) and empty screens without illustration/states (§10.19, §12, D3, A8). Device checks left: pill overlays scenes and passes touches, status bar when switching tabs, Android back from a non-home tab goes to Podróż (`backBehavior: 'firstRoute'`, not in the plan).
- Step 5: tests written (red ✓: 18 of 22 new tests red for the expected reasons — trip scroll padding `Received: 24`, snackbar `bottomOffset` `0`, offline banner `paddingBottom` `50`, empty/error screen padding `50`, drawer `swipeEnabled` `undefined`; 4 guards passed from the start) · `usePillClearance()` now drives the bottom spacing of the home screen: trip view scroll padding = clearance + 16 (offline: stays `spacing[6]` because the scroll view already ends above the pinned banner), pinned offline banner `paddingBottom` = clearance + 12, empty/error screen padding = clearance + 16, snackbar `bottomOffset` = `navPill` + 16 in every state (the snackbar adds the inset + 16 itself; the relation to the pinned "Utwórz podróż" is unchanged); drawer `swipeEnabled` only on path `/` and not on web (library default), stale comment fixed · new `home-clearance.test.tsx` (12), `drawer-swipe.test.tsx` (6) · green ✓ · typecheck, lint, full suite (87 suites, 1365 tests) green · first verifier run FAIL only for missing red evidence (it had no access to the implementer's report); the evidence above is from that report; code and tests checked OK · skill used: test-driven-development · **Deviations:** the plan said "bottom offset = clearance"; the code adds a 16dp gap (12dp for the offline banner) above the pill, otherwise buttons sit flush on it — Kacper to confirm on a device. Known, pre-existing: the snackbar covers the offline banner while visible. Device checks left: the real edge swipe on `/` and its absence on the other tabs; the offline trip view (ink under the floating pill).
- Step 6: tests written (red ✓: 7 of the new/changed layout tests failed because the guard still called `Alert` and rendered no dialog; the "tap outside" test first passed vacuously and got a precondition that the dialog is open) · `LeaveGuard` keeps the blocked action in state (`current ?? data.action`) and renders `ConfirmDialog` with the existing `newTrip.discard.*` keys; "Odrzuć" clears the state and dispatches the stored action (`usePreventRemove` skips already-visited routes, so it is not blocked twice), "Zostań" / scrim / Android back drop it · `confirm-discard.ts` and its test deleted on purpose (nothing else imports them) · `layout.test.tsx` rewritten for the dialog, `summary.test.tsx` asserts "no `confirm-dialog`" instead of the `Alert` spy · green ✓ · typecheck, lint, full suite (86 suites, 1369 tests) green; verifier PASS · skill used: test-driven-development · **Deviations:** the web `confirm()` branch is gone (RN `Modal` works on web; no test replaces it); the buttons are now confirm-on-top („Odrzuć” above „Zostań”) instead of the system alert's cancel-first order, as in step 2. Pre-existing and unchanged: `router.navigate('/')` from the wizard bypasses the guard (`dismissTo` / `back` are guarded). Device checks left: iOS swipe-back, Android hardware back with the dialog open, TalkBack / VoiceOver order.
- Device run (2026-10-18, `tester` + me, Android emulator "Medium Phone API 37.0", Expo Go, Polish):
  - **PASS:** the dark pill floats with 5 items and „Podróż” active (1); the four empty screens show title + „Ten ekran pojawi się wkrótce.” with nothing under the pill (2; the animation's smoothness and reduce motion were not judged from screenshots); the last card of „Podróż” ends ~20dp above the pill (3, partial); the side panel opens over the pill on „Podróż” and the swipe does nothing on „Wydatki”, Android back from „Wydatki” goes to „Podróż” (4); the dialog appears after back with a chosen airport, „Zostań”, a tap outside and hardware back keep the wizard and the data, a clean wizard leaves without a dialog, no pill in the wizard (5).
  - **False alarm:** the tester reported „Odrzuć” closes the dialog but the wizard stays. I reproduced it, then added temporary logging and found the taps landed in the empty area of the dialog (y 1100–1145, the button starts at y 1145), not on the button. Tapping the button (by its element ref) leaves the wizard: after the dispatch the root routes were only `["(drawer)"]`. The temporary debug code was removed (grep clean, typecheck, lint and the 16 layout tests green). No code change; the guard and dialog are correct on the device.
  - **Not run:** scenario 6 (dark mode, large font size, EN labels), the offline banner and the empty-state button above the pill, reduce motion, touch passing through the pill wrapper.
  - **Open points for Kacper:**
    1. ~~Text typed into an airport field but not chosen from the suggestions does not count as entered data, so no dialog.~~ **Decided by Kacper (2026-10-18): keep it — only chosen airports count as entered data (D-A9).**
    2. A swipe starting at the very left edge triggers Android's own back gesture; the panel opened only from about x = 80 px on this emulator (the system gesture zone, a pre-existing property of the drawer). Acceptable, or widen the drawer's edge zone?
    3. Expo Go's dev "Tools" bubble overlaps the „Podróż” label in screenshots (dev tool only).
- Step 7: `Architecture.md` updated (overview, folder tree, modules, routes, components, theme, data flow, testing, key decisions, limitations, changelog); `prompts/expenses/plan.md` D2 points here.

## Risks & open questions
- **R1 — 5 labels + large text.** At 12dp "Ustawienia" is about 62dp wide; 5 items in a 328dp pill (360dp screen) leave ~65dp each — it just fits, but not at 200% font scale. Proposal: always show all labels; if the font scale is above ~1.3, inactive items show the icon only (the label stays for screen readers). **Do you accept this?**
- **R2 — Pill sits over the hero photo** on Podróż. The dark pill with a 1dp border should stay readable, but I cannot judge it before seeing it on a device; I will show screenshots after step 4.
- **R3 — Drawer swipe only on `/`.** Alternative: allow it everywhere (panel selects a trip, then you stay on the current tab). I recommend "only on Podróż" because the panel has no button elsewhere.
- **R4 — A8 above** (no loading / error / offline states on empty screens).
- **R5 — Test churn:** moving the home route to `(tabs)` touches ~10 route test files (path strings only). No assertion is weakened.
