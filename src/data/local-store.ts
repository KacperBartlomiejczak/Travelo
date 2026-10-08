import {
  LocalTripBudgetChangeSchema,
  SelectedTripSchema,
  TripListSchema,
  TripOverviewSchema,
  type LocalTripBudgetChange,
  type SyncStatus,
  type TripBudgetChange,
  type TripList,
  type TripOverview,
} from '@/schemas';

import type { LocalDb } from './local-db';

type BudgetChangeRow = {
  trip_id: string;
  amount_minor: number;
  currency: string;
  updated_at: string;
  sync_status: string;
  sync_error: string | null;
  attempts: number;
  last_attempt_at: string | null;
};

function budgetChangeFromRow(row: BudgetChangeRow): LocalTripBudgetChange {
  return LocalTripBudgetChangeSchema.parse({
    tripId: row.trip_id,
    budgetPerPerson: { amountMinor: row.amount_minor, currency: row.currency },
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    ...(row.sync_error !== null ? { syncError: row.sync_error } : {}),
    attempts: row.attempts,
    ...(row.last_attempt_at !== null ? { lastAttemptAt: row.last_attempt_at } : {}),
  });
}

export type BudgetAttempt = { syncStatus: Exclude<SyncStatus, 'synced'>; error?: string; at: string };

/** What the device keeps in SQLite: the last nearest trip read from Supabase and budget changes not yet synced. */
export function createLocalStore(db: LocalDb) {
  /** The copy, or null when there is none or it cannot be read any more. */
  async function cachedNearest(): Promise<TripOverview | null> {
    const row = await db.getFirstAsync<{ overview_json: string }>('select overview_json from trip_overview_cache limit 1', []);
    if (!row) return null;
    try {
      return TripOverviewSchema.parse(JSON.parse(row.overview_json));
    } catch {
      return null;
    }
  }

  /** The copy of one trip, or null when it was never opened here or cannot be read any more. */
  async function cachedOverview(tripId: string): Promise<TripOverview | null> {
    const row = await db.getFirstAsync<{ overview_json: string }>('select overview_json from trip_overview_cache where trip_id = ?', [tripId]);
    if (!row) return null;
    try {
      return TripOverviewSchema.parse(JSON.parse(row.overview_json));
    } catch {
      return null;
    }
  }

  return {
    /** Replaces the copy with the trip the server just returned as nearest (null: the server has none). */
    async cacheNearest(overview: TripOverview | null, cachedAt: string): Promise<void> {
      await db.runAsync('delete from trip_overview_cache', []);
      if (overview) {
        await db.runAsync('insert into trip_overview_cache (trip_id, overview_json, cached_at) values (?, ?, ?)', [
          overview.trip.id,
          JSON.stringify(overview),
          cachedAt,
        ]);
      }
    },

    cachedNearest,

    /**
     * Replaces the list copy with the list the server just returned (trips-drawer D3), and deletes the copies
     * of trips that are no longer on it (A5). Budget changes stay: one waiting for a gone trip must stay visible.
     */
    async cacheList(list: TripList, cachedAt: string): Promise<void> {
      const json = JSON.stringify(TripListSchema.parse(list));
      await db.runAsync(
        `insert into trip_list_cache (id, list_json, cached_at) values (1, ?, ?)
         on conflict (id) do update set list_json = excluded.list_json, cached_at = excluded.cached_at`,
        [json, cachedAt],
      );
      await db.runAsync("delete from trip_overview_cache where trip_id not in (select json_extract(value, '$.id') from json_each(?))", [json]);
    },

    /** The list copy, or null when there is none or it cannot be read any more. */
    async cachedList(): Promise<TripList | null> {
      const row = await db.getFirstAsync<{ list_json: string }>('select list_json from trip_list_cache where id = 1', []);
      if (!row) return null;
      try {
        return TripListSchema.parse(JSON.parse(row.list_json));
      } catch {
        return null;
      }
    },

    /** Keeps (or replaces) the copy of one trip; copies of other trips stay (trips-drawer A5). */
    async cacheOverview(overview: TripOverview, cachedAt: string): Promise<void> {
      await db.runAsync(
        `insert into trip_overview_cache (trip_id, overview_json, cached_at) values (?, ?, ?)
         on conflict (trip_id) do update set overview_json = excluded.overview_json, cached_at = excluded.cached_at`,
        [overview.trip.id, JSON.stringify(TripOverviewSchema.parse(overview)), cachedAt],
      );
    },

    cachedOverview,

    /** Remembers the trip the organizer chose (trips-drawer D2); a newer choice replaces the older one. */
    async selectTrip(tripId: string): Promise<void> {
      const selected = SelectedTripSchema.parse({ tripId });
      await db.runAsync(
        'insert into selected_trip (id, trip_id) values (1, ?) on conflict (id) do update set trip_id = excluded.trip_id',
        [selected.tripId],
      );
    },

    /** The chosen trip's id, or null when there is no (readable) choice. */
    async selectedTripId(): Promise<string | null> {
      const row = await db.getFirstAsync<{ trip_id: string }>('select trip_id from selected_trip where id = 1', []);
      const parsed = SelectedTripSchema.safeParse({ tripId: row?.trip_id });
      return parsed.success ? parsed.data.tripId : null;
    },

    async clearSelectedTrip(): Promise<void> {
      await db.runAsync('delete from selected_trip', []);
    },

    /** Saves the change as pending; a newer change for the same trip replaces the older one (A7). */
    async saveBudgetChange(change: TripBudgetChange): Promise<void> {
      await db.runAsync(
        `insert into trip_budget_changes (trip_id, amount_minor, currency, updated_at, sync_status, sync_error, attempts, last_attempt_at)
         values (?, ?, ?, ?, 'pending', null, 0, null)
         on conflict (trip_id) do update set
           amount_minor = excluded.amount_minor, currency = excluded.currency, updated_at = excluded.updated_at,
           sync_status = 'pending', sync_error = null, attempts = 0, last_attempt_at = null`,
        [change.tripId, change.budgetPerPerson.amountMinor, change.budgetPerPerson.currency, change.updatedAt],
      );
    },

    async budgetChange(tripId: string): Promise<LocalTripBudgetChange | null> {
      const row = await db.getFirstAsync<BudgetChangeRow>('select * from trip_budget_changes where trip_id = ?', [tripId]);
      return row ? budgetChangeFromRow(row) : null;
    },

    async unsyncedBudgetChanges(): Promise<LocalTripBudgetChange[]> {
      const rows = await db.getAllAsync<BudgetChangeRow>('select * from trip_budget_changes order by updated_at', []);
      return rows.map(budgetChangeFromRow);
    },

    /**
     * The change reached the server: the device copy of the trip gets it (so offline it is not the old amount),
     * then the change is forgotten. A newer change saved meanwhile stays.
     */
    async markBudgetSynced(change: TripBudgetChange): Promise<void> {
      const cached = await cachedOverview(change.tripId);
      if (cached && Date.parse(cached.trip.budgetUpdatedAt) < Date.parse(change.updatedAt)) {
        const trip = { ...cached.trip, budgetPerPerson: change.budgetPerPerson, budgetUpdatedAt: change.updatedAt };
        await db.runAsync('update trip_overview_cache set overview_json = ? where trip_id = ?', [
          JSON.stringify(TripOverviewSchema.parse({ ...cached, trip })),
          change.tripId,
        ]);
      }
      await db.runAsync('delete from trip_budget_changes where trip_id = ? and updated_at = ?', [change.tripId, change.updatedAt]);
    },

    /** A send that did not succeed: 'pending' when the server could not be reached, 'failed' when it refused. */
    async recordBudgetAttempt(change: TripBudgetChange, attempt: BudgetAttempt): Promise<void> {
      await db.runAsync(
        `update trip_budget_changes
         set sync_status = ?, sync_error = ?, attempts = attempts + 1, last_attempt_at = ?
         where trip_id = ? and updated_at = ?`,
        [attempt.syncStatus, attempt.error ?? null, attempt.at, change.tripId, change.updatedAt],
      );
    },
  };
}

export type LocalStore = ReturnType<typeof createLocalStore>;
