import { defaultTripId, deviceToday, tripSections } from '@/lib/trip-sections';
import type { TripListItem } from '@/schemas';

const TODAY = '2026-10-08';

function trip(id: string, startDate: string, endDate: string): TripListItem {
  return { id, name: id, startDate, endDate };
}

const ids = (trips: TripListItem[]) => trips.map((t) => t.id);

describe('tripSections (trips-drawer A2)', () => {
  it('keeps a trip upcoming until its last day is over: ongoing, ending today and starting today', () => {
    const { upcoming, past } = tripSections(
      [trip('ongoing', '2026-10-01', '2026-10-12'), trip('ends-today', '2026-10-02', TODAY), trip('starts-today', TODAY, '2026-10-20')],
      TODAY,
    );
    expect(ids(upcoming)).toEqual(['ongoing', 'ends-today', 'starts-today']);
    expect(past).toEqual([]);
  });

  it('makes a trip past from the day after its last day', () => {
    const { upcoming, past } = tripSections([trip('ended-yesterday', '2026-10-01', '2026-10-07')], TODAY);
    expect(upcoming).toEqual([]);
    expect(ids(past)).toEqual(['ended-yesterday']);
  });

  it('sorts upcoming trips by start date, soonest first; trips starting the same day keep their order', () => {
    const { upcoming } = tripSections(
      [
        trip('december', '2026-12-01', '2026-12-10'),
        trip('november-a', '2026-11-02', '2026-11-09'),
        trip('ongoing', '2026-10-01', '2026-10-12'),
        trip('november-b', '2026-11-02', '2026-11-05'),
      ],
      TODAY,
    );
    expect(ids(upcoming)).toEqual(['ongoing', 'november-a', 'november-b', 'december']);
  });

  it('sorts past trips by end date, most recently ended first', () => {
    const { past } = tripSections(
      [trip('spring', '2026-04-01', '2026-04-10'), trip('summer', '2026-07-01', '2026-07-20'), trip('winter', '2026-01-05', '2026-01-12')],
      TODAY,
    );
    expect(ids(past)).toEqual(['summer', 'spring', 'winter']);
  });

  it('splits a mixed list and leaves the input untouched', () => {
    const trips = [trip('past', '2026-04-01', '2026-04-10'), trip('next', '2026-11-02', '2026-11-09')];
    const copy = [...trips];
    expect(tripSections(trips, TODAY)).toEqual({ upcoming: [trips[1]], past: [trips[0]] });
    expect(trips).toEqual(copy);
  });

  it('gives two empty sections for no trips', () => {
    expect(tripSections([], TODAY)).toEqual({ upcoming: [], past: [] });
  });
});

describe('defaultTripId (trips-drawer A1)', () => {
  it('is the soonest upcoming or ongoing trip, never the oldest past trip', () => {
    const trips = [
      trip('old', '2025-05-01', '2025-05-10'),
      trip('later', '2026-12-01', '2026-12-10'),
      trip('ongoing', '2026-10-01', '2026-10-12'),
    ];
    expect(defaultTripId(trips, TODAY)).toBe('ongoing');
  });

  it('is the most recently ended trip when nothing is upcoming', () => {
    const trips = [trip('older', '2026-01-01', '2026-01-10'), trip('recent', '2026-09-01', '2026-09-20')];
    expect(defaultTripId(trips, TODAY)).toBe('recent');
  });

  it('is null when there are no trips', () => {
    expect(defaultTripId([], TODAY)).toBeNull();
  });
});

describe('deviceToday', () => {
  // Built from local wall-clock parts, so this holds in any device time zone. Jest cannot switch the zone inside a
  // test (process.env.TZ there does not reach Node), so the suite is also run with TZ=Pacific/Auckland / America/Los_Angeles.
  it('is the calendar date on the device, not in UTC', () => {
    expect(deviceToday(new Date(2026, 9, 9, 0, 30))).toBe('2026-10-09');
    expect(deviceToday(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08');
    expect(deviceToday(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});
