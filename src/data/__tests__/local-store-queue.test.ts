// auth-onboarding D15: expo-sqlite does not order its async calls (iOS: concurrent queue, Android: thread pool; its own docs say
// "order of execution is not guaranteed"), so the local store runs its methods one after another itself. These tests use a
// database that delays and reorders statements like that, and check what the user-data rules (D2, D14) need from the store.
import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore, currentUserEpoch, startNewUserEpoch } from '@/data/local-store';
import type { Profile, TripList, TripOverview, TripPhotoList } from '@/schemas';
import { openTestDb } from '@/test/node-sqlite';
import { reorderingDb, seeded } from '@/test/reordering-db';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const OTHER_TRIP_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';
const AT = '2026-10-18T10:00:00.000Z';
const list: TripList = [{ id: TRIP_ID, name: 'Barcelona', coverImageUri: 'preset:auckland', destination: 'BCN', flights: [], startDate: '2026-11-02', endDate: '2026-11-09' }];
const listWithOther: TripList = [
  ...list,
  { id: OTHER_TRIP_ID, name: 'Rome', coverImageUri: 'preset:bali', destination: 'BCN', flights: [], startDate: '2026-12-01', endDate: '2026-12-05' },
];
const photos: TripPhotoList = [
  {
    id: '3e2b0f7b-9d76-4f7e-8d88-5c9b3b0b4d04',
    tripId: TRIP_ID,
    createdAt: '2026-10-14T18:00:00+00:00',
    url: 'https://example.supabase.co/a.jpg',
    thumbnailUrl: 'https://example.supabase.co/a_thumb.jpg',
  },
];
const overviewOf = (tripId: string): TripOverview => ({
  trip: {
    id: tripId,
    ownerId: '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d',
    name: 'Barcelona',
    coverImageUri: 'preset:auckland',
    destination: 'BCN',
    startDate: '2026-11-02',
    endDate: '2026-11-09',
    baseCurrency: 'EUR',
    budgetPerPerson: { amountMinor: 300000, currency: 'EUR' },
    createdAt: '2026-10-04T12:00:00+00:00',
    budgetUpdatedAt: '2026-10-04T12:00:00+00:00',
    travellerCount: 1,
  },
  members: [],
  segments: [],
});
const profile: Profile = {
  id: '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d',
  username: 'kacper',
  friendCode: 'K7M2QX',
  interests: ['museums'],
  avatarId: null,
  createdAt: '2026-10-18T10:00:00+00:00',
  updatedAt: '2026-10-18T10:00:00+00:00',
};
const change = { tripId: TRIP_ID, budgetPerPerson: { amountMinor: 250000, currency: 'EUR' }, updatedAt: '2026-10-06T09:30:00.000Z' };
const TABLES = ['trip_overview_cache', 'trip_list_cache', 'selected_trip', 'trip_budget_changes', 'trip_photos_cache', 'my_profile_cache'];
const NONE = [0, 0, 0, 0, 0, 0];

type Store = ReturnType<typeof createLocalStore>;
const WRITES: [string, (local: Store, epoch: number) => Promise<void>][] = [
  ['cacheList', (local, epoch) => local.cacheList(list, AT, epoch)],
  ['cacheOverview', (local, epoch) => local.cacheOverview(overviewOf(TRIP_ID), AT, epoch)],
  ['cachePhotos', (local, epoch) => local.cachePhotos(TRIP_ID, photos, AT, epoch)],
  ['cacheProfile', (local, epoch) => local.cacheProfile(profile, AT, epoch)],
  ['selectTrip', (local, epoch) => local.selectTrip(TRIP_ID, epoch)],
  ['saveBudgetChange', (local, epoch) => local.saveBudgetChange(change, epoch)],
];

async function setup(delayMs: (sql: string) => number, answerDelayMs?: (sql: string) => number) {
  const raw = openTestDb();
  await migrateLocalDb(raw);
  const { db, reached } = reorderingDb(raw, delayMs, answerDelayMs);
  const local = createLocalStore(db);
  const rows = async () =>
    Promise.all(TABLES.map(async (table) => (await raw.getFirstAsync<{ n: number }>(`select count(*) as n from ${table}`, []))?.n ?? 0));
  return { raw, local, reached, rows };
}

/** Inserts take a while to reach the database; everything else is quick. */
const slowInserts = (sql: string) => (sql.startsWith('insert') ? 30 : 1);

describe('a write that was issued before the clear', () => {
  it.each(WRITES)('%s is wiped by it, however long the statement takes to reach the database', async (_name, write) => {
    const { local, rows } = await setup(slowInserts);
    const epoch = currentUserEpoch();

    const writing = write(local, epoch);
    const clearing = local.clearUserData();
    await Promise.all([writing, clearing]);

    expect(await rows()).toEqual(NONE);
  });

  it.each(WRITES)('%s called after the clear began, with the old epoch, is refused', async (_name, write) => {
    const { local, rows, reached } = await setup(slowInserts);
    const epoch = currentUserEpoch();

    const clearing = local.clearUserData();
    const writing = write(local, epoch);
    await Promise.all([clearing, writing]);

    expect(await rows()).toEqual(NONE);
    expect(reached.filter((sql) => sql.startsWith('insert'))).toEqual([]);
  });

  it('is refused when its turn comes after the epoch moved (an early bump while it waited in the queue)', async () => {
    const { local, rows } = await setup(slowInserts);
    const epoch = currentUserEpoch();

    const first = local.cacheProfile(profile, AT, epoch); // running (slow insert)
    const second = local.cacheOverview(overviewOf(TRIP_ID), AT, epoch); // waiting behind it
    await new Promise((resolve) => setTimeout(resolve, 5)); // the first one is running now
    startNewUserEpoch();
    await Promise.all([first, second]);

    // The first had started before the move and finishes (a clear that follows wipes it); the second started after it: refused.
    expect(await rows()).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it("the next user's writes after the clear still work", async () => {
    const { local, rows } = await setup(slowInserts);
    await local.clearUserData();

    await local.cacheProfile(profile, AT, currentUserEpoch());

    expect(await rows()).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it("whatever the delays and the order of calls: nothing of the old user is left, and the next user's data can be written", async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = seeded(seed);
      const { local, rows } = await setup(() => Math.floor(random() * 4));
      const old = currentUserEpoch();
      const calls: Promise<unknown>[] = [];
      const order = [...WRITES].sort(() => random() - 0.5);
      const clearAt = Math.floor(random() * (order.length + 1));
      for (const [index, [, write]] of order.entries()) {
        if (index === clearAt) calls.push(local.clearUserData());
        calls.push(write(local, old));
      }
      if (clearAt === order.length) calls.push(local.clearUserData());
      await Promise.all(calls);

      expect({ seed, rows: await rows() }).toEqual({ seed, rows: NONE });
      await local.cacheOverview(overviewOf(TRIP_ID), AT, currentUserEpoch());
      expect({ seed, rows: await rows() }).toEqual({ seed, rows: [1, 0, 0, 0, 0, 0] });
    }
  }, 30000);
});

describe('a read never sees half of a clear', () => {
  it('reads called before the clear see everything, reads called after it see nothing', async () => {
    const { local } = await setup((sql) => (sql.startsWith('delete') ? 15 : 1));
    await local.cacheList(list, AT);
    await local.cacheOverview(overviewOf(TRIP_ID), AT);
    await local.cacheProfile(profile, AT);

    const before = Promise.all([local.cachedList(), local.cachedOverview(TRIP_ID), local.cachedProfile()]);
    const clearing = local.clearUserData();
    const after = Promise.all([local.cachedList(), local.cachedOverview(TRIP_ID), local.cachedProfile()]);

    const [seenBefore, , seenAfter] = await Promise.all([before, clearing, after]);
    expect(seenBefore.map((copy) => copy !== null)).toEqual([true, true, true]);
    expect(seenAfter).toEqual([null, null, null]);
  });
});

describe('methods that do several steps run as one', () => {
  it('forgetTrip does not lose a list copy written while it was reading the list', async () => {
    // The answer of forgetTrip's list read is slow: a cacheList called meanwhile used to land between its read and its update.
    const { local } = await setup(() => 1, (sql) => (sql.startsWith('select list_json') ? 30 : 0));
    await local.cacheList(list, AT);

    const forgetting = local.forgetTrip(TRIP_ID);
    const caching = local.cacheList(listWithOther, AT);
    await Promise.all([forgetting, caching]);

    const kept = (await local.cachedList())?.map((item) => item.id);
    expect(kept).toContain(OTHER_TRIP_ID);
  });

  it('markBudgetSynced reads the copy and updates it without anything in between', async () => {
    const { local } = await setup(() => 1, (sql) => (sql.startsWith('select overview_json') ? 20 : 0));
    await local.cacheOverview(overviewOf(TRIP_ID), AT);
    await local.saveBudgetChange(change);

    const synced = local.markBudgetSynced(change);
    // A newer copy written meanwhile must not be overwritten by the older one that markBudgetSynced read.
    const newer = overviewOf(TRIP_ID);
    newer.trip.name = 'Barcelona 2';
    const caching = local.cacheOverview(newer, AT);
    await Promise.all([synced, caching]);

    expect((await local.cachedOverview(TRIP_ID))?.trip.name).toBe('Barcelona 2');
  });
});

describe('the queue itself', () => {
  it('runs methods in the order they were called, whatever each one takes', async () => {
    const { local } = await setup((sql) => (sql.startsWith('insert into selected_trip') ? 20 : 1));
    await Promise.all([local.selectTrip(TRIP_ID), local.selectTrip(OTHER_TRIP_ID)]);
    await expect(local.selectedTripId()).resolves.toBe(OTHER_TRIP_ID);
  });

  it('a task that fails does not stop the ones behind it', async () => {
    const { raw, local } = await setup(() => 1);
    const run = raw.runAsync.bind(raw);
    jest.spyOn(raw, 'runAsync').mockImplementationOnce(() => Promise.reject(new Error('disk full'))).mockImplementation(run);

    const failing = local.selectTrip(TRIP_ID);
    const next = local.selectTrip(OTHER_TRIP_ID);

    await expect(failing).rejects.toThrow('disk full');
    await expect(next).resolves.toBeUndefined();
    await expect(local.selectedTripId()).resolves.toBe(OTHER_TRIP_ID);
  });

  it('a task that uses another method of the store inside does not wait for itself', async () => {
    const { local } = await setup(() => 1);
    await local.cacheList(list, AT);
    await local.cacheOverview(overviewOf(TRIP_ID), AT);
    await local.saveBudgetChange(change);
    const noDeadlock = (task: Promise<unknown>) =>
      Promise.race([task, new Promise((_, reject) => setTimeout(() => reject(new Error('deadlock')), 1000))]);

    await noDeadlock(local.markBudgetSynced(change)); // reads the copy of the trip inside
    await noDeadlock(local.forgetTrip(TRIP_ID)); // reads the list copy inside
    await noDeadlock(local.clearUserData());
  });
});
