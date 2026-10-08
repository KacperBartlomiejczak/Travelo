import { RETRY_MAX_MS, retryDelayMs } from '@/data/budget-sync';

describe('retry delay (backoff)', () => {
  it('doubles from 1 s with each failed attempt', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([1000, 2000, 4000, 8000]);
  });

  it('stops growing at 5 minutes', () => {
    expect(RETRY_MAX_MS).toBe(5 * 60 * 1000);
    expect(retryDelayMs(9)).toBe(256000);
    expect(retryDelayMs(10)).toBe(RETRY_MAX_MS);
    expect(retryDelayMs(50)).toBe(RETRY_MAX_MS);
  });
});
