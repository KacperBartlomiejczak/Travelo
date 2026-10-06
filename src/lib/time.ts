// Airport-local wall-clock times ("2026-11-02T10:15", as printed on a ticket) ↔ instants.
// Uses only Intl, so it works wherever the runtime has time-zone data.

const MINUTE_MS = 60_000;

// Offset of `timeZone` from UTC at the instant `utcMs`, in minutes (Madrid in winter → 60).
function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((wallAsUtc - utcMs) / MINUTE_MS);
}

function wallClockAsUtc(local: string): number {
  const [date, time] = local.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}

export function zonedLocalToDate(local: string, timeZone: string): Date {
  const wall = wallClockAsUtc(local);
  const firstGuess = wall - offsetMinutes(wall, timeZone) * MINUTE_MS;
  // A second pass corrects the guess when a DST change lies between `wall` and the real instant.
  return new Date(wall - offsetMinutes(firstGuess, timeZone) * MINUTE_MS);
}

/**
 * False for a wall clock the zone skips when clocks go forward (Warsaw 2026-03-29 02:30):
 * converted to an instant and back, it comes out as a different time.
 */
export function isExistingLocalTime(local: string, timeZone: string): boolean {
  const utcMs = zonedLocalToDate(local, timeZone).getTime();
  const wall = new Date(utcMs + offsetMinutes(utcMs, timeZone) * MINUTE_MS).toISOString().slice(0, 16);
  return wall === local;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function localToIso(local: string, timeZone: string): string {
  const offset = offsetMinutes(zonedLocalToDate(local, timeZone).getTime(), timeZone);
  return `${local}:00${formatOffset(offset)}`;
}

/** Today's calendar date in `timeZone`, e.g. `2026-10-04`. */
export function todayIn(timeZone: string): string {
  const now = Date.now();
  return new Date(now + offsetMinutes(now, timeZone) * MINUTE_MS).toISOString().slice(0, 10);
}

/** Airport-local wall clock (`2026-11-02T10:15`) of an ISO instant, for showing stored flight times. */
export function isoToLocal(iso: string, timeZone: string): string {
  const utcMs = new Date(iso).getTime();
  return new Date(utcMs + offsetMinutes(utcMs, timeZone) * MINUTE_MS).toISOString().slice(0, 16);
}
