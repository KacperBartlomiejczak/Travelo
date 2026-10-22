# Task: Temporary timing logs in the gate startup path
Status: done (approved by Kacper 2026-10-22: no tests first — exemption OK; Q1 = no, gate only). Outcome: the long spinner is an emulator effect; on a real phone the gate path takes ≈ 1–4 s and the estimated spinner ≈ 0–3 s. Kacper: "Wystarczy" — no per-step trace numbers needed.

## Understanding & assumptions
Follow-up to `prompts/splash-animation/plan.md` Q5. In production JS mode (Metro `--no-dev --minify`, Expo Go, emulator `Medium_Phone_API_37.0`) the gate is ready ≈ 9.5 s after the splash animation starts, and the spinner shows ≈ 7 s. The server answers every request in 50–270 ms and the JS thread is not saturated, but the device spends seconds between gate steps (socket open → `profiles` request ≈ 2.9 s; avatar signed → gate ready ≈ 4.4 s). Kacper wants to know where those seconds go before deciding anything.

"Done" means: a table of how long each gate step takes on a cold start (3 runs, production JS mode), recorded in this plan, and **every trace removed again** — the touched files are byte-identical to before the task.

Assumptions:
- A1. Diagnostic only. No behaviour change, no fix in this task. A fix (if any) is a new plan.
- A2. Measured in production JS mode only (the dev-mode cost is already known). The traces are silent in dev and in Jest (`__DEV__` guard), so tests and dev runs see no output.
- A3. Nothing is committed. The traces live only in the working tree for the measurement, then are removed.
- A4. Scope is the gate path Kacper named: session read, SQLite open (+ migrations), profile, avatar, profile copy write, plus the splash events needed to read the result (animation start / end, gate ready, splash gone). The home screen's trip query (skeletons ≈ 10–16 s after the fade) is **not** traced (see Q1).

## Approach
One temporary helper `src/lib/startupTrace.ts`: `trace(label)` logs `[startup] +<ms since module load> <label>` with `console.log`, only when `!__DEV__`. One-line `trace(...)` calls are added at the points below. Logs are read from `adb logcat` (tag `ReactNativeJS`), so each line also has the device clock; if Expo Go does not forward them there, from the Metro terminal.

Trace points (each one line):
| # | Where | Label |
|---|---|---|
| 1 | `src/app/_layout.tsx` RootLayout, fonts ready | `fonts:ready` |
| 2 | `Gate` mount effect (before `hideAsync`) | `gate:mount` |
| 3 | `Gate`, each time `view` changes | `gate:view=<view>` |
| 4 | `src/components/AnimatedSplash.tsx` `play()` call / `onAnimationFinish` / `onAnimationFailure` / `onDone` timer | `splash:play`, `splash:finish`, `splash:fail`, `splash:done` |
| 5 | `src/providers/Session.tsx` `start()`: before / after `source.current()` | `session:read:start`, `session:read:end` |
| 6 | `src/data/local-db.ts` `openLocalDb`: before open / after open / after migrations | `db:open:start`, `db:open:end`, `db:migrated` |
| 7 | `src/data/supabase-profile-repository.ts` `myProfile` / `show` / `fetchProfile`: start, after `await localStore`, after `signedIn()`, after `profiles` select, after `signAvatar`, after `cacheProfile`, end (and the cache fallback) | `profile:start`, `profile:store`, `profile:session`, `profile:select`, `profile:avatar`, `profile:cached`, `profile:end`, `profile:fallback` |

Removal: before adding anything, the SHA-256 of each touched file is saved; the last step deletes the helper and every `trace` line and checks the hashes match again (the files carry uncommitted changes from other work, so `git checkout` must not be used).

Rejected: React Native's built-in Systrace / Perfetto — heavier to set up on Expo Go and harder to read than eight labels.

## Data structures (Zod)
None. No data shape changes; the log lines are not data the app reads.

## Tests
**No tests first — Kacper's approval needed for this exemption.** The helper is temporary (removed in step 3), has no behaviour the app depends on, and is silent in Jest (`__DEV__` is true there). Checks instead:
- step 1: typecheck and lint clean on the touched files; the Jest suites of the touched files (layout, auth-gate, AnimatedSplash, Session, local-db, supabase-profile-repository) still pass with no new console output;
- step 3: hashes of all touched files equal the saved ones; `grep -rn "startupTrace" src` finds nothing.
(The full suite is already red from the concurrent sunline-redesign work, see `prompts/splash-animation/plan.md` step 5; that is not changed here.)

## Files
- Added (temporary): `src/lib/startupTrace.ts`.
- Modified (temporary, restored in step 3): `src/app/_layout.tsx`, `src/components/AnimatedSplash.tsx`, `src/providers/Session.tsx`, `src/data/local-db.ts`, `src/data/supabase-profile-repository.ts`.
- This plan (results), and `prompts/splash-animation/plan.md` Q5 (one line linking here).

## Skills
- `performance-optimization` — step 2 — measure before changing anything; read the numbers, propose nothing that is not measured.
- `debugging-and-error-recovery` — step 2 — root cause first, if the logs do not show up or the numbers do not add up.

## Steps
- [x] 1. [frontend] Save hashes of the 5 files, add `startupTrace.ts` and the trace lines from the table. — skill: none — tests first: none (exemption above) — verify: typecheck + lint on touched files, the touched files' Jest suites pass with no console output.
- [x] 2. [manual, orchestrator] Metro `--no-dev --minify`, 3 cold starts on the emulator, `adb logcat -v epoch -s ReactNativeJS` captured per run (plus one screen recording to match `splash:play` with the screen). Results table (median of 3) into this plan. — skill: performance-optimization, debugging-and-error-recovery — verify: every label appears in every run, in a plausible order.
- [x] 3. [frontend] Remove every trace and the helper. — skill: none — verify: hashes equal the saved ones, `grep -rn startupTrace src` empty, typecheck + lint on touched files.

## Verification
- Step 1 / 3: as in the Steps.
- Step 2: the sum of the traced gaps explains the measured ≈ 9.5 s from `splash:play` to `gate:view=app`; anything left unexplained is reported, not guessed.

## Progress log
- Step 1 (2026-10-22): orchestrator saved SHA-256 of the 5 files (scratchpad `diag/trace-hashes.txt`) before the change. Frontend agent added `src/lib/startupTrace.ts` + 23 one-line additions (imports, `trace(...)` lines, two one-line `useEffect`s: `gate:view=<view>` in `Gate`, `splash:played` in `AnimatedSplash`), no existing line changed; each file keeps its own line endings. Small deviation: `session:read:start` sits before `let snapshot;` (the line above the `try`). Tests: none (approved exemption). Agent checks: typecheck clean (whole project), eslint clean on the 6 files, 8 Jest suites / 298 tests pass with no `[startup]` output. Orchestrator check instead of the verifier agent (deviation: a byte-level check is stronger for a temporary diff): dropping every line with `trace(` or `startupTrace` restores all 5 hashes exactly (Python, binary-safe). · skill used: none
- Step 2 (blocked, 2026-10-22): 3 production cold starts ran (Metro `--no-dev --minify`, bundle checked: `__DEV__=false`, `trace` compiles to a plain `console.log`), but **no `[startup]` line anywhere**: full logcat captured from before each launch (2 MiB buffer, nothing rotated; `ReactNativeJS: Running "main"` is there), and Metro does not stream logs in no-dev mode. R1 + its fallback both failed: Expo Go swallows `console.log` in production JS mode. Proposed fix (needs approval, plan change): the helper writes through RN's native log hook, `globalThis.nativeLoggingHook?.(msg, 1)` (the hook RN uses for the `ReactNativeJS` logcat tag), one line in `startupTrace.ts` only. · skill used: debugging-and-error-recovery
- Step 2, real phone (2026-10-22, Kacper connected his phone and asked to measure there): OnePlus CPH2699, Android 16, Expo Go, Metro `--no-dev --minify` over `adb reverse tcp:8081` (the phone could not reach the PC over Wi-Fi). 3 cold starts, HTTPS sockets sampled + Supabase edge logs (the traces stay silent, same Expo Go limit). JS starts ≈ 19–20 s after launch (Expo Go downloads the bundle over the cable). Gate network path, first socket → avatar signed: run 1 ≈ 4 s (included a token refresh `POST /auth/v1/token` 289 ms, the stored token had expired), run 2 ≈ 2.6 s, run 3 ≈ 1.1 s; every server request 55–310 ms. The home trip query starts ≈ 2.5 s after the avatar is signed in all runs. Estimated spinner (gate ready − animation end, assuming the animation starts with JS): ≈ 0–3 s, vs ≈ 7 s on the emulator. **Not measured from the screen:** `screenrecord` is refused on this phone (`Permission denied` for both `/sdcard` and `/data/local/tmp`), and a single `screencap` showed a live video call's picture-in-picture with another person, so screen capture was stopped and that screenshot deleted; screen-based measurement waits until no call is running. · skill used: performance-optimization
- Step 2 closed by Kacper (2026-10-22): "Wystarczy: telefon pokazuje krótki spinner" — the `nativeLoggingHook` change was not made, per-step trace numbers were not collected.
- Step 3 (done, 2026-10-22): frontend agent deleted `src/lib/startupTrace.ts` and the 24 trace lines (byte-exact Python, line endings kept; step 1's "23" was a miscount, all 24 were trace imports/calls). Orchestrator check: `sha256sum -c` OK for all 5 files, no `startupTrace` reference in `src`; diff against HEAD `e747ee6` is only those removals (0 added lines). Agent checks: typecheck clean, eslint clean on the 5 files, 196/198 tests in the 7 touched suites pass; the 2 failures (`layout.test.tsx` "draws the loading screen in the light/dark canvas colour") come from uncommitted sunline-redesign test additions made at 18:17 by other work (they expect `theme.background.canvas` while `_layout.tsx` uses `colors.background`), not from this task. **Note:** Kacper's WIP commit `e747ee6` contains the traces; the next commit must carry their removal. Cleanup: emulator scripts in `/data/local/tmp` removed, Metro back in dev mode. · skill used: none

## Risks & open questions
- **Q1 — Trace the home screen's trip query too?** Decided 2026-10-22: **no**, gate only. After the splash, the trip screen shows skeletons for another ≈ 10–16 s (trips query, cover photo signing).
  - **Recommended: no.** This task answers the gate question you asked; the trip screen can get its own measurement once this one shows the pattern.
  - **Yes:** + 3 trace lines in the trip repository (`current` start / server answered / end), same removal.
- R1 — Expo Go may not forward `console.log` to logcat in production mode. Fallback: the Metro terminal shows the device logs; the `+ms` value in each line still gives the timing.
- R2 — The emulator may not represent a real phone (the gaps may be emulator disk I/O). The numbers say where the time goes on this emulator; a real-device check is still needed before any fix.
