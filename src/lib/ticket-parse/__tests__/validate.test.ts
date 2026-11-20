import type { GeminiTicket, ParsedTicket } from '../../../schemas/ticket';
import { validateParsed, validateTicket } from '../validate';

const ZONES: Record<string, string> = {
  WAW: 'Europe/Warsaw',
  BCN: 'Europe/Madrid',
  JFK: 'America/New_York',
};
const airports = (iata: string) => (ZONES[iata] ? { timezone: ZONES[iata] } : undefined);
const TODAY = '2026-11-19';

type GSeg = GeminiTicket['segments'][number];
const gseg = (o: Partial<GSeg> = {}): GSeg => ({
  direction: 'outbound',
  flightNumber: 'FR123',
  fromIata: 'WAW',
  toIata: 'BCN',
  departLocal: '2026-12-05T06:45',
  arriveLocal: '2026-12-05T09:50',
  ...o,
});
const gem = (...segments: GSeg[]): GeminiTicket => ({ isTicket: true, segments });
const none: ParsedTicket = { segments: [] };
const run = (g: GeminiTicket, parsed: ParsedTicket = none) => validateTicket(g, parsed, airports, TODAY);

describe('validateTicket', () => {
  it('accepts a valid segment and derives the flight date', () => {
    expect(run(gem(gseg()))).toEqual({
      kind: 'ok',
      segments: [
        {
          direction: 'outbound',
          fromIata: 'WAW',
          toIata: 'BCN',
          flightNumber: 'FR123',
          flightDate: '2026-12-05',
          departAt: '2026-12-05T06:45',
          arriveAt: '2026-12-05T09:50',
        },
      ],
    });
  });

  it('rejects isTicket false and zero segments', () => {
    expect(run({ isTicket: false, segments: [gseg()] })).toEqual({ kind: 'not_a_ticket' });
    expect(run(gem())).toEqual({ kind: 'not_a_ticket' });
  });

  it.each([
    ['unknown IATA', gseg({ toIata: 'ZZZ' })],
    ['from equal to', gseg({ toIata: 'WAW' })],
    ['30 February', gseg({ departLocal: '2026-02-30T06:45', arriveLocal: '2026-02-30T09:50' })],
    ['nonexistent DST time', gseg({ departLocal: '2027-03-28T02:30', arriveLocal: '2027-03-28T05:00' })],
    [
      'arrival before departure across zones',
      gseg({ toIata: 'JFK', departLocal: '2026-12-05T10:00', arriveLocal: '2026-12-05T03:00' }),
    ],
    ['arrival at the departure instant', gseg({ arriveLocal: '2026-12-05T06:45' })],
    ['date too far in the past', gseg({ departLocal: '2025-11-18T06:45', arriveLocal: '2025-11-18T09:50' })],
    ['date too far ahead', gseg({ departLocal: '2028-11-20T06:45', arriveLocal: '2028-11-20T09:50' })],
  ])('rejects %s as not a ticket', (_name, s) => {
    expect(run(gem(gseg(), s))).toEqual({ kind: 'not_a_ticket' });
  });

  it('accepts dates at the edges of the range', () => {
    expect(run(gem(gseg({ departLocal: '2025-11-19T06:45', arriveLocal: '2025-11-19T09:50' }))).kind).toBe('ok');
    expect(run(gem(gseg({ departLocal: '2028-11-19T06:45', arriveLocal: '2028-11-19T09:50' }))).kind).toBe('ok');
  });

  it('compares arrival and departure as instants, not wall clocks', () => {
    // 22:00 Warsaw is 16:00 New York, so a 17:30 New York arrival is 1.5 h after departure.
    const ok = run(gem(gseg({ toIata: 'JFK', departLocal: '2026-12-05T22:00', arriveLocal: '2026-12-05T17:30' })));
    expect(ok.kind).toBe('ok');
  });

  it('turns an invalid flight number into null and keeps the segment', () => {
    const r = run(gem(gseg({ flightNumber: 'bad number!' })));
    expect(r.kind === 'ok' && r.segments[0].flightNumber).toBeNull();
  });

  describe('against stage 1 fields', () => {
    const parsed = (o: Partial<ParsedTicket['segments'][number]> = {}): ParsedTicket => ({
      segments: [
        {
          direction: 'outbound',
          fromIata: 'WAW',
          toIata: 'BCN',
          flightNumber: 'FR123',
          flightDate: '2026-12-05',
          departAt: null,
          arriveAt: null,
          ...o,
        },
      ],
    });

    it('accepts when Gemini agrees and fills the gaps', () => {
      expect(run(gem(gseg()), parsed()).kind).toBe('ok');
    });
    it('ignores null parsed fields', () => {
      expect(run(gem(gseg({ flightNumber: 'LO1' })), parsed({ flightNumber: null })).kind).toBe('ok');
    });
    it.each([
      ['airport', gseg({ toIata: 'JFK', arriveLocal: '2026-12-05T20:00' }), parsed()],
      ['flight number', gseg({ flightNumber: 'FR999' }), parsed()],
      ['day', gseg({ departLocal: '2026-12-06T06:45', arriveLocal: '2026-12-06T09:50' }), parsed()],
      ['departure time', gseg(), parsed({ departAt: '2026-12-05T07:00' })],
      ['arrival time', gseg(), parsed({ arriveAt: '2026-12-05T10:00' })],
    ])('reports a mismatch on %s', (_n, g, p) => {
      expect(run(gem(g), p)).toEqual({ kind: 'mismatch' });
    });
    it('reports a mismatch on segment count', () => {
      expect(run(gem(gseg(), gseg({ fromIata: 'BCN', toIata: 'WAW' })), parsed())).toEqual({ kind: 'mismatch' });
    });
    it('keeps the stage 1 direction', () => {
      const r = run(gem(gseg({ direction: 'return' })), parsed());
      expect(r.kind === 'ok' && r.segments[0].direction).toBe('outbound');
    });
  });
});

describe('validateParsed', () => {
  const full = (o: Partial<ParsedTicket['segments'][number]> = {}): ParsedTicket => ({
    segments: [
      {
        direction: 'outbound',
        fromIata: 'WAW',
        toIata: 'BCN',
        flightNumber: 'FR123',
        flightDate: '2026-12-05',
        departAt: '2026-12-05T06:45',
        arriveAt: '2026-12-05T09:50',
        ...o,
      },
    ],
  });
  const check = (p: ParsedTicket) => validateParsed(p, airports, TODAY);

  it('keeps a valid segment unchanged', () => {
    expect(check(full())).toEqual(full());
  });
  it.each([
    ['nonexistent DST time', { departAt: '2027-03-28T02:30', arriveAt: '2027-03-28T05:00' }, 'both'],
    ['departure out of range', { departAt: '2030-12-05T06:45', arriveAt: '2030-12-05T09:50' }, 'both'],
    ['arrival not after departure', { arriveAt: '2026-12-05T06:00' }, 'arrive'],
    ['arrival nonexistent in its zone', { arriveAt: '2027-03-28T02:30', departAt: '2027-03-28T01:00' }, 'arrive'],
  ])('nulls times for %s but keeps airports and flight number', (_n, o, which) => {
    const seg = check(full(o)).segments[0];
    expect(seg).toMatchObject({ fromIata: 'WAW', toIata: 'BCN', flightNumber: 'FR123' });
    expect(seg.arriveAt).toBeNull();
    if (which === 'both') expect(seg.departAt).toBeNull();
  });
});
