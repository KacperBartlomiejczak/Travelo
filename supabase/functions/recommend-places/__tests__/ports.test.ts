import type { SupabaseClient } from '@supabase/supabase-js';
import { NEARBY_FIELD_MASK } from '../../../../src/lib/place-types';
import gemini from './fixtures/gemini-response.json';
import { createPorts } from '../ports';

const env = { placesApiKey: 'places-key', geminiApiKey: 'gemini-key', geminiModel: 'model-x' };
const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as Response;
const bad = (status: number) => ({ ok: false, status, json: async () => ({}) }) as Response;

function setup(response: Response, rpc?: (fn: string, args: unknown) => Promise<unknown>) {
  const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => response);
  const admin = { rpc: rpc ?? (async () => ({ data: 3, error: null })) };
  const ports = createPorts({
    admin: admin as unknown as SupabaseClient,
    fetch: fetchMock as unknown as typeof fetch,
    env,
  });
  return { ports, fetchMock };
}

const authWith = (getUser: unknown) =>
  createPorts({ admin: { auth: { getUser } } as unknown as SupabaseClient, fetch, env });

describe('recommend-places ports', () => {
  describe('authenticate', () => {
    it('returns the user id', async () => {
      const ports = authWith(async () => ({ data: { user: { id: 'u' } }, error: null }));
      expect(await ports.authenticate('t')).toEqual({ kind: 'user', id: 'u' });
    });
    it.each([401, 403])('maps %i to invalid', async (status) => {
      const ports = authWith(async () => ({ data: { user: null }, error: { status } }));
      expect(await ports.authenticate('t')).toEqual({ kind: 'invalid' });
    });
    it('throws on other failures', async () => {
      const ports = authWith(async () => ({ data: { user: null }, error: { status: 500 } }));
      await expect(ports.authenticate('t')).rejects.toBeDefined();
    });
  });

  describe('consumeQuota', () => {
    it('calls the rpc and returns the remaining count', async () => {
      const rpc = jest.fn(async () => ({ data: 3, error: null }));
      expect(await setup(ok({}), rpc).ports.consumeQuota('u1', 5)).toBe(3);
      expect(rpc).toHaveBeenCalledWith('consume_ai_quota', { p_user_id: 'u1', p_limit: 5 });
    });
    it('returns null at the limit and throws on error', async () => {
      expect(await setup(ok({}), async () => ({ data: null, error: null })).ports.consumeQuota('u', 5)).toBeNull();
      const failing = setup(ok({}), async () => ({ data: null, error: { message: 'x' } }));
      await expect(failing.ports.consumeQuota('u', 5)).rejects.toBeDefined();
    });
  });

  describe('consumeQuota validation', () => {
    it.each([['3'], [-1], [1.5], [{}]])('rejects an invalid rpc result %p', async (data) => {
      const bad = setup(ok({}), async () => ({ data, error: null }));
      await expect(bad.ports.consumeQuota('u', 5)).rejects.toBeDefined();
    });
  });

  describe('nearbySearch', () => {
    it('posts to Places with key, field mask and body', async () => {
      const { ports, fetchMock } = setup(ok({ places: [] }));
      const body = { includedTypes: ['cafe'] };
      expect(await ports.nearbySearch(body)).toEqual({ places: [] });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': 'places-key',
        'X-Goog-FieldMask': NEARBY_FIELD_MASK,
      });
      expect(JSON.parse(init?.body as string)).toEqual(body);
      expect(init?.signal).toBeDefined();
    });
    it('throws on non-2xx', async () => {
      await expect(setup(bad(403)).ports.nearbySearch({})).rejects.toBeDefined();
    });
  });

  describe('pickWithGemini', () => {
    it('posts the prompt with the JSON schema (no $schema) and returns the text', async () => {
      const { ports, fetchMock } = setup(ok(gemini));
      const text = await ports.pickWithGemini('the prompt');
      expect(JSON.parse(text)).toHaveProperty('picks');
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/model-x:generateContent');
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': 'gemini-key' });
      const sent = JSON.parse(init?.body as string);
      expect(sent.contents).toEqual([{ role: 'user', parts: [{ text: 'the prompt' }] }]);
      expect(sent.generationConfig.responseMimeType).toBe('application/json');
      expect(sent.generationConfig.responseJsonSchema).toMatchObject({ type: 'object' });
      expect(sent.generationConfig.responseJsonSchema).not.toHaveProperty('$schema');
      expect(init?.signal).toBeDefined();
    });
    it('throws on non-2xx and on a response without text', async () => {
      await expect(setup(bad(500)).ports.pickWithGemini('p')).rejects.toBeDefined();
      await expect(setup(ok({ candidates: [] })).ports.pickWithGemini('p')).rejects.toBeDefined();
    });
  });
});
