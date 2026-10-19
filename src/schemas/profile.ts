import { z } from 'zod';

import { HttpUrlSchema, IsoDateTimeSchema } from './common';
import { InterestTagSchema } from './interests';

// The signed-in user's own profile (auth-onboarding). A trip member may later link to it by `userId`;
// the two stay separate entities.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/**
 * The stored, already-normalised nick: starts with a letter, then lowercase letters, digits, `_` and `.`;
 * no `..`, no trailing `.`. The lookaheads keep the whole rule in one pattern (same rule as the `profiles` check).
 */
const USERNAME_PATTERN = new RegExp(
  `^(?!.*[.]{2})(?!.*[.]$)[a-z][a-z0-9_.]{${USERNAME_MIN_LENGTH - 1},${USERNAME_MAX_LENGTH - 1}}$`,
);
export const UsernameSchema = z.string().regex(USERNAME_PATTERN, { error: 'validation.usernameFormat' });
export type Username = z.infer<typeof UsernameSchema>;

/** Uppercase letters and digits without the look-alikes `0 O 1 I L` (31 characters). */
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LENGTH = 6;
export const FriendCodeSchema = z.string().regex(new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`));
export type FriendCode = z.infer<typeof FriendCodeSchema>;

export const ProfileSchema = z.object({
  id: z.uuid(),
  username: UsernameSchema,
  friendCode: FriendCodeSchema,
  interests: z.array(InterestTagSchema).min(1),
  avatarId: z.uuid().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

/** A profile with the signed URL of its avatar, present only when the profile has one (the server is a boundary). */
export const ShownProfileSchema = ProfileSchema.extend({ avatarUrl: HttpUrlSchema.optional() });
export type ShownProfile = z.infer<typeof ShownProfileSchema>;

/** The profile setup form: the nick is trimmed and lowercased before it is checked. */
export const ProfileSetupInputSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().min(1, { error: 'validation.usernameRequired' }).pipe(UsernameSchema)),
  interests: z.array(InterestTagSchema).min(1, { error: 'validation.interestsRequired' }),
  /** A photo picked from the gallery and not sent yet. */
  avatarUri: z.string().startsWith('file://').nullable(),
});
export type ProfileSetupInputValues = z.input<typeof ProfileSetupInputSchema>;
export type ProfileSetupInput = z.infer<typeof ProfileSetupInputSchema>;
