import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import {
  CreateTripInputSchema,
  NearestTripSchema,
  TripBudgetChangeSchema,
  TripBudgetFormSchema,
  type LocalTripBudgetChange,
  type NearestTrip,
  type TripOverview,
} from '@/schemas';

import { ensureSession } from './auth';
import { syncBudgetChanges, type SyncResult } from './budget-sync';
import type { Database } from './database.types';
import type { LocalStore } from './local-store';
import { buildTrip, type TripRepository } from './trip-repository';
import { overviewFromRows, toCreateTripArgs } from './trip-rows';

/** Supabase could not be reached (no connection); the device copy may be shown instead. */
class ServerUnreachableError extends Error {}

type Deps = {
  supabase: SupabaseClient<Database>;
  /** Opening SQLite is async; the repository waits for it where it needs it. */
  local: Promise<LocalStore>;
  now?: () => Date;
  newId?: () => string;
};

/** Trips in Supabase (trips-supabase D1); budget changes saved on the device first and synced later. */
export function createSupabaseTripRepository({ supabase, local: localStore, now = () => new Date(), newId = randomUUID }: Deps): TripRepository {
  async function signedIn(): Promise<string> {
    try {
      return await ensureSession(supabase.auth);
    } catch (error) {
      if (isAuthRetryableFetchError(error)) throw new ServerUnreachableError(error.message);
      throw error;
    }
  }

  async function fetchNearest(): Promise<TripOverview | null> {
    await signedIn();
    const { data, error, status } = await supabase
      .from('trips')
      .select('*, trip_members(*), flight_segments(*)')
      .order('start_date')
      .order('created_at')
      .limit(1);
    if (error) throw status === 0 ? new ServerUnreachableError(error.message) : new Error(error.message);
    const [row] = data;
    if (!row) return null;
    const { trip_members: members, flight_segments: segments, ...trip } = row;
    return overviewFromRows(trip, members, segments);
  }

  /** A budget change still on the device is shown instead of the server's older amount. */
  function withLocalBudget(overview: TripOverview, change: LocalTripBudgetChange | null, fromCache: boolean): NearestTrip {
    if (!change) return NearestTripSchema.parse({ overview, budgetSyncStatus: 'synced', fromCache });
    const newer = Date.parse(change.updatedAt) > Date.parse(overview.trip.budgetUpdatedAt);
    const trip = newer ? { ...overview.trip, budgetPerPerson: change.budgetPerPerson, budgetUpdatedAt: change.updatedAt } : overview.trip;
    return NearestTripSchema.parse({ overview: { ...overview, trip }, budgetSyncStatus: change.syncStatus, fromCache });
  }

  // One sync at a time: a call made during a sync runs after it, so no change is sent twice in parallel.
  let syncing: Promise<SyncResult> = Promise.resolve({ nextAttemptAt: null });

  return {
    async nearest() {
      const local = await localStore;
      let overview: TripOverview | null;
      let fromCache = false;
      try {
        overview = await fetchNearest();
        await local.cacheNearest(overview, now().toISOString());
      } catch (error) {
        if (!(error instanceof ServerUnreachableError)) throw error;
        overview = await local.cachedNearest();
        if (!overview) throw error;
        fromCache = true;
      }
      if (!overview) return null;
      return withLocalBudget(overview, await local.budgetChange(overview.trip.id), fromCache);
    },

    async create(input) {
      const parsed = CreateTripInputSchema.parse(input);
      const ownerId = await signedIn();
      const created = buildTrip(parsed, { now: now(), newId, ownerId });
      const { error } = await supabase.rpc('create_trip', toCreateTripArgs(created));
      if (error) throw new Error(error.message);
      return created.trip;
    },

    async setBudget(trip, amountMinor) {
      const { budgetPerPerson } = TripBudgetFormSchema.parse({ budgetPerPerson: { amountMinor, currency: trip.baseCurrency } });
      const change = TripBudgetChangeSchema.parse({ tripId: trip.id, budgetPerPerson, updatedAt: now().toISOString() });
      await (await localStore).saveBudgetChange(change);
    },

    syncBudgets() {
      syncing = syncing.catch(() => undefined).then(async () => syncBudgetChanges({ supabase, local: await localStore, now }));
      return syncing;
    },
  };
}
