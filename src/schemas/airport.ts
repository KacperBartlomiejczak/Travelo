import { z } from 'zod';

import { CurrencyCodeSchema, IanaTimezoneSchema, IataCodeSchema } from './common';

export const AirportSchema = z.object({
  iata: IataCodeSchema,
  name: z.string().min(1),
  city: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  timezone: IanaTimezoneSchema,
  /** Currency of the airport's country; the default trip currency (D8). */
  currency: CurrencyCodeSchema,
  /** OurAirports "large_airport"; ranks higher in search (D20). */
  large: z.boolean(),
  /** Degrees, WGS84; for great-circle distance between airports. */
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Airport = z.infer<typeof AirportSchema>;
