import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore } from '@/data/local-store';
import { createSupabaseTripRepository } from '@/data/supabase-trip-repository';
import { buildTrip } from '@/data/trip-repository';
import { toCreateTripArgs, type MemberRow, type SegmentRow, type TripRow } from '@/data/trip-rows';
import { CreateTripInputSchema, NearestTripSchema } from '@/schemas';
import { fakeSupabase, NETWORK_FAILURE, SIGNED_IN_USER_ID } from '@/test/fake-supabase';
import { createTripInputFixture } from '@/test/fixtures';
import { openTestDb } from '@/test/node-sqlite';

const NOW = new Date('2026-10-06T09:30:00.000Z');

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

/** The nearest trip as Supabase returns it: a trips row with its members and segments embedded. */
function serverTrip(patch: Partial<TripRow> = {}) {
  const built = buildTrip(CreateTripInputSchema.parse(createTripInputFixture()), {
    now: new Date('2026-10-04T12:00:00.000Z'),
    newId: sequentialIds(),
    ownerId: SIGNED_IN_USER_ID,
  });
  const args = toCreateTripArgs(built);
  const row = {
    ...(args.trip as Omit<TripRow, 'owner_id'>),
    owner_id: SIGNED_IN_USER_ID,
    created_at: '2026-10-04T12:00:00+00:00',
    budget_updated_at: '2026-10-04T12:00:00+00:00',
    ...patch,
    trip_members: args.members as MemberRow[],
    flight_segments: args.segments as SegmentRow[],
  };
  return { row, trip: built.trip };
}

async function setup() {
  const supabase = fakeSupabase();
  const db = openTestDb();
  await migrateLocalDb(db);
  const local = createLocalStore(db);
  let now = NOW;
  const repository = createSupabaseTripRepository({
    supabase: supabase.client,
    local: Promise.resolve(local),
    now: () => now,
    newId: sequentialIds(),
  });
  return { supabase, local, repository, setNow: (next: Date) => (now = next) };
}

describe('create', () => {
  it('signs in, then sends the trip, its friends and flights in one create_trip call', async () => {
    const { supabase, repository } = await setup();
    const trip = await repository.create(createTripInputFixture());

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [name, args] = supabase.rpc.mock.calls[0];
    expect(name).toBe('create_trip');
    expect(args).toEqual(
      toCreateTripArgs(
        buildTrip(CreateTripInputSchema.parse(createTripInputFixture()), { now: NOW, newId: sequentialIds(), ownerId: SIGNED_IN_USER_ID }),
      ),
    );
    expect(trip).toEqual(expect.objectContaining({ ownerId: SIGNED_IN_USER_ID, name: 'Warsaw → Bangkok', budgetUpdatedAt: NOW.toISOString() }));
  });

  it('signs in anonymously on first launch', async () => {
    const { supabase, repository } = await setup();
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: null });
    await repository.create(createTripInputFixture());
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('rejects when the server refuses, and keeps nothing on the device', async () => {
    const { supabase, local, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'new row violates row-level security policy' }, status: 403 });
    await expect(repository.create(createTripInputFixture())).rejects.toThrow('row-level security');
    await expect(local.cachedNearest()).resolves.toBeNull();
  });

  it('rejects offline (creating a trip needs internet, A3)', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce(NETWORK_FAILURE);
    await expect(repository.create(createTripInputFixture())).rejects.toThrow();
  });

  it('rejects invalid wizard input before calling the server', async () => {
    const { supabase, repository } = await setup();
    const input = createTripInputFixture();
    input.details.name = '';
    await expect(repository.create(input)).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('nearest', () => {
  it('reads the soonest trip with its members and segments from Supabase', async () => {
    const { supabase, repository } = await setup();
    const { row, trip } = serverTrip();
    supabase.respond('trips', { data: [row] });

    const nearest = await repository.nearest();

    expect(supabase.queries[0]).toEqual({
      table: 'trips',
      ops: [
        ['select', ['*, trip_members(*), flight_segments(*)']],
        ['order', ['start_date']],
        ['order', ['created_at']],
        ['limit', [1]],
      ],
    });
    expect(NearestTripSchema.safeParse(nearest).success).toBe(true);
    expect(nearest?.overview.trip).toEqual(expect.objectContaining({ id: trip.id, name: trip.name, travellerCount: 3 }));
    expect(nearest?.overview.members.map((m) => m.displayName)).toEqual(['Kasia', 'Ola']);
    expect(nearest?.overview.segments).toHaveLength(3);
    expect(nearest).toEqual(expect.objectContaining({ budgetSyncStatus: 'synced', fromCache: false }));
  });

  it('returns null when there are no trips, and clears the copy', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trips', { data: [serverTrip().row] }, { data: [] });
    await repository.nearest();
    await expect(repository.nearest()).resolves.toBeNull();
    await expect(local.cachedNearest()).resolves.toBeNull();
  });

  it('keeps a copy in SQLite and shows it when Supabase cannot be reached (D6)', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [serverTrip().row] }, NETWORK_FAILURE);
    const online = await repository.nearest();
    const offline = await repository.nearest();
    expect(offline).toEqual({ ...online, fromCache: true });
  });

  it('shows the copy when signing in fails for lack of connection', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [serverTrip().row] });
    const online = await repository.nearest();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: null });
    supabase.auth.signInAnonymously.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
    await expect(repository.nearest()).resolves.toEqual({ ...online, fromCache: true });
  });

  it('rejects when Supabase cannot be reached and there is no copy', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', NETWORK_FAILURE);
    await expect(repository.nearest()).rejects.toThrow('Network request failed');
  });

  it('rejects on a server error instead of hiding it behind the copy', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [serverTrip().row] }, { error: { message: 'permission denied for table trips' }, status: 401 });
    await repository.nearest();
    await expect(repository.nearest()).rejects.toThrow('permission denied');
  });

  it('rejects a row that does not match the schema', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [serverTrip({ budget_per_person_minor: 1.5 }).row] });
    await expect(repository.nearest()).rejects.toThrow();
  });
});

describe('budget changes (offline-first)', () => {
  async function withNearest(changes: Partial<TripRow> = {}) {
    const ctx = await setup();
    const server = serverTrip(changes);
    ctx.supabase.respond('trips', { data: [server.row] });
    await ctx.repository.nearest();
    return { ...ctx, trip: server.trip };
  }

  it('saves on the device without touching the network', async () => {
    const { supabase, local, repository, trip } = await withNearest();
    const queriesBefore = supabase.queries.length;
    await repository.setBudget(trip, 250000);
    expect(supabase.queries).toHaveLength(queriesBefore);
    await expect(local.budgetChange(trip.id)).resolves.toEqual({
      tripId: trip.id,
      budgetPerPerson: { amountMinor: 250000, currency: 'THB' },
      updatedAt: NOW.toISOString(),
      syncStatus: 'pending',
      attempts: 0,
    });
  });

  it('uses the trip\'s base currency and rejects an amount that is not a positive whole number', async () => {
    const { repository, trip } = await withNearest();
    await expect(repository.setBudget(trip, 0)).rejects.toThrow();
    await expect(repository.setBudget(trip, 12.5)).rejects.toThrow();
  });

  it('offline: the new amount shows right away as pending, also from the copy after a restart', async () => {
    const { supabase, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', NETWORK_FAILURE, NETWORK_FAILURE);
    await repository.syncBudgets();

    const nearest = await repository.nearest();
    expect(nearest?.fromCache).toBe(true);
    expect(nearest?.budgetSyncStatus).toBe('pending');
    expect(nearest?.overview.trip.budgetPerPerson).toEqual({ amountMinor: 250000, currency: 'THB' });
    expect(nearest?.overview.trip.budgetUpdatedAt).toBe(NOW.toISOString());
  });

  it('on reconnect: sends the change with last-write-wins and forgets it once the server has it', async () => {
    const { supabase, local, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [{ id: trip.id }] });

    await repository.syncBudgets();

    expect(supabase.queries.at(-1)).toEqual({
      table: 'trips',
      ops: [
        ['update', [{ budget_per_person_minor: 250000, budget_updated_at: NOW.toISOString() }]],
        ['eq', ['id', trip.id]],
        ['lt', ['budget_updated_at', NOW.toISOString()]],
        ['select', ['id']],
      ],
    });
    await expect(local.budgetChange(trip.id)).resolves.toBeNull();
  });

  it('retrying the same change never duplicates anything: the server already having it counts as synced', async () => {
    const { supabase, local, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    // First send: the response is lost.
    supabase.respond('trips', NETWORK_FAILURE);
    await repository.syncBudgets();
    // Retry: nothing to update any more (the filter matches no row), and the server's copy is this change.
    supabase.respond('trips', { data: [] }, { data: { budget_updated_at: '2026-10-06T09:30:00+00:00' } });
    await repository.syncBudgets();

    const updates = supabase.queries.filter((q) => q.ops[0]?.[0] === 'update');
    expect(updates).toHaveLength(2);
    expect(updates[0]).toEqual(updates[1]);
    await expect(local.budgetChange(trip.id)).resolves.toBeNull();
  });

  it('a change the server refuses stays visible as failed, with its error', async () => {
    const { supabase, local, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { error: { message: 'new row violates check constraint' }, status: 400 });
    await repository.syncBudgets();

    await expect(local.budgetChange(trip.id)).resolves.toEqual(
      expect.objectContaining({ syncStatus: 'failed', syncError: 'new row violates check constraint', attempts: 1 }),
    );
    supabase.respond('trips', { data: [serverTrip().row] });
    await expect(repository.nearest()).resolves.toEqual(expect.objectContaining({ budgetSyncStatus: 'failed' }));
  });

  it('a trip the server no longer shows fails instead of silently dropping the change', async () => {
    const { supabase, local, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [] }, { data: null });
    await repository.syncBudgets();
    await expect(local.budgetChange(trip.id)).resolves.toEqual(expect.objectContaining({ syncStatus: 'failed', syncError: 'trip-not-found' }));
  });

  it('tells when to retry: after the backoff delay from the last attempt', async () => {
    const { supabase, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { error: { message: 'boom' }, status: 500 }, { error: { message: 'boom' }, status: 500 });
    await expect(repository.syncBudgets()).resolves.toEqual({ nextAttemptAt: new Date(NOW.getTime() + 1000) });
    await expect(repository.syncBudgets()).resolves.toEqual({ nextAttemptAt: new Date(NOW.getTime() + 2000) });
  });

  it('nothing to retry once everything is synced', async () => {
    const { supabase, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [{ id: trip.id }] });
    await expect(repository.syncBudgets()).resolves.toEqual({ nextAttemptAt: null });
  });

  it('a newer server budget wins over an older change on the device, and shows as synced', async () => {
    const { supabase, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [serverTrip({ budget_per_person_minor: 999900, budget_updated_at: '2026-10-07T00:00:00+00:00' }).row] });
    const nearest = await repository.nearest();
    expect(nearest?.overview.trip.budgetPerPerson.amountMinor).toBe(999900);
    expect(nearest?.budgetSyncStatus).toBe('synced');
  });

  it('after a successful sync, going offline shows the new amount from the copy, as synced', async () => {
    const { supabase, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [{ id: trip.id }] });
    await repository.syncBudgets();
    supabase.respond('trips', NETWORK_FAILURE);
    const nearest = await repository.nearest();
    expect(nearest).toEqual(expect.objectContaining({ fromCache: true, budgetSyncStatus: 'synced' }));
    expect(nearest?.overview.trip.budgetPerPerson.amountMinor).toBe(250000);
  });

  it('runs one sync at a time, so a change is never sent twice in parallel', async () => {
    const { supabase, repository, trip } = await withNearest();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [{ id: trip.id }] });
    await Promise.all([repository.syncBudgets(), repository.syncBudgets()]);
    expect(supabase.queries.filter((q) => q.ops[0]?.[0] === 'update')).toHaveLength(1);
  });
});
