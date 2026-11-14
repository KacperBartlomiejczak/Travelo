import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { GeneratedPlanSchema } from '../../../../src/schemas/trip-plan';
import { createPorts, GEMINI_TIMEOUT_MS } from '../ports';

const env = { placesApiKey: 'places-key', geminiApiKey: 'gemini-key', geminiModel: 'gemini-env-model' };
const airports = [] as const;
const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as Response;
const bad = (status: number, json: unknown = {}) => ({ ok: false, status, json: async () => json }) as Response;

function setup(response: Response, admin: unknown = {}) {
  const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => response);
  const ports = createPorts({
    admin: admin as SupabaseClient,
    fetch: fetchMock as unknown as typeof fetch,
    env,
    airports,
  });
  return { ports, fetchMock };
}

const rpcAdmin = (result: { data?: unknown; error?: unknown }) => {
  const rpc = jest.fn(async (_name: string, _args: unknown) => ({ data: null, error: null, ...result }));
  return { admin: { rpc }, rpc };
};

describe('generate-trip-plan ports', () => {
  it('exposes the model from env and the airport list', () => {
    const { ports } = setup(ok({}));
    expect(ports.model).toBe('gemini-env-model');
    expect(ports.airports).toBe(airports);
  });

  it('authenticates via the admin client and maps 401/403 to invalid', async () => {
    const auth = (getUser: unknown) => setup(ok({}), { auth: { getUser } }).ports;
    expect(await auth(async () => ({ data: { user: { id: 'u' } }, error: null })).authenticate('t')).toEqual({
      kind: 'user',
      id: 'u',
    });
    expect(await auth(async () => ({ data: { user: null }, error: { status: 403 } })).authenticate('t')).toEqual({
      kind: 'invalid',
    });
    await expect(auth(async () => ({ data: { user: null }, error: { status: 500 } })).authenticate('t')).rejects.toBeDefined();
  });

  it('consumes the quota with kind trip_plan', async () => {
    const { admin, rpc } = rpcAdmin({ data: 2 });
    expect(await setup(ok({}), admin).ports.consumeQuota('u', 3)).toBe(2);
    expect(rpc).toHaveBeenCalledWith('consume_ai_quota', { p_user_id: 'u', p_limit: 3, p_kind: 'trip_plan' });
  });

  it('returns null at the limit and throws on an rpc error or a bad result', async () => {
    expect(await setup(ok({}), rpcAdmin({ data: null }).admin).ports.consumeQuota('u', 3)).toBeNull();
    await expect(setup(ok({}), rpcAdmin({ error: new Error('x') }).admin).ports.consumeQuota('u', 3)).rejects.toBeDefined();
    await expect(setup(ok({}), rpcAdmin({ data: 'many' }).admin).ports.consumeQuota('u', 3)).rejects.toBeDefined();
  });

  it('refunds with kind trip_plan and throws on an rpc error', async () => {
    const { admin, rpc } = rpcAdmin({});
    await setup(ok({}), admin).ports.refundQuota('u');
    expect(rpc).toHaveBeenCalledWith('refund_ai_quota', { p_user_id: 'u', p_kind: 'trip_plan' });
    await expect(setup(ok({}), rpcAdmin({ error: new Error('x') }).admin).ports.refundQuota('u')).rejects.toBeDefined();
  });

  it('calls Nearby Search with the key, the field mask and the body', async () => {
    const { ports, fetchMock } = setup(ok({ places: [] }));
    expect(await ports.nearbySearch({ a: 1 })).toEqual({ places: [] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby');
    expect(init?.headers).toEqual(
      expect.objectContaining({ 'X-Goog-Api-Key': 'places-key', 'X-Goog-FieldMask': expect.stringContaining('places.id') }),
    );
    expect(JSON.parse(init?.body as string)).toEqual({ a: 1 });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws when Nearby Search fails', async () => {
    await expect(setup(bad(500)).ports.nearbySearch({})).rejects.toThrow('Nearby Search failed: 500');
  });

  it('sends Gemini the instruction apart from the data, with the schema, low thinking and env model', async () => {
    const { ports, fetchMock } = setup(ok({ candidates: [{ content: { parts: [{ text: '{"days":[]}' }] } }] }));
    expect(await ports.generateWithGemini({ systemInstruction: 'RULES', data: 'DATA {}' })).toBe('{"days":[]}');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-env-model:generateContent');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': 'gemini-key' });
    const sent = JSON.parse(init?.body as string);
    expect(sent.systemInstruction).toEqual({ parts: [{ text: 'RULES' }] });
    expect(sent.contents).toEqual([{ role: 'user', parts: [{ text: 'DATA {}' }] }]);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    const { $schema: _marker, ...expected } = z.toJSONSchema(GeneratedPlanSchema);
    expect(sent.generationConfig.responseJsonSchema).toEqual(expected);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps Places + Gemini under the 60 s the app waits', () => {
    expect(GEMINI_TIMEOUT_MS).toBe(40_000);
  });

  it('throws on a Gemini error status or an empty answer', async () => {
    await expect(
      setup(bad(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } })).ports.generateWithGemini({
        systemInstruction: 's',
        data: 'd',
      }),
    ).rejects.toThrow('Gemini failed: 429 RESOURCE_EXHAUSTED quota');
    await expect(setup(ok({})).ports.generateWithGemini({ systemInstruction: 's', data: 'd' })).rejects.toThrow(
      'Gemini returned no text',
    );
  });

  it('upserts the plan per trip', async () => {
    const upsert = jest.fn(async (_row: unknown, _opts: unknown) => ({ error: null }));
    const from = jest.fn((_table: string) => ({ upsert }));
    const plan = {
      tripId: '22222222-2222-4222-8222-222222222222',
      days: [{ date: '2026-12-01', cityIata: 'LIS', items: [] }],
      model: 'm',
      createdAt: '2026-11-14T10:00:00.000Z',
    };
    await setup(ok({}), { from }).ports.savePlan(plan);
    expect(from).toHaveBeenCalledWith('trip_plans');
    expect(upsert).toHaveBeenCalledWith(
      { trip_id: plan.tripId, days: plan.days, model: 'm', created_at: plan.createdAt },
      { onConflict: 'trip_id' },
    );
  });

  it('throws when the upsert fails', async () => {
    const admin = { from: () => ({ upsert: async () => ({ error: new Error('x') }) }) };
    await expect(
      setup(ok({}), admin).ports.savePlan({ tripId: 't', days: [], model: 'm', createdAt: 'x' } as never),
    ).rejects.toBeDefined();
  });

  describe('loadTrip', () => {
    const rows: Record<string, unknown> = {
      trips: { owner_id: 'owner-1', destination: 'LIS', start_date: '2026-12-01', end_date: '2026-12-03' },
      trip_members: [
        { id: 'm-owner', role: 'owner', interests: ['museums'] },
        { id: 'm-friend', role: 'viewer', interests: ['nightlife'] },
      ],
      flight_segments: [
        {
          direction: 'outbound',
          position: 0,
          from_iata: 'WAW',
          to_iata: 'LIS',
          depart_at: '2026-12-01T10:00:00+00:00',
          depart_tz: 'Europe/Warsaw',
          arrive_at: '2026-12-01T14:30:00+00:00',
          arrive_tz: 'Europe/Lisbon',
        },
      ],
      profiles: { interests: ['local_cuisine'] },
    };
    // Minimal query builder: .select().eq() resolves to the rows, .maybeSingle() to one row.
    const adminFor = (data: Record<string, unknown>) => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => {
            const result = { data: data[table], error: null };
            return { then: (f: (v: unknown) => unknown) => f(result), maybeSingle: async () => result };
          },
        }),
      }),
    });

    it('maps rows to the trip: organizer from the profile, friends without the owner row', async () => {
      const trip = await setup(ok({}), adminFor(rows)).ports.loadTrip('t');
      expect(trip).toEqual({
        ownerId: 'owner-1',
        destination: 'LIS',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        ownerInterests: ['local_cuisine'],
        members: [{ id: 'm-friend', interests: ['nightlife'] }],
        segments: [
          {
            direction: 'outbound',
            order: 0,
            fromIata: 'WAW',
            toIata: 'LIS',
            departAt: '2026-12-01T10:00:00+00:00',
            departTz: 'Europe/Warsaw',
            arriveAt: '2026-12-01T14:30:00+00:00',
            arriveTz: 'Europe/Lisbon',
          },
        ],
      });
    });

    it('returns null for a missing trip', async () => {
      expect(await setup(ok({}), adminFor({ ...rows, trips: null })).ports.loadTrip('t')).toBeNull();
    });
  });
});
