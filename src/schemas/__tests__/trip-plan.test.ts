import {
  GenerateTripPlanRequestSchema,
  GenerateTripPlanResponseSchema,
  GeneratedPlanSchema,
  PlaceDetailsRequestSchema,
  PlaceDetailsResponseSchema,
  PlanPersonIdSchema,
  PlanScopeSchema,
  PlanSlotSchema,
  PlaceCategorySchema,
  StoredPlanItemSchema,
  TripPlanErrorSchema,
  TripPlanSchema,
} from '../trip-plan';

const tripId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const request = { tripId, scope: { kind: 'city_only' }, extraCities: ['BCN'], preferences: ['more_food'], locale: 'pl' };
const item = { placeId: 'abc', slot: 'morning', reason: 'Nice', forPeople: ['P1'] };
const place = { placeId: 'abc', name: 'Park', address: null, googleMapsUri: 'https://maps.google.com/?cid=1' };
const plan = {
  tripId,
  days: [{ date: '2026-11-02', cityIata: 'BCN', items: [{ ...item, forPeople: ['owner', memberId] }] }],
  model: 'gemini',
  createdAt: '2026-11-02T10:15:00+01:00',
};

describe('PlanScopeSchema', () => {
  it('accepts city_only and allowed radii', () => {
    expect(PlanScopeSchema.safeParse({ kind: 'city_only' }).success).toBe(true);
    expect(PlanScopeSchema.safeParse({ kind: 'nearby', radiusKm: 300 }).success).toBe(true);
  });
  it('rejects radius 150 and a missing radius', () => {
    expect(PlanScopeSchema.safeParse({ kind: 'nearby', radiusKm: 150 }).success).toBe(false);
    expect(PlanScopeSchema.safeParse({ kind: 'nearby' }).success).toBe(false);
  });
});

describe('GenerateTripPlanRequestSchema', () => {
  const parse = (patch: object) => GenerateTripPlanRequestSchema.safeParse({ ...request, ...patch }).success;
  it('accepts a valid request', () => {
    expect(parse({})).toBe(true);
    expect(parse({ extraCities: [], preferences: [] })).toBe(true);
  });
  it.each([['Barcelona'], ['bcn'], ['BCNA']])('rejects extraCities entry %s', (city) => {
    expect(parse({ extraCities: [city] })).toBe(false);
  });
  it('rejects more than 2 extraCities and duplicates', () => {
    expect(parse({ extraCities: ['BCN', 'MAD', 'VLC'] })).toBe(false);
    expect(parse({ extraCities: ['BCN', 'BCN'] })).toBe(false);
  });
  it('rejects both pace chips, unknown chips and duplicate chips', () => {
    expect(parse({ preferences: ['pace_relaxed', 'pace_intense'] })).toBe(false);
    expect(parse({ preferences: ['pace_relaxed', 'more_food'] })).toBe(true);
    expect(parse({ preferences: ['party_hard'] })).toBe(false);
    expect(parse({ preferences: ['more_food', 'more_food'] })).toBe(false);
  });
  it('rejects a bad tripId and locale', () => {
    expect(parse({ tripId: 'x' })).toBe(false);
    expect(parse({ locale: 'de' })).toBe(false);
  });
});

describe('enums and ids', () => {
  it('validates slots and categories', () => {
    expect(PlanSlotSchema.safeParse('evening').success).toBe(true);
    expect(PlanSlotSchema.safeParse('night').success).toBe(false);
    expect(PlaceCategorySchema.safeParse('museum').success).toBe(true);
    expect(PlaceCategorySchema.safeParse('shop').success).toBe(false);
  });
  it('validates person ids', () => {
    expect(PlanPersonIdSchema.safeParse('P12').success).toBe(true);
    expect(PlanPersonIdSchema.safeParse('P100').success).toBe(false);
    expect(PlanPersonIdSchema.safeParse('P0').success).toBe(false);
    expect(PlanPersonIdSchema.safeParse('P01').success).toBe(false);
    expect(PlanPersonIdSchema.safeParse('P99').success).toBe(true);
    expect(PlanPersonIdSchema.safeParse('owner').success).toBe(false);
  });
});

describe('GeneratedPlanSchema', () => {
  const day = { date: '2026-11-02', cityId: 'BCN', items: [item] };
  it('accepts a valid plan', () => {
    expect(GeneratedPlanSchema.safeParse({ days: [day] }).success).toBe(true);
  });
  it('rejects no days, 7 items, a long reason and empty forPeople', () => {
    expect(GeneratedPlanSchema.safeParse({ days: [] }).success).toBe(false);
    expect(GeneratedPlanSchema.safeParse({ days: [{ ...day, items: Array(7).fill(item) }] }).success).toBe(false);
    expect(GeneratedPlanSchema.safeParse({ days: [{ ...day, items: [{ ...item, reason: 'x'.repeat(201) }] }] }).success).toBe(false);
    expect(GeneratedPlanSchema.safeParse({ days: [{ ...day, items: [{ ...item, forPeople: [] }] }] }).success).toBe(false);
  });
  it('rejects an invalid slot, an invalid cityId and a non-P person id', () => {
    expect(GeneratedPlanSchema.safeParse({ days: [{ ...day, items: [{ ...item, slot: 'night' }] }] }).success).toBe(false);
    expect(GeneratedPlanSchema.safeParse({ days: [{ ...day, cityId: 'bcn' }] }).success).toBe(false);
    expect(GeneratedPlanSchema.safeParse({ days: [{ ...day, items: [{ ...item, forPeople: ['owner'] }] }] }).success).toBe(false);
  });
  it('accepts a 200-char reason', () => {
    expect(GeneratedPlanSchema.safeParse({ days: [{ ...day, items: [{ ...item, reason: 'x'.repeat(200) }] }] }).success).toBe(true);
  });
});

describe('stored plan', () => {
  it('accepts owner and uuid people, rejects P1', () => {
    expect(TripPlanSchema.safeParse(plan).success).toBe(true);
    expect(StoredPlanItemSchema.safeParse({ ...item, forPeople: ['P1'] }).success).toBe(false);
    expect(StoredPlanItemSchema.safeParse({ ...item, forPeople: [] }).success).toBe(false);
    expect(StoredPlanItemSchema.safeParse({ ...item, forPeople: ['member-1'] }).success).toBe(false);
  });
  it('rejects empty days, empty model and a createdAt without offset', () => {
    expect(TripPlanSchema.safeParse({ ...plan, days: [] }).success).toBe(false);
    expect(TripPlanSchema.safeParse({ ...plan, model: '' }).success).toBe(false);
    expect(TripPlanSchema.safeParse({ ...plan, createdAt: '2026-11-02T10:15:00' }).success).toBe(false);
  });
});

describe('place details', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
  it('accepts 40 placeIds and rejects 41, none, and duplicates', () => {
    expect(PlaceDetailsRequestSchema.safeParse({ placeIds: ids(40), locale: 'en' }).success).toBe(true);
    expect(PlaceDetailsRequestSchema.safeParse({ placeIds: ids(41), locale: 'en' }).success).toBe(false);
    expect(PlaceDetailsRequestSchema.safeParse({ placeIds: [], locale: 'en' }).success).toBe(false);
    expect(PlaceDetailsRequestSchema.safeParse({ placeIds: ['a', 'a'], locale: 'en' }).success).toBe(false);
  });
  it('validates responses', () => {
    expect(PlaceDetailsResponseSchema.safeParse({ places: [place] }).success).toBe(true);
    expect(PlaceDetailsResponseSchema.safeParse({ places: [{ ...place, googleMapsUri: 'nope' }] }).success).toBe(false);
    expect(GenerateTripPlanResponseSchema.safeParse({ plan, places: [place], remainingToday: 2 }).success).toBe(true);
    expect(GenerateTripPlanResponseSchema.safeParse({ plan, places: [place], remainingToday: -1 }).success).toBe(false);
  });
});

describe('TripPlanErrorSchema', () => {
  it('accepts known codes only', () => {
    expect(TripPlanErrorSchema.safeParse({ error: 'no_places' }).success).toBe(true);
    expect(TripPlanErrorSchema.safeParse({ error: 'boom' }).success).toBe(false);
  });
});
