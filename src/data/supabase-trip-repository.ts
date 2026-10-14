import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { defaultTripId, deviceToday } from '@/lib/trip-sections';
import {
  CreateTripInputSchema,
  CurrentTripSchema,
  TripBudgetChangeSchema,
  TripBudgetFormSchema,
  type CurrentTrip,
  type LocalTripBudgetChange,
  type TripList,
  type TripOverview,
} from '@/schemas';

import { ensureSession } from './auth';
import { syncBudgetChanges, type SyncResult } from './budget-sync';
import type { Database } from './database.types';
import type { LocalStore } from './local-store';
import { buildTrip, type TripRepository } from './trip-repository';
import { listItemFromRow, overviewFromRows, toCreateTripArgs } from './trip-rows';

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

  function failure(error: { message: string }, status: number): Error {
    return status === 0 ? new ServerUnreachableError(error.message) : new Error(error.message);
  }

  /** Every trip, soonest start first; the device keeps the list as its copy (trips-drawer D3). */
  async function fetchList(local: LocalStore): Promise<TripList> {
    await signedIn();
    const { data, error, status } = await supabase
      .from('trips')
      .select('id, name, cover_image_uri, start_date, end_date')
      .order('start_date')
      .order('created_at');
    if (error) throw failure(error, status);
    const list = data.map(listItemFromRow);
    await local.cacheList(list, now().toISOString());
    return list;
  }

  /** One trip with its members and flights, or null when the server has no such trip (deleted or not visible). */
  async function fetchTrip(local: LocalStore, tripId: string): Promise<TripOverview | null> {
    await signedIn();
    const { data, error, status } = await supabase
      .from('trips')
      .select('*, trip_members(*), flight_segments(*)')
      .eq('id', tripId)
      .maybeSingle();
    if (error) throw failure(error, status);
    if (!data) return null;
    const { trip_members: members, flight_segments: segments, ...trip } = data;
    const overview = overviewFromRows(trip, members, segments);
    await local.cacheOverview(overview, now().toISOString());
    return overview;
  }

  /** The chosen trip; when it is gone, the choice is forgotten and the default trip is shown (D2, A1). */
  async function fetchCurrent(local: LocalStore): Promise<TripOverview | null> {
    const chosen = await local.selectedTripId();
    if (chosen) {
      const overview = await fetchTrip(local, chosen);
      if (overview) return overview;
      await local.clearSelectedTrip();
    }
    const tripId = defaultTripId(await fetchList(local), deviceToday(now()));
    return tripId ? fetchTrip(local, tripId) : null;
  }

  /** Offline: the chosen trip's copy, or the default trip from the list copy (A5). Throws when there is no copy. */
  async function cachedCurrent(local: LocalStore, unreachable: ServerUnreachableError): Promise<TripOverview | null> {
    let tripId = await local.selectedTripId();
    if (!tripId) {
      const list = await local.cachedList();
      if (!list) throw unreachable;
      tripId = defaultTripId(list, deviceToday(now()));
      // The copy of the list says there are no trips (D5).
      if (!tripId) return null;
    }
    const copy = await local.cachedOverview(tripId);
    if (!copy) throw unreachable;
    return copy;
  }

  /** A budget change still on the device is shown instead of the server's older amount. */
  function withLocalBudget(overview: TripOverview, change: LocalTripBudgetChange | null, fromCache: boolean): CurrentTrip {
    if (!change) return CurrentTripSchema.parse({ overview, budgetSyncStatus: 'synced', fromCache });
    const newer = Date.parse(change.updatedAt) > Date.parse(overview.trip.budgetUpdatedAt);
    if (!newer) return CurrentTripSchema.parse({ overview, budgetSyncStatus: 'synced', fromCache });
    const trip = { ...overview.trip, budgetPerPerson: change.budgetPerPerson, budgetUpdatedAt: change.updatedAt };
    return CurrentTripSchema.parse({ overview: { ...overview, trip }, budgetSyncStatus: change.syncStatus, fromCache });
  }

  // One sync at a time: a call made during a sync runs after it, so no change is sent twice in parallel.
  let syncing: Promise<SyncResult> = Promise.resolve({ nextAttemptAt: null });

  return {
    async list() {
      const local = await localStore;
      try {
        return await fetchList(local);
      } catch (error) {
        if (!(error instanceof ServerUnreachableError)) throw error;
        const copy = await local.cachedList();
        if (!copy) throw error;
        return copy;
      }
    },

    async current() {
      const local = await localStore;
      let overview: TripOverview | null;
      let fromCache = false;
      try {
        overview = await fetchCurrent(local);
      } catch (error) {
        if (!(error instanceof ServerUnreachableError)) throw error;
        overview = await cachedCurrent(local, error);
        fromCache = true;
      }
      if (!overview) return null;
      return withLocalBudget(overview, await local.budgetChange(overview.trip.id), fromCache);
    },

    async select(tripId) {
      await (await localStore).selectTrip(tripId);
    },

    async create(input) {
      const parsed = CreateTripInputSchema.parse(input);
      const ownerId = await signedIn();
      const created = buildTrip(parsed, { now: now(), newId, ownerId });
      const { error } = await supabase.rpc('create_trip', toCreateTripArgs(created));
      if (error) throw new Error(error.message);
      await (await localStore).selectTrip(created.trip.id);
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
