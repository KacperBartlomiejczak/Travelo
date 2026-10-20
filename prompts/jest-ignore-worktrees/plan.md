# Task: Jest ignores Claude session worktrees
Status: done (approved by Kacper 2026-10-19)

## Understanding & assumptions
- When a Claude session runs in a git worktree inside this checkout (`.claude/worktrees/<name>/`), plain `pnpm test` also collects that copy's test files. The main checkout's suite then goes red because of someone else's in-progress work (seen during `prompts/theme-split-and-profile-prefill/plan.md`, 2026-10-19: 6 suites failing, every verifier run needed `--testPathIgnorePatterns ".claude/worktrees"`).
- Done = plain `pnpm test`, `pnpm typecheck` and `pnpm lint` are green **with a worktree present** under `.claude/worktrees/`, and the Known limitations line in `Architecture.md` about it is gone, with a changelog line added.
- The Jest config is the `"jest"` key in the root `package.json` (preset `jest-expo`). Checked: the preset sets no `testPathIgnorePatterns`, `modulePathIgnorePatterns` or `watchPathIgnorePatterns`, so today Jest's default `["/node_modules/"]` applies. Setting our own array replaces the default, so `/node_modules/` is listed explicitly.
- A worktree has its own `package.json` (name `traveling`), so Jest's haste map would also see a second package with the same name. `modulePathIgnorePatterns` keeps the worktree out of module resolution and the haste map too.
- `pnpm typecheck` is not affected: TypeScript's `**/*` include globs skip folders whose name starts with a dot, so `.claude/` is never included. `pnpm lint` (ESLint 9 flat config) does not skip dot-folders by default, but `.claude/worktrees/` is listed in `.git/info/exclude`; whether `expo lint` honours that is checked in step 1, and if it does not, step 2 also adds `.claude/worktrees/**` to `ignores` in `eslint.config.js` (one line).
- No watchman config exists (`.watchmanconfig` absent); Jest on Windows does not use watchman here, so no watchman change.
- `.claude/worktrees/stoic-feynman-8bd8d4/` is currently an empty leftover folder (the use-reduce-motion session is done). It is not touched.

## Approach
Add to the `"jest"` key in `package.json`:
```json
"testPathIgnorePatterns": ["/node_modules/", "<rootDir>/.claude/worktrees/"],
"modulePathIgnorePatterns": ["<rootDir>/.claude/worktrees/"]
```
Rejected: moving the config to `jest.config.js` — more churn for the same two lines.

## Data structures (Zod)
None. No data shape changes.

## Tests
Pure tooling setup with no app behaviour, so there is no unit test to write first (a Jest test cannot meaningfully assert which files Jest itself collects). Instead, a **reproducible red → green check**:
- Create a temporary git worktree `.claude/worktrees/jest-ignore-check/` (detached at HEAD) and put one deliberately failing canary test in it (`src/__worktree_canary__.test.ts` with `expect(true).toBe(false)`).
- **Red (before the change):** plain `pnpm test` collects the canary and fails; the haste collision warning about the duplicate `package.json` is expected too.
- **Green (after the change):** plain `pnpm test` is green, the canary is not collected (`--listTests` does not list any path under `.claude/worktrees`), no haste collision warning. `pnpm typecheck` and `pnpm lint` green with the worktree present.
- Then remove the temporary worktree (`git worktree remove --force`).

## Files
- `package.json` — `jest.testPathIgnorePatterns`, `jest.modulePathIgnorePatterns`
- `eslint.config.js` — only if step 1 shows lint picks up the worktree
- `Architecture.md` — remove the Known limitations line, add changelog line
- `prompts/jest-ignore-worktrees/plan.md` — this plan

## Skills
- none — two config lines; no skill covers this better than the plan itself.

## Steps
- [x] 1. [tooling] Red: create the temporary worktree with the canary, run `pnpm test`, `pnpm typecheck`, `pnpm lint`, record which fail — skill: none — verify: canary failure seen in `pnpm test` output
- [x] 2. [tooling] Green: add the ignore patterns to `package.json` (and `eslint.config.js` only if step 1 showed lint failing) — skill: none — verify: `pnpm test`, `pnpm typecheck`, `pnpm lint` green with the worktree still present; `pnpm test -- --listTests` lists nothing under `.claude/worktrees`
- [x] 3. [docs] Remove the temporary worktree, update `Architecture.md` (Known limitations, changelog), mark this plan done — skill: none — verify: `git worktree list` shows only the main checkout; `grep worktrees Architecture.md` only in the changelog

Delegation: this is root config, not `apps/mobile`/`src` or `supabase/`, so no frontend/backend agent fits; the orchestrator does it inline, then a **verifier** checks it.

## Progress log
- Step 1: red ✓ · temporary worktree `.claude/worktrees/jest-ignore-check/` (detached at 95d3c2a) with the canary `src/__worktree_canary__.test.ts` · `npx jest --listTests` listed 121 paths under `.claude/worktrees` (the copy's 120 tests + the canary); the canary run failed (`Expected: false, Received: true`) · `pnpm typecheck` and `pnpm lint` were already green with the worktree present · skill used: none.
- Step 2: `package.json` "jest" gained `testPathIgnorePatterns: ["/node_modules/", "<rootDir>/.claude/worktrees/"]` and `modulePathIgnorePatterns: ["<rootDir>/.claude/worktrees/"]` · green ✓ with the worktree still present: `--listTests` 119 paths, 0 under `worktrees`; plain `pnpm test` 119/119 suites, 2473 tests, no canary, no haste collision warning; `pnpm typecheck` and `pnpm lint` green · verifier PASS (also checked: the 119 listed paths equal every `*.test.ts(x)` under `src/`, so no real test is hidden; with the old config the haste collision on the worktree's `package.json` does appear) · skill used: none.
  - Deviation / closed conditional: `eslint.config.js` not changed. Understanding said "if `expo lint` does not honour the git exclude"; Steps said "only if step 1 showed lint failing" — the verifier flagged the mismatch. Evidence settles both: `expo lint` lints 287 files, 0 under `worktrees` (plain `npx eslint .` would lint them, but the project script is `expo lint`), and it was green before the change.
- Step 3: temporary worktree removed (`git worktree list` shows only the main checkout; the empty leftover `.claude/worktrees/stoic-feynman-8bd8d4/` from the use-reduce-motion session was left alone) · `Architecture.md`: header, testing note (line 409), Known limitations line removed, changelog entry · skill used: none.

## Risks & open questions
- None for Kacper beyond approval. If `expo lint` turns out to collect the worktree, the extra `eslint.config.js` line is within this plan.
