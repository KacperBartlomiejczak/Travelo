import { LocalDateTimeSchema, type TripPhoto } from '@/schemas';

/** The file's longer side is at most this many pixels, never upscaled (trip-photos D7). */
export const PHOTO_MAX_SIDE = 2048;
/** The thumbnail's longer side is at most this many pixels (trip-photos D14). */
export const THUMBNAIL_MAX_SIDE = 480;

const EXIF_DATE_TIME = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):\d{2}$/;

/**
 * The date taken from the picker's EXIF: `DateTimeOriginal`, else `DateTime` (`YYYY:MM:DD HH:MM:SS`), as the camera's
 * clock to the minute (`2026-10-14T18:03`, trip-photos D12). `undefined` when neither is a real date.
 * Nothing else is read: GPS never leaves the device (D2).
 */
export function takenAtFromExif(exif: Record<string, unknown> | null | undefined): string | undefined {
  if (!exif) return undefined;
  for (const tag of ['DateTimeOriginal', 'DateTime']) {
    const value = exif[tag];
    const match = typeof value === 'string' ? EXIF_DATE_TIME.exec(value) : null;
    if (!match) continue;
    const [, year, month, day, hour, minute] = match;
    const parsed = LocalDateTimeSchema.safeParse(`${year}-${month}-${day}T${hour}:${minute}`);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}

/** -1, 0 or 1, by plain `<` so the order never depends on the device's locale. */
const compare = <V extends string | number>(a: V, b: V) => (a < b ? -1 : a > b ? 1 : 0);

/** A date taken is before no date at all; two dates compare as text, since they share one fixed format. */
export function compareTakenAt(a: string | undefined, b: string | undefined): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1;
  return compare(a, b);
}

/**
 * Display order (trip-photos D10, D13): date taken, oldest first; the same minute by when it was added;
 * photos without a date taken after all the others, by when they were added; then by id, so it is deterministic.
 * Returns a new array.
 */
export function sortTripPhotos<T extends TripPhoto>(photos: readonly T[]): T[] {
  return [...photos].sort(
    (a, b) =>
      compareTakenAt(a.takenAt, b.takenAt) ||
      compare(Date.parse(a.createdAt), Date.parse(b.createdAt)) ||
      compare(a.id, b.id),
  );
}

/** Storage object paths of a photo and its thumbnail (trip-photos A2, D14). */
export function photoPaths(photo: Pick<TripPhoto, 'id' | 'tripId'>): { file: string; thumbnail: string } {
  return { file: `${photo.tripId}/${photo.id}.jpg`, thumbnail: `${photo.tripId}/${photo.id}_thumb.jpg` };
}

/**
 * The argument for `resize()` that brings the longer side down to `maxSide` (trip-photos D7, D14);
 * `null` when it already fits (never upscale) or the size is unknown: the picker can report 0,
 * then the caller reads the rendered size first.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number } | { height: number } | null {
  const known = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  if (!known || Math.max(width, height) <= maxSide) return null;
  return height > width ? { height: maxSide } : { width: maxSide };
}
