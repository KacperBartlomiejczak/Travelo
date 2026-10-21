# Task: Fix the valid CodeRabbit findings on PR #22
Status: in progress (approved by Kacper 2026-10-21)

Source: CodeRabbit review 5603825401 on https://github.com/KacperBartlomiejczak/Travelo/pull/22 (2026-10-21, commit 873b7aa):
2 inline (Minor), 1 unverified trivial note inside "Additional comments", 1 inconclusive pre-merge check (docstring coverage).
The other 55 "Additional comments" are LGTM.

## Understanding & assumptions
Every finding was checked against `feature/friend-invite` at 873b7aa (worktree `.claude/worktrees/friend-invite`) on 2026-10-21,
and the hosted migration list was read with Supabase MCP `list_migrations` (read-only). Only findings that are true **and**
matter get a fix. "Done" = every step below `[x]`, full suite + typecheck + lint green, verifier PASS, `Architecture.md`
changelog entry, and (after Kacper approves its text) a reply on PR #22 saying what was fixed and why the rest was skipped.

### Verification of each finding

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| F1 | `Architecture.md:581` — the friend-invite limitation "The two migrations are not on the hosted project yet; the device check with two accounts is pending." is stale | **True** | Same file, line 336: both migrations "are applied to the hosted project (2026-10-21, via Supabase MCP)"; line 2 and changelog line 646: device check PASS. `prompts/friend-invite/plan.md` line 2 + progress log (line 162): migrations pushed; step 8 runs 1–2 PASS. `list_migrations` on the hosted project shows `friend_invite` = `20261021125912`, `friend_invite_code_only` = `20261021125935`. The real open item is the `supabase migration repair`. CodeRabbit's extra sentence "Photo-viewer delete was not checked on a device (covered by `photos.test.tsx`)" is also true: plan.md lines 165 and 169 ("not run on device: photo-viewer delete for owner and member"). |
| F2 | `Architecture.md:332` — "All five migrations are pushed to the project" | **True** | `supabase/migrations/` has 7 files; `list_migrations` on the hosted project returns 7 (trips, trip_photos, trip_photos_storage, trip_covers, profiles, friend_invite, friend_invite_code_only). |
| F3 | `context/app-context.md:48` — roadmap item 15 ends with "Not on the hosted Supabase yet (two migrations to push); device check pending." | **True** | Same evidence as F1. The item sits under "Done" in the roadmap, so the stale sentence contradicts its own section. |
| F4 | `src/__tests__/app/trips/new/flights.test.tsx:199` — "verify the wizard inset visually instead of asserting `paddingLeft`" (CodeRabbit marks it *unverified*, source: its generic learnings) | **Skip** | The assertion is the D27 guard for the wizard call site of `LayoverLabel inset` (friend-invite step 6). The same pattern is used in `LayoverLabel.test.tsx`, `home.test.tsx` and `summary.test.tsx`, and it is the only automated proof that the wizard keeps its 16 dp inset. Removing it would weaken a test, which CLAUDE.md forbids. The visual check is already a separate manual item. |
| F5 | Pre-merge check "Docstring coverage 71.21 % < 80 %" | **Skip** | The project has no docstring rule (CLAUDE.md: match the surrounding comment density); 80 % is CodeRabbit's default. Same decision as PR #21. |

### Decisions (Kacper, 2026-10-21)
- **D1 (Q1):** F3 uses the version without the repair detail: "On the hosted Supabase; device check passed."
- **D2 (Q3):** a reply on PR #22 covers F1–F5 (fixed + skipped with reasons); posted only after Kacper approves its text.
- Q2 (the `supabase migration repair` itself) stays outside this task.

### Assumptions
- No code, schema, migration or Supabase change: all valid findings are text in two docs.
- The `supabase migration repair` itself is **not** part of this task (it changes the hosted project; see Q2).
- Work happens in the existing worktree `.claude/worktrees/friend-invite` on `feature/friend-invite`, so the main checkout
  (`feature/profile-screen`, uncommitted work) is not touched.
- Commit, push and the PR reply happen only after Kacper's go-ahead for each (outward-facing).

## Approach
Edit the two docs inline (orchestrator owns `Architecture.md`; `context/app-context.md` belongs to no implementer agent).
Rejected: accepting CodeRabbit's committable suggestion as-is — it is fine for F1, but does not fix F2 and adds the repair
detail to the product context in F3 (see Q1).

Exact text changes:
- **F2** (`Architecture.md:332`): "All five migrations are pushed to the project:" → "All seven migrations are on the hosted
  project (checked 2026-10-21 with Supabase MCP `list_migrations`):". The existing sub-bullets stay unchanged.
- **F1** (`Architecture.md:581`): replace the stale bullet with:
  "The hosted migration history records the two migrations as `20261021125912` / `20261021125935`, not the file versions;
  run `supabase migration repair` before the next `db push`. Photo-viewer delete was not checked on a device (no photos on
  the test trip; covered by `photos.test.tsx`)."
- **F3** (`context/app-context.md:48`): replace the last sentence with "On the hosted Supabase; device check passed."
- `Architecture.md`: line 2 "Last updated … after task: coderabbit-pr22-fixes"; changelog line "2026-10-21 —
  coderabbit-pr22-fixes — doc fixes only (migration count, stale friend-invite limitation); no architectural change."

## Data structures (Zod)
None — no data shape changes.

## Tests
None — docs-only step with no behavior (CLAUDE.md allows steps without tests first only for pure setup/no-behavior work;
Kacper approves this as part of the plan). The full suite, typecheck and lint are still run once to confirm nothing else moved.

## Files
- Modify: `Architecture.md`, `context/app-context.md` (both on `feature/friend-invite`).
- Create: `prompts/coderabbit-pr22-fixes/plan.md` (this file).

## Skills
- git-workflow-and-versioning — step 3 — one atomic docs commit, English message.

## Steps
- [x] 1. [docs] `Architecture.md`: F2 count, F1 limitation, header + changelog — skill: none — tests first: none (docs, no behavior) — verify: grep shows no "not on the hosted", "five migrations" or "device check … pending" for friend-invite; text matches `list_migrations` and `prompts/friend-invite/plan.md`.
- [x] 2. [docs] `context/app-context.md`: F3 — skill: none — tests first: none (docs, no behavior) — verify: item 15 matches `Architecture.md` and the friend-invite plan; then `pnpm typecheck`, `pnpm lint`, `pnpm test` green in the worktree; verifier PASS on steps 1–2.
- [ ] 3. Commit on `feature/friend-invite` (`docs(coderabbit-pr22-fixes): …`) and push — only after Kacper's go-ahead — skill: git-workflow-and-versioning — verify: PR #22 shows the new commit.
- [ ] 4. Reply on PR #22 (F1–F3 fixed, F4/F5 skipped with the reasons above) — only after Kacper approves the text — skill: none — verify: comment visible on the PR.

## Verification
- Steps 1–2: diff read line by line against the evidence table; full suite + typecheck + lint; verifier (fresh context) checks the diff against this plan.
- Steps 3–4: `gh pr view 22` shows the commit / the reply.

## Progress log
- Step 1: no tests first (docs only, approved) · `Architecture.md`: header line 2 → after task coderabbit-pr22-fixes; line 332 "All five migrations are pushed" → "All seven migrations are on the hosted project (checked 2026-10-21 with Supabase MCP `list_migrations`)"; line 581 stale limitation → migration repair + photo-viewer delete not checked on a device; changelog line · skill used: none · deviation: plan said "line 1" for the header, it is line 2 (plan text corrected).
- Step 2: no tests first (docs only, approved) · `context/app-context.md:48` → "On the hosted Supabase; device check passed." (D1) · `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` 122/122 suites, 2674/2674 tests ✓ (Jest printed its existing "worker process has failed to exit gracefully" warning; exit 0) · verifier PASS on steps 1–2 · skill used: none · verifier notes outside this task: `Architecture.md:19` "Current state" does not mention friend-code linking; `prompts/friend-invite/plan.md:170` records an unconfirmed device observation ("Dalej" on the budget step went back to step 1 once) that no doc lists — both reported to Kacper.

## Risks & open questions
- **Q1:** F3 wording — product context without the repair detail ("On the hosted Supabase; device check passed.", recommended; the repair lives in `Architecture.md` and the friend-invite plan) vs CodeRabbit's version that also mentions `supabase migration repair`.
- **Q2:** The `supabase migration repair` itself is still open (outside this plan). Until it is done, the next `supabase db push` would try to apply `20261020120000` / `20261020130000` again. Kacper runs it himself, or it becomes its own small task.
- **Q3:** Should F4/F5 get a reply on the PR, or just stay unresolved?
