# Git workflow

## Rules
- One git branch per task (`feature/<name>`), one commit per plan step; do not spread a task across multiple branches.
- Commit messages, branch names and PR text are in English.
- Details for contributors: [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Code rules
- TypeScript strict, no `any`, no `@ts-ignore` without a written reason.
- Small, focused changes. One plan step = one coherent diff.
- Do not add dependencies without asking.
- Never edit a migration that has already been applied — write a new one.
