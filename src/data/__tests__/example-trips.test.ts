import { exampleTrips, startingTrips } from '@/data/example-trips';
import { defaultTripName } from '@/lib/trip-name';
import { deriveTripDates } from '@/lib/trip-dates';
import { CreateTripInputSchema } from '@/schemas';

// A day when Warsaw and Lisbon are on summer time, and one on winter time (the trips span DST changes).
describe.each(['2026-10-06', '2027-01-15', '2027-03-20'])('example trips on %s', (today) => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(`${today}T12:00:00Z`) });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives three valid trips (D8)', () => {
    const trips = exampleTrips(today);
    expect(trips).toHaveLength(3);
    trips.forEach((trip) => expect(CreateTripInputSchema.safeParse(trip).success).toBe(true));
  });

  it('starts every trip after today, each on a different day', () => {
    const starts = exampleTrips(today).map((trip) => deriveTripDates(trip.flights).startDate);
    starts.forEach((start) => expect(start > today).toBe(true));
    expect(new Set(starts).size).toBe(3);
  });

  it('names each trip with the default name', () => {
    exampleTrips(today).forEach((trip) => expect(trip.details.name).toBe(defaultTripName(trip.flights.outbound)));
  });

  it('includes a trip with a layover and a solo trip', () => {
    const trips = exampleTrips(today);
    expect(trips.some((trip) => trip.flights.outbound.length > 1)).toBe(true);
    expect(trips.some((trip) => trip.flights.companionCount === 0)).toBe(true);
  });
});

describe('startingTrips (D8)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-06T12:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts development builds with the example trips', () => {
    expect(startingTrips({ isDev: true, isTest: false }, '2026-10-06')).toEqual(exampleTrips('2026-10-06'));
  });

  it('starts release builds and tests with no trips', () => {
    expect(startingTrips({ isDev: false, isTest: false }, '2026-10-06')).toEqual([]);
    expect(startingTrips({ isDev: true, isTest: true }, '2026-10-06')).toEqual([]);
  });
});
