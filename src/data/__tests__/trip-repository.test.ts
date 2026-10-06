import { buildTrip, createInMemoryTripRepository, LOCAL_OWNER_ID } from '@/data/trip-repository';
import {
  CreateTripInputSchema,
  FlightSegmentSchema,
  TripMemberSchema,
  TripOverviewSchema,
  TripSchema,
  TripSummarySchema,
} from '@/schemas';
import { createTripInputFixture } from '@/test/fixtures';

const NOW = new Date('2026-10-04T12:00:00Z');

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function build(patch: (input: ReturnType<typeof createTripInputFixture>) => void = () => {}) {
  const input = createTripInputFixture();
  patch(input);
  return buildTrip(CreateTripInputSchema.parse(input), { now: NOW, newId: sequentialIds() });
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
      ownerId: LOCAL_OWNER_ID,
      name: 'Warsaw → Bangkok',
      destination: 'BKK',
      startDate: '2026-11-03',
      endDate: '2026-11-15',
      baseCurrency: 'THB',
      budgetPerPerson: { amountMinor: 3000000, currency: 'THB' },
      createdAt: '2026-10-04T12:00:00.000Z',
    });
    expect(TripSchema.safeParse(trip).success).toBe(true);
  });

  it('trims the name', () => {
    const { trip } = build((input) => {
      input.details.name = '  Tajlandia z ekipą  ';
    });
    expect(trip.name).toBe('Tajlandia z ekipą');
  });

  it('keeps the cover photo, and has no cover field without one', () => {
    const withCover = build((input) => {
      input.details.coverImageUri = 'file:///cache/cover.jpg';
    });
    expect(withCover.trip.coverImageUri).toBe('file:///cache/cover.jpg');
    expect(build().trip).not.toHaveProperty('coverImageUri');
  });

  it('turns friends into members without an account', () => {
    const { trip, members } = build();
    expect(members).toEqual([
      expect.objectContaining({ tripId: trip.id, userId: null, displayName: 'Kasia', role: 'viewer', interests: ['beaches', 'nightlife'] }),
      expect.objectContaining({ tripId: trip.id, userId: null, displayName: 'Ola', role: 'viewer', interests: [] }),
    ]);
    members.forEach((member) => expect(TripMemberSchema.safeParse(member).success).toBe(true));
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

  it('starts empty', async () => {
    await expect(repository().list()).resolves.toEqual([]);
  });

  it('lists a created trip with the traveller count (friends + organizer)', async () => {
    const repo = repository();
    const created = await repo.create(createTripInputFixture());
    const list = await repo.list();
    expect(list).toEqual([{ ...created, travellerCount: 3 }]);
    expect(TripSummarySchema.safeParse(list[0]).success).toBe(true);
  });

  it('lists trips soonest first', async () => {
    const repo = repository();
    const later = createTripInputFixture();
    const sooner = createTripInputFixture();
    sooner.flights.outbound = [{ ...sooner.flights.outbound[0], departAt: '2026-10-20T10:00', arriveAt: '2026-10-20T18:30' }];
    sooner.flights.return = [
      { ...sooner.flights.return[0], fromIata: 'DXB', departTz: 'Asia/Dubai', departAt: '2026-10-25T09:00', arriveAt: '2026-10-25T13:00' },
    ];
    sooner.details.name = 'Dubai';
    await repo.create(later);
    await repo.create(sooner);
    expect((await repo.list()).map((trip) => trip.name)).toEqual(['Dubai', 'Warsaw → Bangkok']);
  });

  describe('nearest trip', () => {
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

    it('is null when there are no trips', async () => {
      await expect(repository().nearest()).resolves.toBeNull();
    });

    it('returns the soonest trip with its members and flight segments', async () => {
      const repo = repository();
      await repo.create(createTripInputFixture());
      const sooner = await repo.create(soonerTrip('Dubai'));
      const nearest = await repo.nearest();
      expect(TripOverviewSchema.safeParse(nearest).success).toBe(true);
      expect(nearest?.trip).toEqual({ ...sooner, travellerCount: 2 });
      expect(nearest?.members.map((member) => member.displayName)).toEqual(['Ola']);
      expect(nearest?.segments.map((s) => [s.direction, s.fromIata, s.toIata])).toEqual([
        ['outbound', 'WAW', 'DXB'],
        ['return', 'DXB', 'WAW'],
      ]);
    });

    it('takes the first created trip when two start on the same day', async () => {
      const repo = repository();
      await repo.create(soonerTrip('First'));
      await repo.create(soonerTrip('Second'));
      expect((await repo.nearest())?.trip.name).toBe('First');
    });
  });

  it('counts a solo trip as one traveller', async () => {
    const repo = repository();
    const solo = createTripInputFixture();
    solo.flights.companionCount = 0;
    solo.friends.friends = [];
    await repo.create(solo);
    expect((await repo.list())[0].travellerCount).toBe(1);
  });

  it('rejects invalid input and stores nothing', async () => {
    const repo = repository();
    const invalid = createTripInputFixture();
    invalid.flights.companionCount = 5;
    await expect(repo.create(invalid)).rejects.toThrow();
    await expect(repo.list()).resolves.toEqual([]);
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
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('rejects an impossible calendar date as wizard input and stores nothing', async () => {
    const repo = repository();
    const invalid = createTripInputFixture();
    invalid.flights.return[0].arriveAt = '2026-11-31T17:00';
    await expect(repo.create(invalid)).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ['flights', 'return', 0, 'arriveAt'], message: 'validation.dateTimeRequired' })],
    });
    await expect(repo.list()).resolves.toEqual([]);
  });
});
