import type { BoardingPass, ParsedTicket, TicketSegment } from '../../schemas/ticket.ts';
import { zonedLocalToDate } from '../time.ts';
import { assignDirections, type AirportLookup } from './text.ts';

const MAX_SEGMENTS = 8;

// BCBP wins on airports, flight number and day; the text only adds times (and only when it is for the same route and day).
export function mergeParsed(bcbp: BoardingPass | null, text: ParsedTicket, airports: AirportLookup): ParsedTicket {
  if (!bcbp) return text;
  const unused = [...text.segments];
  const legs = bcbp.legs.filter((l) => airports(l.fromIata) && airports(l.toIata));
  const directed = assignDirections(legs);
  const matches = new Map<(typeof directed)[number], TicketSegment>();
  const routeOf = (leg: (typeof directed)[number]) => (t: Pick<TicketSegment, 'fromIata' | 'toIata'>) =>
    t.fromIata === leg.fromIata && t.toIata === leg.toIata;
  const take = (leg: (typeof directed)[number], at: number) => {
    if (at >= 0) matches.set(leg, unused.splice(at, 1)[0]);
  };
  // Exact numbers are resolved for all legs first so leg order cannot steal a number-matched text flight.
  for (const leg of directed) {
    take(leg, unused.findIndex((t) => routeOf(leg)(t) && t.flightDate === leg.flightDate && t.flightNumber === leg.flightNumber));
  }
  for (const leg of directed) {
    if (matches.has(leg)) continue;
    const route = routeOf(leg);
    const sameNo = (t: TicketSegment) => !leg.flightNumber || !t.flightNumber || t.flightNumber === leg.flightNumber;
    const day = (t: Pick<TicketSegment, 'fromIata' | 'toIata' | 'flightDate'>) => route(t) && t.flightDate === leg.flightDate;
    // A missing number is trusted only when it is the one leg and the one text flight left on this route and day.
    const open = directed.filter((l) => !matches.has(l) && day(l)).length === 1 && unused.filter(day).length === 1;
    // A lone leg and a lone text flight on this route and day are the same flight even when the numbers differ.
    if (open && (sameNo(unused[unused.findIndex(day)]) || legs.filter(day).length === 1)) take(leg, unused.findIndex(day));
    // An undated text flight only when no dated one fits.
    else take(leg, unused.findIndex((t) => route(t) && !t.flightDate && sameNo(t)));
  }
  // An ambiguous candidate (same route and day, number missing on a side) of a still-unmatched leg is the same flight, not a new one.
  for (const leg of directed.filter((l) => !matches.has(l))) {
    const dup = (t: TicketSegment) =>
      routeOf(leg)(t) && t.flightDate === leg.flightDate && (!leg.flightNumber || !t.flightNumber);
    for (let i = unused.length - 1; i >= 0; i--) if (dup(unused[i])) unused.splice(i, 1);
  }
  const merged = directed.map((leg): TicketSegment => {
    const match = matches.get(leg);
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
  // Text-only flights (e.g. the return leg of a PDF with one boarding-pass barcode) are kept; flights are ordered by departure
  // instant (UTC; an unknown airport zone falls back to the local clock), an untimed one counting as the end of its day, undated last, except that an untimed leg
  // feeding a timed flight of the same day goes right before it (unless it already continues a timed flight). Directions are recomputed over the whole itinerary. Max 8 like validateParsed.
  // Unrelated flights with the same instant keep their input order (stable sort), intended.
  const instant = (s: TicketSegment) => (s.departAt ? zonedLocalToDate(s.departAt, airports(s.fromIata)?.timezone ?? 'UTC').getTime() : null);
  // One numeric key keeps the sort transitive: departure instant; untimed = end of its day; undated = last.
  const key = (s: TicketSegment) =>
    instant(s) ??
    (s.flightDate ? zonedLocalToDate(`${s.flightDate}T23:59:59`, airports(s.fromIata)?.timezone ?? 'UTC').getTime() : Infinity);
  const all = [...merged, ...unused].sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1));
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
