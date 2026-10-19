import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { z } from 'zod';

import { photoPaths, sortTripPhotos } from '@/lib/trip-photos';
import { defaultTripId, deviceToday } from '@/lib/trip-sections';
import {
  CoverSchema,
  CreateTripInputSchema,
  CurrentTripSchema,
  PickedPhotoSchema,
  TripBudgetChangeSchema,
  TripBudgetFormSchema,
  TripDetailsInputSchema,
  TripPhotoListSchema,
  TripPhotoSchema,
  type Cover,
  type CoverUrls,
  type CurrentTrip,
  type LocalTripBudgetChange,
  type TripList,
  type TripOverview,
  type TripPhoto,
  type TripPhotoList,
} from '@/schemas';

import { ensureSession } from './auth';
import { syncBudgetChanges, type SyncResult } from './budget-sync';
import type { Database } from './database.types';
import { ServerUnreachableError } from './errors';
import { currentUserEpoch, type LocalStore } from './local-store';
import { preparePhoto } from './photo-files';
import { buildTrip, type TripRepository } from './trip-repository';
import { listItemFromRow, overviewFromRows, photoFromRow, toCreateTripArgs, toPhotoRow } from './trip-rows';

/** The private Storage bucket of trip photos (trip-photos A2). */
const PHOTO_BUCKET = 'trip-photos';
/** Signed urls last one hour (trip-photos A2). */
const SIGNED_URL_SECONDS = 3600;
/**
 * Storage signs 1 to 1000 paths per call (it answers 400 for 0 or 1001, checked against the local Storage API);
 * `remove()` is used with at most 1000 paths per call, and `list()` gives only 100 entries unless asked for more.
 */
const STORAGE_BATCH_SIZE = 1000;
/**
 * PostgREST answers at most `max_rows` rows per request (1000, `supabase/config.toml`; the hosted default is 1000 too),
 * and a trip has no photo limit (trip-photos D7), so the photo rows are read in pages of this size.
 */
const ROWS_PER_PAGE = 1000;
/** Storage paths are case-sensitive and the server accepts only lowercase ids in them (trip-photos step 5). */
const PathIdSchema = z.uuid().regex(/^[0-9a-f-]+$/);

/** A trip id becomes a Storage folder and a photo id a file name: only lowercase UUIDs may get there. Throws otherwise. */
function assertPathIds(...ids: string[]): void {
  for (const id of ids) PathIdSchema.parse(id);
}

const PHOTO_COVER_PREFIX = 'photo:';

/** The id in a `photo:<id>` cover; null for a preset or any value that is no stored cover. */
function photoCoverId(cover: string): string | null {
  const parsed = CoverSchema.safeParse(cover);
  return parsed.success && parsed.data.startsWith(PHOTO_COVER_PREFIX) ? parsed.data.slice(PHOTO_COVER_PREFIX.length) : null;
}

/** Puts a local image into expo-image's disk cache under `cacheKey`, so showing it later needs no download. */
const writeToImageCache = (uri: string, cacheKey: string) => Image.writeToCacheAsync(uri, cacheKey);

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

type Deps = {
  supabase: SupabaseClient<Database>;
  /** Opening SQLite is async; the repository waits for it where it needs it. */
  local: Promise<LocalStore>;
  now?: () => Date;
  newId?: () => string;
  /** Downscales a picked photo and makes its thumbnail (trip-photos D7, D14); tests replace it, it needs native code. */
  preparePhoto?: typeof preparePhoto;
  /** Puts a local image into the image cache under a key (trip-photos); tests replace it, it needs native code. */
  seedImageCache?: (uri: string, cacheKey: string) => Promise<void>;
};

/** Trips in Supabase (trips-supabase D1); budget changes saved on the device first and synced later. */
export function createSupabaseTripRepository({
  supabase,
  local: localStore,
  now = () => new Date(),
  newId = randomUUID,
  preparePhoto: prepare = preparePhoto,
  seedImageCache: seed = writeToImageCache,
}: Deps): TripRepository {
  async function signedIn(): Promise<string> {
    try {
      return await ensureSession(supabase.auth);
    } catch (error) {
      if (isAuthRetryableFetchError(error)) throw new ServerUnreachableError(error.message);
      throw error;
    }
  }

  function failure(error: { message: string }, status: number): Error {
    return status === 0 ? new ServerUnreachableError(error.message) : new Error(error.message);
  }

  /**
   * storage-js returns a request that got no answer (no connection, timeout) as a `StorageUnknownError`, which has no
   * `status`; an answer from the server (`StorageApiError`) always has one (storage-js `src/lib/common/fetch.ts`).
   */
  function storageFailure(error: { message: string; status: number | undefined }): Error {
    return error.status === undefined ? new ServerUnreachableError(error.message) : new Error(error.message);
  }

  /** Every trip, soonest start first; the device keeps the list as its copy (trips-drawer D3). */
  async function fetchList(local: LocalStore, epoch: number): Promise<TripList> {
    await signedIn();
    const { data, error, status } = await supabase
      .from('trips')
      .select('id, name, cover_image_uri, start_date, end_date')
      .order('start_date')
      .order('created_at');
    if (error) throw failure(error, status);
    const coverUrls = await signCovers(data);
    const list = data.map((row) => listItemFromRow(row, coverUrls.get(row.id)));
    await local.cacheList(list, now().toISOString(), epoch);
    return list;
  }

  /** One trip with its members and flights, or null when the server has no such trip (deleted or not visible). */
  async function fetchTrip(local: LocalStore, epoch: number, tripId: string): Promise<TripOverview | null> {
    await signedIn();
    const { data, error, status } = await supabase
      .from('trips')
      .select('*, trip_members(*), flight_segments(*)')
      .eq('id', tripId)
      .maybeSingle();
    if (error) throw failure(error, status);
    if (!data) return null;
    const { trip_members: members, flight_segments: segments, ...trip } = data;
    const overview = overviewFromRows(trip, members, segments, (await signCovers([trip])).get(trip.id));
    await local.cacheOverview(overview, now().toISOString(), epoch);
    return overview;
  }

  /** The chosen trip; when it is gone, the choice is forgotten and the default trip is shown (D2, A1). */
  async function fetchCurrent(local: LocalStore, epoch: number): Promise<TripOverview | null> {
    const chosen = await local.selectedTripId();
    if (chosen) {
      const overview = await fetchTrip(local, epoch, chosen);
      if (overview) return overview;
      await local.clearSelectedTrip();
    }
    const tripId = defaultTripId(await fetchList(local, epoch), deviceToday(now()));
    return tripId ? fetchTrip(local, epoch, tripId) : null;
  }

  /** Offline: the chosen trip's copy, or the default trip from the list copy (A5). Throws when there is no copy. */
  async function cachedCurrent(local: LocalStore, unreachable: ServerUnreachableError): Promise<TripOverview | null> {
    let tripId = await local.selectedTripId();
    if (!tripId) {
      const list = await local.cachedList();
      if (!list) throw unreachable;
      tripId = defaultTripId(list, deviceToday(now()));
      // The copy of the list says there are no trips (D5).
      if (!tripId) return null;
    }
    const copy = await local.cachedOverview(tripId);
    if (!copy) throw unreachable;
    return copy;
  }

  /** A budget change still on the device is shown instead of the server's older amount. */
  function withLocalBudget(overview: TripOverview, change: LocalTripBudgetChange | null, fromCache: boolean): CurrentTrip {
    if (!change) return CurrentTripSchema.parse({ overview, budgetSyncStatus: 'synced', fromCache });
    const newer = Date.parse(change.updatedAt) > Date.parse(overview.trip.budgetUpdatedAt);
    if (!newer) return CurrentTripSchema.parse({ overview, budgetSyncStatus: 'synced', fromCache });
    const trip = { ...overview.trip, budgetPerPerson: change.budgetPerPerson, budgetUpdatedAt: change.updatedAt };
    return CurrentTripSchema.parse({ overview: { ...overview, trip }, budgetSyncStatus: change.syncStatus, fromCache });
  }

  /** The trip's photos with signed urls, sorted (D10, D13); the phone keeps the list as its copy (D8). */
  async function fetchPhotos(local: LocalStore, epoch: number, tripId: string): Promise<TripPhotoList> {
    await signedIn();
    const photos: TripPhoto[] = [];
    // A full page may be followed by more; a short page is the last. Ordered by id, so the pages never overlap.
    for (let from = 0; ; from += ROWS_PER_PAGE) {
      const { data, error, status } = await supabase
        .from('trip_photos')
        .select('*')
        .eq('trip_id', tripId)
        .order('id')
        .range(from, from + ROWS_PER_PAGE - 1);
      if (error) throw failure(error, status);
      photos.push(...data.map(photoFromRow));
      if (data.length < ROWS_PER_PAGE) break;
    }
    const list = await showPhotos(photos);
    await local.cachePhotos(tripId, list, now().toISOString(), epoch);
    return list;
  }

  /** Signed urls by path, in batches Storage accepts. A path it cannot sign (missing, or not ours) is left out. */
  async function signPaths(wanted: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    // No paths, no batches: Storage is never asked to sign an empty list (it answers 400).
    for (const batch of chunks(wanted, STORAGE_BATCH_SIZE)) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(batch, SIGNED_URL_SECONDS);
      if (error) throw storageFailure(error);
      // An object it cannot sign (missing, or not ours) comes back with its own `error` and no url.
      for (const item of data) if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
    }
    return urls;
  }

  /**
   * The signed urls of the file and thumbnail of every gallery cover (trip-covers D5), by trip id. A preset has none,
   * and a cover Storage cannot sign gets none (the app then shows the default preset). A Storage failure rejects, like for photos.
   */
  async function signCovers(trips: { id: string; cover_image_uri: string }[]): Promise<Map<string, CoverUrls>> {
    const covers = trips.flatMap(({ id: tripId, cover_image_uri: cover }) => {
      const id = photoCoverId(cover);
      return id ? [{ tripId, ...photoPaths({ id, tripId }) }] : [];
    });
    const signed = await signPaths([...covers.map(({ file }) => file), ...covers.map(({ thumbnail }) => thumbnail)]);
    const urls = new Map<string, CoverUrls>();
    for (const { tripId, file, thumbnail } of covers) {
      const url = signed.get(file);
      const thumbnailUrl = signed.get(thumbnail);
      if (url && thumbnailUrl) urls.set(tripId, { url, thumbnailUrl });
    }
    return urls;
  }

  /** The photos with the urls of their file and thumbnail; one that cannot get both is left out, it cannot be shown. */
  async function showPhotos(photos: TripPhoto[]): Promise<TripPhotoList> {
    const paths = photos.map(photoPaths);
    const urls = await signPaths([...paths.map(({ file }) => file), ...paths.map(({ thumbnail }) => thumbnail)]);
    const shown = photos.flatMap((photo, i) => {
      const url = urls.get(paths[i].file);
      const thumbnailUrl = urls.get(paths[i].thumbnail);
      return url && thumbnailUrl ? [{ ...photo, url, thumbnailUrl }] : [];
    });
    // Parsing checks the urls too: only http(s) ones may reach an image source.
    return sortTripPhotos(TripPhotoListSchema.parse(shown));
  }

  /** Removes every file in the trip's Storage folder (trip-photos P7). Any failure rejects, so the caller keeps the trip. */
  async function removeTripFiles(tripId: string): Promise<void> {
    const bucket = supabase.storage.from(PHOTO_BUCKET);
    const paths: string[] = [];
    // A full page may be followed by more; a short page is the last. All names are read before any is removed,
    // since removing while paging would shift the offsets.
    for (let offset = 0; ; offset += STORAGE_BATCH_SIZE) {
      const { data, error } = await bucket.list(tripId, { limit: STORAGE_BATCH_SIZE, offset });
      if (error) throw storageFailure(error);
      paths.push(...data.map(({ name }) => `${tripId}/${name}`));
      if (data.length < STORAGE_BATCH_SIZE) break;
    }
    for (const batch of chunks(paths, STORAGE_BATCH_SIZE)) {
      const { error } = await bucket.remove(batch);
      if (error) throw storageFailure(error);
    }
  }

  /** Removes files from Storage and ignores any failure: used where the files are already unneeded or unusable. */
  async function removeQuietly(paths: string[]): Promise<void> {
    try {
      await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    } catch {
      // Ignored on purpose, see above.
    }
  }

  /**
   * Prepares a picked photo and uploads it as a cover of the trip under a new id: thumbnail first, then the file
   * (trip-covers C2). Anything it uploaded is removed again if a later upload fails, then it rejects.
   */
  async function uploadCover(tripId: string, uri: string): Promise<{ cover: Cover; files: string[] }> {
    const id = newId();
    const cover = CoverSchema.parse(`${PHOTO_COVER_PREFIX}${id}`);
    assertPathIds(tripId, id);
    const prepared = await prepare(uri);
    const paths = photoPaths({ id, tripId });
    const bucket = supabase.storage.from(PHOTO_BUCKET);
    const files = [paths.file, paths.thumbnail];
    try {
      for (const { path, bytes } of [
        { path: paths.thumbnail, bytes: prepared.thumbnail },
        { path: paths.file, bytes: prepared.file },
      ]) {
        // A fresh id every time, so nothing to overwrite: a retry is a new cover.
        const { error } = await bucket.upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (error) throw storageFailure(error);
      }
    } catch (error) {
      await removeQuietly(files);
      throw error;
    }
    return { cover, files };
  }

  /** Stores the trip's cover. Rejects when the server refuses or changes no row (RLS hides a trip that is not ours). */
  async function storeCover(tripId: string, patch: { name?: string; cover_image_uri: string }): Promise<void> {
    const { data, error, status } = await supabase.from('trips').update(patch).eq('id', tripId).select('id');
    if (error) throw failure(error, status);
    if (data.length === 0) throw new Error('trip-not-found');
  }

  // One sync at a time: a call made during a sync runs after it, so no change is sent twice in parallel.
  let syncing: Promise<SyncResult> = Promise.resolve({ nextAttemptAt: null });

  return {
    async list() {
      const epoch = currentUserEpoch();
      const local = await localStore;
      try {
        return await fetchList(local, epoch);
      } catch (error) {
        if (!(error instanceof ServerUnreachableError)) throw error;
        const copy = await local.cachedList();
        if (!copy) throw error;
        return copy;
      }
    },

    async current() {
      const epoch = currentUserEpoch();
      const local = await localStore;
      let overview: TripOverview | null;
      let fromCache = false;
      try {
        overview = await fetchCurrent(local, epoch);
      } catch (error) {
        if (!(error instanceof ServerUnreachableError)) throw error;
        overview = await cachedCurrent(local, error);
        fromCache = true;
      }
      if (!overview) return null;
      return withLocalBudget(overview, await local.budgetChange(overview.trip.id), fromCache);
    },

    async select(tripId) {
      const epoch = currentUserEpoch();
      await (await localStore).selectTrip(tripId, epoch);
    },

    async create(input) {
      const epoch = currentUserEpoch();
      const parsed = CreateTripInputSchema.parse(input);
      const ownerId = await signedIn();
      const created = buildTrip(parsed, { now: now(), newId, ownerId });
      const { error } = await supabase.rpc('create_trip', toCreateTripArgs(created));
      if (error) throw new Error(error.message);
      await (await localStore).selectTrip(created.trip.id, epoch);
      const asked = parsed.details.coverImageUri;
      if (!asked.startsWith('file://')) return created.trip;
      // The trip exists now, so the owner may upload into its folder. A photo that does not make it must not undo the
      // trip: it stays on the default cover and the caller can tell by the cover it gets back (trip-covers Q1).
      try {
        const { cover, files } = await uploadCover(created.trip.id, asked);
        try {
          await storeCover(created.trip.id, { cover_image_uri: cover });
        } catch (error) {
          // Unreachable: the update may have been applied, so the files may be in use; leftovers go with the trip folder (trip-photos P7).
          if (!(error instanceof ServerUnreachableError)) await removeQuietly(files);
          throw error;
        }
        return { ...created.trip, coverImageUri: cover };
      } catch {
        return created.trip;
      }
    },

    async setBudget(trip, amountMinor) {
      const epoch = currentUserEpoch();
      const { budgetPerPerson } = TripBudgetFormSchema.parse({ budgetPerPerson: { amountMinor, currency: trip.baseCurrency } });
      const change = TripBudgetChangeSchema.parse({ tripId: trip.id, budgetPerPerson, updatedAt: now().toISOString() });
      await (await localStore).saveBudgetChange(change, epoch);
    },

    async updateDetails(tripId, input) {
      const { name, coverImageUri } = TripDetailsInputSchema.parse(input);
      assertPathIds(tripId);
      await signedIn();
      // The stored cover is read first: a replaced gallery cover has its files removed afterwards, and a `photo:` choice
      // is only valid when it is that very cover (the picker cannot make a new one). A stale or crafted value must not
      // overwrite a newer cover, nor later get another cover's files removed on replacement.
      const { data, error, status } = await supabase.from('trips').select('cover_image_uri').eq('id', tripId).maybeSingle();
      if (error) throw failure(error, status);
      if (!data) throw new Error('trip-not-found');
      const replaced = data.cover_image_uri;
      if (coverImageUri.startsWith(PHOTO_COVER_PREFIX) && coverImageUri !== replaced) throw new Error('cover-not-current');
      const uploaded = coverImageUri.startsWith('file://') ? await uploadCover(tripId, coverImageUri) : null;
      const cover = uploaded ? uploaded.cover : coverImageUri;
      try {
        // Asking the row back: RLS hides a trip that is not ours (or gone) by changing no row, not by an error.
        await storeCover(tripId, { name, cover_image_uri: cover });
      } catch (error) {
        // Unreachable: the update may have been applied, so the files may be in use; leftovers go with the trip folder (trip-photos P7).
        if (uploaded && !(error instanceof ServerUnreachableError)) await removeQuietly(uploaded.files);
        throw error;
      }
      // Best effort: the cover is changed, so the old files are not shown anywhere; if they stay behind, the folder
      // is still removed with the trip (trip-photos P7).
      const oldId = replaced === cover ? null : photoCoverId(replaced);
      if (oldId) {
        const { file, thumbnail } = photoPaths({ id: oldId, tripId });
        await removeQuietly([file, thumbnail]);
      }
    },

    async delete(tripId) {
      assertPathIds(tripId);
      await signedIn();
      // The photos are personal: their files go first, so a failure here leaves none behind a deleted trip (trip-photos P7).
      await removeTripFiles(tripId);
      const { data, error, status } = await supabase.from('trips').delete().eq('id', tripId).select('id');
      if (error) throw failure(error, status);
      if (data.length === 0) {
        // No deleted row: the trip is already gone (success, D13) or RLS hides it from this delete because we
        // are not its owner. Only a trip we can still see is an error; the phone then keeps its copies.
        const check = await supabase.from('trips').select('id').eq('id', tripId).maybeSingle();
        if (check.error) throw failure(check.error, check.status);
        if (check.data) throw new Error('trip-not-deletable');
      }
      // The trip is gone. An upload may have landed after the first look at the folder; now the Storage insert policy
      // refuses new ones (it needs the trip) while the owner can still list and remove, so look once more. Best effort:
      // the trip is already deleted, so a failure here must not stop the phone from forgetting it (R6: files left behind).
      try {
        await removeTripFiles(tripId);
      } catch {
        // Ignored on purpose, see above.
      }
      await (await localStore).forgetTrip(tripId);
    },

    async photos(tripId) {
      assertPathIds(tripId);
      const epoch = currentUserEpoch();
      const local = await localStore;
      try {
        return await fetchPhotos(local, epoch, tripId);
      } catch (error) {
        if (!(error instanceof ServerUnreachableError)) throw error;
        const copy = await local.cachedPhotos(tripId);
        if (!copy) throw error;
        return copy;
      }
    },

    async addPhoto(tripId, photoId, picked) {
      assertPathIds(tripId, photoId);
      const { uri, takenAt } = PickedPhotoSchema.parse(picked);
      const photo = TripPhotoSchema.parse({ id: photoId, tripId, ...(takenAt ? { takenAt } : {}), createdAt: now().toISOString() });
      await signedIn();
      const prepared = await prepare(uri);
      const paths = photoPaths(photo);
      const bucket = supabase.storage.from(PHOTO_BUCKET);
      // The thumbnail first and the row last: a row is never seen without both of its files. A retry overwrites (A5).
      const uploads = [
        { path: paths.thumbnail, bytes: prepared.thumbnail },
        { path: paths.file, bytes: prepared.file },
      ];
      for (const { path, bytes } of uploads) {
        const { error } = await bucket.upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
        if (error) throw storageFailure(error);
      }
      // `ignoreDuplicates` is "on conflict do nothing": there is no update grant, so a plain upsert would be refused (A5).
      const { error, status } = await supabase.from('trip_photos').upsert(toPhotoRow(photo), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw failure(error, status);
      try {
        await seed(prepared.thumbnailUri, paths.thumbnail);
      } catch {
        // Seeding only saves the tile a download; the photo is sent, so a failure here is not the add's failure.
      }
    },

    async deletePhoto(photo) {
      const { id, tripId } = TripPhotoSchema.parse(photo);
      assertPathIds(id, tripId);
      await signedIn();
      // Matched by its trip too, so the row and the folder whose files are removed below always agree.
      const { data, error, status } = await supabase.from('trip_photos').delete().eq('id', id).eq('trip_id', tripId).select('id');
      if (error) throw failure(error, status);
      if (data.length === 0) {
        // No deleted row: the photo is already gone (success) or RLS hides it from this delete because we are not
        // the owner. Only a photo we can still see is an error.
        const check = await supabase.from('trip_photos').select('id').eq('id', id).eq('trip_id', tripId).maybeSingle();
        if (check.error) throw failure(check.error, check.status);
        if (check.data) throw new Error('photo-not-deletable');
      }
      // Best effort: the row is gone, so the photo is gone for the user. If the files stay behind they are not shown
      // anywhere and the owner can still remove them (trip-photos R6), so a failure here is not the delete's failure.
      const { file, thumbnail } = photoPaths({ id, tripId });
      await supabase.storage.from(PHOTO_BUCKET).remove([file, thumbnail]);
    },

    syncBudgets() {
      syncing = syncing.catch(() => undefined).then(async () => syncBudgetChanges({ supabase, local: await localStore, now }));
      return syncing;
    },
  };
}
