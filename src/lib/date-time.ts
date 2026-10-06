// Airport-local wall-clock strings ("2026-11-02T10:15") for display and for native pickers.
// Nothing here goes through the device time zone: a wall clock that does not exist on the device
// (e.g. 02:30 on the day DST starts in Warsaw) is still a real time at the airport.

const pad = (value: number) => String(value).padStart(2, '0');

function parts(local: string) {
  const [date, time] = local.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return { year, month, day, hour, minute };
}

/** "2 lis 2026, 10:15" / "Nov 2, 2026, 10:15 AM" — the wall clock as entered, never shifted. */
export function formatLocalDateTime(local: string, locale: string): string {
  const { year, month, day, hour, minute } = parts(local);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

/** "2 lis, 22:00" / "Nov 2, 10:00 PM" — compact wall clock for lists (no leading zero on the hour). */
export function formatLocalShort(local: string, locale: string): string {
  const { year, month, day, hour, minute } = parts(local);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

/** "3 lis – 15 lis 2026" — calendar dates (YYYY-MM-DD), year once; both years across New Year. */
export function formatDateRange(startDate: string, endDate: string, locale: string): string {
  const date = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', ...options }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const startYear = startDate.slice(0, 4) === endDate.slice(0, 4) ? {} : { year: 'numeric' as const };
  return `${date(startDate, startYear)} – ${date(endDate, { year: 'numeric' })}`;
}

/** iOS picker value; the picker is shown with timeZoneName "UTC", so its fields are the wall clock. */
export function toPickerDate(local: string): Date {
  const { year, month, day, hour, minute } = parts(local);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

export function fromPickerDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** Android date dialog value: UTC midnight of the day (Material 3 reads the selection in UTC). */
export function androidDateValue(local: string): Date {
  const { year, month, day } = parts(local);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Android time dialog value: the wall clock in device time on 1 Jan 2000, a day without DST changes. */
export function androidTimeValue(local: string): Date {
  const { hour, minute } = parts(local);
  return new Date(2000, 0, 1, hour, minute);
}

/** Date dialog result (UTC midnight of the day) + time dialog result (device-local time) → wall clock. */
export function androidResultToLocal(day: Date, time: Date): string {
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`;
}
