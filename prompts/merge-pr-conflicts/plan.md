# Task: resolve-pr-merge-conflicts
Status: awaiting approval

## Understanding & assumptions
- The request is to resolve merge conflicts in the current PR branch `feature/supabase-client`.
- I assume conflicts are against the repository default branch `main`.
- Done means: merge commit exists on this branch, conflicts are resolved correctly, tests/typecheck/lint pass, and the PR comment receives a reply with the commit hash.

## Approach
- Fetch `main` in a shallow-safe way, progressively deepen history until a merge base exists, then merge `origin/main`.
- Resolve only conflict hunks, preserving approved feature behavior and keeping changes minimal.
- Rejected alternative: rebasing onto `main` (would require history rewrite and force push, which is not supported in this environment).

## Data structures (Zod)
- No schema changes expected.

## Tests
- Step 2: run merge and ensure git reports conflict-free completion or explicit conflict files.
- Step 3: after conflict resolution, run `pnpm test` and confirm green.
- Step 4: run `pnpm typecheck` and `pnpm lint` and confirm green.

## Files
- `prompts/merge-pr-conflicts/plan.md` (this plan and progress log)
- Any files reported by git as conflicted during merge
- `Architecture.md` (changelog only if architecture did not change)

## Skills
- `merge-branch` — step 2 — safe merge in shallow single-branch clone.

## Steps
- [ ] 1. [backend] Confirm merge target and branch state — skill: none — tests first: n/a (no behavior change) — verify: `git status`, `git ls-remote --symref origin HEAD`.
- [ ] 2. [backend] Merge `origin/main` into branch via progressive deepening — skill: merge-branch — tests first: n/a (git integration step) — verify: merge commit or list conflicted files.
- [ ] 3. [backend] Resolve conflicts surgically and complete merge commit — skill: none — tests first: run failing check only if conflict breaks tests, then fix — verify: `git diff --name-only --diff-filter=U` empty, `git log -1 --pretty=%P` has two parents.
- [ ] 4. [backend] Run verification checks — skill: none — tests first: n/a — verify: `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass.
- [ ] 5. [backend] Update plan progress, update `Architecture.md` changelog if needed, run `parallel_validation`, reply to PR comment — skill: none — tests first: n/a — verify: validation completed and comment replied.

## Progress log
- Plan created. Waiting for approval before merge actions.

## Risks & open questions
- If conflicts touch unclear behavior, I will stop and ask for decision before choosing a resolution.
