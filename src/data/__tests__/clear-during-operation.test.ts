// auth-onboarding D2 / D14: a read or a save that started under user A must not put A's data on the phone after the clear
// that runs when A is gone. Each test holds an operation at its first await (reading the session), runs the clear, lets the
// operation finish, and looks at what is on the phone. Then user B opens the app offline and must find nothing of A.
import { AuthRetryableFetchError } from '@supabase/supabase-js';

import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore, startNewUserEpoch, type LocalStore } from '@/data/local-store';
import { createSupabaseProfileRepository } from '@/data/supabase-profile-repository';
import { createSupabaseTripRepository } from '@/data/supabase-trip-repository';
import { buildTrip } from '@/data/trip-repository';
import { toCreateTripArgs, type MemberRow, type PhotoRow, type SegmentRow, type TripRow } from '@/data/trip-rows';
import { CreateTripInputSchema } from '@/schemas';
import { fakeSupabase, SIGNED_IN_USER_ID } from '@/test/fake-supabase';
import { createTripInputFixture } from '@/test/fixtures';
import { openTestDb } from '@/test/node-sqlite';
import { reorderingDb } from '@/test/reordering-db';

const NOW = new Date('2026-10-18T10:00:00.000Z');
const TRIP_ID = '00000000-0000-4000-8000-0000000000a1';
const AVATAR_ID = '00000000-0000-4000-8000-000000000001';
const session = { user: { id: SIGNED_IN_USER_ID, is_anonymous: false } };

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function serverTrip() {
  const built = buildTrip(CreateTripInputSchema.parse(createTripInputFixture()), {
    now: new Date('2026-10-04T12:00:00.000Z'),
    newId: sequentialIds(),
    ownerId: SIGNED_IN_USER_ID,
  });
  const args = toCreateTripArgs(built);
  const row = {
    ...(args.trip as Omit<TripRow, 'owner_id'>),
    id: TRIP_ID,
    name: 'Rome',
    start_date: '2026-10-01',
    end_date: '2026-10-07',
    owner_id: SIGNED_IN_USER_ID,
    created_at: '2026-10-04T12:00:00+00:00',
    budget_updated_at: '2026-10-04T12:00:00+00:00',
    // The stored rows: the server keeps no account for a friend without a code (friend-invite D12).
    trip_members: (args.members as Partial<MemberRow>[]).map((member) => ({ ...member, user_id: null })) as MemberRow[],
    flight_segments: args.segments as SegmentRow[],
  };
  return { row, trip: { ...built.trip, id: TRIP_ID } };
}
const listRow = ({ row }: ReturnType<typeof serverTrip>) => ({
  id: row.id,
  name: row.name,
  cover_image_uri: row.cover_image_uri,
  destination: row.destination,
  start_date: row.start_date,
  end_date: row.end_date,
  flight_segments: row.flight_segments.map(({ from_iata, to_iata }) => ({ from_iata, to_iata })),
});
const photoRow = (): PhotoRow => ({
  id: '5a1c0000-0000-4000-8000-000000000001',
  trip_id: TRIP_ID,
  taken_at: null,
  created_at: '2026-10-05T10:00:00+00:00',
});
const profileRow = () => ({
  id: SIGNED_IN_USER_ID,
  username: 'kacper',
  friend_code: 'K7M2QX',
  interests: ['museums'],
  avatar_id: AVATAR_ID,
  created_at: '2026-10-18T10:00:00+00:00',
  updated_at: '2026-10-18T10:00:00+00:00',
});

async function setup(localStore?: Promise<LocalStore>, slowClear = false) {
  const supabase = fakeSupabase();
  const db = openTestDb();
  await migrateLocalDb(db);
  // With slowClear the last delete of the clear takes a while, so operations can start while the clear is running.
  const local = createLocalStore(slowClear ? reorderingDb(db, (sql) => (sql.startsWith('delete from my_profile_cache') ? 60 : 0)).db : db);
  const shared = localStore ?? Promise.resolve(local);
  const trips = createSupabaseTripRepository({ supabase: supabase.client, local: shared, now: () => NOW, newId: sequentialIds() });
  const profiles = createSupabaseProfileRepository({
    supabase: supabase.client,
    local: shared,
    now: () => NOW,
    newId: () => AVATAR_ID,
    seedImageCache: async () => {},
  });
  /** The next read of the session (every read, with allReads) waits until the returned function is called: the operation stands still at its first await. */
  function holdSession(allReads = false): () => void {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const answer = async () => {
      await held;
      return { data: { session }, error: null as Error | null };
    };
    if (allReads) supabase.auth.getSession.mockImplementation(answer);
    else supabase.auth.getSession.mockImplementationOnce(answer);
    return release;
  }
  /** User B opens the app without a connection: the session cannot be refreshed and nothing can be fetched. */
  function goOffline() {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
  }
  return { supabase, db, local, trips, profiles, holdSession, goOffline };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

/** Starts `operation`, which stands still at its first await; runs the clear; lets the operation finish. */
async function clearWhileRunning(ctx: Ctx, operation: () => Promise<unknown>) {
  const release = ctx.holdSession();
  const running = operation().catch(() => undefined);
  await ctx.local.clearUserData();
  release();
  await running;
}

describe('a read that finishes after the clear leaves nothing of the old user on the phone', () => {
  it('the trip list', async () => {
    const ctx = await setup();
    ctx.supabase.respond('trips', { data: [listRow(serverTrip())] });

    await clearWhileRunning(ctx, () => ctx.trips.list());

    await expect(ctx.local.cachedList()).resolves.toBeNull();
  });

  it('the current trip: its list copy, its overview copy, and the choice', async () => {
    const ctx = await setup();
    ctx.supabase.respond('trips', { data: [listRow(serverTrip())] }, { data: serverTrip().row });

    await clearWhileRunning(ctx, () => ctx.trips.current());

    await expect(ctx.local.cachedList()).resolves.toBeNull();
    await expect(ctx.local.cachedOverview(TRIP_ID)).resolves.toBeNull();
    await expect(ctx.local.selectedTripId()).resolves.toBeNull();
  });

  it('a chosen trip read by its id', async () => {
    const ctx = await setup();
    await ctx.trips.select(TRIP_ID);
    ctx.supabase.respond('trips', { data: serverTrip().row });

    await clearWhileRunning(ctx, () => ctx.trips.current());

    await expect(ctx.local.cachedOverview(TRIP_ID)).resolves.toBeNull();
  });

  it('the photos of a trip', async () => {
    const ctx = await setup();
    ctx.supabase.respond('trip_photos', { data: [photoRow()] });

    await clearWhileRunning(ctx, () => ctx.trips.photos(TRIP_ID));

    await expect(ctx.local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
  });

  it('the profile', async () => {
    const ctx = await setup();
    ctx.supabase.respond('profiles', { data: profileRow() });

    await clearWhileRunning(ctx, () => ctx.profiles.myProfile());

    await expect(ctx.local.cachedProfile()).resolves.toBeNull();
  });

  it('a profile that was being saved', async () => {
    const ctx = await setup();
    ctx.supabase.respond('profiles', { data: profileRow() });

    await clearWhileRunning(ctx, () => ctx.profiles.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: null }));

    await expect(ctx.local.cachedProfile()).resolves.toBeNull();
  });

  it('a trip that was being created: it is not chosen on the phone any more', async () => {
    const ctx = await setup();
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    ctx.supabase.rpc.mockImplementationOnce(async () => {
      await held;
      return { data: null, error: null, status: 204 };
    });

    const creating = ctx.trips.create(createTripInputFixture()).catch(() => undefined);
    await ctx.local.clearUserData();
    release();
    await creating;

    await expect(ctx.local.selectedTripId()).resolves.toBeNull();
  });

  it('a budget save that was waiting for the store: no row is left', async () => {
    let openStore = (_store: LocalStore) => {};
    const opening = new Promise<LocalStore>((resolve) => (openStore = resolve));
    const ctx = await setup(opening);
    const saving = ctx.trips.setBudget(serverTrip().trip, 250000).catch(() => undefined);
    // The save has started (its epoch is captured); the clear runs and finishes, and only then does the save get to write.
    await ctx.local.clearUserData();
    openStore(ctx.local);
    await saving;

    await expect(ctx.local.budgetChange(TRIP_ID)).resolves.toBeNull();
    await expect(ctx.local.unsyncedBudgetChanges()).resolves.toEqual([]);
  });

  it('a budget save that started after the clear is kept (the next user is not blocked)', async () => {
    const ctx = await setup();
    await ctx.local.clearUserData();

    await ctx.trips.setBudget(serverTrip().trip, 250000);

    await expect(ctx.local.budgetChange(TRIP_ID)).resolves.not.toBeNull();
  });

  it('a read that started after the sign-out began (the epoch moved) but before the clear ran is refused too', async () => {
    const ctx = await setup();
    ctx.supabase.respond('trips', { data: [listRow(serverTrip())] });
    startNewUserEpoch(); // what the session does the moment it starts to forget the user
    const release = ctx.holdSession();

    const running = ctx.trips.list().catch(() => undefined); // started in the gap, while the store for the clear is being opened
    await ctx.local.clearUserData();
    release();
    await running;

    await expect(ctx.local.cachedList()).resolves.toBeNull();
  });

  it('a read that started after the clear (the next user, after signed out) is kept', async () => {
    const ctx = await setup();
    startNewUserEpoch();
    await ctx.local.clearUserData();
    ctx.supabase.respond('trips', { data: [listRow(serverTrip())] });

    await ctx.trips.list();

    await expect(ctx.local.cachedList()).resolves.not.toBeNull();
  });
});

describe('an operation of the old user that starts while the clear is running (after it was called, before it finished)', () => {
  /** Calls the clear (slow), starts the old user's operation, lets both finish. */
  async function duringClear(operation: (ctx: Ctx) => Promise<unknown>, prepare: (ctx: Ctx) => void = () => {}) {
    const ctx = await setup(undefined, true);
    prepare(ctx);
    const clearing = ctx.local.clearUserData();
    const running = operation(ctx).catch(() => undefined);
    await Promise.all([clearing, running]);
    return ctx;
  }

  it('the trip list stores nothing', async () => {
    const ctx = await duringClear(
      (c) => c.trips.list(),
      (c) => c.supabase.respond('trips', { data: [listRow(serverTrip())] }),
    );
    await expect(ctx.local.cachedList()).resolves.toBeNull();
  });

  it('the current trip stores nothing', async () => {
    const ctx = await duringClear(
      (c) => c.trips.current(),
      (c) => c.supabase.respond('trips', { data: [listRow(serverTrip())] }, { data: serverTrip().row }),
    );
    await expect(ctx.local.cachedList()).resolves.toBeNull();
    await expect(ctx.local.cachedOverview(TRIP_ID)).resolves.toBeNull();
  });

  it('the photos store nothing', async () => {
    const ctx = await duringClear(
      (c) => c.trips.photos(TRIP_ID),
      (c) => c.supabase.respond('trip_photos', { data: [photoRow()] }),
    );
    await expect(ctx.local.cachedPhotos(TRIP_ID)).resolves.toBeNull();
  });

  it('the profile read stores nothing', async () => {
    const ctx = await duringClear(
      (c) => c.profiles.myProfile(),
      (c) => c.supabase.respond('profiles', { data: profileRow() }),
    );
    await expect(ctx.local.cachedProfile()).resolves.toBeNull();
  });

  it('a profile save stores nothing', async () => {
    const ctx = await duringClear(
      (c) => c.profiles.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: null }),
      (c) => c.supabase.respond('profiles', { data: profileRow() }),
    );
    await expect(ctx.local.cachedProfile()).resolves.toBeNull();
  });

  it('a budget save leaves no row', async () => {
    const ctx = await duringClear((c) => c.trips.setBudget(serverTrip().trip, 250000));
    await expect(ctx.local.budgetChange(TRIP_ID)).resolves.toBeNull();
  });

  it('the next user, after the clear has finished, is not blocked', async () => {
    const ctx = await duringClear(async () => {});
    ctx.supabase.respond('trips', { data: [listRow(serverTrip())] });

    await ctx.trips.list();
    await ctx.trips.setBudget(serverTrip().trip, 250000);

    await expect(ctx.local.cachedList()).resolves.not.toBeNull();
    await expect(ctx.local.budgetChange(TRIP_ID)).resolves.not.toBeNull();
  });
});

describe('every write the repositories make passes the epoch of its operation', () => {
  it('no call of a guarded store write is left without one (a write without an epoch is only for tests)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    const calls: string[] = [];
    for (const file of ['supabase-trip-repository.ts', 'supabase-profile-repository.ts']) {
      const source = fs.readFileSync(`${__dirname}/../${file}`, 'utf8');
      calls.push(...(source.match(/\.(cacheList|cacheOverview|cachePhotos|cacheProfile|selectTrip|saveBudgetChange)\([^\n]*\)/g) ?? []));
    }
    expect(calls.length).toBeGreaterThanOrEqual(7);
    expect(calls.filter((call) => !call.includes('epoch'))).toEqual([]);
  });
});

describe('then the next user opens the app offline and sees nothing of the old one', () => {
  it('no trip list, no current trip, no photos, no profile, no budget change', async () => {
    const ctx = await setup();
    ctx.supabase.respond('trips', { data: [listRow(serverTrip())] }, { data: [listRow(serverTrip())] }, { data: serverTrip().row });
    ctx.supabase.respond('trip_photos', { data: [photoRow()] });
    ctx.supabase.respond('profiles', { data: profileRow() });
    // All of these were started by the old user and finish after the clear.
    const release = ctx.holdSession(true);
    const running = [
      ctx.trips.list(),
      ctx.trips.current(),
      ctx.trips.photos(TRIP_ID),
      ctx.profiles.myProfile(),
      ctx.trips.setBudget(serverTrip().trip, 250000),
    ].map((operation) => operation.catch(() => undefined));
    await ctx.local.clearUserData();
    release();
    await Promise.all(running);

    ctx.goOffline();

    await expect(ctx.trips.list()).rejects.toThrow();
    await expect(ctx.trips.current()).rejects.toThrow();
    await expect(ctx.trips.photos(TRIP_ID)).rejects.toThrow();
    await expect(ctx.profiles.myProfile()).rejects.toThrow();
    await expect(ctx.local.budgetChange(TRIP_ID)).resolves.toBeNull();
  });
});
