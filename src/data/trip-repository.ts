import { randomUUID } from 'expo-crypto';
import type { z } from 'zod';

import { localToIso } from '@/lib/time';
import { deriveTripDates } from '@/lib/trip-dates';
import {
  CreateTripInputSchema,
  FlightSegmentSchema,
  NearestTripSchema,
  TripMemberSchema,
  TripSchema,
  TripBudgetFormSchema,
  TripSummarySchema,
  type CreateTripInput,
  type FlightSegment,
  type NearestTrip,
  type SegmentInput,
  type Trip,
  type TripMember,
} from '@/schemas';

import type { SyncResult } from './budget-sync';

/** Owner of every trip in the in-memory repository, which only tests use now (trips-supabase D8). */
export const LOCAL_OWNER_ID = 'local-user';

export type CreatedTrip = { trip: Trip; members: TripMember[]; segments: FlightSegment[] };

/** Where trips live: Supabase in the app (trips-supabase), in memory in tests. */
export interface TripRepository {
  /** The soonest trip with its members and flights, or null when there are none. */
  nearest(): Promise<NearestTrip | null>;
  create(input: z.input<typeof CreateTripInputSchema>): Promise<Trip>;
  /** Saves a new budget per person (whole amount in minor units, the trip's base currency) on the device. */
  setBudget(trip: Pick<Trip, 'id' | 'baseCurrency'>, amountMinor: number): Promise<void>;
  /** Sends budget changes still on the device; says when the next retry is due. */
  syncBudgets(): Promise<SyncResult>;
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

/** Trips in memory, lost on restart. Tests only (trips-supabase D8). */
export function createInMemoryTripRepository(
  deps: { now: () => Date; newId: () => string } = { now: () => new Date(), newId: randomUUID },
): TripRepository {
  const build = (input: z.input<typeof CreateTripInputSchema>) =>
    buildTrip(CreateTripInputSchema.parse(input), { now: deps.now(), newId: deps.newId, ownerId: LOCAL_OWNER_ID });
  const stored: CreatedTrip[] = [];
  const summary = ({ trip, members }: CreatedTrip) => TripSummarySchema.parse({ ...trip, travellerCount: members.length + 1 });
  const soonestFirst = () =>
    [...stored].sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate) || a.trip.createdAt.localeCompare(b.trip.createdAt));
  return {
    async nearest() {
      const [first] = soonestFirst();
      if (!first) return null;
      const overview = { trip: summary(first), members: first.members, segments: first.segments };
      return NearestTripSchema.parse({ overview, budgetSyncStatus: 'synced', fromCache: false });
    },
    async create(input) {
      const created = build(input);
      stored.push(created);
      return created.trip;
    },
    async setBudget(trip, amountMinor) {
      const { budgetPerPerson } = TripBudgetFormSchema.parse({ budgetPerPerson: { amountMinor, currency: trip.baseCurrency } });
      const found = stored.find((entry) => entry.trip.id === trip.id);
      if (found) found.trip = TripSchema.parse({ ...found.trip, budgetPerPerson, budgetUpdatedAt: deps.now().toISOString() });
    },
    async syncBudgets() {
      return { nextAttemptAt: null };
    },
  };
}
