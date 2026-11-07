import { z } from 'zod';

import {
  GeminiPlacePicksSchema,
  GoogleNearbySearchResponseSchema,
  GooglePlaceSchema,
  GooglePlacePhotoSchema,
  MAX_PLACE_PHOTOS,
  PlacePhotoSchema,
  PlaceRecommendationSchema,
  PLACE_REQUESTS_PER_DAY,
  PlaceSchema,
  RecommendPlacesErrorSchema,
  RecommendPlacesRequestSchema,
  RecommendPlacesResponseSchema,
} from '../place';

const location = { latitude: 41.39, longitude: 2.17 };
const googlePlace = {
  id: 'ChIJabc',
  displayName: { text: 'Sagrada Familia', languageCode: 'es' },
  formattedAddress: 'Carrer de Mallorca, 401',
  location,
  types: ['church'],
  googleMapsUri: 'https://maps.google.com/?cid=1',
  primaryType: 'church',
  primaryTypeDisplayName: { text: 'Church' },
  rating: 4.8,
};
const place = {
  placeId: 'ChIJabc',
  name: 'Sagrada Familia',
  typeLabel: 'Church',
  address: 'Carrer de Mallorca, 401',
  types: ['church'],
  location,
  googleMapsUri: 'https://maps.google.com/?cid=1',
  photoRefs: [],
};
const request = { city: 'Barcelona', latitude: 41.39, longitude: 2.17, interests: ['beaches'], locale: 'pl' };

const { photoRefs, ...recommended } = place;
void photoRefs;
const photo = { uri: 'https://lh3.googleusercontent.com/p/abc', width: 800, height: 600, authors: [{ name: 'Ann' }] };
const places = (n: number) => Array.from({ length: n }, () => ({ ...recommended, reason: 'Nice', photos: [] }));
const picks = (n: number) => Array.from({ length: n }, () => ({ placeId: 'a', reason: 'Nice' }));

describe('GooglePlaceSchema', () => {
  it('accepts a full place and strips unknown keys', () => {
    const parsed = GooglePlaceSchema.parse(googlePlace);
    expect(parsed).not.toHaveProperty('rating');
    expect(parsed.id).toBe('ChIJabc');
  });

  it('defaults types to [] and allows missing optional fields', () => {
    const { types, formattedAddress, primaryType, primaryTypeDisplayName, ...minimal } = googlePlace;
    void types; void formattedAddress; void primaryType; void primaryTypeDisplayName;
    expect(GooglePlaceSchema.parse(minimal).types).toEqual([]);
  });

  it.each([
    ['empty id', { id: '' }],
    ['empty name', { displayName: { text: '' } }],
    ['bad url', { googleMapsUri: 'nope' }],
    ['lat > 90', { location: { latitude: 90.1, longitude: 0 } }],
    ['lng < -180', { location: { latitude: 0, longitude: -180.1 } }],
  ])('rejects %s', (_n, patch) => {
    expect(GooglePlaceSchema.safeParse({ ...googlePlace, ...patch }).success).toBe(false);
  });

  it.each([-90, 90])('accepts latitude %d and longitude ±180', (latitude) => {
    expect(GooglePlaceSchema.safeParse({ ...googlePlace, location: { latitude, longitude: 180 } }).success).toBe(true);
    expect(GooglePlaceSchema.safeParse({ ...googlePlace, location: { latitude, longitude: -180 } }).success).toBe(true);
  });
});

describe('GoogleNearbySearchResponseSchema', () => {
  it('turns an empty response into places []', () => {
    expect(GoogleNearbySearchResponseSchema.parse({})).toEqual({ places: [] });
  });
  it('parses places', () => {
    expect(GoogleNearbySearchResponseSchema.parse({ places: [googlePlace] }).places).toHaveLength(1);
  });
});

describe('PlaceSchema', () => {
  it('accepts a normalized place without optional fields', () => {
    const { typeLabel, address, ...minimal } = place;
    void typeLabel; void address;
    expect(PlaceSchema.safeParse(minimal).success).toBe(true);
  });
  it.each([{ placeId: '' }, { name: '' }, { googleMapsUri: 'x' }])('rejects %j', (patch) => {
    expect(PlaceSchema.safeParse({ ...place, ...patch }).success).toBe(false);
  });
  it('has no rating', () => {
    expect(PlaceSchema.parse({ ...place, rating: 5 })).not.toHaveProperty('rating');
  });
});

describe('RecommendPlacesRequestSchema', () => {
  it('accepts a valid request and trims the city', () => {
    expect(RecommendPlacesRequestSchema.parse({ ...request, city: '  Barcelona ' }).city).toBe('Barcelona');
  });
  it.each([
    ['whitespace city', { city: '   ' }],
    ['long city', { city: 'a'.repeat(101) }],
    ['lat > 90', { latitude: 91 }],
    ['lng > 180', { longitude: 181 }],
    ['empty interests', { interests: [] }],
    ['unknown interest', { interests: ['not-an-interest'] }],
    ['bad locale', { locale: 'de' }],
  ])('rejects %s', (_n, patch) => {
    expect(RecommendPlacesRequestSchema.safeParse({ ...request, ...patch }).success).toBe(false);
  });
  it('accepts boundary coordinates and en locale', () => {
    expect(
      RecommendPlacesRequestSchema.safeParse({ ...request, latitude: -90, longitude: 180, locale: 'en' }).success,
    ).toBe(true);
  });
});

describe('GooglePlacePhotoSchema', () => {
  const raw = { name: 'places/a/photos/b', widthPx: 800, heightPx: 600, extra: 1 };
  it('defaults authorAttributions to [] and strips unknown keys (incl. author photoUri)', () => {
    expect(GooglePlacePhotoSchema.parse(raw)).toEqual({
      name: 'places/a/photos/b',
      widthPx: 800,
      heightPx: 600,
      authorAttributions: [],
    });
    const [author] = GooglePlacePhotoSchema.parse({
      ...raw,
      authorAttributions: [{ displayName: 'Ann', uri: 'https://x.com/a', photoUri: 'https://x.com/p' }],
    }).authorAttributions;
    expect(author).toEqual({ displayName: 'Ann', uri: 'https://x.com/a' });
  });
  it.each([{ name: '' }, { widthPx: 0 }, { heightPx: 1.5 }])('rejects %j', (patch) => {
    expect(GooglePlacePhotoSchema.safeParse({ ...raw, ...patch }).success).toBe(false);
  });
  it('is optional on GooglePlaceSchema and defaults to []', () => {
    expect(GooglePlaceSchema.parse(googlePlace).photos).toEqual([]);
  });
});

describe('PlacePhotoSchema', () => {
  it('accepts a photo and rejects a bad uri', () => {
    expect(PlacePhotoSchema.safeParse(photo).success).toBe(true);
    expect(PlacePhotoSchema.safeParse({ ...photo, uri: 'nope' }).success).toBe(false);
    expect(PlacePhotoSchema.safeParse({ ...photo, authors: [{ name: 'A', uri: 'nope' }] }).success).toBe(false);
  });
});

describe('PlaceRecommendationSchema', () => {
  const rec = { ...recommended, reason: null, photos: [] };
  it('accepts null and short reasons', () => {
    expect(PlaceRecommendationSchema.safeParse({ ...rec, reason: null }).success).toBe(true);
    expect(PlaceRecommendationSchema.safeParse({ ...rec, reason: 'a'.repeat(200) }).success).toBe(true);
  });
  it('rejects a reason over 200 chars or a missing reason', () => {
    expect(PlaceRecommendationSchema.safeParse({ ...rec, reason: 'a'.repeat(201) }).success).toBe(false);
    const { reason, ...noReason } = rec;
    void reason;
    expect(PlaceRecommendationSchema.safeParse(noReason).success).toBe(false);
  });
  it('requires photos, at most MAX_PLACE_PHOTOS', () => {
    expect(MAX_PLACE_PHOTOS).toBe(3);
    const { photos, ...noPhotos } = rec;
    void photos;
    expect(PlaceRecommendationSchema.safeParse(noPhotos).success).toBe(false);
    expect(PlaceRecommendationSchema.safeParse({ ...rec, photos: [photo, photo, photo] }).success).toBe(true);
    expect(PlaceRecommendationSchema.safeParse({ ...rec, photos: [photo, photo, photo, photo] }).success).toBe(false);
  });
  it('does not carry photoRefs', () => {
    const withRefs = { ...rec, photoRefs: [{ name: 'n', width: 1, height: 1, authors: [] }] };
    expect(PlaceRecommendationSchema.parse(withRefs)).not.toHaveProperty('photoRefs');
  });
});

describe('RecommendPlacesResponseSchema', () => {
  it('accepts up to 10 places', () => {
    expect(RecommendPlacesResponseSchema.safeParse({ places: places(10), remainingToday: 0 }).success).toBe(true);
  });
  it.each([
    ['11 places', { places: places(11), remainingToday: 1 }],
    ['negative remaining', { places: [], remainingToday: -1 }],
    ['fractional remaining', { places: [], remainingToday: 1.5 }],
  ])('rejects %s', (_n, body) => {
    expect(RecommendPlacesResponseSchema.safeParse(body).success).toBe(false);
  });
});

describe('GeminiPlacePicksSchema', () => {
  it('accepts up to 10 picks', () => {
    expect(GeminiPlacePicksSchema.safeParse({ picks: picks(10) }).success).toBe(true);
  });
  it.each([
    ['11 picks', { picks: picks(11) }],
    ['empty placeId', { picks: [{ placeId: '', reason: 'x' }] }],
    ['empty reason', { picks: [{ placeId: 'a', reason: '' }] }],
    ['long reason', { picks: [{ placeId: 'a', reason: 'a'.repeat(201) }] }],
  ])('rejects %s', (_n, body) => {
    expect(GeminiPlacePicksSchema.safeParse(body).success).toBe(false);
  });
  it('converts to a JSON Schema with picks', () => {
    const json = z.toJSONSchema(GeminiPlacePicksSchema) as { type: string; properties: Record<string, unknown> };
    expect(json.type).toBe('object');
    expect(json.properties).toHaveProperty('picks');
  });
});

describe('RecommendPlacesErrorSchema', () => {
  it.each(['invalid_input', 'unauthorized', 'limit_reached', 'upstream_failed'])('accepts %s', (error) => {
    expect(RecommendPlacesErrorSchema.safeParse({ error }).success).toBe(true);
  });
  it('rejects unknown errors', () => {
    expect(RecommendPlacesErrorSchema.safeParse({ error: 'boom' }).success).toBe(false);
  });
});

describe('PLACE_REQUESTS_PER_DAY', () => {
  it('is 5 (D17)', () => {
    expect(PLACE_REQUESTS_PER_DAY).toBe(5);
  });
});
