import { z } from 'zod';

import { CurrencyCodeSchema, IataCodeSchema, IsoDateSchema, IsoDateTimeSchema, MoneySchema } from './common';
import { FlightSegmentSchema } from './flight';
import { TripMemberSchema } from './member';

export const TRIP_NAME_MAX_LENGTH = 60;

const tripShape = {
  id: z.uuid(),
  ownerId: z.string().min(1),
  /** The organizer's name; defaults to "<from city> → <destination city>" (trip-flight-tabs-name-cover D3). */
  name: z.string().min(1).max(TRIP_NAME_MAX_LENGTH),
  /** Device-local image URI while trips live in memory (trip-flight-tabs-name-cover A3). */
  coverImageUri: z.string().min(1).optional(),
  /** Airport where the outbound flight finally lands. */
  destination: IataCodeSchema,
  /** Derived from flights: outbound arrival date … return departure date (D4). */
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  baseCurrency: CurrencyCodeSchema,
  budgetPerPerson: MoneySchema,
  createdAt: IsoDateTimeSchema,
  /** When budgetPerPerson last changed; on sync the newer change wins (trips-supabase D1). */
  budgetUpdatedAt: IsoDateTimeSchema,
};

type TripShape = z.infer<z.ZodObject<typeof tripShape>>;

function addTripIssues(trip: TripShape, ctx: z.RefinementCtx) {
  if (trip.endDate < trip.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date is before start date' });
  }
  if (trip.budgetPerPerson.currency !== trip.baseCurrency) {
    ctx.addIssue({ code: 'custom', path: ['budgetPerPerson', 'currency'], message: 'Budget must be in the base currency' });
  }
}

export const TripSchema = z.object(tripShape).superRefine(addTripIssues);
export type Trip = z.infer<typeof TripSchema>;

/** Trip as shown in the trips list. */
export const TripSummarySchema = z
  .object({ ...tripShape, travellerCount: z.int().min(1) })
  .superRefine(addTripIssues);
export type TripSummary = z.infer<typeof TripSummarySchema>;

/** Everything the home screen shows about one trip (trip-flight-tabs-name-cover D4). */
export const TripOverviewSchema = z.object({
  trip: TripSummarySchema,
  members: z.array(TripMemberSchema),
  segments: z.array(FlightSegmentSchema),
});
export type TripOverview = z.infer<typeof TripOverviewSchema>;
