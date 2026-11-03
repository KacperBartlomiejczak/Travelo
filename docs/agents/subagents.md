# Subagents

Definitions live in `.claude/agents/<Agent>.md` (mirrored in `.codex/agents/<Agent>.toml`). This file is the contract: who does what, when, and how work flows.

## Orchestrator (main session)
- Owns the plans in `prompts/` and the docs in `docs/architecture/` — **the only one allowed to edit them**.
- Writes or collects the plan, waits for approval, delegates steps, integrates results, runs the verification loop, updates the plan after every step.
- **Is a manager only (Kacper, 2026-10-25).** It edits **documents only**: `CLAUDE.md`, `docs/**/*.md`, `context/*.md`, `prompts/**/plan.md` and `.claude/agents/*.md`. It never writes or edits code, tests, schemas, migrations, config or i18n files, not even a one-line fix: every such change goes to **backend** or **frontend** as a step brief. It may run read-only commands and the checks (`pnpm test`, `pnpm typecheck`, `pnpm lint`) and git commands.
- **Commits every step on the task's one branch after the verifier's PASS** (and the tester's, when it ran). See Step flow, point 4.

## Subagents
Definitions live in `.claude/agents/`.

| Agent | Model | Does | Edits | Must not |
|---|---|---|---|---|
| **explorer** (read-only) | Haiku 5.5 (`claude-haiku-5-5`) | Answers one concrete question about the codebase: where X lives, which schemas / components / hooks / tests / migrations already exist, which pattern to follow. Returns `file:line` locations and short conclusions | nothing | Edit files, propose implementations |
| **planner** (read-only) | opus | Drafts a plan in the plan template format, every step tagged `[backend]` or `[frontend]` | nothing — returns the plan to the orchestrator | Start implementing, edit any `plan.md` |
| **backend** | sonnet | Executes **one approved backend step**: tests first (red), then code (green) | `src/schemas/` (target: `packages/schemas/`), the data layer (`src/data/`, `src/lib/`, `src/providers/`, `src/test/`; Kacper 2026-10-20), `supabase/migrations/`, `supabase/functions/` | Touch `apps/mobile/`, return with any failing test |
| **frontend** | sonnet | Executes **one approved frontend step** following `context/design-context.md`: tests first, then code | `src/` outside `src/schemas/` and the data layer (target: `apps/mobile/`) | Change Zod schemas or `supabase/` (stop and report instead), return with any failing test |
| **verifier** (fresh context) | Haiku 5.5 (`claude-haiku-5-5`) | Checks a finished step against the plan, Rules, design context and Verification loop; runs the checks itself | nothing | Fix things itself — it reports PASS / FAIL |
| **tester** (device, via `mobile-mcp`) | Haiku 5.5 (`claude-haiku-5-5`), effort high | Drives the app on a connected phone/emulator and walks the plan's manual test steps; checks the screens match the plan | nothing | Fix things itself, guess undefined behavior, use real personal data — it reports PASS / FAIL per scenario |

The model column mirrors the `model:` field in `.claude/agents/*.md`; change both together.

## When to use the explorer
- **Before drafting a plan**, when the orchestrator does not yet know which files, schemas, components or tests the feature touches. Its findings go into the plan's Files section.
- **Before writing a step brief**, so the brief names the exact files, existing patterns and test helpers instead of guesses.
- **When a subagent returns `Status: question` about the codebase** (not about requirements; those go to Kacper).
- Not for small lookups the orchestrator can do with one search, and never as a substitute for asking Kacper about behavior.

## Step flow
0. **explorer** maps the relevant code (files, schemas, patterns, tests) when it is not already known.
1. Planner (or orchestrator) drafts the plan → Kacper approves.
2. Orchestrator sends each step to **backend** or **frontend** by its tag. Order: schemas → backend → frontend.
3. **verifier** checks every finished step. FAIL → back to the same implementer with the verifier's issues.
   For frontend steps, when a device or emulator is connected, **tester** then runs the plan's manual test steps on it (MCP server `mobile-mcp`, `.mcp.json`). FAIL → back to the implementer the same way.
4. Only after PASS does the orchestrator mark the step `[x]` in the feature's `plan.md`, then **commits and pushes the step**:
   - **one branch per task** (Kacper, 2026-11-02): `feature/<feature-name>`, cut from the feature's base branch at the start; no per-step branches;
   - one commit with the step's code, tests and its `plan.md` update, English message `<type>(<feature-name>): <what> (step N)`, using `git-workflow-and-versioning`;
   - `git push` to that branch; the next step continues on it.
   No commit or push before PASS, and never with a failing test.
5. After the last step, the orchestrator updates `docs/architecture/`, then reports the task as done.

## Rules for delegation
- Every brief is self-contained: the step, files allowed, relevant Zod schemas, tests to write first, acceptance criteria.
- A step that needs both backend and frontend changes is split into two steps.
- No two subagents edit the same file in parallel.
- **Several backend subagents may run at the same time, each on a different approved step** (Kacper, 2026-10-25), when the steps are independent: none needs another's result and their files do not overlap. The orchestrator says which steps run in parallel before starting them. Each one is verified separately; after each PASS it is committed with only its own files (`git add <paths>`) onto the task's branch, in the order the steps passed. Frontend steps still run one at a time.
- Each subagent returns: what changed, files touched, tests written and their red → green results, verification results, concerns.

## Configuration (tools)
| Agent | Model | Tools | Role |
|---|---|---|---|
| `explorer` | `claude-haiku-5-5` (Haiku 5.5) | Read, Grep, Glob | Read-only scout: finds code, schemas and patterns |
| `planner` | opus | Read, Grep, Glob | Read-only: drafts a plan in the plan template format |
| `backend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one backend step test-first (schemas, migrations, RLS, Edge Functions) |
| `frontend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one frontend step test-first, following the design context |
| `verifier` | `claude-haiku-5-5` (Haiku 5.5) | Read, Grep, Glob, Bash | Independent PASS/FAIL review of a finished step; never fixes |
| `tester` | `claude-haiku-5-5` (Haiku 5.5), effort high | Read, Grep, Glob, Bash, `mcp__mobile-mcp` | Walks a plan's manual steps on a connected phone / emulator (MCP server `mobile-mcp`, `.mcp.json`); PASS / FAIL per scenario; never fixes |

