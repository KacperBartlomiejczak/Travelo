# Offline flow

## Rules for offline expenses
- **Local first.** Adding, editing or deleting an expense writes to SQLite immediately and the UI updates from SQLite. Saving never waits for the network.
- **Client-generated IDs.** Every expense gets a UUID on the device, so the same row can be retried safely.
- **Outbox.** Every local change is also written to the outbox in the same SQLite transaction (for expenses the local row carries its own sync state and is its own outbox entry, like `LocalTripBudgetChange`; `prompts/expenses/plan.md`). A sync worker sends the outbox to Supabase when online (on reconnect, on app foreground, after each save).
- **Idempotent sync.** The server upserts by `id`, so a retried request never creates duplicates. Deletes are soft (`deletedAt`) so they can sync too.
- **Conflicts:** last write wins by `updatedAt`. The owner writes any expense of the trip; a linked member writes only expenses assigned to their own member row (`prompts/expenses/plan.md` D15), so conflicts are rare. Any other conflict strategy is Kacper's decision.
- **Sync status is visible:** each expense is `synced | pending | failed` (see `context/design-context.md` for how it looks). A failed item retries with backoff and never disappears silently.
- **Zod still rules.** SQLite tables mirror the Zod schemas. Every row read from SQLite and every server response is parsed with Zod. Local migrations are versioned and never edited after release.
- **Money in SQLite** is stored as INTEGER minor units + currency code, same as the server.

## What is implemented
The trip budget and expenses work offline; see [trip-budget.md](features/trip-budget.md) and [expenses.md](features/expenses.md).
