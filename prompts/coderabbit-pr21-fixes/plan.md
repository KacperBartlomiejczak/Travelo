# Task: Fix the valid CodeRabbit findings on PR #21
Status: in progress (approved by Kacper 2026-10-20)

Source: CodeRabbit review 5578141455 on https://github.com/KacperBartlomiejczak/Travelo/pull/21 (2026-10-19, commit d631b14):
5 inline (Major), 20 Minor, 1 nitpick, 1 inconclusive pre-merge check (docstring coverage).

## Understanding & assumptions
Every finding was checked against the code on `feature/auth-onboarding` (2026-10-20). Only the findings that are true
**and** matter for this project get a fix. "Done" = every step below `[x]`, full suite + typecheck + lint green,
verifier PASS, `Architecture.md` updated, and a reply on PR #21 listing what was fixed and why the rest was skipped.

### Verification of each finding

**App code — all three confirmed:**

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| A1 | `src/data/session-source.ts:58` — `auth.getUser(oldToken)` answering `session_not_found` removes the session stored **now**, even if another account signed in while the request was in flight | **True** (narrow race, max 20 s = request timeout) | `@supabase/auth-js` 2.117.2 `GoTrueClient._getUser`: `session_not_found` → `AuthSessionMissingError` (`lib/fetch.js:82-86`) → `this._removeSession()` (`GoTrueClient.js:2726-2729`), which deletes whatever is in storage and fires `SIGNED_OUT`. Our user-id guard (line 62-63) only covers `user_not_found`. The existing race tests (`session-source.test.ts:216+`) only cover `user_not_found`. |
| A2 | `src/hooks/useReduceMotion.ts:15-16` — a `reduceMotionChanged` event arriving before `isReduceMotionEnabled()` resolves gets overwritten by the older answer | **True** (tiny window, but a real ordering bug) | Both the `.then` and the listener call `setReduceMotion`; nothing marks the event as newer. |
| A3 | `src/components/Chip.tsx:19,28` — wrapped chip rows overlap their touch areas | **True** | Chip 32 dp + `hitSlop` 6 dp top/bottom = 44 dp; row gap in `InterestChips.tsx:31` is `spacing[2]` = 8 dp → adjacent rows overlap by 6+6−8 = **4 dp**. Non-overlapping 44 dp cells need a row pitch ≥ 44 dp, i.e. a visible row gap ≥ 12 dp — this is a visual change (see Q1). |

**Project config — confirmed:**

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| C1 | `.codex/agents/*.toml` name `apps/mobile/` and `packages/schemas/`, which do not exist (code is in `src/`, schemas in `src/schemas/`) | **True** — and the same mismatch is in `.claude/agents/*.md` and in the CLAUDE.md agents table (see Q4) | `ls apps packages` → no such directory. |
| C2 | `.codex/agents/Explorer.toml`, `Planner.toml` have no `sandbox_mode = "read-only"` | True, low value (defense in depth) | No `sandbox` key in any `.codex/agents/*.toml`. |
| C3 | `.codex/config.toml` / `.mcp.json` launch `mobile-mcp` via `cmd /c` (Windows only) | True but **skip** | Kacper develops alone on Windows; there is no macOS/Linux host to support. Revisit if that changes. |

**Vendored skills (`.agents/skills/**`, 17 findings incl. 4 "Major") — recommend skip (see Q3):**
These files are third-party content from `addyosmani/agent-skills`, pinned by hash in `skills-lock.json`. Local edits
diverge from upstream and are lost on the next update. Checked:
- The 3 "conflicts with CLAUDE.md" findings (`idea-refine` → `docs/ideas/`, `planning-and-task-breakdown` → `tasks/plan.md`,
  `spec-driven-development` → `SPEC-*.md`) are real text, but CLAUDE.md already overrides them ("Precedence" and
  "Workflow skills serve this file's process … never into their own spec, task or ADR files"). No behavior change needed.
- `ci-cd-and-automation:268` (GitHub Actions `${{ inputs.version }}` injection) and `context-engineering:98-103` (source files
  marked "trusted") are true for the examples, but they are documentation examples — no workflow in this repo runs them, and
  our agents follow the instruction boundary from their own rules.
- The remaining Minor ones (example code bugs: `setQueryData` without `undefined`, `<dialog open>`, missing `onCreateTask`,
  Error Boundary examples, `isTest` regex, wrong script path `skills/idea-refine/...`, etc.) are true but cosmetic for us.

**Pre-merge check "Docstring coverage 66.67 % < 80 %"** — skip: the project has no docstring rule; CodeRabbit's default threshold.

### Assumptions
- No schema, migration or Supabase change is needed (none of the findings touches data shapes).
- The PR reply is posted only after Kacper approves its text (outward-facing).

## Approach
- **A1:** run the server check on a **separate, isolated auth client** (`createClient(url, key, { auth: { persistSession: false,
  autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'travelo-session-check' } })`, no new dependency), so
  `_removeSession()` only clears that client's in-memory storage. Our code then decides: for `session_not_found` **or**
  `user_not_found`, sign out locally (`signOut({ scope: 'local' })` on the live client, which fires `SIGNED_OUT` → `onChange`)
  only when the session stored now still belongs to the same user. Rejected: accepting the race and documenting it (cheap, but
  a background check could sign out an account that just signed in).
  Accepted edge: if the **same** user signs out and back in within the in-flight check (≤ 20 s), they are signed out once and sign in again.
- **A2:** a local `changed` flag set by the listener; the initial query result and its rejection are ignored once it is set.
  Rejected: comparing timestamps (more code, same effect).
- **A3:** the wrapping chip row in `InterestChips` gets `rowGap: spacing[3]` (12 dp = 2 × slop), `columnGap` stays `spacing[2]`; `Chip` itself unchanged (Q1).
- **C1/C2:** text edits only in agent definition files.

## Data structures (Zod)
None — no data shape changes. `SessionSource` interface is unchanged; only `createSupabaseSessionSource`'s `Deps` gains
`checkAuth: Pick<SupabaseClient['auth'], 'getUser'>` (the isolated client), and `auth` drops `getUser`.

## Tests
**Step 1 (A1) — `src/data/__tests__/session-source.test.ts`, written first, must fail:**
- the check calls `getUser` on the **isolated** client with the stored token, never on the live one;
- `session_not_found` for the stored session, same user still stored → `signOut({ scope: 'local' })` once (replaces the test at
  line 175 "the library signs out by itself, the app does not do it a second time" — that assumption is no longer true by design;
  logged as a deliberate test change);
- `session_not_found` while **another user** signed in meanwhile → no `signOut`;
- `session_not_found`, token refreshed meanwhile (same user) → `signOut` once;
- `session_not_found`, no session stored by then → nothing;
- existing `user_not_found` race tests keep passing unchanged;
- `src/data/__tests__/supabase.test.ts`: the isolated client is created with `persistSession: false`, `autoRefreshToken: false`,
  `detectSessionInUrl: false` and a storage key different from the app client.

**Step 2 (A2) — `src/hooks/__tests__/useReduceMotion.test.tsx`:**
- event `true` arrives while the query is pending, then the query resolves `false` → stays `true`;
- event `true` arrives while the query is pending, then the query rejects → stays `true` (and `false` event case → stays `false`);
- all existing tests keep passing (query applied when no event came).

**Step 3 (A3) — `src/components/__tests__/Chip.test.tsx` / `InterestChips.test.tsx`:** the wrapping row's `rowGap` is 12 dp
(= touch target − chip height, so the 44 dp cells of two rows touch but do not overlap) while `columnGap` stays 8 dp; existing 44 dp touch-target test unchanged.

**Step 4 (C1/C2):** no tests — pure config/text change with no runtime behavior (named here for approval).

## Files
- Step 1: `src/data/session-source.ts`, `src/data/supabase.ts`, `src/data/app-session-source.ts`,
  `src/data/__tests__/session-source.test.ts`, `src/data/__tests__/supabase.test.ts`, possibly `src/test/fake-supabase.ts`
- Step 2: `src/hooks/useReduceMotion.ts`, `src/hooks/__tests__/useReduceMotion.test.tsx`
- Step 3: `src/components/InterestChips.tsx`, `src/components/__tests__/InterestChips.test.tsx`
- Step 4: `.codex/agents/{Frontend,Backend,Explorer,Planner,Verifier}.toml`, `.claude/agents/{Frontend,Backend,Explorer,Planner,Verifier}.md`
- End: `Architecture.md`, this `plan.md`

## Skills
- `test-driven-development` — steps 1-3 — red → green for each fix
- `doubt-driven-development` — step 1 — auth/sign-out logic is high-stakes
- `source-driven-development` — step 1 — behavior of `@supabase/auth-js` 2.117.2 `getUser` / `createClient` options, cited from the installed source
- `git-workflow-and-versioning` — end — one commit per step

## Steps
- [x] 1. [frontend] (A1) Isolated client for the stored-session check; sign out ourselves for `session_not_found`/`user_not_found` only when the same user is still stored — skill: test-driven-development, doubt-driven-development, source-driven-development — tests first: see Tests/Step 1 — verify: full suite, typecheck, lint, verifier
- [x] 2. [frontend] (A2) `useReduceMotion`: a change event wins over the pending initial query — skill: test-driven-development — tests first: see Tests/Step 2 — verify: full suite, typecheck, lint, verifier
- [x] 3. [frontend] (A3) Chip touch areas do not overlap: 12 dp between wrapped rows (Q1) — skill: test-driven-development — tests first: see Tests/Step 3 — verify: full suite, typecheck, lint, verifier, tester on device (profile setup screen chips)
- [x] 4. [config] (C1, C2) Agent definitions point at `src/` and `src/schemas/`; read-only Codex agents get `sandbox_mode = "read-only"` — skill: none — no tests (pure config) — verify: grep shows no `apps/mobile`/`packages/schemas` in edited files, TOML parses
- [ ] 5. Reply on PR #21: fixed items + skipped items with reasons (text approved by Kacper first) — skill: none

## Verification
After each step: `pnpm typecheck`, `pnpm lint`, `pnpm test` (full suite), verifier agent. Step 3 also: manual check —
on the profile setup screen, tap the top and bottom edges of chips in neighbouring rows; each tap toggles only the chip it is on.

## Progress log
- Step 1 (2026-10-20): tests written first (red ✓: 12 failed for the expected reason — `checkAuth` missing / `getUser` still on the live client) · `src/data/supabase.ts` exports `sessionCheckSupabase` (isolated client: `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`, `storageKey: 'travelo-session-check'`, same timed fetch, no `keepSessionFresh`); `session-source.ts` `Deps.checkAuth` does the `getUser` check, and for `AuthSessionMissingError` (= `session_not_found`) or `user_not_found` signs out locally only when the same user is still stored; `app-session-source.ts` wires it · green ✓ · full suite 120 suites / 2487 tests, typecheck, lint ✓ · verifier PASS · skills used: test-driven-development, doubt-driven-development, source-driven-development (auth-js 2.117.2 `GoTrueClient.js` `_getUser` ~2698-2735, constructor `persistSession: false` → in-memory storage ~266-269, `lib/fetch.js:82-86`).
  - **Deliberate test changes:** "the session is gone on the server: the library signs out by itself, the app does not do it a second time" (`session-source.test.ts`) and its counterpart in `Session.test.tsx` asserted the old behaviour, which is false by design now; replaced by "session_not_found → `signOut({ scope: 'local' })` once" (+ data cleared, welcome screen in `Session.test.tsx`).
  - **Deviation:** the existing `user_not_found` race tests were not left untouched as planned: rewired to `checkAuth` and folded into a `describe.each` over `user_not_found` / `session_not_found`; assertions unchanged.
  - Verifier follow-ups done: removed the now-unused `emitLibrarySignedOut` helper; `Session.test.tsx` gives `checkAuth` its own `getUser` mock so the tests prove which client was asked.
  - **Accepted edge (added):** `getSession()` and `signOut({ scope: 'local' })` are two awaits, so a different-user sign-in in the milliseconds between them would still be signed out. Not atomic in auth-js; accepted.
  - Manual check for Kacper (dev build): no "Multiple GoTrueClient instances" warning in the console at start; signed-in start stays signed in; a user deleted in the dashboard lands on the welcome screen.
  - Follow-up idea (not in scope): a contract test with the real `GoTrueClient` and a fake fetch answering `session_not_found`, guarding against auth-js upgrades.

- Step 2 (2026-10-20): tests written first (red ✓: `Expected true, Received false` — late query result overwrote the event; `Expected false, Received true` — the rejection fallback overwrote it) · `useReduceMotion.ts`: a local `changed` flag set by the `reduceMotionChanged` listener; the initial query's `.then`/`.catch` apply only when `active && !changed` · green ✓ · full suite 120 suites / 2489 tests, typecheck, lint ✓ · verifier PASS · skill used: test-driven-development · no deviations.

- Step 3 (2026-10-20): test written first (red ✓: `rowGap` received `undefined`) · `InterestChips.tsx`: wrapping row `rowGap: spacing[3]` (12 dp), `columnGap: spacing[2]` (8 dp) instead of `gap: spacing[2]`; `Chip.tsx` unchanged · green ✓ · full suite 120 suites / 2490 tests, typecheck, lint ✓ · verifier PASS · skill used: test-driven-development.
  - Verifier's note "at large font sizes the touch areas overlap again" checked and rejected: the slop is a fixed 6 dp on each side, so a chip of any height h has a cell of h + 12 and the row pitch is h + 12 — the cells touch, never overlap.
  - **Device check (tester): blocked.** Metro was down at first; after starting it, the app opened on the signed-out welcome screen, and both `InterestChips` screens need a signed-in account; the tester does not sign in. Left to Kacper as a manual check (see Verification).
- Step 4 (2026-10-20, orchestrator, pure config — no tests as approved): `.codex/agents/{Backend,Explorer,Frontend,Planner,Verifier}.toml` and `.claude/agents/{Backend,Explorer,Frontend,Planner,Verifier}.md` — `packages/schemas` → `src/schemas`, `apps/mobile/` → `src/` (outside `src/schemas/`); `sandbox_mode = "read-only"` in Codex `Explorer.toml` and `Planner.toml` · verify ✓: no `apps/mobile`/`packages/schemas` left in those files, all `.codex/agents/*.toml` parse with `tomllib`, line endings kept · skill used: none.
  - Noticed, not changed (out of scope): the same agent files still name `PLAN.md` (plans now live in `prompts/<feature-name>/plan.md`); the CLAUDE.md agents table still says `apps/mobile/` (Kacper's file).
- Architecture.md updated (2026-10-20): background check, `supabase.ts` (`sessionCheckSupabase`), R14 accepted edges, `useReduceMotion`, `InterestChips` row gap, changelog.

## Decisions (Kacper, 2026-10-20)
- **Q1 (A3):** row gap between wrapped chip rows becomes 12 dp (`spacing[3]`); the column gap stays 8 dp. Visible chip height stays 32 dp.
- **Q2 (A1):** isolated auth client for the stored-session check; our code decides the local sign-out (same user still stored).
- **Q3:** vendored skill findings are skipped; no `.coderabbit.yaml`. Reasons go into the PR reply.
- **Q4 (C1):** fix the paths in both `.codex/agents/*.toml` and `.claude/agents/*.md`. The CLAUDE.md agents table is left to Kacper.

## Risks & open questions
- Risk: a second GoTrueClient in the app may log "Multiple GoTrueClient instances" if the storage keys collide — avoided by a distinct `storageKey`; step 1 checks the console.
