import { AIRPORTS } from '@/data/airports';
import { travelStats } from '@/lib/travel-stats';
import type { Airport, TripListItem } from '@/schemas';

const TODAY = '2026-10-08';

function airport(iata: string, countryCode: string, latitude: number, longitude: number): Airport {
  return { iata, name: iata, city: iata, countryCode, timezone: 'UTC', currency: 'EUR', large: true, latitude, longitude };
}

const WAW = airport('WAW', 'PL', 52.1657, 20.9671);
const JFK = airport('JFK', 'US', 40.6394, -73.7793);
const FRA = airport('FRA', 'DE', 50.0379, 8.5622);
const BCN = airport('BCN', 'ES', 41.2974, 2.0833);
const MAD = airport('MAD', 'ES', 40.4983, -3.5676);
const LIS = airport('LIS', 'PT', 38.7813, -9.1359);
const AIRPORT_LIST = [WAW, JFK, FRA, BCN, MAD, LIS];

function trip(
  destination: string,
  startDate: string,
  endDate: string,
  flights: [string, string][] = [],
): TripListItem {
  return {
    id: `${destination}-${startDate}`,
    name: destination,
    coverImageUri: 'preset:auckland',
    destination,
    flights: flights.map(([fromIata, toIata]) => ({ fromIata, toIata })),
    startDate,
    endDate,
  };
}

const stats = (trips: TripListItem[]) => travelStats(trips, TODAY, AIRPORT_LIST);

describe('travelStats (profile-screen D7)', () => {
  it('is all zeros without trips', () => {
    expect(stats([])).toEqual({ trips: 0, countries: 0, days: 0, flights: 0, km: 0 });
  });

  it('counts a trip that ended yesterday, not an ongoing one (ends today) or a future one', () => {
    const past = trip('BCN', '2026-10-01', '2026-10-07');
    const ongoing = trip('MAD', '2026-10-02', TODAY);
    const future = trip('LIS', '2026-11-01', '2026-11-05');
    expect(stats([past, ongoing, future]).trips).toBe(1);
    expect(stats([ongoing, future])).toEqual({ trips: 0, countries: 0, days: 0, flights: 0, km: 0 });
  });

  it('counts distinct destination countries', () => {
    const barcelona = trip('BCN', '2026-01-01', '2026-01-05');
    const madrid = trip('MAD', '2026-02-01', '2026-02-05');
    const lisbon = trip('LIS', '2026-03-01', '2026-03-05');
    expect(stats([barcelona, madrid]).countries).toBe(1);
    expect(stats([barcelona, lisbon]).countries).toBe(2);
  });

  it('counts days inclusively and adds trips up', () => {
    expect(stats([trip('BCN', '2026-06-10', '2026-06-12')]).days).toBe(3);
    expect(stats([trip('BCN', '2026-06-10', '2026-06-12'), trip('LIS', '2026-07-01', '2026-07-02')]).days).toBe(5);
  });

  it('counts every flight segment', () => {
    expect(stats([trip('LIS', '2026-06-10', '2026-06-12', [['WAW', 'FRA'], ['FRA', 'LIS']])]).flights).toBe(2);
  });

  it('measures the great-circle distance of a segment, and there and back doubles it', () => {
    const one = stats([trip('JFK', '2026-06-10', '2026-06-20', [['WAW', 'JFK']])]).km;
    expect(Math.abs(one - 6860)).toBeLessThanOrEqual(15);
    const both = stats([trip('JFK', '2026-06-10', '2026-06-20', [['WAW', 'JFK'], ['JFK', 'WAW']])]).km;
    expect(Math.abs(both - 2 * one)).toBeLessThanOrEqual(1);
  });

  it('sums the distances first and rounds once at the end', () => {
    // On the equator one segment is exactly 100.4 km: rounding each gives 200, rounding the sum gives 201.
    const longitude = (100.4 * 180) / (Math.PI * 6371);
    const west = airport('AAA', 'PL', 0, 0);
    const east = airport('BBB', 'PL', 0, longitude);
    const result = travelStats([trip('BBB', '2026-06-10', '2026-06-12', [['AAA', 'BBB'], ['AAA', 'BBB']])], TODAY, [west, east]);
    expect(result.km).toBe(201);
  });

  it('counts a trip and a flight to an unknown airport, but adds no country and no km', () => {
    const result = stats([trip('XXX', '2026-06-10', '2026-06-12', [['WAW', 'XXX']])]);
    expect(result).toEqual({ trips: 1, countries: 0, days: 3, flights: 1, km: 0 });
  });

  it('works with the bundled airport list', () => {
    const result = travelStats([trip('JFK', '2026-06-10', '2026-06-20', [['WAW', 'JFK']])], TODAY, AIRPORTS);
    expect(result.countries).toBe(1);
    expect(Math.abs(result.km - 6860)).toBeLessThanOrEqual(15);
  });
});
