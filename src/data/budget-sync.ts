import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import type { LocalTripBudgetChange } from '@/schemas';

import { ensureSession } from './auth';
import type { Database } from './database.types';
import type { BudgetAttempt, LocalStore } from './local-store';

export const RETRY_BASE_MS = 1000;
export const RETRY_MAX_MS = 5 * 60 * 1000;

/** Wait before the next try after `attempts` failed ones: 1 s, 2 s, 4 s … up to 5 min. */
export function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
}

export type SyncResult = { nextAttemptAt: Date | null };

type Deps = { supabase: SupabaseClient<Database>; local: LocalStore; now: () => Date };

/** postgrest-js answers with status 0 when the request never reached the server. */
const UNREACHABLE = 0;

async function send({ supabase }: Deps, change: LocalTripBudgetChange): Promise<Omit<BudgetAttempt, 'at'> | 'synced'> {
  try {
    await ensureSession(supabase.auth);
  } catch (error) {
    if (isAuthRetryableFetchError(error)) return { syncStatus: 'pending' };
    return { syncStatus: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  // Last write wins: the row changes only if the server's budget is older than this change.
  const updated = await supabase
    .from('trips')
    .update({ budget_per_person_minor: change.budgetPerPerson.amountMinor, budget_updated_at: change.updatedAt })
    .eq('id', change.tripId)
    .lt('budget_updated_at', change.updatedAt)
    .select('id');
  if (updated.error) {
    return updated.status === UNREACHABLE ? { syncStatus: 'pending' } : { syncStatus: 'failed', error: updated.error.message };
  }
  if (updated.data.length > 0) return 'synced';

  // Nothing updated: the server already has this change or a newer one — or cannot see the trip at all.
  const current = await supabase.from('trips').select('budget_updated_at').eq('id', change.tripId).maybeSingle();
  if (current.error) {
    return current.status === UNREACHABLE ? { syncStatus: 'pending' } : { syncStatus: 'failed', error: current.error.message };
  }
  if (current.data && Date.parse(current.data.budget_updated_at) >= Date.parse(change.updatedAt)) return 'synced';
  return { syncStatus: 'failed', error: 'trip-not-found' };
}

/**
 * Sends every budget change still on the device. A change that does not get through stays: 'pending' when
 * the server could not be reached, 'failed' when it refused. Returns when the earliest retry is due.
 */
export async function syncBudgetChanges(deps: Deps): Promise<SyncResult> {
  const { local, now } = deps;
  for (const change of await local.unsyncedBudgetChanges()) {
    const outcome = await send(deps, change);
    if (outcome === 'synced') await local.markBudgetSynced(change);
    else await local.recordBudgetAttempt(change, { ...outcome, at: now().toISOString() });
  }
  const retries = (await local.unsyncedBudgetChanges())
    .filter((change) => change.lastAttemptAt !== undefined)
    .map((change) => Date.parse(change.lastAttemptAt as string) + retryDelayMs(change.attempts));
  return { nextAttemptAt: retries.length > 0 ? new Date(Math.min(...retries)) : null };
}
