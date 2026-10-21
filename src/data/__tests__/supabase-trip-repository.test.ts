import { createClient } from '@supabase/supabase-js';

import { NotSignedInError } from '@/data/auth';
import type { Database } from '@/data/database.types';
import { FriendAlreadyAddedError, OwnFriendCodeError, UnknownFriendCodeError } from '@/data/errors';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/data/fetch-timeout';
import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore } from '@/data/local-store';
import { createSupabaseTripRepository } from '@/data/supabase-trip-repository';
import { buildTrip, type TripRepository } from '@/data/trip-repository';
import { toCreateTripArgs, type MemberRow, type PhotoRow, type SegmentRow, type TripRow } from '@/data/trip-rows';
import { photoPaths } from '@/lib/trip-photos';
import { CreateTripInputSchema, CurrentTripSchema, TripPhotoListSchema, type ShownTripPhoto, type TripPhoto } from '@/schemas';
import { fakeSignedUrl, fakeSupabase, NETWORK_FAILURE, SIGNED_IN_USER_ID, STORAGE_NETWORK_FAILURE, type FakeResponse } from '@/test/fake-supabase';
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
    // The stored rows: the server keeps no account for a friend without a code (friend-invite D12).
    trip_members: (args.members as Partial<MemberRow>[]).map((member) => ({ ...member, user_id: null })) as MemberRow[],
    flight_segments: args.segments as SegmentRow[],
  };
  return { row, trip: built.trip };
}

async function setup(extra: Partial<Parameters<typeof createSupabaseTripRepository>[0]> = {}) {
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
    ...extra,
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

  it('rejects with NotSignedInError when nobody is signed in, and sends nothing (auth-onboarding D2)', async () => {
    const { supabase, repository } = await setup();
    supabase.storedSession('none');
    await expect(repository.create(createTripInputFixture())).rejects.toBeInstanceOf(NotSignedInError);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.auth).not.toHaveProperty('signInAnonymously');
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

describe('create with friends found by code (friend-invite D12)', () => {
  const linkedInput = () => {
    const input = createTripInputFixture();
    input.friends.friends[0].friendCode = '5ZMRX8';
    return input;
  };

  it('sends friend_code per member and never a user_id', async () => {
    const { supabase, repository } = await setup();
    await repository.create(linkedInput());

    const [name, args] = supabase.rpc.mock.calls[0];
    expect(name).toBe('create_trip');
    const members = (args as { members: object[] }).members;
    expect(members).toEqual([
      expect.objectContaining({ display_name: 'Kasia', friend_code: '5ZMRX8' }),
      expect.objectContaining({ display_name: 'Ola', friend_code: null }),
    ]);
    members.forEach((member) => expect(member).not.toHaveProperty('user_id'));
  });

  it.each([
    ['its own code (FI001)', { message: 'cannot link yourself as a trip member', code: 'FI001' }, OwnFriendCodeError],
    ['an unknown code (FI002)', { message: 'no user has this friend code', code: 'FI002' }, UnknownFriendCodeError],
    [
      'the same friend twice (23505 on trip_members_trip_user_key)',
      {
        message: 'duplicate key value violates unique constraint "trip_members_trip_user_key"',
        code: '23505',
        details: 'Key (trip_id, user_id)=(a, b) already exists.',
      },
      FriendAlreadyAddedError,
    ],
  ])('rejects with a typed error when the server refuses %s, and keeps nothing on the device', async (_name, error, expected) => {
    const { supabase, local, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data: null, error, status: 400 });

    const rejection = repository.create(linkedInput());

    await expect(rejection).rejects.toBeInstanceOf(expected);
    await expect(rejection).rejects.toThrow(error.message);
    await expect(local.selectedTripId()).resolves.toBeNull();
    await expect(local.cachedList()).resolves.toBeNull();
  });

  it('leaves any other unique violation a plain error (not "friend already added")', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "trips_pkey"', code: '23505' },
      status: 409,
    });
    const rejection = repository.create(linkedInput());
    await expect(rejection).rejects.toThrow('trips_pkey');
    await expect(rejection).rejects.not.toBeInstanceOf(FriendAlreadyAddedError);
  });

  it('leaves other server errors as they are today', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'not allowed to link this member', code: '42501' }, status: 403 });
    const rejection = repository.create(linkedInput());
    await expect(rejection).rejects.toThrow('not allowed to link');
    await expect(rejection).rejects.not.toBeInstanceOf(OwnFriendCodeError);
    await expect(rejection).rejects.not.toBeInstanceOf(UnknownFriendCodeError);
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

describe('nobody is signed in (auth-onboarding D2)', () => {
  it.each([
    ['list', (r: TripRepository) => r.list()],
    ['current', (r: TripRepository) => r.current()],
    ['updateDetails', (r: TripRepository) => r.updateDetails(PAST_ID, { name: 'Lisbon', coverImageUri: STORED_COVER })],
    ['delete', (r: TripRepository) => r.delete(PAST_ID)],
    ['photos', (r: TripRepository) => r.photos(PAST_ID)],
  ])('%s rejects with NotSignedInError (not "unreachable", not the copy on the phone) and sends nothing', async (_name, call) => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row });
    await repository.current();
    supabase.storedSession('none');
    const queriesBefore = supabase.queries.length;

    await expect(call(repository)).rejects.toBeInstanceOf(NotSignedInError);
    expect(supabase.queries).toHaveLength(queriesBefore);
    expect(supabase.storageCalls).toEqual([]);
    await expect(local.cachedOverview(PAST_ID)).resolves.not.toBeNull();
  });
});

describe('list (trips-drawer D4)', () => {
  it('reads every trip with only the columns the side panel needs, and keeps a copy', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past()), listRow(ongoing())] });

    const list = await repository.list();

    expect(supabase.queries).toEqual([LIST_QUERY]);
    expect(list).toEqual([
      { id: PAST_ID, name: 'Lisbon', coverImageUri: 'preset:auckland', startDate: '2026-05-01', endDate: '2026-05-08' },
      { id: ONGOING_ID, name: 'Rome', coverImageUri: 'preset:auckland', startDate: '2026-10-01', endDate: '2026-10-07' },
    ]);
    expect(supabase.storageCalls).toEqual([]); // presets have nothing to sign
    await expect(local.cachedList()).resolves.toEqual(list);
  });

  it('shows the copy when Supabase cannot be reached', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past())] }, NETWORK_FAILURE);
    const online = await repository.list();
    await expect(repository.list()).resolves.toEqual(online);
  });

  it('shows the copy when reading the session fails for lack of connection', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(past())] });
    const online = await repository.list();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
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

  it('shows the copy when reading the session fails for lack of connection', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row });
    const online = await repository.current();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
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

describe("current: the organizer's nick for a linked member (friend-invite D4, A4)", () => {
  const ORGANIZER_ID = '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
  const NICK_ANSWER = { data: 'kacper.b', error: null, status: 200 };
  const sharedTrip = () => serverTrip({ id: PAST_ID, name: 'Lisbon', start_date: '2026-05-01', end_date: '2026-05-08', owner_id: ORGANIZER_ID });

  it('asks trip_organizer_username and sets organizerUsername when the trip belongs to someone else', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row });
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER);

    const current = await repository.current();

    expect(supabase.rpc.mock.calls).toEqual([['trip_organizer_username', { trip_id: PAST_ID }]]);
    expect(current?.overview.organizerUsername).toBe('kacper.b');
    expect(CurrentTripSchema.safeParse(current).success).toBe(true);
  });

  it('does not ask, and leaves the field out, when the signed-in user owns the trip', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: past().row });

    const current = await repository.current();

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(current?.overview).not.toHaveProperty('organizerUsername');
  });

  it('keeps the nick in the copy on the phone and shows it from there offline', async () => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row }, NETWORK_FAILURE);
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER);
    const online = await repository.current();

    await expect(local.cachedOverview(PAST_ID)).resolves.toEqual(expect.objectContaining({ organizerUsername: 'kacper.b' }));
    const offline = await repository.current();

    expect(offline).toEqual({ ...online, fromCache: true });
    expect(offline?.overview.organizerUsername).toBe('kacper.b');
    expect(supabase.rpc).toHaveBeenCalledTimes(1); // the offline read asks nothing more
  });

  it('asks nothing when the signed-in user is unknown for lack of connection (offline start): the copy is shown', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row });
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER);
    await repository.current();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });

    const offline = await repository.current();

    expect(offline?.fromCache).toBe(true);
    expect(offline?.overview.organizerUsername).toBe('kacper.b');
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('reads the nick for the default trip too', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', { data: [listRow(sharedTrip())] }, { data: sharedTrip().row });
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER);
    const current = await repository.current();
    expect(supabase.rpc.mock.calls).toEqual([['trip_organizer_username', { trip_id: PAST_ID }]]);
    expect(current?.overview.organizerUsername).toBe('kacper.b');
  });

  it.each([
    ['the server has no nick to give (null)', { data: null, error: null, status: 200 }],
    ['the server refuses the request', { data: null, error: { message: 'boom' }, status: 500 }],
    ['the answer is no valid nick', { data: 'A', error: null, status: 200 }],
  ])('still shows the trip, without the nick, when %s', async (_name, answer) => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row });
    supabase.rpc.mockResolvedValueOnce(answer);

    const current = await repository.current();

    expect(current?.fromCache).toBe(false);
    expect(current?.overview.trip.name).toBe('Lisbon');
    expect(current?.overview).not.toHaveProperty('organizerUsername');
  });

  // D15: a refresh whose organizer request gives nothing does not wipe the nick the phone already has.
  it.each([
    ['the server has no nick to give (null)', { data: null, error: null, status: 200 }],
    ['the server refuses the request', { data: null, error: { message: 'boom' }, status: 500 }],
    ['the answer is no valid nick', { data: 'A', error: null, status: 200 }],
  ])('keeps the nick of the copy, in the result and in the copy, when %s on a refresh (D15)', async (_name, answer) => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row }, { data: sharedTrip().row });
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER).mockResolvedValueOnce(answer);
    await repository.current();

    const refreshed = await repository.current();

    expect(refreshed?.fromCache).toBe(false);
    expect(refreshed?.overview.organizerUsername).toBe('kacper.b');
    await expect(local.cachedOverview(PAST_ID)).resolves.toEqual(expect.objectContaining({ organizerUsername: 'kacper.b' }));
  });

  it('replaces the nick of the copy when the server gives a new valid one (D15)', async () => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row }, { data: sharedTrip().row });
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER).mockResolvedValueOnce({ data: 'kacper.new', error: null, status: 200 });
    await repository.current();

    const refreshed = await repository.current();

    expect(refreshed?.overview.organizerUsername).toBe('kacper.new');
    await expect(local.cachedOverview(PAST_ID)).resolves.toEqual(expect.objectContaining({ organizerUsername: 'kacper.new' }));
  });

  it('does not carry a nick over to an owner: the owner path asks nothing and has no nick (D15)', async () => {
    const { supabase, local, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row }, { data: past().row });
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER);
    await repository.current();

    const refreshed = await repository.current();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(refreshed?.overview).not.toHaveProperty('organizerUsername');
    expect((await local.cachedOverview(PAST_ID))?.organizerUsername).toBeUndefined();
  });

  it('falls back to the copy, with its nick, when the nick request gets no answer although the trip loaded', async () => {
    const { supabase, repository } = await setup();
    await repository.select(PAST_ID);
    supabase.respond('trips', { data: sharedTrip().row }, { data: sharedTrip().row });
    supabase.rpc.mockResolvedValueOnce(NICK_ANSWER).mockResolvedValueOnce(NETWORK_FAILURE);
    await repository.current();

    const second = await repository.current();

    expect(second?.fromCache).toBe(true);
    expect(second?.overview.organizerUsername).toBe('kacper.b');
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

/** A gallery cover already stored for the trip: sending it again changes nothing in Storage (trip-covers). */
const STORED_COVER = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
/** The answer of the read of the trip's current cover that every updateDetails starts with. */
const currentCoverIs = (cover: string) => ({ data: { cover_image_uri: cover } });
const READ_CURRENT_COVER = {
  table: 'trips',
  ops: [['select', ['cover_image_uri']], ['eq', ['id', PAST_ID]], ['maybeSingle', []]],
};

describe('updateDetails (trip-edit-menu D5)', () => {
  it('signs in, then changes the name and cover of that trip on the server', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', currentCoverIs(STORED_COVER), { data: [{ id: PAST_ID }] });

    await repository.updateDetails(PAST_ID, { name: 'Lisbon 2026', coverImageUri: STORED_COVER });

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.queries).toEqual([
      READ_CURRENT_COVER,
      {
        table: 'trips',
        ops: [
          ['update', [{ name: 'Lisbon 2026', cover_image_uri: STORED_COVER }]],
          ['eq', ['id', PAST_ID]],
          ['select', ['id']],
        ],
      },
    ]);
    expect(supabase.storageCalls).toEqual([]);
  });

  it('trims the name', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', currentCoverIs(STORED_COVER), { data: [{ id: PAST_ID }] });
    await repository.updateDetails(PAST_ID, { name: '  Lisbon 2026  ', coverImageUri: STORED_COVER });
    expect(supabase.queries[1].ops[0]).toEqual(['update', [expect.objectContaining({ name: 'Lisbon 2026' })]]);
  });

  it('rejects input without a cover (a cover is required, trip-covers D1) before any network call', async () => {
    const { supabase, repository } = await setup();
    await expect(repository.updateDetails(PAST_ID, { name: 'Lisbon' } as never)).rejects.toMatchObject({ name: 'ZodError' });
    expect(supabase.queries).toHaveLength(0);
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['61 characters', 'x'.repeat(61)],
  ])('rejects a name that is %s with a validation error, and sends nothing', async (_label, name) => {
    const { supabase, repository } = await setup();
    await expect(repository.updateDetails(PAST_ID, { name, coverImageUri: STORED_COVER })).rejects.toMatchObject({ name: 'ZodError' });
    expect(supabase.queries).toHaveLength(0);
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it('rejects when the server changed no row (deleted elsewhere, or not the owner), never a silent success', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', currentCoverIs(STORED_COVER), { data: [] });
    await expect(repository.updateDetails(PAST_ID, { name: 'Lisbon', coverImageUri: STORED_COVER })).rejects.toThrow();
  });

  it('rejects with the server\'s message when it refuses', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trips', currentCoverIs(STORED_COVER), { error: { message: 'permission denied for table trips' }, status: 401 });
    await expect(repository.updateDetails(PAST_ID, { name: 'Lisbon', coverImageUri: STORED_COVER })).rejects.toThrow('permission denied');
  });

  it('offline: rejects as unreachable, and never writes to the phone', async () => {
    const { supabase, local, repository } = await setup();
    const lisbon = past();
    supabase.respond('trips', { data: lisbon.row }, { data: [listRow(lisbon)] }, NETWORK_FAILURE);
    await repository.select(PAST_ID);
    await repository.current();
    await repository.list();
    const listCopy = await local.cachedList();
    const overviewCopy = await local.cachedOverview(PAST_ID);
    expect(listCopy).toEqual([expect.objectContaining({ id: PAST_ID, name: 'Lisbon' })]);
    expect(overviewCopy).not.toBeNull();

    const rejected = repository.updateDetails(PAST_ID, { name: 'Lisbon 2026', coverImageUri: STORED_COVER });
    await expect(rejected).rejects.toThrow('Network request failed');
    await expect(rejected).rejects.toMatchObject({ constructor: expect.objectContaining({ name: 'ServerUnreachableError' }) });
    await expect(local.cachedList()).resolves.toEqual(listCopy);
    await expect(local.cachedOverview(PAST_ID)).resolves.toEqual(overviewCopy);
  });

  it('offline: reading the session fails for lack of connection, so it rejects as unreachable', async () => {
    const { supabase, repository } = await setup();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
    const rejected = repository.updateDetails(PAST_ID, { name: 'Lisbon', coverImageUri: STORED_COVER });
    await expect(rejected).rejects.toMatchObject({ constructor: expect.objectContaining({ name: 'ServerUnreachableError' }) });
    expect(supabase.queries).toHaveLength(0);
  });
});

describe('delete (trip-edit-menu D8, A5)', () => {
  /** Lisbon and Rome were both opened on this phone; Lisbon is chosen and both have a budget change waiting. */
  async function withTwoCopies() {
    const ctx = await setup();
    const lisbon = past();
    const rome = ongoing();
    ctx.supabase.respond('trips', { data: lisbon.row }, { data: rome.row }, { data: [listRow(lisbon), listRow(rome)] });
    await ctx.repository.select(PAST_ID);
    await ctx.repository.current();
    await ctx.repository.select(ONGOING_ID);
    await ctx.repository.current();
    await ctx.repository.list();
    await ctx.repository.select(PAST_ID);
    await ctx.repository.setBudget({ id: PAST_ID, baseCurrency: 'THB' }, 250000);
    await ctx.repository.setBudget({ id: ONGOING_ID, baseCurrency: 'THB' }, 260000);
    ctx.supabase.queries.length = 0;
    return ctx;
  }

  it('signs in, then deletes that trip on the server', async () => {
    const { supabase, repository } = await withTwoCopies();
    supabase.respond('trips', { data: [{ id: PAST_ID }] });

    await repository.delete(PAST_ID);

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.queries).toEqual([
      {
        table: 'trips',
        ops: [
          ['delete', []],
          ['eq', ['id', PAST_ID]],
          ['select', ['id']],
        ],
      },
    ]);
  });

  it('afterwards the phone has forgotten the trip: its copy, the choice, the budget change and its list entry', async () => {
    const { supabase, local, repository } = await withTwoCopies();
    supabase.respond('trips', { data: [{ id: PAST_ID }] });

    await repository.delete(PAST_ID);

    await expect(local.cachedOverview(PAST_ID)).resolves.toBeNull();
    await expect(local.selectedTripId()).resolves.toBeNull();
    await expect(local.budgetChange(PAST_ID)).resolves.toBeNull();
    await expect(local.cachedList()).resolves.toEqual([expect.objectContaining({ id: ONGOING_ID })]);
  });

  it('leaves the copies of the other trips alone', async () => {
    const { supabase, local, repository } = await withTwoCopies();
    supabase.respond('trips', { data: [{ id: PAST_ID }] });

    await repository.delete(PAST_ID);

    await expect(local.cachedOverview(ONGOING_ID)).resolves.toEqual(expect.objectContaining({ trip: expect.objectContaining({ id: ONGOING_ID }) }));
    await expect(local.budgetChange(ONGOING_ID)).resolves.not.toBeNull();
  });

  it('rejects with the server\'s message when it refuses, and keeps everything on the phone', async () => {
    const { supabase, local, repository } = await withTwoCopies();
    supabase.respond('trips', { error: { message: 'permission denied for table trips' }, status: 401 });

    await expect(repository.delete(PAST_ID)).rejects.toThrow('permission denied');

    await expect(local.cachedOverview(PAST_ID)).resolves.not.toBeNull();
    await expect(local.selectedTripId()).resolves.toBe(PAST_ID);
    await expect(local.budgetChange(PAST_ID)).resolves.not.toBeNull();
    await expect(local.cachedList()).resolves.toHaveLength(2);
  });

  it('offline: rejects as unreachable and keeps everything on the phone', async () => {
    const { supabase, local, repository } = await withTwoCopies();
    supabase.respond('trips', NETWORK_FAILURE);

    const rejected = repository.delete(PAST_ID);
    await expect(rejected).rejects.toThrow('Network request failed');
    await expect(rejected).rejects.toMatchObject({ constructor: expect.objectContaining({ name: 'ServerUnreachableError' }) });

    await expect(local.cachedOverview(PAST_ID)).resolves.not.toBeNull();
    await expect(local.selectedTripId()).resolves.toBe(PAST_ID);
  });

  // D13: this used to be one test, "rejects when the server deleted no row". A delete that finds the trip already
  // gone is now a success, so the case is split by what the follow-up visibility check says.
  describe('when the server deleted no row (D13)', () => {
    it('and the trip is gone: resolves, the phone forgets it, after a delete and then a visibility check', async () => {
      const { supabase, local, repository } = await withTwoCopies();
      supabase.respond('trips', { data: [] }, { data: null });

      await expect(repository.delete(PAST_ID)).resolves.toBeUndefined();

      expect(supabase.queries).toEqual([
        {
          table: 'trips',
          ops: [
            ['delete', []],
            ['eq', ['id', PAST_ID]],
            ['select', ['id']],
          ],
        },
        {
          table: 'trips',
          ops: [
            ['select', ['id']],
            ['eq', ['id', PAST_ID]],
            ['maybeSingle', []],
          ],
        },
      ]);
      await expect(local.cachedOverview(PAST_ID)).resolves.toBeNull();
      await expect(local.selectedTripId()).resolves.toBeNull();
      await expect(local.budgetChange(PAST_ID)).resolves.toBeNull();
      await expect(local.cachedList()).resolves.toEqual([expect.objectContaining({ id: ONGOING_ID })]);
    });

    it('and the trip is still visible (not the owner): rejects as not deletable, the copies stay', async () => {
      const { supabase, local, repository } = await withTwoCopies();
      supabase.respond('trips', { data: [] }, { data: { id: PAST_ID } });

      await expect(repository.delete(PAST_ID)).rejects.toThrow('trip-not-deletable');

      await expect(local.cachedOverview(PAST_ID)).resolves.not.toBeNull();
      await expect(local.selectedTripId()).resolves.toBe(PAST_ID);
      await expect(local.budgetChange(PAST_ID)).resolves.not.toBeNull();
      await expect(local.cachedList()).resolves.toHaveLength(2);
    });

    it('and the visibility check fails offline: rejects as unreachable, the copies stay', async () => {
      const { supabase, local, repository } = await withTwoCopies();
      supabase.respond('trips', { data: [] }, NETWORK_FAILURE);

      const rejected = repository.delete(PAST_ID);
      await expect(rejected).rejects.toThrow('Network request failed');
      await expect(rejected).rejects.toMatchObject({ constructor: expect.objectContaining({ name: 'ServerUnreachableError' }) });

      await expect(local.cachedOverview(PAST_ID)).resolves.not.toBeNull();
      await expect(local.selectedTripId()).resolves.toBe(PAST_ID);
      await expect(local.budgetChange(PAST_ID)).resolves.not.toBeNull();
      await expect(local.cachedList()).resolves.toHaveLength(2);
    });
  });
  // trip-photos P7: the trip's photos are personal, so none may stay on the server behind a deleted trip.
  describe("removes the trip's files from Storage before the trip (trip-photos P7)", () => {
    type Context = Awaited<ReturnType<typeof withTwoCopies>>;
    const fileNames = (count: number, from = 0) => Array.from({ length: count }, (_, i) => ({ name: `${String(from + i).padStart(4, '0')}.jpg` }));
    const folderPaths = (count: number, from = 0) => fileNames(count, from).map(({ name }) => `${PAST_ID}/${name}`);
    const calls = (supabase: Context['supabase'], method: 'list' | 'remove') => supabase.storageCalls.filter((call) => call.method === method);
    const tripDeletes = (supabase: Context['supabase']) => supabase.queries.filter((query) => query.table === 'trips');

    async function withFolder() {
      const ctx = await withTwoCopies();
      ctx.supabase.sequence.length = 0;
      ctx.supabase.auth.getSession.mockClear();
      return ctx;
    }

    function expectCopiesKept({ local }: Pick<Context, 'local'>) {
      return Promise.all([
        expect(local.cachedOverview(PAST_ID)).resolves.not.toBeNull(),
        expect(local.selectedTripId()).resolves.toBe(PAST_ID),
        expect(local.budgetChange(PAST_ID)).resolves.not.toBeNull(),
        expect(local.cachedList()).resolves.toHaveLength(2),
      ]);
    }

    it('lists the trip\'s folder, removes what is in it, and only then deletes the trip', async () => {
      const { supabase, repository } = await withFolder();
      const files = [`${photoUuid(1)}.jpg`, `${photoUuid(1)}_thumb.jpg`];
      supabase.respondStorage('list', { data: files.map((name) => ({ name })) });
      supabase.respond('trips', { data: [{ id: PAST_ID }] });

      await repository.delete(PAST_ID);

      // The last listing is the second look after the trip row is gone (below); it finds nothing here.
      expect(supabase.storageCalls).toEqual([
        { bucket: BUCKET, method: 'list', args: [PAST_ID, { limit: 1000, offset: 0 }] },
        { bucket: BUCKET, method: 'remove', args: [files.map((name) => `${PAST_ID}/${name}`)] },
        { bucket: BUCKET, method: 'list', args: [PAST_ID, { limit: 1000, offset: 0 }] },
      ]);
      expect(supabase.sequence).toEqual(['storage.list', 'storage.remove', 'from:trips', 'storage.list']);
    });

    it('an empty folder: nothing to remove, and the trip is deleted as before', async () => {
      const { supabase, repository } = await withFolder();
      supabase.respond('trips', { data: [{ id: PAST_ID }] });

      await repository.delete(PAST_ID);

      expect(calls(supabase, 'remove')).toEqual([]);
      expect(tripDeletes(supabase)).toHaveLength(1);
      // One listing before the trip row is deleted and one after it (the second look, below).
      expect(supabase.sequence).toEqual(['storage.list', 'from:trips', 'storage.list']);
    });

    it('reads the folder page by page while a page is full, then removes everything in chunks of at most 1000', async () => {
      const { supabase, repository } = await withFolder();
      supabase.respondStorage('list', { data: fileNames(1000) }, { data: fileNames(30, 1000) });
      supabase.respond('trips', { data: [{ id: PAST_ID }] });

      await repository.delete(PAST_ID);

      expect(supabase.storageCalls.slice(0, 4)).toEqual([
        { bucket: BUCKET, method: 'list', args: [PAST_ID, { limit: 1000, offset: 0 }] },
        { bucket: BUCKET, method: 'list', args: [PAST_ID, { limit: 1000, offset: 1000 }] },
        { bucket: BUCKET, method: 'remove', args: [folderPaths(1000)] },
        { bucket: BUCKET, method: 'remove', args: [folderPaths(30, 1000)] },
      ]);
      expect(supabase.sequence).toEqual(['storage.list', 'storage.list', 'storage.remove', 'storage.remove', 'from:trips', 'storage.list']);
    });

    it('a folder with exactly 1000 files takes one more page to know it is over', async () => {
      const { supabase, repository } = await withFolder();
      supabase.respondStorage('list', { data: fileNames(1000) });
      supabase.respond('trips', { data: [{ id: PAST_ID }] });

      await repository.delete(PAST_ID);

      // The first two listings are the folder (a full page, then an empty one); the third is the second look.
      expect(calls(supabase, 'list').map((call) => call.args[1])).toEqual([
        { limit: 1000, offset: 0 },
        { limit: 1000, offset: 1000 },
        { limit: 1000, offset: 0 },
      ]);
      expect(calls(supabase, 'remove').map((call) => call.args[0])).toEqual([folderPaths(1000)]);
    });

    const FAILURES: [string, (supabase: Context['supabase']) => void, string, string][] = [
      ['the server refuses to list', (s) => s.respondStorage('list', { error: { message: 'permission denied', status: 403 } }), 'permission denied', 'Error'],
      ['it is offline when listing', (s) => s.respondStorage('list', STORAGE_NETWORK_FAILURE), 'Network request failed', 'ServerUnreachableError'],
      [
        'the server refuses to remove',
        (s) => {
          s.respondStorage('list', { data: fileNames(3) });
          s.respondStorage('remove', { error: { message: 'boom', status: 500 } });
        },
        'boom',
        'Error',
      ],
      [
        'it is offline when removing',
        (s) => {
          s.respondStorage('list', { data: fileNames(3) });
          s.respondStorage('remove', STORAGE_NETWORK_FAILURE);
        },
        'Network request failed',
        'ServerUnreachableError',
      ],
    ];

    it.each(FAILURES)('when %s: rejects, the trip is not deleted, and the phone keeps everything', async (_label, queueFailure, message, errorName) => {
      const ctx = await withFolder();
      queueFailure(ctx.supabase);

      const rejected = ctx.repository.delete(PAST_ID);

      await expect(rejected).rejects.toThrow(message);
      await expect(rejected).rejects.toMatchObject({ constructor: expect.objectContaining({ name: errorName }) });
      expect(tripDeletes(ctx.supabase)).toEqual([]);
      await expectCopiesKept(ctx);
    });

    // An upload can land between the first listing and the row delete. Once the row is gone the Storage insert policy
    // refuses new uploads (it needs the trip), and the owner can still list and remove their files, so one more look closes it.
    describe('looks at the folder once more after the trip row is gone', () => {
      const expectCopiesForgotten = ({ local }: Pick<Context, 'local'>) =>
        Promise.all([
          expect(local.cachedOverview(PAST_ID)).resolves.toBeNull(),
          expect(local.selectedTripId()).resolves.toBeNull(),
          expect(local.budgetChange(PAST_ID)).resolves.toBeNull(),
          expect(local.cachedList()).resolves.toEqual([expect.objectContaining({ id: ONGOING_ID })]),
        ]);

      it('removes a file that was uploaded meanwhile', async () => {
        const { supabase, repository } = await withFolder();
        supabase.respondStorage('list', { data: [{ name: 'before.jpg' }] }, { data: [{ name: 'meanwhile.jpg' }] });
        supabase.respond('trips', { data: [{ id: PAST_ID }] });

        await repository.delete(PAST_ID);

        expect(supabase.sequence).toEqual(['storage.list', 'storage.remove', 'from:trips', 'storage.list', 'storage.remove']);
        expect(calls(supabase, 'remove').map((call) => call.args[0])).toEqual([[`${PAST_ID}/before.jpg`], [`${PAST_ID}/meanwhile.jpg`]]);
      });

      it('also when the server deleted no row because the trip is already gone', async () => {
        const { supabase, repository } = await withFolder();
        supabase.respondStorage('list', { data: [] }, { data: [{ name: 'meanwhile.jpg' }] });
        supabase.respond('trips', { data: [] }, { data: null });

        await repository.delete(PAST_ID);

        expect(supabase.sequence).toEqual(['storage.list', 'from:trips', 'from:trips', 'storage.list', 'storage.remove']);
        expect(calls(supabase, 'remove').map((call) => call.args[0])).toEqual([[`${PAST_ID}/meanwhile.jpg`]]);
      });

      const SECOND_LOOK_FAILURES: [string, (supabase: Context['supabase']) => void][] = [
        ['the server refuses to list', (s) => s.respondStorage('list', { data: [] }, { error: { message: 'permission denied', status: 403 } })],
        ['it is offline when listing', (s) => s.respondStorage('list', { data: [] }, STORAGE_NETWORK_FAILURE)],
        [
          'the server refuses to remove',
          (s) => {
            s.respondStorage('list', { data: [] }, { data: fileNames(2) });
            s.respondStorage('remove', { error: { message: 'boom', status: 500 } });
          },
        ],
        [
          'it is offline when removing',
          (s) => {
            s.respondStorage('list', { data: [] }, { data: fileNames(2) });
            s.respondStorage('remove', STORAGE_NETWORK_FAILURE);
          },
        ],
      ];

      it.each(SECOND_LOOK_FAILURES)('when %s: still resolves, because the trip is gone, and the phone forgets its copies', async (_label, queueFailure) => {
        const ctx = await withFolder();
        ctx.supabase.respond('trips', { data: [{ id: PAST_ID }] });
        queueFailure(ctx.supabase);

        await expect(ctx.repository.delete(PAST_ID)).resolves.toBeUndefined();

        await expectCopiesForgotten(ctx);
      });

      const TRIP_MAY_STILL_EXIST: [string, FakeResponse[], string][] = [
        ['the server refuses to delete the trip', [{ error: { message: 'permission denied for table trips' }, status: 401 }], 'permission denied'],
        ['it is offline when deleting the trip', [NETWORK_FAILURE], 'Network request failed'],
        ['the trip is still visible (not the owner)', [{ data: [] }, { data: { id: PAST_ID } }], 'trip-not-deletable'],
      ];

      it.each(TRIP_MAY_STILL_EXIST)('is skipped when %s: the trip may still exist, so its files are not touched again', async (_label, responses, message) => {
        const { supabase, repository } = await withFolder();
        supabase.respond('trips', ...responses);

        await expect(repository.delete(PAST_ID)).rejects.toThrow(message);

        expect(calls(supabase, 'list')).toHaveLength(1);
      });
    });

    it('afterwards the phone has forgotten the trip\'s photo copy too, and kept the other trips\'', async () => {
      const { supabase, local, repository } = await withFolder();
      supabase.respond('trip_photos', { data: [photoRow(1)] }, { data: [photoRow(2, { trip_id: ONGOING_ID })] });
      await repository.photos(PAST_ID);
      await repository.photos(ONGOING_ID);
      supabase.respond('trips', { data: [{ id: PAST_ID }] });

      await repository.delete(PAST_ID);

      await expect(local.cachedPhotos(PAST_ID)).resolves.toBeNull();
      await expect(local.cachedPhotos(ONGOING_ID)).resolves.not.toBeNull();
    });

    it('rejects an id that is not a lowercase UUID before any network call (it becomes a folder to empty)', async () => {
      const { supabase, repository } = await withFolder();
      await expect(repository.delete('')).rejects.toThrow();
      await expect(repository.delete('../other')).rejects.toThrow();
      // Storage paths are lowercase; a folder named with capitals would never match the trip's files.
      await expect(repository.delete(PAST_ID.toUpperCase())).rejects.toThrow();
      expect(supabase.auth.getSession).not.toHaveBeenCalled();
      expect(supabase.storageCalls).toEqual([]);
      expect(supabase.queries).toEqual([]);
    });
  });
});

const BUCKET = 'trip-photos';
const photoUuid = (n: number) => `5a1c0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const photoPathsOf = (n: number, tripId = PAST_ID) => photoPaths({ id: photoUuid(n), tripId });

/** A trip_photos row as PostgREST returns it. */
function photoRow(n: number, patch: Partial<PhotoRow> = {}): PhotoRow {
  return { id: photoUuid(n), trip_id: PAST_ID, taken_at: null, created_at: '2026-10-05T10:00:00+00:00', ...patch };
}

/** The same photo as the repository returns it, with the fake's signed urls. */
function shownPhoto(n: number, patch: Partial<ShownTripPhoto> = {}): ShownTripPhoto {
  const paths = photoPathsOf(n);
  return {
    id: photoUuid(n),
    tripId: PAST_ID,
    createdAt: '2026-10-05T10:00:00+00:00',
    url: fakeSignedUrl(BUCKET, paths.file),
    thumbnailUrl: fakeSignedUrl(BUCKET, paths.thumbnail),
    ...patch,
  };
}

/** One item of storage-js's `createSignedUrls` answer: a URL, or the per-item error for an object it cannot sign. */
const signedItem = (path: string) => ({ error: null, path, signedURL: `/object/sign/${BUCKET}/${path}`, signedUrl: fakeSignedUrl(BUCKET, path) });
const refusedItem = (path: string) => ({
  error: 'Either the object does not exist or you do not have access to it',
  path,
  signedURL: null,
  signedUrl: null,
});

/** One page of the photo rows: PostgREST answers at most `max_rows` (1000, supabase/config.toml), so the select pages. */
const photosQuery = (from: number) => ({
  table: 'trip_photos',
  ops: [
    ['select', ['*']],
    ['eq', ['trip_id', PAST_ID]],
    ['order', ['id']],
    ['range', [from, from + 999]],
  ],
});
const PHOTOS_QUERY = photosQuery(0);

describe('photos (trip-photos A2, D8, D10, D13)', () => {
  it('reads the rows of that trip, signs every file and thumbnail in one call for an hour, and returns the photos shown', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1), photoRow(2)] });

    const list = await repository.photos(PAST_ID);

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.queries).toEqual([PHOTOS_QUERY]);
    expect(supabase.storageCalls).toEqual([
      {
        bucket: BUCKET,
        method: 'createSignedUrls',
        args: [[photoPathsOf(1).file, photoPathsOf(2).file, photoPathsOf(1).thumbnail, photoPathsOf(2).thumbnail], 3600],
      },
    ]);
    expect(TripPhotoListSchema.safeParse(list).success).toBe(true);
    expect(list).toEqual([shownPhoto(1), shownPhoto(2)]);
  });

  it('sorts by date taken, oldest first, with undated photos last (D10, D13)', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', {
      data: [
        photoRow(3, { created_at: '2026-10-05T10:01:00+00:00' }),
        photoRow(1, { taken_at: '2026-10-14T18:03:00' }),
        photoRow(2, { taken_at: '2026-10-13T09:00:00' }),
      ],
    });

    const list = await repository.photos(PAST_ID);

    expect(list.map((photo) => photo.id)).toEqual([photoUuid(2), photoUuid(1), photoUuid(3)]);
    // PostgREST adds seconds to a timestamp without time zone; the date taken keeps its minute precision.
    expect(list[1].takenAt).toBe('2026-10-14T18:03');
    expect(list[2]).not.toHaveProperty('takenAt');
  });

  it("keeps the list as the phone's copy", async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1, { taken_at: '2026-10-14T18:03:00' }), photoRow(2)] });
    const list = await repository.photos(PAST_ID);
    await expect(local.cachedPhotos(PAST_ID)).resolves.toEqual(list);
  });

  it('with no photos returns an empty list without asking Storage to sign anything, and keeps that as the copy', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trip_photos', { data: [] });
    await expect(repository.photos(PAST_ID)).resolves.toEqual([]);
    expect(supabase.storageCalls).toEqual([]);
    await expect(local.cachedPhotos(PAST_ID)).resolves.toEqual([]);
  });

  const SECOND_PHOTO_ANSWERS: [string, () => unknown[]][] = [
    ['its file gets no url', () => [refusedItem(photoPathsOf(2).file), signedItem(photoPathsOf(2).thumbnail)]],
    ['its thumbnail gets no url', () => [signedItem(photoPathsOf(2).file), refusedItem(photoPathsOf(2).thumbnail)]],
    ['its thumbnail is missing from the answer', () => [signedItem(photoPathsOf(2).file)]],
  ];

  it.each(SECOND_PHOTO_ANSWERS)('leaves out a photo when %s, since it cannot be shown', async (_label, answerForSecond) => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1), photoRow(2)] });
    supabase.respondStorage('createSignedUrls', {
      data: [signedItem(photoPathsOf(1).file), signedItem(photoPathsOf(1).thumbnail), ...answerForSecond()],
    });

    const list = await repository.photos(PAST_ID);

    expect(list).toEqual([shownPhoto(1)]);
    await expect(local.cachedPhotos(PAST_ID)).resolves.toEqual([shownPhoto(1)]);
  });

  it('signs at most 1000 paths per call (the server refuses more), so a big trip needs more calls', async () => {
    const { supabase, repository } = await setup();
    const numbers = Array.from({ length: 501 }, (_, i) => i + 1);
    supabase.respond('trip_photos', { data: numbers.map((n) => photoRow(n)) });

    const list = await repository.photos(PAST_ID);

    const paths = [...numbers.map((n) => photoPathsOf(n).file), ...numbers.map((n) => photoPathsOf(n).thumbnail)];
    expect(supabase.storageCalls).toEqual([
      { bucket: BUCKET, method: 'createSignedUrls', args: [paths.slice(0, 1000), 3600] },
      { bucket: BUCKET, method: 'createSignedUrls', args: [paths.slice(1000), 3600] },
    ]);
    expect(list).toHaveLength(501);
  });

  it('pages the rows by id while a page is full (PostgREST caps an answer at 1000 rows, D7: no limit per trip)', async () => {
    const { supabase, local, repository } = await setup();
    const numbers = (count: number, from = 1) => Array.from({ length: count }, (_, i) => from + i);
    supabase.respond('trip_photos', { data: numbers(1000).map((n) => photoRow(n)) }, { data: numbers(5, 1001).map((n) => photoRow(n)) });

    const list = await repository.photos(PAST_ID);

    expect(supabase.queries).toEqual([photosQuery(0), photosQuery(1000)]);
    expect(list).toHaveLength(1005);
    expect(new Set(list.map((photo) => photo.id)).size).toBe(1005);
    // 2010 paths to sign: two full batches and the rest.
    expect(supabase.storageCalls.map((call) => (call.args[0] as string[]).length)).toEqual([1000, 1000, 10]);
    await expect(local.cachedPhotos(PAST_ID)).resolves.toEqual(list);
  });

  it('a page with fewer than 1000 rows is the last: one query', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: Array.from({ length: 999 }, (_, i) => photoRow(i + 1)) });
    await expect(repository.photos(PAST_ID)).resolves.toHaveLength(999);
    expect(supabase.queries).toEqual([photosQuery(0)]);
  });

  it('exactly 1000 rows takes one more (empty) page to know it is over', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: Array.from({ length: 1000 }, (_, i) => photoRow(i + 1)) }, { data: [] });
    await expect(repository.photos(PAST_ID)).resolves.toHaveLength(1000);
    expect(supabase.queries).toEqual([photosQuery(0), photosQuery(1000)]);
  });

  it("offline halfway through the pages: shows the phone's copy, never a partial list", async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] });
    const online = await repository.photos(PAST_ID);
    supabase.respond('trip_photos', { data: Array.from({ length: 1000 }, (_, i) => photoRow(i + 1)) }, NETWORK_FAILURE);

    await expect(repository.photos(PAST_ID)).resolves.toEqual(online);
    await expect(local.cachedPhotos(PAST_ID)).resolves.toEqual(online);
  });

  it("offline: shows the phone's copy when the database cannot be reached, without signing anything", async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] }, NETWORK_FAILURE);
    const online = await repository.photos(PAST_ID);
    const signed = supabase.storageCalls.length;

    await expect(repository.photos(PAST_ID)).resolves.toEqual(online);
    expect(supabase.storageCalls).toHaveLength(signed);
  });

  it("offline: shows the phone's copy when Storage cannot be reached", async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] }, { data: [photoRow(1), photoRow(2)] });
    const online = await repository.photos(PAST_ID);
    supabase.respondStorage('createSignedUrls', STORAGE_NETWORK_FAILURE);

    await expect(repository.photos(PAST_ID)).resolves.toEqual(online);
  });

  it("offline: shows the phone's copy when reading the session fails for lack of connection", async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] });
    const online = await repository.photos(PAST_ID);
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
    await expect(repository.photos(PAST_ID)).resolves.toEqual(online);
  });

  it("offline with no copy of this trip: rejects (another trip's copy does not count)", async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1, { trip_id: ONGOING_ID })] }, NETWORK_FAILURE);
    await repository.photos(ONGOING_ID);
    await expect(repository.photos(PAST_ID)).rejects.toThrow('Network request failed');
  });

  it('with Storage unreachable and no copy: rejects', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] });
    supabase.respondStorage('createSignedUrls', STORAGE_NETWORK_FAILURE);
    await expect(repository.photos(PAST_ID)).rejects.toThrow('Network request failed');
  });

  it('rejects on a database error instead of hiding it behind the copy', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] }, { error: { message: 'permission denied for table trip_photos' }, status: 401 });
    await repository.photos(PAST_ID);
    await expect(repository.photos(PAST_ID)).rejects.toThrow('permission denied');
  });

  it('rejects on a Storage error that is not a lost connection, instead of hiding it behind the copy', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] }, { data: [photoRow(1)] });
    await repository.photos(PAST_ID);
    supabase.respondStorage('createSignedUrls', { error: { message: 'Bucket not found', status: 404 } });
    await expect(repository.photos(PAST_ID)).rejects.toThrow('Bucket not found');
  });

  it('rejects a row that does not match the schema, signs nothing and keeps the old copy', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] }, { data: [photoRow(2, { id: 'not-a-uuid' })] });
    const online = await repository.photos(PAST_ID);
    const signed = supabase.storageCalls.length;

    await expect(repository.photos(PAST_ID)).rejects.toThrow();

    expect(supabase.storageCalls).toHaveLength(signed);
    await expect(local.cachedPhotos(PAST_ID)).resolves.toEqual(online);
  });

  it('rejects a signed url that is not http(s), also from the server', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [photoRow(1)] });
    supabase.respondStorage('createSignedUrls', {
      data: [{ ...signedItem(photoPathsOf(1).file), signedUrl: 'javascript:alert(1)' }, signedItem(photoPathsOf(1).thumbnail)],
    });
    await expect(repository.photos(PAST_ID)).rejects.toThrow();
  });

  it('rejects a trip id that is not a lowercase UUID before any network call (Storage paths are lowercase)', async () => {
    const { supabase, repository } = await setup();
    await expect(repository.photos('trip-1')).rejects.toThrow();
    await expect(repository.photos(PAST_ID.toUpperCase())).rejects.toThrow();
    expect(supabase.queries).toHaveLength(0);
    expect(supabase.storageCalls).toHaveLength(0);
  });
});

describe('addPhoto (trip-photos A5, D2, D7, D14)', () => {
  const PICKED = { uri: 'file:///gallery/IMG_1.jpg', takenAt: '2026-10-14T18:03' };
  const PREPARED = { file: new Uint8Array([1, 2, 3]), thumbnail: new Uint8Array([4, 5]), thumbnailUri: 'file:///cache/thumb-1.jpg' };
  const uploadCalls = (supabase: Awaited<ReturnType<typeof setup>>['supabase']) => supabase.storageCalls.filter((call) => call.method === 'upload');

  async function setupAdd() {
    const prepare = jest.fn(async (_uri: string) => PREPARED);
    const seed = jest.fn(async (_uri: string, _cacheKey: string) => {});
    const ctx = await setup({ preparePhoto: prepare, seedImageCache: seed });
    return { ...ctx, prepare, seed };
  }

  it('signs in, then prepares the picked photo', async () => {
    const { supabase, repository, prepare } = await setupAdd();
    await repository.addPhoto(PAST_ID, photoUuid(1), PICKED);
    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith('file:///gallery/IMG_1.jpg');
  });

  it('uploads the thumbnail, then the file, as JPEG that may overwrite (A5), and only then inserts the row', async () => {
    const { supabase, repository } = await setupAdd();
    await repository.addPhoto(PAST_ID, photoUuid(1), PICKED);

    expect(supabase.storageCalls).toEqual([
      { bucket: BUCKET, method: 'upload', args: [photoPathsOf(1).thumbnail, PREPARED.thumbnail, { contentType: 'image/jpeg', upsert: true }] },
      { bucket: BUCKET, method: 'upload', args: [photoPathsOf(1).file, PREPARED.file, { contentType: 'image/jpeg', upsert: true }] },
    ]);
    expect(supabase.sequence).toEqual(['storage.upload', 'storage.upload', 'from:trip_photos']);
  });

  it('inserts the row with its date taken and time added, ignoring an id that already exists (no update grant, A5)', async () => {
    const { supabase, repository } = await setupAdd();
    await repository.addPhoto(PAST_ID, photoUuid(1), PICKED);

    expect(supabase.queries).toEqual([
      {
        table: 'trip_photos',
        ops: [
          [
            'upsert',
            [
              { id: photoUuid(1), trip_id: PAST_ID, taken_at: '2026-10-14T18:03', created_at: NOW.toISOString() },
              { onConflict: 'id', ignoreDuplicates: true },
            ],
          ],
        ],
      },
    ]);
  });

  it('sends a null date taken for a photo without one', async () => {
    const { supabase, repository } = await setupAdd();
    await repository.addPhoto(PAST_ID, photoUuid(1), { uri: PICKED.uri });
    expect(supabase.queries[0].ops[0]).toEqual(['upsert', [expect.objectContaining({ taken_at: null }), expect.anything()]]);
  });

  it('seeds the image cache with the thumbnail under its Storage path, after the row is in', async () => {
    const { supabase, repository, seed } = await setupAdd();
    seed.mockImplementation(async () => void supabase.sequence.push('seed'));

    await repository.addPhoto(PAST_ID, photoUuid(1), PICKED);

    expect(seed).toHaveBeenCalledTimes(1);
    expect(seed).toHaveBeenCalledWith(PREPARED.thumbnailUri, photoPathsOf(1).thumbnail);
    expect(supabase.sequence.at(-1)).toBe('seed');
  });

  it('still resolves when seeding the image cache fails (it only saves a download)', async () => {
    const { repository, seed } = await setupAdd();
    seed.mockRejectedValueOnce(new Error('disk full'));
    await expect(repository.addPhoto(PAST_ID, photoUuid(1), PICKED)).resolves.toBeUndefined();
  });

  it('retrying the same photo sends the same paths and id (A5)', async () => {
    const { supabase, repository } = await setupAdd();
    await repository.addPhoto(PAST_ID, photoUuid(1), PICKED);
    await repository.addPhoto(PAST_ID, photoUuid(1), PICKED);

    const uploads = uploadCalls(supabase);
    expect(uploads).toHaveLength(4);
    expect(uploads.slice(0, 2).map((call) => call.args[0])).toEqual(uploads.slice(2).map((call) => call.args[0]));
    const [first, second] = supabase.queries;
    expect(first.ops[0][1]).toEqual(second.ops[0][1]);
  });

  it('an upload the server refuses rejects with its message, and no row is inserted', async () => {
    const { supabase, repository, seed } = await setupAdd();
    supabase.respondStorage('upload', { error: { message: 'new row violates row-level security policy', status: 403 } });

    await expect(repository.addPhoto(PAST_ID, photoUuid(1), PICKED)).rejects.toThrow('row-level security');

    expect(supabase.queries).toEqual([]);
    expect(uploadCalls(supabase)).toHaveLength(1);
    expect(seed).not.toHaveBeenCalled();
  });

  it('a failed file upload (after the thumbnail went) rejects and no row is inserted', async () => {
    const { supabase, repository, seed } = await setupAdd();
    supabase.respondStorage('upload', {}, { error: { message: 'The object exceeded the maximum allowed size', status: 413 } });

    await expect(repository.addPhoto(PAST_ID, photoUuid(1), PICKED)).rejects.toThrow('maximum allowed size');

    expect(uploadCalls(supabase)).toHaveLength(2);
    expect(supabase.queries).toEqual([]);
    expect(seed).not.toHaveBeenCalled();
  });

  it('offline during the upload: rejects as unreachable, and no row is inserted', async () => {
    const { supabase, repository } = await setupAdd();
    supabase.respondStorage('upload', STORAGE_NETWORK_FAILURE);

    const rejected = repository.addPhoto(PAST_ID, photoUuid(1), PICKED);
    await expect(rejected).rejects.toThrow('Network request failed');
    await expect(rejected).rejects.toMatchObject({ constructor: expect.objectContaining({ name: 'ServerUnreachableError' }) });
    expect(supabase.queries).toEqual([]);
  });

  it('offline when reading the session: rejects as unreachable before preparing or sending anything', async () => {
    const { supabase, repository, prepare } = await setupAdd();
    const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });

    await expect(repository.addPhoto(PAST_ID, photoUuid(1), PICKED)).rejects.toMatchObject({
      constructor: expect.objectContaining({ name: 'ServerUnreachableError' }),
    });
    expect(prepare).not.toHaveBeenCalled();
    expect(supabase.storageCalls).toEqual([]);
  });

  it('offline when inserting the row: rejects as unreachable, and the cache is not seeded', async () => {
    const { supabase, repository, seed } = await setupAdd();
    supabase.respond('trip_photos', NETWORK_FAILURE);

    await expect(repository.addPhoto(PAST_ID, photoUuid(1), PICKED)).rejects.toMatchObject({
      constructor: expect.objectContaining({ name: 'ServerUnreachableError' }),
    });
    expect(seed).not.toHaveBeenCalled();
  });

  it('a row the server refuses rejects with its message, and the cache is not seeded', async () => {
    const { supabase, repository, seed } = await setupAdd();
    supabase.respond('trip_photos', { error: { message: 'new row violates row-level security policy for table "trip_photos"' }, status: 403 });

    await expect(repository.addPhoto(PAST_ID, photoUuid(1), PICKED)).rejects.toThrow('row-level security');
    expect(seed).not.toHaveBeenCalled();
  });

  it('a photo that cannot be prepared rejects and sends nothing', async () => {
    const { supabase, repository, prepare } = await setupAdd();
    prepare.mockRejectedValueOnce(new Error('could not read the image'));

    await expect(repository.addPhoto(PAST_ID, photoUuid(1), PICKED)).rejects.toThrow('could not read the image');
    expect(supabase.storageCalls).toEqual([]);
    expect(supabase.queries).toEqual([]);
  });

  it.each([
    ['an empty uri', PAST_ID, photoUuid(1), { uri: '' }],
    ['a date taken with seconds', PAST_ID, photoUuid(1), { uri: PICKED.uri, takenAt: '2026-10-14T18:03:22' }],
    ['a photo id that is not a UUID', PAST_ID, '../photo', PICKED],
    ['a trip id that is not a UUID', 'trip-1', photoUuid(1), PICKED],
    ['a photo id in capitals (Storage paths are lowercase)', PAST_ID, photoUuid(1).toUpperCase(), PICKED],
    ['a trip id in capitals (Storage paths are lowercase)', PAST_ID.toUpperCase(), photoUuid(1), PICKED],
  ])('rejects %s before any network call', async (_label, tripId, photoId, picked) => {
    const { supabase, repository, prepare } = await setupAdd();
    await expect(repository.addPhoto(tripId, photoId, picked)).rejects.toThrow();
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(supabase.storageCalls).toEqual([]);
    expect(supabase.queries).toEqual([]);
  });
});

describe('deletePhoto (trip-photos R6)', () => {
  const photo: TripPhoto = { id: photoUuid(1), tripId: PAST_ID, createdAt: '2026-10-05T10:00:00+00:00' };
  // The row is matched by its trip too, so the row and the Storage folder that gets cleaned always agree.
  const DELETE_ROW = {
    table: 'trip_photos',
    ops: [
      ['delete', []],
      ['eq', ['id', photoUuid(1)]],
      ['eq', ['trip_id', PAST_ID]],
      ['select', ['id']],
    ],
  };
  const VISIBLE_CHECK = {
    table: 'trip_photos',
    ops: [
      ['select', ['id']],
      ['eq', ['id', photoUuid(1)]],
      ['eq', ['trip_id', PAST_ID]],
      ['maybeSingle', []],
    ],
  };
  const removeCalls = (supabase: Awaited<ReturnType<typeof setup>>['supabase']) => supabase.storageCalls.filter((call) => call.method === 'remove');

  it("signs in, deletes the row, then removes the photo's file and thumbnail", async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [{ id: photoUuid(1) }] });

    await repository.deletePhoto(shownPhoto(1));

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.queries).toEqual([DELETE_ROW]);
    expect(supabase.storageCalls).toEqual([{ bucket: BUCKET, method: 'remove', args: [[photoPathsOf(1).file, photoPathsOf(1).thumbnail]] }]);
    expect(supabase.sequence).toEqual(['from:trip_photos', 'storage.remove']);
  });

  it('when the server deleted no row and the photo is still visible (not the owner): rejects and removes no file', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [] }, { data: { id: photoUuid(1) } });

    await expect(repository.deletePhoto(photo)).rejects.toThrow('photo-not-deletable');

    expect(supabase.queries).toEqual([DELETE_ROW, VISIBLE_CHECK]);
    expect(removeCalls(supabase)).toEqual([]);
  });

  it('when the server deleted no row and the photo is gone: resolves and still removes the files (already deleted counts as deleted)', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [] }, { data: null });

    await expect(repository.deletePhoto(photo)).resolves.toBeUndefined();

    expect(supabase.queries).toEqual([DELETE_ROW, VISIBLE_CHECK]);
    expect(removeCalls(supabase)).toEqual([{ bucket: BUCKET, method: 'remove', args: [[photoPathsOf(1).file, photoPathsOf(1).thumbnail]] }]);
  });

  it('the visibility check failing offline rejects as unreachable and removes no file', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [] }, NETWORK_FAILURE);

    await expect(repository.deletePhoto(photo)).rejects.toMatchObject({ constructor: expect.objectContaining({ name: 'ServerUnreachableError' }) });
    expect(removeCalls(supabase)).toEqual([]);
  });

  it.each([
    ['the server refuses it', { error: { message: 'permission denied for table trip_photos' }, status: 401 }, 'permission denied', 'Error'],
    ['it is offline', NETWORK_FAILURE, 'Network request failed', 'ServerUnreachableError'],
  ])('when deleting the row fails because %s: rejects and removes no file', async (_label, response, message, errorName) => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', response);

    const rejected = repository.deletePhoto(photo);
    await expect(rejected).rejects.toThrow(message);
    await expect(rejected).rejects.toMatchObject({ constructor: expect.objectContaining({ name: errorName }) });
    expect(removeCalls(supabase)).toEqual([]);
  });

  it.each([
    ['the server refuses it', { error: { message: 'boom', status: 500 } }],
    ['it is offline', STORAGE_NETWORK_FAILURE],
  ])('still resolves when removing the files fails because %s: the photo is gone for the user, the files stay behind (R6)', async (_label, response) => {
    const { supabase, repository } = await setup();
    supabase.respond('trip_photos', { data: [{ id: photoUuid(1) }] });
    supabase.respondStorage('remove', response);

    await expect(repository.deletePhoto(photo)).resolves.toBeUndefined();
    expect(removeCalls(supabase)).toHaveLength(1);
  });

  it('rejects a photo whose ids are not lowercase UUIDs before any network call (they become Storage paths)', async () => {
    const { supabase, repository } = await setup();
    await expect(repository.deletePhoto({ ...photo, id: '../../other/file' })).rejects.toThrow();
    await expect(repository.deletePhoto({ ...photo, tripId: 'trip-1' })).rejects.toThrow();
    await expect(repository.deletePhoto({ ...photo, id: photoUuid(1).toUpperCase() })).rejects.toThrow();
    await expect(repository.deletePhoto({ ...photo, tripId: PAST_ID.toUpperCase() })).rejects.toThrow();
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    expect(supabase.queries).toEqual([]);
    expect(supabase.storageCalls).toEqual([]);
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

describe('covers (trip-covers D1, D4, D5)', () => {
  const PICKED_URI = 'file:///gallery/IMG_7.jpg';
  const PREPARED = { file: new Uint8Array([1, 2, 3]), thumbnail: new Uint8Array([4, 5]), thumbnailUri: 'file:///cache/cover-thumb.jpg' };
  const JPEG_UPLOAD = { contentType: 'image/jpeg', upsert: false };
  /** buildTrip takes the ids 1 to 6 (trip, two friends, three segments), so the cover is the 7th id of a create. */
  const CREATED_COVER_ID = '00000000-0000-4000-8000-000000000007';
  /** The first id an updateDetails draws. */
  const FIRST_COVER_ID = '00000000-0000-4000-8000-000000000001';
  const OLD_COVER_ID = '9a1c0000-0000-4000-8000-000000000001';
  const OLD_COVER = `photo:${OLD_COVER_ID}`;
  const paths = (id: string, tripId: string) => photoPaths({ id, tripId });
  const calls = (supabase: Awaited<ReturnType<typeof setup>>['supabase'], method: 'upload' | 'remove') =>
    supabase.storageCalls.filter((call) => call.method === method);
  const coverUpdate = (cover: string) => ({
    table: 'trips',
    ops: [['update', [{ cover_image_uri: cover }]], ['eq', ['id', '00000000-0000-4000-8000-000000000001']], ['select', ['id']]],
  });

  async function setupCovers(extra: Partial<Parameters<typeof createSupabaseTripRepository>[0]> = {}) {
    const prepare = jest.fn(async (_uri: string) => PREPARED);
    const ctx = await setup({ preparePhoto: prepare, ...extra });
    return { ...ctx, prepare };
  }

  async function createWith(repository: Awaited<ReturnType<typeof setup>>['repository'], coverImageUri: string) {
    const input = createTripInputFixture();
    input.details.coverImageUri = coverImageUri as never;
    return repository.create(input);
  }

  describe('create', () => {
    it('stores a preset as is and uploads nothing', async () => {
      const { supabase, repository, prepare } = await setupCovers();
      const trip = await createWith(repository, 'preset:bali');

      expect(trip.coverImageUri).toBe('preset:bali');
      expect(supabase.rpc.mock.calls[0][1]).toEqual(expect.objectContaining({ trip: expect.objectContaining({ cover_image_uri: 'preset:bali' }) }));
      expect(prepare).not.toHaveBeenCalled();
      expect(supabase.storageCalls).toEqual([]);
      expect(supabase.queries).toEqual([]);
    });

    it('a gallery photo: the trip is created on the default cover first, because the Storage rules need the trip', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', { data: [{ id: '00000000-0000-4000-8000-000000000001' }] });
      await createWith(repository, PICKED_URI);
      expect(supabase.rpc.mock.calls[0][1]).toEqual(expect.objectContaining({ trip: expect.objectContaining({ cover_image_uri: 'preset:auckland' }) }));
    });

    it('then prepares the photo, uploads thumbnail and file into the new trip\'s folder, and stores photo:<new id>', async () => {
      const { supabase, repository, prepare, local } = await setupCovers();
      supabase.respond('trips', { data: [{ id: '00000000-0000-4000-8000-000000000001' }] });

      const trip = await createWith(repository, PICKED_URI);

      const tripId = '00000000-0000-4000-8000-000000000001';
      const files = paths(CREATED_COVER_ID, tripId);
      expect(prepare).toHaveBeenCalledWith(PICKED_URI);
      expect(supabase.storageCalls).toEqual([
        { bucket: BUCKET, method: 'upload', args: [files.thumbnail, PREPARED.thumbnail, JPEG_UPLOAD] },
        { bucket: BUCKET, method: 'upload', args: [files.file, PREPARED.file, JPEG_UPLOAD] },
      ]);
      expect(supabase.queries).toEqual([coverUpdate(`photo:${CREATED_COVER_ID}`)]);
      expect(supabase.sequence).toEqual(['storage.upload', 'storage.upload', 'from:trips']);
      expect(trip.id).toBe(tripId);
      expect(trip.coverImageUri).toBe(`photo:${CREATED_COVER_ID}`);
      await expect(local.selectedTripId()).resolves.toBe(tripId);
    });

    describe('when the photo does not make it (Q1): the trip stays on the default cover and create still resolves', () => {
      const staysDefault = (trip: { coverImageUri: string }) => expect(trip.coverImageUri).toBe('preset:auckland');
      const cleaned = (supabase: Awaited<ReturnType<typeof setupCovers>>['supabase']) => {
        const files = paths(CREATED_COVER_ID, '00000000-0000-4000-8000-000000000001');
        expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[files.file, files.thumbnail]] }]);
      };

      it('the photo cannot be prepared: nothing is sent', async () => {
        const { supabase, repository, prepare } = await setupCovers();
        prepare.mockRejectedValueOnce(new Error('cannot read the photo'));
        const trip = await createWith(repository, PICKED_URI);
        staysDefault(trip);
        expect(supabase.storageCalls).toEqual([]);
        expect(supabase.queries).toEqual([]);
      });

      it('the thumbnail upload is refused: the trip row is not touched and any file is cleaned up', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respondStorage('upload', { error: { message: 'Payload too large', status: 413 } });
        const trip = await createWith(repository, PICKED_URI);
        staysDefault(trip);
        expect(supabase.queries).toEqual([]);
        cleaned(supabase);
      });

      it('the file upload fails after the thumbnail went: both paths are removed, best effort', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respondStorage('upload', {}, { error: { message: 'Bad gateway', status: 502 } });
        const trip = await createWith(repository, PICKED_URI);
        staysDefault(trip);
        expect(calls(supabase, 'upload')).toHaveLength(2);
        expect(supabase.queries).toEqual([]);
        cleaned(supabase);
      });

      it('offline during the upload', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respondStorage('upload', STORAGE_NETWORK_FAILURE);
        staysDefault(await createWith(repository, PICKED_URI));
        expect(supabase.queries).toEqual([]);
      });

      it('the trip update is refused: the uploaded files are removed', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respond('trips', { error: { message: 'permission denied for table trips' }, status: 401 });
        staysDefault(await createWith(repository, PICKED_URI));
        cleaned(supabase);
      });

      it('the trip update is unreachable: the uploaded files are kept', async () => {
        // The update may have been applied before the connection dropped, so the row may now point at these files.
        const { supabase, repository } = await setupCovers();
        supabase.respond('trips', NETWORK_FAILURE);
        staysDefault(await createWith(repository, PICKED_URI));
        expect(calls(supabase, 'remove')).toEqual([]);
      });

      it('the trip update changes no row: the uploaded files are removed', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respond('trips', { data: [] });
        staysDefault(await createWith(repository, PICKED_URI));
        cleaned(supabase);
      });

      it('a failing cleanup changes nothing for the caller', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respondStorage('upload', {}, { error: { message: 'Bad gateway', status: 502 } });
        supabase.respondStorage('remove', { error: { message: 'Bad gateway', status: 502 } });
        staysDefault(await createWith(repository, PICKED_URI));
      });

      it('an id that is not a lowercase UUID would make a path Storage refuses: nothing is sent', async () => {
        let n = 0;
        const newId = () => (++n === 7 ? 'AAAAAAAA-0000-4000-8000-000000000007' : `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
        const { supabase, repository, prepare } = await setupCovers({ newId });
        staysDefault(await createWith(repository, PICKED_URI));
        expect(prepare).not.toHaveBeenCalled();
        expect(supabase.storageCalls).toEqual([]);
      });

      it('the trip is still the chosen one', async () => {
        const { supabase, repository, local } = await setupCovers();
        supabase.respondStorage('upload', STORAGE_NETWORK_FAILURE);
        const trip = await createWith(repository, PICKED_URI);
        await expect(local.selectedTripId()).resolves.toBe(trip.id);
      });
    });

    it('a trip the server refuses is not created, and nothing is uploaded', async () => {
      const { supabase, repository, prepare } = await setupCovers();
      supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'new row violates row-level security policy' }, status: 403 });
      await expect(createWith(repository, PICKED_URI)).rejects.toThrow('row-level security');
      expect(prepare).not.toHaveBeenCalled();
      expect(supabase.storageCalls).toEqual([]);
    });
  });

  describe('updateDetails', () => {
    const oldCoverRow = (cover: string | null) => ({ data: cover === null ? null : { cover_image_uri: cover } });
    const readOldCover = {
      table: 'trips',
      ops: [['select', ['cover_image_uri']], ['eq', ['id', PAST_ID]], ['maybeSingle', []]],
    };
    const update = (cover: string) => ({
      table: 'trips',
      ops: [['update', [{ name: 'Lisbon', cover_image_uri: cover }]], ['eq', ['id', PAST_ID]], ['select', ['id']]],
    });
    const input = (coverImageUri: string) => ({ name: 'Lisbon', coverImageUri }) as Parameters<Awaited<ReturnType<typeof setup>>['repository']['updateDetails']>[1];

    it('a preset replacing a preset: the old cover is read, the new one stored, nothing uploaded or removed', async () => {
      const { supabase, repository, prepare } = await setupCovers();
      supabase.respond('trips', oldCoverRow('preset:auckland'), { data: [{ id: PAST_ID }] });

      await repository.updateDetails(PAST_ID, input('preset:bali'));

      expect(supabase.queries).toEqual([readOldCover, update('preset:bali')]);
      expect(prepare).not.toHaveBeenCalled();
      expect(supabase.storageCalls).toEqual([]);
    });

    it('a preset replacing a gallery cover: its two files are removed after the update', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), { data: [{ id: PAST_ID }] });

      await repository.updateDetails(PAST_ID, input('preset:bali'));

      const old = paths(OLD_COVER_ID, PAST_ID);
      expect(supabase.storageCalls).toEqual([{ bucket: BUCKET, method: 'remove', args: [[old.file, old.thumbnail]] }]);
      expect(supabase.sequence).toEqual(['from:trips', 'from:trips', 'storage.remove']);
    });

    it('a gallery cover equal to the stored one: read, then only the update; no upload, no removal', async () => {
      const { supabase, repository, prepare } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), { data: [{ id: PAST_ID }] });

      await repository.updateDetails(PAST_ID, input(OLD_COVER));

      expect(supabase.queries).toEqual([readOldCover, update(OLD_COVER)]);
      expect(prepare).not.toHaveBeenCalled();
      expect(supabase.storageCalls).toEqual([]);
    });

    describe('a gallery cover that is not the trip\'s stored cover is refused before anything is written', () => {
      const OTHER_COVER = 'photo:9a1c0000-0000-4000-8000-0000000000ff';

      it.each([
        ['another gallery cover (a stale or crafted value)', OLD_COVER, OTHER_COVER],
        ['a gallery cover on a trip that has a preset', 'preset:bali', OLD_COVER],
      ])('%s: rejects, writes nothing, uploads and removes nothing', async (_label, current, asked) => {
        const { supabase, repository, prepare } = await setupCovers();
        supabase.respond('trips', oldCoverRow(current));

        await expect(repository.updateDetails(PAST_ID, input(asked))).rejects.toThrow('cover-not-current');

        expect(supabase.queries).toEqual([readOldCover]);
        expect(supabase.storageCalls).toEqual([]);
        expect(prepare).not.toHaveBeenCalled();
      });

      it('a trip the server does not show rejects as not found', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respond('trips', oldCoverRow(null));
        await expect(repository.updateDetails(PAST_ID, input(OLD_COVER))).rejects.toThrow('trip-not-found');
        expect(supabase.queries).toEqual([readOldCover]);
      });

      it('reading the stored cover offline rejects as unreachable', async () => {
        const { supabase, repository } = await setupCovers();
        supabase.respond('trips', NETWORK_FAILURE);
        await expect(repository.updateDetails(PAST_ID, input(OLD_COVER))).rejects.toMatchObject({
          constructor: expect.objectContaining({ name: 'ServerUnreachableError' }),
        });
      });
    });

    it('a new gallery photo on a trip with a preset: prepared, uploaded, stored as photo:<new id>, nothing removed', async () => {
      const { supabase, repository, prepare } = await setupCovers();
      supabase.respond('trips', oldCoverRow('preset:auckland'), { data: [{ id: PAST_ID }] });

      await repository.updateDetails(PAST_ID, input(PICKED_URI));

      const files = paths(FIRST_COVER_ID, PAST_ID);
      expect(prepare).toHaveBeenCalledWith(PICKED_URI);
      expect(supabase.storageCalls).toEqual([
        { bucket: BUCKET, method: 'upload', args: [files.thumbnail, PREPARED.thumbnail, JPEG_UPLOAD] },
        { bucket: BUCKET, method: 'upload', args: [files.file, PREPARED.file, JPEG_UPLOAD] },
      ]);
      expect(supabase.queries).toEqual([readOldCover, update(`photo:${FIRST_COVER_ID}`)]);
    });

    it('a new gallery photo replacing a gallery cover: upload, then update, then the old two files go', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), { data: [{ id: PAST_ID }] });

      await repository.updateDetails(PAST_ID, input(PICKED_URI));

      const old = paths(OLD_COVER_ID, PAST_ID);
      expect(supabase.sequence).toEqual(['from:trips', 'storage.upload', 'storage.upload', 'from:trips', 'storage.remove']);
      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[old.file, old.thumbnail]] }]);
    });

    it('a failed removal of the old files does not reject: the cover is already changed', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), { data: [{ id: PAST_ID }] });
      supabase.respondStorage('remove', { error: { message: 'Bad gateway', status: 502 } });
      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).resolves.toBeUndefined();
    });

    it('a removal that cannot even reach Storage does not reject either', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), { data: [{ id: PAST_ID }] });
      supabase.respondStorage('remove', STORAGE_NETWORK_FAILURE);
      await expect(repository.updateDetails(PAST_ID, input('preset:bali'))).resolves.toBeUndefined();
    });

    it('an upload that fails rejects and changes nothing: no update, the old cover stays and its files are not removed', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER));
      supabase.respondStorage('upload', {}, { error: { message: 'Bad gateway', status: 502 } });

      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).rejects.toThrow('Bad gateway');

      expect(supabase.queries).toEqual([readOldCover]);
      const fresh = paths(FIRST_COVER_ID, PAST_ID);
      // Only what this attempt uploaded is cleaned up; the old cover's files are never touched.
      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[fresh.file, fresh.thumbnail]] }]);
    });

    it('offline during the upload rejects as unreachable', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow('preset:auckland'));
      supabase.respondStorage('upload', STORAGE_NETWORK_FAILURE);
      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).rejects.toMatchObject({
        constructor: expect.objectContaining({ name: 'ServerUnreachableError' }),
      });
    });

    it('a photo that cannot be prepared rejects and sends nothing', async () => {
      const { supabase, repository, prepare } = await setupCovers();
      supabase.respond('trips', oldCoverRow('preset:auckland'));
      prepare.mockRejectedValueOnce(new Error('cannot read the photo'));
      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).rejects.toThrow('cannot read the photo');
      expect(supabase.storageCalls).toEqual([]);
      expect(supabase.queries).toEqual([readOldCover]);
    });

    it('an update the server refuses after the upload rejects and removes the new files, not the old ones', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), { error: { message: 'permission denied for table trips' }, status: 401 });

      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).rejects.toThrow('permission denied');

      const fresh = paths(FIRST_COVER_ID, PAST_ID);
      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[fresh.file, fresh.thumbnail]] }]);
    });

    it('an update that is unreachable after the upload rejects as unreachable and removes no files', async () => {
      // The update may have been applied before the connection dropped, so the row may now point at the new files.
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), NETWORK_FAILURE);

      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).rejects.toMatchObject({
        constructor: expect.objectContaining({ name: 'ServerUnreachableError' }),
      });

      expect(calls(supabase, 'remove')).toEqual([]);
    });

    it('an update that changes no row after the upload rejects and removes the new files', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', oldCoverRow(OLD_COVER), { data: [] });

      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).rejects.toThrow('trip-not-found');

      const fresh = paths(FIRST_COVER_ID, PAST_ID);
      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[fresh.file, fresh.thumbnail]] }]);
    });

    it('a trip the server does not show rejects before anything is prepared or sent', async () => {
      const { supabase, repository, prepare } = await setupCovers();
      supabase.respond('trips', oldCoverRow(null));
      await expect(repository.updateDetails(PAST_ID, input(PICKED_URI))).rejects.toThrow('trip-not-found');
      expect(prepare).not.toHaveBeenCalled();
      expect(supabase.storageCalls).toEqual([]);
    });

    it('reading the old cover offline rejects as unreachable', async () => {
      const { repository, supabase } = await setupCovers();
      supabase.respond('trips', NETWORK_FAILURE);
      await expect(repository.updateDetails(PAST_ID, input('preset:bali'))).rejects.toMatchObject({
        constructor: expect.objectContaining({ name: 'ServerUnreachableError' }),
      });
    });

    it('a trip id that is not a lowercase UUID is refused before any network call (it becomes a folder)', async () => {
      const { supabase, repository } = await setupCovers();
      await expect(repository.updateDetails(PAST_ID.toUpperCase(), input(PICKED_URI))).rejects.toThrow();
      expect(supabase.queries).toEqual([]);
      expect(supabase.storageCalls).toEqual([]);
    });
  });

  describe('list and current sign gallery covers (D5)', () => {
    const COVER_A = '9a1c0000-0000-4000-8000-00000000000a';
    const COVER_B = '9a1c0000-0000-4000-8000-00000000000b';
    const withCover = (trip: ReturnType<typeof past>, cover: string) => ({ ...trip, row: { ...trip.row, cover_image_uri: cover } });
    const urlsOf = (id: string, tripId: string) => {
      const files = paths(id, tripId);
      return { url: fakeSignedUrl(BUCKET, files.file), thumbnailUrl: fakeSignedUrl(BUCKET, files.thumbnail) };
    };

    it('list: signs the file and thumbnail of every gallery cover in one call for an hour; presets get nothing', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', { data: [listRow(withCover(past(), `photo:${COVER_A}`)), listRow(ongoing()), listRow(withCover(later(), `photo:${COVER_B}`))] });

      const list = await repository.list();

      expect(supabase.storageCalls).toEqual([
        {
          bucket: BUCKET,
          method: 'createSignedUrls',
          args: [[paths(COVER_A, PAST_ID).file, paths(COVER_B, LATER_ID).file, paths(COVER_A, PAST_ID).thumbnail, paths(COVER_B, LATER_ID).thumbnail], 3600],
        },
      ]);
      expect(list).toEqual([
        expect.objectContaining({ id: PAST_ID, coverImageUri: `photo:${COVER_A}`, coverUrls: urlsOf(COVER_A, PAST_ID) }),
        expect.objectContaining({ id: ONGOING_ID, coverImageUri: 'preset:auckland' }),
        expect.objectContaining({ id: LATER_ID, coverImageUri: `photo:${COVER_B}`, coverUrls: urlsOf(COVER_B, LATER_ID) }),
      ]);
      expect(list[1]).not.toHaveProperty('coverUrls');
    });

    it('list: keeps the urls in the copy on the phone, which is what an offline start shows', async () => {
      const { supabase, local, repository } = await setupCovers();
      supabase.respond('trips', { data: [listRow(withCover(past(), `photo:${COVER_A}`))] }, NETWORK_FAILURE);
      const online = await repository.list();
      await expect(local.cachedList()).resolves.toEqual(online);
      await expect(repository.list()).resolves.toEqual(online);
    });

    it('list: with Storage unreachable it shows the copy', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', { data: [listRow(withCover(past(), `photo:${COVER_A}`))] }, { data: [listRow(withCover(past(), `photo:${COVER_A}`))] });
      const online = await repository.list();
      supabase.respondStorage('createSignedUrls', STORAGE_NETWORK_FAILURE);
      await expect(repository.list()).resolves.toEqual(online);
    });

    it('list: a cover Storage cannot sign shows no urls (the app falls back to the default preset) instead of failing the list', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', { data: [listRow(withCover(past(), `photo:${COVER_A}`))] });
      const files = paths(COVER_A, PAST_ID);
      supabase.respondStorage('createSignedUrls', { data: [refusedItem(files.file), signedItem(files.thumbnail)] });
      const [item] = await repository.list();
      expect(item).toEqual(expect.objectContaining({ id: PAST_ID, coverImageUri: `photo:${COVER_A}` }));
      expect(item).not.toHaveProperty('coverUrls');
    });

    it('list: a signed url that is not http(s) rejects, also from the server', async () => {
      const { supabase, repository } = await setupCovers();
      supabase.respond('trips', { data: [listRow(withCover(past(), `photo:${COVER_A}`))] });
      const files = paths(COVER_A, PAST_ID);
      supabase.respondStorage('createSignedUrls', {
        data: [{ ...signedItem(files.file), signedUrl: 'javascript:alert(1)' }, signedItem(files.thumbnail)],
      });
      await expect(repository.list()).rejects.toThrow();
    });

    it('list: signs at most 1000 paths per call', async () => {
      const { supabase, repository } = await setupCovers();
      const rows = Array.from({ length: 501 }, (_, i) => {
        const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
        return { ...listRow(withCover(past(), `photo:${COVER_A}`)), id };
      });
      supabase.respond('trips', { data: rows });
      const list = await repository.list();
      const signCalls = supabase.storageCalls.filter((call) => call.method === 'createSignedUrls');
      expect(signCalls.map((call) => (call.args[0] as string[]).length)).toEqual([1000, 2]);
      expect(list.every((item) => item.coverUrls !== undefined)).toBe(true);
    });

    it('current: signs the shown trip\'s gallery cover and keeps it in the trip\'s copy', async () => {
      const { supabase, local, repository } = await setupCovers();
      await repository.select(PAST_ID);
      supabase.respond('trips', { data: withCover(past(), `photo:${COVER_A}`).row });

      const current = await repository.current();

      expect(supabase.storageCalls).toEqual([
        { bucket: BUCKET, method: 'createSignedUrls', args: [[paths(COVER_A, PAST_ID).file, paths(COVER_A, PAST_ID).thumbnail], 3600] },
      ]);
      expect(current?.overview.trip).toEqual(expect.objectContaining({ coverImageUri: `photo:${COVER_A}`, coverUrls: urlsOf(COVER_A, PAST_ID) }));
      await expect(local.cachedOverview(PAST_ID)).resolves.toEqual(current?.overview);
    });

    it('current: a preset cover signs nothing', async () => {
      const { supabase, repository } = await setupCovers();
      await repository.select(PAST_ID);
      supabase.respond('trips', { data: past().row });
      const current = await repository.current();
      expect(supabase.storageCalls).toEqual([]);
      expect(current?.overview.trip.coverImageUri).toBe('preset:auckland');
      expect(current?.overview.trip).not.toHaveProperty('coverUrls');
    });

    it('current: offline it shows the copy with the urls it was saved with', async () => {
      const { supabase, repository } = await setupCovers();
      await repository.select(PAST_ID);
      supabase.respond('trips', { data: withCover(past(), `photo:${COVER_A}`).row }, NETWORK_FAILURE);
      const online = await repository.current();
      await expect(repository.current()).resolves.toEqual({ ...online, fromCache: true });
    });

    it('current: a trip row with a cover that is not a valid cover rejects (a device URI from before this feature)', async () => {
      const { supabase, repository } = await setupCovers();
      await repository.select(PAST_ID);
      supabase.respond('trips', { data: { ...past().row, cover_image_uri: 'file:///cache/old.jpg' } });
      await expect(repository.current()).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('a trip with a photo: cover loses <tripId>/<uuid>.jpg and <tripId>/<uuid>_thumb.jpg (the folder removal)', async () => {
      const { supabase, repository } = await setupCovers();
      const uuid = '9a1c0000-0000-4000-8000-000000000001';
      supabase.respondStorage('list', { data: [{ name: `${uuid}.jpg` }, { name: `${uuid}_thumb.jpg` }] });
      supabase.respond('trips', { data: [{ id: PAST_ID }] });

      await repository.delete(PAST_ID);

      expect(calls(supabase, 'remove')).toEqual([
        { bucket: BUCKET, method: 'remove', args: [[`${PAST_ID}/${uuid}.jpg`, `${PAST_ID}/${uuid}_thumb.jpg`]] },
      ]);
      expect(supabase.sequence.indexOf('storage.remove')).toBeLessThan(supabase.sequence.indexOf('from:trips'));
    });

    it('removes the cover files with the rest of the trip\'s folder (no separate step: they are in it)', async () => {
      const { supabase, repository } = await setupCovers();
      const cover = paths(OLD_COVER_ID, PAST_ID);
      const names = [cover.file, cover.thumbnail, photoPathsOf(1).file, photoPathsOf(1).thumbnail].map((path) => path.slice(PAST_ID.length + 1));
      supabase.respondStorage('list', { data: names.map((name) => ({ name })) });
      supabase.respond('trips', { data: [{ id: PAST_ID }] });

      await repository.delete(PAST_ID);

      expect(calls(supabase, 'remove')[0]).toEqual({
        bucket: BUCKET,
        method: 'remove',
        args: [[cover.file, cover.thumbnail, photoPathsOf(1).file, photoPathsOf(1).thumbnail]],
      });
      expect(supabase.sequence.indexOf('storage.remove')).toBeLessThan(supabase.sequence.indexOf('from:trips'));
    });
  });
});
