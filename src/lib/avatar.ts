import { ProfileSetupInputSchema } from '@/schemas';

/** The profile photo's longer side is at most this many pixels, never upscaled (auth-onboarding P2). */
export const AVATAR_MAX_SIDE = 512;

/** Storage object path of a profile photo in the private `avatars` bucket: `<userId>/<avatarId>.jpg` (auth-onboarding P2). */
export function avatarPath(userId: string, avatarId: string): string {
  return `${userId}/${avatarId}.jpg`;
}

// Only a file on the phone can be uploaded later: a photo's uri (picked, or downloaded from the account) is checked with the setup form's own rule.
export const AvatarUriSchema = ProfileSetupInputSchema.shape.avatarUri.unwrap();
