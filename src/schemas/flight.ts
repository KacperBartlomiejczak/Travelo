import { z } from 'zod';

import { IanaTimezoneSchema, IataCodeSchema, IsoDateTimeSchema } from './common';

export const FlightDirectionSchema = z.enum(['outbound', 'return', 'internal']);
export type FlightDirection = z.infer<typeof FlightDirectionSchema>;

export const FLIGHT_NUMBER_MAX_LENGTH = 8;

/** One take-off and one landing. Layovers are derived from consecutive segments, never stored. */
export const FlightSegmentSchema = z
  .object({
    id: z.uuid(),
    tripId: z.uuid(),
    direction: FlightDirectionSchema,
    order: z.int().nonnegative(),
    flightNumber: z.string().trim().min(2).max(FLIGHT_NUMBER_MAX_LENGTH).optional(),
    fromIata: IataCodeSchema,
    toIata: IataCodeSchema,
    departAt: IsoDateTimeSchema,
    departTz: IanaTimezoneSchema,
    arriveAt: IsoDateTimeSchema,
    arriveTz: IanaTimezoneSchema,
  })
  .refine((segment) => Date.parse(segment.arriveAt) > Date.parse(segment.departAt), { path: ['arriveAt'] });
export type FlightSegment = z.infer<typeof FlightSegmentSchema>;
