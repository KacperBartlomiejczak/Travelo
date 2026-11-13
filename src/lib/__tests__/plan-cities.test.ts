import type { Airport } from '../../schemas/airport.ts';
import { planCandidateCities } from '../plan-cities';

// 1 degree of longitude on the equator = 111.195 km.
const KM = 1 / 111.195;
const ap = (iata: string, city: string, km: number, large = true, cc = 'XX'): Airport => ({
  iata,
  name: `${city} Airport`,
  city,
  countryCode: cc,
  timezone: 'UTC',
  currency: 'EUR',
  large,
  latitude: 0,
  longitude: km * KM,
});

const AIRPORTS = [
  ap('AAA', 'Alpha', 0),
  ap('BBB', 'Beta', 50),
  ap('CCC', 'Gamma', 51),
  ap('FFF', 'Phi', 50.4),
  ap('DDD', 'Delta', 20),
  ap('EEE', 'Epsilon', 30),
  ap('SML', 'Small', 10, false),
  ap('ALT', 'Alpha', 5), // second airport of Alpha
  ap('ZZZ', 'Alpha', 40, true, 'YY'), // other country, same city name
];
const base = { destination: 'AAA', scope: { kind: 'city_only' } as const, extraCities: [] as string[], dayCount: 5, airports: AIRPORTS };
const ids = (input: Parameters<typeof planCandidateCities>[0]) => planCandidateCities(input).map((c) => c.cityId);

describe('planCandidateCities', () => {
  it('city_only returns the destination with coordinates and distance 0', () => {
    expect(planCandidateCities(base)).toEqual([{ cityId: 'AAA', name: 'Alpha', distanceKm: 0, latitude: 0, longitude: 0 }]);
  });

  it('includes a city exactly at the radius and excludes radius + 1 km', () => {
    const airports = AIRPORTS.filter((a) => ['AAA', 'BBB', 'CCC', 'FFF'].includes(a.iata));
    expect(ids({ ...base, airports, scope: { kind: 'nearby', radiusKm: 50 } })).toEqual(['AAA', 'BBB']);
  });

  it('nearby adds large airports nearest first, one per city+country, capped at 3', () => {
    const res = planCandidateCities({ ...base, scope: { kind: 'nearby', radiusKm: 100 } });
    expect(res.map((c) => c.cityId)).toEqual(['AAA', 'DDD', 'EEE']);
    expect(res[1]!.distanceKm).toBe(20);
  });

  it('dedupes the same city name within a country but keeps another country', () => {
    const airports = AIRPORTS.filter((a) => ['AAA', 'ALT', 'ZZZ'].includes(a.iata));
    expect(ids({ ...base, airports, scope: { kind: 'nearby', radiusKm: 50 }, extraCities: ['ALT'] })).toEqual(['AAA', 'ZZZ']);
  });

  it('orders destination, arrival, departure, extra and dedupes duplicates', () => {
    expect(ids({ ...base, arrival: 'EEE', departure: 'AAA', extraCities: ['EEE', 'DDD'] })).toEqual(['AAA', 'EEE', 'DDD']);
  });

  it('caps at 3 cities', () => {
    expect(ids({ ...base, arrival: 'BBB', departure: 'CCC', extraCities: ['DDD', 'EEE'] })).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('ignores unknown IATA codes', () => {
    expect(ids({ ...base, arrival: 'QQQ', extraCities: ['WWW', 'DDD'] })).toEqual(['AAA', 'DDD']);
  });

  it('a 1-day trip uses the destination only', () => {
    expect(ids({ ...base, dayCount: 1, arrival: 'BBB', extraCities: ['DDD'], scope: { kind: 'nearby', radiusKm: 100 } })).toEqual(['AAA']);
  });

  it('small airports are not added by nearby', () => {
    expect(ids({ ...base, scope: { kind: 'nearby', radiusKm: 100 } })).not.toContain('SML');
  });
});
