import type { TFunction } from 'i18next';

import { isLocalDateTime, isTimeZone, type SegmentInput } from '@/schemas';

import { isExistingLocalTime, zonedLocalToDate } from './time';

type Arrival = Pick<SegmentInput, 'toIata' | 'arriveAt' | 'arriveTz'>;
type Departure = Pick<SegmentInput, 'departAt' | 'departTz'>;

const MINUTE_MS = 60_000;

function instant(local: string, timeZone: string): number | null {
  if (!isLocalDateTime(local) || !isTimeZone(timeZone) || !isExistingLocalTime(local, timeZone)) return null;
  return zonedLocalToDate(local, timeZone).getTime();
}

/** Minutes on the ground between two segments; null while incomplete or when the times overlap. */
export function layoverMinutes(previous: Arrival, next: Departure): number | null {
  const landed = instant(previous.arriveAt, previous.arriveTz);
  const leaves = instant(next.departAt, next.departTz);
  if (landed === null || leaves === null || leaves <= landed) return null;
  return Math.round((leaves - landed) / MINUTE_MS);
}

/** Minutes on the ground between two saved segments, from their stored instants; null when they overlap. */
export function savedLayoverMinutes(previous: { arriveAt: string }, next: { departAt: string }): number | null {
  const minutes = Math.round((Date.parse(next.departAt) - Date.parse(previous.arriveAt)) / MINUTE_MS);
  return minutes > 0 ? minutes : null;
}

/** Layovers of one direction (outbound or return), derived from consecutive segments. */
export function getLayovers(segments: (Arrival & Departure)[]): { airportIata: string; minutes: number }[] {
  return segments.slice(1).flatMap((next, i) => {
    const minutes = layoverMinutes(segments[i], next);
    return minutes === null ? [] : [{ airportIata: segments[i].toIata, minutes }];
  });
}

export function formatDuration(totalMinutes: number, t: TFunction): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t('duration.minutes', { minutes });
  if (minutes === 0) return t('duration.hours', { hours });
  return t('duration.hoursMinutes', { hours, minutes });
}
