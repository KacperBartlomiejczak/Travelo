// Ticket import (ticket-import-ai plan, step 4). No Deno globals: everything outside goes through `ExtractTicketPorts`,
// so Jest tests it with fakes. index.ts wires the real ones. The file is held in memory only (D5). Logs carry event
// names only: never the file, PDF text, barcode, prompt or model output.
import { z } from 'zod';
import { parseBcbp } from '../../../src/lib/ticket-parse/bcbp.ts';
import { isComplete, mergeParsed } from '../../../src/lib/ticket-parse/merge.ts';
import { sniffTicketFile } from '../../../src/lib/ticket-parse/sniff.ts';
import { parseTicketText } from '../../../src/lib/ticket-parse/text.ts';
import { validateParsed, validateTicket } from '../../../src/lib/ticket-parse/validate.ts';
import { TICKET_SYSTEM_INSTRUCTION, buildTicketUserContent } from '../../../src/lib/ticket-prompt.ts';
import type { Airport } from '../../../src/schemas/airport.ts';
import {
  ExtractTicketResponseSchema,
  GeminiTicketSchema,
  TICKET_IMPORTS_PER_DAY,
  TICKET_REJECTS_PER_DAY,
  TicketMimeTypeSchema,
} from '../../../src/schemas/ticket.ts';
import type {
  BoardingPass,
  ExtractTicketError,
  ExtractTicketRequest,
  ExtractTicketResponse,
  TicketSegment,
} from '../../../src/schemas/ticket.ts';

export type AuthResult = { kind: 'user'; id: string } | { kind: 'invalid' };
export type QuotaKind = 'ticket' | 'ticket_rejected';
export type LogEvent =
  | 'parser_complete'
  | 'parser_partial'
  | 'gemini_used'
  | 'not_a_ticket'
  | 'gemini_failed'
  | 'limit_reached'
  | 'refund_failed';

/** Stage 1 ports may throw: the handler treats that as "found nothing". The others throw on an unexpected failure. */
export interface ExtractTicketPorts {
  airports: readonly Airport[];
  /** Today as YYYY-MM-DD (UTC). */
  today(): string;
  authenticate(jwt: string): Promise<AuthResult>;
  /** Texts of the barcodes found in a JPEG, or in the images embedded in a PDF. */
  decodeBarcodes(bytes: Uint8Array, mimeType: ExtractTicketRequest['mimeType']): Promise<string[]>;
  /** Text layer of a PDF (null when there is none); skippedPages is true when pages were left unread, so stage 1 cannot be complete. */
  extractPdfText(bytes: Uint8Array): Promise<{ text: string | null; skippedPages: boolean }>;
  /** Remaining units today, or null when the limit was already reached. */
  consumeQuota(userId: string, kind: QuotaKind, limit: number): Promise<number | null>;
  /** Remaining units today, read without consuming; the full limit when nothing was used. */
  readQuota(userId: string, kind: QuotaKind, limit: number): Promise<number>;
  refundQuota(userId: string, kind: QuotaKind): Promise<void>;
  /** The model's JSON text. */
  callGemini(input: {
    systemInstruction: string;
    userText: string;
    mimeType: ExtractTicketRequest['mimeType'];
    dataBase64: string;
  }): Promise<string>;
  log(event: LogEvent): void;
}

export interface ExtractTicketHttpRequest {
  method: string;
  authorization: string | null;
  body: unknown;
}

export interface HandlerResponse {
  status: number;
  body: ExtractTicketResponse | ExtractTicketError;
}

const fail = (status: number, error: ExtractTicketError['error']): HandlerResponse => ({ status, body: { error } });

// Size is judged by sniffTicketFile (413), so this schema must not reject a long string first.
const RequestSchema = z.object({ mimeType: TicketMimeTypeSchema, dataBase64: z.string().min(1) });

export async function handleExtractTicket(
  { method, authorization, body }: ExtractTicketHttpRequest,
  ports: ExtractTicketPorts,
): Promise<HandlerResponse> {
  if (method !== 'POST') return fail(405, 'invalid_input');
  const jwt = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
  if (!jwt) return fail(401, 'unauthorized');
  let auth: AuthResult;
  try {
    auth = await ports.authenticate(jwt);
  } catch {
    return fail(500, 'upstream_failed');
  }
  if (auth.kind === 'invalid') return fail(401, 'unauthorized');
  const userId = auth.id;

  const input = RequestSchema.safeParse(body);
  if (!input.success) return fail(400, 'invalid_input');
  const request = input.data;
  const sniffed = sniffTicketFile(request);
  if (!sniffed.ok) return fail(sniffed.error === 'file_too_large' ? 413 : 415, sniffed.error);
  const { bytes } = sniffed;

  const today = ports.today();
  const known = new Map(ports.airports.map((a) => [a.iata, a]));
  const lookup = (iata: string) => known.get(iata);

  // Stage 1: no AI, no cost. A failing reader counts as "found nothing".
  const attempt = async <T>(run: () => Promise<T>, empty: T): Promise<T> => {
    try {
      return await run();
    } catch {
      return empty;
    }
  };
  const barcodes = await attempt(() => ports.decodeBarcodes(bytes, request.mimeType), [] as string[]);
  const { text, skippedPages } =
    request.mimeType === 'application/pdf'
      ? await attempt(() => ports.extractPdfText(bytes), { text: null as string | null, skippedPages: false })
      : { text: null, skippedPages: false };
  // One pass per barcode (outbound and return may be separate codes): distinct legs, in document order. Not run
  // through BoardingPassSchema (legs.max(4)); validateParsed enforces the segment limit.
  const legs = new Map<string, BoardingPass['legs'][number]>();
  for (const code of barcodes) {
    for (const leg of parseBcbp(code, today, (iata) => known.has(iata))?.legs ?? []) {
      legs.set(`${leg.fromIata}|${leg.toIata}|${leg.flightNumber}|${leg.flightDate}`, leg);
    }
  }
  const bcbp: BoardingPass | null = legs.size > 0 ? { legs: [...legs.values()] } : null;
  const parsed = validateParsed(
    mergeParsed(bcbp, text ? parseTicketText(text, lookup) : { segments: [] }, lookup),
    lookup,
    today,
  );

  const respond = (
    segments: TicketSegment[],
    source: ExtractTicketResponse['source'],
    complete: boolean,
    remainingToday: number,
  ): HandlerResponse => {
    const out = ExtractTicketResponseSchema.safeParse({ segments, source, complete, remainingToday });
    return out.success ? { status: 200, body: out.data } : fail(502, 'upstream_failed');
  };

  // Pages stage 1 did not read may hold more flights: only Gemini, which gets the whole file, can judge it complete.
  if (!skippedPages && isComplete(parsed)) {
    ports.log('parser_complete');
    // Stage 1 costs no quota (Z7), but the app still shows the true count of AI imports left today.
    try {
      return respond(parsed.segments, 'parser', true, await ports.readQuota(userId, 'ticket', TICKET_IMPORTS_PER_DAY));
    } catch {
      return fail(500, 'upstream_failed');
    }
  }
  ports.log('parser_partial');

  // Partial data beats an error (Z8); with nothing from stage 1 the error stands.
  const found = parsed.segments.length > 0;
  const partialOr = (status: number, error: ExtractTicketError['error'], remaining = 0) =>
    found ? respond(parsed.segments, 'parser', false, remaining) : fail(status, error);

  const refund = async (...kinds: QuotaKind[]) => {
    for (const kind of kinds) {
      try {
        await ports.refundQuota(userId, kind);
      } catch {
        ports.log('refund_failed');
      }
    }
  };

  // The count to show after refunds: read it again, and fall back to the estimate if the read fails.
  const remainingAfter = async (estimate: number) => {
    try {
      return await ports.readQuota(userId, 'ticket', TICKET_IMPORTS_PER_DAY);
    } catch {
      return estimate;
    }
  };

  // Stage 2. Both units are spent before Google is called (cost cap); later failures give them back (D6, D7).
  let remaining: number | null;
  try {
    remaining = await ports.consumeQuota(userId, 'ticket', TICKET_IMPORTS_PER_DAY);
  } catch {
    return partialOr(500, 'upstream_failed');
  }
  if (remaining === null) {
    ports.log('limit_reached');
    return partialOr(429, 'limit_reached');
  }
  try {
    if ((await ports.consumeQuota(userId, 'ticket_rejected', TICKET_REJECTS_PER_DAY)) === null) {
      await refund('ticket');
      ports.log('limit_reached');
      return partialOr(429, 'limit_reached', await remainingAfter(remaining + 1));
    }
  } catch {
    await refund('ticket');
    return partialOr(500, 'upstream_failed');
  }

  const failedGemini = async () => {
    ports.log('gemini_failed');
    await refund('ticket', 'ticket_rejected');
    return partialOr(502, 'upstream_failed', await remainingAfter(remaining + 1));
  };

  let verdict: ReturnType<typeof validateTicket>;
  try {
    const raw = await ports.callGemini({
      systemInstruction: TICKET_SYSTEM_INSTRUCTION,
      userText: buildTicketUserContent(parsed),
      mimeType: request.mimeType,
      dataBase64: request.dataBase64,
    });
    ports.log('gemini_used');
    const answer = GeminiTicketSchema.safeParse(JSON.parse(raw));
    if (!answer.success) return await failedGemini();
    verdict = validateTicket(answer.data, parsed, lookup, today, skippedPages);
  } catch {
    return failedGemini();
  }

  if (verdict.kind === 'ok') {
    await refund('ticket_rejected');
    return respond(verdict.segments, 'ai', !parsed.truncated && isComplete({ segments: verdict.segments }), remaining);
  }
  if (verdict.kind === 'mismatch' || found) {
    // The answer disagrees with stage 1, or says "not a ticket" although stage 1 found flights: the response carries
    // data, so it is not a not_a_ticket answer and the rejects counter (which counts only those) gets its unit back.
    // The `ticket` unit stays spent: Gemini was called.
    await refund('ticket_rejected');
    return partialOr(502, 'upstream_failed', remaining);
  }
  ports.log('not_a_ticket');
  await refund('ticket'); // D6: not a ticket gives the unit back; the rejects unit stays spent (D7)
  return fail(422, 'not_a_ticket');
}
