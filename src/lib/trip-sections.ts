import type { TripListItem } from '@/schemas';

type TripSections = { upcoming: TripListItem[]; past: TripListItem[] };

/**
 * The side panel's sections (trips-drawer A2): upcoming = not ended yet (ongoing included), soonest start first;
 * past = ended before `today`, most recently ended first. Ties keep the list's order.
 */
export function tripSections(trips: readonly TripListItem[], today: string): TripSections {
  return {
    upcoming: trips.filter((trip) => trip.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    past: trips.filter((trip) => trip.endDate < today).sort((a, b) => b.endDate.localeCompare(a.endDate)),
  };
}

/** The trip shown when none was chosen (trips-drawer A1): the soonest upcoming, else the most recently ended. */
export function defaultTripId(trips: readonly TripListItem[], today: string): string | null {
  const { upcoming, past } = tripSections(trips, today);
  return (upcoming[0] ?? past[0])?.id ?? null;
}

/** The device's calendar date at `now`, e.g. `2026-10-08` (sections use the phone's date, A2). */
export function deviceToday(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
