import { randomUUID } from 'expo-crypto';
import type { z } from 'zod';

import { localToIso } from '@/lib/time';
import { deriveTripDates } from '@/lib/trip-dates';
import { defaultTripId, deviceToday } from '@/lib/trip-sections';
import {
  CreateTripInputSchema,
  CurrentTripSchema,
  FlightSegmentSchema,
  SelectedTripSchema,
  TripListItemSchema,
  TripMemberSchema,
  TripSchema,
  TripBudgetFormSchema,
  TripSummarySchema,
  type CreateTripInput,
  type CurrentTrip,
  type FlightSegment,
  type SegmentInput,
  type Trip,
  type TripList,
  type TripMember,
} from '@/schemas';

import type { SyncResult } from './budget-sync';

/** Owner of every trip in the in-memory repository, which only tests use now (trips-supabase D8). */
export const LOCAL_OWNER_ID = 'local-user';

export type CreatedTrip = { trip: Trip; members: TripMember[]; segments: FlightSegment[] };

/** Where trips live: Supabase in the app (trips-supabase), in memory in tests. */
export interface TripRepository {
  /** Every trip of the organizer, for the side panel (trips-drawer D4). */
  list(): Promise<TripList>;
  /** The chosen trip, else the default trip (A1), with its members and flights; null when there are no trips. */
  current(): Promise<CurrentTrip | null>;
  /** Remembers the chosen trip on this phone (D2); no network. */
  select(tripId: string): Promise<void>;
  /** Saves a new trip; it becomes the chosen trip (A3). */
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
  let selectedId: string | null = null;
  const summary = ({ trip, members }: CreatedTrip) => TripSummarySchema.parse({ ...trip, travellerCount: members.length + 1 });
  // Same order as the Supabase query: start date, then creation time.
  const list = (): TripList =>
    [...stored]
      .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate) || a.trip.createdAt.localeCompare(b.trip.createdAt))
      .map(({ trip }) => TripListItemSchema.parse(trip));
  return {
    async list() {
      return list();
    },
    async current() {
      // A chosen trip that is gone is forgotten, like in the Supabase repository.
      if (!stored.some((entry) => entry.trip.id === selectedId)) selectedId = null;
      const id = selectedId ?? defaultTripId(list(), deviceToday(deps.now()));
      const found = stored.find((entry) => entry.trip.id === id);
      if (!found) return null;
      const overview = { trip: summary(found), members: found.members, segments: found.segments };
      return CurrentTripSchema.parse({ overview, budgetSyncStatus: 'synced', fromCache: false });
    },
    async select(tripId) {
      selectedId = SelectedTripSchema.parse({ tripId }).tripId;
    },
    async create(input) {
      const created = build(input);
      stored.push(created);
      selectedId = created.trip.id;
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
