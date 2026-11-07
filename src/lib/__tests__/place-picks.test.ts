import { MAX_PICKS, pickPlaces } from '@/lib/place-picks';
import { PlaceRecommendationSchema, type Place } from '@/schemas/place';

const place = (n: number): Place => ({
  placeId: `p${n}`,
  name: `Place ${n}`,
  types: ['museum'],
  location: { latitude: 38.7, longitude: -9.1 },
  googleMapsUri: `https://maps.google.com/?cid=${n}`,
  photoRefs: [{ name: `places/p${n}/photos/r`, width: 400, height: 300, authors: [] }],
});
const candidates = Array.from({ length: 15 }, (_, i) => place(i + 1));
const pick = (n: number, reason = `reason ${n}`) => ({ placeId: `p${n}`, reason });
const ids = (result: { placeId: string }[]) => result.map((p) => p.placeId);

const expectFallback = (result: ReturnType<typeof pickPlaces>) => {
  expect(ids(result)).toEqual(candidates.slice(0, 10).map((p) => p.placeId));
  expect(result.every((p) => p.reason === null)).toBe(true);
};

describe('pickPlaces', () => {
  it('keeps Gemini order and its reasons, with valid recommendations', () => {
    const result = pickPlaces(candidates, { picks: [pick(3), pick(1), pick(2)] });
    expect(ids(result)).toEqual(['p3', 'p1', 'p2']);
    expect(result[0].reason).toBe('reason 3');
    result.forEach((p) => PlaceRecommendationSchema.parse(p));
  });

  it('drops photoRefs and returns empty photos (filled later by the function)', () => {
    for (const result of [pickPlaces(candidates, { picks: [pick(1)] }), pickPlaces(candidates, undefined)]) {
      expect(result[0]).not.toHaveProperty('photoRefs');
      expect(result[0].photos).toEqual([]);
    }
  });

  it('drops placeIds outside the candidate set', () => {
    expect(ids(pickPlaces(candidates, { picks: [pick(2), { placeId: 'invented', reason: 'x' }, pick(1)] }))).toEqual([
      'p2',
      'p1',
    ]);
  });

  it('drops duplicates, first wins', () => {
    const result = pickPlaces(candidates, { picks: [pick(1, 'first'), pick(2), pick(1, 'second')] });
    expect(ids(result)).toEqual(['p1', 'p2']);
    expect(result[0].reason).toBe('first');
  });

  it('trims 12 valid picks to the first MAX_PICKS', () => {
    expect(MAX_PICKS).toBe(10);
    const result = pickPlaces(candidates, { picks: Array.from({ length: 12 }, (_, i) => pick(i + 1)) });
    expect(ids(result)).toEqual(candidates.slice(0, 10).map((p) => p.placeId));
    expect(result.every((p) => p.reason !== null)).toBe(true);
  });

  it('drops only the pick whose reason is too long (Gemini does not enforce maxLength)', () => {
    const result = pickPlaces(candidates, { picks: [pick(1), pick(2, 'x'.repeat(201)), pick(3)] });
    expect(ids(result)).toEqual(['p1', 'p3']);
    expect(result.map((p) => p.reason)).toEqual(['reason 1', 'reason 3']);
  });

  it('accepts a JSON string', () => {
    expect(ids(pickPlaces(candidates, JSON.stringify({ picks: [pick(5)] })))).toEqual(['p5']);
  });

  it('falls back to the first 10 candidates without reasons on invalid JSON', () => {
    expectFallback(pickPlaces(candidates, '{not json'));
  });

  it('falls back on a shape mismatch', () => {
    expectFallback(pickPlaces(candidates, { picks: 'x' }));
  });

  it('falls back when every pick is foreign', () => {
    expectFallback(pickPlaces(candidates, { picks: [{ placeId: 'nope', reason: 'x' }] }));
  });

  it('falls back when the call failed (undefined)', () => {
    expectFallback(pickPlaces(candidates, undefined));
  });

  it('fallback returns fewer than 10 when there are fewer candidates', () => {
    expect(pickPlaces(candidates.slice(0, 3), undefined)).toHaveLength(3);
  });
});
