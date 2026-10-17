import { PickedPhotoSchema, ShownTripPhotoSchema, TripPhotoListSchema, TripPhotoSchema } from '@/schemas';

const PHOTO_ID = '5b0f3c1e-2d4a-4e6b-8c7d-9a1b2c3d4e5f';
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';

const photo = {
  id: PHOTO_ID,
  tripId: TRIP_ID,
  takenAt: '2026-10-14T18:03',
  createdAt: '2026-10-15T09:30:00.000Z',
};

const SIGNED_URL = `https://abcdefghijkl.supabase.co/storage/v1/object/sign/trip-photos/${TRIP_ID}/${PHOTO_ID}.jpg?token=eyJhbGciOiJIUzI1NiJ9.e30.sig`;
const SIGNED_THUMBNAIL_URL = `https://abcdefghijkl.supabase.co/storage/v1/object/sign/trip-photos/${TRIP_ID}/${PHOTO_ID}_thumb.jpg?token=eyJhbGciOiJIUzI1NiJ9.e30.sig`;
const LOCAL_URL = `http://127.0.0.1:54321/storage/v1/object/sign/trip-photos/${TRIP_ID}/${PHOTO_ID}.jpg?token=abc`;
const LOCAL_THUMBNAIL_URL = `http://127.0.0.1:54321/storage/v1/object/sign/trip-photos/${TRIP_ID}/${PHOTO_ID}_thumb.jpg?token=abc`;

const shown = { ...photo, url: SIGNED_URL, thumbnailUrl: SIGNED_THUMBNAIL_URL };

describe('TripPhoto', () => {
  it('accepts a photo with the date it was taken', () => {
    expect(TripPhotoSchema.parse(photo)).toEqual(photo);
  });

  it('accepts a photo without a date taken (a screenshot, a messenger photo)', () => {
    const { takenAt: _takenAt, ...withoutTakenAt } = photo;
    expect(TripPhotoSchema.safeParse(withoutTakenAt).success).toBe(true);
  });

  it('accepts a date taken at midnight and on 29 February in a leap year', () => {
    expect(TripPhotoSchema.safeParse({ ...photo, takenAt: '2026-10-14T00:00' }).success).toBe(true);
    expect(TripPhotoSchema.safeParse({ ...photo, takenAt: '2028-02-29T23:59' }).success).toBe(true);
  });

  it('accepts an added time with a non-UTC offset', () => {
    expect(TripPhotoSchema.safeParse({ ...photo, createdAt: '2026-10-15T11:30:00+02:00' }).success).toBe(true);
  });

  it.each([
    ['an id that is not a UUID', { id: 'photo-1' }],
    ['a trip id that is not a UUID', { tripId: 'trip-1' }],
    ['a date taken with seconds', { takenAt: '2026-10-14T18:03:22' }],
    ['a date taken with an offset', { takenAt: '2026-10-14T18:03+02:00' }],
    ['a date taken on an impossible date', { takenAt: '2026-02-30T10:00' }],
    ['a date taken on 29 February in a common year', { takenAt: '2026-02-29T10:00' }],
    ['a date taken that is only a date', { takenAt: '2026-10-14' }],
    ['an added time without an offset', { createdAt: '2026-10-15T09:30:00' }],
    ['an added time that is only a date', { createdAt: '2026-10-15' }],
    ['a missing added time', { createdAt: undefined }],
  ])('rejects %s', (_, patch) => {
    expect(TripPhotoSchema.safeParse({ ...photo, ...patch }).success).toBe(false);
  });
});

describe('ShownTripPhoto', () => {
  it('accepts a photo with the signed URLs of the file and its thumbnail', () => {
    expect(ShownTripPhotoSchema.parse(shown)).toEqual(shown);
  });

  it('accepts local development URLs', () => {
    expect(ShownTripPhotoSchema.safeParse({ ...shown, url: LOCAL_URL, thumbnailUrl: LOCAL_THUMBNAIL_URL }).success).toBe(true);
  });

  it('accepts a shown photo without a date taken', () => {
    const { takenAt: _takenAt, ...withoutTakenAt } = shown;
    expect(ShownTripPhotoSchema.safeParse(withoutTakenAt).success).toBe(true);
  });

  it.each([
    ['file:///var/mobile/photo.jpg'],
    ['javascript:alert(1)'],
    ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
    ['ftp://example.com/photo.jpg'],
  ])('rejects %s as a file URL and as a thumbnail URL (only http and https)', (unsafeUrl) => {
    expect(ShownTripPhotoSchema.safeParse({ ...shown, url: unsafeUrl }).success).toBe(false);
    expect(ShownTripPhotoSchema.safeParse({ ...shown, thumbnailUrl: unsafeUrl }).success).toBe(false);
  });

  it.each([
    ['a file URL that is not a URL', { url: 'not a url' }],
    ['a thumbnail URL that is not a URL', { thumbnailUrl: 'not a url' }],
    ['a relative file URL', { url: '/storage/v1/object/sign/photo.jpg' }],
    ['an empty file URL', { url: '' }],
    ['a missing file URL', { url: undefined }],
    ['a missing thumbnail URL', { thumbnailUrl: undefined }],
    ['an id that is not a UUID', { id: 'photo-1' }],
    ['a date taken with seconds', { takenAt: '2026-10-14T18:03:22' }],
  ])('rejects %s', (_, patch) => {
    expect(ShownTripPhotoSchema.safeParse({ ...shown, ...patch }).success).toBe(false);
  });
});

describe('TripPhotoList', () => {
  it('accepts an empty list', () => {
    expect(TripPhotoListSchema.parse([])).toEqual([]);
  });

  it('accepts photos with and without a date taken, keeping their order', () => {
    const { takenAt: _takenAt, ...withoutTakenAt } = shown;
    const second = { ...withoutTakenAt, id: '7c1d4e2f-3a5b-4f7c-9d8e-0b2c3d4e5f60' };
    expect(TripPhotoListSchema.parse([shown, second])).toEqual([shown, second]);
  });

  it('rejects a list that contains a bad item', () => {
    expect(TripPhotoListSchema.safeParse([shown, { ...shown, url: 'not a url' }]).success).toBe(false);
  });

  it('rejects something that is not a list', () => {
    expect(TripPhotoListSchema.safeParse(shown).success).toBe(false);
    expect(TripPhotoListSchema.safeParse(null).success).toBe(false);
  });
});

describe('PickedPhoto', () => {
  const picked = { uri: 'file:///data/user/0/app/cache/ImagePicker/9f3c.jpg', takenAt: '2026-10-14T18:03' };

  it('accepts a picked photo with the date taken', () => {
    expect(PickedPhotoSchema.parse(picked)).toEqual(picked);
  });

  it('accepts a picked photo without a date taken', () => {
    expect(PickedPhotoSchema.safeParse({ uri: picked.uri }).success).toBe(true);
  });

  it.each([
    ['an empty uri', { uri: '' }],
    ['a missing uri', { uri: undefined }],
    ['a date taken with seconds', { takenAt: '2026-10-14T18:03:22' }],
    ['a date taken with an offset', { takenAt: '2026-10-14T18:03+02:00' }],
    ['a date taken on an impossible date', { takenAt: '2026-02-30T10:00' }],
  ])('rejects %s', (_, patch) => {
    expect(PickedPhotoSchema.safeParse({ ...picked, ...patch }).success).toBe(false);
  });
});
