# Task: Sunline Editorial redesign (whole app)
Status: in progress (approved by Kacper 2026-10-22)

Source material from Kacper (2026-10-22): `DESIGN.md` (Sunline Editorial, Phase 4 final), `tokens.ts` (Sunline Editorial
tokens), `Travelo â€” Sunline Editorial prototype.pdf` (screen previewer: styleguide, dashboard, timeline, quick-add,
summary; only its text could be read, see Q5).

## Understanding & assumptions
The app already uses DM Sans + Fraunces and a warm palette ("Sunline"). Sunline Editorial replaces every value
(colors, type scale, radii, elevation, motion) and gives an exact spec for every component (Â§8) and the four screen
states (Â§10). The task: make the existing app look and behave like that spec, without adding features.

Decisions (Kacper, 2026-10-22, before the plan):
- **D1 Scope:** foundation + everything that exists. New `tokens.ts` and theme, DESIGN.md becomes
  `context/design-context.md`, every existing component and screen moved to the new tokens and Â§8 specs.
  **Not** in this task: new things from the prototype (TODAY Â· DAY N budget module, NEXT activity, TRAVELLERS,
  TRIP BUDGET sections, timeline, quick-add sheet, share summary). They come with their own features.
- **D2 Trip view (â€œPodrÃ³Å¼â€) follows the phone theme**, as decided in `theme-split-and-profile-prefill` D1. DESIGN.md
  Â§0/Â§9.0/Â§14.4 ("dark-only") gets corrected when it is copied into `design-context.md`.
- **D3 Theme API uses the DESIGN.md names:** `const theme = useTheme(); theme.surface.primary`, `theme.brand.primary`,
  `theme.semantic.error.foreground`, `theme.elevation.level1`; non-color values imported from `tokens`
  (`tokens.components.button.height`, `tokens.spacing[3]`, `tokens.typography.styles.bodyMD`). No old names remain.
- **D4 Timing (changed by Kacper 2026-10-22):** start now, on branch `feature/sunline-redesign` from `origin/main`, in
  its own git worktree (`C:\Users\Baxton\Developer\Travelo-sunline`) so the profile work in the main checkout is not
  touched. The profile-screen WIP stays on its branch (commit `b49f9d2`). Step 10 (profile and settings) runs last,
  after profile-screen is merged to `main` and merged into this branch.

Assumptions (correct me if wrong):
- A1 **Restyle, don't restructure.** Existing components keep their names, props and behavior; only looks change to
  match Â§8. No new unified `Button` component: `PrimaryButton` gets the Â§8.1 primary (and, where a screen already
  shows a destructive action, destructive) look, `TextButton` gets the ghost look. A component that Â§8 describes but
  the app does not have yet (Avatar Group, Activity Card, Flight Card, Daily-Budget Meter, FAB) is not built now.
- A2 **Copy stays as it is.** Â§11 (voice, canonical i18n strings) is not applied in this task (see Q3).
- A3 **Google / Discord sign-in buttons** keep their official colors as the one written exception (auth-onboarding
  D10, D13), moved into `tokens.ts` as `partnerBrand`.
- A4 **App-specific sizes** the new token file does not have are added as tokens (DESIGN.md Â§14.18), not dropped:
  drawer max width 360, drawer trip thumbnail 48, photo tile 80, cover tile 112, profile setup avatar 96,
  welcome "celebration" entrance 500 ms, hero fade start 0.35, skeleton pulse (if Q1 keeps it). Each goes under
  `tokens.components` / `tokens.screenMetrics` / `tokens.motion` with a one-line comment naming its decision.
- A5 Disabled controls use `disabled.background` / `disabled.foreground` instead of 40 % opacity (DESIGN.md Â§8.0
  replaces trip-photos D25).
- A6 Bottom-sheet and dialog backdrop become black at 0.48 (Â§8.13, Â§8.18) instead of ink at 0.5 (trips-supabase D12);
  snackbar max width 520 (Â§8.17) instead of 360.
- A7 `Fraunces_700Bold` is no longer in the type scale; it is removed from font loading in the cleanup step if nothing
  uses it.
- A8 The canonical token path in DESIGN.md (`apps/mobile/src/theme/tokens.ts`) is written as `src/theme/tokens.ts`,
  where the app really is.

## Approach
Migrate in slices so the suite is green after every step:
1. Move today's theme into `src/theme/legacy/` (mechanical import rewrite, no behavior change).
2. Add the Sunline Editorial `src/theme/tokens.ts` and a new `src/theme/useTheme.ts` (with `DarkThemeScope`) at the
   final paths.
3. Move components and screens group by group from `@/theme/legacy/...` to the new theme and the Â§8 specs. Each file's
   import changes once, to its final form.
4. Delete `src/theme/legacy/` and add guard tests (no legacy import, no hex literal outside `src/theme/`).

Rejected: one big-bang rewrite of the theme shape in a single step (117 files in one diff, unreviewable, no green
point in between).

## Data structures (Zod)
None. This task changes no entity, payload or table. Theme types come from `tokens.ts` (`as const` + `typeof`), which
is UI configuration, not a data shape, so the Zod rule does not apply.

## Tests
- Step 2 (foundation):
  - `src/theme/__tests__/tokens.test.ts`: light and dark `colors` have the same keys (shape parity); key values match
    DESIGN.md Â§2.3â€“Â§2.8; every pair in Â§2.9 meets its stated WCAG ratio (luminance computed in the test, so a wrong
    hex fails); every `typography.styles[*].fontFamily` is one of the fonts loaded in `src/app/_layout.tsx`; spacing
    has only the Â§4.1 steps; `partnerBrand` and the A4 extras exist.
  - `src/theme/__tests__/useTheme.test.ts`: light device â†’ light colors + `elevation.light`; dark â†’ dark;
    `DarkThemeScope` forces dark on a light device; no scheme â†’ light.
- Steps 3â€“10 (each group): the group's existing component/screen tests are rewritten first to the Â§8 spec and fail
  against the old look, then pass. Typical assertions: fill/text colors per variant and state (default, pressed,
  disabled uses disabled tokens and no opacity, focused ring `border.focus`, error icon + text), min heights
  (52 / 44 / 72), radii, type style, icon size and stroke 1.75, dark-mode elevation is a border not a shadow,
  reduced motion removes scale. Changed expectations are logged per step (the spec changed, the test is not weakened).
- Step 11 (cleanup): `src/__tests__/themeGuards.test.ts` fails while any file imports `@/theme/legacy` or any file
  outside `src/theme/` contains a color literal (`#RGB`, `#RRGGBB`, `rgb(`, `rgba(`).

## Files
- New: `src/theme/tokens.ts` (from Kacper's file + A3, A4), `src/theme/useTheme.ts` (new shape),
  `src/theme/__tests__/tokens.test.ts`, `src/theme/__tests__/useTheme.test.ts`, `src/__tests__/themeGuards.test.ts`.
- Moved then deleted: `src/theme/{tokens,theme,typography,useTheme}.ts` â†’ `src/theme/legacy/` (step 2) â†’ removed
  (step 11), with `src/theme/__tests__/theme.test.ts`.
- Modified: every file in `src/components/` and `src/features/`, the route files under `src/app/` that style things,
  and their tests (about 117 source files, 78 use `useTheme`).
- Docs: `context/design-context.md` (replaced by DESIGN.md + D2, A3, A4, A8 corrections), `CLAUDE.md` (Design
  section: token file and design-context references), `Architecture.md` (Theme section, Key decisions, Changelog).

## Skills
- `frontend-ui-engineering` â€” steps 3â€“10 â€” states and accessibility while restyling.
- `test-driven-development` â€” steps 2â€“11 â€” red â†’ green per slice.
- `incremental-implementation` â€” steps 2â€“11 â€” one coherent diff per group.
- `ui-taste` â€” verifier, steps 3â€“10 â€” visual review against DESIGN.md.
- `git-workflow-and-versioning` â€” orchestrator â€” one commit per step on `feature/sunline-redesign`.

## Steps
- [x] 1. [orchestrator] Docs first: replace `context/design-context.md` with DESIGN.md plus the D2, A3, A4, A8
  corrections; update the design references in `CLAUDE.md`. â€” skill: none â€” tests first: none (docs only, no
  behavior) â€” verify: Kacper reads the diff of the corrected sections.
- [x] 2. [frontend] Foundation: move today's theme to `src/theme/legacy/` (import rewrite only), add the new
  `tokens.ts` and `useTheme.ts`. â€” skill: test-driven-development, incremental-implementation â€” tests first:
  tokens.test.ts, useTheme.test.ts (red: modules missing) â€” verify: full suite (legacy move changes nothing), typecheck,
  lint; verifier.
- [x] 3. [frontend] Buttons: `PrimaryButton`, `TextButton`, `IconButton`, `HeroIconButton`, `HeroMenuButton`,
  `TripMenuButton`, `BrandButton` / `GoogleButton` / `DiscordButton` (layout only, A3 colors). â€” Â§8.1, Â§8.2 â€” tests
  first: their tests to the new spec â€” verify: suite, typecheck, lint; verifier.
- [x] 4. [frontend] Inputs and selection: `Field`, `TextField`, `AmountField`, `AirportField`, `DateTimeField*`, `Chip`,
  `InterestChips`, `SegmentedControl`, `Stepper`, `StepIndicator`. â€” Â§8.4â€“Â§8.6, Â§8.15 â€” same pattern.
- [x] 5. [frontend] Surfaces and feedback: `Card`, `BottomSheet`, `ConfirmDialog`, `Snackbar`, `OfflineBanner`,
  `SyncIndicator`, `SkeletonBlock`, `TripHeroSkeleton`, `LayoverLabel`, `TripsEmptyIllustration`, `CoverImage`,
  `CoverPicker`. â€” Â§8.9, Â§8.13, Â§8.17â€“Â§8.20, Â§10 â€” same pattern; skeleton per Q1.
- [x] 6. [frontend] Navigation: `PillNav`, tabs layout, `TripsDrawer`, `EmptyScreen`. â€” Â§8.14 â€” same pattern.
- [ ] 7. [frontend] Trip view: `TripHero` (per Q2), `CurrentTrip`, `HomeSkeleton`, `BudgetSheet`, `TripDetailsSheet`,
  `TripMenuSheet`, `DeleteTripSheet`, `PhotoStrip`, `PhotoTile`, `PhotoViewer`, `DeletePhotoSheet`, and
  `src/features/nav/usePillClearance.ts` (pill bottom offset 16 → 12, D23). â€” Â§8.10, Â§9.1
  (hero only) â€” same pattern.
- [ ] 8. [frontend] Sign-in and onboarding: `WelcomeScreen`, `SignInSheet`, `AuthFormScreen`, `EmailScreen`,
  `CodeScreen`, `ProfileSetupScreen`, `AvatarPicker`, `AppLoading`, `FullScreenError`. â€” same pattern.
- [ ] 9. [frontend] New-trip wizard: `WizardScreen`, `FriendCard`, `SegmentCard`, the step routes under
  `src/app/trips/new/`. â€” same pattern.
- [ ] 10. (runs after step 11's prerequisites except the legacy delete; waits for profile-screen in `main`, D4)
  [frontend] Profile and settings: `ProfileScreen`, `SettingsScreen`, `TravelStatsCard`, plus any route file
  still on legacy. â€” same pattern.
- [ ] 11. [frontend] Cleanup: delete `src/theme/legacy/`, drop `Fraunces_700Bold` if unused (A7). â€” tests first:
  themeGuards.test.ts (red while legacy exists) â€” verify: suite, typecheck, lint; verifier.
- [ ] 12. [tester] Device run of the manual steps below, light and dark. â€” verify: PASS per scenario. Also the step-3
  checks the blocked device run did not cover (Kacper, 2026-10-22): trip menu sheet and delete-trip dialog buttons
  (cancel only), light-mode Welcome, press scale 0.98 and no stuck shrink after release, disabled button look (no
  opacity; does a disabled secondary keep its outline), font scale 1.3, ⋮ trip menu button reachable by the screen
  reader. Needs the emulator to itself (no other session's Metro) and a signed-in account.
- [ ] 13. [orchestrator] `Architecture.md` (theme module, key decisions D1â€“D4, changelog). â€” verify: every statement
  checked in the code.

## Verification
Every step: its tests were red first; then `pnpm test` (full suite), `pnpm typecheck`, `pnpm lint` green; verifier
PASS (with `ui-taste` for 3â€“10). Steps 3â€“10 also go to the tester on the device when one is connected.

Manual test steps (Kacper / tester), each in light and in dark mode:
1. Welcome â†’ sign in â†’ profile setup: warm paper (light) / charcoal (dark) background, coral only on the main button.
2. Trip view: hero photo fades into the canvas, trip name in Fraunces, cards with 20 dp corners; drawer and pill
   navigation with the coral-tint active capsule.
3. Open the trip menu, budget sheet, delete dialog: sheet with 28 dp top corners and a handle, dark dim behind it.
4. New-trip wizard: inputs 52 dp high with an outside label, focus ring in `border.focus`, disabled "Next" readable
   (not faded).
5. Airplane mode: offline banner in the info colors with the WifiOff icon.
6. Large font (system setting at maximum): text grows, nothing clipped, buttons grow in height.

## Progress log
- Setup (2026-10-22): WIP commit `b49f9d2` on `feature/profile-screen` (profile changes from the start of the session);
  while switching branches, new uncommitted profile work (D24, skeleton) appeared in the main checkout, so per Kacper
  the redesign runs in the worktree `C:\Users\Baxton\Developer\Travelo-sunline`, branch `feature/sunline-redesign` from
  `origin/main` (79fecba). `.env` copied from the main checkout, `pnpm install --frozen-lockfile`.
- Step 1: docs only, no tests (approved in the plan) Â· `context/design-context.md` replaced by Kacper's DESIGN.md with
  corrections: token path `src/theme/tokens.ts` (A8, lines in the header and Phase 2 summary); "PodrÃ³Å¼" follows the
  theme (D2: header, Â§9.0, Â§14.4, Â§14.24); hero fades into the current canvas, text below the photo (D6, Â§9.1); new
  "Project notes" section at the top with D2, D5â€“D8, A3, A4 and D1's not-built list. `CLAUDE.md` and
  `.claude/agents/*` only point to `context/design-context.md` without section numbers, so they need no change.
  Verification: Kacper reviews the diff of `context/design-context.md` (header + Project notes, Â§9.0, Â§9.1, Â§14.4).
- Baseline before step 2 (clean `origin/main` in the worktree): typecheck and lint ran; tests 1 failed / 2683 passed
  once. The failure did not reproduce in the implementer's or the verifier's runs (2684/2684 after 2a), so it is
  treated as flaky; the failing test's name was not captured. Watch for it in later runs.
- Step 2: tests written (red âœ“: `tokens.test.ts` â†’ `Cannot find module '../tokens'`, `useTheme.test.ts` â†’
  `Cannot find module '../theme'`, implementer's run) Â· 2a: `src/theme/{tokens,theme,typography,useTheme}.ts` â†’
  `src/theme/legacy/` and `theme.test.ts` â†’ `src/theme/legacy/__tests__/theme.test.ts` (deviation: kept the
  `__tests__` folder, so its relative imports still work); ~106 files' `@/theme/<name>` imports and `jest.mock` paths â†’
  `@/theme/legacy/<name>`, nothing else; suite after 2a 122 suites / 2684 tests green Â· 2b: `src/theme/tokens.ts`
  (Kacper's file verbatim + `partnerBrand`, `layout.compactBreakpoint`, `components.drawer`, `components.coverPicker`,
  `components.avatar.xxl`, `screenMetrics.tripOverview.heroFadeStart`, `motion.microinteraction.welcomeRevealed`,
  `motion.microinteraction.skeletonPulse`; photo tile reuses `screenMetrics.tripOverview.photoStripHeight`),
  `src/theme/theme.ts` (`lightTheme` / `darkTheme`, widened `Theme`), `src/theme/useTheme.ts` Â· green âœ“ 124 suites /
  2733 tests, typecheck âœ“, lint âœ“ Â· verifier: FAIL only for missing red evidence in this log (now recorded), all other
  checks PASS (verbatim diff vs Kacper's tokens.ts, import-only diff in the 106 files, no skip/only) Â· skill used:
  test-driven-development, incremental-implementation Â· minor notes for later: contrast test asserts the WCAG tier, not
  the exact Â§2.9 ratio; the font check reads `_layout.tsx` as text; the `profile-screen D9` comment points to a plan that
  is not on this branch yet.
- Step 3 (in progress, not committed): implementation in the working tree · red ✓ (orchestrator, 2026-10-22: the 13
  source files reverted to HEAD with the new tests kept → 8 suites fail, 57 failed / 64 passed, assertion failures, not
  import errors) · green ✓ 126 suites / 2769 tests, typecheck ✓, lint ✓ · new `src/components/usePressScale.ts` (D10
  press motion) · deviation: legacy `DarkThemeScope` also wraps children in the new `DarkThemeScope` (bridge so new-theme
  buttons inside legacy Welcome / photo viewer get dark; `src/theme/legacy/__tests__/bridge.test.tsx`; removed in step
  11) · verifier: FAIL, one issue: `HeroMenuButton` / `TripMenuButton` switched the side-inset breakpoint from legacy 360
  to `layout.compactBreakpoint` 390 (on 360–389 dp the gutter drops 20 → 16 while other screens still use 360) →
  Kacper accepted it as a deviation (D12) · re-verify: PASS · skill used: test-driven-development,
  incremental-implementation (implementer), ui-taste, code-review-and-quality (verifier) · minor notes for later:
  `BrandButton.tsx` Pressable body not re-indented inside `Animated.View` and import order; `usePressScale` lives in
  `src/components/` (hooks are in `src/hooks/`) and has no direct test; disabled secondary keeps its `border.default`
  outline (check on device); `held` may stay true if a button turns disabled while pressed; `motion.press.scale`
  duplicates `microinteraction.expenseSaved.pressScale`.
- Step 3 device check (2026-10-22, `tester`, emulator Medium Phone API 37.0, Expo Go from this worktree's Metro on
  8081 via `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1` + `adb reverse`, config `expo-go-emulator` in
  `.claude/launch.json`): **blocked**. The emulator was shared with another session (main checkout's Metro on 8083):
  night mode, tabs and the loaded bundle changed without the tester's input, and the app ended signed out (cause not
  established). Seen before that: dark Welcome "Sign in" coral, ~52 dp; Google white / Discord blurple in the sign-in
  sheet; hero menu button ~44 dp, readable over the photo in light and dark; drawer "New trip" coral ~52 dp. Not
  checked: trip menu and delete dialog, light Welcome, press scale (inconclusive from screenshots), disabled look,
  font scale 1.3. Kacper (2026-10-22): commit step 3 now, the missing checks move to step 12.
- Open question (tester, step 3 run, not in this task's scope): should "Send code" on the e-mail screen be disabled
  while the field is empty? Today it is enabled. Ask Kacper; A1 keeps behavior unchanged here.
- Step 4: tests written (red ✓, implementer: the 11 suites against the old code → 11 failed, 54 failed / 45 passed,
  assertion failures plus TypeErrors from new tests calling legacy `inputBorder` with the new theme, no module errors;
  `StepIndicator` 3 failed / 3 passed; D16/D18 fixes 3 failed / 23 passed) · all 13 components on the new theme per
  §8.4–§8.6, §8.15 (airport results as §8.8 list rows); `Field.tsx` exports `inputCursorProps` (cursor `brand.primary`),
  `inputBorder` / `inputBoxStyle` / `inputTextStyle` take the new `Theme` and an optional `disabled`; inputs and chips
  give up border width from padding so text does not move on focus · spec-driven size changes: chip 32 → 36 (row gap
  12 → 8), segmented 52 → 44, amount 64 → 72, airport row min 56, label gap 4 → 8, helper gap 4 → 6, field label
  `labelMD`, hint and error `caption` with `CircleAlert` (was `CircleX`) · type mappings not in the spec: InterestChips
  group label `bodySM`, airport row title `labelLG` over `caption`, amount currency `moneyMD` · changed assertions in
  pre-existing tests (spec changed, not weakened): TextField, AmountField, Chip (opacity → disabled tokens, hitSlop
  6 → 4), InterestChips, SegmentedControl, Stepper, StepIndicator, and error/hint colors in
  `src/features/auth/__tests__/{EmailScreen,CodeScreen,ProfileSetupScreen}.test.tsx` · decisions D13–D18 · green ✓
  126 suites / 2810 tests, typecheck ✓, lint ✓ (orchestrator re-run) · verifier PASS (red not re-run, judged from
  diffs) with 4 minor issues → D16, D18 fixed tests-first, D17 kept · skill used: test-driven-development,
  incremental-implementation, frontend-ui-engineering (implementer), ui-taste, code-review-and-quality (verifier) ·
  mixed-theme state: `CoverPicker` and the auth screens render the new `Field` until steps 5 / 8 · not built (A1):
  chip error/loading, input loading, airport disabled · notes for later: iOS `selectionColor` branch untested; the web
  `DateTimeField` reads `useColorScheme`, not the theme scope (unchanged); the 4 dp coral step bar vs §1.3, check on
  device in step 9 · device check: not run (goes to step 12 with the manual steps from the implementer: field focus
  and error, amount 72 dp, airport rows, date picker tint, chips keep width, segmented elevation, max font scale).
- Step 5: tests written (red ✓, implementer: `pnpm jest src/components` before any production change → 11 suites
  failed, 42 failed / 293 passed, assertion failures only; D20 fix 2 failed / 3 passed; verifier fixes 3 failed / 118
  passed plus the `TripsEmptyIllustration` suite on the missing token) · the plan's "SkeletonBlock" is
  `TripHeroSkeleton` (no shared skeleton component; `PhotoSkeleton` and the drawer rows live in `src/features/`, later
  steps) · new test files `Card.test.tsx`, `TripHeroSkeleton.test.tsx` (describe moved out of `TripHero.test.tsx`),
  `TripsEmptyIllustration.test.tsx` · spec-driven value changes: sheet corners 24 → 28, max height 90 → 92 %, handle
  top 12 → 10, handle-to-title gap 16 → 20 (§8.13 content top padding, a loose reading accepted by the verifier);
  dialog max width 720 → 360, padding 24 → 20, radius 20 → 24, `elevation.level3`; snackbar inverse surface, side inset
  16 → 20, max width 360 → 520 (A6); backdrops `primitives.pure.black` at 0.48 (A6); cards lose the light shadow and
  get a 1 dp `border.subtle`, radius 20; layover amber → info; sync failed icon `CircleX` → `CircleAlert`; empty-state
  illustration 160 → 96; cover-tile focus gap 4 → 2 (D10) · type mappings not in the spec: sheet and dialog title
  `headingSM`, dialog message `bodyMD`, offline banner and sync text `bodySM`, layover `labelMD`, sheet handle
  `border.default`, sheet `elevation.level2` · changed assertions in pre-existing tests (spec changed, not weakened):
  BottomSheet, ConfirmDialog, Snackbar, OfflineBanner, SyncIndicator, LayoverLabel, CoverImage, CoverPicker, and
  `WelcomeScreen.test.tsx` (sheet surface), `src/__tests__/app/index.test.tsx` (illustration size), `home.test.tsx`
  (snackbar colors) · decisions D19–D22 · green ✓ 129 suites / 2837 tests, typecheck ✓, lint ✓ · verifier: FAIL
  (skeleton pulsed while reduce motion was still unknown; illustration size borrowed `spacing[24]`) → fixed tests-first
  (pulse only when `useReduceMotion() === false`; D22 token) → re-verify PASS · skill used: test-driven-development,
  incremental-implementation, frontend-ui-engineering (implementer), ui-taste, code-review-and-quality (verifier) ·
  `context/design-context.md` Project notes: D20, D22 · notes for later: other components still use the
  `useReduceMotion() === true` convention (pulse/scale while unknown); `TripHeroSkeleton` keeps radius none (§8.19
  lists 12 for the hero template); the illustration canvas stays 160 × 160 (§6.2 says 160 × 120) · device check: not
  run (step 12, with the implementer's manual steps: cards, sheet, dialog, snackbar, offline banner, sync status, empty
  state, cover picker, skeleton pulse and reduce motion).
- Step 6: tests written (red ✓, implementer: new tests against the old code → 4 suites failed, 36 failed / 42 passed,
  assertion failures plus one TypeError on a missing style; D27 + pressed-capsule fixes 2 failed / 25 passed) ·
  `PillNav` (§8.14: `surface.elevated` + `elevation.level2`, 22 dp icons, `labelSM`, selected `brand.tint` capsule with
  `text.brand`, inactive `icon.secondary` / `text.tertiary`, pressed `background.sunken` also on the selected capsule,
  focus `border.focus`, min width per D27), `TripsDrawer` (§8.8 rows: 56 min height + 12 padding around the 48 dp
  thumbnail = 72 dp, was 64; divider from the text column; selected `brand.tint` + check; `CircleAlert` error; pulsing
  skeleton rows, bars 22 / 14 from `components.skeleton`), drawer layout (width `components.drawer.maxWidth`, panel
  `surface.elevated`, right corners `radii.xl`, scrim black at the backdrop opacity), `EmptyScreen` (canvas,
  `headingLG` / `bodyMD`, gutter breakpoint 360 → 390 per §4.2); `(tabs)/_layout.tsx` has no styling, unchanged · type
  mappings not in the spec: drawer title `headingLG`, section headers `caption`, row name `labelLG`, dates `bodySM`,
  empty heading `labelLG`, empty description `bodySM`, error `bodyMD` · changed assertions (spec changed, not
  weakened): `PillNav.test.tsx`, `TripsDrawer.test.tsx`, `EmptyScreen.test.tsx`, `src/__tests__/app/drawer.test.tsx` ·
  decisions D23–D27 · green ✓ 132 suites / 2875 tests (tracked step-6 tree ≈ 129 / 2850; the rest are another
  feature's untracked suites in this worktree), typecheck ✓, lint ✓ (orchestrator re-run) · verifier PASS with minor
  issues → pressed selected tab and the 320 dp overflow (D27) fixed tests-first; `PillNav.tsx` was reformatted with
  prettier while re-indenting (no repo prettier config) · skill used: test-driven-development,
  incremental-implementation, frontend-ui-engineering (implementer), ui-taste, code-review-and-quality (verifier) ·
  notes for later: drawer divider thickness borrows `components.card.borderWidth`; drawer scrim alpha rounds to 0.478;
  the drawer pulse copies `TripHeroSkeleton`'s (~12 lines, extract a `useSkeletonPulse` hook in step 11); §7.4's 80 ms
  reduced-motion crossfade is not applied to the capsule or skeletons (D19 / D24 wording); EmptyScreen on 360–389 dp
  now uses the 16 dp gutter · device check: not run (step 12: pill tabs light / dark, capsule fade and reduce motion,
  pressed selected tab, font scale 1.3+, drawer scrim, rows, selected trip, offline / empty / loading states,
  placeholder screens) · environment: another session works on `splash-animation` in this same worktree and branch
  (untracked folders plus edits to `app.json`, `package.json`, `pnpm-lock.yaml`, `jest.setup.ts`, i18n and
  `src/theme/tokens.ts`); step commits list their files explicitly and leave that work out.

## Risks & open questions
Answers (Kacper, 2026-10-22, with the approval):
- **D5 (Q1):** keep the opacity pulse in `skeleton.base`; the Â§8.19 shimmer is a later small task.
- **D6 (Q2):** keep theme-split D1 on the trip view; `hero.text` + `hero.scrim` only where text sits on a photo
  (welcome, photo viewer).
- **D7 (Q3):** keep today's copy; Â§11 voice and strings are their own task.
- **D8 (Q4):** category icons wait for the expenses UI; DESIGN.md is copied with both lists as they are.
- **D9 (Q5):** DESIGN.md is enough; the prototype PDF is not used as a layout source.
- **D10 (Kacper, 2026-10-22, step 3):** new generic tokens instead of borrowing input/expense tokens:
  `components.button.borderWidth: 1`, `components.focusRing: { width: 2, offset: 2 }`, `motion.press: { scale: 0.98 }`
  (design-context §14.18; documented in its Project notes).
- **D11 (Kacper, 2026-10-22, step 3):** a disabled Google / Discord button keeps its provider colors, with no opacity
  and no disabled tokens (keeps auth-onboarding D16 minus the dimming); disabled shows through no response and
  `accessibilityState.disabled`. Exception to A5 for these two buttons only.
- **D12 (Kacper, 2026-10-22, step 3):** the hero buttons (`HeroMenuButton`, `TripMenuButton`) switch to the new
  `layout.compactBreakpoint` (390) now. Accepted temporary mismatch: on 360–389 dp widths they sit at the 16 dp gutter
  while screens still on legacy use the 360 breakpoint (20 dp), until steps 6–7 move those screens; on the home route
  `src/app/(drawer)/(tabs)/index.tsx` (renders `HeroMenuButton`, legacy 360 at its own gutters) it lasts until step 10.
- **D13 (Kacper, 2026-10-22, step 4):** `StepIndicator` (no §8 section) keeps today's 4 dp bar (`spacing[1]`), track
  `border.subtle`, fill `brand.primary`, label `bodySM` in `text.secondary`; no layout change.
- **D14 (Kacper, 2026-10-22, step 4):** Segmented control details the spec leaves open: pressed underlay of an
  unselected segment `surface.primary`; track radius = segment radius + track padding (16, concentric).
- **D15 (Kacper, 2026-10-22, step 4):** `Stepper` label `labelMD`, count `numeric` (§3.3 rule 4).
- **D16 (Kacper, 2026-10-22, step 4):** a disabled field with an error keeps the 2 dp error border (error wins over
  disabled, as in the legacy look; §8.4 is silent).
- **D17 (Kacper, 2026-10-22, step 4):** the segmented control's 2 dp `border.focus` goes on the segment that has focus,
  not only the selected one (§8.15 reads "selected"; this is better for keyboard and screen-reader users).
- **D18 (Kacper, 2026-10-22, step 4):** airport result dividers start at the text column (§8.8), not full width; a
  focused result row compensates its 2 dp inset border so the text does not move (§8.8 "inset").
- **D19 (Kacper, 2026-10-22, step 5):** this branch had no skeleton pulse (profile-screen D9 lives on its branch), so
  D5 means adding it: `TripHeroSkeleton` pulses 1 → 0.5 → 1 over 1200 ms (`motion.microinteraction.skeletonPulse`),
  static under reduced motion. Align with profile-screen's implementation when that branch is merged in (D4).
- **D20 (Kacper, 2026-10-22, step 5):** `SyncIndicator` pending: icon in `sync.pending`, text in `text.secondary`
  (light `sync.pending` text is ~3.6:1, below AA). Failed stays icon + text in `sync.failed`.
- **D21 (Kacper, 2026-10-22, step 5):** dialog and sheet fades use `duration.standard` (180 ms; dialog was 220 ms).
- **D22 (Kacper, 2026-10-22, step 5):** new token `components.emptyState.illustrationSize: 96` (§8.20, §14.18) for the
  empty-state illustration instead of borrowing `spacing[24]`.
- **D23 (Kacper, 2026-10-22, step 6):** the pill tab bar's bottom offset moves from 16 to the §8.14 12 dp in step 7,
  together with `CurrentTrip` (shared hook `src/features/nav/usePillClearance.ts`); step 6 keeps 16.
- **D24 (Kacper, 2026-10-22, step 6):** all tab icons are 22 dp, so the old selected-icon grow (20 → 24) becomes a fade-in
  of the selected `brand.tint` capsule over `duration.standard`, only when `useReduceMotion() === false` (§7.3).
- **D25 (Kacper, 2026-10-22, step 6):** `EmptyScreen` (placeholder tabs) keeps its top-aligned title + sentence, only
  restyled; no §8.20 centring and no 320 dp text-width token (the screens are temporary).
- **D26 (Kacper, 2026-10-22, step 6):** the open trip's drawer row is `brand.tint` with a `text.brand` check, like the
  selected tab and chip. The drawer scrim is black at the bottom-sheet backdrop opacity (0.48, A6), and the drawer
  skeleton rows pulse like D19.
- **D27 (Kacper, 2026-10-22, step 6):** pill tab min width is §8.14's 56 dp from `layout.compactBreakpoint` (390) up and
  `layout.touchTarget` (44) below it, because five 56 dp tabs need 328 dp and overflow a 320 dp phone. `EmptyScreen`
  keeps two gutter tiers (16 / 20, no ≥768 tablet tier) under D25, as before the step.

- **Q1 Skeleton:** keep today's opacity pulse (profile-screen D9, 1200 ms) in the new `skeleton.base` color, or switch
  to the DESIGN.md Â§8.19 shimmer (`skeleton.highlight` sweeping, 360 ms per pass, static under reduced motion)?
  Recommendation: keep the pulse now (less new code, already tested), shimmer as a later small task.
- **Q2 Hero text in light mode:** today (theme-split D1) the photo fades into paper and the name/dates are dark text
  below the photo. DESIGN.md puts white `hero.text` over the `hero.scrim`. Recommendation: keep D1 (text sits on the
  canvas, not on the photo); use `hero.text` + scrim only where text really sits on a photo (welcome, photo viewer).
- **Q3 Copy:** apply the DESIGN.md Â§11 voice and canonical strings now, or keep today's texts? Recommendation: keep,
  copy review as its own task.
- **Q4 Category icons:** DESIGN.md has two lists (Â§2.8 `UtensilsCrossed`, `Route` vs Â§8.6 `Utensils`, `BusFront`).
  No current screen shows expense categories, so it waits for the expenses UI; I fix nothing in the doc without your
  choice.
- **Q5 Prototype PDF:** I could only read its text (no PDF renderer on this machine), not the visuals. If spacing or
  layout details from the prototype matter beyond DESIGN.md, send PNG screenshots of the five screens or let me
  install poppler to render the pages.
- Risk: the migration touches nearly every UI file; conflicts with any parallel UI work. Mitigated by D4 (start after
  profile-screen) and by one commit per group.
- Risk: existing UI tests assert old hex values; each rewrite is logged so no assertion is silently weakened.
