import { z } from 'zod';

import {
  ExtractTicketRequestSchema,
  FLIGHT_NUMBER_PATTERN,
  GeminiTicketSchema,
  MAX_TICKET_SEGMENTS,
  ParsedTicketSchema,
  TICKET_MAX_BYTES,
  TicketMimeTypeSchema,
} from '../ticket';

const segment = {
  direction: 'outbound' as const,
  fromIata: 'WAW',
  toIata: 'MAD',
  flightNumber: 'FR123',
  flightDate: '2026-12-01',
  departAt: '2026-12-01T10:15',
  arriveAt: '2026-12-01T14:05',
};
const geminiSegment = {
  direction: 'outbound' as const,
  flightNumber: 'FR123',
  fromIata: 'WAW',
  toIata: 'MAD',
  departLocal: '2026-12-01T10:15',
  arriveLocal: '2026-12-01T14:05',
};

describe('ticket schemas', () => {
  it('accepts only pdf and jpeg mime types', () => {
    expect(TicketMimeTypeSchema.safeParse('application/pdf').success).toBe(true);
    expect(TicketMimeTypeSchema.safeParse('image/jpeg').success).toBe(true);
    expect(TicketMimeTypeSchema.safeParse('image/png').success).toBe(false);
  });

  it('rejects base64 over the size limit and empty base64', () => {
    const max = Math.ceil(TICKET_MAX_BYTES / 3) * 4;
    const ok = ExtractTicketRequestSchema.safeParse({ mimeType: 'application/pdf', dataBase64: 'A'.repeat(max) });
    const tooLong = ExtractTicketRequestSchema.safeParse({ mimeType: 'application/pdf', dataBase64: 'A'.repeat(max + 1) });
    const empty = ExtractTicketRequestSchema.safeParse({ mimeType: 'application/pdf', dataBase64: '' });
    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
    expect(empty.success).toBe(false);
  });

  it('validates flight number pattern', () => {
    for (const good of ['FR123', 'LO3A', 'U21234', 'W61234B']) expect(FLIGHT_NUMBER_PATTERN.test(good)).toBe(true);
    for (const bad of ['F1', 'fr123', 'FR', 'FR123456', 'FR 123']) expect(FLIGHT_NUMBER_PATTERN.test(bad)).toBe(false);
  });

  it('validates parsed segments: iata, date, local time, nulls', () => {
    expect(ParsedTicketSchema.safeParse({ segments: [segment] }).success).toBe(true);
    const partial = { ...segment, flightNumber: null, flightDate: null, departAt: null, arriveAt: null };
    expect(ParsedTicketSchema.safeParse({ segments: [partial] }).success).toBe(true);
    for (const bad of [
      { ...segment, fromIata: 'waw' },
      { ...segment, flightNumber: 'x' },
      { ...segment, departAt: '2026-12-01T10:15:00+01:00' },
      { ...segment, flightDate: '2026-02-30' },
    ]) {
      expect(ParsedTicketSchema.safeParse({ segments: [bad] }).success).toBe(false);
    }
  });

  it('rejects more than MAX_TICKET_SEGMENTS segments', () => {
    const many = (n: number) => ({ segments: Array.from({ length: n }, () => segment) });
    expect(ParsedTicketSchema.safeParse(many(MAX_TICKET_SEGMENTS)).success).toBe(true);
    expect(ParsedTicketSchema.safeParse(many(MAX_TICKET_SEGMENTS + 1)).success).toBe(false);
    const gemini = (n: number) => ({ isTicket: true, segments: Array.from({ length: n }, () => geminiSegment) });
    expect(GeminiTicketSchema.safeParse(gemini(MAX_TICKET_SEGMENTS)).success).toBe(true);
    expect(GeminiTicketSchema.safeParse(gemini(MAX_TICKET_SEGMENTS + 1)).success).toBe(false);
  });

  it('Gemini schema rejects bad iata and local time', () => {
    const parse = (s: object) => GeminiTicketSchema.safeParse({ isTicket: true, segments: [s] }).success;
    expect(parse({ ...geminiSegment, fromIata: 'wa1' })).toBe(false);
    expect(parse({ ...geminiSegment, departLocal: '2026-12-01 10:15' })).toBe(false);
    expect(parse({ ...geminiSegment, flightNumber: null })).toBe(true);
  });

  const freeTextStrings = (schema: z.ZodType): string[] => {
    const offenders: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
      if (typeof node !== 'object' || node === null) return;
      const obj = node as Record<string, unknown>;
      const isString = obj.type === 'string' || (Array.isArray(obj.type) && obj.type.includes('string'));
      if (isString && obj.pattern === undefined && obj.enum === undefined) offenders.push(path);
      for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
    };
    walk(z.toJSONSchema(schema), '$');
    return offenders;
  };

  it('Gemini JSON Schema has no free-text string (every string has pattern or enum)', () => {
    expect(freeTextStrings(GeminiTicketSchema)).toEqual([]);
  });

  it('free-text walker flags plain and nullable strings', () => {
    expect(freeTextStrings(z.object({ x: z.string() }))).toHaveLength(1);
    expect(freeTextStrings(z.object({ x: z.string().nullable() }))).toHaveLength(1);
    expect(freeTextStrings(z.object({ x: z.string().regex(/^a$/).nullable() }))).toEqual([]);
  });
});
