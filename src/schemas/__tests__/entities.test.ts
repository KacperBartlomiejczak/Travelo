import {
  AirportSchema,
  CreateTripMemberPayloadSchema,
  FlightRouteSchema,
  FlightSegmentSchema,
  TRIP_NAME_MAX_LENGTH,
  TripMemberSchema,
  TripOverviewSchema,
  TripSchema,
  TripSummarySchema,
} from '@/schemas';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';

describe('Airport', () => {
  const bcn = {
    iata: 'BCN',
    name: 'Josep Tarradellas Barcelona-El Prat Airport',
    city: 'Barcelona',
    countryCode: 'ES',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    large: true,
    latitude: 41.2971,
    longitude: 2.0785,
  };

  it('accepts a complete airport', () => {
    expect(AirportSchema.safeParse(bcn).success).toBe(true);
  });

  it('accepts coordinates on the range limits', () => {
    expect(AirportSchema.safeParse({ ...bcn, latitude: -90, longitude: 180 }).success).toBe(true);
    expect(AirportSchema.safeParse({ ...bcn, latitude: 90, longitude: -180 }).success).toBe(true);
  });

  it.each([
    ['lowercase country', { ...bcn, countryCode: 'es' }],
    ['unknown timezone', { ...bcn, timezone: 'Spain/Barcelona' }],
    ['empty city', { ...bcn, city: '' }],
    ['missing size flag', { ...bcn, large: undefined }],
    ['missing latitude', { ...bcn, latitude: undefined }],
    ['missing longitude', { ...bcn, longitude: undefined }],
    ['latitude above 90', { ...bcn, latitude: 91 }],
    ['latitude below -90', { ...bcn, latitude: -91 }],
    ['longitude above 180', { ...bcn, longitude: 181 }],
    ['longitude below -180', { ...bcn, longitude: -181 }],
    ['latitude as a string', { ...bcn, latitude: '41.2971' }],
  ])('rejects %s', (_, value) => {
    expect(AirportSchema.safeParse(value).success).toBe(false);
  });
});

describe('FlightSegment', () => {
  const segment = {
    id: '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c',
    tripId: TRIP_ID,
    direction: 'outbound',
    order: 0,
    flightNumber: 'LO123',
    fromIata: 'WAW',
    toIata: 'BCN',
    departAt: '2026-11-02T10:15:00+01:00',
    departTz: 'Europe/Warsaw',
    arriveAt: '2026-11-02T13:30:00+01:00',
    arriveTz: 'Europe/Madrid',
  };

  it('accepts a segment, with or without a flight number', () => {
    expect(FlightSegmentSchema.safeParse(segment).success).toBe(true);
    const { flightNumber: _omit, ...withoutNumber } = segment;
    expect(FlightSegmentSchema.safeParse(withoutNumber).success).toBe(true);
  });

  it('rejects an arrival before the departure', () => {
    expect(FlightSegmentSchema.safeParse({ ...segment, arriveAt: '2026-11-02T09:00:00+01:00' }).success).toBe(false);
  });

  it('compares instants, not wall-clock times', () => {
    // 01:30 in New York (-05:00) is after 23:30 in Warsaw (+01:00) the day before.
    const overnight = {
      ...segment,
      toIata: 'JFK',
      departAt: '2026-11-02T23:30:00+01:00',
      arriveAt: '2026-11-03T01:30:00-05:00',
      arriveTz: 'America/New_York',
    };
    expect(FlightSegmentSchema.safeParse(overnight).success).toBe(true);
  });

  it.each([
    ['unknown direction', { direction: 'sideways' }],
    ['negative order', { order: -1 }],
    ['time without offset', { departAt: '2026-11-02T10:15:00' }],
    ['non-uuid id', { id: 'seg-1' }],
  ])('rejects %s', (_, patch) => {
    expect(FlightSegmentSchema.safeParse({ ...segment, ...patch }).success).toBe(false);
  });
});

describe('FlightRoute (profile-screen D11)', () => {
  it('accepts the two airports of a segment and keeps nothing else', () => {
    expect(FlightRouteSchema.parse({ fromIata: 'WAW', toIata: 'BCN' })).toEqual({ fromIata: 'WAW', toIata: 'BCN' });
    expect(FlightRouteSchema.parse({ fromIata: 'WAW', toIata: 'BCN', direction: 'outbound', flightNumber: 'LO123' })).toEqual({
      fromIata: 'WAW',
      toIata: 'BCN',
    });
  });

  it.each([
    ['a lowercase departure airport', { fromIata: 'wa', toIata: 'BCN' }],
    ['a four-letter landing airport', { fromIata: 'WAW', toIata: 'WAWX' }],
    ['a missing landing airport', { fromIata: 'WAW' }],
    ['a missing departure airport', { toIata: 'BCN' }],
  ])('rejects %s', (_, route) => {
    expect(FlightRouteSchema.safeParse(route).success).toBe(false);
  });
});

describe('TripMember', () => {
  const friend = {
    id: '7c2d9e1f-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
    tripId: TRIP_ID,
    userId: null,
    displayName: 'Kasia',
    role: 'viewer',
    interests: ['beaches', 'nightlife'],
  };

  it('accepts a friend without an account, pace or budget level', () => {
    expect(TripMemberSchema.safeParse(friend).success).toBe(true);
  });

  it('accepts a friend with no interests', () => {
    expect(TripMemberSchema.safeParse({ ...friend, interests: [] }).success).toBe(true);
  });

  it('trims the name', () => {
    expect(TripMemberSchema.parse({ ...friend, displayName: '  Ola  ' }).displayName).toBe('Ola');
  });

  it.each([
    ['empty name', { displayName: '' }],
    ['whitespace name', { displayName: '   ' }],
    ['unknown interest', { interests: ['knitting'] }],
    ['unknown pace', { pace: 'sprint' }],
    ['unknown role', { role: 'editor' }],
  ])('rejects %s', (_, patch) => {
    expect(TripMemberSchema.safeParse({ ...friend, ...patch }).success).toBe(false);
  });
});

describe('CreateTripMemberPayload (friend-invite D12)', () => {
  const payload = {
    id: '7c2d9e1f-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
    trip_id: TRIP_ID,
    display_name: 'Kasia',
    role: 'viewer',
    interests: ['beaches'],
  };

  it('accepts a friend without a code, with a null code and with a friend code', () => {
    expect(CreateTripMemberPayloadSchema.safeParse(payload).success).toBe(true);
    expect(CreateTripMemberPayloadSchema.parse({ ...payload, friend_code: null }).friend_code).toBeNull();
    expect(CreateTripMemberPayloadSchema.parse({ ...payload, friend_code: 'K7QX2M' }).friend_code).toBe('K7QX2M');
  });

  it('never carries an account id: user_id is dropped', () => {
    const parsed = CreateTripMemberPayloadSchema.parse({ ...payload, user_id: '3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b' });
    expect('user_id' in parsed).toBe(false);
  });

  it.each([
    ['a lowercase friend code', { friend_code: 'k7qx2m' }],
    ['a look-alike character', { friend_code: 'K7QX20' }],
    ['a too short friend code', { friend_code: 'K7QX2' }],
    ['an empty name', { display_name: '' }],
    ['an unknown interest', { interests: ['knitting'] }],
  ])('rejects %s', (_, patch) => {
    expect(CreateTripMemberPayloadSchema.safeParse({ ...payload, ...patch }).success).toBe(false);
  });
});

describe('Trip', () => {
  const trip = {
    id: TRIP_ID,
    ownerId: 'local-user',
    name: 'Barcelona',
    destination: 'BCN',
    startDate: '2026-11-02',
    endDate: '2026-11-09',
    baseCurrency: 'EUR',
    budgetPerPerson: { amountMinor: 300000, currency: 'EUR' },
    createdAt: '2026-10-04T12:00:00+02:00',
    budgetUpdatedAt: '2026-10-04T12:00:00+02:00',
    coverImageUri: 'preset:auckland',
  };

  it('accepts a trip, including a one-day trip', () => {
    expect(TripSchema.safeParse(trip).success).toBe(true);
    expect(TripSchema.safeParse({ ...trip, endDate: trip.startDate }).success).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    expect(TripSchema.safeParse({ ...trip, endDate: '2026-11-01' }).success).toBe(false);
  });

  it('rejects a budget in a currency other than the base currency', () => {
    expect(TripSchema.safeParse({ ...trip, budgetPerPerson: { amountMinor: 300000, currency: 'PLN' } }).success).toBe(false);
  });

  it('rejects a trip without a budget per person', () => {
    const { budgetPerPerson: _omit, ...withoutBudget } = trip;
    expect(TripSchema.safeParse(withoutBudget).success).toBe(false);
  });

  it('requires when the budget last changed, as an ISO date-time with offset (last write wins)', () => {
    const { budgetUpdatedAt: _omit, ...withoutTimestamp } = trip;
    expect(TripSchema.safeParse(withoutTimestamp).success).toBe(false);
    expect(TripSchema.safeParse({ ...trip, budgetUpdatedAt: '2026-10-04T12:00:00' }).success).toBe(false);
  });

  it('accepts a preset or a stored gallery cover', () => {
    expect(TripSchema.parse({ ...trip, coverImageUri: 'preset:bali' }).coverImageUri).toBe('preset:bali');
    const stored = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    expect(TripSchema.parse({ ...trip, coverImageUri: stored }).coverImageUri).toBe(stored);
  });

  it('requires a cover (trip-covers D1)', () => {
    const { coverImageUri: _omit, ...withoutCover } = trip;
    expect(TripSchema.safeParse(withoutCover).success).toBe(false);
  });

  it('has no signed URLs: only the summary and the list item carry them', () => {
    const urls = { url: 'https://example.supabase.co/a.jpg', thumbnailUrl: 'https://example.supabase.co/a_thumb.jpg' };
    const stored = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    expect(TripSchema.parse({ ...trip, coverImageUri: stored, coverUrls: urls })).not.toHaveProperty('coverUrls');
  });

  it('accepts a name of up to 60 characters', () => {
    expect(TRIP_NAME_MAX_LENGTH).toBe(60);
    expect(TripSchema.safeParse({ ...trip, name: 'a'.repeat(60) }).success).toBe(true);
  });

  it.each([
    ['a 61-character name', { name: 'a'.repeat(61) }],
    ['an empty name', { name: '' }],
    ['an empty cover URI', { coverImageUri: '' }],
    ['a device URI as the cover (not a stored cover)', { coverImageUri: 'file:///cache/cover.jpg' }],
    ['an unknown preset', { coverImageUri: 'preset:paris' }],
    ['a gallery cover with an uppercase id', { coverImageUri: 'photo:5B1F0F6A-2C7D-4A8E-9B3C-1D2E3F4A5B6C' }],
  ])('rejects %s', (_, patch) => {
    expect(TripSchema.safeParse({ ...trip, ...patch }).success).toBe(false);
  });

  describe('TripSummary', () => {
    it('adds the traveller count, at least 1 (the organizer)', () => {
      expect(TripSummarySchema.safeParse({ ...trip, travellerCount: 4 }).success).toBe(true);
      expect(TripSummarySchema.safeParse({ ...trip, travellerCount: 0 }).success).toBe(false);
    });

    it('keeps the trip rules', () => {
      expect(TripSummarySchema.safeParse({ ...trip, endDate: '2026-11-01', travellerCount: 1 }).success).toBe(false);
    });

    it('carries the cover', () => {
      const summary = { ...trip, coverImageUri: 'preset:bali', travellerCount: 1 };
      expect(TripSummarySchema.parse(summary).coverImageUri).toBe('preset:bali');
      expect(TripSummarySchema.safeParse({ ...summary, name: 'a'.repeat(61) }).success).toBe(false);
    });

    describe('signed cover URLs (trip-covers D5)', () => {
      const stored = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
      const urls = { url: 'https://example.supabase.co/a.jpg?token=1', thumbnailUrl: 'https://example.supabase.co/a_thumb.jpg?token=2' };

      it('are optional for a gallery cover (an offline copy or a legacy value may lack them)', () => {
        const summary = { ...trip, coverImageUri: stored, travellerCount: 1 };
        expect(TripSummarySchema.parse({ ...summary, coverUrls: urls }).coverUrls).toEqual(urls);
        expect(TripSummarySchema.parse(summary)).not.toHaveProperty('coverUrls');
      });

      it('are refused for a preset', () => {
        expect(TripSummarySchema.safeParse({ ...trip, coverImageUri: 'preset:bali', travellerCount: 1, coverUrls: urls }).success).toBe(false);
      });

      it('must be http(s) URLs', () => {
        const bad = { url: 'javascript:alert(1)', thumbnailUrl: urls.thumbnailUrl };
        expect(TripSummarySchema.safeParse({ ...trip, coverImageUri: stored, travellerCount: 1, coverUrls: bad }).success).toBe(false);
      });
    });
  });

  describe('TripOverview', () => {
    const overview = {
      trip: { ...trip, travellerCount: 2 },
      members: [
        { id: '7c2d9e1f-3a4b-4c5d-8e6f-7a8b9c0d1e2f', tripId: TRIP_ID, userId: null, displayName: 'Kasia', role: 'viewer', interests: [] },
      ],
      segments: [
        {
          id: '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c',
          tripId: TRIP_ID,
          direction: 'outbound',
          order: 0,
          fromIata: 'WAW',
          toIata: 'BCN',
          departAt: '2026-11-02T10:15:00+01:00',
          departTz: 'Europe/Warsaw',
          arriveAt: '2026-11-02T13:30:00+01:00',
          arriveTz: 'Europe/Madrid',
        },
      ],
    };

    it('accepts a trip with its members and flight segments', () => {
      expect(TripOverviewSchema.safeParse(overview).success).toBe(true);
    });

    it('rejects an invalid member or segment', () => {
      expect(TripOverviewSchema.safeParse({ ...overview, members: [{ ...overview.members[0], displayName: '' }] }).success).toBe(false);
      expect(TripOverviewSchema.safeParse({ ...overview, segments: [{ ...overview.segments[0], fromIata: 'warsaw' }] }).success).toBe(false);
    });

    it('rejects an invalid trip', () => {
      expect(TripOverviewSchema.safeParse({ ...overview, trip: { ...overview.trip, travellerCount: 0 } }).success).toBe(false);
    });

    describe('organizerUsername (friend-invite D4)', () => {
      it('is optional: an old cached copy lacks it', () => {
        expect(TripOverviewSchema.parse(overview)).not.toHaveProperty('organizerUsername');
      });

      it('carries the organizer nick', () => {
        expect(TripOverviewSchema.parse({ ...overview, organizerUsername: 'kacper_b' }).organizerUsername).toBe('kacper_b');
      });

      it('rejects an invalid nick', () => {
        const result = TripOverviewSchema.safeParse({ ...overview, organizerUsername: 'Kacper!' });
        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path)).toEqual([['organizerUsername']]);
      });
    });
  });
});
