# Task: Fix the valid CodeRabbit findings of the second review on PR #23
Status: done (2026-10-22)

Source: CodeRabbit review 5612779518 on https://github.com/KacperBartlomiejczak/Travelo/pull/23 (2026-10-22 10:29, after
"@coderabbitai full review", commit 6da09e5): 5 inline comments. The first review is done in
`prompts/coderabbit-pr23-fixes/plan.md`.

## Understanding & assumptions
Every finding was checked on 2026-10-22 against `feature/profile-screen` at 5ea04eb (= `origin`, clean tree).
"Done" = every step `[x]`, full suite + typecheck + lint green, verifier PASS, `Architecture.md` changelog line, and (each
after Kacper's go-ahead) commit, push and a reply on PR #23.

### Verification of each finding

| # | Finding | Verdict | Action |
|---|---|---|---|
| G1 | `src/components/SkeletonBlock.tsx:32` — pulse even with reduce motion on (reads app-loading-skeleton D3 that way) | **False.** "still" in D3 means motionless: the same plan's manual test says "with reduce motion on: the skeleton is still"; design-context §10.18: "only if reduced motion is off; otherwise static" | skip, reply |
| G2 | `src/features/home/HomeSkeleton.tsx:19` — make the skeleton a `ScrollView` with pill clearance | **True but not a bug.** On a short phone the lower cards overflow, exactly like the real screen at scroll 0 (cards under the pill / below the fold). A loading placeholder needs no scrolling | skip, reply |
| G3 | `src/schemas/__tests__/code-email-template.test.ts:61-62` — `toContain` also passes on a commented-out `# subject = …` | **True** | fix (step 1) |
| G4 | `supabase/templates/magic_link.html:31` — the code in the preheader shows on the lock screen | **True, accepted earlier** (`prompts/auth-onboarding/plan.md:116`: "also on the lock screen; accepted"); Kacper keeps it (2026-10-22) | skip, reply |
| G5 | `supabase/templates/magic_link.html:62` — "Without the code, no one can sign in to your account" | **True.** Google and Discord sign-in (`src/features/auth/SignInSheet.tsx`) work without the code | fix (step 1) |

### Assumptions
- No schema, migration, app code or Supabase config change. Only the e-mail template and its test.
- Work happens in the main checkout on `feature/profile-screen` (clean, equal to `origin`).
- The hosted project's templates are set in the dashboard by hand (auth-onboarding step 0/11), so after the merge Kacper
  pastes the new body into **Confirm signup** and **Magic Link** again.

## Approach
- **G3:** match whole, uncommented lines: `toMatch(/^subject = "Your Travelo code"$/m)` and
  `toMatch(/^content_path = "\.\/supabase\/templates\/magic_link\.html"$/m)`. `config.toml` lines have no leading spaces in
  these sections, so `^` at column 0 is right.
- **G5:** delete the sentence "Without the code, no one can sign in to your account." from line 62; the line keeps "Never
  share this code with anyone. Did not request it? Ignore this email."
Rejected: a separate test file for the copy — the existing template test is the place.

## Data structures (Zod)
None — no data shape changes.

## Tests
All in `src/schemas/__tests__/code-email-template.test.ts`, written first:
- **G5 (red → green):** new `it('makes no promise that only the code can sign in')` →
  `expect(template).not.toContain('no one can sign in')`. Red against the current template, green after the sentence is gone.
- **G3 (stricter assertion, red shown by mutation):** the two assertions are tightened. They pass on the real config (it is
  correct), so the red is shown by a mutation check: temporarily prefix `subject` in `[auth.email.template.magic_link]` with
  `# ` → the new test fails (the old one passed) → revert `config.toml`. Recorded in the progress log; `config.toml` ends
  unchanged.

## Files
- `src/schemas/__tests__/code-email-template.test.ts`
- `supabase/templates/magic_link.html`
- `Architecture.md` (line 2 + changelog), this plan.

## Skills
- `test-driven-development` — step 1 — red → green for G5, mutation check for G3 (backend agent).
- `git-workflow-and-versioning` — step 2 — commit after Kacper's go-ahead.

## Steps
- [x] 1. [backend] G3 + G5: tighten the two config assertions, add the "no promise" test, remove the sentence — skill:
  test-driven-development — tests first: see Tests — verify: red → green (G5), mutation check (G3), `config.toml` unchanged,
  full suite + typecheck + lint; verifier
- [x] 2. [orchestrator] `Architecture.md` line 2 + changelog ("coderabbit-pr23-fixes-2 — e-mail copy + config test only, no
  architecture change"); after Kacper's go-ahead: commit, push; after his go-ahead on the text: post the PR reply below

## Draft PR reply (posted only after Kacper approves it)
> @coderabbitai Thanks. Checked each one:
> - **`code-email-template.test.ts:61` — fixed.** Assertions now match whole uncommented lines.
> - **`magic_link.html:62` — fixed.** The sentence is gone; Google/Discord sign-in does not need the code.
> - **`magic_link.html:31` (code in the preheader) — kept on purpose.** Showing the code in the notification is an accepted
>   trade-off (auth-onboarding plan, D25 preview text). Note: removing it alone would not hide the code, the preview would
>   fall through to the body, where the code is about 70 characters in.
> - **`SkeletonBlock.tsx:32` — not changed.** "still with reduce motion on" in D3 means motionless; the same plan's manual
>   test and design-context §10.18 ("only if reduced motion is off; otherwise static") say so. Pulsing there would break
>   reduced motion.
> - **`HomeSkeleton.tsx:19` — not changed.** The skeleton mirrors the home screen at scroll 0, where the lower cards are
>   also below the fold or under the pill. A loading placeholder does not need to scroll.

## Progress log
- Decisions (Kacper, 2026-10-22): fix G3 and G5; the preheader (G4) stays. Plan approved (2026-10-22).
- Step 1 (backend agent): new test `makes no promise that only the code can sign in` red ✓ (1 failed, 7 passed) → sentence
  removed from `magic_link.html:62` → green ✓ (8/8). G3: the two config assertions are `toMatch(/^…$/m)`, green ✓; mutation
  check (`# subject = …` under `[auth.email.template.magic_link]`) → the magic_link case fails (the old `toContain` passed),
  `config.toml` reverted (`git diff --exit-code` clean). `config.toml` has no CR characters, so `$` works as written (git
  reports `w/crlf`, but `grep -c $'\r'` = 0). typecheck ✓, lint ✓, `pnpm test` 132 suites / 2900 tests ✓ (one "worker failed
  to exit gracefully" warning, not from this change) · verifier PASS (re-ran both mutations) · skill used:
  test-driven-development · no deviations.
- Step 2: `Architecture.md` line 2 + changelog entry done. After Kacper's go-ahead (2026-10-22): commits bc9986c (fix) and
  a611d78 (docs) pushed to `feature/profile-screen` (5ea04eb..a611d78); reply posted on PR #23
  (https://github.com/KacperBartlomiejczak/Travelo/pull/23#issuecomment-6339390509). Still manual: paste the new template
  into the hosted dashboard (Confirm signup + Magic Link).

## Risks & open questions
- After the merge the hosted e-mail still has the old sentence until Kacper pastes the template in the dashboard
  (Confirm signup + Magic Link).
