# Offline flow

## Rules for offline expenses (planned, not implemented)
- **Local first.** Adding, editing or deleting an expense writes to SQLite immediately and the UI updates from SQLite. Saving never waits for the network.
- **Client-generated IDs.** Every expense gets a UUID on the device, so the same row can be retried safely.
- **Outbox.** Every local change is also written to an outbox table in the same SQLite transaction. A sync worker sends the outbox to Supabase when online (on reconnect, on app foreground, after each save).
- **Idempotent sync.** The server upserts by `id`, so a retried request never creates duplicates. Deletes are soft (`deletedAt`) so they can sync too.
- **Conflicts:** last write wins by `updatedAt`. Only the owner can write expenses, so conflicts are rare. Any other conflict strategy is Kacper's decision.
- **Sync status is visible:** each expense is `synced | pending | failed` (see `context/design-context.md` for how it looks). A failed item retries with backoff and never disappears silently.
- **Zod still rules.** SQLite tables mirror the Zod schemas. Every row read from SQLite and every server response is parsed with Zod. Local migrations are versioned and never edited after release.
- **Money in SQLite** is stored as INTEGER minor units + currency code, same as the server.

## What is implemented
- Offline budget: `setBudget(trip, amountMinor)` validates with `TripBudgetFormSchema` in the trip's base currency and upserts a `pending` row in `trip_budget_changes` (no network). `syncBudgets()` (serialized: one run at a time) sends each change with `update trips … eq(id) lt(budget_updated_at, updatedAt) select(id)` (last write wins); 0 rows → it reads the server's `budget_updated_at` to tell "already there / newer" (synced) from "trip not visible" (`failed`, `trip-not-found`). Unreachable → stays `pending` with the attempt counted; refused → `failed` with its error. A synced change is written into the SQLite copy of that trip, then removed. It returns `nextAttemptAt` (backoff 1 s × 2ⁿ, max 5 min). `BudgetSyncProvider` runs it on start and whenever the network comes back (`expo-network`), on app foreground, after each save, and at `nextAttemptAt`; afterwards it cancels any in-flight trips read and refetches `['trips']`.
- Offline expenses: not implemented (the budget change is the only offline write so far).
