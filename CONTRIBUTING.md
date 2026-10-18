# Contributing to Travelo

Thanks for wanting to help. Travelo is a small project with a clear process, so changes land quickly when they follow it. This page explains how.

Set the app up first: see [Installation in the README](README.md#installation). To understand what the app is and does, read [`context/app-context.md`](context/app-context.md).

## The short version

1. **Open an issue first** and wait for a go-ahead. Do not start a big change without one.
2. **Write a plan** for the change in `prompts/<feature-name>/plan.md`. The maintainer approves it before any code.
3. **Write tests first.** See them fail, then write the code.
4. **Keep the change small**: one coherent change per pull request.
5. Make sure **tests, typecheck and lint are green**, then open a pull request.

## Before you start

### Open an issue

Describe what you want to change and why. For a bug, give the steps to reproduce it, what you expected and what happened, and your platform (iOS or Android, device or emulator). For a feature, describe the result you want to see and do, not only the technique.

Some things are decided and will not be accepted:

- Flight or hotel booking, a social feed, user reviews, and settlements ("who owes whom"). They are out of scope.
- Offline support for anything beyond the **budget per person** and **expenses**. That is a product decision for the maintainer. Everything else is server-first.
- Calling an AI model or Google APIs from the app. These calls go through Edge Functions only, and keys never ship in the app.

### Write a plan

Each feature has one plan in `prompts/<feature-name>/plan.md` (kebab-case folder name). Look at a finished one, such as `prompts/trip-photos/plan.md`, for the shape. A plan contains:

1. Understanding and assumptions: what "done" means.
2. Approach, and the alternative you rejected.
3. Data structures: the exact Zod schemas you will add or change.
4. Tests you will write first, including failure and edge cases.
5. Files you will create or change.
6. Steps: a numbered checklist of small, independently verifiable steps.
7. Verification: how each step is checked.
8. Risks and open questions.

**Wait for explicit approval of the plan before you write code.** If something is unclear, ask in the issue instead of guessing. After each step, update the plan: mark it done, and note the tests and any deviation.

Tiny fixes (a typo, a wrong label) do not need a plan. Say so in the pull request.

## Development workflow

### Tests first

- No production code before a failing test for it. Write the test, run it, and confirm it fails **for the expected reason** (missing behavior, not a typo).
- Then write the minimum code that makes it pass, then refactor with the suite green.
- Never delete, skip (`.skip`, `.only`, `xit`) or weaken a test to get green. If a test is wrong, say so in the pull request and explain.
- Fixing a bug starts with a test that reproduces it.

What to test:

| Change | Tests |
|---|---|
| A Zod schema | Valid and invalid fixtures |
| Business logic (budgets, layovers, money) | Unit tests |
| UI behavior | Component tests (React Native Testing Library) |
| A table or policy | A SQL test in `supabase/tests/`: user A cannot read or write user B's trip, and a linked viewer cannot write |
| Anything offline or sync | Saving offline, syncing on reconnect, retrying without duplicates, a failed sync staying visible |

Tests never live under `src/app/` because every file there becomes a route. Route tests go in `src/__tests__/app/`.

### Run the checks

Run all three. A change is not done while any of them fails:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

For database changes, also run `pnpm test:db` against a local Supabase (see the [README](README.md#testing)).

## Code rules

### Zod is the source of truth

- Every entity, API payload, form and external response is a Zod schema in `src/schemas/`.
- Types come only from `z.infer`. Do not write a type that duplicates a schema.
- Validate at every boundary: forms, server responses, SQLite rows, external APIs and AI output.
- A data change goes in this order: **Zod schema → migration → regenerate types (`pnpm db:types`) → tests pass.**

### Database

- Never edit a migration that has already been applied. Write a new one.
- Row Level Security on every table. A trip is visible only to its owner and to linked members, and linked members are read-only.
- Money is stored as **integer minor units plus an ISO 4217 currency code**. Never use floats for money.
- Timestamps are ISO 8601 with an offset. Flights also store the airport's IANA time zone.

### TypeScript and style

- TypeScript is strict. No `any`. No `@ts-ignore` without a written reason.
- Match the style of the code around you. Do not reformat or "improve" code you are not changing.
- Remove imports and variables that **your** change made unused. If you notice unrelated dead code, mention it in the pull request instead of deleting it.
- Do not add a dependency without asking in the issue first. Install packages with `npx expo install <package>`.
- Code, comments, commit messages and plans are written in **English**.

### UI

- Read [`context/design-context.md`](context/design-context.md) before you touch any UI.
- All colors, spacing, radii and type come from theme tokens in `src/theme/`. No hardcoded colors or magic numbers in components.
- All user-facing text goes through i18n keys. Add the key to **both** `src/i18n/locales/pl.json` and `en.json`. A test checks that they match.
- Every screen has loading, empty and error states, and an offline state where it matters.
- Touch targets are at least 44 pt. Money is always shown with its currency. Estimates are prefixed with `~` and shown as ranges.
- Light and dark mode both work. Support screen readers: label every control.

## Branches, commits and pull requests

### Branches

Branch from an up-to-date `main`. Name the branch with a prefix and a short kebab-case name:

| Prefix | For |
|---|---|
| `feature/` | A new feature, for example `feature/trip-photos` |
| `fix/` | A bug fix, for example `fix/wizard-keyboard-ios` |
| `docs/` | Documentation only |
| `chore/` | Tooling and housekeeping |

### Commits

Use small commits, one per plan step where you can. Write the message in English, in the form `type(scope): summary`:

```
feat(nav): floating pill navigation with five screens
fix(wizard): keep the focused field above the keyboard
docs(trip-photos): mark the task done and update the architecture
```

Types in use: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. Do not skip hooks, and do not commit secrets or `.env.local`.

### Pull requests

Open a pull request against `main`. In it:

- Say what changed and why, and link the issue and the plan.
- List the tests you added and show that the full suite, typecheck and lint pass.
- For UI changes, add screenshots (light and dark if both changed) and say which platform you checked.
- If you changed `src/schemas/` or `supabase/migrations/`, say so, and confirm that the database tests pass.
- Update [`Architecture.md`](Architecture.md) so it matches the code, as it is now and not as planned. If nothing architectural changed, add a one-line changelog entry saying so.

Keep a pull request to one feature or fix. A review may ask you to split a big one.

## Working with AI coding agents

The repo is set up for Claude Code. [`CLAUDE.md`](CLAUDE.md) holds the project rules and the working process, and `.claude/` holds the agent and skill definitions. If you use an AI agent, it must follow the same rules as everyone else: plan first, tests first, small changes, and no dependencies without asking. You are responsible for every line you submit, whoever or whatever wrote it.

## Reporting a security problem

Do not open a public issue for a security problem, such as a way to read another user's trip or a leaked key. Contact the maintainer privately through the email on their GitHub profile.

## Questions

If something here is unclear or two documents disagree, ask in the issue. Do not guess.
