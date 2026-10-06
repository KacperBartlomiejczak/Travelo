import type { Money } from '@/schemas';

// ISO 4217 exponents that differ from the default of 2. Not taken from Intl: its digits are display
// preferences that differ from ISO and between engines (ICU says 0 for HUF, IDR, IQD).
const MINOR_DIGITS: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0,
  XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  CLF: 4, UYW: 4,
};

/** Number of minor-unit digits of an ISO 4217 currency (EUR → 2, JPY → 0, KWD → 3). */
export function currencyMinorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

function decimalSeparator(locale: string): string {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
}

/**
 * Parses a typed amount into integer minor units, or null if it is not a valid non-negative amount.
 * Spaces are ignored. With a "," decimal locale (pl) a "." is accepted as the decimal separator too;
 * with a "." decimal locale (en) "," is only accepted as a thousands separator.
 */
export function parseAmountToMinor(text: string, currency: string, locale: string): number | null {
  let normalized = text.replace(/\s/g, '');
  if (decimalSeparator(locale) === ',') {
    if (normalized.includes(',') && normalized.includes('.')) return null;
    normalized = normalized.replace(',', '.');
  } else if (normalized.includes(',')) {
    if (!/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(normalized)) return null;
    normalized = normalized.replace(/,/g, '');
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  const digits = currencyMinorDigits(currency);
  if (fraction.length > digits) return null;

  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
  return Number.isSafeInteger(minor) ? minor : null;
}

/** "120 PLN", "120,50 PLN" — amount, then currency code, joined by a no-break space (design-context §4.3). */
export function formatMoney(money: Money, locale: string): string {
  const digits = currencyMinorDigits(money.currency);
  const scale = 10 ** digits;
  const fractionDigits = money.amountMinor % scale === 0 ? 0 : digits;
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(money.amountMinor / scale);
  return `${amount} ${money.currency}`;
}
