import type { BoardingPass, ParsedTicket, TicketSegment } from '../../schemas/ticket.ts';
import { zonedLocalToDate } from '../time.ts';
import { assignDirections, type AirportLookup } from './text.ts';

const MAX_SEGMENTS = 8;

// BCBP wins on airports, flight number and day; the text only adds times (and only when it is for the same route and day).
export function mergeParsed(bcbp: BoardingPass | null, text: ParsedTicket, airports: AirportLookup): ParsedTicket {
  if (!bcbp) return text;
  const unused = [...text.segments];
  const legs = bcbp.legs.filter((l) => airports(l.fromIata) && airports(l.toIata));
  const merged = assignDirections(legs).map((leg): TicketSegment => {
    const route = (t: TicketSegment) => t.fromIata === leg.fromIata && t.toIata === leg.toIata;
    // Same route and day first; an undated text flight only when no dated one fits.
    let at = unused.findIndex((t) => route(t) && t.flightDate === leg.flightDate);
    if (at < 0) at = unused.findIndex((t) => route(t) && !t.flightDate);
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
  // Text-only flights (e.g. the return leg of a PDF with one boarding-pass barcode) are kept; flights are ordered by day, then by
  // departure instant (UTC; an unknown airport zone falls back to the local clock), untimed last, except that an untimed leg
  // feeding a timed flight of the same day goes right before it (unless it already continues a timed flight). Directions are recomputed over the whole itinerary. Max 8 like validateParsed.
  // Unrelated flights with the same instant keep their input order (stable sort), intended.
  const instant = (s: TicketSegment) => (s.departAt ? zonedLocalToDate(s.departAt, airports(s.fromIata)?.timezone ?? 'UTC').getTime() : null);
  const all = [...merged, ...unused].sort((a, b) => {
    const [ia, ib] = [instant(a), instant(b)];
    return (a.flightDate ?? '9999').localeCompare(b.flightDate ?? '9999') || (ia === null ? (ib === null ? 0 : 1) : ib === null ? -1 : ia - ib);
  });
  for (const u of all.filter((s) => instant(s) === null)) {
    const rest = all.filter((s) => s !== u);
    const feeds = rest.findIndex((t) => instant(t) !== null && t.flightDate === u.flightDate && t.fromIata === u.toIata);
    const continues = rest.some((t) => instant(t) !== null && t.flightDate === u.flightDate && t.toIata === u.fromIata);
    if (feeds >= 0 && !continues) all.splice(0, all.length, ...rest.slice(0, feeds), u, ...rest.slice(feeds));
  }
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
