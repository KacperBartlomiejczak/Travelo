import { launchImageLibraryAsync } from 'expo-image-picker';
import { useRef } from 'react';

import { AvatarUriSchema } from '@/lib/avatar';

// The profile photo is square-cropped in the system picker (auth-onboarding P2); the app downsizes and re-encodes it when it is saved.
const ASPECT: [number, number] = [1, 1];

type Options = {
  /** The picked photo, a `file://` uri. Not called when the gallery is cancelled. */
  onPick: (uri: string) => void;
  /** The gallery could not be opened, or gave something that is not a local file. */
  onError: () => void;
};

/**
 * Opens the gallery for one square-cropped photo (shared by the profile setup and the profile photo). A second call before the
 * first gallery has closed does nothing, even in the same moment: the guard is a ref, which no render has to catch up with.
 */
export function usePickAvatar({ onPick, onError }: Options): () => Promise<void> {
  const picking = useRef(false);
  return async () => {
    if (picking.current) return;
    picking.current = true;
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: ASPECT });
      if (result.canceled) return;
      const picked = AvatarUriSchema.safeParse(result.assets[0].uri);
      if (!picked.success) return onError();
      onPick(picked.data);
    } catch {
      onError();
    } finally {
      picking.current = false;
    }
  };
}
