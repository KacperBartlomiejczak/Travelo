/** The profile photo's longer side is at most this many pixels, never upscaled (auth-onboarding P2). */
export const AVATAR_MAX_SIDE = 512;

/** Storage object path of a profile photo in the private `avatars` bucket: `<userId>/<avatarId>.jpg` (auth-onboarding P2). */
export function avatarPath(userId: string, avatarId: string): string {
  return `${userId}/${avatarId}.jpg`;
}
