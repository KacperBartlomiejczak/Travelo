import { isExistingLocalTime, isoToLocal, localToIso, todayIn, zonedLocalToDate } from '@/lib/time';

describe('zonedLocalToDate', () => {
  it('converts winter time in Madrid (UTC+1)', () => {
    expect(zonedLocalToDate('2026-11-02T10:15', 'Europe/Madrid').toISOString()).toBe('2026-11-02T09:15:00.000Z');
  });

  it('converts summer time in Madrid (UTC+2)', () => {
    expect(zonedLocalToDate('2026-07-02T10:15', 'Europe/Madrid').toISOString()).toBe('2026-07-02T08:15:00.000Z');
  });

  it('handles half-hour offsets', () => {
    expect(zonedLocalToDate('2026-11-02T10:15', 'Asia/Kolkata').toISOString()).toBe('2026-11-02T04:45:00.000Z');
  });

  it('handles the day DST ends (Warsaw, 25 Oct 2026)', () => {
    // 03:00 CEST -> 02:00 CET; 12:00 is already winter time.
    expect(zonedLocalToDate('2026-10-25T12:00', 'Europe/Warsaw').toISOString()).toBe('2026-10-25T11:00:00.000Z');
  });
});

describe('localToIso', () => {
  it('returns ISO 8601 with the offset valid at that moment', () => {
    expect(localToIso('2026-11-02T10:15', 'Europe/Madrid')).toBe('2026-11-02T10:15:00+01:00');
    expect(localToIso('2026-07-02T10:15', 'Europe/Madrid')).toBe('2026-07-02T10:15:00+02:00');
    expect(localToIso('2026-11-02T10:15', 'Asia/Kolkata')).toBe('2026-11-02T10:15:00+05:30');
    expect(localToIso('2026-11-02T10:15', 'America/New_York')).toBe('2026-11-02T10:15:00-05:00');
  });
});

describe('todayIn', () => {
  afterEach(() => jest.useRealTimers());

  it('returns the calendar date in the given time zone', () => {
    jest.useFakeTimers({ now: new Date('2026-10-04T11:01:00Z') });
    expect(todayIn('Pacific/Auckland')).toBe('2026-10-05');
    expect(todayIn('Europe/Warsaw')).toBe('2026-10-04');
    expect(todayIn('Pacific/Honolulu')).toBe('2026-10-04');
  });
});

describe('isExistingLocalTime', () => {
  // Clocks go forward: Warsaw 29 Mar 2026 02:00 → 03:00, New York 8 Mar 2026 02:00 → 03:00.
  it.each([
    ['2026-03-29T02:00', 'Europe/Warsaw'],
    ['2026-03-29T02:30', 'Europe/Warsaw'],
    ['2026-03-08T02:30', 'America/New_York'],
  ])('rejects %p in %p (skipped when clocks go forward)', (local, timeZone) => {
    expect(isExistingLocalTime(local, timeZone)).toBe(false);
  });

  it.each([
    ['2026-03-29T01:59', 'Europe/Warsaw'],
    ['2026-03-29T03:00', 'Europe/Warsaw'],
    ['2026-10-25T02:30', 'Europe/Warsaw'], // occurs twice when clocks go back
    ['2026-11-02T10:15', 'Europe/Madrid'],
    ['2026-11-02T10:15', 'Asia/Kolkata'],
  ])('accepts %p in %p', (local, timeZone) => {
    expect(isExistingLocalTime(local, timeZone)).toBe(true);
  });
});

describe('isoToLocal', () => {
  it('gives the airport-local wall clock of an instant', () => {
    expect(isoToLocal('2026-11-02T10:15:00+01:00', 'Europe/Warsaw')).toBe('2026-11-02T10:15');
    // Same instant written in UTC: still Warsaw's wall clock.
    expect(isoToLocal('2026-11-02T09:15:00Z', 'Europe/Warsaw')).toBe('2026-11-02T10:15');
    expect(isoToLocal('2026-11-02T09:15:00Z', 'Asia/Bangkok')).toBe('2026-11-02T16:15');
  });

  it('round-trips with localToIso across a DST change', () => {
    for (const local of ['2027-03-28T01:30', '2027-03-28T03:30', '2026-10-25T02:30']) {
      expect(isoToLocal(localToIso(local, 'Europe/Warsaw'), 'Europe/Warsaw')).toBe(local);
    }
  });
});
