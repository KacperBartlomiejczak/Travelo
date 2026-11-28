import {
  FLIGHT_NUMBER_PATTERN,
  MAX_TICKET_SEGMENTS,
  ParsedTicketSchema,
  type ParsedTicket,
} from '../../schemas/ticket.ts';

export type AirportLookup = (iata: string) => { timezone: string } | undefined;

// Generic patterns only (no real carrier samples yet). When fields cannot be tied to one segment they stay null; Gemini fills gaps.
const MONTHS: Record<string, number> = {
  ...Object.fromEntries(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map((m, i) => [m, i + 1])),
  ...Object.fromEntries(['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'].map((m, i) => [m, i + 1])),
};
const ARROW_ROUTE = /\b([A-Z]{3})\b\)?\s*(?:→|->|–|—|-|>|\bto\b|\bdo\b)\s*\(?\b([A-Z]{3})\b/g;
const PAREN_CODE = /\(([A-Z]{3})\)/g;
const PAREN_ROUTE = /\(([A-Z]{3})\)\s*(?:→|->|–|—|-|>|\bto\b|\bdo\b)\s*[\p{L} .'-]{0,40}?\(([A-Z]{3})\)/gu;
const FLIGHT = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{1,4}[A-Z]?)\b/g;
const DEP_LABEL = /\b(?:Departure|Departs|Depart|Wylot|Odlot)\b/i;
const ANY_LABEL = /\b(?:Departure|Departs|Depart|Wylot|Odlot|Arrival|Arrives|Arrive|Przylot)\b/gi;
const ARR_LABEL = /\b(?:Arrival|Arrives|Arrive|Przylot)\b/i;
const TIME = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const WINDOW = 60;

const pad = (n: number) => String(n).padStart(2, '0');

function ymd(y: number, m: number, d: number): string | null {
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// All date-like tokens in `s`, in order; an impossible date (30 Feb) yields null so callers never fall back to a guess.
function dates(s: string): (string | null)[] {
  const found: { index: number; value: string | null }[] = [];
  const add = (re: RegExp, build: (m: RegExpMatchArray) => string | null) => {
    for (const m of s.matchAll(re)) found.push({ index: m.index ?? 0, value: build(m) });
  };
  add(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => ymd(+m[1], +m[2], +m[3]));
  add(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g, (m) => ymd(+m[3], +m[2], +m[1])); // day first (European)
  add(/\b(\d{1,2})\s+(\p{L}{3,})\.?,?\s+(\d{4})\b/gu, (m) => {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    return month ? ymd(+m[3], month, +m[1]) : null;
  });
  return found.sort((a, b) => a.index - b.index).map((f) => f.value);
}

const timeOf = (s: string): string | null => {
  const m = s.match(TIME);
  return m ? `${pad(+m[1])}:${m[2]}` : null;
};

// Text following the first `label` up to the next label or WINDOW chars.
function windowAfter(block: string, label: RegExp): string | null {
  const m = label.exec(block);
  if (!m) return null;
  const rest = block.slice(m.index + m[0].length);
  const next = rest.search(ANY_LABEL);
  return rest.slice(0, Math.min(WINDOW, next < 0 ? WINDOW : next));
}

// The way back starts at the first leg that returns to an airport already departed from, provided the trip ends at the origin.
export function assignDirections<T extends { fromIata: string; toIata: string }>(
  segments: T[],
): (T & { direction: 'outbound' | 'return' })[] {
  const origin = segments[0]?.fromIata;
  const turn = segments.findIndex((s, i) => i > 0 && segments.slice(0, i).some((p) => p.fromIata === s.toIata));
  const hasReturn = turn > 0 && segments[segments.length - 1].toIata === origin;
  return segments.map((s, i) => ({ ...s, direction: hasReturn && i >= turn ? 'return' : 'outbound' }));
}

type Route = { index: number; end: number; from: string; to: string; format?: number };

// "(XXX)" tied to the nearest preceding Departure/Arrival word (no other bracket in between); a departure followed by an arrival makes a route.
function labelledRoutes(text: string, airports: AirportLookup) {
  const tied: { index: number; end: number; kind: 'dep' | 'arr'; iata: string }[] = [];
  for (const m of text.matchAll(PAREN_CODE)) {
    const at = m.index ?? 0;
    if (!airports(m[1])) continue;
    const before = text.slice(Math.max(0, at - 40), at);
    const label = [...before.matchAll(ANY_LABEL)].pop();
    if (!label || before.slice((label.index ?? 0) + label[0].length).includes('(')) continue;
    tied.push({ index: at - before.length + (label.index ?? 0), end: at + m[0].length, kind: DEP_LABEL.test(label[0]) ? 'dep' : 'arr', iata: m[1] });
  }
  const routes: Route[] = [];
  for (let i = 0; i + 1 < tied.length; i++) {
    if (tied[i].kind === 'dep' && tied[i + 1].kind === 'arr') routes.push({ index: tied[i].index, end: tied[i + 1].end, from: tied[i].iata, to: tied[i + 1].iata });
  }
  return routes;
}

function parseBlock(block: string, from: string, to: string) {
  const dep = windowAfter(block, DEP_LABEL);
  const arr = windowAfter(block, ARR_LABEL);
  // The arrival window (label included) is left out: its date must not stand in for an unknown departure date.
  const arrLabel = ARR_LABEL.exec(block);
  const depSide = arrLabel && arr !== null ? block.slice(0, arrLabel.index) + block.slice(arrLabel.index + arrLabel[0].length + arr.length) : block;
  const blockDates = [...new Set(dates(depSide))];
  const blockDate = blockDates.length === 1 ? blockDates[0] : null;
  const depDate = dep ? (dates(dep)[0] ?? null) : null;
  const flightDate = depDate ?? blockDate;
  const depTime = dep ? timeOf(dep) : null;
  const arrTime = arr ? timeOf(arr) : null;
  const arrDates = arr ? dates(arr) : [];
  const arrDate = arrDates[0] ?? null;

  const numbers = [...new Set([...block.matchAll(FLIGHT)].map((m) => (m[1] + m[2]).replace(/^([A-Z0-9]{2})0+(?=\d)/, '$1')))].filter(
    (n) => FLIGHT_NUMBER_PATTERN.test(n),
  );
  // Arrival with no printed date is the departure day only when it is later on the clock; otherwise it may be the next day.
  // A printed but invalid date (30 Feb) stays null: no fallback.
  const arriveDay = arrDate ?? (arrDates.length === 0 && depTime && arrTime && arrTime > depTime ? flightDate : null);
  return {
    fromIata: from,
    toIata: to,
    flightNumber: numbers.length === 1 ? numbers[0] : null,
    flightDate,
    departAt: flightDate && depTime ? `${flightDate}T${depTime}` : null,
    arriveAt: arriveDay && arrTime ? `${arriveDay}T${arrTime}` : null,
  };
}

export function parseTicketText(text: string, airports: AirportLookup): ParsedTicket {
  const span = (format: number) => (m: RegExpMatchArray): Route => ({ index: m.index ?? 0, end: (m.index ?? 0) + m[0].length, from: m[1], to: m[2], format });
  // Every format counts; a match overlapping an earlier kept one, or repeating the previous route in another format, is dropped.
  const candidates = [
    ...[...text.matchAll(ARROW_ROUTE)].map(span(0)),
    ...[...text.matchAll(PAREN_ROUTE)].map(span(1)),
    ...labelledRoutes(text, airports).map((r) => ({ ...r, format: 2 })),
  ].sort((a, b) => a.index - b.index);
  const routes: Route[] = [];
  const usable = new Set<Route>();
  for (const r of candidates) {
    const last = routes[routes.length - 1];
    // Kept routes are in index order and never overlap, so only the last one can overlap r.
    if (last && r.index < last.end) continue;
    // The same leg written in two formats; repeats within one format are real separate flights.
    if (last?.from === r.from && last.to === r.to && last.format !== r.format) continue;
    routes.push(r);
    if (r.from !== r.to && airports(r.from) && airports(r.to)) usable.add(r);
    // One flight past the cut is enough to flag `truncated`; a flood of route lines must not cost more.
    if (usable.size > MAX_TICKET_SEGMENTS) break;
  }
  const all = routes
    .map((r, i) => ({ r, block: text.slice(r.index, routes[i + 1]?.index ?? text.length) }))
    .filter(({ r }) => usable.has(r))
    .map(({ r, block }) => parseBlock(block, r.from, r.to));
  const segments = all.slice(0, MAX_TICKET_SEGMENTS);
  const parsed = ParsedTicketSchema.safeParse({
    segments: assignDirections(segments),
    ...(all.length > segments.length && { truncated: true }),
  });
  return parsed.success ? parsed.data : { segments: [] };
}
