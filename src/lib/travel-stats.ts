import type { Airport, TripListItem } from '@/schemas';

import { tripDayCount } from './trip-days';
import { tripSections } from './trip-sections';

export type TravelStats = { trips: number; countries: number; days: number; flights: number; km: number };

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle (haversine) distance between two airports, in km. */
function distanceKm(from: Airport, to: Airport): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * The profile's numbers (profile-screen D7), over past trips only (ended before `today`, like the side panel's
 * past section). An airport missing from `airports` adds no country and no km, but its trip and flights still count.
 */
export function travelStats(trips: readonly TripListItem[], today: string, airports: readonly Airport[]): TravelStats {
  const byIata = new Map(airports.map((airport) => [airport.iata, airport]));
  const past = tripSections(trips, today).past;

  const countries = new Set<string>();
  let days = 0;
  let flights = 0;
  let km = 0;
  for (const trip of past) {
    const country = byIata.get(trip.destination)?.countryCode;
    if (country) countries.add(country);
    days += tripDayCount(trip.startDate, trip.endDate);
    flights += trip.flights.length;
    for (const { fromIata, toIata } of trip.flights) {
      const from = byIata.get(fromIata);
      const to = byIata.get(toIata);
      if (from && to) km += distanceKm(from, to);
    }
  }
  return { trips: past.length, countries: countries.size, days, flights, km: Math.round(km) };
}
