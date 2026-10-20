import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

import { AvatarUriSchema } from '@/lib/avatar';
import { ProviderProfileSchema } from '@/schemas';

import { REQUEST_TIMEOUT_MS } from './fetch-timeout';

type Deps = {
  /** Where the unique part of the file name comes from; tests pass their own. */
  newId?: () => string;
  /** How long the download may take before it is aborted. */
  timeoutMs?: number;
};

/**
 * Downloads the account photo of a Google / Discord sign-in into the app's cache directory and returns the local `file://` uri
 * (theme-split-and-profile-prefill P7). The photo then goes through the same path as a gallery photo (`prepareAvatar`: at most 512 px,
 * JPEG, no EXIF) when the profile is saved.
 *
 * Defence in depth: the address is checked again with `ProviderProfileSchema` (https on the provider's own image host, nothing else)
 * and anything else is refused without a request. Every call writes its own file, so two downloads never share or overwrite one.
 * Rejects on a refused address, a non-2xx answer, no connection, or when `timeoutMs` passes (default: the app's request timeout).
 *
 * Uses expo-file-system's `File.downloadFileAsync(url, destination, { signal })`; the native side fails on a status outside 200-299.
 */
export async function downloadAvatar(url: string, { newId = randomUUID, timeoutMs = REQUEST_TIMEOUT_MS }: Deps = {}): Promise<string> {
  if (!ProviderProfileSchema.safeParse({ suggestedUsername: null, avatarUrl: url }).success) {
    throw new Error('Refused to download a photo that is not from Google or Discord');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const file = await File.downloadFileAsync(url, new File(Paths.cache, `avatar-${newId()}`), { signal: controller.signal });
    return AvatarUriSchema.parse(file.uri);
  } finally {
    clearTimeout(timer);
  }
}
