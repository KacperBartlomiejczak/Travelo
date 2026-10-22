# Task: Fix the valid CodeRabbit findings on PR #23
Status: done (2026-10-22)

Source: CodeRabbit review 5604995244 on https://github.com/KacperBartlomiejczak/Travelo/pull/23 (2026-10-21, commit d2a91b9):
1 inline (Minor, the only unresolved thread), 1 outside-diff (Minor), 1 nitpick (Trivial). No other CodeRabbit review on this PR.

## Understanding & assumptions
Every finding was checked on 2026-10-22 against `origin/feature/profile-screen` (d2a91b9) and against the installed
`@supabase/auth-js` 2.117.2 (`node_modules/.pnpm/@supabase+auth-js@2.117.2/.../dist/module`). Only findings that are true
**and** matter get a fix. "Done" = every step `[x]`, full suite + typecheck + lint green, verifier PASS, `Architecture.md`
changelog entry, and (after Kacper approves its text) a reply on PR #23 saying what was fixed and why the rest was skipped.

### Verification of each finding

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| F1 | `src/data/session-source.ts:108` — "a request exception from `admin.signOut` skips `_removeSession()`; Settings then shows no error and the user stays signed in. Show a fixed retry message." | **Premise false** for every network case; a rare non-network edge remains (see Q1) | `GoTrueAdminApi.signOut` (line 65–83) catches every `isAuthError` and **returns** it. `_handleRequest` (`lib/fetch.js` 112–121) turns any `fetch` throw — no connection, our 20 s `withTimeout` abort, CORS — into `AuthRetryableFetchError` (an auth error); a non-OK answer goes through `handleError` (also auth errors). So `_signOut` (`GoTrueClient.js` 3436–3446) gets `{ error }` and runs `removeCurrentSession()` **before** returning it. Our comment in `session-source.ts` ("On a failed request … it ALSO removes the stored session") is correct. The only throws that skip `_removeSession` are: the storage itself failing (reading the session in `_useSession`, or the remove), a lock failure, and the scope check (ours is always `'local'`). In those cases `useSignOut` re-enables the button and nothing is shown. |
| F2 | `prompts/auth-onboarding/plan.md:243` — step 0 click-by-click still says subject "Twój kod do Travelo" | **True** | Lines 113, 210, 235, 718, 725 of the same file and `supabase/config.toml` say "Your Travelo code" (D25). Line 243 is the only stale one. |
| F3 | `Architecture.md:343` — the root-layout row does not list the `settings` route; the header sentence does not cover it | **True** | `src/app/_layout.tsx` 84–112: `settings` is inside the app's `Stack.Protected` group, with a header (title `profile.settings`, `HeaderBackButton` "Profil" back to the profile, 44 dp on iOS). The row lists only `(drawer)`, `trips/new`, `trips/[tripId]/photos`. (CodeRabbit's "remove settings from the header-hidden list" is moot: it is not in that list; it just needs its own sentence.) |

### Assumptions
- No schema, migration or Supabase change.
- **Where the work happens is open (Q2):** the PR branch is checked out in the main checkout, which has an unpushed WIP commit
  (b49f9d2 "parked for the redesign") and 10 uncommitted files. The fix must not mix with that WIP.
- Commit, push and the PR reply happen only after Kacper's go-ahead for each (outward-facing).

## Approach
F2 and F3 are text edits by the orchestrator (owner of `Architecture.md` and the plans). F1 depends on Q1:
- **Q1-A (recommended): no code change.** Reply on the thread with the evidence above. The silent case needs the phone's
  storage to fail, which also breaks the rest of the app; one more message would not help that user.
- **Q1-B: small message.** `useSignOut` also returns `failed` (true after a rejection, false on the next try); `SettingsScreen`
  shows a fixed `settings.signOutFailed` text (pl/en) under the button with `accessibilityLiveRegion="polite"`, same style as
  the offline text. No check of `signedIn` needed: when the session *was* removed, the gate takes the screen away anyway.
  The two "there is no error to show" comments (`useSignOut.ts`, `SettingsScreen.tsx`) are updated.
Rejected: CodeRabbit's version that tells API errors apart from thrown ones — after a returned error the phone is already
signed out, so there is nothing to tell apart.

Exact text changes:
- **F2** (`prompts/auth-onboarding/plan.md:243`): "set the subject "Twój kod do Travelo"" → "set the subject "Your Travelo
  code"" and add "(needs the custom SMTP, D25)" after "Templates"; the rest of the line stays.
- **F3** (`Architecture.md:343`): app group → "(`(drawer)`, `trips/new`, `settings`, `trips/[tripId]/photos`)"; after the
  header sentence add: "`settings` has a header: title „Ustawienia", back button „Profil" (44 dp on iOS) back to the profile."
- `Architecture.md`: line 2 "after task: coderabbit-pr23-fixes"; changelog line "2026-10-22 — coderabbit-pr23-fixes — doc
  fixes (settings route in the root-layout row)" + "; Settings shows a sign-out error" only if Q1-B.

## Data structures (Zod)
None — no data shape changes.

## Tests
- Step 1 (docs): none — no behavior (approved as part of this plan). Full suite, typecheck, lint run once anyway.
- Step 2 (only if Q1-B), written first and seen failing:
  - `src/hooks/__tests__/useSignOut.test.tsx`: after a rejection `failed` is true; the next call sets it back to false;
    after a success `failed` stays false.
  - `src/__tests__/app/settings.test.tsx`: when `signOut` rejects, the text `settings.signOutFailed` shows and the button is
    enabled; it is not shown before the first try.

## Files
- Step 1: `prompts/auth-onboarding/plan.md`, `Architecture.md`.
- Step 2 (Q1-B only): `src/hooks/useSignOut.ts`, `src/features/profile/SettingsScreen.tsx`, `src/i18n/locales/{pl,en}.json` (one
  key), the two test files above.

## Skills
- none — step 1 (docs only).
- `test-driven-development` — step 2, only if Q1-B (frontend agent).
- `git-workflow-and-versioning` — commit after Kacper's go-ahead.

## Steps
- [x] 1. [docs, orchestrator] F2 + F3 text changes — skill: none — tests first: none (no behavior) — verify: diff read, full suite + typecheck + lint green
- [x] 2. ~~[frontend]~~ skipped: Q1-A chosen (only if Q1-B) sign-out error message — skill: test-driven-development — tests first: see Tests — verify: red → green, full suite, typecheck, lint; verifier
- [x] 3. [orchestrator] `Architecture.md` line 2 + changelog; draft the PR reply (F1–F3, fixed + skipped with reasons) for Kacper to approve, then commit, push, post

## Progress log
- Decisions (Kacper, 2026-10-22): plan approved; **Q1 = A** (no code change for F1, reply with the auth-js evidence);
  **Q2 = (a)** detached worktree `.claude/worktrees/pr23-fixes` at `origin/feature/profile-screen` (d2a91b9), so the main
  checkout's WIP (b49f9d2 + uncommitted files) is untouched.
- Step 1: no tests (docs only, as approved) · `prompts/auth-onboarding/plan.md:243` subject → "Your Travelo code" + SMTP/D25
  note; `Architecture.md` root-layout row lists `settings` and its header · typecheck ✓, lint ✓, `pnpm test` 132 suites /
  2890 tests ✓ (4 of 5 runs green; the first run had 1 failed test whose name was not captured, not reproduced in 4 reruns;
  a docs-only diff cannot cause it, so it is a flaky test to watch) · verifier PASS · skill used: none.
- Step 2: skipped (Q1-A).
- Step 3: `Architecture.md` line 2 + changelog entry done (verifier PASS). After Kacper's go-ahead (2026-10-22): commit cb979ce
  pushed to `feature/profile-screen` (d2a91b9..cb979ce); reply posted on PR #23
  (https://github.com/KacperBartlomiejczak/Travelo/pull/23#issuecomment-6338057768). The main checkout's WIP commit b49f9d2
  still has to be rebased onto the new `origin/feature/profile-screen`.

## Risks & open questions
- **Q1:** F1 — A (no code, reply with the auth-js evidence; recommended) or B (fixed retry message in Settings)?
- **Q2:** Where to commit: (a) a temporary detached worktree at `origin/feature/profile-screen`, push to the branch, then the
  main checkout's WIP commit b49f9d2 has to be rebased on top later (recommended: keeps the WIP untouched); or (b) in the
  main checkout on top of the WIP (then the WIP goes into the PR too).
- Risk: if auth-js is bumped, the F1 evidence must be re-checked (the comment in `session-source.ts` depends on it).
