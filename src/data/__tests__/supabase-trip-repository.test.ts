import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/data/database.types';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/data/fetch-timeout';
import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore } from '@/data/local-store';
import { createSupabaseTripRepository } from '@/data/supabase-trip-repository';
import { buildTrip } from '@/data/trip-repository';
import { toCreateTripArgs, type MemberRow, type SegmentRow, type TripRow } from '@/data/trip-rows';
import { CreateTripInputSchema, CurrentTripSchema } from '@/schemas';
import { fakeSupabase, NETWORK_FAILURE, SIGNED_IN_USER_ID } from '@/test/fake-supabase';
import { createTripInputFixture } from '@/test/fixtures';
import { openTestDb } from '@/test/node-sqlite';

const NOW = new Date('2026-10-06T09:30:00.000Z');

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

/** A trip as Supabase returns it: a trips row with its members and segments embedded. */
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
    await expect(local.cachedList()).resolves.toBeNull();
    await expect(local.selectedTripId()).resolves.toBeNull();
  });

  it('makes the new trip the chosen one, so the home screen shows it (A3)', async () => {
    const { local, repository } = await setup();
    const trip = await repository.create(createTripInputFixture());
    await expect(local.selectedTripId()).resolves.toBe(trip.id);
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

/** A trip as the side panel's query returns it: only the listed columns. */
function listRow({ row }: ReturnType<typeof serverTrip>) {
  return { id: row.id, name: row.name, cover_image_uri: row.cover_image_uri, start_date: row.start_date, end_date: row.end_date };
}

const LIST_QUERY = {
  table: 'trips',
  ops: [
    ['select', ['id, name, cover_image_uri, start_date, end_date']],
    ['order', ['start_date']],
    ['order', ['created_at']],
  ],
};

function tripByIdQuery(id: string) {
  return {
    table: 'trips',
    ops: [
      ['select', ['*, trip_members(*), flight_segments(*)']],
      ['eq', ['id', id]],
      ['maybeSingle', []],
    ],
  };
}

// NOW is 2026-10-06: one trip already over, one going on, one later.
const PAST_ID = '00000000-0000-4000-8000-0000000000a1';
const ONGOING_ID = '00000000-0000-4000-8000-0000000000a2';
const LATER_ID = '00000000-0000-4000-8000-0000000000a3';
const past = () => serverTrip({ id: PAST_ID, name: 'Lisbon', start_date: '2026-05-01', end_date: '2026-05-08' });
const ongoing = () => serverTrip({ id: ONGOING_ID, name: 'Rome', start_date: '2026-10-01', end_date: '2026-10-07' });
const later = () => serverTrip({ id: LATER_ID, name: 'Bangkok', start_date: '2026-11-03', end_date: '2026-11-15' });

describe('list (trips-drawer D4)', () => {
  it('reads every trip with only the columns the side panel needs, and keeps a copy', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past()), listRow(ongoing())] });

    const list = await repository.list();

    expect(supabase.queries).toEqual([LIST_QUERY]);
    expect(list).toEqual([
      { id: PAST_ID, name: 'Lisbon', startDate: '2026-05-01', endDate: '2026-05-08' },
      { id: ONGOING_ID, name: 'Rome', startDate: '2026-10-01', endDate: '2026-10-07' },
    ]);
    await expect(local.cachedList()).resolves.toEqual(list);
  });

  it('shows the copy when Supabase cannot be reached', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past())] }, NETWORK_FAILURE);
    const online = await repository.list();
    await expect(repository.list()).resolves.toEqual(online);
  });

  it('shows the copy when signing in fails for lack of connection', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past())] });
    const online = await repository.list();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: null });
    supabase.auth.signInAnonymously.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
    await expect(repository.list()).resolves.toEqual(online);
  });

  it('rejects when Supabase cannot be reached and there is no copy', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', NETWORK_FAILURE);
    await expect(repository.list()).rejects.toThrow('Network request failed');
  });

  it('rejects on a server error instead of hiding it behind the copy', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past())] }, { error: { message: 'permission denied for table trips' }, status: 401 });
    await repository.list();
    await expect(repository.list()).rejects.toThrow('permission denied');
  });

  it('rejects a row that does not match the schema', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [{ ...listRow(past()), name: '' }] });
    await expect(repository.list()).rejects.toThrow();
  });
});

describe('current (trips-drawer D2, A1)', () => {
  it('with nothing chosen, shows the default trip: the ongoing one, not the oldest past one', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past()), listRow(ongoing()), listRow(later())] }, { data: ongoing().row });

    const current = await repository.current();

    expect(supabase.queries).toEqual([LIST_QUERY, tripByIdQuery(ONGOING_ID)]);
    expect(CurrentTripSchema.safeParse(current).success).toBe(true);
    expect(current?.overview.trip).toEqual(expect.objectContaining({ id: ONGOING_ID, name: 'Rome', travellerCount: 3 }));
    expect(current?.overview.members.map((m) => m.displayName)).toEqual(['Kasia', 'Ola']);
    expect(current?.overview.segments).toHaveLength(3);
    expect(current).toEqual(expect.objectContaining({ budgetSyncStatus: 'synced', fromCache: false }));
  });

  it('with only past trips, shows the most recently ended one', async () => {
    const { supabase, repository } = await setup();
    const older = serverTrip({ id: LATER_ID, name: 'Oslo', start_date: '2026-01-02', end_date: '2026-01-09' });
    supabase.respond('trips', { data: [listRow(older), listRow(past())] }, { data: past().row });
    await expect(repository.current()).resolves.toEqual(expect.objectContaining({ overview: expect.objectContaining({ trip: expect.objectContaining({ id: PAST_ID }) }) }));
    expect(supabase.queries[1]).toEqual(tripByIdQuery(PAST_ID));
  });

  it('shows the chosen trip, read by its id, and keeps a copy of it', async () => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row });

    const current = await repository.current();

    expect(supabase.queries).toEqual([tripByIdQuery(PAST_ID)]);
    expect(current?.overview.trip.name).toBe('Lisbon');
    await expect(local.cachedOverview(PAST_ID)).resolves.toEqual(current?.overview);
  });

  it('forgets a chosen trip that is gone and shows the default trip instead', async () => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: null }, { data: [listRow(later())] }, { data: later().row });

    const current = await repository.current();

    expect(supabase.queries).toEqual([tripByIdQuery(PAST_ID), LIST_QUERY, tripByIdQuery(LATER_ID)]);
    expect(current?.overview.trip.id).toBe(LATER_ID);
    await expect(local.selectedTripId()).resolves.toBeNull();
  });

  it('returns null with no trips at all; the empty list removes the copies (D5)', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trips', { data: [listRow(later())] }, { data: later().row }, { data: [] });
    await repository.current();
    await expect(local.cachedOverview(LATER_ID)).resolves.not.toBeNull();

    await expect(repository.current()).resolves.toBeNull();
    await expect(local.cachedList()).resolves.toEqual([]);
    await expect(local.cachedOverview(LATER_ID)).resolves.toBeNull();
  });

  it('offline: shows the copy of the chosen trip (D3)', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row }, NETWORK_FAILURE);
    const online = await repository.current();
    await expect(repository.current()).resolves.toEqual({ ...online, fromCache: true });
  });

  it('offline with nothing chosen: shows the default trip from the copy of the list', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past()), listRow(ongoing())] }, { data: ongoing().row }, NETWORK_FAILURE);
    const online = await repository.current();
    await expect(repository.current()).resolves.toEqual({ ...online, fromCache: true });
  });

  it('offline with an empty copy of the list: no trips, not an error (D5)', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [] }, NETWORK_FAILURE);
    await expect(repository.current()).resolves.toBeNull();
    await expect(repository.current()).resolves.toBeNull();
  });

  it('offline: a chosen trip gone from the last list read is forgotten; the default trip shows instead (D2, A1)', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trips', { data: later().row }, { data: past().row }, { data: [listRow(later())] }, NETWORK_FAILURE);
    // Both trips were opened on this phone, Lisbon last.
    await repository.select(LATER_ID);
    await repository.current();
    await repository.select(PAST_ID);
    await repository.current();
    // The side panel reads the list: Lisbon was deleted meanwhile.
    await repository.list();
    await expect(local.selectedTripId()).resolves.toBeNull();

    const offline = await repository.current();

    expect(offline?.fromCache).toBe(true);
    expect(offline?.overview.trip.id).toBe(LATER_ID);
  });

  it('offline: when the last trip is gone from the last list read, there are no trips, not an error (D5)', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row }, { data: [] }, NETWORK_FAILURE);
    await repository.current();
    await repository.list();
    await expect(repository.current()).resolves.toBeNull();
  });

  it('offline: a chosen trip never opened on this phone has no copy, so it rejects (A5)', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past()), listRow(ongoing())] }, { data: ongoing().row }, NETWORK_FAILURE);
    await repository.current();
    await repository.select(PAST_ID);
    await expect(repository.current()).rejects.toThrow('Network request failed');
  });

  it('shows the copy when signing in fails for lack of connection', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row });
    const online = await repository.current();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: null });
    supabase.auth.signInAnonymously.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
    await expect(repository.current()).resolves.toEqual({ ...online, fromCache: true });
  });

  it('rejects when Supabase cannot be reached and there is no copy', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', NETWORK_FAILURE);
    await expect(repository.current()).rejects.toThrow('Network request failed');
  });

  it('rejects on a server error instead of hiding it behind the copy', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row }, { error: { message: 'permission denied for table trips' }, status: 401 });
    await repository.current();
    await expect(repository.current()).rejects.toThrow('permission denied');
  });

  it('rejects a row that does not match the schema', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: serverTrip({ id: PAST_ID, budget_per_person_minor: 1.5 }).row });
    await expect(repository.current()).rejects.toThrow();
  });
});

describe('select (trips-drawer D2)', () => {
  it('remembers the chosen trip on the phone without touching the network', async () => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    expect(supabase.queries).toHaveLength(0);
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    await expect(local.selectedTripId()).resolves.toBe(PAST_ID);
  });

  it('rejects an id that is not a UUID', async () => {
    const { repository } = await setup();
    await expect(repository.select('trip-1')).rejects.toThrow();
  });
});

describe('budget changes (offline-first)', () => {
  /** The trip is the chosen one and has been read once, so every `current()` reads it by id. */
  async function withCurrent(changes: Partial<TripRow> = {}) {
    const ctx = await setup();
    const server = serverTrip(changes);
    await ctx.repository.select(server.trip.id);
    ctx.supabase.respond('trips', { data: server.row });
    await ctx.repository.current();
    return { ...ctx, trip: server.trip };
  }

  it('saves on the device without touching the network', async () => {
    const { supabase, local, repository, trip } = await withCurrent();
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
    const { repository, trip } = await withCurrent();
    await expect(repository.setBudget(trip, 0)).rejects.toThrow();
    await expect(repository.setBudget(trip, 12.5)).rejects.toThrow();
  });

  it('offline: the new amount shows right away as pending, also from the copy after a restart', async () => {
    const { supabase, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', NETWORK_FAILURE, NETWORK_FAILURE);
    await repository.syncBudgets();

    const current = await repository.current();
    expect(current?.fromCache).toBe(true);
    expect(current?.budgetSyncStatus).toBe('pending');
    expect(current?.overview.trip.budgetPerPerson).toEqual({ amountMinor: 250000, currency: 'THB' });
    expect(current?.overview.trip.budgetUpdatedAt).toBe(NOW.toISOString());
  });

  it('on reconnect: sends the change with last-write-wins and forgets it once the server has it', async () => {
    const { supabase, local, repository, trip } = await withCurrent();
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
    const { supabase, local, repository, trip } = await withCurrent();
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
    const { supabase, local, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { error: { message: 'new row violates check constraint' }, status: 400 });
    await repository.syncBudgets();

    await expect(local.budgetChange(trip.id)).resolves.toEqual(
      expect.objectContaining({ syncStatus: 'failed', syncError: 'new row violates check constraint', attempts: 1 }),
    );
    supabase.respond('trips', { data: serverTrip().row });
    await expect(repository.current()).resolves.toEqual(expect.objectContaining({ budgetSyncStatus: 'failed' }));
  });

  it('a trip the server no longer shows fails instead of silently dropping the change', async () => {
    const { supabase, local, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [] }, { data: null });
    await repository.syncBudgets();
    await expect(local.budgetChange(trip.id)).resolves.toEqual(expect.objectContaining({ syncStatus: 'failed', syncError: 'trip-not-found' }));
  });

  it('tells when to retry: after the backoff delay from the last attempt', async () => {
    const { supabase, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { error: { message: 'boom' }, status: 500 }, { error: { message: 'boom' }, status: 500 });
    await expect(repository.syncBudgets()).resolves.toEqual({ nextAttemptAt: new Date(NOW.getTime() + 1000) });
    await expect(repository.syncBudgets()).resolves.toEqual({ nextAttemptAt: new Date(NOW.getTime() + 2000) });
  });

  it('nothing to retry once everything is synced', async () => {
    const { supabase, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [{ id: trip.id }] });
    await expect(repository.syncBudgets()).resolves.toEqual({ nextAttemptAt: null });
  });

  it('a newer server budget wins over an older change on the device, and shows as synced', async () => {
    const { supabase, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: serverTrip({ budget_per_person_minor: 999900, budget_updated_at: '2026-10-07T00:00:00+00:00' }).row });
    const current = await repository.current();
    expect(current?.overview.trip.budgetPerPerson.amountMinor).toBe(999900);
    expect(current?.budgetSyncStatus).toBe('synced');
  });

  it('after a successful sync, going offline shows the new amount from the copy, as synced', async () => {
    const { supabase, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [{ id: trip.id }] });
    await repository.syncBudgets();
    supabase.respond('trips', NETWORK_FAILURE);
    const current = await repository.current();
    expect(current).toEqual(expect.objectContaining({ fromCache: true, budgetSyncStatus: 'synced' }));
    expect(current?.overview.trip.budgetPerPerson.amountMinor).toBe(250000);
  });

  it('runs one sync at a time, so a change is never sent twice in parallel', async () => {
    const { supabase, repository, trip } = await withCurrent();
    await repository.setBudget(trip, 250000);
    supabase.respond('trips', { data: [{ id: trip.id }] });
    await Promise.all([repository.syncBudgets(), repository.syncBudgets()]);
    expect(supabase.queries.filter((q) => q.ops[0]?.[0] === 'update')).toHaveLength(1);
  });
});

describe('a request that never answers (real Supabase client with the 20 s timeout, no network)', () => {
  type Answer = 'never' | (() => Response);

  /**
   * The real supabase-js client over a stub server: each request takes the next answer, 'never' = the server
   * stays silent (captive portal). Like a real fetch, a silent request rejects only when it is aborted.
   * The session is already stored, so no auth request is made.
   */
  async function setupStalled(answers: Answer[]) {
    const requests: string[] = [];
    const server = (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(`${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`);
      const answer = answers.shift() ?? 'never';
      if (answer !== 'never') return Promise.resolve(answer());
      return new Promise<Response>((_, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (init?.signal?.aborted) abort();
        init?.signal?.addEventListener('abort', abort);
      });
    };
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800, // 2100-01-01
      user: { id: SIGNED_IN_USER_ID, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' },
    };
    const stored = new Map([['test-session', JSON.stringify(session)]]);
    const supabase = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
      auth: {
        storageKey: 'test-session',
        storage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => void stored.set(key, value), removeItem: (key) => void stored.delete(key) },
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: { fetch: withTimeout(server, REQUEST_TIMEOUT_MS) },
    });
    const db = openTestDb();
    await migrateLocalDb(db);
    const local = createLocalStore(db);
    const repository = createSupabaseTripRepository({ supabase, local: Promise.resolve(local), now: () => NOW, newId: sequentialIds() });
    return { repository, local, requests };
  }

  const json = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('the home screen gets the copy on the device after 20 s instead of loading forever', async () => {
    const server = serverTrip();
    const { repository } = await setupStalled([json([listRow(server)]), json([server.row]), 'never']);
    const online = await repository.current();

    const stalled = repository.current();
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    await expect(stalled).resolves.toEqual({ ...online, fromCache: true });
  });

  it('a stalled budget sync ends as pending, and the next sync still runs and sends the change', async () => {
    const { row, trip } = serverTrip();
    const { repository, local, requests } = await setupStalled([json([row]), 'never', json([{ id: trip.id }])]);
    await repository.select(trip.id);
    await repository.current();
    await repository.setBudget(trip, 250000);
    const recordAttempt = jest.spyOn(local, 'recordBudgetAttempt');

    const first = repository.syncBudgets();
    const second = repository.syncBudgets();
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    await expect(first).resolves.toEqual({ nextAttemptAt: new Date(NOW.getTime() + 1000) });
    expect(recordAttempt).toHaveBeenCalledTimes(1);
    expect(recordAttempt).toHaveBeenCalledWith(expect.objectContaining({ tripId: trip.id }), { syncStatus: 'pending', at: NOW.toISOString() });
    await expect(second).resolves.toEqual({ nextAttemptAt: null });
    expect(requests.filter((r) => r === 'PATCH /rest/v1/trips')).toHaveLength(2);
    await expect(local.budgetChange(trip.id)).resolves.toBeNull();
  });
});
