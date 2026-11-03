# Task: docs-restructure (split CLAUDE.md and Architecture.md into AGENTS.md + docs/)
Status: done (2026-11-03, verifier PASS)

## Understanding & assumptions
Goal: `CLAUDE.md` (465 lines) and `Architecture.md` (764 lines) are hard to navigate. Slim `CLAUDE.md` into a short main file (how the AI works + a router) and move the detail into a `docs/` tree, so each question has one obvious file:

```
CLAUDE.md            → how the AI works (short rules + router; main source)
AGENTS.md            → thin pointer to CLAUDE.md (Codex entry)
docs/architecture/   → how the app works
docs/agents/         → how the harness works
docs/development/    → how we work with the repo
prompts/             → history of concrete changes (unchanged)
```

Decisions (Kacper, 2026-11-02):
- D1 (revised 2026-11-02). **`CLAUDE.md` stays and is the main source of information.** It is slimmed to short rules + a router to `docs/`. `AGENTS.md` becomes a thin pointer to `CLAUDE.md` (Codex entry); its Expo-template content moves to `docs/development/commands.md` and `docs/architecture/frontend.md`.
- D1a. `CLAUDE.md` gets a "Subagents" section that says where subagents are described and how that description looks: the behavior/flow/delegation rules live in `docs/agents/subagents.md`, each agent's own definition in `.claude/agents/<Agent>.md` (mirrored in `.codex/agents/<Agent>.toml`). The section lists each agent with a one-line role and a link, and states the format `docs/agents/subagents.md` follows (agent table: model, does, edits, must not; when to use explorer; step flow; delegation rules).
- D2. Extra files are allowed: `docs/architecture/decisions.md`, `known-limitations.md`; Testing/Tooling go to `docs/development/`. The `Architecture.md` changelog is dropped (history = git + `prompts/`).
- D3. `Architecture.md` is deleted after its content is moved.

Assumptions (tell me if wrong):
- A1. Content is **moved, not rewritten**; only re-sectioned and de-duplicated. Rules keep their meaning. Surgical-changes rule applies.
- A2. The target tree was written for React + Express; here `frontend.md` = Expo/React Native, `backend.md` = Supabase (Postgres, RLS, Edge Functions), `shared.md` = the Zod contract (`src/schemas`) between app, DB and Edge Functions.
- A3. `context/app-context.md` and `context/design-context.md` stay where they are (product + visuals, not architecture); only their `Architecture.md` references change.
- A4. The `claude-reflect` "Learned rules" block stays at the bottom of `CLAUDE.md` (that tool writes there). The branch-per-task rule from the uncommitted `CLAUDE.md` change is carried into `docs/development/git-workflow.md`.
- A5. Old plans in `prompts/` keep mentioning `Architecture.md` (history, not edited).
- A6. The "update Architecture.md when a task is finished" rule becomes "update the matching `docs/architecture/*` file(s)"; the Verifier checklist item changes the same way.
- A7. Docs-only task: no production code, so "tests first" does not apply; the check is a content-coverage and link check (see Verification). Kacper approves this exemption with the plan.

## Approach
Move section by section into the files below, then write the new short `AGENTS.md`, then delete `Architecture.md` and fix every reference. Rejected: keeping everything in one `AGENTS.md` with headings (that is today's mess, just renamed).

### Mapping (every old section has a destination)
| Source | Destination |
|---|---|
| CLAUDE.md: Prompt, "What you're building" (short), principles 1–4, TDD headline, Zod headline, language, Learned rules | stay in `CLAUDE.md` (short) |
| New | `CLAUDE.md` router table + "Subagents" section (D1a) |
| Old AGENTS.md (Expo template) | `docs/development/commands.md`, `docs/architecture/frontend.md`; `AGENTS.md` itself becomes a pointer |
| CLAUDE.md: Stack, Repo layout; Architecture.md: Overview, Folder tree, Modules, External services | `docs/architecture/overview.md` |
| Architecture.md: Frontend (routes, components/hooks, theme & i18n); CLAUDE.md: Design; old AGENTS.md: Expo/Router/EAS rules | `docs/architecture/frontend.md` |
| Architecture.md: Backend; CLAUDE.md: Data & security, AI | `docs/architecture/backend.md` |
| CLAUDE.md: Data structures, Zod is the single source; Architecture.md: Data model | `docs/architecture/shared.md` |
| CLAUDE.md: Offline expenses; Architecture.md: Data flow (offline, server-first, AI) | `docs/architecture/flows/` (`server-first.md`, `offline-expenses.md`, `ai-day-plan.md`) |
| Architecture.md: Key decisions; CLAUDE.md: Decisions made, Open decisions | `docs/architecture/decisions.md` |
| Architecture.md: Known limitations & tech debt | `docs/architecture/known-limitations.md` |
| CLAUDE.md: How we work (ask, plan, approval, execute, update plan), plan template | `docs/agents/workflow.md` |
| CLAUDE.md: Agents, Step flow, delegation; Architecture.md: Claude Code configuration (subagents) | `docs/agents/subagents.md` |
| CLAUDE.md: Skills; Architecture.md: Claude Code configuration (skills) | `docs/agents/skills.md` |
| CLAUDE.md: Tests first, Verification loop; Architecture.md: Testing | `docs/development/testing.md` |
| CLAUDE.md: Code rules, branch rule; CONTRIBUTING.md git parts (referenced, not moved) | `docs/development/git-workflow.md` |
| Architecture.md: Tooling, Dependencies; old AGENTS.md: Commands | `docs/development/commands.md` |
| Architecture.md: Changelog | dropped (D2) |

## Data structures (Zod)
None. The Zod schemas are not touched; the conceptual model block moves verbatim into `docs/architecture/shared.md`.

## Tests
No behavior changes. Checks instead (run before each step is marked done):
- Coverage: each old heading appears in the destination files (script lists headings of `CLAUDE.md` + `Architecture.md` and greps for them / the mapping above).
- Links: every relative link in `CLAUDE.md`, `AGENTS.md` and `docs/**` resolves to an existing file.
- `grep -rn "Architecture.md"` outside `prompts/` returns nothing at the end.
- Existing `pnpm typecheck`, `pnpm lint`, `pnpm test` stay green (nothing in code changes).

## Files
Create: `docs/architecture/{overview,frontend,backend,shared,decisions,known-limitations}.md`, `docs/architecture/flows/{server-first,offline-expenses,ai-day-plan}.md`, `docs/agents/{workflow,subagents,skills}.md`, `docs/development/{testing,git-workflow,commands}.md`.
Modify: `CLAUDE.md` (slim: rules + router + Subagents section + Learned rules), `AGENTS.md` (thin pointer), `README.md`, `CONTRIBUTING.md`, `context/app-context.md`, `.claude/agents/{Backend,Frontend,Verifier}.md`, `.codex/agents/{Backend,Frontend,Verifier}.toml`.
Delete: `Architecture.md`.

## Skills
- `documentation-and-adrs` — steps 2–5 — where decisions/docs live.
- `context-engineering` — step 5 — keeping `AGENTS.md` short with a router.
- `test-driven-development` — step 8 — fixture fix, red then green.
- `javascript-typescript-jest`, `debugging-and-error-recovery` — step 9 — flaky pulse test.
- `code-review-and-quality` — step 7 — verifier review.

## Steps
- [x] 1. [docs] Create branch `feature/docs-restructure` from main, carrying the uncommitted `CLAUDE.md` change — skill: git-workflow-and-versioning — verify: `git status`.
- [x] 2. [docs] `docs/architecture/*` + `flows/` from `Architecture.md` and the relevant `CLAUDE.md` sections — skill: documentation-and-adrs — verify: coverage check.
- [x] 3. [docs] `docs/development/*` — skill: documentation-and-adrs — verify: coverage + links.
- [x] 4. [docs] `docs/agents/*` — skill: documentation-and-adrs — verify: coverage + links.
- [x] 5. [docs] Slim `CLAUDE.md` (kept as main source: core rules, router, "Subagents" section per D1a, Learned rules); `AGENTS.md` becomes a thin pointer — skill: context-engineering — verify: `CLAUDE.md` well under its current 465 lines, links resolve, every question lands in one file.
- [x] 6. [docs] Delete `Architecture.md`; fix references in README, CONTRIBUTING, `context/app-context.md`, `.claude/agents`, `.codex/agents`; reword the "update Architecture.md" rule — skill: none — verify: grep returns nothing outside `prompts/`.
- [x] 7. Verifier PASS + `pnpm typecheck && pnpm lint && pnpm test` — skill: code-review-and-quality.
- [x] 8. [backend] (added 2026-11-03, approved by Kacper) Make `src/test/fixtures.ts` independent of the calendar date so the full suite is green on any day; red = the 5 currently failing suites (205 tests), green = full suite; no assertion weakened, only dates changed or derived from the fixture — skill: test-driven-development — verify: full `pnpm test`, typecheck, lint, verifier.
- [x] 9. [frontend] (added 2026-11-03, approved by Kacper) Find the cause of the intermittent failure in `src/features/drawer/__tests__/TripsDrawer.test.tsx` (pulse animation: `expect(opacity()).toBeCloseTo(1, 1)` got 0.95; `pulses 1 → 0.5 → 1 over 1200 ms` got 0.55 under a shifted clock) and make it deterministic without weakening an assertion — skill: javascript-typescript-jest, debugging-and-error-recovery — tests first: reproduce the failure (loop the test / shifted clock), then fix — verify: test passes 30x in a loop, full suite green, typecheck, lint, verifier.

- [x] 10. [docs] (added 2026-11-03, CodeRabbit PR #26, triage below) Fix the agent/harness docs: Planner return format gets Skills + per-step skill (`.claude/agents/Planner.md`, `.codex/agents/Planner.toml`); docs-update order vs. final verifier (`docs/agents/workflow.md`, `.claude/agents/Verifier.md`, `.codex/agents/Verifier.toml`); Codex Backend scope = same as `.claude/agents/Backend.md` (+ Verifier scope check in both); `skills.md` (interview-me pre-plan exception, domain-modeling ADRs); `subagents.md` return contract per role; `workflow.md` red-green scoped to behavioral steps, docs steps verified by link/coverage/grep checks; jest skill `resetAllMocks` -> `clearAllMocks` + `restoreAllMocks` (`.claude/skills` and `.agents/skills` copies) — skill: documentation-and-adrs — verify: link check, grep, verifier.
- [x] 11. [docs] (added 2026-11-03, CodeRabbit PR #26) Fix the architecture docs: `backend.md` timeout wording; `decisions.md` offline scope (budget implemented, expenses planned); `overview.md` Data row back inside the table + blank line between every heading and its table in `docs/**`; `shared.md` `src/schemas/` as the current path; `commands.md` two separate `expo run:` commands; `README.md` links to `docs/architecture/` — skill: documentation-and-adrs — verify: link check, verifier.
- [x] 13. [frontend] (added 2026-11-03, approved by Kacper) Verifier found an intermittent failure in `src/components/__tests__/BottomSheet.test.tsx:31-34` (`getByText('content')`, 1 of 2 full runs, not reproduced alone); find the cause (reproduce-first, loaded loop) and make it deterministic without weakening an assertion; production code only if the cause is there — skill: javascript-typescript-jest, debugging-and-error-recovery — verify: 30 loaded runs of the file, full suite, typecheck, lint, verifier.
- [x] 12. Final: verifier PASS on steps 10–11, `pnpm typecheck && pnpm lint && pnpm test`, push `git push origin HEAD:feature/docs-restructure`, reply to CodeRabbit threads if Kacper wants — skill: code-review-and-quality.

- Step 10 (2026-11-03): all 8 fixes applied (Planner .md/.toml, Verifier .md/.toml, Backend.toml, workflow, subagents, skills, jest skill x2); extras from verifier notes: workflow heading 5 aligned, docs-only carve-out in Planner/Verifier (.md/.toml). Verifier: docs correct, but FAIL because of the BottomSheet flake (step 13); to re-verify after it.
- Step 11 (2026-11-03): backend.md timeout wording; decisions.md offline scope (budget built, expenses planned); overview.md `Data` row back in the table with its details moved to a "Data module" subsection below the table, plus a blank line between every heading and its table in docs/** and README; shared.md `src/schemas/` as the current path; commands.md separate `expo run:ios` / `expo run:android`; README links to `docs/architecture/`.
- Step 13 (2026-11-03, frontend agent): the line-34 failure could not be reproduced (18 loaded runs of the file, 3 full runs). Measured fragility: the first test pays the cold start of the Modal render path (1.5 s idle, 4.1-6.6 s under load, against a 5 s timeout). Fix: `beforeAll` in `BottomSheet.test.tsx` renders and unmounts the sheet once with its own 60 s timeout; no assertion changed, production code untouched. Green: 30 loaded runs, `--testTimeout=700` passes 37/37, full suite 3153/3153, typecheck and lint green. Caveat: if the line-34 failure returns, the cause is something else. Unrelated flake seen once: store queue test "a task that uses another method of the store inside does not wait for itself".

## CodeRabbit triage (PR #26, review 2026-11-03, 14 comments, all accepted)
All 14 are valid against the current code/docs; none rejected. Comment -> step: Planner.md:27 -> 10; Verifier.md:48 -> 10; jest SKILL.md:18 -> 10; Backend.toml:12 -> 10; skills.md:22 and :61 -> 10; subagents.md:43 -> 10; workflow.md:43 -> 10; backend.md:4 -> 11; decisions.md:4 -> 11; overview.md:129 -> 11 (the `Data` row really is split out of the table; MD058 blank lines are lint-only but cheap, so done in docs/** together); shared.md:6 -> 11; commands.md:42 -> 11; README.md:293 -> 11.

Commits: one per step, on the single branch.

## Verification
See Tests. Manual check for Kacper: open `CLAUDE.md`, confirm each of the four questions (how the AI works / how the app works / how the harness works / how we work) lands in exactly one folder.

## Progress log
Approved by Kacper 2026-11-02 (D1 revised: CLAUDE.md stays the main source; AGENTS.md is a pointer). Docs-only, so no tests-first (A7); checks = link check + coverage + grep.
- Step 1: branch `feature/docs-restructure` created, the uncommitted CLAUDE.md change carried.
- Step 2: `docs/architecture/{overview,frontend,backend,shared,decisions,known-limitations}.md` + `flows/{server-first,auth-and-gate,offline,ai-day-plan}.md`, moved verbatim with a line-range script. Deviations: extra `flows/auth-and-gate.md`; `offline-expenses.md` became `offline.md` (the budget is the only offline write in code; the expense rules stay there as planned, not implemented); the "Repo layout" block of CLAUDE.md was dropped (it described the unadopted monorepo; the note lives in overview.md "Planned monorepo layout").
- Step 3: `docs/development/{testing,git-workflow,commands}.md`. Deviation: the Expo Navigation / EAS / Rules text of the old AGENTS.md went to `commands.md`, not `frontend.md`.
- Step 4: `docs/agents/{workflow,subagents,skills}.md`; workflow step 5 rewritten from "update Architecture.md" to "update docs/architecture/"; the template and the changelog are dropped.
- Step 5: CLAUDE.md 465 -> 136 lines (rules + router + Subagents section + Learned rules); AGENTS.md is a one-paragraph pointer.
- Step 6: Architecture.md deleted; references fixed in README, CONTRIBUTING, context/app-context.md, `.claude/agents/{Backend,Frontend,Verifier}.md` and `.codex/agents/*.toml`. `grep` outside `prompts/` is empty; link check over 21 files: 0 broken.
- Added after the first verifier FAIL (2026-11-03): `docs/development/rules.md` (full rules mirror, requested by Kacper, CLAUDE.md wins on conflict); `flows/` split into `flows/features/` (one file per feature) and cross-cutting files (requested by Kacper); stale reading instructions in `.claude/agents` and `.codex/agents` now point to CLAUDE.md and the docs files; the "These principles are working if" line restored in CLAUDE.md; dropped on purpose: the Architecture.md template and the "Last updated" line.
- Step 7 (2026-11-03): `pnpm typecheck` and `pnpm lint` green. Full `pnpm test`: 205 failed of 3153 (5 suites: photos, look, clear-during-operation, supabase-trip-repository, trip-rows). Root cause: `src/test/fixtures.ts` hardcodes the outbound `departAt` 2026-11-02T10:00, now in the past, so `validation.departureInPast` rejects it (the first run on 2026-11-02 had 2 failures for the same reason, once that hour passed). `src/` has no diff vs main. Not fixed here: a test-fixture change is outside this docs task and needs Kacper's decision. Verifier result: pending.
- Step 8 (2026-11-03, backend agent): `src/test/fixtures.ts` builds flight times relative to now (`inDays(days, "HH:mm")`: outbound +29 d, connection +30 d, return +42 d); `trip-rows.test.ts` pins the clock with fake timers at its existing NOW (2026-10-04, where the fixture yields the old literals); `look.test.tsx` uses `inDays`. Red: 5 tests still failing after the fixture change (205 before). Green: full suite 3153/3153, typecheck and lint green (re-run by the orchestrator). Checked with a shifted clock: +30 days green; +400 days 1 failure, `TripsDrawer` pulse animation (0.55 vs 0.5), likely an artefact of the shim, not investigated. No assertion weakened. First verifier run: FAIL on docs (stale agent instructions etc.), fixed in 99306fc; a re-run is still pending.
- Step 9 (2026-11-03, frontend agent): root cause of the flaky pulse test = `jest.useFakeTimers({ now, advanceTimers: true })` in the file's outer `beforeEach`, which lets the fake clock follow real time, so the Reanimated sample after `advanceTimersByTime(600)` drifts under load. Fix: the "skeleton pulse" describe resets to `jest.useFakeTimers({ now: NOW })`; no assertion or tolerance changed, production code untouched. Red: 8/8 parallel runs failed (0.55 vs 0.5). Green: 30 consecutive loaded runs of the file, each 29/29 tests; full suite 3153/3153, typecheck and lint green (re-run by the orchestrator). The +400-day shifted-clock run was not repeated.
- Verifier run 4 (2026-11-03, fresh context): FAIL. typecheck, lint, test green (146 suites, 3153 tests); steps 8-9 PASS. Findings: (1) Verifier.md/.toml limit backend to `src/schemas/`; (2) Backend.toml omits data layer and `src/test/`; (3) Frontend.md/.toml scope lacks the data-layer exclusion; (4) README claims anonymous sign-in (config has it off); (5) README stale routes/features/test counts, testing.md stale counts; (6) skills.md lists missing `stack-review`, omits `supabase`, `supabase-postgres-best-practices`; (7) known-limitations.md:65 and app-context.md:295 reference a monorepo layout no longer in CLAUDE.md; (8) shared.md misses `provider-profile.ts`. Kacper: fix all.
- Verifier runs 5-8 (2026-11-03, fresh context each): all 8 findings fixed (agent scopes in `.claude`/`.codex`, README auth/routes/features/roadmap/badge/friend-code wording, testing.md count, skills.md tables, monorepo and CLAUDE.md cross-references in known-limitations/app-context/skills.md, decisions.md supersession, shared.md `provider-profile.ts`); roadmap rows for sign-in and profile follow their plans' "in progress" status. Run 8: PASS; typecheck, lint, 146 suites / 3153 tests green. Left as non-blocking: overview.md stack lists planned services without a marker, the TZ=Pacific/Auckland run in testing.md is dated 2026-10-19, overview.md prompts tree is partial, `src/schemas/sync.ts:3` comment cites a CLAUDE.md section that moved to `flows/offline.md`.

## Risks & open questions
- R1. Docs only, so a missed section is the real risk; the coverage check mitigates it.
- R2. `.codex/agents/*.toml` mirrors `.claude/agents/*.md` (CRLF in the Verifier file); edit both consistently.
- R4. Merge conflict: `feature/expenses` and `feature/profile-settings` still edit `Architecture.md` and `CLAUDE.md`; their entries must be moved into `docs/architecture/*` when merging.
- Q1. (resolved by step 8) Date-dependent fixtures (`src/test/fixtures.ts`) make the suite red on any day after the hardcoded date; fix with a relative date? (a backend step, needs approval)
- R3. `CLAUDE.md` is auto-loaded into every session, so what stays in it costs context every time; rules that must always apply stay, everything else is reached through the router.
