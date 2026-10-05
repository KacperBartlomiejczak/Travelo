import { perPersonPerDay, tripDayCount } from '@/lib/trip-days';

describe('tripDayCount', () => {
  it('counts calendar days including the first and last', () => {
    expect(tripDayCount('2026-11-03', '2026-11-15')).toBe(13);
    expect(tripDayCount('2026-11-03', '2026-11-03')).toBe(1);
  });

  it('is not affected by DST changes', () => {
    expect(tripDayCount('2026-10-24', '2026-10-26')).toBe(3);
  });
});

describe('perPersonPerDay', () => {
  it('splits the budget per person over the days, rounded to whole units (D35)', () => {
    expect(perPersonPerDay({ amountMinor: 300000, currency: 'EUR' }, 13)).toEqual({ amountMinor: 23100, currency: 'EUR' });
    expect(perPersonPerDay({ amountMinor: 1000, currency: 'JPY' }, 3)).toEqual({ amountMinor: 333, currency: 'JPY' });
  });
});
