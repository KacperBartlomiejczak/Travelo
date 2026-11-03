import { ExpenseRowSchema, LocalExpenseSchema, type Expense, type ExpenseRow, type LocalExpense } from '@/schemas';

/** A row of the SQLite `expenses` table. */
export type LocalRow = {
  id: string;
  trip_id: string;
  member_id: string | null;
  name: string;
  amount_minor: number;
  currency: string;
  category: string;
  spent_on: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  sync_error: string | null;
  attempts: number;
  last_attempt_at: string | null;
};

export function fromLocalRow(row: LocalRow): LocalExpense {
  return LocalExpenseSchema.parse({
    id: row.id,
    tripId: row.trip_id,
    memberId: row.member_id,
    name: row.name,
    amount: { amountMinor: row.amount_minor, currency: row.currency },
    category: row.category,
    spentOn: row.spent_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    ...(row.sync_error !== null ? { syncError: row.sync_error } : {}),
    attempts: row.attempts,
    ...(row.last_attempt_at !== null ? { lastAttemptAt: row.last_attempt_at } : {}),
  });
}

/** What `upsert_expense` receives: the snake_case server row of an expense. */
export function toServerRow(expense: Expense): ExpenseRow {
  return ExpenseRowSchema.parse({
    id: expense.id,
    trip_id: expense.tripId,
    member_id: expense.memberId,
    name: expense.name,
    amount_minor: expense.amount.amountMinor,
    currency: expense.amount.currency,
    category: expense.category,
    spent_on: expense.spentOn,
    created_at: expense.createdAt,
    updated_at: expense.updatedAt,
    deleted_at: expense.deletedAt,
  });
}

const utc = (at: string) => new Date(at).toISOString();

/**
 * A row as the server returned it, checked. Timestamps come back as `…+00:00` with microseconds; they are rewritten as
 * `….sssZ` so they compare as text with the ones the device writes (last write wins by `updated_at`).
 */
export function fromServerRow(raw: unknown): ExpenseRow {
  const row = ExpenseRowSchema.parse(raw);
  return {
    ...row,
    created_at: utc(row.created_at),
    updated_at: utc(row.updated_at),
    deleted_at: row.deleted_at === null ? null : utc(row.deleted_at),
  };
}
