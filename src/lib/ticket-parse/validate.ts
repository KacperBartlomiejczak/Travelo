import {
  FLIGHT_NUMBER_PATTERN,
  MAX_TICKET_SEGMENTS,
  TicketSegmentSchema,
  type GeminiTicket,
  type ParsedTicket,
  type TicketSegment,
} from '../../schemas/ticket.ts';
import { isLocalDateTime } from '../../schemas/common.ts';
import { isExistingLocalTime, zonedLocalToDate } from '../time.ts';
import type { AirportLookup } from './text.ts';

export type ValidateResult = { kind: 'ok'; segments: TicketSegment[] } | { kind: 'not_a_ticket' } | { kind: 'mismatch' };

const shiftYears = (date: string, years: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
};

const instant = (local: string, tz: string) =>
  isLocalDateTime(local) && isExistingLocalTime(local, tz) ? zonedLocalToDate(local, tz).getTime() : null;

// Stage 1 output gets the same checks as Gemini output: bad times become null (so Gemini fills them), the rest is kept.
export function validateParsed(parsed: ParsedTicket, airports: AirportLookup, today: string): ParsedTicket {
  const min = shiftYears(today, -1);
  const max = shiftYears(today, 2);
  return {
    segments: parsed.segments.map((s) => {
      const from = airports(s.fromIata);
      const to = airports(s.toIata);
      const departs = from && s.departAt ? instant(s.departAt, from.timezone) : null;
      const departDay = s.departAt?.slice(0, 10) ?? '';
      const departOk = departs !== null && departDay >= min && departDay <= max;
      const arrives = to && s.arriveAt ? instant(s.arriveAt, to.timezone) : null;
      const arriveOk = arrives !== null && departOk && arrives > departs;
      return { ...s, departAt: departOk ? s.departAt : null, arriveAt: arriveOk ? s.arriveAt : null };
    }),
  };
}

export function validateTicket(
  gemini: GeminiTicket,
  parsed: ParsedTicket,
  airports: AirportLookup,
  today: string,
): ValidateResult {
  if (!gemini.isTicket || gemini.segments.length === 0 || gemini.segments.length > MAX_TICKET_SEGMENTS) return { kind: 'not_a_ticket' };
  const min = shiftYears(today, -1);
  const max = shiftYears(today, 2);

  const segments: TicketSegment[] = [];
  for (const g of gemini.segments) {
    const from = airports(g.fromIata);
    const to = airports(g.toIata);
    if (!from || !to || g.fromIata === g.toIata) return { kind: 'not_a_ticket' };
    const departs = instant(g.departLocal, from.timezone);
    const arrives = instant(g.arriveLocal, to.timezone);
    if (departs === null || arrives === null) return { kind: 'not_a_ticket' };
    const day = g.departLocal.slice(0, 10);
    if (arrives <= departs || day < min || day > max) return { kind: 'not_a_ticket' };
    segments.push({
      direction: g.direction,
      fromIata: g.fromIata,
      toIata: g.toIata,
      flightNumber: g.flightNumber && FLIGHT_NUMBER_PATTERN.test(g.flightNumber) ? g.flightNumber : null,
      flightDate: day,
      departAt: g.departLocal,
      arriveAt: g.arriveLocal,
    });
  }

  if (parsed.segments.length > 0) {
    if (parsed.segments.length !== segments.length) return { kind: 'mismatch' };
    const agrees = parsed.segments.every((p, i) => {
      const s = segments[i];
      return (
        p.fromIata === s.fromIata &&
        p.toIata === s.toIata &&
        (p.flightNumber === null || p.flightNumber === s.flightNumber) &&
        (p.flightDate === null || p.flightDate === s.flightDate) &&
        (p.departAt === null || p.departAt === s.departAt) &&
        (p.arriveAt === null || p.arriveAt === s.arriveAt)
      );
    });
    if (!agrees) return { kind: 'mismatch' };
    // Stage 1 direction is authoritative (Z9); Gemini only decides it when stage 1 found nothing.
    segments.forEach((s, i) => (s.direction = parsed.segments[i].direction));
  }
  return segments.every((s) => TicketSegmentSchema.safeParse(s).success)
    ? { kind: 'ok', segments }
    : { kind: 'not_a_ticket' };
}
