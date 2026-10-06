import { z } from 'zod';

export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
export const IATA_CODE_PATTERN = /^[A-Z]{3}$/;
export const LOCAL_DATE_TIME_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;

/** `LOCAL_DATE_TIME_PATTERN` and a real calendar date (no 31 April, 29 February only in leap years). */
export function isLocalDateTime(value: string): boolean {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
}

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value.length > 0;
  } catch {
    return false;
  }
}

/** ISO 4217 currency code, e.g. `EUR`. */
export const CurrencyCodeSchema = z.string().regex(CURRENCY_CODE_PATTERN);
/** IATA airport code, e.g. `BCN`. */
export const IataCodeSchema = z.string().regex(IATA_CODE_PATTERN);
/** IANA time zone, e.g. `Europe/Madrid`. */
export const IanaTimezoneSchema = z.string().refine(isTimeZone);
/** ISO 8601 date-time with offset, e.g. `2026-11-02T10:15:00+01:00`. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
/** ISO 8601 calendar date, e.g. `2026-11-02`. */
export const IsoDateSchema = z.iso.date();
/** Airport-local wall-clock time from a form, e.g. `2026-11-02T10:15` (no seconds, no offset). */
export const LocalDateTimeSchema = z.string().refine(isLocalDateTime);

/** Money is always integer minor units + currency. */
export const MoneySchema = z.object({
  amountMinor: z.int().nonnegative(),
  currency: CurrencyCodeSchema,
});
export type Money = z.infer<typeof MoneySchema>;
