import i18n from '@/i18n';
import { formatDuration, getLayovers, layoverMinutes } from '@/lib/layovers';

const WAW_DXB = { toIata: 'DXB', arriveAt: '2026-11-02T18:30', arriveTz: 'Asia/Dubai' };
const DXB_BKK = { departAt: '2026-11-03T03:30', departTz: 'Asia/Dubai' };

describe('layoverMinutes', () => {
  it('returns the time on the ground between two segments', () => {
    expect(layoverMinutes(WAW_DXB, DXB_BKK)).toBe(540);
  });

  it('compares instants across time zones', () => {
    // Lands in Doha (+03:00) at 13:00 = 10:00 UTC; leaves Dubai (+04:00) at 16:00 = 12:00 UTC.
    const doh = { toIata: 'DOH', arriveAt: '2026-11-15T13:00', arriveTz: 'Asia/Qatar' };
    expect(layoverMinutes(doh, { departAt: '2026-11-15T16:00', departTz: 'Asia/Dubai' })).toBe(120);
  });

  it('counts real minutes across a DST change', () => {
    // Lisbon, 25 Oct 2026: clocks go back at 02:00, so 00:30 → 05:30 is 6 hours on the ground.
    const lis = { toIata: 'LIS', arriveAt: '2026-10-25T00:30', arriveTz: 'Europe/Lisbon' };
    expect(layoverMinutes(lis, { departAt: '2026-10-25T05:30', departTz: 'Europe/Lisbon' })).toBe(360);
  });

  it('returns null while a time or time zone is missing', () => {
    expect(layoverMinutes({ ...WAW_DXB, arriveAt: '' }, DXB_BKK)).toBeNull();
    expect(layoverMinutes(WAW_DXB, { ...DXB_BKK, departTz: '' })).toBeNull();
  });

  it('returns null for an impossible calendar date', () => {
    // 31 Nov does not exist; read as 1 Dec it would give a 90-minute layover.
    const arrival = { ...WAW_DXB, arriveAt: '2026-11-31T18:30' };
    expect(layoverMinutes(arrival, { ...DXB_BKK, departAt: '2026-12-01T20:00' })).toBeNull();
  });

  it('returns null for an arrival time skipped when clocks go forward', () => {
    // Warsaw, 28 Mar 2027: 02:00 → 03:00, so landing at 02:30 is not a real time.
    const waw = { toIata: 'WAW', arriveAt: '2027-03-28T02:30', arriveTz: 'Europe/Warsaw' };
    expect(layoverMinutes(waw, { departAt: '2027-03-28T06:00', departTz: 'Europe/Warsaw' })).toBeNull();
  });

  it('returns null when the next segment leaves before the previous one lands', () => {
    expect(layoverMinutes(WAW_DXB, { ...DXB_BKK, departAt: '2026-11-02T18:00' })).toBeNull();
  });
});

describe('getLayovers', () => {
  it('returns one layover per pair of consecutive segments', () => {
    const segments = [
      { ...WAW_DXB, departAt: '2026-11-02T10:00', departTz: 'Europe/Warsaw' },
      { ...DXB_BKK, toIata: 'BKK', arriveAt: '2026-11-03T12:45', arriveTz: 'Asia/Bangkok' },
    ];
    expect(getLayovers(segments)).toEqual([{ airportIata: 'DXB', minutes: 540 }]);
  });

  it('returns nothing for a direct flight', () => {
    expect(getLayovers([{ ...WAW_DXB, ...DXB_BKK }])).toEqual([]);
  });
});

describe('formatDuration', () => {
  const pl = i18n.getFixedT('pl');
  const en = i18n.getFixedT('en');

  it('formats hours and minutes', () => {
    expect(formatDuration(130, en)).toBe('2h 10m');
    expect(formatDuration(130, pl)).toBe('2 godz. 10 min');
  });

  it('drops the zero part', () => {
    expect(formatDuration(45, en)).toBe('45m');
    expect(formatDuration(540, en)).toBe('9h');
    expect(formatDuration(540, pl)).toBe('9 godz.');
  });
});
