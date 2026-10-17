import { z } from 'zod';

import { IsoDateTimeSchema, LocalDateTimeSchema } from './common';

/** One photo of a trip (trip-photos D2). Files in Storage: photoPaths(photo); GPS is never stored. */
export const TripPhotoSchema = z.object({
  /** Client-generated UUID, so sending the same photo again never creates a second one (trip-photos A5). */
  id: z.uuid(),
  tripId: z.uuid(),
  /**
   * When it was taken: the camera's own clock from EXIF DateTimeOriginal, no offset; absent when the file has none.
   * A deliberate exception to "timestamps with offset" (trip-photos D12): the camera writes its own clock
   * and the zone is unknown because GPS is stripped.
   */
  takenAt: LocalDateTimeSchema.optional(),
  /** When it was added (trip-photos D2). */
  createdAt: IsoDateTimeSchema,
});
export type TripPhoto = z.infer<typeof TripPhotoSchema>;

/** Only http(s): signed Supabase URLs always are, and `file:`, `javascript:`, `data:` or `ftp:` must never reach an image source. */
const HttpUrlSchema = z.url({ protocol: /^https?$/ });

/**
 * A photo as the app shows it: signed URLs of the file and its thumbnail (trip-photos A2, D14).
 * Only http(s) URLs are accepted; `z.httpUrl()` is not used because it rejects local `127.0.0.1` URLs.
 */
export const ShownTripPhotoSchema = TripPhotoSchema.extend({ url: HttpUrlSchema, thumbnailUrl: HttpUrlSchema });
export type ShownTripPhoto = z.infer<typeof ShownTripPhotoSchema>;

/** The trip's photos in display order (trip-photos D10, D13); also the phone's copy (trip-photos D8). */
export const TripPhotoListSchema = z.array(ShownTripPhotoSchema);
export type TripPhotoList = z.infer<typeof TripPhotoListSchema>;

/** One photo from the gallery before it is sent (the picker's result is a boundary). */
export const PickedPhotoSchema = z.object({ uri: z.string().min(1), takenAt: LocalDateTimeSchema.optional() });
export type PickedPhoto = z.infer<typeof PickedPhotoSchema>;
