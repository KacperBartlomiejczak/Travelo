import { z } from 'zod';

import { CurrencyCodeSchema, IataCodeSchema, IsoDateSchema, IsoDateTimeSchema, MoneySchema } from './common';

const tripShape = {
  id: z.uuid(),
  ownerId: z.string().min(1),
  /** Defaults to the destination city (D13). */
  name: z.string().min(1),
  /** Airport where the outbound flight finally lands. */
  destination: IataCodeSchema,
  /** Derived from flights: outbound arrival date … return departure date (D4). */
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  baseCurrency: CurrencyCodeSchema,
  budgetPerPerson: MoneySchema,
  createdAt: IsoDateTimeSchema,
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
