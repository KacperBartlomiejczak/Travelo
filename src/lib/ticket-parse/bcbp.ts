import {
  BoardingPassSchema,
  FLIGHT_NUMBER_PATTERN,
  type BoardingPass,
  type BoardingPassLeg,
} from '../../schemas/ticket.ts';

// IATA Resolution 792 BCBP (format code M). Passenger name and PNR are skipped, never returned.
const HEADER_LENGTH = 23; // format(1) + legs(1) + name(20) + e-ticket indicator(1)
const LEG_FIXED = 37; // PNR(7) from(3) to(3) carrier(3) flight(5) julian(3) compartment(1) seat(4) seq(5) status(1) size(2)

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const iso = (year: number, dayOfYear: number): string => {
  const d = new Date(Date.UTC(year, 0, dayOfYear));
  return d.toISOString().slice(0, 10);
};

// Nearest date on or after `today` whose year has that day-of-year.
function resolveDate(julian: number, today: string): string | null {
  if (julian < 1 || julian > 366) return null;
  const startYear = Number(today.slice(0, 4));
  for (let y = startYear; y <= startYear + 8; y++) {
    if (julian === 366 && !isLeap(y)) continue;
    const date = iso(y, julian);
    if (date >= today) return date;
  }
  return null;
}

function normaliseFlight(carrier: string, number: string): string {
  // Leading zeros of the number go, a trailing letter stays.
  return carrier.trim() + number.trim().replace(/^0+(?=\d)/, '');
}

export function parseBcbp(raw: string, today: string, isKnownIata: (iata: string) => boolean): BoardingPass | null {
  if (raw[0] !== 'M') return null;
  const count = Number(raw[1]);
  if (!Number.isInteger(count) || count < 1 || count > 4) return null;

  const legs: BoardingPassLeg[] = [];
  let pos = HEADER_LENGTH;
  for (let i = 0; i < count; i++) {
    if (raw.length < pos + LEG_FIXED) return null;
    const from = raw.slice(pos + 7, pos + 10);
    const to = raw.slice(pos + 10, pos + 13);
    const flightNumber = normaliseFlight(raw.slice(pos + 13, pos + 16), raw.slice(pos + 16, pos + 21));
    const julian = raw.slice(pos + 21, pos + 24);
    const size = parseInt(raw.slice(pos + 35, pos + 37), 16);
    if (Number.isNaN(size) || !/^\d{3}$/.test(julian)) return null;
    const flightDate = resolveDate(Number(julian), today);
    if (
      !flightDate ||
      from === to ||
      !isKnownIata(from) ||
      !isKnownIata(to) ||
      !FLIGHT_NUMBER_PATTERN.test(flightNumber)
    ) {
      return null;
    }
    legs.push({ fromIata: from, toIata: to, flightNumber, flightDate });
    pos += LEG_FIXED + size;
  }
  const parsed = BoardingPassSchema.safeParse({ legs });
  return parsed.success ? parsed.data : null;
}
