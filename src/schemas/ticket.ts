import { z } from 'zod';

// Deno resolves relative imports only with an explicit extension. Imported by the Deno Edge Function too.
import { IataCodeSchema, IsoDateSchema, LocalDateTimeSchema } from './common.ts';

// Ticket import (ticket-import-ai plan). No passenger name and no PNR anywhere (D9).
export const TICKET_MAX_BYTES = 5 * 1024 * 1024;
export const TICKET_IMPORTS_PER_DAY = 5; // Gemini calls per user per UTC day
export const TICKET_REJECTS_PER_DAY = 10;
export const MAX_TICKET_SEGMENTS = 8;
export const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/;

export const TicketMimeTypeSchema = z.enum(['application/pdf', 'image/jpeg']);
export const ExtractTicketRequestSchema = z.object({
  mimeType: TicketMimeTypeSchema,
  dataBase64: z
    .string()
    .min(1)
    .max(Math.ceil(TICKET_MAX_BYTES / 3) * 4),
});
export type ExtractTicketRequest = z.infer<typeof ExtractTicketRequestSchema>;

// Segment after stage 1 or 2. Partial results: missing fields are null.
export const TicketSegmentSchema = z.object({
  direction: z.enum(['outbound', 'return']),
  fromIata: IataCodeSchema,
  toIata: IataCodeSchema,
  flightNumber: z.string().regex(FLIGHT_NUMBER_PATTERN).nullable(),
  flightDate: IsoDateSchema.nullable(),
  departAt: LocalDateTimeSchema.nullable(),
  arriveAt: LocalDateTimeSchema.nullable(),
});
export type TicketSegment = z.infer<typeof TicketSegmentSchema>;

// `truncated`: the parser cut flights down to the limit, so the result can never be reported as complete.
export const ParsedTicketSchema = z.object({
  segments: z.array(TicketSegmentSchema).max(MAX_TICKET_SEGMENTS),
  truncated: z.literal(true).optional(),
});
export type ParsedTicket = z.infer<typeof ParsedTicketSchema>;

// Gemini structured output: no free-text strings (every string has a pattern or is an enum).
const LocalTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const GeminiTicketSchema = z.object({
  isTicket: z.boolean(),
  segments: z
    .array(
      z.object({
        direction: z.enum(['outbound', 'return']),
        flightNumber: z.string().regex(FLIGHT_NUMBER_PATTERN).nullable(),
        fromIata: z.string().regex(/^[A-Z]{3}$/),
        toIata: z.string().regex(/^[A-Z]{3}$/),
        departLocal: LocalTimeSchema,
        arriveLocal: LocalTimeSchema,
      }),
    )
    .max(MAX_TICKET_SEGMENTS),
});
export type GeminiTicket = z.infer<typeof GeminiTicketSchema>;

export const ExtractTicketResponseSchema = z.object({
  segments: z.array(TicketSegmentSchema).min(1).max(MAX_TICKET_SEGMENTS),
  source: z.enum(['parser', 'ai']),
  complete: z.boolean(), // false = partial data, "fill in the times"
  remainingToday: z.int().nonnegative(),
});
export type ExtractTicketResponse = z.infer<typeof ExtractTicketResponseSchema>;

export const ExtractTicketErrorSchema = z.object({
  error: z.enum([
    'invalid_input',
    'unauthorized',
    'unsupported_file',
    'file_too_large',
    'limit_reached',
    'not_a_ticket',
    'upstream_failed',
  ]),
});
export type ExtractTicketError = z.infer<typeof ExtractTicketErrorSchema>;

// Camera scan / BCBP leg. Without passenger name and PNR.
export const BoardingPassLegSchema = z.object({
  fromIata: IataCodeSchema,
  toIata: IataCodeSchema,
  flightNumber: z.string().regex(FLIGHT_NUMBER_PATTERN),
  flightDate: IsoDateSchema,
});
export type BoardingPassLeg = z.infer<typeof BoardingPassLegSchema>;
export const BoardingPassSchema = z.object({ legs: z.array(BoardingPassLegSchema).min(1).max(4) });
export type BoardingPass = z.infer<typeof BoardingPassSchema>;
