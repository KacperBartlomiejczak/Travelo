import { Paths } from 'expo-file-system';
import { Image } from 'expo-image';

/**
 * Forgets the previous user on the phone (profile-settings A7): files first, then SQLite. A file error is ignored, because the data that
 * matters is in SQLite and blocking would leave the user stuck on an error screen; a SQLite error still rejects.
 */
export async function clearUserDataOnPhone(clearStore: () => Promise<void>): Promise<void> {
  // Each step has its own guard so one failing cache does not skip the others.
  const steps: (() => unknown)[] = [() => Image.clearMemoryCache(), () => Image.clearDiskCache()];
  try {
    steps.push(...Paths.cache.list().map((entry) => () => entry.delete()));
  } catch {
    // ignored on purpose (A7)
  }
  for (const step of steps) {
    try {
      await step();
    } catch {
      // ignored on purpose (A7)
    }
  }
  await clearStore();
}
