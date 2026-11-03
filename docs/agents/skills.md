# Skills

Project skills live in `.claude/skills/`. A skill is a tool for a specific kind of work. **Before starting work that a skill covers, load it and follow it; say which skill you are using.**

## Precedence
If instructions conflict, this order wins: **Kacper's current message → `CLAUDE.md` → `context/design-context.md` → skills.** A skill never overrides the TDD loop, the approval gate, Zod as the single source of truth, or the design tokens. If a skill's advice conflicts with these, follow the project rules and tell Kacper.

## Available skills and when to use them
| Skill | Use it when | Used by |
|---|---|---|
| `grill-me` | A task or idea is vague. Interview Kacper about it **before** drafting the plan. Supports "Ask when unsure". | orchestrator |
| `domain-modeling` | A task adds or changes entities, relations or business rules. Use it to design the model **before** the Zod schema step. | planner, backend |
| `frontend-design` | Building a new screen or component, for structure and quality of the UI work. | frontend |
| `ui-taste` | Reviewing a finished screen or component for visual polish. | frontend, verifier |
| `improve-codebase-architecture` | **Only** at the end of a milestone or when Kacper asks. Never in the middle of a step. | orchestrator |
| `find-skills` | You think a skill might exist for the job but none of the above fits. | orchestrator |
| `stack-review` | Before milestone 0, whenever a new library/service/dependency is proposed, or when Kacper asks to re-check the stack. Questions each technology choice and asks Kacper to confirm or switch. | orchestrator, planner |

### Engineering workflow skills (`addyosmani/agent-skills`, installed 2026-10-08)
| Skill | Use it when | Used by |
|---|---|---|
| `interview-me` | An ask is underspecified. Alternative to `grill-me` (one question at a time, in Polish); use one of them, not both. Runs before the plan, like `grill-me`. | orchestrator |
| `idea-refine` | Kacper asks to explore or stress-test a raw idea before it becomes a feature. Results go into the feature's `plan.md`, **not** into `docs/ideas/`. | orchestrator |
| `spec-driven-development` | A new feature has no clear requirements yet. The "spec" is the feature's `plan.md` (Understanding & assumptions, Data structures); never a separate spec file. | orchestrator, planner |
| `planning-and-task-breakdown` | Breaking an approved scope into the plan's numbered Steps (small, independently verifiable). | orchestrator, planner |
| `incremental-implementation` | Executing a plan step: thin slices, one coherent diff per step. | backend, frontend |
| `test-driven-development` | Every step with behavior: the red → green → refactor loop. It supports the TDD rule above, never relaxes it. | backend, frontend |
| `api-and-interface-design` | Designing a repository interface, hook contract, Edge Function input/output or module boundary (shapes are still Zod schemas). | planner, backend |
| `source-driven-development` | Writing against a library/API where current docs matter (Expo, expo-router, Supabase, TanStack Query, `@google/genai`). Check the docs first, cite them in the progress log. | backend, frontend |
| `frontend-ui-engineering` | Building screens and components: accessibility, states, responsive layout. Subordinate to `context/design-context.md` like the other design skills. | frontend |
| `debugging-and-error-recovery` | A test, typecheck, lint or build fails for an unclear reason: root cause first, never weaken a test. Counts toward the "3 failed attempts → blocked" rule. | backend, frontend, orchestrator |
| `code-review-and-quality` | Reviewing a finished step or a PR before merge. | verifier, orchestrator |
| `code-simplification` | Code works but is more complex than needed. Only inside the current step's files (surgical changes); anything wider is proposed to Kacper. | backend, frontend, verifier |
| `doubt-driven-development` | High-stakes or irreversible work: RLS, auth, migrations, offline sync, deleting data. | orchestrator, verifier |
| `security-and-hardening` | Untrusted input, auth, RLS, storage, external APIs (Places, Gemini, FX), new dependencies, personal data. | backend, verifier |
| `performance-optimization` | A measured performance problem (slow list, query, startup). Not speculatively. | backend, frontend |
| `documentation-and-adrs` | Recording a decision. Decisions go into the feature's `plan.md` and `docs/architecture/decisions.md`; a separate ADR only when Kacper asks. | orchestrator |
| `git-workflow-and-versioning` | Committing, branching, PRs: atomic commits per step, English messages. | orchestrator |
| `deprecation-and-migration` | Removing or replacing an existing feature, API or table (expand/contract migrations, never editing an applied one). | planner, backend |
| `context-engineering` | Agent output degrades, or rules files / briefs need restructuring. | orchestrator |
| `constraint-driven-development` | **Only when Kacper asks** to write the quality bar down (it creates `CONSTRAINTS.md`). | orchestrator |
| `ci-cd-and-automation` | **Only when a task is about** CI/CD (GitHub Actions, EAS builds). | orchestrator, backend |
| `observability-and-instrumentation` | **Only when a task is about** logging, crash reporting or metrics. | backend, frontend |
| `shipping-and-launch` | **Only when preparing a release** (store build, rollout, rollback). | orchestrator |
| `browser-testing-with-devtools` | Debugging the Expo **web** build in a real browser. Needs the chrome-devtools MCP server, which is not configured; ask Kacper first. | frontend |
| `javascript-typescript-jest` | Writing or fixing Jest tests: structure, mocking, async, snapshots. Supports the TDD rule and the project test setup in `docs/development/testing.md`; it never relaxes them. Where it disagrees with the existing tests or `jest.setup.ts`, the repo wins. | backend, frontend |
| `using-agent-skills` | Picking which of the skills above fits a piece of work. Its "proceed unless corrected" rule does **not** apply here: the approval gate always wins. | orchestrator |

## Rules
- **Design skills are subordinate to `context/design-context.md`.** They may improve how a screen is built or reviewed, but they must not introduce new colors, fonts, spacing, gradients or any visual rule that is not in the design context. If the design context has no answer, ask Kacper.
- **Architecture suggestions are not changes.** `improve-codebase-architecture` produces proposals only. Each proposal becomes a normal plan that Kacper approves, then runs through tests-first. This keeps the "surgical changes" rule intact.
- **Workflow skills serve this file's process, they do not replace it.** `spec-driven-development`, `planning-and-task-breakdown` and `documentation-and-adrs` write into `prompts/<feature-name>/plan.md` and `docs/architecture/`, never into their own spec, task or ADR files; `idea-refine` and `constraint-driven-development` create files (`docs/ideas/`, `CONSTRAINTS.md`) only when Kacper asks.
- **Do not install or add new skills without asking Kacper.** `find-skills` may suggest one; he decides.
- **Skills are declared in the plan.** Every plan has a **Skills** section and every step names its skill (or "none"). Do not use a skill that is not in the approved plan (the one exception is `grill-me`, which runs *before* the plan exists; its outcome is then written into the plan); if another skill turns out to be needed, update the plan and get approval first. The orchestrator records the skill actually used in the progress log after each step.
- **Skill output is input to the plan, not a replacement for it.** Decisions from `grill-me` and `domain-modeling` are recorded in the feature's `plan.md` (assumptions and Data structures sections).
- Subagents use only the skills listed for them above. If one needs another skill, it returns `Status: question`.

## Installed skills (sources)
| Skill | Source | Purpose |
|---|---|---|
| `domain-modeling` | mattpocock/skills | Sharpen domain terms; write `GLOSSARY.md` and ADRs |
| `grill-me` | mattpocock/skills | Interview the user to sharpen a plan (user-invoked only) |
| `improve-codebase-architecture` | mattpocock/skills | Find refactoring opportunities and report them (user-invoked only) |
| `frontend-design` | anthropics/skills | Guidance for building distinctive UI |
| `ui-taste` | uizze.sh | UI polish and review playbooks for web and iOS |
| `find-skills` | vercel-labs/skills | Discover and install further skills |
| 25 engineering workflow skills (`interview-me`, `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `source-driven-development`, `frontend-ui-engineering`, `code-review-and-quality`, `security-and-hardening`, …) | addyosmani/agent-skills | Workflow per development phase; when each one is used and its limits are listed in `CLAUDE.md` → Skills. Copied straight into `.claude/skills/` (not symlinked from `.agents/skills/` like the others) |
| `javascript-typescript-jest` | github/awesome-copilot (installed 2026-11-03, `pnpm dlx skills add`) | Jest testing practices |

