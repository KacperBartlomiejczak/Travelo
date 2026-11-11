import { tripDayCount } from '@/lib/trip-days';

describe('tripDayCount', () => {
  it('counts calendar days including the first and last', () => {
    expect(tripDayCount('2026-11-03', '2026-11-15')).toBe(13);
    expect(tripDayCount('2026-11-03', '2026-11-03')).toBe(1);
  });

  it('is not affected by DST changes', () => {
    expect(tripDayCount('2026-10-24', '2026-10-26')).toBe(3);
  });
});
