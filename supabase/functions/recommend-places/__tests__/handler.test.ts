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

  it('tells the model to choose only from the given ids', () => {
    expect(buildPicksPrompt(candidates, ['landmarks'], 'en')).toMatch(/only from the given placeIds/i);
  });
});
