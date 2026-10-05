import {
  androidDateValue,
  androidResultToLocal,
  androidTimeValue,
  formatDateRange,
  formatLocalDateTime,
  formatLocalShort,
  fromPickerDate,
  toPickerDate,
} from '@/lib/date-time';

// Runs `fn` as if the device were in `timeZone` (Node re-reads TZ when it changes).
function inDeviceTimeZone(timeZone: string, fn: () => void) {
  const original = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    fn();
  } finally {
    process.env.TZ = original;
  }
}

describe('formatLocalDateTime', () => {
  it('formats an airport-local time for the UI language, without shifting time zones', () => {
    expect(formatLocalDateTime('2026-11-02T10:15', 'pl')).toBe('2 lis 2026, 10:15');
    expect(formatLocalDateTime('2026-11-02T10:15', 'en')).toBe('Nov 2, 2026, 10:15 AM');
  });
});

describe('iOS picker conversion (picker shown in UTC)', () => {
  it('round-trips any wall clock, whatever the device time zone', () => {
    for (const zone of ['Europe/Warsaw', 'America/Los_Angeles', 'Asia/Jakarta', 'UTC']) {
      inDeviceTimeZone(zone, () => {
        expect(fromPickerDate(toPickerDate('2026-11-02T23:05'))).toBe('2026-11-02T23:05');
        // 02:30 on 29 Mar 2026 does not exist in Warsaw (DST starts) but is a real time in Bangkok.
        expect(fromPickerDate(toPickerDate('2026-03-29T02:30'))).toBe('2026-03-29T02:30');
      });
    }
  });
});

describe('Android dialogs', () => {
  it('passes the day as UTC midnight and reads the date dialog result in UTC', () => {
    inDeviceTimeZone('America/Los_Angeles', () => {
      expect(androidDateValue('2026-11-02T10:15').toISOString()).toBe('2026-11-02T00:00:00.000Z');
      // The date dialog returns UTC midnight of the chosen day; the time dialog a device-local time.
      const pickedDay = new Date(Date.UTC(2026, 10, 2));
      const pickedTime = new Date(2000, 0, 1, 10, 15);
      expect(androidResultToLocal(pickedDay, pickedTime)).toBe('2026-11-02T10:15');
    });
  });

  it('gives the time dialog the wall clock on a day without a DST change', () => {
    inDeviceTimeZone('Europe/Warsaw', () => {
      const value = androidTimeValue('2026-03-29T02:30');
      expect([value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes()]).toEqual([2000, 0, 1, 2, 30]);
    });
  });
});

describe('formatLocalShort', () => {
  it('shows day, month and time without the year, with idiomatic hours', () => {
    expect(formatLocalShort('2026-11-02T22:00', 'pl')).toBe('2 lis, 22:00');
    expect(formatLocalShort('2026-11-03T06:30', 'pl')).toBe('3 lis, 6:30');
    expect(formatLocalShort('2026-11-03T06:30', 'en')).toBe('Nov 3, 6:30 AM');
  });
});

describe('formatDateRange', () => {
  it('shows both years when the trip crosses New Year', () => {
    expect(formatDateRange('2026-12-28', '2027-01-03', 'pl')).toBe('28 gru 2026 – 3 sty 2027');
  });

  it('shows the first and last day with the year once', () => {
    expect(formatDateRange('2026-11-03', '2026-11-15', 'pl')).toBe('3 lis – 15 lis 2026');
    expect(formatDateRange('2026-11-03', '2026-11-15', 'en')).toBe('Nov 3 – Nov 15, 2026');
  });
});
