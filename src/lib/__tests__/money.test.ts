import { currencyMinorDigits, formatAmountInput, formatMoney, parseAmountToMinor } from '@/lib/money';

describe('currencyMinorDigits', () => {
  it('knows how many minor digits a currency has', () => {
    expect(currencyMinorDigits('EUR')).toBe(2);
    expect(currencyMinorDigits('JPY')).toBe(0);
  });

  // ISO 4217, not the runtime's Intl data (ICU says 0 for HUF/IDR/IQD; engines differ).
  it.each([
    ['HUF', 2],
    ['IDR', 2],
    ['COP', 2],
    ['IQD', 3],
    ['KWD', 3],
    ['ISK', 0],
    ['KRW', 0],
    ['VND', 0],
    ['CLP', 0],
  ])('uses the ISO 4217 exponent for %s (%p)', (currency, digits) => {
    expect(currencyMinorDigits(currency)).toBe(digits);
  });
});

describe('parseAmountToMinor', () => {
  it.each([
    ['3000', 'PLN', 'pl', 300000],
    ['3 000,50', 'PLN', 'pl', 300050],
    ['3 000,5', 'PLN', 'pl', 300050],
    ['12.50', 'PLN', 'pl', 1250],
    ['1,234.5', 'USD', 'en', 123450],
    ['1234', 'USD', 'en', 123400],
    ['0,99', 'EUR', 'pl', 99],
    ['1000', 'JPY', 'en', 1000],
    ['3000', 'HUF', 'pl', 300000],
    ['0', 'PLN', 'pl', 0],
  ])('parses %p in %s (%s) as %p minor units', (text, currency, locale, expected) => {
    expect(parseAmountToMinor(text, currency, locale)).toBe(expected);
  });

  it.each([
    ['', 'PLN', 'pl'],
    ['abc', 'PLN', 'pl'],
    ['-5', 'PLN', 'pl'],
    ['12,345', 'PLN', 'pl'],
    ['1.5', 'JPY', 'en'],
    ['1,2,3', 'USD', 'en'],
    ['12..5', 'USD', 'en'],
    ['12,50', 'USD', 'en'],
    ['3.000', 'PLN', 'pl'],
  ])('rejects %p in %s (%s)', (text, currency, locale) => {
    expect(parseAmountToMinor(text, currency, locale)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('puts the amount before the currency code, joined by a no-break space', () => {
    expect(formatMoney({ amountMinor: 12000, currency: 'PLN' }, 'pl')).toBe('120\u00a0PLN');
    expect(formatMoney({ amountMinor: 300000, currency: 'EUR' }, 'en')).toBe('3,000\u00a0EUR');
  });

  it('shows minor units only when there are any', () => {
    expect(formatMoney({ amountMinor: 12050, currency: 'PLN' }, 'pl')).toBe('120,50\u00a0PLN');
    expect(formatMoney({ amountMinor: 1000, currency: 'JPY' }, 'en')).toBe('1,000\u00a0JPY');
  });

  it('formats with ISO 4217 minor units', () => {
    expect(formatMoney({ amountMinor: 300000, currency: 'HUF' }, 'en')).toBe('3,000\u00a0HUF');
    expect(formatMoney({ amountMinor: 1500, currency: 'KWD' }, 'en')).toBe('1.500\u00a0KWD');
  });

  it('groups thousands with the locale separator', () => {
    expect(formatMoney({ amountMinor: 3000000, currency: 'PLN' }, 'pl')).toBe('30\u00a0000\u00a0PLN');
  });
});

describe('formatAmountInput', () => {
  it('writes minor units back as the user would type them, without grouping', () => {
    expect(formatAmountInput(300000, 'THB', 'pl')).toBe('3000');
    expect(formatAmountInput(250050, 'EUR', 'pl')).toBe('2500,50');
    expect(formatAmountInput(250050, 'EUR', 'en')).toBe('2500.50');
    expect(formatAmountInput(120000, 'JPY', 'en')).toBe('120000');
    expect(formatAmountInput(1500, 'KWD', 'pl')).toBe('1,500');
  });

  it('parses back to the same amount', () => {
    for (const [minor, currency, locale] of [[250050, 'EUR', 'pl'], [99, 'PLN', 'en'], [1500, 'KWD', 'pl']] as const) {
      expect(parseAmountToMinor(formatAmountInput(minor, currency, locale), currency, locale)).toBe(minor);
    }
  });
});
