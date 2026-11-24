import { AIRPORTS } from '../../../../src/data/airports';
import { TICKET_SYSTEM_INSTRUCTION } from '../../../../src/lib/ticket-prompt';
import { ExtractTicketResponseSchema, type GeminiTicket } from '../../../../src/schemas/ticket';
import { handleExtractTicket, type ExtractTicketPorts } from '../handler';

const USER = '11111111-1111-4111-8111-111111111111';
const PDF = btoa('%PDF-1.4 fake');
const JPEG = btoa('\xff\xd8\xff\xe0 fake');
const PNG = btoa('\x89PNG fake');

const pad = (s: string, n: number) => s.padEnd(n, ' ').slice(0, n);
// WAW -> BCN FR0123, day 340 = 2026-12-06. Carries a passenger name and a PNR that must never leak.
const BCBP = `M1${pad('DOE/JOHN', 20)}E${pad('ZXQ4TK', 7)}WAWBCN${pad('FR', 3)}${pad('0123', 5)}340Y012A00001100`;
const FULL_TEXT = 'WAW → BCN FR123 Departure 2026-12-06 06:45 Arrival 2026-12-06 09:50';

const gemini = (o: Partial<GeminiTicket['segments'][number]> = {}): GeminiTicket => ({
  isTicket: true,
  segments: [
    {
      direction: 'outbound',
      flightNumber: 'FR123',
      fromIata: 'WAW',
      toIata: 'BCN',
      departLocal: '2026-12-06T06:45',
      arriveLocal: '2026-12-06T09:50',
      ...o,
    },
  ],
});

function makePorts(overrides: Partial<ExtractTicketPorts> = {}, usedToday = 0) {
  const calls: string[] = [];
  const logs: string[] = [];
  const quota: { consumed: string[]; refunded: string[]; read: string[] } = { consumed: [], refunded: [], read: [] };
  const used = { ticket: usedToday, ticket_rejected: 0 }; // a tiny stateful quota, like the real counter
  const seen: { input?: Parameters<ExtractTicketPorts['callGemini']>[0] } = {};
  const ports: ExtractTicketPorts = {
    airports: AIRPORTS,
    today: () => '2026-11-19',
    authenticate: async () => ({ kind: 'user', id: USER }),
    decodeBarcodes: async () => {
      calls.push('decodeBarcodes');
      return [];
    },
    extractPdfText: async () => {
      calls.push('extractPdfText');
      return null;
    },
    consumeQuota: async (_u, kind, limit) => {
      calls.push('consumeQuota');
      quota.consumed.push(kind);
      used[kind]++;
      return limit - used[kind];
    },
    readQuota: async (_u, kind, limit) => {
      calls.push('readQuota');
      quota.read.push(kind);
      return limit - used[kind];
    },
    refundQuota: async (_u, kind) => {
      calls.push('refundQuota');
      used[kind]--;
      quota.refunded.push(kind);
    },
    callGemini: async (input) => {
      calls.push('callGemini');
      seen.input = input;
      return JSON.stringify(gemini());
    },
    log: (event) => {
      logs.push(event);
    },
    ...overrides,
  };
  return { ports, calls, logs, quota, seen };
}

const req = (over: Partial<Parameters<typeof handleExtractTicket>[0]> = {}) => ({
  method: 'POST',
  authorization: 'Bearer jwt',
  body: { mimeType: 'application/pdf', dataBase64: PDF } as unknown,
  ...over,
});

describe('handleExtractTicket request checks', () => {
  it('405 for a method other than POST', async () => {
    const { ports } = makePorts();
    expect((await handleExtractTicket(req({ method: 'GET' }), ports)).status).toBe(405);
  });

  it('401 without a bearer token and with an invalid one', async () => {
    const { ports } = makePorts({ authenticate: async () => ({ kind: 'invalid' }) });
    expect(await handleExtractTicket(req({ authorization: null }), ports)).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect((await handleExtractTicket(req(), ports)).status).toBe(401);
  });

  it('500 when authentication itself fails', async () => {
    const { ports } = makePorts({
      authenticate: async () => {
        throw new Error('down');
      },
    });
    expect((await handleExtractTicket(req(), ports)).status).toBe(500);
  });

  it('400 for a malformed body', async () => {
    const { ports } = makePorts();
    for (const body of [
      undefined,
      {},
      { mimeType: 'image/png', dataBase64: PDF },
      { mimeType: 'application/pdf', dataBase64: '' },
    ]) {
      expect(await handleExtractTicket(req({ body }), ports)).toEqual({ status: 400, body: { error: 'invalid_input' } });
    }
  });

  it('415 for a file that does not match its type, without parsing or using quota', async () => {
    const { ports, calls } = makePorts();
    for (const body of [
      { mimeType: 'image/jpeg', dataBase64: PNG },
      { mimeType: 'application/pdf', dataBase64: JPEG },
      { mimeType: 'application/pdf', dataBase64: '***not base64***' },
    ]) {
      expect(await handleExtractTicket(req({ body }), ports)).toEqual({
        status: 415,
        body: { error: 'unsupported_file' },
      });
    }
    expect(calls).toEqual([]);
  });

  it('413 for a file over 5 MB, without parsing or using quota', async () => {
    const { ports, calls } = makePorts();
    const body = { mimeType: 'application/pdf', dataBase64: 'A'.repeat(7_000_000) };
    expect(await handleExtractTicket(req({ body }), ports)).toEqual({ status: 413, body: { error: 'file_too_large' } });
    expect(calls).toEqual([]);
  });
});

describe('stage 1 (parser)', () => {
  it('a complete result is returned as parser, without Gemini and without quota', async () => {
    const { ports, calls, logs, quota } = makePorts({ extractPdfText: async () => FULL_TEXT }, 2);
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(quota.read).toEqual(['ticket']);
    expect(ExtractTicketResponseSchema.parse(res.body)).toMatchObject({
      source: 'parser',
      complete: true,
      remainingToday: 3, // 5 - 2 used: the true remaining count, read without consuming
      segments: [{ fromIata: 'WAW', toIata: 'BCN', flightNumber: 'FR123', departAt: '2026-12-06T06:45' }],
    });
    expect(calls).not.toContain('callGemini');
    expect(calls).not.toContain('consumeQuota');
    expect(logs).toEqual(['parser_complete']);
  });

  it('500 when the remaining count cannot be read', async () => {
    const { ports } = makePorts({
      extractPdfText: async () => FULL_TEXT,
      readQuota: async () => {
        throw new Error('db');
      },
    });
    expect((await handleExtractTicket(req(), ports)).status).toBe(500);
  });

  it('a broken stage 1 port is treated as "found nothing", not as a failure', async () => {
    const { ports } = makePorts({
      decodeBarcodes: async () => {
        throw new Error('wasm');
      },
      extractPdfText: async () => {
        throw new Error('pdf');
      },
      callGemini: async () => JSON.stringify({ isTicket: false, segments: [] }),
    });
    expect((await handleExtractTicket(req(), ports)).status).toBe(422);
  });

  it('reads text only from a PDF', async () => {
    const { ports, calls } = makePorts();
    await handleExtractTicket(req({ body: { mimeType: 'image/jpeg', dataBase64: JPEG } }), ports);
    expect(calls).toContain('decodeBarcodes');
    expect(calls).not.toContain('extractPdfText');
  });

  it('drops times that fail validation, so the result is not complete and Gemini is asked', async () => {
    const { ports, calls, seen } = makePorts({
      extractPdfText: async () => 'WAW → BCN FR123 Departure 2026-12-06 06:45 Arrival 2026-12-06 05:00',
    });
    const res = await handleExtractTicket(req(), ports);
    expect(calls).toContain('callGemini');
    expect(seen.input?.userText).toContain('"flightNumber":"FR123"');
    expect(seen.input?.userText).not.toContain('05:00'); // the arrival before the departure was dropped
    expect(ExtractTicketResponseSchema.parse(res.body).source).toBe('ai');
  });
});

describe('stage 2 (Gemini)', () => {
  const bcbpOnly = (extra: Partial<ExtractTicketPorts> = {}) =>
    makePorts({ decodeBarcodes: async () => [BCBP], ...extra });

  it('sends the certain fields, accepts an agreeing answer as ai and refunds ticket_rejected', async () => {
    const { ports, quota, seen, logs } = bcbpOnly();
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(ExtractTicketResponseSchema.parse(res.body)).toMatchObject({
      source: 'ai',
      complete: true,
      remainingToday: 4,
      segments: [
        { fromIata: 'WAW', toIata: 'BCN', flightNumber: 'FR123', flightDate: '2026-12-06', departAt: '2026-12-06T06:45' },
      ],
    });
    expect(quota.consumed).toEqual(['ticket', 'ticket_rejected']);
    expect(quota.refunded).toEqual(['ticket_rejected']);
    expect(seen.input).toMatchObject({
      systemInstruction: TICKET_SYSTEM_INSTRUCTION,
      mimeType: 'application/pdf',
      dataBase64: PDF,
    });
    expect(seen.input?.userText).toContain('"flightNumber":"FR123"');
    expect(seen.input?.userText).not.toMatch(/DOE|ZXQ4TK|M1/);
    expect(logs).toEqual(['parser_partial', 'gemini_used']);
  });

  it('keeps the legs of every valid barcode, so a return code is not lost', async () => {
    // BCN -> WAW FR0124, day 345 = 2026-12-11
    const back = `M1${pad('DOE/JOHN', 20)}E${pad('ZXQ4TK', 7)}BCNWAW${pad('FR', 3)}${pad('0124', 5)}345Y012A00001100`;
    const both = gemini();
    both.segments.push({
      direction: 'return',
      flightNumber: 'FR124',
      fromIata: 'BCN',
      toIata: 'WAW',
      departLocal: '2026-12-11T10:00',
      arriveLocal: '2026-12-11T13:05',
    });
    const { ports } = bcbpOnly({ decodeBarcodes: async () => [BCBP, back], callGemini: async () => JSON.stringify(both) });
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(ExtractTicketResponseSchema.parse(res.body)).toMatchObject({
      source: 'ai',
      complete: true,
      segments: [
        { fromIata: 'WAW', toIata: 'BCN', flightNumber: 'FR123' },
        { fromIata: 'BCN', toIata: 'WAW', flightNumber: 'FR124', flightDate: '2026-12-11' },
      ],
    });
  });

  it('the same barcode twice gives one leg', async () => {
    const { ports } = bcbpOnly({ decodeBarcodes: async () => [BCBP, BCBP] });
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(ExtractTicketResponseSchema.parse(res.body).segments).toHaveLength(1);
  });

  it('answers with the stage 1 data, complete false, when Gemini disagrees with it', async () => {
    const { ports, quota } = bcbpOnly({ callGemini: async () => JSON.stringify(gemini({ flightNumber: 'FR999' })) });
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(ExtractTicketResponseSchema.parse(res.body)).toMatchObject({
      source: 'parser',
      complete: false,
      segments: [{ fromIata: 'WAW', toIata: 'BCN', flightNumber: 'FR123', departAt: null, arriveAt: null }],
    });
    expect(quota.refunded).toEqual(['ticket_rejected']);
  });

  it('Gemini saying isTicket false while stage 1 found flights gives partial data, refunds ticket_rejected (it counts only not_a_ticket answers) and keeps the ticket unit spent', async () => {
    const { ports, quota } = bcbpOnly({
      callGemini: async () => JSON.stringify({ isTicket: false, segments: [] }),
    });
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(ExtractTicketResponseSchema.parse(res.body)).toMatchObject({ source: 'parser', complete: false });
    expect(quota.refunded).toEqual(['ticket_rejected']); // the rejects counter counts only not_a_ticket answers
  });

  it('exhausted ticket quota with partial data gives 200 complete false, without Gemini', async () => {
    const { ports, calls } = bcbpOnly({ consumeQuota: async () => null });
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(ExtractTicketResponseSchema.parse(res.body)).toMatchObject({ complete: false, remainingToday: 0 });
    expect(calls).not.toContain('callGemini');
  });

  it('exhausted ticket quota with no data gives 429 limit_reached', async () => {
    const { ports } = makePorts({ consumeQuota: async () => null });
    expect(await handleExtractTicket(req(), ports)).toEqual({ status: 429, body: { error: 'limit_reached' } });
  });

  it('reports the true remaining count after a refund: failed Gemini and exhausted rejects quota', async () => {
    const failed = bcbpOnly({
      callGemini: async () => {
        throw new Error('down');
      },
    });
    const a = await handleExtractTicket(req(), failed.ports);
    expect(ExtractTicketResponseSchema.parse(a.body).remainingToday).toBe(5); // consumed then refunded

    const rejectsFull = bcbpOnly({
      consumeQuota: async (_u, kind, limit) => (kind === 'ticket' ? limit - 2 : null),
      readQuota: async () => 4, // after the refund the real counter says 4 left
    });
    const b = await handleExtractTicket(req(), rejectsFull.ports);
    expect(ExtractTicketResponseSchema.parse(b.body)).toMatchObject({ complete: false, remainingToday: 4 });
  });

  it('exhausted rejects quota gives the ticket unit back and behaves like the limit', async () => {
    const { ports, quota, calls } = makePorts({ consumeQuota: async (_u, kind) => (kind === 'ticket' ? 3 : null) });
    expect(await handleExtractTicket(req(), ports)).toEqual({ status: 429, body: { error: 'limit_reached' } });
    expect(quota.refunded).toEqual(['ticket']);
    expect(calls).not.toContain('callGemini');
  });

  it('isTicket false gives 422 not_a_ticket and refunds only ticket', async () => {
    const { ports, quota, logs } = makePorts({
      callGemini: async () => JSON.stringify({ isTicket: false, segments: [] }),
    });
    expect(await handleExtractTicket(req(), ports)).toEqual({ status: 422, body: { error: 'not_a_ticket' } });
    expect(quota.refunded).toEqual(['ticket']);
    expect(logs).toContain('not_a_ticket');
  });

  it('a Gemini failure refunds both and gives partial data when stage 1 found something', async () => {
    const { ports, quota } = bcbpOnly({
      callGemini: async () => {
        throw new Error('gemini down');
      },
    });
    const res = await handleExtractTicket(req(), ports);
    expect(res.status).toBe(200);
    expect(ExtractTicketResponseSchema.parse(res.body)).toMatchObject({ source: 'parser', complete: false });
    expect([...quota.refunded].sort()).toEqual(['ticket', 'ticket_rejected']);
  });

  it('a Gemini failure or an answer that breaks the schema gives 502 when stage 1 found nothing', async () => {
    for (const callGemini of [
      async () => {
        throw new Error('gemini down');
      },
      async () => 'not json',
      async () => JSON.stringify({ isTicket: true, segments: [{ nope: 1 }] }),
    ]) {
      const { ports, quota } = makePorts({ callGemini });
      expect(await handleExtractTicket(req(), ports)).toEqual({ status: 502, body: { error: 'upstream_failed' } });
      expect([...quota.refunded].sort()).toEqual(['ticket', 'ticket_rejected']);
    }
  });

  it('500 when the quota rpc fails and stage 1 found nothing', async () => {
    const { ports } = makePorts({
      consumeQuota: async () => {
        throw new Error('rpc');
      },
    });
    expect((await handleExtractTicket(req(), ports)).status).toBe(500);
  });
});

describe('logs', () => {
  it('carry only event names, never the file, text, barcode, prompt or model output', async () => {
    const secret = 'SECRET-PNR-TEXT';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const a = makePorts({
      decodeBarcodes: async () => [BCBP],
      extractPdfText: async () => `${secret} ${FULL_TEXT}`,
      callGemini: async () => `${secret} not json`,
    });
    const b = makePorts({ callGemini: async () => JSON.stringify({ isTicket: false, segments: [] }) });
    await handleExtractTicket(req(), a.ports);
    await handleExtractTicket(req(), b.ports);
    const allowed = [
      'parser_complete',
      'parser_partial',
      'gemini_used',
      'not_a_ticket',
      'gemini_failed',
      'limit_reached',
      'refund_failed',
    ];
    expect([...a.logs, ...b.logs].every((l) => allowed.includes(l))).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(spyErr).not.toHaveBeenCalled();
    spy.mockRestore();
    spyErr.mockRestore();
  });
});
