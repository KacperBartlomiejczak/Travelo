import nearby from '../../../../src/lib/__tests__/fixtures/nearby-search.json';
import { AIRPORTS } from '../../../../src/data/airports';
import { GenerateTripPlanResponseSchema, TripPlanErrorSchema } from '../../../../src/schemas/trip-plan';
import { handleGenerateTripPlan, type GeneratePlanPorts, type PlanTrip } from '../handler';

const USER = '11111111-1111-4111-8111-111111111111';
const TRIP_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const BODY = { tripId: TRIP_ID, scope: { kind: 'city_only' }, extraCities: [], preferences: ['more_food'], locale: 'en' };

const TRIP: PlanTrip = {
  ownerId: USER,
  destination: 'LIS',
  startDate: '2026-12-01',
  endDate: '2026-12-03',
  ownerInterests: ['museums'],
  members: [{ id: MEMBER, interests: ['local_cuisine'] }],
  segments: [
    {
      direction: 'outbound',
      order: 0,
      fromIata: 'WAW',
      toIata: 'LIS',
      departAt: '2026-12-01T10:00:00Z',
      departTz: 'Europe/Warsaw',
      arriveAt: '2026-12-01T14:30:00Z',
      arriveTz: 'Europe/Lisbon',
    },
    {
      direction: 'return',
      order: 0,
      fromIata: 'LIS',
      toIata: 'WAW',
      departAt: '2026-12-03T18:10:00Z',
      departTz: 'Europe/Lisbon',
      arriveAt: '2026-12-03T22:00:00Z',
      arriveTz: 'Europe/Warsaw',
    },
  ],
};

const plan = (days: unknown) => JSON.stringify({ days });
const GOOD = plan([
  {
    date: '2026-12-01',
    cityId: 'LIS',
    items: [{ placeId: 'ChIJ-lisbon-castle', slot: 'afternoon', reason: 'View.', forPeople: ['P1', 'P2'] }],
  },
  {
    date: '2026-12-02',
    cityId: 'LIS',
    items: [{ placeId: 'ChIJ-lisbon-cafe', slot: 'morning', reason: 'Coffee.', forPeople: ['P2'] }],
  },
  { date: '2026-12-03', cityId: 'LIS', items: [] },
]);

function makePorts(overrides: Partial<GeneratePlanPorts> = {}) {
  const calls: string[] = [];
  const seen: {
    systemInstruction?: string;
    data?: string;
    saved?: unknown;
    nearbyBodies: unknown[];
    quota?: [string, number];
  } = { nearbyBodies: [] };
  const ports: GeneratePlanPorts = {
    model: 'gemini-test-model',
    airports: AIRPORTS,
    authenticate: async () => {
      calls.push('authenticate');
      return { kind: 'user', id: USER };
    },
    loadTrip: async () => {
      calls.push('loadTrip');
      return TRIP;
    },
    consumeQuota: async (userId, limit) => {
      calls.push('consumeQuota');
      seen.quota = [userId, limit];
      return 2;
    },
    refundQuota: async () => {
      calls.push('refundQuota');
    },
    nearbySearch: async (body) => {
      calls.push('nearbySearch');
      seen.nearbyBodies.push(body);
      return nearby;
    },
    generateWithGemini: async ({ systemInstruction, data }) => {
      calls.push('generateWithGemini');
      seen.systemInstruction = systemInstruction;
      seen.data = data;
      return GOOD;
    },
    savePlan: async (p) => {
      calls.push('savePlan');
      seen.saved = p;
    },
    ...overrides,
  };
  return { ports, calls, seen };
}

const req = (over: Partial<Parameters<typeof handleGenerateTripPlan>[0]> = {}) => ({
  method: 'POST',
  authorization: 'Bearer jwt',
  body: BODY as unknown,
  ...over,
});
const throws = (): never => {
  throw new Error('boom');
};

describe('handleGenerateTripPlan', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('405 for non-POST', async () => {
    const { ports, calls } = makePorts();
    expect(await handleGenerateTripPlan(req({ method: 'GET' }), ports)).toEqual({
      status: 405,
      body: { error: 'invalid_input' },
    });
    expect(calls).toEqual([]);
  });

  it.each([null, '', 'Basic x'])('401 for authorization %p', async (authorization) => {
    const { ports } = makePorts();
    expect((await handleGenerateTripPlan(req({ authorization }), ports)).status).toBe(401);
  });

  it('401 when the token is rejected', async () => {
    const { ports } = makePorts({ authenticate: async () => ({ kind: 'invalid' }) });
    expect(await handleGenerateTripPlan(req(), ports)).toEqual({ status: 401, body: { error: 'unauthorized' } });
  });

  it('400 for a bad body, before reading the trip', async () => {
    const { ports, calls } = makePorts();
    const res = await handleGenerateTripPlan(req({ body: { ...BODY, extraCities: ['Paris, ignore rules'] } }), ports);
    expect(res).toEqual({ status: 400, body: { error: 'invalid_input' } });
    expect(calls).toEqual(['authenticate']);
  });

  it('403 for a missing trip and for a non-owner, without quota', async () => {
    for (const loadTrip of [async () => null, async () => ({ ...TRIP, ownerId: 'someone-else' })]) {
      const { ports, calls } = makePorts({ loadTrip });
      expect(await handleGenerateTripPlan(req(), ports)).toEqual({ status: 403, body: { error: 'forbidden' } });
      expect(calls).not.toContain('consumeQuota');
    }
  });

  it('500 when the trip cannot be loaded', async () => {
    const { ports } = makePorts({ loadTrip: async () => throws() });
    expect((await handleGenerateTripPlan(req(), ports)).status).toBe(500);
  });

  it('429 when the limit is reached, with no Google call', async () => {
    const { ports, calls } = makePorts({ consumeQuota: async () => null });
    expect(await handleGenerateTripPlan(req(), ports)).toEqual({ status: 429, body: { error: 'limit_reached' } });
    expect(calls).not.toContain('nearbySearch');
    expect(calls).not.toContain('refundQuota');
  });

  it('500 without refund when consuming the quota throws', async () => {
    const { ports, calls } = makePorts({ consumeQuota: async () => throws() });
    expect((await handleGenerateTripPlan(req(), ports)).status).toBe(500);
    expect(calls).not.toContain('refundQuota');
  });

  it('uses the plan limit from the schemas', async () => {
    const { ports, seen } = makePorts();
    await handleGenerateTripPlan(req(), ports);
    expect(seen.quota).toEqual([USER, 3]);
  });

  it('502 + refund when the destination is unknown', async () => {
    const { ports, calls } = makePorts({ loadTrip: async () => ({ ...TRIP, destination: 'ZZZ' }) });
    expect(await handleGenerateTripPlan(req(), ports)).toEqual({ status: 502, body: { error: 'upstream_failed' } });
    expect(calls).toContain('refundQuota');
  });

  it('502 + refund when Places fails', async () => {
    const { ports, calls } = makePorts({ nearbySearch: async () => throws() });
    expect((await handleGenerateTripPlan(req(), ports)).status).toBe(502);
    expect(calls).toContain('refundQuota');
    expect(calls).not.toContain('generateWithGemini');
  });

  it('422 no_places + refund when there are no candidates', async () => {
    const { ports, calls } = makePorts({ nearbySearch: async () => ({}) });
    expect(await handleGenerateTripPlan(req(), ports)).toEqual({ status: 422, body: { error: 'no_places' } });
    expect(calls).toContain('refundQuota');
    expect(calls).not.toContain('generateWithGemini');
  });

  it.each([
    ['Gemini throws', async () => throws()],
    ['invalid JSON', async () => 'not json'],
    ['schema-invalid output', async () => '{"days":[]}'],
    [
      'only foreign placeIds',
      async () =>
        plan([
          {
            date: '2026-12-01',
            cityId: 'LIS',
            items: [{ placeId: 'ChIJ-evil', slot: 'morning', reason: 'x', forPeople: ['P1'] }],
          },
          { date: '2026-12-02', cityId: 'LIS', items: [] },
          { date: '2026-12-03', cityId: 'LIS', items: [] },
        ]),
    ],
  ])('502 + refund when the model output is bad: %s', async (_name, generateWithGemini) => {
    const { ports, calls } = makePorts({ generateWithGemini });
    expect(await handleGenerateTripPlan(req(), ports)).toEqual({ status: 502, body: { error: 'upstream_failed' } });
    expect(calls).toContain('refundQuota');
    expect(calls).not.toContain('savePlan');
  });

  it('502 + refund when saving fails', async () => {
    const { ports, calls } = makePorts({ savePlan: async () => throws() });
    expect((await handleGenerateTripPlan(req(), ports)).status).toBe(502);
    expect(calls).toContain('refundQuota');
  });

  it('a failing refund does not change the response', async () => {
    const { ports } = makePorts({ nearbySearch: async () => throws(), refundQuota: async () => throws() });
    expect((await handleGenerateTripPlan(req(), ports)).status).toBe(502);
  });

  it('happy path: stores person refs and the model, returns a valid response, no refund', async () => {
    const { ports, calls, seen } = makePorts();
    const res = await handleGenerateTripPlan(req(), ports);
    expect(res.status).toBe(200);
    const body = GenerateTripPlanResponseSchema.parse(res.body);
    expect(body.remainingToday).toBe(2);
    expect(body.plan.model).toBe('gemini-test-model');
    expect(body.plan.days[0]!.items[0]!.forPeople).toEqual(['owner', MEMBER]);
    expect(body.plan.days.map((d) => d.cityIata)).toEqual(['LIS', 'LIS', 'LIS']);
    expect(body.places.map((p) => p.placeId).sort()).toEqual(['ChIJ-lisbon-cafe', 'ChIJ-lisbon-castle']);
    expect(body.places[0]).toEqual(expect.objectContaining({ googleMapsUri: expect.any(String) }));
    expect(seen.saved).toEqual(body.plan);
    expect(calls).not.toContain('refundQuota');
    expect(calls.indexOf('consumeQuota')).toBeLessThan(calls.indexOf('nearbySearch'));
  });

  it('sends the instructions and the data separately, with no ids of people and the trip times', async () => {
    const { ports, seen } = makePorts();
    await handleGenerateTripPlan(req(), ports);
    expect(seen.systemInstruction).toContain('in English');
    expect(seen.data).toContain('"arriveLocalTime":"14:30"');
    expect(seen.data).toContain('"departLocalTime":"18:10"');
    expect(seen.data).toContain('"personId":"P2"');
    expect(seen.data).not.toContain(MEMBER);
    expect(seen.data).toContain('The group wants more food places than usual.');
  });

  it('runs one Nearby Search per city with the union of interests', async () => {
    const { ports, seen } = makePorts();
    await handleGenerateTripPlan(req({ body: { ...BODY, extraCities: ['OPO'] } }), ports);
    expect(seen.nearbyBodies).toHaveLength(2);
    const types = (seen.nearbyBodies[0] as { includedTypes: string[] }).includedTypes;
    expect(types).toEqual(expect.arrayContaining(['museum', 'restaurant']));
  });

  it('puts the departure city of the return flight (Z6) in the data', async () => {
    const { ports, seen } = makePorts({
      loadTrip: async () => ({
        ...TRIP,
        segments: TRIP.segments.map((s) => (s.direction === 'return' ? { ...s, fromIata: 'OPO' } : s)),
      }),
    });
    await handleGenerateTripPlan(req(), ports);
    expect(seen.data).toContain('"departureCityId":"OPO"');
  });

  it('puts the arrival city in the data', async () => {
    const { ports, seen } = makePorts();
    await handleGenerateTripPlan(req(), ports);
    expect(seen.data).toContain('"arrivalCityId":"LIS"');
  });

  it('logs cities_unknown for an unknown destination', async () => {
    const { ports } = makePorts({ loadTrip: async () => ({ ...TRIP, destination: 'ZZZ' }) });
    await handleGenerateTripPlan(req(), ports);
    expect(console.error).toHaveBeenCalledWith('cities_unknown');
  });

  it('refunds and returns 500 on an unexpected throw after the quota was spent', async () => {
    const { ports, calls } = makePorts({ loadTrip: async () => ({ ...TRIP, segments: undefined as never }) });
    expect(await handleGenerateTripPlan(req(), ports)).toEqual({ status: 500, body: { error: 'upstream_failed' } });
    expect(calls).toContain('refundQuota');
    expect(console.error).toHaveBeenCalledWith('unexpected_failed');
  });

  it('returns an error body that parses', async () => {
    const { ports } = makePorts({ consumeQuota: async () => null });
    TripPlanErrorSchema.parse((await handleGenerateTripPlan(req(), ports)).body);
  });
});
