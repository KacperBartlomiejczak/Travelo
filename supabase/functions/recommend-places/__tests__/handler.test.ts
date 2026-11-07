import nearby from '../../../../src/lib/__tests__/fixtures/nearby-search.json';
import { parseNearbySearch } from '../../../../src/lib/place-types';
import { RecommendPlacesErrorSchema, RecommendPlacesResponseSchema } from '../../../../src/schemas/place';
import { buildPicksPrompt, handleRecommendPlaces, type RecommendPorts } from '../handler';

const USER = 'user-1';
const BODY = { city: 'Lisbon', latitude: 38.72, longitude: -9.14, interests: ['landmarks', 'museums'], locale: 'pl' };
const GOOD_PICKS = JSON.stringify({ picks: [{ placeId: 'ChIJ-lisbon-castle', reason: 'Zamek z widokiem.' }] });

function makePorts(overrides: Partial<RecommendPorts> = {}) {
  const calls: string[] = [];
  const seen: { userId?: string; limit?: number; prompt?: string } = {};
  const ports: RecommendPorts = {
    authenticate: async () => {
      calls.push('authenticate');
      return { kind: 'user', id: USER };
    },
    consumeQuota: async (userId, limit) => {
      calls.push('consumeQuota');
      seen.userId = userId;
      seen.limit = limit;
      return 4;
    },
    nearbySearch: async () => {
      calls.push('nearbySearch');
      return nearby;
    },
    pickWithGemini: async (prompt) => {
      calls.push('pickWithGemini');
      seen.prompt = prompt;
      return GOOD_PICKS;
    },
    resolvePhoto: async (name) => `https://lh3.example/${name}`,
    ...overrides,
  };
  return { ports, calls, seen };
}

const req = (over: Partial<Parameters<typeof handleRecommendPlaces>[0]> = {}) => ({
  method: 'POST',
  authorization: 'Bearer jwt',
  body: BODY as unknown,
  ...over,
});

describe('handleRecommendPlaces', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects non-POST with 405', async () => {
    const { ports, calls } = makePorts();
    const res = await handleRecommendPlaces(req({ method: 'GET' }), ports);
    expect(res).toEqual({ status: 405, body: { error: 'invalid_input' } });
    expect(calls).toEqual([]);
  });

  it.each([null, '', 'Basic x', 'Bearer'])('401 for authorization %p', async (authorization) => {
    const { ports } = makePorts();
    expect((await handleRecommendPlaces(req({ authorization }), ports)).status).toBe(401);
  });

  it('401 when the token is rejected', async () => {
    const { ports, calls } = makePorts({ authenticate: async () => ({ kind: 'invalid' }) });
    const res = await handleRecommendPlaces(req(), ports);
    expect(res).toEqual({ status: 401, body: { error: 'unauthorized' } });
    expect(calls).toEqual([]);
  });

  it('500 upstream_failed when authentication itself throws', async () => {
    const { ports } = makePorts({
      authenticate: async () => {
        throw new Error('down');
      },
    });
    expect(await handleRecommendPlaces(req(), ports)).toEqual({ status: 500, body: { error: 'upstream_failed' } });
  });

  it('400 for a bad body, without consuming quota', async () => {
    const { ports, calls } = makePorts();
    const res = await handleRecommendPlaces(req({ body: { ...BODY, interests: [] } }), ports);
    expect(res).toEqual({ status: 400, body: { error: 'invalid_input' } });
    expect(calls).toEqual(['authenticate']);
  });

  it('429 limit_reached at the limit, before calling Google', async () => {
    const { ports, calls } = makePorts({ consumeQuota: async () => null });
    const res = await handleRecommendPlaces(req(), ports);
    expect(res).toEqual({ status: 429, body: { error: 'limit_reached' } });
    expect(calls).toEqual(['authenticate']);
  });

  it('500 upstream_failed when the quota check throws', async () => {
    const { ports } = makePorts({
      consumeQuota: async () => {
        throw new Error('db');
      },
    });
    expect((await handleRecommendPlaces(req(), ports)).status).toBe(500);
  });

  it('consumes the quota with PLACE_REQUESTS_PER_DAY', async () => {
    const { ports, seen } = makePorts();
    await handleRecommendPlaces(req(), ports);
    expect(seen.limit).toBe(5);
  });

  it('passes remainingToday through', async () => {
    const { ports } = makePorts({ consumeQuota: async () => 2 });
    const res = await handleRecommendPlaces(req(), ports);
    expect(RecommendPlacesResponseSchema.parse(res.body).remainingToday).toBe(2);
  });

  it('502 upstream_failed when Google fails, quota already spent', async () => {
    const { ports, calls } = makePorts({
      nearbySearch: async () => {
        throw new Error('google');
      },
    });
    const res = await handleRecommendPlaces(req(), ports);
    expect(res).toEqual({ status: 502, body: { error: 'upstream_failed' } });
    expect(calls).toEqual(['authenticate', 'consumeQuota']);
  });

  it('502 when Google returns a malformed payload', async () => {
    const { ports } = makePorts({ nearbySearch: async () => ({ places: 'nope' }) });
    expect((await handleRecommendPlaces(req(), ports)).status).toBe(502);
  });

  it('skips Gemini when there are no candidates', async () => {
    const { ports, calls } = makePorts({ nearbySearch: async () => ({}) });
    const res = await handleRecommendPlaces(req(), ports);
    expect(res).toEqual({ status: 200, body: { places: [], remainingToday: 4 } });
    expect(calls).not.toContain('pickWithGemini');
  });

  it('falls back to candidates with reason null when Gemini throws', async () => {
    const { ports } = makePorts({
      pickWithGemini: async () => {
        throw new Error('gemini');
      },
    });
    const res = await handleRecommendPlaces(req(), ports);
    const body = RecommendPlacesResponseSchema.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.places.length).toBeGreaterThan(0);
    expect(body.places.every((p) => p.reason === null)).toBe(true);
  });

  it('logs gemini_fallback when Gemini throws, without leaking the prompt', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { ports } = makePorts({
      pickWithGemini: async () => {
        throw new Error('Gemini failed: 400 INVALID_ARGUMENT bad schema');
      },
    });
    const res = await handleRecommendPlaces(req(), ports);
    expect(spy).toHaveBeenCalledWith('gemini_fallback', 'Gemini failed: 400 INVALID_ARGUMENT bad schema');
    expect(res.status).toBe(200);
  });

  it('warns gemini_picks_empty when the output yields no valid pick', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const out = JSON.stringify({ picks: [{ placeId: 'ChIJ-invented', reason: 'x' }] });
    const { ports } = makePorts({ pickWithGemini: async () => out });
    await handleRecommendPlaces(req(), ports);
    expect(spy).toHaveBeenCalledWith('gemini_picks_empty', { candidates: expect.any(Number) });
  });

  it('drops a placeId outside the candidate set', async () => {
    const out = JSON.stringify({
      picks: [
        { placeId: 'ChIJ-invented', reason: 'x' },
        { placeId: 'ChIJ-lisbon-park', reason: 'Zielono.' },
      ],
    });
    const { ports } = makePorts({ pickWithGemini: async () => out });
    const body = RecommendPlacesResponseSchema.parse((await handleRecommendPlaces(req(), ports)).body);
    expect(body.places.map((p) => p.placeId)).toEqual(['ChIJ-lisbon-park']);
  });

  it('success: picked place with reason, schema-valid', async () => {
    const { ports } = makePorts();
    const res = await handleRecommendPlaces(req(), ports);
    const body = RecommendPlacesResponseSchema.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.places).toHaveLength(1);
    expect(body.places[0]).toMatchObject({ placeId: 'ChIJ-lisbon-castle', reason: 'Zamek z widokiem.' });
  });

  it('takes the user id from the token, never from the body', async () => {
    const { ports, seen } = makePorts();
    await handleRecommendPlaces(req({ body: { ...BODY, userId: 'attacker', user_id: 'attacker' } }), ports);
    expect(seen.userId).toBe(USER);
  });

  it('errors match RecommendPlacesErrorSchema', async () => {
    const { ports } = makePorts({ consumeQuota: async () => null });
    expect(RecommendPlacesErrorSchema.safeParse((await handleRecommendPlaces(req(), ports)).body).success).toBe(true);
  });
});

describe('handleRecommendPlaces photos', () => {
  afterEach(() => jest.restoreAllMocks());

  // Real photo names are `places/<id>/photos/<id>`; the tests use short ids for readability.
  const short = (name: string) => name.replace('places/x/photos/', '');
  const photo = (id: string) => ({
    name: `places/x/photos/${id}`,
    widthPx: 800,
    heightPx: 600,
    authorAttributions: [{ displayName: 'Ann', uri: 'https://maps.google.com/ann' }],
  });
  const photosById: Record<string, string[]> = {
    'ChIJ-lisbon-castle': ['c1', 'c2', 'c3', 'c4'],
    'ChIJ-lisbon-park': ['p1'],
    'ChIJ-lisbon-cafe': ['x1'],
    'ChIJ-lisbon-viewpoint': ['x2'],
  };
  const withPhotos = {
    places: nearby.places.map((p) => ({ ...p, photos: (photosById[p.id] ?? []).map(photo) })),
  };
  const PICKS = JSON.stringify({
    picks: [
      { placeId: 'ChIJ-lisbon-park', reason: 'Zielono.' },
      { placeId: 'ChIJ-lisbon-castle', reason: 'Zamek.' },
      { placeId: 'ChIJ-lisbon-museum', reason: 'Muzeum.' },
    ],
  });
  const setup = (overrides: Partial<RecommendPorts> = {}) => {
    const requested: string[] = [];
    const made = makePorts({
      nearbySearch: async () => withPhotos,
      pickWithGemini: async () => PICKS,
      resolvePhoto: async (name) => {
        requested.push(short(name));
        return `https://lh3.example/${short(name)}`;
      },
      ...overrides,
    });
    return { ...made, requested };
  };

  it('resolves photos only for picked places, at most 3 each, in order', async () => {
    const { ports, requested } = setup();
    const res = await handleRecommendPlaces(req(), ports);
    const body = RecommendPlacesResponseSchema.parse(res.body);
    expect(res.status).toBe(200);
    expect([...requested].sort()).toEqual(['c1', 'c2', 'c3', 'p1']);
    expect(requested).not.toContain('x1');
    expect(requested).not.toContain('x2');
    expect(body.places.map((p) => p.photos.map((ph) => ph.uri))).toEqual([
      ['https://lh3.example/p1'],
      ['https://lh3.example/c1', 'https://lh3.example/c2', 'https://lh3.example/c3'],
      [],
    ]);
    expect(body.places[1]!.photos[0]).toEqual({
      uri: 'https://lh3.example/c1',
      width: 800,
      height: 600,
      authors: [{ name: 'Ann', uri: 'https://maps.google.com/ann' }],
    });
  });

  it('never exposes photoRefs', async () => {
    const { ports } = setup();
    expect(JSON.stringify((await handleRecommendPlaces(req(), ports)).body)).not.toContain('photoRefs');
  });

  it('drops a failed photo, keeps the others and warns once without names', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ports } = setup({
      resolvePhoto: async (name) => {
        if (short(name) === 'c2') throw new Error('boom c2');
        return `https://lh3.example/${short(name)}`;
      },
    });
    const body = RecommendPlacesResponseSchema.parse((await handleRecommendPlaces(req(), ports)).body);
    expect(body.places[1]!.photos.map((ph) => ph.uri)).toEqual(['https://lh3.example/c1', 'https://lh3.example/c3']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('photo_failed', { count: 1 });
  });

  it('answers 200 with empty photos when every photo fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ports } = setup({
      resolvePhoto: async () => {
        throw new Error('down');
      },
    });
    const res = await handleRecommendPlaces(req(), ports);
    expect(res.status).toBe(200);
    expect(RecommendPlacesResponseSchema.parse(res.body).places.every((p) => p.photos.length === 0)).toBe(true);
  });

  it('still resolves photos on the Gemini fallback path', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { ports, requested } = setup({
      pickWithGemini: async () => {
        throw new Error('gemini');
      },
    });
    const body = RecommendPlacesResponseSchema.parse((await handleRecommendPlaces(req(), ports)).body);
    expect(body.places.every((p) => p.reason === null)).toBe(true);
    expect(requested).toEqual(expect.arrayContaining(['c1', 'p1']));
    expect(body.places.find((p) => p.placeId === 'ChIJ-lisbon-castle')!.photos).toHaveLength(3);
  });
});

describe('buildPicksPrompt', () => {
  const candidates = parseNearbySearch(nearby);

  it('contains every candidate id, name and the interests, but no address or coordinates', () => {
    const prompt = buildPicksPrompt(candidates, ['landmarks', 'museums'], 'pl');
    for (const c of candidates) {
      expect(prompt).toContain(c.placeId);
      expect(prompt).toContain(c.name);
    }
    expect(prompt).toContain('landmarks');
    expect(prompt).not.toContain('Santa Cruz');
    expect(prompt).not.toContain('38.7139');
    expect(prompt).not.toContain('googleMapsUri');
  });

  it('asks for Polish reasons for pl and English for en', () => {
    expect(buildPicksPrompt(candidates, ['landmarks'], 'pl')).toContain('Polish');
    expect(buildPicksPrompt(candidates, ['landmarks'], 'en')).toContain('English');
  });

  it('does not send ratings to the model', () => {
    const rated = candidates.map((c) => ({ ...c, rating: 4.123456, ratingCount: 98765 }));
    const prompt = buildPicksPrompt(rated, ['landmarks'], 'en');
    expect(prompt).not.toMatch(/rating|4\.123456|98765/i);
  });

  it('tells the model to choose only from the given ids', () => {
    expect(buildPicksPrompt(candidates, ['landmarks'], 'en')).toMatch(/only from the given placeIds/i);
  });
});
