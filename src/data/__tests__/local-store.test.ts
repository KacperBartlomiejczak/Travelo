import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore } from '@/data/local-store';
import type { TripOverview } from '@/schemas';
import { openTestDb } from '@/test/node-sqlite';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const OTHER_TRIP_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';

const overview: TripOverview = {
  trip: {
    id: TRIP_ID,
    ownerId: '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d',
    name: 'Barcelona',
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
};

const change = { tripId: TRIP_ID, budgetPerPerson: { amountMinor: 250000, currency: 'EUR' }, updatedAt: '2026-10-06T09:30:00.000Z' };

async function store() {
  const db = openTestDb();
  await migrateLocalDb(db);
  return { db, local: createLocalStore(db) };
}

describe('nearest trip cache (D6)', () => {
  it('is empty at first', async () => {
    const { local } = await store();
    await expect(local.cachedNearest()).resolves.toBeNull();
  });

  it('gives back the last nearest trip read from the server', async () => {
    const { local } = await store();
    await local.cacheNearest(overview, '2026-10-06T09:00:00.000Z');
    await expect(local.cachedNearest()).resolves.toEqual(overview);
  });

  it('keeps only the latest nearest trip, and nothing once the server has none', async () => {
    const { local } = await store();
    await local.cacheNearest(overview, '2026-10-06T09:00:00.000Z');
    const other = { ...overview, trip: { ...overview.trip, id: OTHER_TRIP_ID, name: 'Rome' } };
    await local.cacheNearest(other, '2026-10-06T09:05:00.000Z');
    await expect(local.cachedNearest()).resolves.toEqual(other);
    await local.cacheNearest(null, '2026-10-06T09:10:00.000Z');
    await expect(local.cachedNearest()).resolves.toBeNull();
  });

  it('treats a corrupt or outdated copy as no copy instead of crashing', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values (?, '{not json', 'x')", [TRIP_ID]);
    await expect(local.cachedNearest()).resolves.toBeNull();
    await db.runAsync('update trip_overview_cache set overview_json = ?', [JSON.stringify({ trip: { id: TRIP_ID } })]);
    await expect(local.cachedNearest()).resolves.toBeNull();
  });
});

describe('budget changes', () => {
  it('saves a change as pending, with no attempts yet', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    await expect(local.budgetChange(TRIP_ID)).resolves.toEqual({ ...change, syncStatus: 'pending', attempts: 0 });
    await expect(local.budgetChange(OTHER_TRIP_ID)).resolves.toBeNull();
  });

  it('keeps one change per trip: a newer one replaces the older and starts over as pending (A7)', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    await local.recordBudgetAttempt(change, { syncStatus: 'failed', error: 'boom', at: '2026-10-06T09:31:00.000Z' });
    const newer = { ...change, budgetPerPerson: { amountMinor: 200000, currency: 'EUR' }, updatedAt: '2026-10-06T10:00:00.000Z' };
    await local.saveBudgetChange(newer);
    await expect(local.budgetChange(TRIP_ID)).resolves.toEqual({ ...newer, syncStatus: 'pending', attempts: 0 });
  });

  it('lists every change still waiting, pending or failed', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    await local.saveBudgetChange({ ...change, tripId: OTHER_TRIP_ID });
    await local.recordBudgetAttempt({ ...change, tripId: OTHER_TRIP_ID }, { syncStatus: 'failed', error: 'boom', at: '2026-10-06T09:31:00.000Z' });
    const waiting = await local.unsyncedBudgetChanges();
    expect(waiting.map((row) => [row.tripId, row.syncStatus])).toEqual(
      expect.arrayContaining([
        [TRIP_ID, 'pending'],
        [OTHER_TRIP_ID, 'failed'],
      ]),
    );
    expect(waiting).toHaveLength(2);
  });

  it('removes a change once it reached the server', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    await local.markBudgetSynced(change);
    await expect(local.budgetChange(TRIP_ID)).resolves.toBeNull();
  });

  it('writes the synced amount into the device copy of that trip, so offline it is not the old one', async () => {
    const { local } = await store();
    await local.cacheNearest(overview, '2026-10-06T09:00:00.000Z');
    await local.saveBudgetChange(change);
    await local.markBudgetSynced(change);
    const cached = await local.cachedNearest();
    expect(cached?.trip.budgetPerPerson).toEqual(change.budgetPerPerson);
    expect(cached?.trip.budgetUpdatedAt).toBe(change.updatedAt);
  });

  it('leaves the copy alone when it is another trip or already has a newer budget', async () => {
    const { local } = await store();
    const newerCopy = { ...overview, trip: { ...overview.trip, budgetUpdatedAt: '2026-10-07T00:00:00+00:00' } };
    await local.cacheNearest(newerCopy, '2026-10-06T09:00:00.000Z');
    await local.saveBudgetChange(change);
    await local.markBudgetSynced(change);
    await local.saveBudgetChange({ ...change, tripId: OTHER_TRIP_ID });
    await local.markBudgetSynced({ ...change, tripId: OTHER_TRIP_ID });
    await expect(local.cachedNearest()).resolves.toEqual(newerCopy);
  });

  it('does not remove a newer change saved while the older one was being sent', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    const newer = { ...change, budgetPerPerson: { amountMinor: 1, currency: 'EUR' }, updatedAt: '2026-10-06T10:00:00.000Z' };
    await local.saveBudgetChange(newer);
    await local.markBudgetSynced(change);
    await expect(local.budgetChange(TRIP_ID)).resolves.toEqual(expect.objectContaining({ updatedAt: newer.updatedAt }));
  });

  it('records a failed attempt with its error, time and count, and keeps the change', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    await local.recordBudgetAttempt(change, { syncStatus: 'failed', error: 'permission denied', at: '2026-10-06T09:31:00.000Z' });
    await local.recordBudgetAttempt(change, { syncStatus: 'failed', error: 'permission denied', at: '2026-10-06T09:32:00.000Z' });
    await expect(local.budgetChange(TRIP_ID)).resolves.toEqual({
      ...change,
      syncStatus: 'failed',
      syncError: 'permission denied',
      attempts: 2,
      lastAttemptAt: '2026-10-06T09:32:00.000Z',
    });
  });

  it('records an attempt that could not reach the server as still pending', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    await local.recordBudgetAttempt(change, { syncStatus: 'pending', at: '2026-10-06T09:31:00.000Z' });
    await expect(local.budgetChange(TRIP_ID)).resolves.toEqual({ ...change, syncStatus: 'pending', attempts: 1, lastAttemptAt: '2026-10-06T09:31:00.000Z' });
  });

  it('rejects a row that does not match the schema', async () => {
    const { db, local } = await store();
    await local.saveBudgetChange(change);
    await db.runAsync("update trip_budget_changes set sync_status = 'sending'", []);
    await expect(local.budgetChange(TRIP_ID)).rejects.toThrow();
  });
});
