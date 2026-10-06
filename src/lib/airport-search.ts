import { AIRPORTS } from '@/data/airports';
import type { Airport } from '@/schemas';

import { fold } from './text';

type Indexed = { airport: Airport; iata: string; city: string; cityWords: string[]; nameWords: string[] };

const words = (text: string) => text.split(/[^a-z0-9]+/).filter(Boolean);

// Folded search keys, built once per airport list.
const indexes = new WeakMap<readonly Airport[], Indexed[]>();
function indexOf(airports: readonly Airport[]): Indexed[] {
  let index = indexes.get(airports);
  if (!index) {
    index = airports.map((airport) => {
      const city = fold(airport.city);
      return { airport, iata: fold(airport.iata), city, cityWords: words(city), nameWords: words(fold(airport.name)) };
    });
    indexes.set(airports, index);
  }
  return index;
}

// Lower is better; null = no match.
function rank(entry: Indexed, query: string): number | null {
  if (entry.iata === query) return 0;
  if (entry.city.startsWith(query)) return 1;
  if (entry.cityWords.some((word) => word.startsWith(query))) return 2;
  if (entry.nameWords.some((word) => word.startsWith(query))) return 3;
  return null;
}

/** Airports matching an IATA code, the start of the city, or a word of the city or airport name. */
export function searchAirports(query: string, airports: readonly Airport[] = AIRPORTS, limit = 8): Airport[] {
  const folded = fold(query.trim());
  if (folded === '') return [];
  return indexOf(airports)
    .map((entry) => ({ entry, rank: rank(entry, folded) }))
    .filter((match): match is { entry: Indexed; rank: number } => match.rank !== null)
    // Within the same rank, large airports first (D20); otherwise the list order is kept.
    .sort((a, b) => a.rank - b.rank || Number(b.entry.airport.large) - Number(a.entry.airport.large))
    .slice(0, limit)
    .map((match) => match.entry.airport);
}

export function findAirport(iata: string, airports: readonly Airport[] = AIRPORTS): Airport | undefined {
  return airports.find((airport) => airport.iata === iata);
}

/** Default trip currency: the destination country's currency (D8). */
export function defaultCurrency(destinationIata: string): Airport['currency'] | undefined {
  return findAirport(destinationIata)?.currency;
}

/** The city of an airport, or its code if unknown; used in trip names and summaries. */
export function destinationName(iata: string): string {
  return findAirport(iata)?.city ?? iata;
}
