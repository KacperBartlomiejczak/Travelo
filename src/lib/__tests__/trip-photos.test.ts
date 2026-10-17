import {
  fitWithin,
  PHOTO_MAX_SIDE,
  photoPaths,
  sortTripPhotos,
  takenAtFromExif,
  THUMBNAIL_MAX_SIDE,
} from '@/lib/trip-photos';
import type { ShownTripPhoto, TripPhoto } from '@/schemas';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';

const photo = (id: string, overrides: Partial<TripPhoto> = {}): TripPhoto => ({
  id,
  tripId: TRIP_ID,
  createdAt: '2026-10-15T08:00:00Z',
  ...overrides,
});

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const D = '00000000-0000-4000-8000-00000000000d';

const ids = (photos: TripPhoto[]) => photos.map((item) => item.id);

describe('takenAtFromExif', () => {
  it('reads DateTimeOriginal as a minute-precision local date-time (D12)', () => {
    expect(takenAtFromExif({ DateTimeOriginal: '2026:10:14 18:03:22' })).toBe('2026-10-14T18:03');
  });

  it('falls back to DateTime when DateTimeOriginal is missing', () => {
    expect(takenAtFromExif({ DateTime: '2026:10:13 09:45:10' })).toBe('2026-10-13T09:45');
  });

  it('falls back to DateTime when DateTimeOriginal is unusable', () => {
    expect(takenAtFromExif({ DateTimeOriginal: '0000:00:00 00:00:00', DateTime: '2026:10:13 09:45:10' })).toBe(
      '2026-10-13T09:45',
    );
    expect(takenAtFromExif({ DateTimeOriginal: 'garbage', DateTime: '2026:10:13 09:45:10' })).toBe('2026-10-13T09:45');
  });

  it('prefers DateTimeOriginal over DateTime when both exist', () => {
    expect(takenAtFromExif({ DateTimeOriginal: '2026:10:14 18:03:22', DateTime: '2026:10:15 07:00:00' })).toBe(
      '2026-10-14T18:03',
    );
  });

  it('keeps midnight and drops the seconds', () => {
    expect(takenAtFromExif({ DateTimeOriginal: '2026:10:14 00:00:05' })).toBe('2026-10-14T00:00');
  });

  it('gives none for the "unknown date" value 0000:00:00 00:00:00', () => {
    expect(takenAtFromExif({ DateTimeOriginal: '0000:00:00 00:00:00' })).toBeUndefined();
    expect(takenAtFromExif({ DateTime: '0000:00:00 00:00:00' })).toBeUndefined();
  });

  it('gives none for garbage, an empty string or a value that is not a string', () => {
    expect(takenAtFromExif({ DateTimeOriginal: 'yesterday afternoon' })).toBeUndefined();
    expect(takenAtFromExif({ DateTimeOriginal: '2026-10-14T18:03:22' })).toBeUndefined();
    expect(takenAtFromExif({ DateTimeOriginal: '' })).toBeUndefined();
    expect(takenAtFromExif({ DateTimeOriginal: 20261014180322 })).toBeUndefined();
    expect(takenAtFromExif({ DateTimeOriginal: null })).toBeUndefined();
  });

  it('gives none for an impossible date or time', () => {
    expect(takenAtFromExif({ DateTimeOriginal: '2026:02:30 10:00:00' })).toBeUndefined();
    expect(takenAtFromExif({ DateTimeOriginal: '2026:13:01 10:00:00' })).toBeUndefined();
    expect(takenAtFromExif({ DateTimeOriginal: '2026:10:14 25:00:00' })).toBeUndefined();
  });

  it('gives none when there is no exif', () => {
    expect(takenAtFromExif(null)).toBeUndefined();
    expect(takenAtFromExif(undefined)).toBeUndefined();
    expect(takenAtFromExif({})).toBeUndefined();
  });

  it('never reads anything else: an object with only GPS tags gives none (D2)', () => {
    expect(takenAtFromExif({ GPSLatitude: 50.06, GPSLongitude: 19.94, GPSDateStamp: '2026:10:14' })).toBeUndefined();
  });
});

describe('sortTripPhotos', () => {
  it('puts the oldest date taken first (D10)', () => {
    const sorted = sortTripPhotos([
      photo(A, { takenAt: '2026-10-14T18:03' }),
      photo(B, { takenAt: '2026-10-12T09:00' }),
      photo(C, { takenAt: '2026-10-13T23:59' }),
    ]);
    expect(ids(sorted)).toEqual([B, C, A]);
  });

  it('orders by date taken even when a photo was added later', () => {
    const sorted = sortTripPhotos([
      photo(A, { takenAt: '2026-10-14T18:03', createdAt: '2026-10-15T08:00:00Z' }),
      photo(B, { takenAt: '2026-10-12T09:00', createdAt: '2026-10-15T09:00:00Z' }),
    ]);
    expect(ids(sorted)).toEqual([B, A]);
  });

  it('orders photos taken in the same minute by when they were added', () => {
    const sorted = sortTripPhotos([
      photo(A, { takenAt: '2026-10-14T18:03', createdAt: '2026-10-15T08:02:00Z' }),
      photo(B, { takenAt: '2026-10-14T18:03', createdAt: '2026-10-15T08:01:00Z' }),
    ]);
    expect(ids(sorted)).toEqual([B, A]);
  });

  it('puts photos without a date taken after all dated ones, by when they were added (D13)', () => {
    const sorted = sortTripPhotos([
      photo(A, { createdAt: '2026-10-15T08:05:00Z' }),
      photo(B, { takenAt: '2026-10-14T18:03' }),
      photo(C, { createdAt: '2026-10-15T08:01:00Z' }),
      photo(D, { takenAt: '2026-10-20T12:00' }),
    ]);
    expect(ids(sorted)).toEqual([B, D, C, A]);
  });

  it('compares createdAt as instants, not as strings', () => {
    // 10:00+02:00 is 08:00Z, earlier than 09:30Z although it is the larger string.
    const sorted = sortTripPhotos([
      photo(A, { createdAt: '2026-10-14T09:30:00Z' }),
      photo(B, { createdAt: '2026-10-14T10:00:00+02:00' }),
    ]);
    expect(ids(sorted)).toEqual([B, A]);

    const sameMinute = sortTripPhotos([
      photo(A, { takenAt: '2026-10-14T18:03', createdAt: '2026-10-14T09:30:00Z' }),
      photo(B, { takenAt: '2026-10-14T18:03', createdAt: '2026-10-14T10:00:00+02:00' }),
    ]);
    expect(ids(sameMinute)).toEqual([B, A]);
  });

  it('falls back to the id when everything else is equal, whatever the input order', () => {
    const same = { takenAt: '2026-10-14T18:03', createdAt: '2026-10-15T08:00:00Z' };
    expect(ids(sortTripPhotos([photo(C, same), photo(A, same), photo(B, same)]))).toEqual([A, B, C]);
    expect(ids(sortTripPhotos([photo(B, same), photo(C, same), photo(A, same)]))).toEqual([A, B, C]);

    const undated = { createdAt: '2026-10-15T08:00:00Z' };
    expect(ids(sortTripPhotos([photo(B, undated), photo(A, undated)]))).toEqual([A, B]);
  });

  it('does not change the input array', () => {
    const input = [photo(A, { takenAt: '2026-10-14T18:03' }), photo(B, { takenAt: '2026-10-12T09:00' })];
    const copy = [...input];

    const sorted = sortTripPhotos(input);

    expect(input).toEqual(copy);
    expect(ids(input)).toEqual([A, B]);
    expect(sorted).not.toBe(input);
  });

  it('returns an empty list for an empty list', () => {
    expect(sortTripPhotos([])).toEqual([]);
  });

  it('keeps the extra fields of a shown photo', () => {
    const shown = (id: string, takenAt: string): ShownTripPhoto => ({
      ...photo(id, { takenAt }),
      url: `https://example.test/${id}.jpg`,
      thumbnailUrl: `https://example.test/${id}_thumb.jpg`,
    });

    const sorted = sortTripPhotos([shown(A, '2026-10-14T18:03'), shown(B, '2026-10-12T09:00')]);

    expect(sorted.map((item) => item.url)).toEqual([`https://example.test/${B}.jpg`, `https://example.test/${A}.jpg`]);
    expect(sorted[0].thumbnailUrl).toBe(`https://example.test/${B}_thumb.jpg`);
  });
});

describe('photoPaths', () => {
  it('gives the Storage paths of the file and of its thumbnail (A2, D14)', () => {
    expect(photoPaths({ id: A, tripId: TRIP_ID })).toEqual({
      file: `${TRIP_ID}/${A}.jpg`,
      thumbnail: `${TRIP_ID}/${A}_thumb.jpg`,
    });
  });
});

describe('fitWithin', () => {
  it('exposes the two size limits (D7, D14)', () => {
    expect(PHOTO_MAX_SIDE).toBe(2048);
    expect(THUMBNAIL_MAX_SIDE).toBe(480);
  });

  it('shrinks a landscape photo by its width', () => {
    expect(fitWithin(4032, 3024, PHOTO_MAX_SIDE)).toEqual({ width: 2048 });
  });

  it('shrinks a portrait photo by its height', () => {
    expect(fitWithin(3024, 4032, PHOTO_MAX_SIDE)).toEqual({ height: 2048 });
  });

  it('shrinks a square photo by its width', () => {
    expect(fitWithin(3000, 3000, PHOTO_MAX_SIDE)).toEqual({ width: 2048 });
  });

  it('does not resize a photo that is already small (never upscales)', () => {
    expect(fitWithin(1600, 1200, PHOTO_MAX_SIDE)).toBeNull();
    expect(fitWithin(1200, 1600, PHOTO_MAX_SIDE)).toBeNull();
  });

  it('does not resize a photo whose longer side is exactly the limit', () => {
    expect(fitWithin(2048, 1536, PHOTO_MAX_SIDE)).toBeNull();
    expect(fitWithin(1536, 2048, PHOTO_MAX_SIDE)).toBeNull();
    expect(fitWithin(2048, 2048, PHOTO_MAX_SIDE)).toBeNull();
  });

  it('shrinks by one pixel over the limit', () => {
    expect(fitWithin(2049, 1000, PHOTO_MAX_SIDE)).toEqual({ width: 2048 });
    expect(fitWithin(1000, 2049, PHOTO_MAX_SIDE)).toEqual({ height: 2048 });
  });

  it('gives none when the picker reports a 0 size, so the caller reads the real size first', () => {
    expect(fitWithin(0, 3024, PHOTO_MAX_SIDE)).toBeNull();
    expect(fitWithin(4032, 0, PHOTO_MAX_SIDE)).toBeNull();
    expect(fitWithin(0, 0, PHOTO_MAX_SIDE)).toBeNull();
  });

  it('gives none for a size that is negative, NaN or infinite', () => {
    expect(fitWithin(-4032, 3024, PHOTO_MAX_SIDE)).toBeNull();
    expect(fitWithin(4032, Number.NaN, PHOTO_MAX_SIDE)).toBeNull();
    expect(fitWithin(Number.POSITIVE_INFINITY, 3024, PHOTO_MAX_SIDE)).toBeNull();
  });

  it('works with the thumbnail limit', () => {
    expect(fitWithin(4032, 3024, THUMBNAIL_MAX_SIDE)).toEqual({ width: 480 });
    expect(fitWithin(3024, 4032, THUMBNAIL_MAX_SIDE)).toEqual({ height: 480 });
    expect(fitWithin(480, 320, THUMBNAIL_MAX_SIDE)).toBeNull();
    expect(fitWithin(481, 320, THUMBNAIL_MAX_SIDE)).toEqual({ width: 480 });
  });
});
