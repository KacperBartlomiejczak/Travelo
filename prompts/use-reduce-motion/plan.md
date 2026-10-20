# Task: One shared `useReduceMotion` hook
Status: done (2026-10-19)

## Understanding & assumptions
Found while verifying step 3 of `prompts/theme-split-and-profile-prefill/plan.md` (2026-10-19): six components each subscribe to the system's reduce-motion setting themselves (`AccessibilityInfo.isReduceMotionEnabled()` + the `reduceMotionChanged` listener):
`src/components/BottomSheet.tsx`, `ConfirmDialog.tsx`, `CoverImage.tsx`, `PillNav.tsx`, `Snackbar.tsx`, `src/features/auth/WelcomeScreen.tsx`.
Only `WelcomeScreen` handles a rejected promise (`.catch` → treat as reduced motion). React Native can reject (`AccessibilityInfo.js`: no native module on Android / iOS, or iOS's own `reject`), so the other five can raise an unhandled rejection. `Architecture.md` already lists the duplicated subscription as tech debt.

**Task:** one hook, `src/hooks/useReduceMotion.ts`, used by all six; a rejection is handled the same way everywhere; nothing else changes.

**Done when:** all six use the hook, no subscription code is left in them, every existing component test stays green (only the WelcomeScreen test that depended on the call order is adjusted, see Tests), the hook has its own tests, `pnpm test` / `pnpm typecheck` / `pnpm lint` green, verifier PASS, `Architecture.md` updated.

**Assumptions (confirm with approval):**
- **U1 — "Not known yet" stays as it is today, per component.** Today five components start at `false` (they animate if the answer has not arrived yet) and `WelcomeScreen` starts at "unknown" and waits (so a phone with reduce motion never sees the first frame of the slide). The hook therefore returns `boolean | null` (`null` = no answer yet); the five use `useReduceMotion() === true`, `WelcomeScreen` keeps its wait on `null`. No visible change.
- **U2 — Rejection = reduced motion, everywhere.** If the system cannot answer, the hook returns `true` (as `WelcomeScreen` does today). For the other five this is the one intended behaviour change: today they keep animating and leave an unhandled rejection; after the change they show without animation (sheet without slide, dialog / snackbar without fade, cover without fade-in, pill without scale). This only happens on a broken native module, so normal phones see no difference.
- **U3 — A change event after a rejection still counts** (the listener is independent of the first question).
- No new dependency, no schema, no i18n, no theme change. Pure frontend refactor.

### Decisions (Kacper)
- **D1 — Approval (2026-10-19):** plan approved together with U1 and U2 ("Akceptuję plan razem z U1 i U2, zaczynaj od kroku 1.").

## Approach
A plain hook with `useState<boolean | null>(null)` and one `useEffect`: ask once (`.then` → value, `.catch` → `true`), subscribe to `reduceMotionChanged`, and on unmount set an `active` flag to false and remove the subscription. Each component swaps its ~10 lines for one call; the `AccessibilityInfo` import is removed where nothing else uses it (`Snackbar` still uses `announceForAccessibility`).
*Rejected:* one app-wide provider (a single subscription in context) — more code and a provider every test would need, for six cheap listeners. *Rejected:* Reanimated's `useReducedMotion` — reads the setting once at startup and does not follow changes, and the components use RN `Animated`.

## Data structures (Zod)
None. The hook returns a React-state value (`boolean | null`) from a native API, not a data shape crossing a boundary; no new schema.

## Tests
**Step 1 — `src/hooks/__tests__/useReduceMotion.test.tsx`** (`renderHook`, `jest.spyOn(AccessibilityInfo, ...)`, like the existing component tests), written first and seen failing because the module does not exist:
1. Returns `null` before the system answers.
2. Resolves `true` → `true`; resolves `false` → `false`.
3. A `reduceMotionChanged` event updates the value (false → true → false).
4. Rejection → `true`, and no unhandled rejection.
5. A change event after a rejection still updates the value (U3).
6. Unmount removes the listener (`remove` called once).
7. An answer (resolve and reject) arriving after unmount is ignored: no error logged (`console.error` not called), nothing thrown.
8. Subscribes once per mount (one `isReduceMotionEnabled` call, one `addEventListener` call), not on every render.

**Step 2 — components**, written first and seen failing before the switch to the hook:
- `BottomSheet`, `ConfirmDialog`, `CoverImage`, `PillNav`, `Snackbar`: one new test each — **"when the system cannot say whether to reduce motion, it shows without animation"** (`mockRejectedValue`), asserting the same end state as their existing reduce-motion test (`animationType 'none'` / opacity set at once / `transition 0` / scale 1 without `Animated.timing`). Red today: they stay on the animated path.
- `WelcomeScreen`: the existing test *"shows everything in place, without animating, when the system cannot say whether to reduce motion"* uses `mockResolvedValueOnce(true).mockRejectedValueOnce(...)` because it relied on `CoverImage` asking first and on the other components not handling a failure. With one hook everywhere, that ordering trick is no longer needed: it becomes `mockRejectedValue(...)` for all callers, with the same assertions (everything in place, no `Animated.timing`, "Zaloguj się" opens the sheet). Logged as a test change, not a weakening: the assertions stay, only the stub is simplified.
- All other existing tests of the six components stay unchanged and green.

## Files
- New: `src/hooks/useReduceMotion.ts`, `src/hooks/__tests__/useReduceMotion.test.tsx`.
- Modified: `src/components/BottomSheet.tsx`, `ConfirmDialog.tsx`, `CoverImage.tsx`, `PillNav.tsx`, `Snackbar.tsx`, `src/features/auth/WelcomeScreen.tsx`, and their tests in `src/components/__tests__/` and `src/features/auth/__tests__/WelcomeScreen.test.tsx`.
- Docs: `Architecture.md` (hooks list, the tech-debt line about the duplicated subscription removed, changelog), this plan.

## Skills
- `test-driven-development` — steps 1, 2 — red → green for the hook and for the rejection tests.
- `code-simplification` — step 2 — the components lose their duplicated effect, behaviour kept (surgical, only these six files).

## Steps
- [x] 1. [frontend] `useReduceMotion` hook — skill: test-driven-development — tests first: Step 1 list — verify: red (module missing) → green, full suite, typecheck, lint; verifier.
- [x] 2. [frontend] The six components use the hook (U1, U2) — skill: test-driven-development, code-simplification — tests first: one rejection test per component (red), WelcomeScreen stub simplified — verify: red → green, no `isReduceMotionEnabled` / `reduceMotionChanged` left outside the hook (`grep`), full suite, typecheck, lint; verifier.
- [x] 3. Docs: `Architecture.md` — no tests (docs only).

## Verification
- Every step: `pnpm test` (full), `pnpm typecheck`, `pnpm lint`; verifier (fresh context) PASS before `[x]`.
- Step 2: `grep -rn "isReduceMotionEnabled\|reduceMotionChanged" src` finds only the hook and tests.
- No device run needed: nothing visible changes on a normal phone. Optional manual check for Kacper: turn on "Usuń animacje" / "Reduce motion", open a sheet, a dialog, the pill and the welcome screen — no slide, fade or scale; turn it off — animations back.

## Progress log
- Step 1 (2026-10-19, frontend agent): tests written (red ✓: `Could not locate module @/hooks/useReduceMotion`, 0 tests ran) · new `src/hooks/useReduceMotion.ts` (`boolean | null`, `.catch` → `true`, one subscription per mount, `active` flag + `remove()` on unmount) and `src/hooks/__tests__/useReduceMotion.test.tsx` (9 tests: plan items 1–8, item 7 as resolve + reject cases) · green ✓ 9/9 · full suite 115 suites / 2311 tests, typecheck, lint green · verifier PASS (no blocking issues) · skill used: test-driven-development · deviations: `afterEach` also calls `jest.clearAllMocks()`, because React Native's Jest setup already mocks `AccessibilityInfo` and `restoreAllMocks` does not reset its call counts (item 8 counts calls; no assertion weakened). Known limit (verifier): on React 19 a setState after unmount is silently ignored, so item 7 proves "no error, no value change", not the `active` guard itself. Also (not a regression, same as before): a `reduceMotionChanged` event that arrives before the first answer can be overwritten by that older answer. One full run had a one-off `BottomSheet` test timeout on a cold cache; the file passes alone and every later full run was green.
- Step 2 (2026-10-19, frontend agent): tests written (red ✓ — all five failed on the animated path, each also with the old code's unhandled `no native module` rejection: BottomSheet `animationType` "slide" instead of "none"; ConfirmDialog opacity 0 instead of 1; CoverImage `transition` 180 instead of 0; PillNav 2 `Animated.timing` calls instead of 0; Snackbar opacity 0 instead of 1) · `BottomSheet`, `ConfirmDialog`, `CoverImage`, `PillNav`, `Snackbar` use `useReduceMotion() === true` (U1); `WelcomeScreen`'s `useEntrance` uses the raw value and keeps its `null` wait; imports made unused removed (`Snackbar` keeps `AccessibilityInfo` for `announceForAccessibility`) · WelcomeScreen test: stub `mockResolvedValueOnce(true).mockRejectedValueOnce(...)` → `mockRejectedValue(...)`, comment updated, every assertion kept (before the switch it failed on the other components' unhandled rejection; green after) · green ✓ · `grep isReduceMotionEnabled|reduceMotionChanged src` → only the hook and tests · full suite 115 suites / 2316 tests, typecheck, lint green · verifier PASS; its one non-blocking nit (PillNav `@/` import order) fixed afterwards, PillNav tests + lint + typecheck green · skill used: test-driven-development, code-simplification · deviations: none.
- Step 3 (2026-10-19, orchestrator): `Architecture.md` — `useReduceMotion` added to the hook lists, the tech-debt line about the duplicated subscription removed, changelog entry · final full suite, typecheck, lint green.

## Risks & open questions
- **R1** — U2 changes the failure path of five components from "animate" to "no animation". Intended (it matches WelcomeScreen and is the safe choice for §9.4), but it is a behaviour change; confirm with approval.
- **R2** — Base branch: the work starts from `feature/auth-onboarding` at `391e5a3` (theme-split part A committed), on `refactor/use-reduce-motion`. Its PR targets `feature/auth-onboarding` until that is merged into `main`.
