import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { z } from 'zod';

import { avatarPath } from '@/lib/avatar';
import {
  FoundFriendSchema,
  FriendCodeInputSchema,
  HttpUrlSchema,
  ProfileSetupInputSchema,
  ShownProfileSchema,
  type Profile,
  type ShownProfile,
} from '@/schemas';

import { ensureSession } from './auth';
import type { Database } from './database.types';
import { ServerUnreachableError } from './errors';
import { currentUserEpoch, type LocalStore } from './local-store';
import { prepareAvatar } from './photo-files';
import { UsernameTakenError, type MyProfile, type ProfileRepository } from './profile-repository';
import { profileFromRow } from './profile-rows';
import { trace } from '@/lib/startupTrace';

/** The private Storage bucket of profile photos (auth-onboarding P2). */
const AVATAR_BUCKET = 'avatars';
/** Signed urls last one hour (auth-onboarding P2). */
const SIGNED_URL_SECONDS = 3600;
/** From this HTTP status on the server failed rather than refused the request. */
const SERVER_ERROR = 500;
/** Postgres' "unique violation". */
const UNIQUE_VIOLATION = '23505';
/** Storage paths are case-sensitive and the server accepts only lowercase ids in them (trip-photos step 5). */
const PathIdSchema = z.uuid().regex(/^[0-9a-f-]+$/);

/** Puts a local image into expo-image's disk cache under `cacheKey`, so showing it later needs no download. */
const writeToImageCache = (uri: string, cacheKey: string) => Image.writeToCacheAsync(uri, cacheKey);

type Deps = {
  supabase: SupabaseClient<Database>;
  /** Opening SQLite is async; the repository waits for it where it needs it. */
  local: Promise<LocalStore>;
  now?: () => Date;
  newId?: () => string;
  /** Downscales a picked profile photo (auth-onboarding P2); tests replace it, it needs native code. */
  prepareAvatar?: typeof prepareAvatar;
  /** Puts a local image into the image cache under a key; tests replace it, it needs native code. */
  seedImageCache?: (uri: string, cacheKey: string) => Promise<void>;
};

/** The profile that was just uploaded: its id, Storage path and the prepared local file. */
type Avatar = { id: string; path: string; uri: string };

/** The signed-in user's own profile in Supabase, with a copy on the device for offline (auth-onboarding D9). */
export function createSupabaseProfileRepository({
  supabase,
  local: localStore,
  now = () => new Date(),
  newId = randomUUID,
  prepareAvatar: prepare = prepareAvatar,
  seedImageCache: seed = writeToImageCache,
}: Deps): ProfileRepository {
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

  /** The signed url of the avatar, or undefined when there is none or it cannot be signed: the profile is shown without a photo then. */
  async function signAvatar(userId: string, avatarId: string | null): Promise<string | undefined> {
    if (!avatarId) return undefined;
    try {
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath(userId, avatarId), SIGNED_URL_SECONDS);
      if (error) return undefined;
      // Only http(s) may reach an image source.
      const url = HttpUrlSchema.safeParse(data.signedUrl);
      return url.success ? url.data : undefined;
    } catch {
      return undefined;
    }
  }

  /** Keeps the profile as the copy on the device (without the signed url) and gives it back with the avatar's url. */
  async function show(local: LocalStore, epoch: number, userId: string, profile: Profile): Promise<ShownProfile> {
    const avatarUrl = await signAvatar(userId, profile.avatarId);
    trace('profile:avatar');
    await local.cacheProfile(profile, now().toISOString(), epoch);
    trace('profile:cached');
    return ShownProfileSchema.parse({ ...profile, ...(avatarUrl ? { avatarUrl } : {}) });
  }

  /** The user's profile from the server, or null when there is none (the copy is then forgotten too). */
  async function fetchProfile(local: LocalStore, epoch: number, userId: string): Promise<ShownProfile | null> {
    const { data, error, status } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    trace('profile:select');
    if (error) throw failure(error, status);
    if (!data) {
      await local.clearProfile();
      return null;
    }
    return show(local, epoch, userId, profileFromRow(data));
  }

  /**
   * Offline: the copy, if it is the signed-in user's. `userId` is null when the session itself could not be read for lack of
   * connection (the token cannot be refreshed offline): the copy is then used as it is, since a new sign-in clears the
   * copy of the previous user first (D2). Throws `unreachable` when there is no usable copy.
   */
  async function cached(local: LocalStore, userId: string | null, unreachable: ServerUnreachableError): Promise<MyProfile> {
    trace('profile:fallback');
    const copy = await local.cachedProfile();
    if (!copy || (userId !== null && copy.id !== userId)) throw unreachable;
    return { profile: copy, fromCache: true };
  }

  /** Removes a file from Storage and ignores any failure: used where the file is already unneeded. */
  async function removeQuietly(path: string): Promise<void> {
    try {
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    } catch {
      // Ignored on purpose, see above.
    }
  }

  /** Seeding only saves the first show a download; the profile is saved, so a failure here is not the caller's failure. */
  async function seedQuietly(avatar: Avatar): Promise<void> {
    try {
      await seed(avatar.uri, `avatar:${avatar.id}`);
    } catch {
      // Ignored on purpose, see above.
    }
  }

  /** Prepares the picked photo and uploads it under a new id. A file that does not make it to Storage needs no removal. */
  async function uploadAvatar(userId: string, avatarId: string, pickedUri: string): Promise<Avatar> {
    const prepared = await prepare(pickedUri);
    const path = avatarPath(userId, avatarId);
    // A fresh id every time, so nothing to overwrite: a retry is a new file.
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, prepared.file, { contentType: 'image/jpeg', upsert: false });
    if (error) throw storageFailure(error);
    return { id: avatarId, path, uri: prepared.uri };
  }

  return {
    async myProfile() {
      trace('profile:start');
      const epoch = currentUserEpoch();
      const local = await localStore;
      trace('profile:store');
      let userId: string;
      try {
        userId = await signedIn();
      } catch (error) {
        if (error instanceof ServerUnreachableError) return cached(local, null, error);
        throw error;
      }
      trace('profile:session');
      try {
        const profile = await fetchProfile(local, epoch, userId);
        trace('profile:end');
        return profile ? { profile, fromCache: false } : null;
      } catch (error) {
        if (!(error instanceof ServerUnreachableError)) throw error;
        return cached(local, userId, error);
      }
    },

    async createProfile(input) {
      const epoch = currentUserEpoch();
      const { username, interests, avatarUri } = ProfileSetupInputSchema.parse(input);
      const userId = await signedIn();
      const local = await localStore;
      const avatarId = avatarUri ? newId() : null;
      if (avatarId) {
        // The user id and the avatar id become a Storage path: only lowercase UUIDs may get there.
        PathIdSchema.parse(userId);
        PathIdSchema.parse(avatarId);
      }
      const avatar = avatarUri && avatarId ? await uploadAvatar(userId, avatarId, avatarUri) : null;

      const { data, error, status } = await supabase
        .from('profiles')
        .insert({ id: userId, username, interests, avatar_id: avatarId })
        .select('*')
        .single();
      if (error) {
        // Unreachable, or a server error (5xx, e.g. a gateway timeout): the insert may have been applied, so the file may be in use. It stays (R9).
        if (status === 0) throw new ServerUnreachableError(error.message);
        if (status >= SERVER_ERROR) throw new Error(error.message);
        const violated = `${error.message} ${error.details ?? ''}`;
        if (error.code === UNIQUE_VIOLATION && violated.includes('profiles_pkey')) {
          // A retry after a lost answer that was in fact applied: the profile is there, so it is the result. If reading it
          // fails the file stays, since the stored profile may be using it.
          const stored = await fetchProfile(local, epoch, userId);
          if (stored) {
            if (avatar && stored.avatarId === avatar.id) await seedQuietly(avatar);
            else if (avatar) await removeQuietly(avatar.path);
            return stored;
          }
        }
        if (avatar) await removeQuietly(avatar.path);
        if (error.code === UNIQUE_VIOLATION && violated.includes('profiles_username_key')) throw new UsernameTakenError(error.message);
        throw new Error(error.message);
      }

      const profile = profileFromRow(data);
      const shown = await show(local, epoch, userId, profile);
      if (avatar && profile.avatarId === avatar.id) await seedQuietly(avatar);
      return shown;
    },

    async findByFriendCode(code) {
      const normalised = FriendCodeInputSchema.parse(code);
      // Signed in first: without a session the request would go out as `anon`, and the server would answer "nobody" (not "unknown code").
      await signedIn();
      const { data, error, status } = await supabase.rpc('find_profile_by_friend_code', { code: normalised });
      if (error) throw failure(error, status);
      // At most one account has a code; the rows carry nick and interests only (an extra field such as an id is dropped).
      return FoundFriendSchema.array().max(1).parse(data)[0] ?? null;
    },
  };
}
