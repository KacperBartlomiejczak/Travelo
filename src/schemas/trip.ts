import { z } from 'zod';

import { CurrencyCodeSchema, IataCodeSchema, IsoDateSchema, IsoDateTimeSchema, MoneySchema } from './common';
import { CoverSchema, CoverUrlsSchema } from './cover';
import { FlightSegmentSchema } from './flight';
import { TripMemberSchema } from './member';
import { UsernameSchema } from './profile';

export const TRIP_NAME_MAX_LENGTH = 60;

const tripShape = {
  id: z.uuid(),
  ownerId: z.string().min(1),
  /** The organizer's name; defaults to "<from city> → <destination city>" (trip-flight-tabs-name-cover D3). */
  name: z.string().min(1).max(TRIP_NAME_MAX_LENGTH),
  /** The trip's cover: a bundled `preset:<id>` or a gallery photo in Storage `photo:<uuid>`; always set (trip-covers D1, D4, D5). */
  coverImageUri: CoverSchema,
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

/** Signed URLs exist only for a gallery cover (trip-covers D5); a preset has nothing to sign. */
function addCoverUrlsIssue(trip: { coverImageUri: string; coverUrls?: unknown }, ctx: z.RefinementCtx) {
  if (trip.coverUrls !== undefined && !trip.coverImageUri.startsWith('photo:')) {
    ctx.addIssue({ code: 'custom', path: ['coverUrls'], message: 'Only a gallery cover has signed URLs' });
  }
}

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

/** Trip as shown in the trips list. `coverUrls` come from the server for a gallery cover; a copy kept offline may lack them. */
export const TripSummarySchema = z
  .object({ ...tripShape, travellerCount: z.int().min(1), coverUrls: CoverUrlsSchema.optional() })
  .superRefine((trip, ctx) => {
    addTripIssues(trip, ctx);
    addCoverUrlsIssue(trip, ctx);
  });
export type TripSummary = z.infer<typeof TripSummarySchema>;

/** Everything the home screen shows about one trip (trip-flight-tabs-name-cover D4). */
export const TripOverviewSchema = z.object({
  trip: TripSummarySchema,
  members: z.array(TripMemberSchema),
  segments: z.array(FlightSegmentSchema),
  /** The organizer's nick, only when the signed-in user is a linked member, not the owner (friend-invite D4). Old cached copies lack it. */
  organizerUsername: UsernameSchema.optional(),
});
export type TripOverview = z.infer<typeof TripOverviewSchema>;

/** One trip in the side panel (trips-drawer D4): enough to show and sort it. */
export const TripListItemSchema = z
  .object({
    id: tripShape.id,
    name: tripShape.name,
    coverImageUri: tripShape.coverImageUri,
    coverUrls: CoverUrlsSchema.optional(),
    startDate: tripShape.startDate,
    endDate: tripShape.endDate,
  })
  .superRefine((trip, ctx) => {
    if (trip.endDate < trip.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date is before start date' });
    addCoverUrlsIssue(trip, ctx);
  });
export type TripListItem = z.infer<typeof TripListItemSchema>;

/** The side panel's list, also what the device keeps as its copy (trips-drawer D3). */
export const TripListSchema = z.array(TripListItemSchema);
export type TripList = z.infer<typeof TripListSchema>;

/** Device only: the trip the organizer chose in the side panel (trips-drawer D2). Row of SQLite `selected_trip`. */
export const SelectedTripSchema = z.object({ tripId: z.uuid() });
export type SelectedTrip = z.infer<typeof SelectedTripSchema>;
