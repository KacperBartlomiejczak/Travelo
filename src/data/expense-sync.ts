import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import type { ExpenseRow, LocalExpense } from '@/schemas';

import { ensureSession, NotSignedInError } from './auth';
import { retryDelayMs, type SyncResult } from './budget-sync';
import type { Database } from './database.types';
import { fromLocalRow, fromServerRow, toServerRow, type LocalRow } from './expense-rows';
import type { LocalDb } from './local-db';
import { currentUserEpoch, isEpochCurrent, type LocalStore } from './local-store';

type Deps = {
  supabase: SupabaseClient<Database>;
  db: LocalDb;
  /** Writes go through its queue and user epoch, so nothing lands after a sign-out. */
  store: LocalStore;
  now?: () => Date;
  /** A row (local or from the server) that does not parse is skipped and reported here. */
  onCorruptRow?: (id: string, error: unknown) => void;
};

/** postgrest-js answers with status 0 when the request never reached the server. */
const UNREACHABLE = 0;

/**
 * Sends the expenses waiting on the device and brings the server's expenses of every trip in the list copy
 * (expenses D16). One run at a time: a trigger that arrives meanwhile waits and then finds nothing left to send.
 */
export function createExpenseSync({ supabase, db, store, now = () => new Date(), onCorruptRow = () => {} }: Deps) {
  /** Marks the row synced only if it was not edited meanwhile (same `updated_at`); a newer edit stays pending. */
  const markSynced = (epoch: number, e: LocalExpense) =>
    store.writeGuarded(epoch, (tx) =>
      tx.runAsync(
        "update expenses set sync_status = 'synced', sync_error = null, attempts = 0, last_attempt_at = null where id = ? and updated_at = ?",
        [e.id, e.updatedAt],
      ),
    );

  const recordAttempt = (epoch: number, e: LocalExpense, syncStatus: 'pending' | 'failed', error: string | null) =>
    store.writeGuarded(epoch, (tx) =>
      tx.runAsync(
        'update expenses set sync_status = ?, sync_error = ?, attempts = attempts + 1, last_attempt_at = ? where id = ? and updated_at = ?',
        [syncStatus, error, now().toISOString(), e.id, e.updatedAt],
      ),
    );

  async function push(epoch: number): Promise<void> {
    const rows = await db.getAllAsync<LocalRow>("select * from expenses where sync_status != 'synced' order by updated_at", []);
    for (const row of rows) {
      let expense: LocalExpense;
      try {
        expense = fromLocalRow(row);
      } catch (error) {
        onCorruptRow(row.id, error);
        continue;
      }
      // A failed row waits for its backoff; a pending one (never sent, or the server was unreachable) goes at once.
      if (expense.syncStatus === 'failed' && expense.lastAttemptAt && Date.parse(expense.lastAttemptAt) + retryDelayMs(expense.attempts) > now().getTime()) continue;
      if (!isEpochCurrent(epoch)) return;
      const sent = await supabase.rpc('upsert_expense', { expense: toServerRow(expense) });
      // A stale or repeated row is a silent no-op on the server and counts as sent.
      if (!sent.error) await markSynced(epoch, expense);
      else await recordAttempt(epoch, expense, sent.status === UNREACHABLE ? 'pending' : 'failed', sent.error.message);
    }
  }

  async function pull(epoch: number): Promise<void> {
    for (const trip of (await store.cachedList()) ?? []) {
      const read = await supabase.from('expenses').select('*').eq('trip_id', trip.id);
      if (read.error) continue;
      const rows: ExpenseRow[] = [];
      for (const raw of read.data ?? []) {
        try {
          rows.push(fromServerRow(raw));
        } catch (error) {
          onCorruptRow(typeof raw.id === 'string' ? raw.id : 'unknown', error);
        }
      }
      // A local row that is not synced is never overwritten (R2); a synced one only by a newer server row.
      await store.writeGuarded(epoch, async (tx) => {
        for (const r of rows) {
          await tx.runAsync(
            `insert into expenses (id, trip_id, member_id, name, amount_minor, currency, category, spent_on, created_at, updated_at, deleted_at, sync_status, attempts)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)
             on conflict (id) do update set
               member_id = excluded.member_id, name = excluded.name, amount_minor = excluded.amount_minor, currency = excluded.currency,
               category = excluded.category, spent_on = excluded.spent_on, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
               sync_error = null, attempts = 0, last_attempt_at = null
             where expenses.sync_status = 'synced' and expenses.updated_at < excluded.updated_at`,
            [r.id, r.trip_id, r.member_id, r.name, r.amount_minor, r.currency, r.category, r.spent_on, r.created_at, r.updated_at, r.deleted_at],
          );
        }
        return true;
      });
    }
  }

  async function run(): Promise<SyncResult> {
    const epoch = currentUserEpoch();
    try {
      await ensureSession(supabase.auth);
      await push(epoch);
      await pull(epoch);
    } catch (error) {
      // Nobody signed in, or no connection to check the session: nothing is sent, nothing is counted.
      if (!(error instanceof NotSignedInError) && !isAuthRetryableFetchError(error)) throw error;
      // No attempt was recorded, so a due date from older attempts may be in the past and would spin; a trigger restarts sync.
      return { nextAttemptAt: null };
    }
    const rows = await db.getAllAsync<LocalRow>("select * from expenses where sync_status != 'synced' and last_attempt_at is not null", []);
    const due = rows.map((row) => Date.parse(row.last_attempt_at as string) + retryDelayMs(row.attempts));
    return { nextAttemptAt: due.length > 0 ? new Date(Math.min(...due)) : null };
  }

  let running: Promise<SyncResult> = Promise.resolve({ nextAttemptAt: null });
  return {
    sync(): Promise<SyncResult> {
      running = running.catch(() => undefined).then(run);
      return running;
    },
  };
}

export type ExpenseSync = ReturnType<typeof createExpenseSync>;
