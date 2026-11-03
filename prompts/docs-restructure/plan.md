# Task: docs-restructure (split CLAUDE.md and Architecture.md into AGENTS.md + docs/)
Status: in progress (steps 1-6 done; step 7 waiting for the verifier)

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
- `code-review-and-quality` — step 7 — verifier review.

## Steps
- [x] 1. [docs] Create branch `feature/docs-restructure` from main, carrying the uncommitted `CLAUDE.md` change — skill: git-workflow-and-versioning — verify: `git status`.
- [x] 2. [docs] `docs/architecture/*` + `flows/` from `Architecture.md` and the relevant `CLAUDE.md` sections — skill: documentation-and-adrs — verify: coverage check.
- [x] 3. [docs] `docs/development/*` — skill: documentation-and-adrs — verify: coverage + links.
- [x] 4. [docs] `docs/agents/*` — skill: documentation-and-adrs — verify: coverage + links.
- [x] 5. [docs] Slim `CLAUDE.md` (kept as main source: core rules, router, "Subagents" section per D1a, Learned rules); `AGENTS.md` becomes a thin pointer — skill: context-engineering — verify: `CLAUDE.md` well under its current 465 lines, links resolve, every question lands in one file.
- [x] 6. [docs] Delete `Architecture.md`; fix references in README, CONTRIBUTING, `context/app-context.md`, `.claude/agents`, `.codex/agents`; reword the "update Architecture.md" rule — skill: none — verify: grep returns nothing outside `prompts/`.
- [ ] 7. Verifier PASS + `pnpm typecheck && pnpm lint && pnpm test` — skill: code-review-and-quality.
- [ ] 8. [backend] (added 2026-11-03, approved by Kacper) Make `src/test/fixtures.ts` independent of the calendar date so the full suite is green on any day; red = the 5 currently failing suites (205 tests), green = full suite; no assertion weakened, only dates changed or derived from the fixture — skill: test-driven-development — verify: full `pnpm test`, typecheck, lint, verifier.

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

## Risks & open questions
- R1. Docs only, so a missed section is the real risk; the coverage check mitigates it.
- R2. `.codex/agents/*.toml` mirrors `.claude/agents/*.md` (CRLF in the Verifier file); edit both consistently.
- R4. Merge conflict: `feature/expenses` and `feature/profile-settings` still edit `Architecture.md` and `CLAUDE.md`; their entries must be moved into `docs/architecture/*` when merging.
- Q1. Date-dependent fixtures (`src/test/fixtures.ts`) make the suite red on any day after the hardcoded date; fix with a relative date? (a backend step, needs approval)
- R3. `CLAUDE.md` is auto-loaded into every session, so what stays in it costs context every time; rules that must always apply stay, everything else is reached through the router.
