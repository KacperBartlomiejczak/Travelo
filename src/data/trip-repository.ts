import { randomUUID } from 'expo-crypto';
import type { z } from 'zod';

import { localToIso } from '@/lib/time';
import { deriveTripDates } from '@/lib/trip-dates';
import { defaultTripId, deviceToday } from '@/lib/trip-sections';
import { photoPaths, sortTripPhotos } from '@/lib/trip-photos';
import {
  CreateTripInputSchema,
  CurrentTripSchema,
  DEFAULT_COVER,
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
  type CoverChoice,
  type CoverUrls,
  type CreateTripInput,
  type CurrentTrip,
  type FlightSegment,
  type FriendCode,
  type PickedPhoto,
  type SegmentInput,
  type Trip,
  type TripList,
  type TripMember,
  type TripPhoto,
  type TripPhotoList,
} from '@/schemas';

import type { SyncResult } from './budget-sync';
import { FriendAlreadyAddedError, OwnFriendCodeError, UnknownFriendCodeError } from './errors';
import { LOCAL_PROFILE_ID } from './profile-repository';

/**
 * Owner of every trip in the in-memory repository, which only tests use now (trips-supabase D8). It is the in-memory
 * profile's id, so in tests the signed-in user owns the trips they create (friend-invite A2).
 */
export const LOCAL_OWNER_ID = LOCAL_PROFILE_ID;

/**
 * What the wizard's input becomes. A friend found by code is a member with `userId: null`: only the server turns a code into an
 * account (friend-invite D12). `friendCodes` carries the codes next to the members, by member id (only members that have one).
 */
export type CreatedTrip = { trip: Trip; members: TripMember[]; friendCodes: Record<string, FriendCode>; segments: FlightSegment[] };

/** Where trips live: Supabase in the app (trips-supabase), in memory in tests. */
export interface TripRepository {
  /** Every trip of the organizer, for the side panel (trips-drawer D4). */
  list(): Promise<TripList>;
  /** The chosen trip, else the default trip (A1), with its members and flights; null when there are no trips. */
  current(): Promise<CurrentTrip | null>;
  /** Remembers the chosen trip on this phone (D2); no network. */
  select(tripId: string): Promise<void>;
  /**
   * Saves a new trip; it becomes the chosen trip (A3).
   * A `preset:` cover is stored as is. A `file://` cover (a gallery photo) needs the trip to exist first (the Storage rules check the owner),
   * so the trip is created with `DEFAULT_COVER`, then the photo is sent and the cover changed to `photo:<id>` (trip-covers D5).
   * If sending the photo fails, the trip stays on `DEFAULT_COVER` and `create` still resolves (Q1): the returned trip's cover is
   * `DEFAULT_COVER` although a `file://` cover was asked for, which is how the caller tells the photo did not make it.
   */
  create(input: z.input<typeof CreateTripInputSchema>): Promise<Trip>;
  /** Saves a new budget per person (whole amount in minor units, the trip's base currency) on the device. */
  setBudget(trip: Pick<Trip, 'id' | 'baseCurrency'>, amountMinor: number): Promise<void>;
  /** Sends budget changes still on the device; says when the next retry is due. */
  syncBudgets(): Promise<SyncResult>;
  /** True while the device holds budget changes the server has not got yet (pending or failed): signing out would lose them. */
  hasUnsentChanges(): Promise<boolean>;
  /**
   * Changes the trip's name and cover on the server; online only (trip-edit-menu D5).
   * A `file://` cover is sent first and stored as `photo:<id>`; a `preset:` cover is stored as is; an unchanged `photo:` cover sends nothing.
   * After the update, the files of a replaced `photo:` cover are removed (best effort: a failed removal does not reject).
   * If sending the photo fails it rejects and changes nothing (trip-covers D5).
   */
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
    // A gallery photo is sent after the trip exists (trip-covers Q1), so the trip starts on the default cover.
    coverImageUri: coverImageUri.startsWith('file://') ? DEFAULT_COVER : coverImageUri,
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

  const friendCodes = Object.fromEntries(
    input.friends.friends.flatMap((friend, i) => (friend.friendCode ? [[members[i].id, friend.friendCode] as const] : [])),
  );

  return { trip, members, friendCodes, segments };
}

const PHOTO_COVER_PREFIX = 'photo:';

/** Fake but valid http(s) urls for a gallery cover (`.invalid` is a reserved top-level domain); a preset has none. */
function fakeCoverUrls(trip: Pick<Trip, 'id' | 'coverImageUri'>): { coverUrls?: CoverUrls } {
  if (!trip.coverImageUri.startsWith(PHOTO_COVER_PREFIX)) return {};
  const { file, thumbnail } = photoPaths({ id: trip.coverImageUri.slice(PHOTO_COVER_PREFIX.length), tripId: trip.id });
  return { coverUrls: { url: `https://photos.invalid/${file}`, thumbnailUrl: `https://photos.invalid/${thumbnail}` } };
}

/** Trips in memory, lost on restart. Tests only (trips-supabase D8). */
export function createInMemoryTripRepository(
  deps: {
    now: () => Date;
    newId: () => string;
    /** Account ids by friend code (uppercase): what `create` links a friend to, like the server does (friend-invite D12). Default: none. */
    friendAccounts?: Readonly<Record<string, string>>;
    /** The organizer's own friend code: `create` refuses it like the server does. Default: none. */
    ownFriendCode?: string;
  } = { now: () => new Date(), newId: randomUUID },
): TripRepository {
  const build = (input: z.input<typeof CreateTripInputSchema>) =>
    buildTrip(CreateTripInputSchema.parse(input), { now: deps.now(), newId: deps.newId, ownerId: LOCAL_OWNER_ID });
  /**
   * Links the members that came with a friend code to the account that has it, with the server's errors (the helper behind
   * `create_trip`): an unknown code, the organizer's own code, the same account twice.
   */
  const linkFriends = ({ members, friendCodes }: CreatedTrip): TripMember[] => {
    const linked = new Set<string>();
    return members.map((member) => {
      const code = friendCodes[member.id];
      if (!code) return member;
      const userId = deps.friendAccounts?.[code];
      if (!userId) throw code === deps.ownFriendCode ? new OwnFriendCodeError('own-friend-code') : new UnknownFriendCodeError('unknown-friend-code');
      if (linked.has(userId)) throw new FriendAlreadyAddedError('friend-already-added');
      linked.add(userId);
      return TripMemberSchema.parse({ ...member, userId });
    });
  };
  /** No files here: a gallery photo just becomes a stored cover with a new id, like after a successful upload. */
  const storedCover = (choice: CoverChoice) => (choice.startsWith('file://') ? `${PHOTO_COVER_PREFIX}${deps.newId()}` : choice);
  const stored: CreatedTrip[] = [];
  const storedPhotos: TripPhoto[] = [];
  let selectedId: string | null = null;
  const summary = ({ trip, members }: CreatedTrip) =>
    TripSummarySchema.parse({ ...trip, ...fakeCoverUrls(trip), travellerCount: members.length + 1 });
  // Same order as the Supabase query: start date, then creation time.
  const list = (): TripList =>
    [...stored]
      .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate) || a.trip.createdAt.localeCompare(b.trip.createdAt))
      .map(({ trip, segments }) =>
        TripListItemSchema.parse({
          ...trip,
          ...fakeCoverUrls(trip),
          flights: segments.map(({ fromIata, toIata }) => ({ fromIata, toIata })),
        }),
      );
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
      created.members = linkFriends(created);
      const asked = CreateTripInputSchema.parse(input).details.coverImageUri;
      if (asked.startsWith('file://')) created.trip = TripSchema.parse({ ...created.trip, coverImageUri: storedCover(asked) });
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
    // No device copy here: `setBudget` applies at once and `syncBudgets` has nothing to send, so nothing is ever waiting.
    async hasUnsentChanges() {
      return false;
    },
    async updateDetails(tripId, input) {
      const { name, coverImageUri } = TripDetailsInputSchema.parse(input);
      const found = stored.find((entry) => entry.trip.id === tripId);
      if (!found) throw new Error('trip-not-found');
      // Like the Supabase repository: a stored cover can only be kept, never swapped for another one's.
      if (coverImageUri.startsWith(PHOTO_COVER_PREFIX) && coverImageUri !== found.trip.coverImageUri) throw new Error('cover-not-current');
      found.trip = TripSchema.parse({ ...found.trip, name, coverImageUri: storedCover(coverImageUri) });
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
