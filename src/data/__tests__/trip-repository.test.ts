import { FriendAlreadyAddedError, OwnFriendCodeError, UnknownFriendCodeError } from '@/data/errors';
import { buildTrip, createInMemoryTripRepository, LOCAL_OWNER_ID } from '@/data/trip-repository';
import {
  CreateTripInputSchema,
  CurrentTripSchema,
  FlightSegmentSchema,
  TripMemberSchema,
  TripListSchema,
  TripPhotoListSchema,
  TripSchema,
  TripSummarySchema,
} from '@/schemas';
import { createTripInputFixture } from '@/test/fixtures';

const NOW = new Date('2026-10-04T12:00:00Z');
const OWNER_ID = '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d';

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function build(patch: (input: ReturnType<typeof createTripInputFixture>) => void = () => {}) {
  const input = createTripInputFixture();
  patch(input);
  return buildTrip(CreateTripInputSchema.parse(input), { now: NOW, newId: sequentialIds(), ownerId: OWNER_ID });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('buildTrip', () => {
  it('builds a trip with the organizer\'s name, dates and budget from the wizard', () => {
    const { trip } = build();
    expect(trip).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      ownerId: OWNER_ID,
      name: 'Warsaw → Bangkok',
      coverImageUri: 'preset:auckland',
      destination: 'BKK',
      startDate: '2026-11-03',
      endDate: '2026-11-15',
      baseCurrency: 'THB',
      budgetPerPerson: { amountMinor: 3000000, currency: 'THB' },
      createdAt: '2026-10-04T12:00:00.000Z',
      budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
    });
    expect(TripSchema.safeParse(trip).success).toBe(true);
  });

  it('trims the name', () => {
    const { trip } = build((input) => {
      input.details.name = '  Tajlandia z ekipą  ';
    });
    expect(trip.name).toBe('Tajlandia z ekipą');
  });

  it('keeps a preset or a stored gallery cover as chosen', () => {
    const preset = build((input) => {
      input.details.coverImageUri = 'preset:bali';
    });
    expect(preset.trip.coverImageUri).toBe('preset:bali');
    const stored = build((input) => {
      input.details.coverImageUri = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    });
    expect(stored.trip.coverImageUri).toBe('photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c');
  });

  it('starts a trip whose gallery photo is not sent yet on the default cover (the photo needs the trip first, trip-covers Q1)', () => {
    const { trip } = build((input) => {
      input.details.coverImageUri = 'file:///cache/cover.jpg';
    });
    expect(trip.coverImageUri).toBe('preset:auckland');
  });

  it('turns friends into members without an account', () => {
    const { trip, members } = build();
    expect(members).toEqual([
      expect.objectContaining({ tripId: trip.id, userId: null, displayName: 'Kasia', role: 'viewer', interests: ['beaches', 'nightlife'] }),
      expect.objectContaining({ tripId: trip.id, userId: null, displayName: 'Ola', role: 'viewer', interests: [] }),
    ]);
    members.forEach((member) => expect(TripMemberSchema.safeParse(member).success).toBe(true));
  });

  it('keeps no account on a friend found by code (the server resolves the code), and carries the code by member id (friend-invite D12)', () => {
    const { members, friendCodes } = build((input) => {
      input.friends.friends[1].friendCode = '5ZMRX8';
    });
    members.forEach((member) => expect(member.userId).toBeNull());
    expect(friendCodes).toEqual({ [members[1].id]: '5ZMRX8' });
  });

  it('carries no friend code when no friend was found by code', () => {
    expect(build().friendCodes).toEqual({});
  });

  it('turns segments into flight segments with ISO offsets, time zones and order per direction', () => {
    const { trip, segments } = build();
    expect(segments.map((s) => [s.direction, s.order, s.fromIata, s.toIata])).toEqual([
      ['outbound', 0, 'WAW', 'DXB'],
      ['outbound', 1, 'DXB', 'BKK'],
      ['return', 0, 'BKK', 'WAW'],
    ]);
    expect(segments[0]).toEqual(
      expect.objectContaining({
        tripId: trip.id,
        flightNumber: 'EK180',
        departAt: '2026-11-02T10:00:00+01:00',
        departTz: 'Europe/Warsaw',
        arriveAt: '2026-11-02T18:30:00+04:00',
        arriveTz: 'Asia/Dubai',
      }),
    );
    expect(segments[1]).not.toHaveProperty('flightNumber');
    segments.forEach((segment) => expect(FlightSegmentSchema.safeParse(segment).success).toBe(true));
  });

  it('gives every entity its own id', () => {
    const { trip, members, segments } = build();
    const ids = [trip.id, ...members.map((m) => m.id), ...segments.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('in-memory trip repository', () => {
  function repository() {
    return createInMemoryTripRepository({ now: () => NOW, newId: sequentialIds() });
  }

  it('shows a created trip with the traveller count (friends + organizer)', async () => {
    const repo = repository();
    const created = await repo.create(createTripInputFixture());
    const current = await repo.current();
    expect(current?.overview.trip).toEqual({ ...created, travellerCount: 3 });
    expect(TripSummarySchema.safeParse(current?.overview.trip).success).toBe(true);
  });

  it('owns its trips by the local owner (tests only, no auth)', async () => {
    expect((await repository().create(createTripInputFixture())).ownerId).toBe(LOCAL_OWNER_ID);
  });

  describe('friends found by code (friend-invite D12)', () => {
    const OLA_ACCOUNT = '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    const ALA_ACCOUNT = '6c2a1a7b-3d8e-4b9f-8c4d-2e3f4a5b6c7d';
    const withAccounts = () =>
      createInMemoryTripRepository({
        now: () => NOW,
        newId: sequentialIds(),
        friendAccounts: { '5ZMRX8': OLA_ACCOUNT, M4P7QW: ALA_ACCOUNT, K7M2QX: OLA_ACCOUNT },
        ownFriendCode: 'T3ST42',
      });
    const inputWithCodes = (...codes: (string | null)[]) => {
      const input = createTripInputFixture();
      input.friends.friends = codes.map((friendCode, i) => ({ displayName: `Friend ${i}`, interests: [], friendCode }));
      input.flights.companionCount = codes.length;
      return input;
    };

    it('links a friend to the account that has the code, and not the friend without one', async () => {
      const repo = withAccounts();
      await repo.create(inputWithCodes('5ZMRX8', null));
      const members = (await repo.current())?.overview.members ?? [];
      expect(members.map((member) => member.userId)).toEqual([OLA_ACCOUNT, null]);
    });

    it('rejects an unknown code with UnknownFriendCodeError and stores nothing', async () => {
      const repo = withAccounts();
      await expect(repo.create(inputWithCodes('5ZMRX8', 'ZZZZZZ'))).rejects.toBeInstanceOf(UnknownFriendCodeError);
      await expect(repo.list()).resolves.toEqual([]);
      await expect(repo.current()).resolves.toBeNull();
    });

    it('rejects the owner\'s own code with OwnFriendCodeError and stores nothing', async () => {
      const repo = withAccounts();
      await expect(repo.create(inputWithCodes('T3ST42'))).rejects.toBeInstanceOf(OwnFriendCodeError);
      await expect(repo.list()).resolves.toEqual([]);
    });

    it('rejects one account added twice with FriendAlreadyAddedError, like the unique index of the server', async () => {
      const repo = withAccounts();
      await expect(repo.create(inputWithCodes('5ZMRX8', 'K7M2QX'))).rejects.toBeInstanceOf(FriendAlreadyAddedError);
      await expect(repo.list()).resolves.toEqual([]);
    });

    it('does not accept the same code twice in the wizard input, before any of this', async () => {
      await expect(withAccounts().create(inputWithCodes('5ZMRX8', '5ZMRX8'))).rejects.toMatchObject({ name: 'ZodError' });
    });

    it('does not link anybody when it knows no accounts (the default)', async () => {
      const repo = repository();
      await expect(repo.create(inputWithCodes('5ZMRX8'))).rejects.toBeInstanceOf(UnknownFriendCodeError);
    });
  });

  describe('list, chosen and current trip (trips-drawer)', () => {
    const UNKNOWN_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';

    function soonerTrip(name: string) {
      const input = createTripInputFixture();
      input.flights.outbound = [{ ...input.flights.outbound[0], departAt: '2026-10-20T10:00', arriveAt: '2026-10-20T18:30' }];
      input.flights.return = [
        { ...input.flights.return[0], fromIata: 'DXB', departTz: 'Asia/Dubai', departAt: '2026-10-25T09:00', arriveAt: '2026-10-25T13:00' },
      ];
      input.flights.companionCount = 1;
      input.friends.friends = [{ displayName: 'Ola', interests: [] }];
      input.details.name = name;
      return input;
    }

    it('has no current trip and an empty list when there are no trips', async () => {
      const repo = repository();
      await expect(repo.current()).resolves.toBeNull();
      await expect(repo.list()).resolves.toEqual([]);
    });

    it('lists every trip with what the side panel needs, soonest start first', async () => {
      const repo = repository();
      const later = await repo.create(createTripInputFixture());
      const sooner = await repo.create(soonerTrip('Dubai'));
      const list = await repo.list();
      expect(TripListSchema.safeParse(list).success).toBe(true);
      expect(list).toEqual([
        { id: sooner.id, name: 'Dubai', coverImageUri: 'preset:auckland', startDate: '2026-10-20', endDate: '2026-10-25' },
        { id: later.id, name: 'Warsaw → Bangkok', coverImageUri: 'preset:auckland', startDate: '2026-11-03', endDate: '2026-11-15' },
      ]);
    });

    it('makes a newly created trip the current trip, even when another starts sooner (A3)', async () => {
      const repo = repository();
      await repo.create(soonerTrip('Dubai'));
      const later = await repo.create(createTripInputFixture());
      expect((await repo.current())?.overview.trip.id).toBe(later.id);
    });

    it('shows the chosen trip with its members and flight segments (D2)', async () => {
      const repo = repository();
      const sooner = await repo.create(soonerTrip('Dubai'));
      await repo.create(createTripInputFixture());
      await repo.select(sooner.id);
      const current = await repo.current();
      expect(CurrentTripSchema.safeParse(current).success).toBe(true);
      expect(current).toEqual(expect.objectContaining({ budgetSyncStatus: 'synced', fromCache: false }));
      expect(current?.overview.trip).toEqual({ ...sooner, travellerCount: 2 });
      expect(current?.overview.members.map((member) => member.displayName)).toEqual(['Ola']);
      expect(current?.overview.segments.map((s) => [s.direction, s.fromIata, s.toIata])).toEqual([
        ['outbound', 'WAW', 'DXB'],
        ['return', 'DXB', 'WAW'],
      ]);
    });

    it('shows the default trip when the chosen one is not there: the soonest upcoming (A1)', async () => {
      const repo = repository();
      const sooner = await repo.create(soonerTrip('Dubai'));
      await repo.create(createTripInputFixture());
      await repo.select(UNKNOWN_ID);
      expect((await repo.current())?.overview.trip.id).toBe(sooner.id);
    });

    it('shows an ended trip only when nothing is upcoming, the most recently ended one (A1)', async () => {
      let now = NOW;
      const repo = createInMemoryTripRepository({ now: () => now, newId: sequentialIds() });
      const sooner = await repo.create(soonerTrip('Dubai'));
      const later = await repo.create(createTripInputFixture());
      await repo.select(UNKNOWN_ID);
      // Dubai ended on 25 Oct, Bangkok goes on until 15 Nov.
      now = new Date('2026-10-30T12:00:00Z');
      expect((await repo.current())?.overview.trip.id).toBe(later.id);
      // Both ended: Bangkok ended last, although Dubai comes first in the list.
      now = new Date('2026-12-01T12:00:00Z');
      expect((await repo.current())?.overview.trip.id).toBe(later.id);
      expect((await repo.list())[0].id).toBe(sooner.id);
    });

    it('takes the earlier created trip when two start on the same day', async () => {
      // Clock going backwards, so insertion order and createdAt order differ.
      const times = [new Date('2026-10-04T12:05:00Z'), new Date('2026-10-04T12:00:00Z')];
      const repo = createInMemoryTripRepository({ now: () => times.shift() ?? NOW, newId: sequentialIds() });
      await repo.create(soonerTrip('Created later'));
      await repo.create(soonerTrip('Created earlier'));
      await repo.select(UNKNOWN_ID);
      expect((await repo.current())?.overview.trip.name).toBe('Created earlier');
      expect((await repo.list()).map((trip) => trip.name)).toEqual(['Created earlier', 'Created later']);
    });

    it('rejects a chosen id that is not a UUID', async () => {
      await expect(repository().select('trip-1')).rejects.toThrow();
    });
  });

  it('changes the budget in the trip\'s base currency, and rejects a non-positive amount', async () => {
    const repo = repository();
    const created = await repo.create(createTripInputFixture());
    await repo.setBudget(created, 250000);
    expect((await repo.current())?.overview.trip.budgetPerPerson).toEqual({ amountMinor: 250000, currency: 'THB' });
    await expect(repo.setBudget(created, 0)).rejects.toThrow();
    await expect(repo.syncBudgets()).resolves.toEqual({ nextAttemptAt: null });
  });

  describe('updateDetails and delete (trip-edit-menu)', () => {
    const UNKNOWN_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';

    it('changes the name and cover, seen by current() and list(); the name is trimmed', async () => {
      const repo = repository();
      const created = await repo.create(createTripInputFixture());
      await repo.updateDetails(created.id, { name: '  Bangkok 2026  ', coverImageUri: 'preset:bali' });
      const current = await repo.current();
      expect(current?.overview.trip).toEqual(expect.objectContaining({ id: created.id, name: 'Bangkok 2026', coverImageUri: 'preset:bali' }));
      expect(current?.overview.trip).not.toHaveProperty('coverUrls');
      expect(await repo.list()).toEqual([expect.objectContaining({ id: created.id, name: 'Bangkok 2026', coverImageUri: 'preset:bali' })]);
    });

    it('rejects input without a cover (a cover is required, trip-covers D1)', async () => {
      const repo = repository();
      const created = await repo.create(createTripInputFixture());
      await expect(repo.updateDetails(created.id, { name: 'Bangkok' } as never)).rejects.toThrow();
      expect((await repo.current())?.overview.trip.coverImageUri).toBe('preset:auckland');
    });

    it('rejects an invalid name and changes nothing', async () => {
      const repo = repository();
      const created = await repo.create(createTripInputFixture());
      await expect(repo.updateDetails(created.id, { name: '', coverImageUri: 'preset:bali' })).rejects.toThrow();
      await expect(repo.updateDetails(created.id, { name: 'x'.repeat(61), coverImageUri: 'preset:bali' })).rejects.toThrow();
      expect((await repo.current())?.overview.trip.name).toBe('Warsaw → Bangkok');
    });

    it('rejects an unknown trip, like the server changing no row', async () => {
      await expect(repository().updateDetails(UNKNOWN_ID, { name: 'Rome', coverImageUri: 'preset:bali' })).rejects.toThrow();
    });

    it('delete removes the trip; the next current() is the default trip', async () => {
      const repo = repository();
      const kept = await repo.create(createTripInputFixture());
      const chosen = await repo.create(createTripInputFixture());
      expect((await repo.current())?.overview.trip.id).toBe(chosen.id);

      await repo.delete(chosen.id);

      expect((await repo.list()).map((trip) => trip.id)).toEqual([kept.id]);
      expect((await repo.current())?.overview.trip.id).toBe(kept.id);
    });

    it('delete of the last trip leaves no current trip', async () => {
      const repo = repository();
      const created = await repo.create(createTripInputFixture());
      await repo.delete(created.id);
      await expect(repo.current()).resolves.toBeNull();
      await expect(repo.list()).resolves.toEqual([]);
    });

    it('deleting an unknown trip resolves and changes nothing: already gone is a success (D13)', async () => {
      const repo = repository();
      const kept = await repo.create(createTripInputFixture());
      await expect(repo.delete(UNKNOWN_ID)).resolves.toBeUndefined();
      expect((await repo.list()).map((trip) => trip.id)).toEqual([kept.id]);
      expect((await repo.current())?.overview.trip.id).toBe(kept.id);
    });
  });

  describe('covers (trip-covers D1, D5)', () => {
    const url = (path: string) => `https://photos.invalid/${path}`;
    const withCover = (coverImageUri: string) => {
      const input = createTripInputFixture();
      input.details.coverImageUri = coverImageUri as never;
      return input;
    };

    it('stores a preset cover as is, with no signed URLs', async () => {
      const repo = repository();
      const trip = await repo.create(withCover('preset:jakarta'));
      expect(trip.coverImageUri).toBe('preset:jakarta');
      expect((await repo.current())?.overview.trip).not.toHaveProperty('coverUrls');
      expect((await repo.list())[0]).toEqual(expect.objectContaining({ coverImageUri: 'preset:jakarta' }));
      expect((await repo.list())[0]).not.toHaveProperty('coverUrls');
    });

    it('turns a gallery photo at creation into a stored cover photo:<new id>, shown with fake http(s) urls', async () => {
      const repo = repository();
      const trip = await repo.create(withCover('file:///gallery/IMG_1.jpg'));

      expect(trip.coverImageUri).toMatch(/^photo:[0-9a-f-]{36}$/);
      const id = trip.coverImageUri.slice('photo:'.length);
      const urls = { url: url(`${trip.id}/${id}.jpg`), thumbnailUrl: url(`${trip.id}/${id}_thumb.jpg`) };
      const current = (await repo.current())?.overview.trip;
      expect(current).toEqual(expect.objectContaining({ coverImageUri: trip.coverImageUri, coverUrls: urls }));
      expect(TripSummarySchema.safeParse(current).success).toBe(true);
      expect((await repo.list())[0]).toEqual(expect.objectContaining({ coverImageUri: trip.coverImageUri, coverUrls: urls }));
      expect(TripListSchema.safeParse(await repo.list()).success).toBe(true);
    });

    it('updateDetails: a new gallery photo becomes photo:<new id>; a preset replaces it and drops the urls', async () => {
      const repo = repository();
      const trip = await repo.create(createTripInputFixture());

      await repo.updateDetails(trip.id, { name: 'Bangkok', coverImageUri: 'file:///gallery/IMG_2.jpg' });
      const stored = (await repo.current())?.overview.trip;
      expect(stored?.coverImageUri).toMatch(/^photo:[0-9a-f-]{36}$/);
      expect(stored?.coverUrls).toBeDefined();

      await repo.updateDetails(trip.id, { name: 'Bangkok', coverImageUri: 'preset:beijing' });
      const preset = (await repo.current())?.overview.trip;
      expect(preset?.coverImageUri).toBe('preset:beijing');
      expect(preset).not.toHaveProperty('coverUrls');
    });

    it('updateDetails: a stored cover that is not the trip\'s current one is refused, and nothing changes', async () => {
      const repo = repository();
      const trip = await repo.create(withCover('file:///gallery/IMG_1.jpg'));
      const other = 'photo:9a1c0000-0000-4000-8000-0000000000ff';
      await expect(repo.updateDetails(trip.id, { name: 'Renamed', coverImageUri: other })).rejects.toThrow('cover-not-current');
      const current = (await repo.current())?.overview.trip;
      expect(current?.coverImageUri).toBe(trip.coverImageUri);
      expect(current?.name).toBe('Warsaw → Bangkok');

      const preset = await repo.create(withCover('preset:bali'));
      await expect(repo.updateDetails(preset.id, { name: 'Renamed', coverImageUri: trip.coverImageUri })).rejects.toThrow('cover-not-current');
    });

    it('updateDetails: an unchanged stored cover stays the same (no new id)', async () => {
      const repo = repository();
      const trip = await repo.create(withCover('file:///gallery/IMG_1.jpg'));
      await repo.updateDetails(trip.id, { name: 'Bangkok', coverImageUri: trip.coverImageUri });
      expect((await repo.current())?.overview.trip.coverImageUri).toBe(trip.coverImageUri);
    });
  });

  describe('photos (trip-photos)', () => {
    const UNKNOWN_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';
    const photoId = (n: number) => `5a1c0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const url = (path: string) => `https://photos.invalid/${path}`;

    /** A repository whose clock the test moves, with one trip. */
    async function withTrip() {
      let now = NOW;
      const repo = createInMemoryTripRepository({ now: () => now, newId: sequentialIds() });
      const trip = await repo.create(createTripInputFixture());
      return { repo, trip, setNow: (next: Date) => (now = next) };
    }

    it('has no photos yet, also for a trip it does not know', async () => {
      const { repo, trip } = await withTrip();
      await expect(repo.photos(trip.id)).resolves.toEqual([]);
      await expect(repo.photos(UNKNOWN_ID)).resolves.toEqual([]);
    });

    it('keeps an added photo with its date taken and the time it was added, shown with fake http(s) urls and no files', async () => {
      const { repo, trip } = await withTrip();
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///gallery/1.jpg', takenAt: '2026-10-14T18:03' });

      const photos = await repo.photos(trip.id);

      expect(TripPhotoListSchema.safeParse(photos).success).toBe(true);
      expect(photos).toEqual([
        {
          id: photoId(1),
          tripId: trip.id,
          takenAt: '2026-10-14T18:03',
          createdAt: NOW.toISOString(),
          url: url(`${trip.id}/${photoId(1)}.jpg`),
          thumbnailUrl: url(`${trip.id}/${photoId(1)}_thumb.jpg`),
        },
      ]);
    });

    it('has no takenAt for a photo without a date taken', async () => {
      const { repo, trip } = await withTrip();
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///gallery/1.jpg' });
      expect((await repo.photos(trip.id))[0]).not.toHaveProperty('takenAt');
    });

    it('lists photos by date taken, oldest first; undated ones last, in the order they were added (D10, D13)', async () => {
      const { repo, trip, setNow } = await withTrip();
      const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
      setNow(at(1));
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///1.jpg' });
      setNow(at(2));
      await repo.addPhoto(trip.id, photoId(2), { uri: 'file:///2.jpg', takenAt: '2026-10-14T18:03' });
      setNow(at(3));
      await repo.addPhoto(trip.id, photoId(3), { uri: 'file:///3.jpg', takenAt: '2026-10-13T09:00' });
      setNow(at(4));
      await repo.addPhoto(trip.id, photoId(4), { uri: 'file:///4.jpg' });

      const photos = await repo.photos(trip.id);

      expect(photos.map((photo) => photo.id)).toEqual([photoId(3), photoId(2), photoId(1), photoId(4)]);
    });

    it('lists only the photos of the asked trip', async () => {
      const { repo, trip } = await withTrip();
      const other = await repo.create(createTripInputFixture());
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///1.jpg' });
      await repo.addPhoto(other.id, photoId(2), { uri: 'file:///2.jpg' });
      expect((await repo.photos(trip.id)).map((photo) => photo.id)).toEqual([photoId(1)]);
      expect((await repo.photos(other.id)).map((photo) => photo.id)).toEqual([photoId(2)]);
    });

    it('adding the same photo id again adds nothing and keeps the first one (A5)', async () => {
      const { repo, trip, setNow } = await withTrip();
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///1.jpg', takenAt: '2026-10-14T18:03' });
      setNow(new Date(NOW.getTime() + 60_000));
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///1.jpg', takenAt: '2026-10-14T18:03' });

      const photos = await repo.photos(trip.id);

      expect(photos).toHaveLength(1);
      expect(photos[0].createdAt).toBe(NOW.toISOString());
    });

    it('rejects a photo for a trip it does not know, like the server refusing the insert', async () => {
      const { repo } = await withTrip();
      await expect(repo.addPhoto(UNKNOWN_ID, photoId(1), { uri: 'file:///1.jpg' })).rejects.toThrow('trip-not-found');
      await expect(repo.photos(UNKNOWN_ID)).resolves.toEqual([]);
    });

    it('rejects an invalid photo and stores nothing', async () => {
      const { repo, trip } = await withTrip();
      await expect(repo.addPhoto(trip.id, photoId(1), { uri: '' })).rejects.toThrow();
      await expect(repo.addPhoto(trip.id, photoId(1), { uri: 'file:///1.jpg', takenAt: '2026-10-14T18:03:22' })).rejects.toThrow();
      await expect(repo.addPhoto(trip.id, 'photo-1', { uri: 'file:///1.jpg' })).rejects.toThrow();
      await expect(repo.photos(trip.id)).resolves.toEqual([]);
    });

    it('deletes a photo and keeps the others; an unknown photo is already gone, so it resolves', async () => {
      const { repo, trip } = await withTrip();
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///1.jpg' });
      await repo.addPhoto(trip.id, photoId(2), { uri: 'file:///2.jpg' });
      const [first] = await repo.photos(trip.id);

      await repo.deletePhoto(first);
      await expect(repo.deletePhoto(first)).resolves.toBeUndefined();

      expect((await repo.photos(trip.id)).map((photo) => photo.id)).toEqual([photoId(2)]);
    });

    it('deleting a trip drops its photos and keeps those of other trips', async () => {
      const { repo, trip } = await withTrip();
      const other = await repo.create(createTripInputFixture());
      await repo.addPhoto(trip.id, photoId(1), { uri: 'file:///1.jpg' });
      await repo.addPhoto(other.id, photoId(2), { uri: 'file:///2.jpg' });

      await repo.delete(trip.id);

      await expect(repo.photos(trip.id)).resolves.toEqual([]);
      expect((await repo.photos(other.id)).map((photo) => photo.id)).toEqual([photoId(2)]);
    });
  });

  it('counts a solo trip as one traveller', async () => {
    const repo = repository();
    const solo = createTripInputFixture();
    solo.flights.companionCount = 0;
    solo.friends.friends = [];
    await repo.create(solo);
    expect((await repo.current())?.overview.trip.travellerCount).toBe(1);
  });

  it('rejects invalid input and stores nothing', async () => {
    const repo = repository();
    const invalid = createTripInputFixture();
    invalid.flights.companionCount = 5;
    await expect(repo.create(invalid)).rejects.toThrow();
    await expect(repo.current()).resolves.toBeNull();
  });

  it('rejects a time that does not exist (clocks go forward) and stores nothing', async () => {
    const repo = repository();
    const invalid = createTripInputFixture();
    invalid.flights.outbound = [
      {
        fromIata: 'LHR',
        departTz: 'Europe/London',
        toIata: 'WAW',
        arriveTz: 'Europe/Warsaw',
        departAt: '2027-03-27T22:00',
        arriveAt: '2027-03-28T02:30',
      },
      {
        fromIata: 'WAW',
        departTz: 'Europe/Warsaw',
        toIata: 'BKK',
        arriveTz: 'Asia/Bangkok',
        departAt: '2027-03-28T06:00',
        arriveAt: '2027-03-28T21:00',
      },
    ];
    invalid.flights.return[0] = { ...invalid.flights.return[0], departAt: '2027-04-05T09:00', arriveAt: '2027-04-05T15:00' };
    await expect(repo.create(invalid)).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ['flights', 'outbound', 0, 'arriveAt'], message: 'validation.timeDoesNotExist' })],
    });
    await expect(repo.current()).resolves.toBeNull();
  });

  it('rejects an impossible calendar date as wizard input and stores nothing', async () => {
    const repo = repository();
    const invalid = createTripInputFixture();
    invalid.flights.return[0].arriveAt = '2026-11-31T17:00';
    await expect(repo.create(invalid)).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ['flights', 'return', 0, 'arriveAt'], message: 'validation.dateTimeRequired' })],
    });
    await expect(repo.current()).resolves.toBeNull();
  });
});
