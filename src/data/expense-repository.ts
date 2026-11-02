import { randomUUID } from 'expo-crypto';

import { ExpenseSchema, LocalExpenseSchema, type Expense, type LocalExpense } from '@/schemas';

import type { LocalDb } from './local-db';
import { currentUserEpoch, type LocalStore } from './local-store';

export class CurrencyMismatchError extends Error {}
export class NotYourExpenseError extends Error {}
export class ExpenseNotFoundError extends Error {}
/** The write was refused because the user changed (sign-out) while it was waiting; nothing was written. */
export class ExpenseWriteDroppedError extends Error {}

/** Who is writing: the owner writes anything; a linked friend only expenses with their own member id (expenses D15). */
export type ExpenseWriter = { isOwner: boolean; ownMemberId: string | null };
/** The trip an expense belongs to, plus who writes (D5: amounts are in `baseCurrency`). */
export type ExpenseScope = { tripId: string; baseCurrency: string; writer: ExpenseWriter };
/** What the form gives the repository: the fields the user chooses. */
export type ExpenseInput = Pick<Expense, 'name' | 'amount' | 'category' | 'memberId' | 'spentOn'>;

type Row = {
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

function fromRow(row: Row): LocalExpense {
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

type Deps = {
  db: LocalDb;
  /** Writes go through its queue and user epoch, so a write in flight when the user signs out leaves no row. */
  store: LocalStore;
  now?: () => Date;
  newId?: () => string;
  /** A stored row that no longer parses is left out of the list and reported here. */
  onCorruptRow?: (id: string, error: unknown) => void;
};

/** Expenses on the device (expenses D5, D15): every write is one statement, pending, with no network involved. */
export function createExpenseRepository({ db, store, now = () => new Date(), newId = randomUUID, onCorruptRow = () => {} }: Deps) {
  const mayWrite = ({ writer }: ExpenseScope, memberId: string | null) => writer.isOwner || (memberId !== null && memberId === writer.ownMemberId);

  /** Checks the input and who may write it; returns the validated expense fields. */
  function checked(scope: ExpenseScope, id: string, createdAt: string, updatedAt: string, input: ExpenseInput): Expense {
    const expense = ExpenseSchema.parse({ ...input, id, tripId: scope.tripId, createdAt, updatedAt, deletedAt: null });
    if (expense.amount.currency !== scope.baseCurrency) throw new CurrencyMismatchError(expense.amount.currency);
    if (!mayWrite(scope, expense.memberId)) throw new NotYourExpenseError(id);
    return expense;
  }

  async function existing(db: LocalDb, scope: ExpenseScope, id: string): Promise<LocalExpense> {
    const row = await db.getFirstAsync<Row>('select * from expenses where id = ? and trip_id = ? and deleted_at is null', [id, scope.tripId]);
    if (!row) throw new ExpenseNotFoundError(id);
    const expense = fromRow(row);
    if (!mayWrite(scope, expense.memberId)) throw new NotYourExpenseError(id);
    return expense;
  }

  return {
    async add(scope: ExpenseScope, input: ExpenseInput): Promise<LocalExpense> {
      const at = now().toISOString();
      const e = checked(scope, newId(), at, at, input);
      // The task returns true so that undefined from writeGuarded can only mean "dropped".
      const written = await store.writeGuarded(currentUserEpoch(), async (tx) => {
        await tx.runAsync(
        `insert into expenses (id, trip_id, member_id, name, amount_minor, currency, category, spent_on, created_at, updated_at, deleted_at, sync_status, attempts)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 'pending', 0)`,
        [e.id, e.tripId, e.memberId, e.name, e.amount.amountMinor, e.amount.currency, e.category, e.spentOn, e.createdAt, e.updatedAt],
        );
        return true;
      });
      if (!written) throw new ExpenseWriteDroppedError(e.id);
      return { ...e, syncStatus: 'pending', attempts: 0 };
    },

    /** Edit: bumps `updatedAt`, keeps `createdAt`, goes back to pending with a clean sync state. */
    async update(scope: ExpenseScope, id: string, input: ExpenseInput): Promise<LocalExpense> {
      const at = now().toISOString();
      const saved = await store.writeGuarded(currentUserEpoch(), async (tx) => {
        const before = await existing(tx, scope, id);
        const e = checked(scope, id, before.createdAt, at, input);
        await tx.runAsync(
          `update expenses set member_id = ?, name = ?, amount_minor = ?, currency = ?, category = ?, spent_on = ?, updated_at = ?,
             sync_status = 'pending', sync_error = null, attempts = 0, last_attempt_at = null
           where id = ?`,
          [e.memberId, e.name, e.amount.amountMinor, e.amount.currency, e.category, e.spentOn, e.updatedAt, id],
        );
        return { ...e, syncStatus: 'pending', attempts: 0 } as const;
      });
      if (!saved) throw new ExpenseWriteDroppedError(id);
      return saved;
    },

    /** Soft delete (so it can sync): sets `deletedAt` and `updatedAt`, pending again. */
    async remove(scope: ExpenseScope, id: string): Promise<void> {
      const at = now().toISOString();
      const removed = await store.writeGuarded(currentUserEpoch(), async (tx) => {
        await existing(tx, scope, id);
        await tx.runAsync(
          `update expenses set deleted_at = ?, updated_at = ?, sync_status = 'pending', sync_error = null, attempts = 0, last_attempt_at = null where id = ?`,
          [at, at, id],
        );
        return true;
      });
      if (!removed) throw new ExpenseWriteDroppedError(id);
    },

    /** The trip's live (not deleted) expenses, newest spending day first, then newest created. */
    async list(tripId: string): Promise<LocalExpense[]> {
      const rows = await db.getAllAsync<Row>('select * from expenses where trip_id = ? and deleted_at is null order by spent_on desc, created_at desc', [tripId]);
      const list: LocalExpense[] = [];
      for (const row of rows) {
        try {
          list.push(fromRow(row));
        } catch (error) {
          onCorruptRow(row.id, error);
        }
      }
      return list;
    },
  };
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
