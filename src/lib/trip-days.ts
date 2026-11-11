const DAY_MS = 86_400_000;

/** Calendar days of a trip, counting the first and the last day (2026-11-03…2026-11-15 → 13). */
export function tripDayCount(startDate: string, endDate: string): number {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS) + 1;
}
