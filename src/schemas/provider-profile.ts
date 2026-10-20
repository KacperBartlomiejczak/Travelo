import { z } from 'zod';

import { USERNAME_MAX_LENGTH, UsernameSchema, type Username } from './profile';

// What a Google / Discord sign-in tells us about the user, used to pre-fill the profile setup (nick and photo).
// Everything in `user_metadata` is untrusted external input: it is parsed leniently and never throws.

const GOOGLE_AVATAR_HOST = 'lh3.googleusercontent.com';
const DISCORD_AVATAR_HOST = 'cdn.discordapp.com';

const AVATAR_SIZE = 512;
const GOOGLE_SIZE_SUFFIX = `=s${AVATAR_SIZE}-c`;

/** Parses `raw` and returns it only when it is a plain `https` URL on exactly `host` (no credentials, no port). */
const parseAvatarUrl = (raw: string, host: string): URL | null => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const plain = url.protocol === 'https:' && url.username === '' && url.password === '' && url.port === '';
  return plain && url.hostname === host ? url : null;
};

/** The fields we read from `user.user_metadata`; unknown keys are ignored, a field of the wrong type counts as absent. */
const optionalString = z.string().optional().catch(undefined);
export const ProviderMetadataSchema = z.object({
  full_name: optionalString,
  name: optionalString,
  avatar_url: optionalString,
  picture: optionalString,
});
export type ProviderMetadata = z.infer<typeof ProviderMetadataSchema>;

export const ProviderProfileSchema = z.object({
  suggestedUsername: UsernameSchema.nullable(),
  avatarUrl: z
    .string()
    .refine((value) => [GOOGLE_AVATAR_HOST, DISCORD_AVATAR_HOST].some((host) => parseAvatarUrl(value, host) !== null), {
      error: 'validation.avatarUrl',
    })
    .nullable(),
});
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

/**
 * Turns a display name or username into a valid nick, or `null` when nothing usable is left.
 * Lowercase, no diacritics, only `a-z 0-9 _ .`, starts with a letter, no `..`, at most 20 characters, no trailing `.`.
 */
export const suggestUsername = (name: string): Username | null => {
  const candidate = name
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/^[^a-z]+/, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/\.+$/, '');
  const result = UsernameSchema.safeParse(candidate);
  return result.success ? result.data : null;
};

/** The first candidate that makes a valid nick. */
const firstUsername = (candidates: (string | undefined)[]): Username | null => {
  for (const candidate of candidates) {
    const username = candidate === undefined ? null : suggestUsername(candidate);
    if (username !== null) return username;
  }
  return null;
};

/** The photo URL to use: the first present of `avatar_url` / `picture`, checked and resized by `resize`; else `null`. */
const avatarFrom = (metadata: ProviderMetadata, host: string, resize: (url: URL) => string | null): string | null => {
  const raw = metadata.avatar_url ?? metadata.picture;
  if (raw === undefined) return null;
  const url = parseAvatarUrl(raw, host);
  return url === null ? null : resize(url);
};

const discordProfile = (metadata: ProviderMetadata): ProviderProfile => ({
  suggestedUsername: firstUsername([metadata.full_name, metadata.name?.split('#')[0]]),
  avatarUrl: avatarFrom(metadata, DISCORD_AVATAR_HOST, (url) => {
    if (url.pathname.startsWith('/embed/avatars/')) return null; // Discord's default avatar is not a photo of the user.
    url.pathname = /\.[a-z0-9]+$/i.test(url.pathname) ? url.pathname.replace(/\.[a-z0-9]+$/i, '.png') : `${url.pathname}.png`;
    url.search = `?size=${AVATAR_SIZE}`;
    url.hash = '';
    return url.toString();
  }),
});

const googleProfile = (metadata: ProviderMetadata): ProviderProfile => ({
  suggestedUsername: firstUsername([metadata.full_name, metadata.name]),
  avatarUrl: avatarFrom(metadata, GOOGLE_AVATAR_HOST, (url) => {
    url.pathname = /=s\d+(-c)?$/.test(url.pathname)
      ? url.pathname.replace(/=s\d+(-c)?$/, GOOGLE_SIZE_SUFFIX)
      : `${url.pathname}${GOOGLE_SIZE_SUFFIX}`;
    url.hash = '';
    return url.toString();
  }),
});

/**
 * A suggested nick and photo URL from the sign-in provider (`app_metadata.provider`) and its `user_metadata`.
 * Never throws; unknown providers and unusable data give `null`s. A photo URL is returned only for the provider's own host.
 */
export const providerProfile = (provider: unknown, metadata: unknown): ProviderProfile => {
  const parsed = ProviderMetadataSchema.safeParse(metadata);
  const data: ProviderMetadata = parsed.success ? parsed.data : {};
  if (provider === 'discord') return discordProfile(data);
  if (provider === 'google') return googleProfile(data);
  return { suggestedUsername: null, avatarUrl: null };
};
