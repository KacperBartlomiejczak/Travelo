// The fixture is hand-written from the Nearby Search (New) docs; replace it with a recorded response after the first live call (step C3).
import { InterestTagSchema } from '@/schemas/interests';
import { PlaceSchema } from '@/schemas/place';
import {
  buildNearbySearchBody,
  INTEREST_PLACE_TYPES,
  NEARBY_FIELD_MASK,
  parseNearbySearch,
  placeTypesFor,
  SEARCH_RADIUS_METERS,
} from '@/lib/place-types';

import fixture from './fixtures/nearby-search.json';

const ALL_TAGS = InterestTagSchema.options;

describe('INTEREST_PLACE_TYPES', () => {
  it('maps all 17 interests to at least one type, without duplicates inside a tag', () => {
    expect(ALL_TAGS).toHaveLength(17);
    for (const tag of ALL_TAGS) {
      const types = INTEREST_PLACE_TYPES[tag];
      expect(types.length).toBeGreaterThan(0);
      expect(new Set(types).size).toBe(types.length);
    }
  });

  it('keeps the union of all interests within the 50 includedTypes cap', () => {
    expect(placeTypesFor([...ALL_TAGS]).length).toBeLessThanOrEqual(50);
  });
});

describe('placeTypesFor', () => {
  it('returns the union deduped in interest order, then type order', () => {
    expect(placeTypesFor(['nature_parks', 'mountains_hiking'])).toEqual([
      'park',
      'national_park',
      'botanical_garden',
      'nature_preserve',
      'hiking_area',
      'mountain_peak',
    ]);
  });
});

describe('buildNearbySearchBody', () => {
  it('builds the request body', () => {
    expect(SEARCH_RADIUS_METERS).toBe(20000);
    expect(buildNearbySearchBody({ latitude: 38.7, longitude: -9.1, interests: ['beaches'], locale: 'pl' })).toEqual({
      includedTypes: ['beach'],
      maxResultCount: 20,
      languageCode: 'pl',
      locationRestriction: { circle: { center: { latitude: 38.7, longitude: -9.1 }, radius: 20000 } },
    });
  });
});

describe('NEARBY_FIELD_MASK', () => {
  it('asks only for Pro SKU fields', () => {
    expect(NEARBY_FIELD_MASK).not.toMatch(/rating|openingHours|photos|reviews|priceLevel/);
    expect(NEARBY_FIELD_MASK).toContain('places.id');
  });
});

describe('parseNearbySearch', () => {
  it('maps the fixture to valid Places and strips unknown fields', () => {
    const places = parseNearbySearch(fixture);
    expect(places).toHaveLength(5);
    for (const place of places) {
      expect(PlaceSchema.parse(place)).toEqual(place);
      expect(place).not.toHaveProperty('businessStatus');
    }
    expect(places[0]).toMatchObject({
      placeId: 'ChIJ-lisbon-castle',
      name: 'Castelo de S. Jorge',
      typeLabel: 'Zamek',
      address: 'R. de Santa Cruz do Castelo, 1100-129 Lisboa, Portugal',
    });
  });

  it('dedupes by placeId', () => {
    expect(parseNearbySearch({ places: [fixture.places[0], fixture.places[0]] })).toHaveLength(1);
  });

  it('returns [] for an empty response', () => {
    expect(parseNearbySearch({})).toEqual([]);
  });

  it('throws on a malformed response', () => {
    expect(() => parseNearbySearch({ places: [{ id: 'x' }] })).toThrow(Error);
    expect(() => parseNearbySearch('nope')).toThrow(Error);
  });
});
