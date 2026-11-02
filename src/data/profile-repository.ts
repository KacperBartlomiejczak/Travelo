import { randomUUID } from 'expo-crypto';

import { AvatarUriSchema, avatarPath } from '@/lib/avatar';
import {
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_LENGTH,
  DeleteAccountInputSchema,
  FriendCodeInputSchema,
  ProfileEditInputSchema,
  ProfileSetupInputSchema,
  ShownProfileSchema,
  type FoundFriend,
  type ProfileEditInputValues,
  type ProfileSetupInputValues,
  type ShownProfile,
} from '@/schemas';

/** The nick is already used by another account (auth-onboarding D3). */
export class UsernameTakenError extends Error {}

/** The signed-in user's profile; `fromCache` is true when the server could not be reached and the copy on the phone is shown (D9). */
export type MyProfile = { profile: ShownProfile; fromCache: boolean };

/** Where the signed-in user's own profile lives: Supabase in the app (auth-onboarding), in memory in tests. */
export interface ProfileRepository {
  /** The own profile, or null when the user has none yet (profile setup comes next). Offline: the copy on the phone; rejects offline without one. */
  myProfile(): Promise<MyProfile | null>;
  /**
   * Creates the own profile from the setup form (the nick is normalised, a picked photo is uploaded). The server gives the friend code.
   * Rejects with `UsernameTakenError` when the nick is taken and with `ZodError` for invalid input, before any request. Online only.
   */
  createProfile(input: ProfileSetupInputValues): Promise<ShownProfile>;
  /**
   * The account that has this friend code (friend-invite D12): its nick and interests, or null when nobody has it.
   * The code is trimmed and uppercased; an invalid one rejects with `ZodError`, before any request. Signed-in users only.
   * Rejects with `ServerUnreachableError` offline: the check needs the server. The account's own code is found too;
   * telling the user "that is your code" is the caller's job (it knows its own code).
   */
  findByFriendCode(code: string): Promise<FoundFriend | null>;
  /**
   * Changes the own nick and interests (profile-settings). The nick is normalised; the answer is kept as the copy on the phone.
   * Rejects with `UsernameTakenError` when another account has the nick and with `ZodError` for invalid input, before any request. Online only.
   */
  updateProfile(input: ProfileEditInputValues): Promise<ShownProfile>;
  /**
   * Replaces the photo with the picked one (A6): reads the current avatar id, uploads under a new id, updates the row, then removes the old
   * file; failing to remove it is not a failure. A refused update (4xx) removes the new file; no answer or a 5xx keeps it, since the row may have changed.
   * Rejects with `ZodError` for a uri that is not a file, before any request. Online only.
   */
  changeAvatar(pickedUri: string): Promise<ShownProfile>;
  /** Removes the photo (A6): the row first (avatar id null), then the file; failing to remove the file is not a failure. Online only. */
  removeAvatar(): Promise<ShownProfile>;
  /**
   * Deletes the account and all its data through the `delete-account` Edge Function; `confirmUsername` is the nick as typed. Resolves when the
   * server confirmed; signing out is the caller's job. Rejects with `ServerUnreachableError` when the function gave no answer (the deletion may
   * have happened, retrying is safe), with `ZodError` for an empty nick or an unexpected answer, and with a plain error for any other failure.
   */
  deleteAccount(confirmUsername: string): Promise<void>;
}

/** The only user of the in-memory repository, which only tests use. */
export const LOCAL_PROFILE_ID = '00000000-0000-4000-8000-000000000001';

type InMemoryOptions = {
  /** Nicks other accounts already have; compared in lowercase. */
  takenUsernames?: readonly string[];
  /** Other accounts by their friend code (uppercase), for `findByFriendCode`. */
  friendAccounts?: Readonly<Record<string, FoundFriend>>;
  now?: () => Date;
  newId?: () => string;
};

function randomFriendCode(): string {
  return Array.from({ length: FRIEND_CODE_LENGTH }, () => FRIEND_CODE_ALPHABET[Math.floor(Math.random() * FRIEND_CODE_ALPHABET.length)]).join('');
}

/** One profile in memory, lost on restart. Tests only. */
export function createInMemoryProfileRepository({
  takenUsernames = [],
  friendAccounts = {},
  now = () => new Date(),
  newId = randomUUID,
}: InMemoryOptions = {}): ProfileRepository {
  let stored: ShownProfile | null = null;
  return {
    async myProfile() {
      return stored ? { profile: stored, fromCache: false } : null;
    },
    async createProfile(input) {
      const { username, interests, avatarUri } = ProfileSetupInputSchema.parse(input);
      if (takenUsernames.some((taken) => taken.toLowerCase() === username)) throw new UsernameTakenError('username-taken');
      const avatarId = avatarUri ? newId() : null;
      const time = now().toISOString();
      stored = ShownProfileSchema.parse({
        id: LOCAL_PROFILE_ID,
        username,
        friendCode: randomFriendCode(),
        interests,
        avatarId,
        createdAt: time,
        updatedAt: time,
        // No files here: a fake but valid http(s) url (`.invalid` is a reserved top-level domain).
        ...(avatarId ? { avatarUrl: `https://avatars.invalid/${avatarPath(LOCAL_PROFILE_ID, avatarId)}` } : {}),
      });
      return stored;
    },
    async findByFriendCode(code) {
      const normalised = FriendCodeInputSchema.parse(code);
      if (stored?.friendCode === normalised) return { username: stored.username, interests: stored.interests };
      return friendAccounts[normalised] ?? null;
    },
    async updateProfile(input) {
      const { username, interests } = ProfileEditInputSchema.parse(input);
      if (!stored) throw new Error('no-profile');
      if (takenUsernames.some((taken) => taken.toLowerCase() === username)) throw new UsernameTakenError('username-taken');
      stored = ShownProfileSchema.parse({ ...stored, username, interests, updatedAt: now().toISOString() });
      return stored;
    },
    async changeAvatar(pickedUri) {
      AvatarUriSchema.parse(pickedUri);
      if (!stored) throw new Error('no-profile');
      const avatarId = newId();
      stored = ShownProfileSchema.parse({
        ...stored,
        avatarId,
        avatarUrl: `https://avatars.invalid/${avatarPath(LOCAL_PROFILE_ID, avatarId)}`,
        updatedAt: now().toISOString(),
      });
      return stored;
    },
    async removeAvatar() {
      if (!stored) throw new Error('no-profile');
      const { avatarUrl: _gone, ...rest } = stored;
      stored = ShownProfileSchema.parse({ ...rest, avatarId: null, updatedAt: now().toISOString() });
      return stored;
    },
    async deleteAccount(confirmUsername) {
      DeleteAccountInputSchema.parse({ confirmUsername });
      if (stored?.username !== confirmUsername.trim().toLowerCase()) throw new Error('username-mismatch');
      stored = null;
    },
  };
}
