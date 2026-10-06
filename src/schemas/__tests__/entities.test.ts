import { AirportSchema, FlightSegmentSchema, TripSchema, TripMemberSchema, TripSummarySchema } from '@/schemas';

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
  };

  it('accepts a complete airport', () => {
    expect(AirportSchema.safeParse(bcn).success).toBe(true);
  });

  it.each([
    ['lowercase country', { ...bcn, countryCode: 'es' }],
    ['unknown timezone', { ...bcn, timezone: 'Spain/Barcelona' }],
    ['empty city', { ...bcn, city: '' }],
    ['missing size flag', { ...bcn, large: undefined }],
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

  describe('TripSummary', () => {
    it('adds the traveller count, at least 1 (the organizer)', () => {
      expect(TripSummarySchema.safeParse({ ...trip, travellerCount: 4 }).success).toBe(true);
      expect(TripSummarySchema.safeParse({ ...trip, travellerCount: 0 }).success).toBe(false);
    });

    it('keeps the trip rules', () => {
      expect(TripSummarySchema.safeParse({ ...trip, endDate: '2026-11-01', travellerCount: 1 }).success).toBe(false);
    });
  });
});
