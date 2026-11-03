# Rules (full text)

Mirror of the rules in [`CLAUDE.md`](../../CLAUDE.md), which stays the main source and carries the short version. If the two ever differ, `CLAUDE.md` wins and this file gets fixed.

## Engineering principles
These bias toward caution over speed. For trivial tasks, use judgment.

**1. Think before coding — don't assume, don't hide confusion, surface tradeoffs.**
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**2. Simplicity first — minimum code that solves the problem, nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios. (Zod validation at boundaries is not this — external input is never "impossible".)
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**3. Surgical changes — touch only what you must, clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that *your* changes made unused. Leave pre-existing dead code unless asked.
- The test: every changed line traces directly to the approved plan step.

**4. Goal-driven execution — define success criteria, loop until verified.**
- Turn every task into a verifiable goal: "Add validation" → tests for invalid inputs, then make them pass; "Fix the bug" → a test that reproduces it first; "Refactor X" → tests pass before and after.
- Strong success criteria let you loop independently. "Make it work" is not a success criterion.

## Ask when unsure — always
If you don't know or don't understand something, **stop and ask Kacper how he wants it to look and work** (requirements, behavior, data, visuals, copy, priorities) — before the plan and during execution. One focused question at a time, in Polish, with 2–3 options and a recommendation when it helps. Never fill a gap with a "reasonable default". Record the answer in the feature's `plan.md`. Asking is not approval. Details: [`docs/agents/workflow.md`](../agents/workflow.md).

## Plan first, wait for approval
Before touching any code, write the plan into `prompts/<feature-name>/plan.md` and present it. The orchestrator **always stops and waits** for explicit approval ("ok", "akceptuję", "approved"); questions, comments or silence are not approval. Then execute one step at a time and update the plan after every step. Plan template and steps: [`docs/agents/workflow.md`](../agents/workflow.md).

## Tests first (TDD) — non-negotiable
- **No production code before a failing test**, seen failing for the expected reason.
- **Nothing is finished while any test fails** — the full suite, `pnpm typecheck` and `pnpm lint` must be green.
- Never delete, skip or weaken a test to get green. After **3 failed attempts** on the same problem, stop and report **blocked**.
- Full loop and checklist: [`docs/development/testing.md`](testing.md).

## Zod is the single source of truth
- Every entity, API payload, Edge Function input/output, AI output and form is a Zod schema in `src/schemas/` (target: `packages/schemas`). Types come **only** from `z.infer`.
- Any data change goes in this order: **Zod → migration → regenerate Supabase types → parity check passes.** Validate at every boundary.
- Details: [`docs/architecture/shared.md`](../architecture/shared.md).

## Data, offline and AI (short)
- Money is **integer minor units + ISO 4217 code**, never floats. Timestamps are ISO 8601 with offset. **RLS on every table.**
- Offline scope is decided by Kacper (see [`docs/architecture/decisions.md`](../architecture/decisions.md)); extending it is his decision, not yours.
- AI: Gemini only from Edge Functions, schema generated from Zod, the model never invents places. Rules: [`docs/architecture/flows/ai-day-plan.md`](../architecture/flows/ai-day-plan.md).

## Code
- TypeScript strict, no `any`, no `@ts-ignore` without a written reason.
- Small, focused changes; one plan step = one coherent diff.
- Do not add dependencies without asking. Never edit an applied migration — write a new one.

## Design
Before building any UI, read [`context/design-context.md`](../../context/design-context.md). Colors, spacing, radii and typography come from theme tokens; all user-facing text goes through i18n keys (Polish and English). Every screen has loading, empty, error and (if relevant) offline states. Rules: [`docs/architecture/frontend.md`](../architecture/frontend.md).
