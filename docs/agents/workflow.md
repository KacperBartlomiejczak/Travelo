# Workflow

# How we work

## Ask when unsure — always
If you don't know something or don't understand it, **stop and ask Kacper how he wants it to look and work.** This applies to requirements, behavior, data, visuals, copy, and priorities, before the plan and during execution.

- **Ask instead of guessing** when: a requirement is vague or has several valid readings; the design context has no answer; the behavior of a screen or flow is not defined; a decision changes data structures or architecture; two documents conflict; a library, API or tool behaves differently than expected.
- **Ask about the result, not only the technique.** For anything visual or behavioral, ask what he wants to see and do ("what should happen when the budget is exceeded?", "should the Day plan open on today or on day 1?"), not just which implementation to use.
- **Make it easy to answer.** Ask one focused question at a time (a few at most, batched), in Polish. Where it helps, give 2–3 concrete options with a recommendation and the trade-off, and note that he can answer differently.
- **Do not continue on the unclear part until he answers.** Work that does not depend on the answer may proceed; the rest waits. Never fill the gap with a "reasonable default" and move on.
- **Record the answer** in the feature's `plan.md` under assumptions/decisions, so the same question is not asked twice.
- **Subagents do not guess either.** If a brief is unclear, they return `Status: question` with the exact question. The orchestrator relays it to Kacper, then re-sends the brief with the answer.
- Asking is not approval. A plan still needs his explicit go-ahead (see step 2 below).

## 1. Plan first — always
Before touching any code, write the plan into `prompts/<feature-name>/plan.md` and present it to Kacper.

- **Location:** every feature gets its own folder `prompts/<feature-name>/` (kebab-case, e.g. `prompts/trips-empty-state/`) and its plan lives in `plan.md` inside it. Create the folder if it does not exist. Never put plans in a root `PLAN.md`.
- One feature = one folder = one `plan.md`. A finished plan stays in its folder as the record of that feature.

The plan must contain:

1. **Understanding & assumptions** — what the task is, in your own words, what "done" means, and every assumption you are making.
2. **Approach** — how you intend to do it and why. Mention the alternative you rejected, in one line.
3. **Data structures** — the exact Zod schemas you will add or change, shown as schema sketches. Zod is the single source of truth, so this section comes before any implementation detail.
4. **Tests** — for each step, the tests you will write *before* the code: what behavior they assert, including failure and edge cases.
5. **Files** — which files will be created or modified.
6. **Skills** — which skills from `.claude/skills/` will be used, at which step, and why (or "none"). Skills are part of the plan, so Kacper approves them together with the steps.
7. **Steps** — a numbered checklist, each step small and independently verifiable.
8. **Verification** — how each step will be checked (see Verification loop).
9. **Risks & open questions** — anything Kacper needs to decide.

## 2. Wait for approval
- The orchestrator **always stops and waits** for explicit approval ("ok", "akceptuję", "approved", or similar).
- Questions, comments, or silence are **not** approval. Answer, revise the plan, and ask again.
- This applies to plans drafted by subagents too — they go through the orchestrator and Kacper first.

## 3. Execute step by step — red, green, refactor
Do **one step at a time**, in order. Do not jump ahead. The one exception is parallel backend steps (see Rules for delegation in `docs/agents/subagents.md`). Schema changes are always the first step of any task that touches data.

For every step:
1. **Red** — write the tests for this step. Run them. They must fail, and fail for the expected reason (missing behavior, not a typo or a broken import).
2. **Green** — write the minimum code that makes them pass.
3. **Full suite** — run all tests, typecheck, and lint. Everything green, not just the new tests.
4. **Refactor** (only if needed) — clean up while the suite stays green.
5. Only then is the step done.

## 4. Update the plan after every step
After **each** completed step, the orchestrator updates the feature's `plan.md`:
- mark the step `[x]`,
- note what actually changed (files, decisions),
- record the tests written and the red → green result,
- record verification results,
- log any deviation from the plan and why.

If a step shows the plan is wrong, **stop**: update the plan, explain what changed, and get approval again before continuing.

## 5. Update the docs when the work is finished — always
When a task is finished (all steps `[x]`, verifier PASS, full suite green), the orchestrator **always** updates the matching file(s) in `docs/architecture/` before reporting the task as done. A task is **not done** until those docs match the code.

- Describe the app **as it is now**, not as planned. Planned work stays in `prompts/<feature-name>/plan.md`.
- Update only the parts the task changed, and remove anything that is no longer true.
- Record new decisions in `docs/architecture/decisions.md` and new debt in `docs/architecture/known-limitations.md`.
- If nothing architectural changed, there is nothing to update; say so in the plan's progress log.
- Never write something you have not checked in the code. If unsure, check or ask.

## Plan template (`prompts/<feature-name>/plan.md`)
```md
# Zadanie: <nazwa>
Status: szkic | czeka na akceptację | w trakcie | zablokowane | zrobione

## Zrozumienie i założenia
## Podejście
## Struktury danych (Zod)
## Testy
## Pliki
## Skille
- <skill> — krok N — dlaczego
## Kroki
- [ ] 1. [backend|frontend] ...  — skill: <nazwa lub brak> — najpierw testy: ... — weryfikacja: ...
## Dziennik postępu
- Krok 1: testy napisane (red ✓) · <co się zmieniło> · green ✓ · <weryfikacja> · użyty skill: <nazwa lub brak> · <odstępstwa>
## Ryzyka i otwarte pytania
```
