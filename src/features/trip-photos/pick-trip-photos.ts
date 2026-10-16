import { launchImageLibraryAsync } from 'expo-image-picker';

import { takenAtFromExif } from '@/lib/trip-photos';
import { PickedPhotoSchema, type PickedPhoto } from '@/schemas';

/** One pick returns at most this many photos (trip-photos D7). There is no limit per trip. */
const SELECTION_LIMIT = 20;

/**
 * Opens the phone's gallery for several photos at once, without cropping (trip-photos D7); `[]` when it is closed
 * without a choice. Each photo carries its uri and, when its EXIF has one, the date taken (D12); nothing else
 * from the EXIF is read, so GPS stays on the phone (D2). A gallery that cannot be opened rejects: the caller says so.
 */
export async function pickTripPhotos(): Promise<PickedPhoto[]> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: SELECTION_LIMIT,
    exif: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => {
    const takenAt = takenAtFromExif(asset.exif);
    // The picker's result is a boundary: parsed like any other external input.
    return PickedPhotoSchema.parse({ uri: asset.uri, ...(takenAt ? { takenAt } : {}) });
  });
}
