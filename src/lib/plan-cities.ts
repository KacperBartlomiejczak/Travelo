// Shared with the Deno Edge Function: no '@/' aliases; the airport list is passed in.
import type { Airport } from '../schemas/airport.ts';
import { MAX_PLAN_CITIES, type PlanScope } from '../schemas/trip-plan.ts';

export type PlanCity = { cityId: string; name: string; distanceKm: number; latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

// Great-circle (haversine) distance in km.
function distanceKm(a: Airport, b: Airport): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Returns [] for an unknown destination IATA: callers must treat that as an error.
export function planCandidateCities(input: {
  destination: string;
  scope: PlanScope;
  extraCities: readonly string[];
  arrival?: string;
  departure?: string;
  dayCount: number;
  airports: readonly Airport[];
}): PlanCity[] {
  const { airports } = input;
  const origin = airports.find((a) => a.iata === input.destination);
  if (!origin) return [];

  const toCity = (a: Airport): PlanCity => ({
    cityId: a.iata,
    name: a.city,
    distanceKm: Math.round(distanceKm(origin, a)),
    latitude: a.latitude,
    longitude: a.longitude,
  });
  const cityKey = (a: Airport) => `${a.city}|${a.countryCode}`;

  const result: Airport[] = [origin];
  const add = (a: Airport | undefined) => {
    if (a && result.length < MAX_PLAN_CITIES && !result.some((r) => cityKey(r) === cityKey(a))) result.push(a);
  };

  if (input.dayCount > 1) {
    for (const iata of [input.arrival, input.departure, ...input.extraCities]) {
      add(airports.find((a) => a.iata === iata));
    }
    if (input.scope.kind === 'nearby') {
      const { radiusKm } = input.scope;
      airports
        .filter((a) => a.large && distanceKm(origin, a) <= radiusKm)
        .sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
        .forEach(add);
    }
  }
  return result.map(toCity);
}
