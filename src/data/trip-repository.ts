import { randomUUID } from 'expo-crypto';
import type { z } from 'zod';

import { localToIso } from '@/lib/time';
import { deriveTripDates } from '@/lib/trip-dates';
import {
  CreateTripInputSchema,
  FlightSegmentSchema,
  TripMemberSchema,
  TripSchema,
  TripOverviewSchema,
  TripSummarySchema,
  type CreateTripInput,
  type FlightSegment,
  type SegmentInput,
  type Trip,
  type TripMember,
  type TripOverview,
} from '@/schemas';

/** Owner of every trip in the in-memory repository, which only tests use now (trips-supabase D8). */
export const LOCAL_OWNER_ID = 'local-user';

export type CreatedTrip = { trip: Trip; members: TripMember[]; segments: FlightSegment[] };

/** Where trips live. In memory now (D1); Supabase replaces the implementation later. */
export interface TripRepository {
  /** The soonest trip with its members and flights, or null when there are none. */
  nearest(): Promise<TripOverview | null>;
  create(input: z.input<typeof CreateTripInputSchema>): Promise<Trip>;
}

type Deps = { now: Date; newId: () => string; ownerId: string };

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
export function buildTrip(input: CreateTripInput, { now, newId, ownerId }: Deps): CreatedTrip {
  const tripId = newId();
  const { outbound } = input.flights;
  const destination = outbound[outbound.length - 1].toIata;
  const { budgetPerPerson } = input.budget;
  const { name, coverImageUri } = input.details;

  const trip = TripSchema.parse({
    id: tripId,
    ownerId,
    name,
    ...(coverImageUri ? { coverImageUri } : {}),
    destination,
    ...deriveTripDates(input.flights),
    baseCurrency: budgetPerPerson.currency,
    budgetPerPerson,
    createdAt: now.toISOString(),
    budgetUpdatedAt: now.toISOString(),
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
  /** Trips it starts with, e.g. the example trips in development builds (D8). */
  initial: z.input<typeof CreateTripInputSchema>[] = [],
): TripRepository {
  const build = (input: z.input<typeof CreateTripInputSchema>) =>
    buildTrip(CreateTripInputSchema.parse(input), { now: deps.now(), newId: deps.newId, ownerId: LOCAL_OWNER_ID });
  const stored: CreatedTrip[] = initial.map(build);
  const summary = ({ trip, members }: CreatedTrip) => TripSummarySchema.parse({ ...trip, travellerCount: members.length + 1 });
  const soonestFirst = () =>
    [...stored].sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate) || a.trip.createdAt.localeCompare(b.trip.createdAt));
  return {
    async nearest() {
      const [first] = soonestFirst();
      return first ? TripOverviewSchema.parse({ trip: summary(first), members: first.members, segments: first.segments }) : null;
    },
    async create(input) {
      const created = build(input);
      stored.push(created);
      return created.trip;
    },
  };
}
