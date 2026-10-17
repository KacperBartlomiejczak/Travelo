import { randomUUID } from 'expo-crypto';
import type { z } from 'zod';

import { localToIso } from '@/lib/time';
import { deriveTripDates } from '@/lib/trip-dates';
import { defaultTripId, deviceToday } from '@/lib/trip-sections';
import { photoPaths, sortTripPhotos } from '@/lib/trip-photos';
import {
  CreateTripInputSchema,
  CurrentTripSchema,
  FlightSegmentSchema,
  PickedPhotoSchema,
  SelectedTripSchema,
  TripListItemSchema,
  TripMemberSchema,
  TripPhotoListSchema,
  TripPhotoSchema,
  TripSchema,
  TripBudgetFormSchema,
  TripDetailsInputSchema,
  TripSummarySchema,
  type CreateTripInput,
  type CurrentTrip,
  type FlightSegment,
  type PickedPhoto,
  type SegmentInput,
  type Trip,
  type TripList,
  type TripMember,
  type TripPhoto,
  type TripPhotoList,
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
  /** Changes the trip's name and cover on the server; online only (trip-edit-menu D5). */
  updateDetails(tripId: string, input: z.input<typeof TripDetailsInputSchema>): Promise<void>;
  /**
   * Deletes the trip on the server, then forgets the phone's copies of it (A5); online only (D8). A trip already gone counts as deleted (D13).
   * The trip's photo files in Storage are removed first, so none stay behind a deleted trip; if that fails the trip is not deleted (trip-photos P7).
   */
  delete(tripId: string): Promise<void>;
  /** The trip's photos in display order (D10, D13) with signed URLs (A2); offline: the phone's copy (D8). Rejects offline without a copy. */
  photos(tripId: string): Promise<TripPhotoList>;
  /**
   * Sends one picked photo (D2, D7, D14): prepared, thumbnail + file to Storage, then its row. Online only; the same photoId again adds nothing (A5).
   * `tripId` and `photoId` become part of the Storage paths, which the server accepts only in lowercase: pass lowercase UUIDs (`randomUUID()` gives one);
   * the Supabase repository rejects capitals before any network call.
   */
  addPhoto(tripId: string, photoId: string, picked: PickedPhoto): Promise<void>;
  /** Deletes the photo's row, then its files (R6). Online only. A photo already gone counts as deleted. */
  deletePhoto(photo: TripPhoto): Promise<void>;
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
  const storedPhotos: TripPhoto[] = [];
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
    async updateDetails(tripId, input) {
      const { name, coverImageUri } = TripDetailsInputSchema.parse(input);
      const found = stored.find((entry) => entry.trip.id === tripId);
      if (!found) throw new Error('trip-not-found');
      const { coverImageUri: _removed, ...rest } = found.trip;
      found.trip = TripSchema.parse({ ...rest, name, ...(coverImageUri ? { coverImageUri } : {}) });
    },
    async delete(tripId) {
      // An unknown id is already gone: success, like the Supabase repository (trip-edit-menu D13).
      const index = stored.findIndex((entry) => entry.trip.id === tripId);
      if (index >= 0) stored.splice(index, 1);
      // The photos go with the trip (trip-photos P7).
      for (let i = storedPhotos.length - 1; i >= 0; i--) if (storedPhotos[i].tripId === tripId) storedPhotos.splice(i, 1);
    },
    async photos(tripId) {
      // No files here: the urls are fake but valid http(s) ones (`.invalid` is a reserved top-level domain).
      const shown = storedPhotos
        .filter((photo) => photo.tripId === tripId)
        .map((photo) => {
          const { file, thumbnail } = photoPaths(photo);
          return { ...photo, url: `https://photos.invalid/${file}`, thumbnailUrl: `https://photos.invalid/${thumbnail}` };
        });
      return sortTripPhotos(TripPhotoListSchema.parse(shown));
    },
    async addPhoto(tripId, photoId, picked) {
      const { takenAt } = PickedPhotoSchema.parse(picked);
      const photo = TripPhotoSchema.parse({ id: photoId, tripId, ...(takenAt ? { takenAt } : {}), createdAt: deps.now().toISOString() });
      // Like the server: a photo needs a trip, and an id that exists already adds nothing (trip-photos A5).
      if (!stored.some((entry) => entry.trip.id === photo.tripId)) throw new Error('trip-not-found');
      if (!storedPhotos.some((entry) => entry.id === photo.id)) storedPhotos.push(photo);
    },
    async deletePhoto(photo) {
      const { id } = TripPhotoSchema.parse(photo);
      // An unknown photo is already gone: success, like the Supabase repository.
      const index = storedPhotos.findIndex((entry) => entry.id === id);
      if (index >= 0) storedPhotos.splice(index, 1);
    },
  };
}
