import type { BoardingPass, ParsedTicket, TicketSegment } from '../../schemas/ticket.ts';
import { assignDirections, type AirportLookup } from './text.ts';

const MAX_SEGMENTS = 8;

// BCBP wins on airports, flight number and day; the text only adds times (and only when it is for the same route and day).
export function mergeParsed(bcbp: BoardingPass | null, text: ParsedTicket, airports: AirportLookup): ParsedTicket {
  if (!bcbp) return text;
  const unused = [...text.segments];
  const legs = bcbp.legs.filter((l) => airports(l.fromIata) && airports(l.toIata));
  const merged = assignDirections(legs).map((leg): TicketSegment => {
    const at = unused.findIndex((t) => t.fromIata === leg.fromIata && t.toIata === leg.toIata && (t.flightDate === leg.flightDate || !t.flightDate));
    const match = at >= 0 ? unused.splice(at, 1)[0] : undefined;
    const sameDay = match?.flightDate === leg.flightDate;
    return {
      direction: leg.direction,
      fromIata: leg.fromIata,
      toIata: leg.toIata,
      flightNumber: leg.flightNumber,
      flightDate: leg.flightDate,
      departAt: sameDay ? match.departAt : null,
      arriveAt: sameDay ? match.arriveAt : null,
    };
  });
  // Text-only flights (e.g. the return leg of a PDF with one boarding-pass barcode) are kept; flights are ordered by day
  // (then by departure time untimed last; stable otherwise) and directions are recomputed over the whole itinerary. Max 8 like validateParsed.
  const all = [...merged, ...unused].sort(
    (a, b) =>
      (a.flightDate ?? '9999').localeCompare(b.flightDate ?? '9999') ||
      (a.departAt ?? '￿').localeCompare(b.departAt ?? '￿'),
  );
  const truncated = all.length > MAX_SEGMENTS || text.truncated;
  return { segments: assignDirections(all).slice(0, MAX_SEGMENTS), ...(truncated && { truncated: true as const }) };
}

// D13: every segment has airports, flight number and departure and arrival times.
export function isComplete(parsed: ParsedTicket): boolean {
  return (
    !parsed.truncated &&
    parsed.segments.length > 0 &&
    parsed.segments.every((s) => s.fromIata && s.toIata && s.flightNumber && s.departAt && s.arriveAt)
  );
}
