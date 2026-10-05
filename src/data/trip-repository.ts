import { randomUUID } from 'expo-crypto';
import type { z } from 'zod';

import { destinationName } from '@/lib/airport-search';
import { localToIso } from '@/lib/time';
import { deriveTripDates } from '@/lib/trip-dates';
import {
  CreateTripInputSchema,
  FlightSegmentSchema,
  TripMemberSchema,
  TripSchema,
  TripSummarySchema,
  type CreateTripInput,
  type FlightSegment,
  type SegmentInput,
  type Trip,
  type TripMember,
  type TripSummary,
} from '@/schemas';

/** Owner of every trip until Supabase Auth exists (plan A3). */
export const LOCAL_OWNER_ID = 'local-user';

export type CreatedTrip = { trip: Trip; members: TripMember[]; segments: FlightSegment[] };

/** Where trips live. In memory now (D1); Supabase replaces the implementation later. */
export interface TripRepository {
  /** Trips soonest first. */
  list(): Promise<TripSummary[]>;
  create(input: z.input<typeof CreateTripInputSchema>): Promise<Trip>;
}

type Deps = { now: Date; newId: () => string };

function toSegments(
  segments: SegmentInput[],
  direction: 'outbound' | 'return',
  tripId: string,
  newId: () => string,
): FlightSegment[] {
  return segments.map((segment, order) => ({
    id: newId(),
    tripId,
    direction,
    order,
    ...(segment.flightNumber ? { flightNumber: segment.flightNumber } : {}),
    fromIata: segment.fromIata,
    toIata: segment.toIata,
    departAt: localToIso(segment.departAt, segment.departTz),
    departTz: segment.departTz,
    arriveAt: localToIso(segment.arriveAt, segment.arriveTz),
    arriveTz: segment.arriveTz,
  }));
}

/** Turns the wizard's input into the entities that get stored. */
export function buildTrip(input: CreateTripInput, { now, newId }: Deps): CreatedTrip {
  const tripId = newId();
  const { outbound } = input.flights;
  const destination = outbound[outbound.length - 1].toIata;
  const { budgetPerPerson } = input.budget;

  const trip = TripSchema.parse({
    id: tripId,
    ownerId: LOCAL_OWNER_ID,
    name: destinationName(destination),
    destination,
    ...deriveTripDates(input.flights),
    baseCurrency: budgetPerPerson.currency,
    budgetPerPerson,
    createdAt: now.toISOString(),
  });
  const members = input.friends.friends.map((friend) =>
    TripMemberSchema.parse({
      id: newId(),
      tripId,
      userId: null,
      displayName: friend.displayName,
      role: 'viewer',
      interests: friend.interests,
    }),
  );
  const segments = [
    ...toSegments(outbound, 'outbound', tripId, newId),
    ...toSegments(input.flights.return, 'return', tripId, newId),
  ].map((segment) => FlightSegmentSchema.parse(segment));

  return { trip, members, segments };
}

export function createInMemoryTripRepository(
  deps: { now: () => Date; newId: () => string } = { now: () => new Date(), newId: randomUUID },
): TripRepository {
  const stored: CreatedTrip[] = [];
  return {
    async list() {
      return stored
        .map(({ trip, members }) => TripSummarySchema.parse({ ...trip, travellerCount: members.length + 1 }))
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt));
    },
    async create(input) {
      const created = buildTrip(CreateTripInputSchema.parse(input), { now: deps.now(), newId: deps.newId });
      stored.push(created);
      return created.trip;
    },
  };
}
