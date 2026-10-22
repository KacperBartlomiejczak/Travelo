# Task: Animated splash screen (logo reveal) + loading spinner
Status: done (closed by Kacper 2026-10-22, see Step 6 in the progress log)

## Understanding & assumptions
Kacper wants an animated splash on app start, built from the approved logo (`design/logo/kit/`, direction B "t-podróżnik"):
1. The symbol (ink t + coral sun) sits in the middle of the screen.
2. The symbol moves a little to the left, and the wordmark "travelo" comes out of it, ending on the horizontal lockup (`design/logo/kit/lockups/travelo-horizontal.svg`).
3. When the animation ends and the app is still loading (session / profile from `useGateView`), a spinner shows until it is ready.

The animation is made in **LottieFiles Creator through the `lottiefiles-creator` MCP** (Kacper's request) and played in the app as a Lottie JSON.

"Done" means: on every cold start the app shows the native splash (paper + centered symbol), hands over to the Lottie animation without a visible jump, plays it once, shows a spinner if the app is not ready yet, and fades into the first screen; the full suite, typecheck and lint are green.

Assumptions:
- A1. Shapes come from the logo kit SVGs (symbol paths + wordmark outlines). The wordmark is never retyped in a font (logo README §1, §7).
- A2. Colours are tokens only: paper `#F8F4EC` ground, ink `#242321`, coral `#E96F51` (logo README §4). The Lottie has a transparent background; the ground is a `View` with the theme's canvas colour.
- A3. The first Lottie frame = the native splash image (same symbol, same size, same centre), so the handoff from native to JS splash is invisible. This depends on the native splash from `prompts/app-icon/plan.md` (paper + symbol), which is still awaiting approval (Q4).
- A4. Timing (~1.6 s @ 60 fps), easing from `motion.easing.enter`:
  - 0–0.25 s: symbol still, centered (matches native splash);
  - 0.25–1.0 s: symbol slides left to its place in the lockup;
  - 0.45–1.2 s: wordmark revealed from behind the symbol (mask wipe left → right + small slide);
  - 1.2–1.6 s: hold on the full lockup.
- A5. Reduce motion (design-context §9.4, `useReduceMotion`): no animation, the full lockup is shown static, the rest of the flow is the same.
- A6. The splash shows on every cold start, not only the first one.
- A8 (orchestrator, step 3): the Lottie is rendered 280 dp wide and centered (`screenMetrics.splash.animationWidth`), so the final lockup is ≈ 226 dp wide and the symbol ≈ 41.6 dp tall; the native splash `imageWidth` 58 gives the same symbol height (368/512 of the kit image). Easy to tune at the device check.
  Deviation (step 3): `src/theme/tokens.ts` gets `screenMetrics.splash.animationWidth` already in step 3 (the config test needs it), not only in step 4.
- A7. Expo Go never shows our native splash, but the Lottie part runs in Expo Go (lottie-react-native ships in Expo Go), so the animation itself can be checked there.

## Approach
1. Build the animation in LottieFiles Creator via MCP: import the kit SVGs as layers `t` (ink), `sun` (coral) and `wordmark`, keyframe position (t, sun), track matte/position/opacity (wordmark). Export the Lottie JSON to `assets/animations/splash.json`.
2. A small `AnimatedSplash` component plays the JSON once (`lottie-react-native`, `loop={false}`, `onAnimationFinish`). After it finishes: if the app is ready → fade out (`motion.duration.standard`) and unmount; if not → show the spinner under the lockup until ready, then fade out.
3. `RootLayout` / `Gate`: `SplashScreen.hideAsync()` is called as soon as the `AnimatedSplash` is mounted (fonts loaded), not when the gate is ready. `AnimatedSplash` is an overlay above the `Gate`, so the gate keeps loading underneath.

Rejected: animating the SVGs with Reanimated (already installed, no new dependency) — it skips Lottie, which Kacper asked for; it stays the fallback if Q1 = no.

## Data structures (Zod)
None. The Lottie JSON is a bundled asset, not app data, and no entity or payload changes. (Same reasoning as the app-icon plan.)

## Tests
Step 2 — `src/__tests__/assets/splash-animation.test.ts` (asset guard):
- `assets/animations/splash.json` exists and parses as JSON with `v`, `fr`, `ip`, `op`, `w`, `h`, `layers`;
- duration (`(op - ip) / fr`) is between 1.2 s and 2.0 s;
- it has top-level layers named `t`, `sun` and `wordmark` (keypaths used for dark-mode colour filters, Q2);
- the `wordmark` layer is track-matted (`tt`) and the layer right above it is the matte source (`td: 1`) (added at step 2).
- the only colours used are ink, coral (and paper, if any) — read from the fills, compared to the tokens.

Step 3 — `src/components/__tests__/AnimatedSplash.test.tsx` (`lottie-react-native` mocked; the mock exposes `onAnimationFinish`):
- renders the Lottie with `loop={false}` and `autoPlay`;
- before the animation ends: no spinner even if the app is not ready;
- animation ends + app not ready → spinner visible (`testID="splash-spinner"`, `accessibilityState.busy`), and an accessible label from i18n;
- app becomes ready later → `onDone` is called (after the fade);
- animation ends + app already ready → no spinner, `onDone` called;
- reduce motion `true` → no autoplay, final frame shown (`progress={1}`), flow continues as above;
- reduce motion `null` (unknown yet) → waits (no autoplay) until it is known;
- dark theme → colour filters swap ink → paper and coral → dark coral (only if Q2 = yes).

Step 4 — `src/__tests__/app/layout.test.tsx` / `auth-gate.test.tsx` (update):
- `SplashScreen.hideAsync` is called once fonts are loaded (no longer waits for the gate);
- `AnimatedSplash` is shown above the gate while `view === "loading"`, and removed after `onDone`;
- the existing gate tests (signed out / onboarding / app / errors) stay green.

## Files
- Added: `assets/animations/splash.json` (from Creator), `assets/images/splash-icon-dark.png`, `src/__tests__/app-config.test.ts`, `src/components/AnimatedSplash.tsx`, `src/components/__tests__/AnimatedSplash.test.tsx`, `src/__tests__/assets/splash-animation.test.ts`.
- Modified: `app.json` (splash plugin options only), `assets/images/splash-icon.png`, `design/logo/source/build_icons.py` (dark splash), `src/app/_layout.tsx`, `src/__tests__/app/layout.test.tsx` (and `auth-gate.test.tsx` if needed), `package.json` + lockfile (`lottie-react-native`, Q1), i18n files (`splash.loading` label in PL/EN), `src/theme/tokens.ts` (a `motion.microinteraction.splash` entry: fade duration, spinner — only names for existing values).
- Mock: `__mocks__/lottie-react-native.tsx` (or `jest.setup`), following how other native modules are mocked in this repo.
- Docs: `Architecture.md` (Frontend: splash flow; changelog).

## Skills
- `source-driven-development` — steps 2–3 — current `lottie-react-native` (Expo SDK 57) API: `onAnimationFinish`, `progress`, `colorFilters`, and `expo-splash-screen` `hideAsync` timing. Check docs before writing.
- `test-driven-development` — steps 2–4 — red → green.
- `frontend-ui-engineering` — step 3 — spinner state, accessibility (busy state, label), reduce motion.
- `ui-taste` — step 5 — review of the finished animation against the logo guidelines.

## Steps
Status: approved by Kacper 2026-10-22 (with D1–D4 and Q4b = add the native splash step).

- [x] 1. [design] Build the animation in LottieFiles Creator via the `lottiefiles-creator` MCP (symbol + wordmark from the kit SVGs, timing A4), preview it, export the JSON to `assets/animations/splash.json`. Also render the dark native splash image (reversed symbol, same layout as `design/logo/kit/expo/splash-icon.png`) via `design/logo/source/build_icons.py`. — skill: none — **tests first: none.** Pure asset creation outside the app, no app behaviour; checked by looking at the preview and by the step 2/3 tests. — verify: Kacper looks at the Creator preview and approves the motion.
- [x] 2. [frontend] Asset guard test (red without the file / with wrong layer names), then add the exported JSON (green). — skill: test-driven-development — verify: full suite, typecheck, lint.
- [x] 3. [frontend] Native splash only (Q4b): config test first (`src/__tests__/app-config.test.ts`: splash `backgroundColor` = light canvas token, `dark.backgroundColor` = dark canvas token, both images exist and are the kit's 512×512 splash images, `imageWidth` matches the Lottie's first frame), then `app.json` splash plugin options + `assets/images/splash-icon.png` / `splash-icon-dark.png`. Icons are not touched. — skill: source-driven-development (`expo-splash-screen` plugin `dark` option), test-driven-development — verify: full suite, typecheck, lint; `npx expo config --type public` resolves; verifier PASS.
- [x] 4. [frontend] Add `lottie-react-native` (`npx expo install`), Jest mock, `AnimatedSplash` component with spinner, reduce motion and (Q2) dark colours. Tests first. — skill: source-driven-development, test-driven-development, frontend-ui-engineering — verify: full suite, typecheck, lint; verifier PASS.
- [x] 5. [frontend] Wire `AnimatedSplash` into `_layout.tsx` (hide native splash on mount, overlay over the gate, remove on `onDone`). Tests first. — skill: test-driven-development — verify: full suite, typecheck, lint; verifier PASS.
- [x] 6. [manual] Device check (tester via mobile-mcp, or Kacper). — skill: ui-taste — verify: manual steps below.

## Verification
- Steps 2–4: full suite, typecheck, lint green; verifier PASS per step.
- Manual steps (step 5):
  1. Cold start in Expo Go (or a dev build): the symbol is centered, slides left, "travelo" comes out of it, ends on the horizontal lockup.
  2. Dev build only: the native splash → Lottie handoff shows no jump (same symbol size and position).
  3. Slow network (airplane mode on with a signed-in user, or a throttled connection): after the animation the spinner shows under the logo, then the app opens.
  4. Fast start: no spinner flash; the splash fades into the first screen.
  5. Reduce motion on: static lockup, no slide.
  6. Dark mode (if Q2 = yes): dark ground, paper t, dark coral sun.

## Progress log
- Step 1 (done, 2026-10-22): Creator scene "Main Scene" 800×400, 60 fps, 96 frames (1.6 s), transparent export (paper is preview only). Layers from the kit SVGs: `t` (ink), `sun` (coral), `wordmark` (outlined paths), `wordmark-matte` (track matte of `wordmark`). The lockup is centered in the final frame (bbox 76.4–723.7 px); the symbol is centered at frame 0 (x 400) and only moves horizontally, symbol height 118.96 px of 400. Keyframes: `t`/`sun` x 400 → 115.19, frames 15→60, easing `motion.easing.standard`; matte moves with them (its left edge 6 px right of the t), so the wordmark only shows to the right of the symbol; `wordmark` x −120 → 0, frames 24→72, easing `motion.easing.enter`, opacity 0→100 frames 24→48; hold 72→96. Dark native splash image: `splash-icon-dark.svg` added to `build_icons.py` (reversed symbol, paper + dark coral), rendered to `design/logo/kit/expo/splash-icon-dark.png` (512×512, checked visually). Kacper checked the Creator preview ("Animacja jest OK") and exported `splash.json`. Exported JSON checked: v 5.7.0, 60 fps, 96 frames, layers `t`, `sun`, `wordmark-matte` (td 1), `wordmark` (tt 1, tp 3), fills ink + coral only. Deviation: layers are `t` + `sun` instead of one `symbol` layer, so dark-mode colour filters can target ink and coral separately; plan text updated. · skill used: none
- Step 2 (done, 2026-10-22): frontend agent. Tests: `src/__tests__/assets/splash-animation.test.ts` (5 tests: keys, duration 1.2–2.0 s, layer names t/sun/wordmark, fills = `primitives.ink` / `colors.light.brand.primary`, matte structure). Red ✓ (ENOENT, file missing) → copied `Downloads/splash.json` byte-for-byte to `assets/animations/splash.json` → green ✓. Full suite 2853/2853, typecheck, lint green. One agent run showed a load-dependent failure in `TripsDrawer.test.tsx` (skeleton pulse); it passes in isolation and in two later full runs, and those drawer files carry uncommitted changes from other work in this worktree, not this task. Verifier PASS (mutation checks: renamed layer, wrong colour, missing matte all fail). Verifier notes accepted as-is: the colour check uses the ink∪coral union; animated/gradient fills are not inspected (none exist). · skill used: test-driven-development
- Step 3 (done, 2026-10-22): frontend agent. Tests: `src/__tests__/app-config.test.ts` (6 tests: light/dark splash background = canvas tokens; both images exist, 512×512, byte-identical to the kit; native symbol height `imageWidth × 368/512` within 1 dp of the Lottie frame-0 symbol height, derived from `splash.json` (`t`/`sun` layer and inner precomp scales × kit symbol height 184 / comp width); `#208AEF` gone). Red ✓ for the expected reasons (template colour, no `dark`, old 228×213 image, missing token) → green ✓. Changed: `app.json` splash plugin only (`#F8F4EC`, `imageWidth` 58, `dark` `#171716` + `splash-icon-dark.png`), `assets/images/splash-icon.png` replaced, `assets/images/splash-icon-dark.png` added, `screenMetrics.splash.animationWidth: 280` in tokens. `npx expo config --type public` resolves with the new values (source checked: `expo-splash-screen/plugin/build/types.d.ts`). Full suite 2859/2859, typecheck, lint green. Verifier PASS with one major test-quality issue (symbol ratio was a hand-typed constant, not read from the JSON) + comment citing A3 instead of A8 → both fixed by the same agent, mutation check (inner scale 64.65 → 90) turns the test red; orchestrator re-ran the step's tests (11/11) and checked the JSON is still identical to Kacper's export. Note: the native symbol centre sits ≈ 0.9 dp below the image centre (248/512) — check at the device step. Android 12+ draws the splash icon in its own icon area; size match to be checked on a device. · skill used: source-driven-development, test-driven-development
- Step 4 (done, 2026-10-22): frontend agent. `lottie-react-native` ~7.3.8 via `npx expo install` (= `expo/bundledNativeModules.json` for SDK 57). Jest mock in `jest.setup.ts` (host View `splash-lottie`, props passed through). `src/components/AnimatedSplash.tsx` `{ ready, onDone }` + 15 tests in `src/components/__tests__/AnimatedSplash.test.tsx`; `splash.loading` in pl/en ("Ładowanie aplikacji" / "Loading app"). Red ✓ ("no mapped module found" for `@/components/AnimatedSplash`) → green ✓. Docs checked in the installed package: `autoPlay` only plays at native mount, so the component calls `ref.play()` once reduce motion answers `false`; colorFilters keypath `<name>` reaches precomp contents (iOS `<key>.**.Color`, Android `<key>.**`). Dark: `t`/`wordmark` → `surface.inverse` (#F8F4EC), `sun` → `brand.primary` (#F07D5E), matte untouched. Fade: Reanimated `withTiming` (`motion.duration.standard` / `reduced`, `easing.exit`) + `setTimeout` for `onDone` (cleared on unmount). Full suite 2875/2875, typecheck, lint green. Verifier PASS.
  Deviations / notes: (a) `onAnimationFailure` also counts as finished, so a Lottie that fails to load can't trap the user behind the overlay (tested) — to confirm with Kacper; (b) the spinner sits at the bottom edge of the 140 dp Lottie box, ≈ 49 dp under the lockup (my plan text said ~32), no new token — check at the device step; (c) not done, accepted: no unmount test, `play()` could re-run if reduce motion is switched off during the fade (edge case); (d) `pnpm-lock.yaml` also rewrote many entries with `(supports-color@8.1.1)` peer suffixes (≈ 850 lines) — check `pnpm install --frozen-lockfile` on a clean checkout before merge. · skill used: source-driven-development, test-driven-development, frontend-ui-engineering
- Step 5 (done, 2026-10-22): frontend agent. `src/app/_layout.tsx`: `Gate` holds `splashDone`, calls `SplashScreen.hideAsync()` once on mount, calls `useGateView()` once and renders `GateContent` (the old body, unchanged routing/guards) + `AnimatedSplash ready={view !== 'loading'}` until `onDone` (cold start only; errors count as ready). Tests: 5 new in `layout.test.tsx` (4 red ✓ — "Expected number of calls: 1, Received: 0", "Unable to find … splash-overlay/splash-lottie" — → green; "never shows again" is a regression guard, green from the start). Existing assertions changed (approved rule change, nothing weakened): `layout.test.tsx` fonts-loading test + overlay-absent check; two `hideAsync toHaveBeenCalled()` → `toHaveBeenCalledTimes(1)`; `auth-gate.test.tsx` "keeps the splash screen … until the clear has finished" and "keeps the splash screen until the session and the profile are known" → "covers the screen with the animated splash …": removed "hideAsync NOT called while loading" (the rule this step changes), added overlay present + hideAsync once; welcome-not-shown assertions kept. Verifier PASS for the step. This task's suites: 23 suites / 509 tests green; typecheck of this task's files clean (scratch tsconfig without the broken file); lint clean on this task's files (one pre-existing `import/first` warning in `jest.setup.ts`, line 43, from HEAD).
  **Full suite NOT green (blocker outside this task):** the concurrent sunline-redesign work in this worktree has `src/components/__tests__/TripHero.test.tsx` with a syntax error (typecheck + lint fail) and ≈ 50 failing tests in home, trips/photos, DeleteTripSheet, TripDetailsSheet, TripMenuSheet, DeletePhotoSheet, PhotoStrip (theme/token values such as `#665D51` vs `#56524C`, `tokens.spacing[1]` undefined in `PhotoStrip.tsx:174`). No failure message mentions splash/Lottie/overlay. Per CLAUDE.md the task is not reported done until the whole suite is green. · skill used: test-driven-development

- Step 6 (in progress, 2026-10-22): tester agent on emulator `Medium_Phone_API_37.0` (Android API 37), Expo Go + Metro `exp://192.168.5.179:8081`, signed-in user. mobile-mcp unusable (Windows Smart App Control blocks unsigned `mobilecli.exe`), so Kacper approved driving the emulator with adb (screencap, screenrecord + ffmpeg frames, `emu network`, `animator_duration_scale`, `cmd uimode night`). Expo Go shows its own launch splash for 50–60 s per cold start while downloading the bundle; the Lottie plays after it. Results: (1) light cold start PASS — centred symbol, slides left, wordmark comes out, lockup ≈ 229 dp wide (A8: 226), fades into the trip screen; (2) native → Lottie handoff not testable in Expo Go (needs a dev build); (3) slow start NOT PASS — throttled gprs/gsm run never showed the spinner (app already ready when the animation ended, likely the SQLite copies); (4) fast start INCONCLUSIVE — on normal network the spinner showed 6–20 s in every run, then the trip screen showed skeletons ~10 s more; cause unknown (logcat had Binder "No space left on device" errors; Expo Go dev mode); (5) reduce motion PASS — static lockup, no slide; (6) dark PASS — pixels #171716 ground, #F8F4EC t/wordmark, #F07D5E sun. Spinner centre ≈ 55–60 dp under the lockup baseline (orchestrator checked `dark_shots/d014.png`: ≈ 60 dp). Orchestrator checked the light frame sheet and the dark screenshot by eye. Device settings restored (night mode back to on, as before the run). Step stays `[ ]` until Q5–Q7. · skill used: none (ui-taste not run yet)

- Step 6 closed (2026-10-22): Kacper marked the task done. Accepted as-is: scenarios 1, 5, 6 PASS on the emulator; Q5 closed (spinner length is an emulator effect, short on a real phone, `prompts/gate-startup-timing/plan.md`); not done: scenario 2 (native → Lottie handoff, needs a dev build), scenario 3 (slow-start spinner, Q6), scenario 4 on screen; Q7 spinner distance (≈ 60 dp) kept as built. ui-taste review not run. Committed and pushed on `feature/sunline-redesign` (PR #24). · skill used: none

## Decisions (Kacper, 2026-10-22)
- D1 (Q1): yes, add `lottie-react-native`.
- D2 (Q2): yes, the splash follows the phone's theme (reversed logo on `#171716` in dark mode).
- D3 (Q3): the spinner sits under the logo; the lockup stays on screen.
- D4 (Q4): "nie róbmy go": the app-icon task is not done first. Still open: does the native splash stay the Expo template (blue `#208AEF`) or does its splash part move into this task? See Q4b.

## Risks & open questions
- **Q5 (step 6) — Spinner for 6–20 s on a normal network.** Is it acceptable, or is it a bug to investigate (Expo Go/emulator vs the gate waiting on the network)? Re-test on a dev build?
  Diagnosis (orchestrator, 2026-10-22, no code changes): the time goes to the JS thread, not the network. Emulator → Supabase ping ≈ 30 ms, emulator network not throttled. Cold start with HTTPS sockets sampled every 0.5 s (`/proc/net/tcp*`, Expo Go uid): the Lottie started at ≈ 63 s, the first Supabase socket opened only at ≈ 72 s (no SYN_SENT ever seen, so no connection hang), and the gate was ready at ≈ 90 s; trip skeletons for ≈ 16 s more. A second cold start sampled per-thread CPU: `mqt_v_js` (the JS thread) was the busiest thread at 60–120 % from the moment JS started until the sampling ended (≈ 40 s). So: Expo Go's dev bundle (4357 unminified modules, dev checks) on this emulator. Code note, not the measured cause: the gate is online-first for the profile (`getSession` → `profiles` select → avatar signed URL → SQLite copy), so on a bad (not absent) connection the splash waits up to `REQUEST_TIMEOUT_MS` (20 s) before falling back to the copy. Not yet confirmed in a production JS build (`expo start --no-dev --minify`) or on a dev build.
  Re-check in production JS mode (Metro `--no-dev --minify`, manifest checked: `dev=false`, `minify=true`; same emulator, same method, plus Supabase edge logs for server timings): JS start → first Supabase socket ≈ 1.4 s (dev: ≈ 9 s); animation start → gate ready ≈ 9.5 s (dev: ≈ 27 s), spinner visible ≈ 7 s in the recorded run. Server: every request answered in 50–270 ms (`profiles` 85–267 ms, avatar sign ≈ 70 ms, `/auth/v1/user` 78 ms). JS thread in prod: busy 60–95 % while the bundle loads, then 0–50 % during the splash (not saturated). Device-side gaps between gate steps are seconds (socket open → `profiles` request ≈ 2.9 s; avatar signed → gate ready ≈ 4.4 s), so in prod the wait is neither the server nor a saturated JS thread; most likely native async work on the emulator (SQLite-backed `localStorage` for the session, `travelo.db` open + `cacheProfile` write), not proven without timing logs. Conclusion: dev mode explains most of the 6–20 s; a few seconds stay in prod on this emulator and their exact source is still unknown. Follow-up: `prompts/gate-startup-timing/plan.md` (temporary timing logs). Result (2026-10-22): on Kacper's phone (OnePlus CPH2699, Android 16, Expo Go, prod JS) the gate path takes ≈ 1–4 s and the estimated spinner ≈ 0–3 s, so the long spinner is an emulator effect; Kacper: "Wystarczy". Q5 closed; scenario 4 (fast start) still to be confirmed on screen on a device (screen capture not possible on that phone during the run).
- **Q6 (step 6) — Slow-start spinner (scenario 3) not reproduced.** Clear Expo Go app data (needs a test account to sign in again), or accept scenarios 1/5/6 as the proof that the spinner shows?
- **Q7 (step 6) — Spinner distance.** Measured ≈ 60 dp under the lockup baseline; plan text said ~32, step 4 note ≈ 49. Keep it, or move it closer?
- **Q4b — Native splash without the app-icon task.** Today the native splash is the Expo template (blue `#208AEF` + Expo image). Without a change, a cold start shows blue first, then cuts to the paper animation.
  - **Recommended:** add one step here: only the splash part of `app.json` (paper/dark background + the kit's `splash-icon.png`, plus a dark one), with a config test. Icons stay untouched.
  - **Alternative:** leave the native splash as it is and accept the blue flash until the app-icon task is done.
- **Q1 — New dependency `lottie-react-native`?** Needed to play a Lottie in the app. It is part of the Expo SDK (installed with `npx expo install`, works in Expo Go and dev builds).
  - **Recommended: yes.** It is what plays the Creator animation.
  - **No:** the same motion done in Reanimated (already installed) from the SVGs; then Lottie Creator is only for the preview.
- **Q2 — Dark mode?**
  - **Recommended: follow the phone's theme** — dark ground `#171716`, the t in paper, sun in dark coral `#F07D5E` (reversed logo, README §4), done with `colorFilters` on the same JSON.
  - **No:** always paper (light) splash.
- **Q3 — Spinner: where and what?**
  - **Recommended:** a small coral `ActivityIndicator` under the lockup (about 32 pt below), the lockup stays on screen.
  - **Alternative:** the lockup fades out and only a spinner stays in the centre.
- **Q4 — Order with `prompts/app-icon/plan.md`.** That plan (awaiting approval) changes the native splash to paper + symbol. This animation must start from exactly that frame.
  - **Recommended:** app-icon first (at least its splash part), then this task.
  - **Alternative:** move the native splash part (`app.json` splash colour + image) into this task.
- R1 — **LottieFiles Creator is not connected.** The MCP answers: "No Creator tab is connected". Kacper must open https://creator.lottiefiles.com, sign in and enable MCP in that tab before step 1.
- R2 — The MCP has no tool to save the JSON to disk. Export is probably manual: Creator → Export → Lottie JSON, saved as `assets/animations/splash.json`. To be checked at step 1.
- R3 — Wordmark paths are long (~10 kB of path data); if Creator's SVG import struggles with them, the wordmark is imported as separate letters.
