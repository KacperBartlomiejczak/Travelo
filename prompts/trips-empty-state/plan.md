# Task: Home screen — empty trips state with "Create trip" button
Status: done (2026-10-03) — awaiting Kacper's manual UI check

## Understanding & assumptions
The home route (`/`) shows the **Trips** screen in its **empty state**: no trips exist, so the user sees an illustration, a short message and one primary action, "Create trip". Tapping it navigates to a new placeholder route `/trips/new`.

**Done means:** the home screen renders the empty state in light and dark mode, in Polish and English, using only theme tokens and i18n keys; the button navigates to `/trips/new`; the full test suite, typecheck and lint are green; `Architecture.md` is updated.

Decisions from Kacper (2026-10-03):
- **D1 — UI only.** The screen always shows the empty state. No Trip schema, no Supabase, no TanStack Query in this task. Loading / error / offline states come with the data task, because a static screen has no data to load or fail.
- **D2 — Button target.** "Create trip" navigates to `/trips/new`, a placeholder screen with a title only. The trip form is a separate task.
- **D3 — Button placement.** Illustration + text centred; one full-width primary button pinned to the bottom (thumb zone, above the safe area). No header "+" action.
- **D4 — i18n.** Add `i18next`, `react-i18next`, `expo-localization` (installed with `npx expo install`).
- **D5 — Fallback language (Q1).** A device locale other than pl/en falls back to **English**.
- **D6 — Package manager.** Kacper (2026-10-03): switch from npm to **pnpm** (npm was too slow). `pnpm import` kept the exact versions from `package-lock.json`; `.npmrc` sets `node-linker=hoisted` for React Native / Jest compatibility; `package-lock.json` removed.
- **D7 — Back button (Kacper, 2026-10-03).** On `/trips/new` the back button shows the arrow + `Twoje podróże` / `Your trips` (i18n key `trips.title`), never the route name `index`.
- **D8 — Native header style (Kacper, 2026-10-03).** Native Stack headers use theme tokens: `background` colour, `text.primary` tint, title in Heading 3 (DM Sans Bold 18; native-stack applies only font family/size), no header shadow.
- **D9 — Disabled primary button (Kacper, 2026-10-03).** Light mode follows §10.1 (`neutral.200` / `neutral.500` = roles `border` / `text.tertiary`); dark mode uses the same roles (`#39443B` / `#9E978B`). Exposed as `colors.action.disabled` / `colors.action.onDisabled`.
- **D10 — Focus ring (Kacper, 2026-10-03).** 2dp ring in `action.primary`, offset 4dp (`spacing[1]`) from the button so it stays visible on a brand-coloured button. Token `size.focusRing = 2`.
- **D11 — Spacing (Kacper, 2026-10-03).** Button: vertical padding `spacing[3]` (12, only matters when text grows), icon→label gap `spacing[2]` (8). Trips screen: side padding 20 (`spacing[5]`), top = safe-area + 16, title `Twoje podróże` Heading 1 left-aligned; empty state centred vertically and horizontally — illustration 160×160 → 24 (`spacing[6]`) → heading (Heading 2) → 8 (`spacing[2]`) → description (Body M, text secondary); full-width primary button; bottom = safe-area + 16 (§5.2).
- **D12 — Illustration (Kacper, 2026-10-03).** Suitcase with a luggage tag: body in brand (`action.primary`), 2dp outline in `text.primary`, tag in `category.transport`. Theme roles, so it adapts to dark mode.

Assumptions (correct me if any is wrong):
- **A1 — Repo layout.** Code goes into the existing root `src/` (`src/app`, `src/theme`, `src/i18n`, `src/components`), not `apps/mobile/` — the monorepo from `CLAUDE.md` does not exist yet (already listed in `Architecture.md` → tech debt). Moving to a monorepo is a separate decision.
- **A2 — Commands.** ~~npm~~ → **pnpm** (D6). Verification runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, as in CLAUDE.md.
- **A3 — Copy** comes from `design-context.md` §13.2 and §11.1:
  - title: `Twoje podróże` / `Your trips`
  - heading: `Nie masz jeszcze żadnej podróży.` / `You don't have any trips yet.`
  - text: `Zaplanuj pierwszą i zaproś znajomych.` / `Plan your first one and invite your friends.`
  - button: `Utwórz podróż` / `Create trip` (with lucide `Plus` icon, 20dp)
  - placeholder screen title: `Nowa podróż` / `New trip`
- **A4 — Screen title** "Twoje podróże" is rendered in the screen content as Heading 1 (DM Sans); the native Stack header is hidden on `/`. `/trips/new` keeps the native Stack header with a back button.
- **A5 — Illustration.** A simple flat SVG drawn by me per §8: 160×160, 2dp outline, max 3 colours (brand + neutral + one category colour), geometric travel object (suitcase). Decorative → hidden from screen readers.
- **A6 — Fonts.** DM Sans and Fraunces (already installed) are loaded in the root layout; the splash screen stays until they are loaded.
- **A7 — Theme scope.** The theme file contains the full token set from design-context §2–§5 (palette, semantic roles light/dark, type scale, spacing, radii). Elevation and motion tokens are **not** added yet — nothing uses them.

## Approach
Build the minimum foundation the screen needs and nothing more: theme tokens with a `useTheme()` hook (light/dark from `useColorScheme`), i18n with pl/en and device-locale detection, font loading in the root layout, a placeholder `/trips/new` route, then the empty Trips screen made of a reusable `PrimaryButton` and the illustration.
Rejected: a generic `EmptyState` component — only one empty state exists so far (no abstractions for single-use code).

## Data structures (Zod)
None. This task adds no entities, payloads or forms (D1). The Trip schema arrives with the data task.

## Tests
- **Step 2 — theme** (`src/theme/__tests__/theme.test.ts`)
  - light roles map to the design-context values (background `#F7F3EA`, text primary `#17211B`, brand `#D85C3A`, …); dark roles likewise (`#111712`, `#F7F3EA`, `#F08A6C`, …)
  - every spacing token is a multiple of 4
  - money styles (`numericXL/L/M`) include `tabular-nums`
  - `useTheme()` returns the dark theme when the colour scheme is `dark`, light for `light` and for `null`
- **Step 3 — i18n** (`src/i18n/__tests__/i18n.test.ts`)
  - device locale `pl-PL` → Polish strings; `en-US` → English
  - unsupported locale (e.g. `de-DE`) → English (D5)
  - `pl` and `en` dictionaries have exactly the same keys (no missing translations)
- **Step 4 — root layout** (`src/__tests__/app/layout.test.tsx`)
  - renders nothing while fonts are not loaded (mocked `useFonts` → `false`)
  - renders the navigator once fonts are loaded
- **Step 5 — `/trips/new`** (`src/__tests__/app/trips/new.test.tsx`)
  - renders the title `Nowa podróż` (pl) / `New trip` (en)
- **Step 6 — `PrimaryButton`** (`src/components/__tests__/PrimaryButton.test.tsx`)
  - renders the label and has `accessibilityRole="button"`
  - calls `onPress` when pressed
  - disabled: does not call `onPress` and exposes `accessibilityState.disabled`
  - loading: shows a spinner, does not call `onPress`, exposes `accessibilityState.busy`
- **Step 7 — Trips empty screen** (`src/__tests__/app/index.test.tsx`)
  - renders title, heading and text from i18n (pl and en)
  - shows exactly one button, labelled `Utwórz podróż`, with accessibility label in the `[Action], [object]` pattern
  - pressing the button calls `router.push('/trips/new')` (mocked `expo-router`)
  - illustration is hidden from accessibility
  - dark scheme → screen background uses the dark background token

## Files
Created:
- `src/theme/tokens.ts`, `src/theme/theme.ts`, `src/theme/typography.ts`, `src/theme/useTheme.ts`
- `src/i18n/index.ts`, `src/i18n/locales/pl.json`, `src/i18n/locales/en.json`
- `src/components/PrimaryButton.tsx`, `src/components/TripsEmptyIllustration.tsx`
- `src/app/trips/new.tsx`
- tests listed above
Modified:
- `src/app/_layout.tsx` (fonts, i18n init, Stack options)
- `src/app/index.tsx` (template placeholder → Trips empty screen)
- `package.json`, `pnpm-lock.yaml` (new), `.npmrc` (new), `package-lock.json` (removed) (3 deps; Jest `transformIgnorePatterns` / setup only if `lucide-react-native` needs it)
- `prompts/trips-empty-state/plan.md`, `Architecture.md`

## Skills
- `stack-review` — before step 1 — done as the i18n dependency question (D4); no further review needed.
- `frontend-design` — steps 6–7 — structure and quality of the button and screen, within design-context tokens.
- `ui-taste` — step 7 — final visual review of the finished screen.

## Steps
- [x] 1. [frontend] **Setup (no tests — pure setup, no behaviour):** `npx expo install i18next react-i18next expo-localization`; confirm Jest runs with a trivial render under `jest-expo`; typecheck + lint green. — skill: none — verify: install succeeds, `pnpm typecheck`, `pnpm lint` green.
- [x] 2. [frontend] Theme tokens + `useTheme()` — skill: none — tests first: theme tests — verify: full suite, typecheck, lint.
- [x] 3. [frontend] i18n setup with pl/en and locale detection — skill: none — tests first: i18n tests — verify: full suite, typecheck, lint.
- [x] 4. [frontend] Root layout: load fonts, init i18n, hide header on `/` — skill: none — tests first: layout tests — verify: full suite, typecheck, lint.
- [x] 5. [frontend] Placeholder route `/trips/new` — skill: none — tests first: new-trip screen test — verify: full suite, typecheck, lint.
- [x] 6. [frontend] `PrimaryButton` component (default, pressed, focused, disabled, loading) — skill: frontend-design — tests first: button tests — verify: full suite, typecheck, lint.
- [x] 7. [frontend] Trips empty screen at `/` with illustration and bottom primary button — skill: frontend-design, ui-taste — tests first: screen tests — verify: full suite, typecheck, lint, manual UI check.
- [x] 8. Update `Architecture.md`.

## Verification
After every step: tests seen red for the expected reason → green; `pnpm typecheck`, `pnpm lint`, `pnpm test` (full suite) green; the `verifier` subagent checks the step against this plan, CLAUDE.md and design-context. No schema/migration/RLS/AI/sync checks apply (no data changes).

Manual UI check for Kacper after step 7:
1. `pnpm start`, open on iOS simulator / device.
2. Light mode: warm paper background, terracotta full-width button at the bottom, above the home indicator.
3. Switch to dark mode: dark green-black background, light text, coral button with dark label.
4. Change the device language to English → English copy; back to Polish → Polish copy.
5. Set text size to the largest accessibility size → text wraps, nothing is cut off, the button grows vertically. (No ScrollView yet — if content overflows on a small phone, report it; scroll vs. smaller illustration is your call.)
5b. VoiceOver (iOS) / TalkBack (Android): focus order is title → heading → description → button; the suitcase illustration is skipped.
6. Tap "Utwórz podróż" → "Nowa podróż" screen; on iOS the back button shows the arrow + "Twoje podróże" (D7; iOS may shorten it if it does not fit), never "index"; back returns to the empty state.
7. With a hardware keyboard (iOS Full Keyboard Access / Android), Tab onto the button → 2dp brand ring, 4dp away from the button (D10).
8. Check that the lucide icon renders on the device (R6: lucide declares RN ^0.87, the project has 0.86).

## Progress log
- Step 1 (setup, no tests by design): `npx expo install i18next react-i18next expo-localization` → `i18next ^26.4.2`, `react-i18next ^17.0.15`, `expo-localization ~57.0.2`; `expo-localization` config plugin auto-added to `app.json`. Switched to pnpm (D6): `.npmrc` (`node-linker=hoisted`), `pnpm import` → `pnpm-lock.yaml`, `package-lock.json` removed, clean `pnpm install` (30 s).
  Temporary smoke test (RN `Text` + lucide `Plus` + `react-native-svg`) found two setup problems, both fixed, then the smoke test was deleted:
  - **R1 confirmed:** lucide ships `.mjs` for the `react-native` condition, which jest-expo does not transform → `package.json` `jest.moduleNameMapper` maps `lucide-react-native` to its CJS build (tests only; the app bundle is unaffected). Tried `transformIgnorePatterns` first — no effect on `.mjs`, reverted.
  - **Deviation:** TypeScript 6.0 defaults `types` to `[]`, so `@types/jest` was not picked up → added `"types": ["jest"]` to `tsconfig.json` (file not in the original Files list).
  Verification: `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` exits non-zero only with "No tests found" (expected until step 2) · R4 peer warning does not break rendering · skill used: none · verifier: PASS.
- Step 2: tests written in `src/theme/__tests__/theme.test.ts` (11 tests) · red ✓ (`Cannot find module '../theme'` — module did not exist yet) · added `src/theme/tokens.ts` (palette §2, dark roles §3.2, semantic/budget/category §2.3–2.5, spacing, radius, sizes §5.2/§7/§8), `src/theme/typography.ts` (§4.2 scale; weight encoded in the `@expo-google-fonts` family name, so no `fontWeight`; money styles use `tabular-nums`), `src/theme/theme.ts` (`lightTheme`, `darkTheme`, `Theme` type), `src/theme/useTheme.ts` · green ✓ 11/11 · `pnpm typecheck` ✓ · `pnpm lint` ✓ · skill used: none.
  Notes: `useColorScheme` is mocked at `react-native/Libraries/Utilities/useColorScheme` without importing it (spying on `Appearance.getColorScheme` does not work because RN imports it internally; importing the deep path breaks typecheck — no type declarations). Added a `size` token group (touch target, button heights, icon sizes, illustration canvas, max content width) — values from design-context §5.2/§7/§8, needed to avoid magic numbers in steps 6–7.
  Verifier: PASS. Follow-ups applied: `budget.near` renamed to `budget.nearLimit` to match design-context §21. **A7 extended:** the `size` group also takes icon sizes (§7) and the illustration canvas (§8), not only §2–§5. Open note: §21 uses both `colors.semantic.*` and `colors.status.*`; the theme uses `colors.status.*` (matches §21's own example `colors.status.error`).
- Step 3: tests written in `src/i18n/__tests__/i18n.test.ts` (4 tests) · red ✓ (`Cannot find module '../locales/en.json'` — i18n did not exist yet) · added `src/i18n/locales/pl.json`, `src/i18n/locales/en.json` (keys `trips.title`, `trips.empty.heading`, `trips.empty.description`, `trips.create`, `newTrip.title`; copy from A3), `src/i18n/index.ts` (own instance via `createInstance()` + `initReactI18next`, `initAsync: false`, language = device's first preferred `languageCode` if pl/en, else `en` per D5) · green ✓ 15/15 (full suite) · `pnpm typecheck` ✓ · `pnpm lint` ✓ · skill used: none.
  Notes: the test re-loads the module per locale with `jest.isolateModules` + `require` (one `eslint-disable-next-line` with a written reason — dynamic `import()` needs `--experimental-vm-modules`). Only the **first** preferred device locale is considered (e.g. `[de, pl]` → English), as D5 is worded.
  Verifier: PASS. Follow-ups applied: `getLocales()[0].languageCode` (the return type is a non-empty tuple) and `Object.hasOwn` instead of `in`. Note for the manual check: the language is read once at startup — on Android a system-language change may only apply after an app restart.
- Step 4: tests written in `src/app/__tests__/layout.test.tsx` (3 tests, real router via `expo-router/testing-library` `renderRouter`, mocked `useFonts` and `expo-splash-screen`) · red ✓ (assertions failed: the template layout rendered immediately and never hid the splash) · `src/app/_layout.tsx`: loads DM Sans 400/500/600/700 + Fraunces 500/600/700 with `useFonts`, `preventAutoHideAsync` at module load, `hideAsync` once ready, returns `null` until ready, imports `@/i18n`, Stack with `headerShown: false` on `index` · green ✓ 18/18 (full suite) · `pnpm typecheck` ✓ · `pnpm lint` ✓ · skill used: none.
  Deviation: added a third test — on a font-loading error the app still renders (system fonts) and hides the splash, following the Expo SDK 57 `useFonts` docs pattern. Hidden header on `/` is not unit-tested (navigator chrome); it is covered by the manual UI check.
  **Verifier: FAIL (blocker in the plan, not the code).** Expo Router treats every file under `src/app/` as a route, including `src/app/__tests__/layout.test.tsx` (confirmed with the installed `getRoutes`: it creates a `/__tests__/layout.test` route). That file would pull `expo-router/testing-library` (`node:fs`, `jest.mock`, `expect`) into the app bundle. **Plan change (approved by Kacper 2026-10-03):** route tests move to `src/__tests__/app/` mirroring the route path — `src/__tests__/app/layout.test.tsx`, `src/__tests__/app/trips/new.test.tsx`, `src/__tests__/app/index.test.tsx`. Only the test file location and its import path change; `_layout.tsx` stays as is.
  After the move: test at `src/__tests__/app/layout.test.tsx` (imports `@/app/_layout`), `src/app/` holds only route files · 18/18 ✓ · typecheck ✓ · lint ✓ · **Verifier re-check: PASS** (installed `getRoutes` no longer produces a test route).
- Step 5: tests written in `src/__tests__/app/trips/new.test.tsx` (2 tests, real router with `RootLayout`, `initialUrl: '/trips/new'`, language set via `i18n.changeLanguage`) · red ✓ (`Could not locate module @/app/trips/new` — the route did not exist) · added `src/app/trips/new.tsx`: native Stack header with `title: t('newTrip.title')` and back button; header and body use theme tokens (`background`, `text.primary`, `typography.heading3`, no header shadow) so dark mode is not a white screen · green ✓ 20/20 (full suite) · `pnpm typecheck` ✓ · `pnpm lint` ✓ · skill used: none.
  Test fix (logged per CLAUDE.md): the first version asserted `getByText('Nowa podróż')`, which failed although the title was correct — the native header renders as `RNSScreenStackHeaderConfig` with a `title` prop, not as `<Text>`. The query now reads the title from that header config; the assertion (exact title, pl and en) is unchanged in strength.
  Verifier: PASS. Follow-up from D7: added test `labels the back button with the trips list title, not the route name` · red ✓ (`backTitle` was `undefined`) · `headerBackTitle: t('trips.title')` in `src/app/trips/new.tsx` · green ✓ 21/21 · typecheck ✓ · lint ✓. D8 recorded (header style kept). Verifier re-check: PASS.
- Step 6: skill `frontend-design` loaded — design-context wins (its terracotta-on-paper palette is mandated, so kept); used for content/quality rules: verb-first label, no `→`, no all-caps, visible focus, a11y. Design-context gaps asked and decided as D9 (dark disabled colours) and D10 (focus ring offset).
  Theme follow-up (tests first): added 2 tests to `src/theme/__tests__/theme.test.ts` · red ✓ (`undefined`) · `colors.action.disabled` / `onDisabled` in `src/theme/theme.ts`, `size.focusRing` in `src/theme/tokens.ts` · green ✓.
  Button: tests in `src/components/__tests__/PrimaryButton.test.tsx` (7 tests: role + label + default colours/height/radius, onPress, pressed colour, leading icon hidden from screen readers, disabled, loading/busy/spinner, focus ring on focus/blur) · red ✓ (`Cannot find module '../PrimaryButton'`) · added `src/components/PrimaryButton.tsx` (`Pressable`; `minHeight` 52 so it can grow with Dynamic Type; label wraps; optional lucide icon 20dp stroke 2; loading replaces the icon with a spinner and keeps the label) · green ✓ 30/30 (full suite) · `pnpm typecheck` ✓ · `pnpm lint` ✓ · skill used: frontend-design.
  **Deviation (TDD slip, logged):** the pressed colour was implemented before its test. Fixed by adding `uses the pressed color while pressed` afterwards and proving it meaningful: with the pressed branch removed the test failed (red ✓), with it restored it passed. Test fix: the icon test first used `getByTestId`, which skips the `aria-hidden` lucide icon; it now queries with `includeHiddenElements` and asserts the icon is hidden from accessibility (stronger than before).
  Verifier: PASS (6 own mutations, each caught). Follow-up: added regression assertions for horizontal padding, label typography/colour, icon size and stroke (they pass on the existing code; added after the code, logged). Open: `paddingVertical` 12 and icon–label `gap` 8 are not in §10.1 → asked Kacper before step 7.
- Step 7: tests written in `src/__tests__/app/index.test.tsx` (7 tests, real router) · red ✓ (all 7 failed on the template screen: no copy, no button, no illustration, no themed background) · added `src/components/TripsEmptyIllustration.tsx` (D12; SVG 160×160, theme roles, 2dp outline, hidden from screen readers) and `src/app/index.tsx` (D11 layout: Heading 1 title as `header`, centred empty state, full-width `PrimaryButton` with `Plus`, `router.push('/trips/new')`, safe-area insets, max content width 720 centred for tablets) · green ✓ 37/37 · typecheck ✓ · lint ✓.
  Deviation: navigation is tested through the real router (`getPathname()` goes from `/` to `/trips/new` after the press) instead of a mocked `router.push` — stronger than planned.
  `ui-taste` review (polish playbook) on the rendered screen via Expo Web in the built-in browser (Kacper's running `expo start` on :8081; `.claude/launch.json` added for previews): light + dark at 375×812, compact 320×640, tablet 768×1024, and the tap → `/trips/new` flow. Findings fixed in one batch:
  1. `react-native-svg` leaked the native-only `accessibilityElementsHidden` / `importantForAccessibility` props into the DOM on web (React warnings) → replaced with `aria-hidden` (works on iOS, Android, web); the a11y test still passes.
  2. **Spec gap:** design-context §18 requires 16dp side padding below 360dp, which D11 missed → tests first (red ✓: `breakpoints.compact` undefined; padding stayed 20 at 320dp) → `breakpoints.compact = 360` token + `useWindowDimensions` in the screen → green ✓ 40/40; checked in the browser: 16px at 320dp, 20px at 375dp.
  Not verifiable on web: the iOS back-button label (D7), Dynamic Type at 200%, the native keyboard focus ring — they stay in the manual UI check. Skills used: frontend-design (structure), ui-taste (review).
  **Verifier: FAIL (blocker).** The ui-taste fix #1 regressed native accessibility: `aria-hidden` on `Svg` never reaches iOS/Android (RN converts `aria-hidden` to `accessibilityElementsHidden` / `importantForAccessibility` only inside `View.js`; `react-native-svg` passes props straight to the native view; RN 0.86 keeps `enableNativeViewPropTransformations` off). The test gave false confidence because RNTL reads the JS prop.
  Fix: test first — red ✓ (`accessibilityElementsHidden` was `undefined`); then the `Svg` is wrapped in `<View aria-hidden>` (SVG testID moved to `trips-empty-illustration-svg`). **Test correction (logged):** the first red assertion expected the converted native props on the host element, but Jest mocks `View` as a pass-through, so the conversion cannot be observed in Jest. The assertion now checks the real contract: the hidden element is a React Native `View` with `aria-hidden` (View.js in RN 0.86 converts it — verified in source). Proven by mutation: with `aria-hidden` back on the `Svg` the test fails (`Expected "View", received "RNSVGSvgView"`); restored → green ✓ 40/40 · typecheck ✓ · lint ✓. Web check: wrapper `div` has `aria-hidden="true"`, SVG has no leaked props.
  Open (non-blocking, from verifier): no `ScrollView` — at 200% Dynamic Type on a small phone the content may not fit. Covered by manual check 5; if it overflows, Kacper decides (scroll vs. smaller illustration).
  Verifier re-check: PASS.
- Step 8: `Architecture.md` rewritten to match the code (theme, i18n, routes, components, testing notes, pnpm, decisions D1–D12, tech debt, changelog); every statement checked against the repo. Final: 6 suites / 40 tests ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✓.

## Risks & open questions
- ~~Q1 — Fallback language~~ — answered: English (D5).
- **R1 — Jest + ESM packages.** `lucide-react-native` / `react-native-svg` may need a `transformIgnorePatterns` entry in the Jest config. If so, it is added in the step that first needs it and logged here.
- **R2 — Expo SDK 57 APIs.** `expo-localization` and `expo-font` APIs are checked against the v57 docs before use (AGENTS.md).
- **R3 — Repo layout** (A1) differs from CLAUDE.md; already logged as tech debt in `Architecture.md`.
- **R4 — Peer warning:** `test-renderer` (dependency of RNTL 14) wants `react@^19.3.0`; the project has `19.2.3` (pinned by Expo SDK 57). Checked by the step 1 smoke test.
- **R7 — Route tests location.** Test files must never live under `src/app/` (every file there becomes a route). Route tests go to `src/__tests__/app/`.
- **R6 — lucide peer range:** `lucide-react-native@1.50` declares peer `react-native ^0.87.1`; the project has `0.86.3` (Expo SDK 57). Renders fine in tests; check on device in the manual UI check.
- **R5 — iCloud.** The repo lives on the iCloud-synced Desktop, so `node_modules` is synced too. This is the likely main cause of the slowness, not npm itself.
