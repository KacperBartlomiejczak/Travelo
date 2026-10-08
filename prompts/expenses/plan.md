# Task: Expenses (separate screen + pill nav)
Status: drafting — the full plan is drafted after trip-photos is done (feature 4 of 4, `prompts/trips-drawer/plan.md` D1)

## Understanding & assumptions
What Kacper first called "updating the budget" means **adding expenses during the trip**: how much someone spent on a given day and on what. This is MVP feature 5 in `CLAUDE.md` ("Expenses during the trip").

## Decisions (Kacper, 2026-10-08)
- **D1 — Separate screen** for expenses.
- **D2 — Pill nav** switches between the screens. It has icons **and** text. The active item changes colour, and its icon and text grow, with an animation.
- **D3 — Add-expense form:**
  - name (what it was);
  - amount;
  - which friend paid;
  - optionally a **photo of the receipt**, to make it easier for the user.
- **D4 — Offline-first** as `CLAUDE.md` "Offline expenses" requires:
  - SQLite first, with a client UUID;
  - an outbox in the same transaction;
  - idempotent upsert, soft deletes;
  - last write wins by `updatedAt`;
  - a visible `synced | pending | failed` status.

## Approach
To be drafted.

## Data structures (Zod)
To be drafted (`Expense`, `LocalExpense`, `OutboxEntry` from `CLAUDE.md` "Data structures"; form schema).

## Tests
To be drafted (offline sync tests from the Verification loop item 8).

## Files
To be drafted.

## Skills
To be drafted.

## Steps
To be drafted.

## Progress log

## Risks & open questions
To ask Kacper when this plan is drafted:
- **Pill nav:**
  - which items (Podróż, Wydatki, …?);
  - floating or attached to the bottom edge;
  - colours and sizes. The design context has no pill nav, and glassmorphism is not allowed.
  - Reduced motion: no growing animation?
- **Payer:**
  - The organizer is not a `TripMember` row (trips-supabase A4). How is "Ty" stored as the payer?
  - Is "for whom" (`forMemberIds`) needed now? Settlements are out of scope.
- **Fields:**
  - category chips (`ExpenseCategory`: food, transport, stay, activities, other)?
  - currency choice (last used preselected, design §11.4)?
  - day / time defaults?
- **Receipt photo:**
  - camera or gallery (camera needs a new permission in `app.json`)?
  - where it is stored (Storage, uploaded on sync)?
  - Offline: kept on the phone until synced? This touches the offline scope, which is Kacper's decision. AI parsing of receipts is "Next (after MVP)" and not part of this feature.
- **Expenses screen:**
  - list grouped by day?
  - totals?
  - edit and delete?
  - "120 PLN left today" belongs to MVP feature 6 (plan vs reality). Is it part of this feature or not?
- **Quick-add:** the floating button + bottom sheet from `CLAUDE.md` Design (under 5 seconds), or only the form on the expenses screen?
