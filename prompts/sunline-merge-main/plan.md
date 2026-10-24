# Task: Merge `main` into `feature/sunline-redesign` — fix the 5 test failures
Status: done (2026-10-24)

## Decisions (Kacper, 2026-10-24, with the approval)
- **D1 (Q1):** the `AppLoading` menu and pill placeholders use `border.default` in both schemes.
- **D2 (Q2):** every skeleton block uses `skeleton.base`, in the cards too; a test proves it differs from the card
  (`surface.primary`) in both schemes.

Context: `prompts/sunline-redesign/plan.md` D4 (profile-screen is merged into this branch before step 10), D19 (align the
skeleton pulse with profile-screen's implementation once it is merged). PR #24 had conflicts with `main` after PR #23
(profile-screen, app-loading-skeleton, coderabbit-pr23-fixes-2) landed.

## Understanding & assumptions
The merge of `origin/main` is in the working tree, not committed. The 8 conflicts are resolved (see Progress log). Typecheck
and lint are green. 9 tests in 5 suites fail on the seam between the Sunline theme and code that came from `main`:

| # | Test | What fails | Cause |
|---|---|---|---|
| A | `src/__tests__/app/auth-gate.test.tsx:597` | `SplashScreen.hideAsync` was called while the gate is loading | main's test expects the native splash to stay until the first answer; on this branch splash-animation hides it on mount and `AnimatedSplash` covers the gate. The test is out of date, not the code. |
| B | `src/__tests__/app/layout.test.tsx:95` (light + dark) | `app-loading` background is legacy `#F7F3EA` / `#111712`, expected Sunline `background.canvas` | the merge put main's `AppLoading` (legacy theme) where this branch had a blank Sunline canvas view |
| C | `HomeSkeleton.test.tsx:127`, `AppLoading.test.tsx:116` (light + dark) | the hero skeleton is Sunline `skeleton.base` (`#EEE8DE`), expected legacy `colors.skeleton` (`#DDD5C7`) | `TripHeroSkeleton` is Sunline (step 5), but `HomeSkeleton` / `AppLoading` / `SkeletonBlock` around it are legacy: the loading screen mixes two themes |
| D | `AppLoading.test.tsx:94` | pill placeholder `bottom` 46, expected 50 | the real pill moved 16 → 12 dp from the bottom (D23, `usePillBottomOffset`); the placeholder follows the real pill, which is its purpose (app-loading-skeleton D2); the test hardcodes the old `spacing[4]` |
| E | `src/__tests__/app/profile.test.tsx:891`, `:899` | two extra `withTiming(1)` calls | Sunline's `usePressScale` (step 3) also calls `withTiming`; the test assumes the skeleton is the only caller on the screen |

**Done means:** the 5 failures are fixed without weakening any assertion, the loading screen (gate + home) uses one theme,
full suite / typecheck / lint green, verifier PASS, `Architecture.md` conflicts resolved to match the code, the merge
committed and pushed to `feature/sunline-redesign`, PR #24 mergeable.

### Assumptions (correct me if wrong)
- **A1** A, D and E are test bugs, not code bugs: the code does what the later decisions say (splash-animation, D23,
  step 3). Fixing them is "a test itself is wrong" (CLAUDE.md), logged here.
- **A2** B and C are not test bugs: they show a real mixed-theme loading screen. Fixing them means moving the loading chain
  (`SkeletonBlock`, `HomeSkeleton`, `AppLoading`) to Sunline now, ahead of step 10. That is the D19 alignment.
- **A3** `ProfileScreen` and `TravelStatsCard` stay on legacy until step 10, but they use `SkeletonBlock`, so their
  skeleton blocks turn Sunline `skeleton.base` from this task on. Accepted short mismatch until step 10.
- **A4** The home route `src/app/(drawer)/(tabs)/index.tsx` stays legacy until step 10 (D12); it renders `HomeSkeleton`,
  which after this task is Sunline, like `CurrentTrip` already is.

## Approach
1. Fix the three outdated tests (A, D, E), each to assert the current intended behavior.
2. Move `SkeletonBlock` to Sunline: color `skeleton.base`, pulse `motion.microinteraction.skeletonPulse`
   (1 → 0.5 → 1, 1200 ms, unchanged), default radius `components.skeleton.radius`. Keep its Reanimated pulse (it is the
   one profile-screen built and tested), its props (`radius`, `color`) and reduce-motion behavior.
3. Make `TripHeroSkeleton` a full-width `SkeletonBlock` of the hero height with `radii.none` (as in main, D19), instead of
   its own `Animated` pulse. Move `HomeSkeleton` and `AppLoading` to Sunline tokens (canvas, card spec as `CurrentTrip`'s
   cards, `tabs.height` for the pill placeholder, gutters `layout.screenGutterCompact` / `screenGutter`).
4. Docs: resolve `Architecture.md` to the code, log everything, commit the merge, push.

**Rejected:** keep `AppLoading` / `HomeSkeleton` legacy until step 10 and rewrite B / C to accept a mixed screen — faster,
but the loading screen shows two themes for the whole of step 10 and B / C would assert a look nobody wants.

## Data structures (Zod)
None. No schema, migration or data change.

## Tests
- **Step 1 (A, D, E):**
  - A: the loading view test asserts the splash-animation behavior: `SplashScreen.hideAsync` is called once on mount, and
    `app-loading` with the home skeleton is still rendered under `splash-overlay`.
  - D: the placeholder's `bottom` equals `usePillBottomOffset()` (insets.bottom + `tokens.spacing[3]`), i.e. the real pill's.
  - E: the pulse assertions count only the skeleton's calls: `usePressScale` is mocked to a no-op in this suite (or the
    `withTiming` legs are taken from the `withRepeat` argument), so the test again proves "one cycle per skeletonPulse"
    and "no animation with reduced motion".
  - Red: A, D, E already fail on the merged tree; after the change they pass, and each still fails if the behavior it
    guards is broken (checked by reverting the code value once).
- **Step 2 (`SkeletonBlock`):** in `SkeletonBlock.test.tsx`, light and dark: default color `skeleton.base`, default radius
  `components.skeleton.radius`, `color` / `radius` props still override, pulse legs `[minOpacity, 1]` over
  `skeletonPulse.duration`, static with reduce motion on or unknown, hidden from screen readers. Red: color, radius and
  timing tokens fail against the legacy implementation.
- **Step 3 (hero, home skeleton, app loading):**
  - `TripHero.test.tsx`: `TripHeroSkeleton` is a `SkeletonBlock` (full width, hero height, `radii.none`, `skeleton.base`),
    pulses, static with reduce motion on.
  - `HomeSkeleton.test.tsx`: cards on `surface.primary` with the card spec (border, radius, padding as `CurrentTrip`),
    blocks visible on the card in light and dark (Q2), gutters at 389 / 390 dp.
  - `AppLoading.test.tsx`: canvas `background.canvas`; menu placeholder 44 dp, `radii.pill`; pill placeholder `tabs.height`
    tall, at `usePillBottomOffset()`; chrome color per Q1, light and dark.
  - `layout.test.tsx` (B): unchanged; it passes once `AppLoading` is on the canvas.
  - Red: every new color / size assertion fails against the legacy components.

## Files
- Tests: `src/__tests__/app/auth-gate.test.tsx`, `src/features/auth/__tests__/AppLoading.test.tsx`,
  `src/__tests__/app/profile.test.tsx`, `src/components/__tests__/SkeletonBlock.test.tsx`,
  `src/components/__tests__/TripHero.test.tsx`, `src/features/home/__tests__/HomeSkeleton.test.tsx`.
- Code: `src/components/SkeletonBlock.tsx`, `src/components/TripHeroSkeleton.tsx`, `src/features/home/HomeSkeleton.tsx`,
  `src/features/auth/AppLoading.tsx`.
- Docs: `Architecture.md` (merge conflicts), `prompts/sunline-redesign/plan.md` (progress log, step 10 scope), this plan.

## Skills
- test-driven-development — steps 1–3 — red → green.
- frontend-ui-engineering — step 3 — states, accessibility of the loading screen.
- code-review-and-quality — verifier, after steps 1–3.
- git-workflow-and-versioning — step 4 — the merge commit and push.

## Steps
- [x] 1. [frontend] Fix the outdated tests A, D, E. — skill: test-driven-development — tests first: Tests step 1 — verify: the 3 suites green, full suite, typecheck, lint.
- [x] 2. [frontend] `SkeletonBlock` on Sunline. — skill: test-driven-development — tests first: Tests step 2 — verify: full suite, typecheck, lint.
- [x] 3. [frontend] `TripHeroSkeleton` as a `SkeletonBlock`; `HomeSkeleton`, `AppLoading` on Sunline (fixes B, C). — skill: test-driven-development, frontend-ui-engineering — tests first: Tests step 3 — verify: full suite, typecheck, lint; verifier.
- [x] 3b. [tester] Device run on an iOS iPhone simulator (Kacper, 2026-10-24): the loading screen on a cold start under the animated splash and right after sign-in without it, the home skeleton and the profile photo skeleton, light + dark; colours per D1 / D2, pulse, no mixed theme. — skill: none — verify: PASS per scenario with screenshots; the app must be running on the simulator first (the orchestrator builds and launches it).
- [x] 4. [orchestrator] `Architecture.md` conflicts resolved to the code; progress logs; merge commit; push; check PR #24 is mergeable. — skill: git-workflow-and-versioning — verify: no conflict markers, every statement checked in the code.

## Verification
- Full suite with `pnpm exec jest --maxWorkers=3` (the machine is under heavy Spotlight load; a timeout is rerun before it
  counts as a failure), `pnpm typecheck` (route types regenerated once Metro has run), `pnpm lint`.
- Verifier after step 3, against this plan and `context/design-context.md` §8.19 / §10.
- Device check of the loading screen: step 3b, the `tester` agent on an iOS iPhone simulator (Kacper, 2026-10-24). The
  full device run of the redesign stays sunline-redesign step 12.

## Progress log
- Merge (2026-10-24, before this plan): conflicts resolved —
  - `src/theme/theme.ts`, `tokens.ts`, `context/design-context.md`, `TripHeroSkeleton.tsx` + `TripHero.test.tsx`: this branch;
  - main's additions to the old theme (`colors.skeleton`, `opacity.skeletonPulseMin`, `duration.skeletonPulse`) moved to `src/theme/legacy/`;
  - main-only UI on the old theme (`SkeletonBlock`, `AppLoading`, `HomeSkeleton`, `ProfileScreen`, `SettingsScreen`,
    `TravelStatsCard`, their tests incl. `settings.test.tsx`, `code-email-template.test.ts`) repointed to `theme/legacy` (import rewrite only, like step 2);
  - `src/app/_layout.tsx`: `AnimatedSplash` (this branch) over main's `AppLoading` while loading; the settings header on
    Sunline tokens (`background.canvas`, `text.primary`, `headingSM`, `layout.touchTarget`);
  - `.claude/launch.json`: both configurations kept;
  - `Architecture.md`: not resolved yet (step 4).
  - Gate after it: typecheck ✓, lint ✓, tests 9 failed in 5 suites (the table above), the rest green.
- Step 1 (2026-10-24): tests only, no production code · A `auth-gate.test.tsx`: `hideAsync` called once on mount and
  `splash-overlay` present, the skeleton assertions above it unchanged · D `AppLoading.test.tsx`: pill `bottom` =
  `insets.bottom + tokens.spacing[3]` (the real pill's offset) · E `profile.test.tsx`: `usePressScale` mocked to a no-op,
  expected pulse values unchanged · red ✓ all three on the merged tree for the reasons in the table · green ✓ · guard
  check (break the code once, see red, revert): A by removing `SplashScreen.hideAsync()`, D by `spacing[3]` → `[4]` in
  `usePillBottomOffset`, E by `withRepeat(…, -1)` → `3` in `SkeletonBlock` (the reduced-motion test is not covered by that
  break; it asserts no `withRepeat` / `withTiming`, which only holds with the press scale mocked) · no code diff left ·
  gate: typecheck ✓, lint ✓, 3146 passed / 5 failed (exactly B and C: `layout.test.tsx` light + dark,
  `AppLoading.test.tsx` chrome light + dark, `HomeSkeleton.test.tsx` card blocks) · skill used: test-driven-development ·
  deviations: none.
- Step 2 (2026-10-24): `SkeletonBlock.tsx` on `@/theme/useTheme` + `tokens`: default colour `skeleton.base` (D2),
  default radius `components.skeleton.radius`, pulse from `motion.microinteraction.skeletonPulse`; Reanimated pulse,
  props and `aria-hidden` unchanged · `SkeletonBlock.test.tsx` on Sunline tokens: radius, colour (light + dark),
  pulse legs (light + dark), overrides, no scale, reduce motion on / unknown · red ✓ 2 of 9 (radius 8 → 12, colour
  `#DDD5C7` → `#EEE8DE`); the pulse tests were green before too (legacy 1200 ms / 0.5 equal the Sunline values) · green ✓
  9/9 · gate: typecheck ✓, lint ✓; full suite with 22 load timeouts, green on rerun; deterministic failures = the 5 known
  (B, C) + 3 new in `profile.test.tsx` (photo skeleton light + dark ~:467, `stat-skeleton` dark ~:1045), which assert the
  legacy `colors.skeleton` through `SkeletonBlock`'s default; baseline check: with the old component exactly the 5 known
  fail · skill used: test-driven-development · deviation: the 3 profile tests were foreseen by A3 (the profile's
  skeletons turn `skeleton.base` before the screen moves in sunline step 10); they move to step 3 (their expected colour
  becomes `skeleton.base`, same assertion) and `src/__tests__/app/profile.test.tsx` joins step 3's files.
- Step 3 (2026-10-24, code + verifier done, **not marked [x]** until the step-3b device run) · changed:
  - `TripHeroSkeleton.tsx` is a full-width `SkeletonBlock` of `heroHeight` with `radii.none`; its own `Animated` pulse is
    gone (D19);
  - `HomeSkeleton.tsx` on Sunline: the shared `Card` (§8.9, as `CurrentTrip`'s sections), gutters
    `layout.screenGutterCompact` / `screenGutter` at `compactBreakpoint`, `maxContentWidth`, blocks `skeleton.base` (D2, the
    dark-card special case removed), heights `headingSM` / `bodyMD` / `moneyLG` / `button.compactHeight`;
  - `AppLoading.tsx` on Sunline: `background.canvas`; menu placeholder `components.iconButton.size` / `radius` at
    `HeroMenuButton`'s position; pill placeholder `components.tabs.height`, `PillNav`'s width rule, at
    `usePillBottomOffset()`; both in `border.default` (D1).
  - Tests:
    - `TripHeroSkeleton.test.tsx` (7: geometry, colour light + dark, Reanimated pulse, static with reduce motion on /
      pending / rejected; red 2 of 7);
    - `HomeSkeleton.test.tsx` (13: card spec light + dark, blocks `skeleton.base` and ≠ `surface.primary` in both schemes,
      gutters 389 / 390; red 4 of 13);
    - `AppLoading.test.tsx` (11: canvas, menu and pill geometry, chrome `border.default` light + dark; red 4 of 11);
    - `profile.test.tsx` 3 expected colours → `colors[scheme].skeleton.base` (step-2 deviation);
    - `layout.test.tsx` unchanged, now green (B).
  - Verifier round 1: FAIL. Blocker: the dropped "stops pulsing when it unmounts" test left
    `SkeletonBlock`'s `cancelAnimation` cleanup untested. Fixed: `SkeletonBlock.test.tsx` "cancels the pulse when it
    unmounts, and not before" (`cancelAnimation` mocked; guard check: fails without the `cancelAnimation(opacity)` line,
    passes with it). Minor fixed: the menu placeholder uses the icon button's tokens.
  - Verifier round 2: PASS.
  - Gate: typecheck ✓, lint ✓, 146 suites / 3153 tests ✓ (`--maxWorkers=3`, no reruns).
  - Skills used: test-driven-development, frontend-ui-engineering (implementer), code-review-and-quality (verifier).
  - Deviations:
    - the hero assertions live in `src/components/__tests__/TripHeroSkeleton.test.tsx`, not `TripHero.test.tsx` as the
      Files list said;
    - `HomeSkeleton.test.tsx` no longer asserts `theme.elevation.card`, because the Sunline `Card` has no shadow (§8.9:
      a 1 dp `border.subtle`, now asserted instead).
  - Notes:
    - the `usePressScale` mock in `profile.test.tsx` is suite-wide (`usePressScale` has no test of its own, nothing lost);
    - dark `skeleton.base` `#292724` on `surface.primary` `#201F1D` is low contrast; the test proves they differ, the eye
      check is 3b.
- Step 3b (2026-10-24, tester on the iPhone 17 simulator, iOS 27.0, Expo Go, Kacper signed in): no FAIL; partly observed.
  - Setup: Expo Go installed with Kacper's OK (`expo start --ios`, new launch config `expo-ios-simulator`); Expo Go crashed
    once on its own intro sheet's "Continue" (`ExpoFabricView: The app context has been lost`, Expo Go, not the app).
  - PASS:
    - light hand-over to home: menu, pill and first card at the same positions in the skeleton and the loaded frame;
    - light home skeleton: square full-width hero, cards `surface.primary` with a 1 dp border, blocks `skeleton.base`
      (no legacy beige);
    - dark profile photo skeleton: pulsing disc close to `skeleton.base` on the legacy profile (A3).
  - Not observed (too fast under the animated splash or cached):
    - the `AppLoading` placeholders in light and dark;
    - the dark home skeleton and dark hand-over, so the dark block contrast is still unjudged;
    - the light profile skeleton.
  - Screenshots are not colour-exact (canvas `#F8F4EC` read as `#F9F6EF`).
  - Evidence: `light-cold/`, `dark-cold/`, `dark-hand*/`, `dark-profile/`, `light-profile/` in the session scratchpad.
  - **D3 (Kacper, 2026-10-24):** this evidence is enough; steps 3 and 3b are closed, and the screens not observed move to
    `prompts/sunline-redesign/plan.md` step 12.
- Step 4 (2026-10-24):
  - `Architecture.md` conflicts resolved to the code: the header names this task; the root-layout row has `AppLoading`
    under `AnimatedSplash` and the `settings` route with its Sunline header; the components row has `TripHeroSkeleton` as
    a `SkeletonBlock` and the `SkeletonBlock` contract on Sunline. Key decisions and changelog keep both sides.
  - Also updated, because they no longer matched the code: `AppLoading`, `HomeSkeleton` and `SkeletonBlock` descriptions;
    main's skeleton-colour decisions are marked as superseded here by D1 / D2.
  - Changelog entry added.
  - `.claude/launch.json`: new `expo-ios-simulator` configuration (3b).
  - Merge committed and pushed.

## Risks & open questions
- **Q1 — Chrome over the skeleton.** In main the menu and pill placeholders of `AppLoading` use legacy `input.border`
  (profile-screen D25, D27), so they show over the hero skeleton. Sunline equivalent? Recommendation: `border.default`
  (light `#B8B1A6` on `skeleton.base` `#EEE8DE`; dark `#4D4943` on `#292724`: stands out in both). Alternative:
  `skeleton.highlight` (light `#FFFCF7`, dark `#35322F`; weaker in dark).
- **Q2 — Blocks inside the cards in dark.** In main the dark card is `surface.secondary` and its blocks use
  `surface.elevated` (app-loading-skeleton D5) because the default block color was too close to the card. With Sunline the
  card is `surface.primary` and blocks are `skeleton.base` (light `#EEE8DE` on `#FFFCF7`; dark `#292724` on `#201F1D`, a small
  difference). Recommendation: `skeleton.base` everywhere and a test that it
  differs from the card in both schemes; only if it does not, pick another role (ask then).
- Risk: `ProfileScreen` / `TravelStatsCard` show Sunline skeleton blocks on a legacy screen until step 10 (A3).
- Risk: the drawer rows, `PhotoSkeleton` and `CoverImage` keep their own skeletons (not `SkeletonBlock`); unifying them is
  not part of this task (step 11 cleanup can propose it).
