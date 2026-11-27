import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { GeminiTicketSchema } from '../../../../src/schemas/ticket';
import { createPorts, GEMINI_TIMEOUT_MS } from '../ports';

const env = { geminiApiKey: 'gemini-key', geminiModel: 'gemini-env-model' };
const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as Response;
const bad = (status: number, json: unknown = {}) => ({ ok: false, status, json: async () => json }) as Response;

function setup(response: Response, admin: unknown = {}) {
  const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => response);
  const ports = createPorts({ admin: admin as SupabaseClient, fetch: fetchMock as unknown as typeof fetch, env });
  return { ports, fetchMock };
}

const rpcAdmin = (result: { data?: unknown; error?: unknown }) => {
  const rpc = jest.fn(async (_name: string, _args: unknown) => ({ data: null, error: null, ...result }));
  return { admin: { rpc }, rpc };
};

describe('extract-ticket ports', () => {
  it('authenticates via the admin client and maps 401/403 to invalid', async () => {
    const auth = (getUser: unknown) => setup(ok({}), { auth: { getUser } }).ports;
    expect(await auth(async () => ({ data: { user: { id: 'u' } }, error: null })).authenticate('t')).toEqual({
      kind: 'user',
      id: 'u',
    });
    expect(await auth(async () => ({ data: { user: null }, error: { status: 401 } })).authenticate('t')).toEqual({
      kind: 'invalid',
    });
    await expect(auth(async () => ({ data: { user: null }, error: { status: 500 } })).authenticate('t')).rejects.toBeDefined();
  });

  it.each(['ticket', 'ticket_rejected'] as const)('consumes the quota with kind %s', async (kind) => {
    const { admin, rpc } = rpcAdmin({ data: 2 });
    expect(await setup(ok({}), admin).ports.consumeQuota('u', kind, 5)).toBe(2);
    expect(rpc).toHaveBeenCalledWith('consume_ai_quota', { p_user_id: 'u', p_limit: 5, p_kind: kind });
  });

  it('returns null at the limit and throws on an rpc error or a bad result', async () => {
    expect(await setup(ok({}), rpcAdmin({ data: null }).admin).ports.consumeQuota('u', 'ticket', 5)).toBeNull();
    await expect(
      setup(ok({}), rpcAdmin({ error: new Error('x') }).admin).ports.consumeQuota('u', 'ticket', 5),
    ).rejects.toBeDefined();
    await expect(setup(ok({}), rpcAdmin({ data: 'many' }).admin).ports.consumeQuota('u', 'ticket', 5)).rejects.toBeDefined();
  });

  describe('readQuota', () => {
    const selectAdmin = (result: { data?: unknown; error?: unknown }) => {
      const maybeSingle = jest.fn(async () => ({ data: null, error: null, ...result }));
      const chain: { select: jest.Mock; eq: jest.Mock; maybeSingle: jest.Mock } = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        maybeSingle,
      };
      const eq = chain.eq;
      const from = jest.fn((_t: string) => chain);
      return { admin: { from }, from, eq, chain };
    };

    it("reads today's UTC counter of the kind without consuming it", async () => {
      const { admin, from, eq } = selectAdmin({ data: { count: 2 } });
      expect(await setup(ok({}), admin).ports.readQuota('u', 'ticket', 5)).toBe(3);
      expect(from).toHaveBeenCalledWith('ai_usage');
      expect(eq).toHaveBeenCalledWith('user_id', 'u');
      expect(eq).toHaveBeenCalledWith('day', new Date().toISOString().slice(0, 10));
      expect(eq).toHaveBeenCalledWith('kind', 'ticket');
    });

    it('is the full limit without a row, never below 0, and throws on an error or a bad row', async () => {
      expect(await setup(ok({}), selectAdmin({ data: null }).admin).ports.readQuota('u', 'ticket', 5)).toBe(5);
      expect(await setup(ok({}), selectAdmin({ data: { count: 9 } }).admin).ports.readQuota('u', 'ticket', 5)).toBe(0);
      await expect(setup(ok({}), selectAdmin({ error: new Error('x') }).admin).ports.readQuota('u', 'ticket', 5)).rejects.toBeDefined();
      await expect(setup(ok({}), selectAdmin({ data: { count: 'x' } }).admin).ports.readQuota('u', 'ticket', 5)).rejects.toBeDefined();
    });
  });

  it('refunds the given kind and throws on an rpc error', async () => {
    const { admin, rpc } = rpcAdmin({});
    await setup(ok({}), admin).ports.refundQuota('u', 'ticket_rejected');
    expect(rpc).toHaveBeenCalledWith('refund_ai_quota', { p_user_id: 'u', p_kind: 'ticket_rejected' });
    await expect(setup(ok({}), rpcAdmin({ error: new Error('x') }).admin).ports.refundQuota('u', 'ticket')).rejects.toBeDefined();
  });

  it('sends Gemini the instruction apart, the file as inlineData, the Zod schema, low thinking, no tools', async () => {
    const { ports, fetchMock } = setup(ok({ candidates: [{ content: { parts: [{ text: '{"isTicket":false,"segments":[]}' }] } }] }));
    const text = await ports.callGemini({
      systemInstruction: 'RULES',
      userText: 'DATA',
      mimeType: 'application/pdf',
      dataBase64: 'QUJD',
    });
    expect(text).toBe('{"isTicket":false,"segments":[]}');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-env-model:generateContent');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': 'gemini-key' });
    const sent = JSON.parse(init?.body as string);
    expect(sent.systemInstruction).toEqual({ parts: [{ text: 'RULES' }] });
    expect(sent.contents).toEqual([
      { role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: 'QUJD' } }, { text: 'DATA' }] },
    ]);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    const { $schema: _marker, ...expected } = z.toJSONSchema(GeminiTicketSchema);
    expect(sent.generationConfig.responseJsonSchema).toEqual(expected);
    expect(sent).not.toHaveProperty('tools');
    expect(sent).not.toHaveProperty('toolConfig');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('waits at most 30 s for Gemini (the app waits 45 s) and passes an abort signal to fetch', async () => {
    expect(GEMINI_TIMEOUT_MS).toBe(30_000);
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    const { ports, fetchMock } = setup(ok({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }));
    await ports.callGemini({ systemInstruction: 's', userText: 'd', mimeType: 'application/pdf', dataBase64: 'QUJD' });
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(timeout.mock.results[0]!.value);
    timeout.mockRestore();
  });

  it('throws on a Gemini error status or an empty answer, without echoing the file', async () => {
    await expect(
      setup(bad(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } })).ports.callGemini({
        systemInstruction: 's',
        userText: 'd',
        mimeType: 'image/jpeg',
        dataBase64: 'SECRETFILE',
      }),
    ).rejects.toThrow('Gemini failed: 429 RESOURCE_EXHAUSTED quota');
    await expect(
      setup(ok({})).ports.callGemini({ systemInstruction: 's', userText: 'd', mimeType: 'image/jpeg', dataBase64: 'x' }),
    ).rejects.toThrow('Gemini returned no text');
  });
});
