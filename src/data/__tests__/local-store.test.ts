import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore, currentUserEpoch, isEpochCurrent } from '@/data/local-store';
import { reorderingDb } from '@/test/reordering-db';
import type { Profile, TripList, TripOverview, TripPhotoList } from '@/schemas';
import { openTestDb } from '@/test/node-sqlite';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const OTHER_TRIP_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';

function photosOf(tripId: string, ids: string[]): TripPhotoList {
  return ids.map((id, index) => ({
    id,
    tripId,
    takenAt: `2026-11-0${index + 2}T10:00`,
    createdAt: '2026-10-14T18:00:00+00:00',
    url: `https://example.supabase.co/storage/v1/object/sign/trip-photos/${tripId}/${id}.jpg?token=a`,
    thumbnailUrl: `https://example.supabase.co/storage/v1/object/sign/trip-photos/${tripId}/${id}_thumb.jpg?token=b`,
  }));
}

const PHOTO_A = '3e2b0f7b-9d76-4f7e-8d88-5c9b3b0b4d04';
const PHOTO_B = '4f3c1a8c-0e87-4a8f-9e99-6d0c4c1c5e05';
const photos = photosOf(TRIP_ID, [PHOTO_A, PHOTO_B]);
const otherPhotos = photosOf(OTHER_TRIP_ID, [PHOTO_B]);

const overview: TripOverview = {
  trip: {
    id: TRIP_ID,
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
};

const change = { tripId: TRIP_ID, budgetPerPerson: { amountMinor: 250000, currency: 'EUR' }, updatedAt: '2026-10-06T09:30:00.000Z' };

async function store() {
  const db = openTestDb();
  await migrateLocalDb(db);
  return { db, local: createLocalStore(db) };
}

describe('trip list copy (trips-drawer D3)', () => {
  const list: TripList = [
    {
      id: TRIP_ID,
      name: 'Barcelona',
      coverImageUri: 'preset:auckland',
      destination: 'BCN',
      flights: [
        { fromIata: 'WAW', toIata: 'BCN' },
        { fromIata: 'BCN', toIata: 'WAW' },
      ],
      startDate: '2026-11-02',
      endDate: '2026-11-09',
    },
    { id: OTHER_TRIP_ID, name: 'Rome', coverImageUri: 'preset:bali', destination: 'FCO', flights: [], startDate: '2026-12-01', endDate: '2026-12-05' },
  ];

  it('is empty at first', async () => {
    const { local } = await store();
    await expect(local.cachedList()).resolves.toBeNull();
  });

  it('gives back the last list read from the server, also an empty one', async () => {
    const { local } = await store();
    await local.cacheList(list, '2026-10-08T09:00:00.000Z');
    await expect(local.cachedList()).resolves.toEqual(list);
    await local.cacheList([], '2026-10-08T09:05:00.000Z');
    await expect(local.cachedList()).resolves.toEqual([]);
  });

  it('gives back the destination and the flight routes of every trip (profile-screen D11)', async () => {
    const { local } = await store();
    await local.cacheList(list, '2026-10-08T09:00:00.000Z');
    const copy = await local.cachedList();
    expect(copy?.map(({ destination }) => destination)).toEqual(['BCN', 'FCO']);
    expect(copy?.[0].flights).toEqual([
      { fromIata: 'WAW', toIata: 'BCN' },
      { fromIata: 'BCN', toIata: 'WAW' },
    ]);
    expect(copy?.[1].flights).toEqual([]);
  });

  it('reads a copy saved before destination and flights existed as no copy, not a crash (profile-screen R1)', async () => {
    const { db, local } = await store();
    const beforeStep2 = [{ id: TRIP_ID, name: 'Barcelona', coverImageUri: 'preset:auckland', startDate: '2026-11-02', endDate: '2026-11-09' }];
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, ?, '2026-10-08T09:00:00.000Z')", [JSON.stringify(beforeStep2)]);
    await expect(local.cachedList()).resolves.toBeNull();
  });

  it('treats a corrupt or outdated copy as no copy instead of crashing', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, '{not json', 'x')", []);
    await expect(local.cachedList()).resolves.toBeNull();
    await db.runAsync('update trip_list_cache set list_json = ?', [JSON.stringify([{ id: TRIP_ID }])]);
    await expect(local.cachedList()).resolves.toBeNull();
  });

  it('deletes the copies of trips that are no longer on the list and keeps the others (A5)', async () => {
    const { local } = await store();
    const other = { ...overview, trip: { ...overview.trip, id: OTHER_TRIP_ID, name: 'Rome' } };
    await local.cacheOverview(overview, '2026-10-08T09:00:00.000Z');
    await local.cacheOverview(other, '2026-10-08T09:00:00.000Z');
    await local.cacheList([list[1]], '2026-10-08T09:05:00.000Z');
    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
    await expect(local.cachedOverview(OTHER_TRIP_ID)).resolves.toEqual(other);
    await local.cacheList([], '2026-10-08T09:10:00.000Z');
    await expect(local.cachedOverview(OTHER_TRIP_ID)).resolves.toBeNull();
  });

  it('deletes the photo copies of trips that are no longer on the list and keeps the others (trip-photos D8)', async () => {
    const { local } = await store();
    await local.cachePhotos(TRIP_ID, photos, '2026-10-14T09:00:00.000Z');
    await local.cachePhotos(OTHER_TRIP_ID, otherPhotos, '2026-10-14T09:00:00.000Z');
    await local.cacheList([list[1]], '2026-10-14T09:05:00.000Z');
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
    await expect(local.cachedPhotos(OTHER_TRIP_ID)).resolves.toEqual(otherPhotos);
    await local.cacheList([], '2026-10-14T09:10:00.000Z');
    await expect(local.cachedPhotos(OTHER_TRIP_ID)).resolves.toBeNull();
  });

  it('forgets the chosen trip once it is no longer on the list, and keeps a chosen trip that is (D2)', async () => {
    const { local } = await store();
    await local.selectTrip(OTHER_TRIP_ID);
    await local.cacheList(list, '2026-10-08T09:00:00.000Z');
    await expect(local.selectedTripId()).resolves.toBe(OTHER_TRIP_ID);
    await local.cacheList([list[0]], '2026-10-08T09:05:00.000Z');
    await expect(local.selectedTripId()).resolves.toBeNull();
  });

  it('never deletes a budget change that is still waiting', async () => {
    const { local } = await store();
    await local.saveBudgetChange(change);
    await local.cacheList([], '2026-10-08T09:00:00.000Z');
    await expect(local.budgetChange(TRIP_ID)).resolves.toEqual(expect.objectContaining({ syncStatus: 'pending' }));
  });
});

describe('trip copies, one per trip opened on this phone (A5)', () => {
  const other = { ...overview, trip: { ...overview.trip, id: OTHER_TRIP_ID, name: 'Rome' } };

  it('has no copy of a trip never opened', async () => {
    const { local } = await store();
    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
  });

  it('keeps a copy of each trip, and a newer read replaces only that trip\'s copy', async () => {
    const { local } = await store();
    await local.cacheOverview(overview, '2026-10-08T09:00:00.000Z');
    await local.cacheOverview(other, '2026-10-08T09:00:00.000Z');
    const renamed = { ...overview, trip: { ...overview.trip, name: 'Barcelona 2026' } };
    await local.cacheOverview(renamed, '2026-10-08T09:05:00.000Z');
    await expect(local.cachedOverview(TRIP_ID)).resolves.toEqual(renamed);
    await expect(local.cachedOverview(OTHER_TRIP_ID)).resolves.toEqual(other);
  });

  it("keeps the organizer's nick in the copy, and reads an older copy without it (friend-invite A4)", async () => {
    const { db, local } = await store();
    const shared = { ...overview, organizerUsername: 'kacper.b' };
    await local.cacheOverview(shared, '2026-10-08T09:00:00.000Z');
    await expect(local.cachedOverview(TRIP_ID)).resolves.toEqual(shared);

    await db.runAsync('update trip_overview_cache set overview_json = ?', [JSON.stringify(overview)]);
    const old = await local.cachedOverview(TRIP_ID);
    expect(old).toEqual(overview);
    expect(old).not.toHaveProperty('organizerUsername');
  });

  it('treats a corrupt or outdated copy as no copy instead of crashing', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values (?, '{not json', 'x')", [TRIP_ID]);
    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
    await db.runAsync('update trip_overview_cache set overview_json = ?', [JSON.stringify({ trip: { id: TRIP_ID } })]);
    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
  });
});

describe('trip photo copies, one per trip (trip-photos D8)', () => {
  it('has no copy of a trip whose photos were never read', async () => {
    const { local } = await store();
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
  });

  it('gives back the photos last read from the server, also an empty list', async () => {
    const { local } = await store();
    await local.cachePhotos(TRIP_ID, photos, '2026-10-14T09:00:00.000Z');
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toEqual(photos);
    await local.cachePhotos(TRIP_ID, [], '2026-10-14T09:05:00.000Z');
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toEqual([]);
  });

  it('keeps the order of the list it was given', async () => {
    const { local } = await store();
    const reversed = [photos[1], photos[0]];
    await local.cachePhotos(TRIP_ID, reversed, '2026-10-14T09:00:00.000Z');
    const cached = await local.cachedPhotos(TRIP_ID);
    expect(cached?.map((photo) => photo.id)).toEqual([PHOTO_B, PHOTO_A]);
  });

  it('replaces the copy of a trip when it is saved again, with the new time', async () => {
    const { db, local } = await store();
    await local.cachePhotos(TRIP_ID, photos, '2026-10-14T09:00:00.000Z');
    await local.cachePhotos(TRIP_ID, [photos[1]], '2026-10-14T09:05:00.000Z');
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toEqual([photos[1]]);
    await expect(db.getAllAsync('select trip_id, cached_at from trip_photos_cache', [])).resolves.toEqual([
      { trip_id: TRIP_ID, cached_at: '2026-10-14T09:05:00.000Z' },
    ]);
  });

  it('keeps the copies of two trips independent', async () => {
    const { local } = await store();
    await local.cachePhotos(TRIP_ID, photos, '2026-10-14T09:00:00.000Z');
    await local.cachePhotos(OTHER_TRIP_ID, otherPhotos, '2026-10-14T09:00:00.000Z');
    await local.cachePhotos(TRIP_ID, [], '2026-10-14T09:05:00.000Z');
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toEqual([]);
    await expect(local.cachedPhotos(OTHER_TRIP_ID)).resolves.toEqual(otherPhotos);
  });

  it('treats a corrupt copy as no copy instead of crashing', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_photos_cache (trip_id, photos_json, cached_at) values (?, '{not json', 'x')", [TRIP_ID]);
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
  });

  it('treats a copy that no longer matches the schema as no copy', async () => {
    const { db, local } = await store();
    const write = (list: unknown[]) =>
      db.runAsync('insert into trip_photos_cache (trip_id, photos_json, cached_at) values (?, ?, ?) on conflict (trip_id) do update set photos_json = excluded.photos_json', [
        TRIP_ID,
        JSON.stringify(list),
        'x',
      ]);

    await write([{ ...photos[0], url: 'javascript:alert(1)' }]);
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
    await write([{ ...photos[0], thumbnailUrl: 'file:///cache/thumb.jpg' }]);
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
    await write([{ ...photos[0], id: 'photo-1' }]);
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
    await write([{ id: PHOTO_A }]);
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
    await db.runAsync('update trip_photos_cache set photos_json = ?', [JSON.stringify({ photos })]);
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
  });

  it('refuses to save a list that does not match the schema and writes nothing', async () => {
    const { db, local } = await store();
    await expect(local.cachePhotos(TRIP_ID, [{ ...photos[0], url: 'javascript:alert(1)' }], '2026-10-14T09:00:00.000Z')).rejects.toThrow();
    await expect(local.cachePhotos(TRIP_ID, [{ ...photos[0], id: 'photo-1' }], '2026-10-14T09:00:00.000Z')).rejects.toThrow();
    await expect(db.getAllAsync('select * from trip_photos_cache', [])).resolves.toEqual([]);
  });

  it('keeps the old copy when a newer list is refused', async () => {
    const { local } = await store();
    await local.cachePhotos(TRIP_ID, photos, '2026-10-14T09:00:00.000Z');
    await expect(local.cachePhotos(TRIP_ID, [{ ...photos[0], url: 'ftp://example.com/a.jpg' }], '2026-10-14T09:05:00.000Z')).rejects.toThrow();
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toEqual(photos);
  });
});

describe('chosen trip (trips-drawer D2)', () => {
  it('is none at first', async () => {
    const { local } = await store();
    await expect(local.selectedTripId()).resolves.toBeNull();
  });

  it('remembers the latest choice until it is cleared', async () => {
    const { local } = await store();
    await local.selectTrip(TRIP_ID);
    await expect(local.selectedTripId()).resolves.toBe(TRIP_ID);
    await local.selectTrip(OTHER_TRIP_ID);
    await expect(local.selectedTripId()).resolves.toBe(OTHER_TRIP_ID);
    await local.clearSelectedTrip();
    await expect(local.selectedTripId()).resolves.toBeNull();
  });

  it('refuses to store an id that is not a UUID', async () => {
    const { local } = await store();
    await expect(local.selectTrip('trip-1')).rejects.toThrow();
    await expect(local.selectedTripId()).resolves.toBeNull();
  });

  it('reads a stored id that is not a UUID as no choice', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into selected_trip (id, trip_id) values (1, 'trip-1')", []);
    await expect(local.selectedTripId()).resolves.toBeNull();
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
    await local.cacheOverview(overview, '2026-10-06T09:00:00.000Z');
    await local.saveBudgetChange(change);
    await local.markBudgetSynced(change);
    const cached = await local.cachedOverview(TRIP_ID);
    expect(cached?.trip.budgetPerPerson).toEqual(change.budgetPerPerson);
    expect(cached?.trip.budgetUpdatedAt).toBe(change.updatedAt);
  });

  it('writes the synced amount into the copy of that trip only, when several trips are copied', async () => {
    const { local } = await store();
    const other = { ...overview, trip: { ...overview.trip, id: OTHER_TRIP_ID, name: 'Rome' } };
    await local.cacheOverview(other, '2026-10-08T09:00:00.000Z');
    await local.cacheOverview(overview, '2026-10-08T09:00:00.000Z');
    await local.saveBudgetChange(change);
    await local.markBudgetSynced(change);
    expect((await local.cachedOverview(TRIP_ID))?.trip.budgetPerPerson).toEqual(change.budgetPerPerson);
    await expect(local.cachedOverview(OTHER_TRIP_ID)).resolves.toEqual(other);
  });

  it('leaves the copy alone when it is another trip or already has a newer budget', async () => {
    const { local } = await store();
    const newerCopy = { ...overview, trip: { ...overview.trip, budgetUpdatedAt: '2026-10-07T00:00:00+00:00' } };
    await local.cacheOverview(newerCopy, '2026-10-06T09:00:00.000Z');
    await local.saveBudgetChange(change);
    await local.markBudgetSynced(change);
    await local.saveBudgetChange({ ...change, tripId: OTHER_TRIP_ID });
    await local.markBudgetSynced({ ...change, tripId: OTHER_TRIP_ID });
    await expect(local.cachedOverview(TRIP_ID)).resolves.toEqual(newerCopy);
    await expect(local.cachedOverview(OTHER_TRIP_ID)).resolves.toBeNull();
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

describe('forgetTrip (trip-edit-menu A5)', () => {
  const list: TripList = [
    { id: TRIP_ID, name: 'Barcelona', coverImageUri: 'preset:auckland', destination: 'BCN', flights: [], startDate: '2026-11-02', endDate: '2026-11-09' },
    { id: OTHER_TRIP_ID, name: 'Rome', coverImageUri: 'preset:auckland', destination: 'BCN', flights: [], startDate: '2026-12-01', endDate: '2026-12-05' },
  ];
  const other = { ...overview, trip: { ...overview.trip, id: OTHER_TRIP_ID, name: 'Rome' } };

  it('removes the trip\'s copy, its chosen-trip row, its pending budget change and its entry in the list copy', async () => {
    const { local } = await store();
    await local.cacheList(list, '2026-10-08T09:00:00.000Z');
    await local.cacheOverview(overview, '2026-10-08T09:00:00.000Z');
    await local.selectTrip(TRIP_ID);
    await local.saveBudgetChange(change);

    await local.forgetTrip(TRIP_ID);

    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
    await expect(local.selectedTripId()).resolves.toBeNull();
    await expect(local.budgetChange(TRIP_ID)).resolves.toBeNull();
    await expect(local.cachedList()).resolves.toEqual([list[1]]);
  });

  it('leaves every other trip alone: its copy, its budget change and a choice of it', async () => {
    const { local } = await store();
    await local.cacheList(list, '2026-10-08T09:00:00.000Z');
    await local.cacheOverview(overview, '2026-10-08T09:00:00.000Z');
    await local.cacheOverview(other, '2026-10-08T09:00:00.000Z');
    await local.selectTrip(OTHER_TRIP_ID);
    await local.saveBudgetChange({ ...change, tripId: OTHER_TRIP_ID });

    await local.forgetTrip(TRIP_ID);

    await expect(local.cachedOverview(OTHER_TRIP_ID)).resolves.toEqual(other);
    await expect(local.selectedTripId()).resolves.toBe(OTHER_TRIP_ID);
    await expect(local.budgetChange(OTHER_TRIP_ID)).resolves.toEqual(expect.objectContaining({ syncStatus: 'pending' }));
    await expect(local.cachedList()).resolves.toEqual([list[1]]);
  });

  it('removes the trip\'s photo copy and keeps the photo copies of other trips (trip-photos D8)', async () => {
    const { local } = await store();
    await local.cachePhotos(TRIP_ID, photos, '2026-10-14T09:00:00.000Z');
    await local.cachePhotos(OTHER_TRIP_ID, otherPhotos, '2026-10-14T09:00:00.000Z');

    await local.forgetTrip(TRIP_ID);

    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
    await expect(local.cachedPhotos(OTHER_TRIP_ID)).resolves.toEqual(otherPhotos);
  });

  it('does nothing for a trip the phone never kept anything of', async () => {
    const { local } = await store();
    await local.cacheList(list, '2026-10-08T09:00:00.000Z');
    await local.cacheOverview(other, '2026-10-08T09:00:00.000Z');
    await local.selectTrip(OTHER_TRIP_ID);
    await local.saveBudgetChange({ ...change, tripId: OTHER_TRIP_ID });

    await local.forgetTrip('2d1a9e6a-8c65-4e6d-9c77-4b8a2a9a3c03');

    await expect(local.cachedList()).resolves.toEqual(list);
    await expect(local.cachedOverview(OTHER_TRIP_ID)).resolves.toEqual(other);
    await expect(local.selectedTripId()).resolves.toBe(OTHER_TRIP_ID);
    await expect(local.budgetChange(OTHER_TRIP_ID)).resolves.not.toBeNull();
  });

  it('works when there is no list copy yet', async () => {
    const { local } = await store();
    await local.cacheOverview(overview, '2026-10-08T09:00:00.000Z');
    await local.forgetTrip(TRIP_ID);
    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
    await expect(local.cachedList()).resolves.toBeNull();
  });

  it('keeps the time the list copy was read', async () => {
    const { db, local } = await store();
    await local.cacheList(list, '2026-10-08T09:00:00.000Z');
    await local.forgetTrip(TRIP_ID);
    await expect(db.getFirstAsync('select cached_at from trip_list_cache', [])).resolves.toEqual({ cached_at: '2026-10-08T09:00:00.000Z' });
  });

  it('is all or nothing: when a step fails, nothing is removed', async () => {
    const { db, local } = await store();
    await local.cacheOverview(overview, '2026-10-08T09:00:00.000Z');
    await local.cachePhotos(TRIP_ID, photos, '2026-10-14T09:00:00.000Z');
    await local.selectTrip(TRIP_ID);
    await local.saveBudgetChange(change);
    const run = db.runAsync.bind(db);
    jest.spyOn(db, 'runAsync').mockImplementation((sql, params) => {
      if (sql.startsWith('delete from trip_budget_changes')) return Promise.reject(new Error('disk full'));
      return run(sql, params);
    });

    await expect(local.forgetTrip(TRIP_ID)).rejects.toThrow('disk full');

    await expect(local.cachedOverview(TRIP_ID)).resolves.not.toBeNull();
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toEqual(photos);
    await expect(local.selectedTripId()).resolves.toBe(TRIP_ID);
    await expect(local.budgetChange(TRIP_ID)).resolves.not.toBeNull();
  });
});

describe('copies from before covers were required (trip-covers)', () => {
  const { coverImageUri: _cover, ...oldTrip } = overview.trip;
  const oldOverview = { ...overview, trip: oldTrip };
  const oldList = [{ id: TRIP_ID, name: 'Barcelona', startDate: '2026-11-02', endDate: '2026-11-09' }];

  it('an old list copy without a cover counts as no copy, not a crash', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, ?, '2026-10-05T10:00:00.000Z')", [JSON.stringify(oldList)]);
    await expect(local.cachedList()).resolves.toBeNull();
  });

  it('an old trip copy without a cover counts as no copy, not a crash', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values (?, ?, '2026-10-05T10:00:00.000Z')", [
      TRIP_ID,
      JSON.stringify(oldOverview),
    ]);
    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
  });

  it('a copy with a device URI as the cover (from before this feature) counts as no copy too', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, ?, '2026-10-05T10:00:00.000Z')", [
      JSON.stringify([{ ...oldList[0], coverImageUri: 'file:///cache/old.jpg' }]),
    ]);
    await expect(local.cachedList()).resolves.toBeNull();
  });

  it('a new copy replaces an old one, and keeps the signed urls of a gallery cover', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, ?, '2026-10-05T10:00:00.000Z')", [JSON.stringify(oldList)]);
    const urls = { url: 'https://example.supabase.co/a.jpg?token=1', thumbnailUrl: 'https://example.supabase.co/a_thumb.jpg?token=2' };
    const fresh: TripList = [
      { id: TRIP_ID, name: 'Barcelona', coverImageUri: 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c', coverUrls: urls, destination: 'BCN', flights: [], startDate: '2026-11-02', endDate: '2026-11-09' },
    ];
    await local.cacheList(fresh, '2026-10-06T10:00:00.000Z');
    await expect(local.cachedList()).resolves.toEqual(fresh);
  });
});

const USER_ID = '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d';
const AVATAR_ID = '6a5d3b0e-2f98-4c0a-b1aa-7e1d5e3d7f06';
const profile: Profile = {
  id: USER_ID,
  username: 'kacper',
  friendCode: 'K7M2QX',
  interests: ['museums', 'beaches'],
  avatarId: AVATAR_ID,
  createdAt: '2026-10-18T10:00:00+00:00',
  updatedAt: '2026-10-18T10:00:00+00:00',
};

describe('own profile copy (auth-onboarding D9)', () => {
  it('is none at first', async () => {
    const { local } = await store();
    await expect(local.cachedProfile()).resolves.toBeNull();
  });

  it('gives back the profile last saved, and a newer one replaces it with the new time', async () => {
    const { db, local } = await store();
    await local.cacheProfile(profile, '2026-10-18T10:00:00.000Z');
    await expect(local.cachedProfile()).resolves.toEqual(profile);
    const renamed = { ...profile, username: 'kacper2', avatarId: null };
    await local.cacheProfile(renamed, '2026-10-18T10:05:00.000Z');
    await expect(local.cachedProfile()).resolves.toEqual(renamed);
    await expect(db.getAllAsync('select id, cached_at from my_profile_cache', [])).resolves.toEqual([
      { id: 1, cached_at: '2026-10-18T10:05:00.000Z' },
    ]);
  });

  it('keeps the profile without the signed avatar url (it expires)', async () => {
    const { db, local } = await store();
    await local.cacheProfile({ ...profile, avatarUrl: 'https://example.supabase.co/sign/a.jpg?token=1' } as Profile, '2026-10-18T10:00:00.000Z');
    const row = await db.getFirstAsync<{ profile_json: string }>('select profile_json from my_profile_cache', []);
    expect(row?.profile_json).not.toContain('avatarUrl');
    expect(row?.profile_json).not.toContain('token');
  });

  it('refuses to save an invalid profile and keeps the old copy', async () => {
    const { db, local } = await store();
    await expect(local.cacheProfile({ ...profile, username: 'Not Valid' }, '2026-10-18T10:00:00.000Z')).rejects.toThrow();
    await expect(db.getAllAsync('select * from my_profile_cache', [])).resolves.toEqual([]);
    await local.cacheProfile(profile, '2026-10-18T10:00:00.000Z');
    await expect(local.cacheProfile({ ...profile, interests: [] }, '2026-10-18T10:05:00.000Z')).rejects.toThrow();
    await expect(local.cachedProfile()).resolves.toEqual(profile);
  });

  it('treats a corrupt copy or one that no longer matches the schema as no copy', async () => {
    const { db, local } = await store();
    await db.runAsync("insert into my_profile_cache (id, profile_json, cached_at) values (1, '{not json', 'x')", []);
    await expect(local.cachedProfile()).resolves.toBeNull();
    await db.runAsync('update my_profile_cache set profile_json = ?', [JSON.stringify({ ...profile, friendCode: 'AB0OIL' })]);
    await expect(local.cachedProfile()).resolves.toBeNull();
    await db.runAsync('update my_profile_cache set profile_json = ?', [JSON.stringify({ id: USER_ID })]);
    await expect(local.cachedProfile()).resolves.toBeNull();
  });

  it('forgets the copy on clearProfile, also when there is none', async () => {
    const { local } = await store();
    await expect(local.clearProfile()).resolves.toBeUndefined();
    await local.cacheProfile(profile, '2026-10-18T10:00:00.000Z');
    await local.clearProfile();
    await expect(local.cachedProfile()).resolves.toBeNull();
  });
});

describe('clearUserData (auth-onboarding D2)', () => {
  async function filledStore() {
    const ctx = await store();
    const { local } = ctx;
    await local.cacheList(
      [{ id: TRIP_ID, name: 'Barcelona', coverImageUri: 'preset:auckland', destination: 'BCN', flights: [], startDate: '2026-11-02', endDate: '2026-11-09' }],
      '2026-10-18T09:00:00.000Z',
    );
    await local.cacheOverview(overview, '2026-10-18T09:00:00.000Z');
    await local.cachePhotos(TRIP_ID, photos, '2026-10-18T09:00:00.000Z');
    await local.selectTrip(TRIP_ID);
    await local.saveBudgetChange(change);
    await local.cacheProfile(profile, '2026-10-18T09:00:00.000Z');
    return ctx;
  }

  const TABLES = ['trip_overview_cache', 'trip_list_cache', 'selected_trip', 'trip_budget_changes', 'trip_photos_cache', 'my_profile_cache'];
  const count = async (db: Awaited<ReturnType<typeof store>>['db'], table: string) =>
    (await db.getFirstAsync<{ n: number }>(`select count(*) as n from ${table}`, []))?.n;

  it('starts from a filled phone', async () => {
    const { db } = await filledStore();
    for (const table of TABLES) expect(await count(db, table)).toBeGreaterThan(0);
  });

  it('empties the trip copies, the list copy, the chosen trip, the budget changes, the photo copies and the profile copy', async () => {
    const { db, local } = await filledStore();

    await local.clearUserData();

    for (const table of TABLES) expect(await count(db, table)).toBe(0);
    await expect(local.cachedList()).resolves.toBeNull();
    await expect(local.cachedOverview(TRIP_ID)).resolves.toBeNull();
    await expect(local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
    await expect(local.selectedTripId()).resolves.toBeNull();
    await expect(local.budgetChange(TRIP_ID)).resolves.toBeNull();
    await expect(local.cachedProfile()).resolves.toBeNull();
  });

  it('works on an empty phone and can be repeated', async () => {
    const { local } = await store();
    await expect(local.clearUserData()).resolves.toBeUndefined();
    await expect(local.clearUserData()).resolves.toBeUndefined();
  });

  it('runs in one transaction: when the last step fails, nothing is removed', async () => {
    const { db, local } = await filledStore();
    const before = await Promise.all(TABLES.map((table) => count(db, table)));
    const run = db.runAsync.bind(db);
    // The node-sqlite helper has real transactions, so a failure half-way must roll the earlier deletes back.
    jest.spyOn(db, 'runAsync').mockImplementation((sql, params) => {
      if (sql.startsWith('delete from my_profile_cache')) return Promise.reject(new Error('disk full'));
      return run(sql, params);
    });

    await expect(local.clearUserData()).rejects.toThrow('disk full');

    expect(await Promise.all(TABLES.map((table) => count(db, table)))).toEqual(before);
    await expect(local.cachedProfile()).resolves.toEqual(profile);
    await expect(local.budgetChange(TRIP_ID)).resolves.not.toBeNull();
  });

  it('runs in one transaction: when the first step fails, nothing is removed either', async () => {
    const { db, local } = await filledStore();
    const run = db.runAsync.bind(db);
    jest.spyOn(db, 'runAsync').mockImplementation((sql, params) => {
      if (sql.startsWith('delete from trip_overview_cache')) return Promise.reject(new Error('disk full'));
      return run(sql, params);
    });

    await expect(local.clearUserData()).rejects.toThrow('disk full');

    await expect(local.cachedOverview(TRIP_ID)).resolves.not.toBeNull();
    await expect(local.cachedProfile()).resolves.toEqual(profile);
  });
});

describe('writes of an operation that started before a clear (auth-onboarding D2, D14)', () => {
  const AT = '2026-10-18T10:00:00.000Z';
  const list: TripList = [{ id: TRIP_ID, name: 'Barcelona', coverImageUri: 'preset:auckland', destination: 'BCN', flights: [], startDate: '2026-11-02', endDate: '2026-11-09' }];

  /** The six writes that put data on the phone, each called with the epoch an operation captured at its start. */
  const WRITES: [string, (local: ReturnType<typeof createLocalStore>, epoch: number) => Promise<void>][] = [
    ['cacheList', (local, epoch) => local.cacheList(list, AT, epoch)],
    ['cacheOverview', (local, epoch) => local.cacheOverview(overview, AT, epoch)],
    ['cachePhotos', (local, epoch) => local.cachePhotos(TRIP_ID, photos, AT, epoch)],
    ['cacheProfile', (local, epoch) => local.cacheProfile(profile, AT, epoch)],
    ['selectTrip', (local, epoch) => local.selectTrip(TRIP_ID, epoch)],
    ['saveBudgetChange', (local, epoch) => local.saveBudgetChange(change, epoch)],
  ];
  const TABLES = ['trip_overview_cache', 'trip_list_cache', 'selected_trip', 'trip_budget_changes', 'trip_photos_cache', 'my_profile_cache'];
  const rows = async (db: Awaited<ReturnType<typeof store>>['db']) =>
    Promise.all(TABLES.map(async (table) => (await db.getFirstAsync<{ n: number }>(`select count(*) as n from ${table}`, []))?.n));

  it('the epoch closes the moment a clear is called, before it has issued anything, and opens as a new one when it has finished', async () => {
    const { local } = await store();
    const before = currentUserEpoch();
    expect(isEpochCurrent(before)).toBe(true);

    const clearing = local.clearUserData();
    const during = currentUserEpoch();
    expect(isEpochCurrent(before)).toBe(false);
    expect(isEpochCurrent(during)).toBe(false); // closed: an epoch captured now is refused too

    await clearing;
    const after = currentUserEpoch();
    expect(isEpochCurrent(after)).toBe(true);
    expect(isEpochCurrent(before)).toBe(false);
    expect(isEpochCurrent(during)).toBe(false);
  });

  it.each(WRITES)('%s with an epoch captured while the clear is running is refused (the epoch is closed until the clear is done)', async (_name, write) => {
    const { db: plain } = await store();
    const { db } = reorderingDb(plain, (sql) => (sql.startsWith('delete from my_profile_cache') ? 40 : 0));
    const local = createLocalStore(db);

    const clearing = local.clearUserData();
    const writing = write(local, currentUserEpoch()); // an operation of the previous user that starts after the clear was called
    await Promise.all([clearing, writing]);

    expect(await rows(plain)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('a clear that fails leaves the epoch closed: writes stay refused until a clear succeeds', async () => {
    const { db, local } = await store();
    const epoch = currentUserEpoch();
    const run = db.runAsync.bind(db);
    jest.spyOn(db, 'runAsync').mockImplementation((sql, params) =>
      sql.startsWith('delete from my_profile_cache') ? Promise.reject(new Error('disk full')) : run(sql, params),
    );
    await expect(local.clearUserData()).rejects.toThrow('disk full');
    jest.restoreAllMocks();

    await local.cacheProfile(profile, AT, epoch);
    await local.cacheOverview(overview, AT, currentUserEpoch());
    await local.cacheList(list, AT);
    expect(isEpochCurrent(currentUserEpoch())).toBe(false);
    expect(await rows(db)).toEqual([0, 0, 0, 0, 0, 0]);

    await local.clearUserData(); // the retry
    expect(isEpochCurrent(currentUserEpoch())).toBe(true);
    await local.cacheProfile(profile, AT, currentUserEpoch());
    await expect(local.cachedProfile()).resolves.toEqual(profile);
  });

  it('a second clear queued behind the first keeps the epoch closed until it has finished too', async () => {
    const { local } = await store();
    const first = local.clearUserData();
    const second = local.clearUserData();
    await first;
    expect(isEpochCurrent(currentUserEpoch())).toBe(false);
    await second;
    expect(isEpochCurrent(currentUserEpoch())).toBe(true);
  });

  it('on a signed-in launch (no clear ever called) the epoch is open from the start and writes work at once', async () => {
    let fresh: typeof import('@/data/local-store') | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fresh = require('@/data/local-store');
    });
    if (!fresh) throw new Error('local-store was not loaded');
    const { db } = await store();
    const local = fresh.createLocalStore(db);

    expect(fresh.isEpochCurrent(fresh.currentUserEpoch())).toBe(true);
    await local.cacheProfile(profile, AT, fresh.currentUserEpoch());
    await expect(local.cachedProfile()).resolves.toEqual(profile);
  });

  it.each(WRITES)('%s with the epoch of before the clear is dropped: no statement is issued, nothing is stored', async (_name, write) => {
    const { db, local } = await store();
    const epoch = currentUserEpoch();
    await local.clearUserData();
    const issued = jest.spyOn(db, 'runAsync');

    await write(local, epoch);

    expect(issued).not.toHaveBeenCalled();
    expect(await rows(db)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it.each(WRITES)('%s with the epoch of after the clear is stored (the next user is not blocked)', async (_name, write) => {
    const { db, local } = await store();
    await local.clearUserData();

    await write(local, currentUserEpoch());

    expect((await rows(db)).reduce((sum, n) => (sum ?? 0) + (n ?? 0), 0)).toBeGreaterThan(0);
  });

  it.each(WRITES)('%s without an epoch is stored (callers that are not in a longer operation)', async (_name, write) => {
    const { db, local } = await store();
    await write(local, undefined as never);
    expect((await rows(db)).reduce((sum, n) => (sum ?? 0) + (n ?? 0), 0)).toBeGreaterThan(0);
  });

  it('a stale list copy does not delete the next user\'s copies either (its clean-up deletes are dropped with it)', async () => {
    const { local } = await store();
    const epoch = currentUserEpoch();
    await local.clearUserData();
    await local.cacheOverview(overview, AT, currentUserEpoch());

    await local.cacheList([], AT, epoch);

    await expect(local.cachedOverview(TRIP_ID)).resolves.toEqual(overview);
  });

  it('a write issued while the clear runs is either wiped by it or refused: nothing stays', async () => {
    const { db, local } = await store();
    const epoch = currentUserEpoch();
    // Issued before the clear: ordered ahead of its `begin`, so the clear's deletes remove it.
    const early = local.cacheProfile(profile, AT, epoch);
    const clearing = local.clearUserData();
    // Issued between `begin` and `commit`: the epoch already moved, so it is refused.
    const late = local.cacheOverview(overview, AT, epoch);
    await Promise.all([early, clearing, late]);

    expect(await rows(db)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
