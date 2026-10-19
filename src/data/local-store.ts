import {
  LocalTripBudgetChangeSchema,
  ProfileSchema,
  SelectedTripSchema,
  TripListSchema,
  TripOverviewSchema,
  TripPhotoListSchema,
  type LocalTripBudgetChange,
  type Profile,
  type SyncStatus,
  type TripBudgetChange,
  type TripList,
  type TripOverview,
  type TripPhotoList,
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

/**
 * The user epoch: how many times the phone has been told to forget the previous user. An operation that reads from the server
 * and then writes a copy (or a save that first waits for the store) captures the epoch when it STARTS and passes it to the
 * write. A write whose epoch is no longer current belongs to a user who is gone and is dropped, so a slow read of user A can
 * never put A's data on the phone after the clear (auth-onboarding D2, D14).
 *
 * Why this is airtight (auth-onboarding D15): expo-sqlite does NOT order its async calls (its native queue is concurrent on
 * iOS and a thread pool on Android; a statement is three round trips: prepare, execute, finalize), so the store does not rely
 * on it. Every store method is one task on a queue that runs a task to the end before the next one starts, and a guarded write
 * checks the epoch as the first thing its task does. So a write either ran completely before the clear's task (which then
 * deletes it), or its task starts after the epoch moved (and it is refused). Nothing can run between the clear's `begin` and
 * `commit`. The counter is module-wide because the phone has one set of user data, and an operation has to capture it before
 * it can even get hold of the (asynchronously opened) store.
 */
let userEpoch = 0;
/** What an operation that starts while the epoch is closed captures: no write is ever allowed with it. */
const CLOSED = -1;
/** True from the moment the phone starts to forget a user until a clear has finished successfully. */
let closed = false;
/** Clears called and not finished yet; the epoch opens when the last one has succeeded. */
let pendingClears = 0;

/**
 * The epoch an operation captures when it starts. While the phone is forgetting a user (the epoch is closed) this is a value
 * that every guarded write refuses, so an operation of the previous user that starts after the clear was called cannot write
 * either. When the clear has finished, the epoch is open again (a new number): the next user's operations capture it.
 */
export function currentUserEpoch(): number {
  return closed ? CLOSED : userEpoch;
}

/** True when a write that captured `epoch` may still write. */
export function isEpochCurrent(epoch: number): boolean {
  return !closed && epoch === userEpoch;
}

/**
 * Closes the epoch NOW, synchronously: the session calls it the moment it begins to forget the previous user, before it
 * awaits anything (the clear itself only starts once the store is open). From here on, every operation that started earlier
 * or starts now is refused when it comes to write. It stays closed until a `clearUserData` has finished successfully.
 */
export function startNewUserEpoch(): void {
  userEpoch++;
  closed = true;
}

export type BudgetAttempt = { syncStatus: Exclude<SyncStatus, 'synced'>; error?: string; at: string };

/**
 * What the device keeps in SQLite: copies of the trip list and of each trip opened here, the chosen trip
 * (trips-drawer D2, D3), the photo list of each trip (trip-photos D8), the signed-in user's own profile (auth-onboarding D9),
 * and budget changes not yet synced (trips-supabase D1).
 */
export function createLocalStore(db: LocalDb) {
  // The queue: a task starts when the one before it has finished, whether that succeeded or failed.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  }

  /** True while `epoch` (captured by an operation when it started; undefined: the caller is not in a longer operation) is current. */
  const current = (epoch: number | undefined) => (epoch === undefined ? !closed : isEpochCurrent(epoch));

  // The functions below and the methods in `tasks` never call a public method of the store (they would wait for themselves in
  // the queue): they use these plain helpers.

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

  /** The list copy, or null when there is none or it cannot be read any more. */
  async function cachedList(): Promise<TripList | null> {
    const row = await db.getFirstAsync<{ list_json: string }>('select list_json from trip_list_cache where id = 1', []);
    if (!row) return null;
    try {
      return TripListSchema.parse(JSON.parse(row.list_json));
    } catch {
      return null;
    }
  }

  const tasks = {
    /**
     * Replaces the list copy with the list the server just returned (trips-drawer D3). Trips no longer on it are
     * gone: their copies and photo copies are deleted (A5; trip-photos D8) and a choice of one is forgotten (D2).
     * Budget changes stay: one waiting for a gone trip must stay visible.
     */
    async cacheList(list: TripList, cachedAt: string, epoch?: number): Promise<void> {
      const json = JSON.stringify(TripListSchema.parse(list));
      const listedIds = "select json_extract(value, '$.id') from json_each(?)";
      if (!current(epoch)) return;
      await db.runAsync(
        `insert into trip_list_cache (id, list_json, cached_at) values (1, ?, ?)
         on conflict (id) do update set list_json = excluded.list_json, cached_at = excluded.cached_at`,
        [json, cachedAt],
      );
      await db.runAsync(`delete from trip_overview_cache where trip_id not in (${listedIds})`, [json]);
      await db.runAsync(`delete from trip_photos_cache where trip_id not in (${listedIds})`, [json]);
      await db.runAsync(`delete from selected_trip where trip_id not in (${listedIds})`, [json]);
    },

    cachedList,

    /** Keeps (or replaces) the copy of one trip; copies of other trips stay (trips-drawer A5). */
    async cacheOverview(overview: TripOverview, cachedAt: string, epoch?: number): Promise<void> {
      if (!current(epoch)) return;
      await db.runAsync(
        `insert into trip_overview_cache (trip_id, overview_json, cached_at) values (?, ?, ?)
         on conflict (trip_id) do update set overview_json = excluded.overview_json, cached_at = excluded.cached_at`,
        [overview.trip.id, JSON.stringify(TripOverviewSchema.parse(overview)), cachedAt],
      );
    },

    cachedOverview,

    /** Keeps (or replaces) the photo list copy of one trip; copies of other trips stay (trip-photos D8). */
    async cachePhotos(tripId: string, photos: TripPhotoList, cachedAt: string, epoch?: number): Promise<void> {
      if (!current(epoch)) return;
      await db.runAsync(
        `insert into trip_photos_cache (trip_id, photos_json, cached_at) values (?, ?, ?)
         on conflict (trip_id) do update set photos_json = excluded.photos_json, cached_at = excluded.cached_at`,
        [tripId, JSON.stringify(TripPhotoListSchema.parse(photos)), cachedAt],
      );
    },

    /** The photo list copy of one trip, or null when there is none or it cannot be read any more. */
    async cachedPhotos(tripId: string): Promise<TripPhotoList | null> {
      const row = await db.getFirstAsync<{ photos_json: string }>('select photos_json from trip_photos_cache where trip_id = ?', [tripId]);
      if (!row) return null;
      try {
        return TripPhotoListSchema.parse(JSON.parse(row.photos_json));
      } catch {
        return null;
      }
    },

    /** Remembers the trip the organizer chose (trips-drawer D2); a newer choice replaces the older one. */
    async selectTrip(tripId: string, epoch?: number): Promise<void> {
      const selected = SelectedTripSchema.parse({ tripId });
      if (!current(epoch)) return;
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

    /**
     * The trip is gone from the server: forgets everything kept for it, in one transaction (trip-edit-menu A5) —
     * its copy, its photo list copy (trip-photos D8), the choice of it, its entry in the list copy and a budget change
     * still waiting (dropped on purpose: syncing it would only fail). Other trips are untouched; an unknown id changes nothing.
     */
    async forgetTrip(tripId: string): Promise<void> {
      await db.runAsync('begin', []);
      try {
        await db.runAsync('delete from trip_overview_cache where trip_id = ?', [tripId]);
        await db.runAsync('delete from trip_photos_cache where trip_id = ?', [tripId]);
        await db.runAsync('delete from selected_trip where trip_id = ?', [tripId]);
        await db.runAsync('delete from trip_budget_changes where trip_id = ?', [tripId]);
        const list = await cachedList();
        if (list) {
          const rest = list.filter((item) => item.id !== tripId);
          await db.runAsync('update trip_list_cache set list_json = ? where id = 1', [JSON.stringify(TripListSchema.parse(rest))]);
        }
        await db.runAsync('commit', []);
      } catch (error) {
        await db.runAsync('rollback', []).catch(() => {});
        throw error;
      }
    },

    /**
     * Keeps the signed-in user's own profile as the offline copy (auth-onboarding D9). Parsed with `ProfileSchema` first, so an
     * invalid profile is never written and a signed `avatarUrl` (it expires) is left out.
     */
    async cacheProfile(profile: Profile, cachedAt: string, epoch?: number): Promise<void> {
      if (!current(epoch)) return;
      await db.runAsync(
        `insert into my_profile_cache (id, profile_json, cached_at) values (1, ?, ?)
         on conflict (id) do update set profile_json = excluded.profile_json, cached_at = excluded.cached_at`,
        [JSON.stringify(ProfileSchema.parse(profile)), cachedAt],
      );
    },

    /** The own profile copy, or null when there is none or it cannot be read any more. */
    async cachedProfile(): Promise<Profile | null> {
      const row = await db.getFirstAsync<{ profile_json: string }>('select profile_json from my_profile_cache where id = 1', []);
      if (!row) return null;
      try {
        return ProfileSchema.parse(JSON.parse(row.profile_json));
      } catch {
        return null;
      }
    },

    async clearProfile(): Promise<void> {
      await db.runAsync('delete from my_profile_cache', []);
    },

    /**
     * The phone forgets everything it kept for the previous user, in one transaction (auth-onboarding D2): trip copies, the list
     * copy, the chosen trip, budget changes waiting to sync, photo list copies and the own profile copy.
     */
    async clearUserData(): Promise<void> {
      try {
        await db.runAsync('begin', []);
        await db.runAsync('delete from trip_overview_cache', []);
        await db.runAsync('delete from trip_list_cache', []);
        await db.runAsync('delete from selected_trip', []);
        await db.runAsync('delete from trip_budget_changes', []);
        await db.runAsync('delete from trip_photos_cache', []);
        await db.runAsync('delete from my_profile_cache', []);
        await db.runAsync('commit', []);
      } catch (error) {
        // Failed: the epoch stays closed, so nothing of the previous user can be written until a retry succeeds.
        pendingClears--;
        await db.runAsync('rollback', []).catch(() => {});
        throw error;
      }
      // Done, in the same task as the commit: the next task already sees the open epoch.
      pendingClears--;
      if (pendingClears === 0) closed = false;
    },

    /** Saves the change as pending; a newer change for the same trip replaces the older one (A7). */
    async saveBudgetChange(change: TripBudgetChange, epoch?: number): Promise<void> {
      if (!current(epoch)) return;
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

  // Every public method is one task on the queue (auth-onboarding D15): reads too, so a read never sees half of a clear.
  const queued: Record<string, unknown> = {};
  for (const [name, task] of Object.entries(tasks)) {
    queued[name] = (...args: never[]) => serial(() => (task as (...taskArgs: never[]) => Promise<unknown>)(...args));
  }
  const store = queued as typeof tasks;
  return {
    ...store,
    // The epoch moves when the clear is CALLED, before it waits for its turn in the queue: whatever is queued behind it, and
    // whatever started before, is refused from now on (see `userEpoch`).
    clearUserData: () => {
      startNewUserEpoch();
      pendingClears++;
      return store.clearUserData();
    },
  };
}

export type LocalStore = ReturnType<typeof createLocalStore>;
