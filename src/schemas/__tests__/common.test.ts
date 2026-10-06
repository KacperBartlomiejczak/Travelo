import { CurrencyCodeSchema, IanaTimezoneSchema, IataCodeSchema, IsoDateSchema, IsoDateTimeSchema, LocalDateTimeSchema, MoneySchema } from '@/schemas';

describe('CurrencyCode', () => {
  it('accepts an ISO 4217 code', () => {
    expect(CurrencyCodeSchema.safeParse('EUR').success).toBe(true);
  });

  it.each(['eur', 'EU', 'EURO', ''])('rejects %p', (value) => {
    expect(CurrencyCodeSchema.safeParse(value).success).toBe(false);
  });
});

describe('IataCode', () => {
  it('accepts a three-letter code', () => {
    expect(IataCodeSchema.safeParse('BCN').success).toBe(true);
  });

  it.each(['bcn', 'BC', 'BCNX', 'B1N'])('rejects %p', (value) => {
    expect(IataCodeSchema.safeParse(value).success).toBe(false);
  });
});

describe('IanaTimezone', () => {
  it.each(['Europe/Madrid', 'Asia/Kolkata', 'UTC'])('accepts %p', (value) => {
    expect(IanaTimezoneSchema.safeParse(value).success).toBe(true);
  });

  it.each(['Mars/Base', '', 'Europe/Nowhere'])('rejects %p', (value) => {
    expect(IanaTimezoneSchema.safeParse(value).success).toBe(false);
  });
});

describe('IsoDateTime', () => {
  it('accepts a date-time with an offset', () => {
    expect(IsoDateTimeSchema.safeParse('2026-11-02T10:15:00+01:00').success).toBe(true);
  });

  it('rejects a date-time without an offset', () => {
    expect(IsoDateTimeSchema.safeParse('2026-11-02T10:15:00').success).toBe(false);
  });
});

describe('IsoDate', () => {
  it('accepts a calendar date and rejects a date-time', () => {
    expect(IsoDateSchema.safeParse('2026-11-02').success).toBe(true);
    expect(IsoDateSchema.safeParse('2026-11-02T10:15:00+01:00').success).toBe(false);
  });
});

describe('LocalDateTime', () => {
  it('accepts an airport-local date-time without seconds or offset', () => {
    expect(LocalDateTimeSchema.safeParse('2026-11-02T10:15').success).toBe(true);
  });

  it.each(['2026-11-02', '2026-11-02T10:15:00', '2026-11-02T10:15+01:00', '2026-13-02T10:15', '2026-11-02T25:00'])(
    'rejects %p',
    (value) => {
      expect(LocalDateTimeSchema.safeParse(value).success).toBe(false);
    },
  );

  it.each(['2026-02-31T10:00', '2026-04-31T10:00', '2027-02-29T10:00'])('rejects the impossible calendar date %p', (value) => {
    expect(LocalDateTimeSchema.safeParse(value).success).toBe(false);
  });

  it('accepts 29 February in a leap year', () => {
    expect(LocalDateTimeSchema.safeParse('2028-02-29T10:00').success).toBe(true);
  });
});

describe('Money', () => {
  it('accepts integer minor units with a currency', () => {
    expect(MoneySchema.safeParse({ amountMinor: 300000, currency: 'EUR' }).success).toBe(true);
    expect(MoneySchema.safeParse({ amountMinor: 0, currency: 'PLN' }).success).toBe(true);
  });

  it.each([
    ['float amount', { amountMinor: 10.5, currency: 'EUR' }],
    ['negative amount', { amountMinor: -1, currency: 'EUR' }],
    ['lowercase currency', { amountMinor: 100, currency: 'eur' }],
    ['missing currency', { amountMinor: 100 }],
  ])('rejects %s', (_, value) => {
    expect(MoneySchema.safeParse(value).success).toBe(false);
  });
});
