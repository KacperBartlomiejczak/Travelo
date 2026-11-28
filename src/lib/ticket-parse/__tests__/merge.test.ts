import type { BoardingPass, ParsedTicket, TicketSegment } from '../../../schemas/ticket';
import { isComplete, mergeParsed } from '../merge';

const airports = (iata: string) => (['WAW', 'BCN', 'MAD'].includes(iata) ? { timezone: 'Europe/Madrid' } : undefined);

const seg = (o: Partial<TicketSegment> = {}): TicketSegment => ({
  direction: 'outbound',
  fromIata: 'WAW',
  toIata: 'BCN',
  flightNumber: 'FR123',
  flightDate: '2026-12-05',
  departAt: '2026-12-05T06:45',
  arriveAt: '2026-12-05T09:50',
  ...o,
});
const bcbp = (o: Partial<BoardingPass['legs'][number]> = {}): BoardingPass => ({
  legs: [{ fromIata: 'WAW', toIata: 'BCN', flightNumber: 'FR123', flightDate: '2026-12-05', ...o }],
});

describe('isComplete', () => {
  it('is true for a fully filled segment', () => expect(isComplete({ segments: [seg()] })).toBe(true));
  it('is false without segments', () => expect(isComplete({ segments: [] })).toBe(false));
  it('is false for a truncated result even when every segment is full', () =>
    expect(isComplete({ segments: [seg()], truncated: true })).toBe(false));
  it.each(['flightNumber', 'departAt', 'arriveAt'] as const)('is false when %s is missing', (key) => {
    expect(isComplete({ segments: [seg(), seg({ [key]: null })] })).toBe(false);
  });
});

describe('mergeParsed', () => {
  it('returns the text result when there is no boarding pass', () => {
    const text: ParsedTicket = { segments: [seg()] };
    expect(mergeParsed(null, text, airports)).toEqual(text);
  });

  it('adds text times to a boarding pass leg', () => {
    const r = mergeParsed(bcbp(), { segments: [seg()] }, airports);
    expect(r.segments).toEqual([seg()]);
  });

  it('has no times when the text found nothing', () => {
    const r = mergeParsed(bcbp(), { segments: [] }, airports);
    expect(r.segments).toEqual([seg({ departAt: null, arriveAt: null })]);
  });

  it('lets the boarding pass win on flight number', () => {
    const r = mergeParsed(bcbp({ flightNumber: 'FR999' }), { segments: [seg()] }, airports);
    expect(r.segments[0].flightNumber).toBe('FR999');
    expect(r.segments[0].departAt).toBe('2026-12-05T06:45');
  });

  it('gives each same-route same-day leg the times of the text flight with its own number', () => {
    const lo123 = seg({ flightNumber: 'LO123', departAt: '2026-12-05T08:00', arriveAt: '2026-12-05T11:00' });
    const lo125 = seg({ flightNumber: 'LO125', departAt: '2026-12-05T14:00', arriveAt: '2026-12-05T17:00' });
    const pass: BoardingPass = {
      legs: [
        { fromIata: 'WAW', toIata: 'BCN', flightNumber: 'LO123', flightDate: '2026-12-05' },
        { fromIata: 'WAW', toIata: 'BCN', flightNumber: 'LO125', flightDate: '2026-12-05' },
      ],
    };
    const r = mergeParsed(pass, { segments: [lo125, lo123] }, airports);
    expect(r.segments.map((s) => [s.flightNumber, s.departAt])).toEqual([
      ['LO123', '2026-12-05T08:00'],
      ['LO125', '2026-12-05T14:00'],
    ]);
  });

  const twoLegs: BoardingPass = {
    legs: [
      { fromIata: 'WAW', toIata: 'BCN', flightNumber: 'LO123', flightDate: '2026-12-05' },
      { fromIata: 'WAW', toIata: 'BCN', flightNumber: 'LO125', flightDate: '2026-12-05' },
    ],
  };

  it('leaves times empty when two legs and two unnumbered text flights cannot be told apart', () => {
    const evening = seg({ flightNumber: null, departAt: '2026-12-05T18:00', arriveAt: '2026-12-05T21:00' });
    const morning = seg({ flightNumber: null, departAt: '2026-12-05T08:00', arriveAt: '2026-12-05T11:00' });
    const r = mergeParsed(twoLegs, { segments: [evening, morning] }, airports);
    // The ambiguous text flights are dropped, not appended as duplicates of the legs.
    expect(r.segments.map((s) => [s.flightNumber, s.departAt, s.arriveAt])).toEqual([
      ['LO123', null, null],
      ['LO125', null, null],
    ]);
    expect(isComplete(r)).toBe(false);
  });

  it('resolves exact numbers first so the one unnumbered text flight goes to the remaining leg', () => {
    const lo125 = seg({ flightNumber: 'LO125', departAt: '2026-12-05T14:00', arriveAt: '2026-12-05T17:00' });
    const unnumbered = seg({ flightNumber: null, departAt: '2026-12-05T08:00', arriveAt: '2026-12-05T11:00' });
    const r = mergeParsed(twoLegs, { segments: [lo125, unnumbered] }, airports);
    expect(r.segments.map((s) => [s.flightNumber, s.departAt])).toEqual([
      ['LO123', '2026-12-05T08:00'],
      ['LO125', '2026-12-05T14:00'],
    ]);
  });

  it('copies no text times when the numbers differ and the route and day are ambiguous', () => {
    const text = { segments: [seg({ flightNumber: 'LO125' }), seg({ flightNumber: 'LO127', departAt: '2026-12-05T20:00', arriveAt: '2026-12-05T23:00' })] };
    const r = mergeParsed(bcbp({ flightNumber: 'LO123' }), text, airports);
    expect(r.segments.find((s) => s.flightNumber === 'LO123')).toMatchObject({ departAt: null, arriveAt: null });
  });

  it('lets the boarding pass win on the day and takes no text times from another day', () => {
    const r = mergeParsed(bcbp({ flightDate: '2026-12-06' }), { segments: [seg()] }, airports);
    expect(r.segments[1]).toMatchObject({ flightDate: '2026-12-06', departAt: null, arriveAt: null });
  });

  it('keeps text-only segments after the boarding pass legs, in flight order, with coherent directions', () => {
    const back = seg({ fromIata: 'BCN', toIata: 'WAW', flightNumber: 'FR124', flightDate: '2026-12-10', departAt: '2026-12-10T10:00', arriveAt: '2026-12-10T13:00' });
    const r = mergeParsed(bcbp({ flightNumber: 'FR999' }), { segments: [back, seg()] }, airports);
    expect(r.segments).toEqual([seg({ flightNumber: 'FR999' }), { ...back, direction: 'return' }]);
  });

  it('orders a text-only earlier flight before the boarding pass leg', () => {
    const r = mergeParsed(bcbp({ fromIata: 'BCN', toIata: 'WAW', flightDate: '2026-12-10' }), { segments: [seg()] }, airports);
    expect(r.segments.map((s) => s.flightDate)).toEqual(['2026-12-05', '2026-12-10']);
    expect(r.segments.map((s) => s.direction)).toEqual(['outbound', 'return']);
  });

  it('never returns more than 8 segments, and marks the cut result as truncated (not complete)', () => {
    const many = Array.from({ length: 9 }, (_, i) => seg({ fromIata: 'WAW', toIata: 'BCN', flightDate: `2026-12-${String(10 + i).padStart(2, '0')}` }));
    const r = mergeParsed(bcbp({ flightDate: '2026-12-01' }), { segments: many }, airports);
    expect(r.segments).toHaveLength(8);
    expect(r.truncated).toBe(true);
    expect(isComplete(r)).toBe(false);
  });

  it('keeps a truncated flag from the text and does not flag exactly 8', () => {
    expect(mergeParsed(null, { segments: [seg()], truncated: true }, airports).truncated).toBe(true);
    const day = (i: number) => `2026-12-${String(10 + i).padStart(2, '0')}`;
    const seven = Array.from({ length: 7 }, (_, i) => seg({ flightDate: day(i), departAt: `${day(i)}T06:45`, arriveAt: `${day(i)}T09:50` }));
    const r = mergeParsed(bcbp(), { segments: seven }, airports);
    expect(r.segments).toHaveLength(8);
    expect(r.truncated).toBeUndefined();
  });

  it('orders same-day flights by departure time with untimed ones last', () => {
    const d = '2026-12-05';
    const x = seg({ fromIata: 'BCN', toIata: 'MAD', flightNumber: 'X', departAt: `${d}T12:00`, arriveAt: `${d}T13:10` });
    const z = seg({ fromIata: 'MAD', toIata: 'WAW', flightNumber: 'Z', departAt: null, arriveAt: null });
    const y = seg({ flightNumber: 'Y', departAt: `${d}T08:00`, arriveAt: `${d}T10:00` });
    const r = mergeParsed(bcbp({ fromIata: 'BCN', toIata: 'MAD', flightNumber: 'X' }), { segments: [x, z, y] }, airports);
    expect(r.segments.map((s) => [s.flightNumber, s.direction])).toEqual([['Y', 'outbound'], ['X', 'outbound'], ['Z', 'return']]);
  });

  it('keeps a text flight on the same route but another day as its own segment', () => {
    const r = mergeParsed(bcbp({ flightDate: '2026-12-10' }), { segments: [seg()] }, airports);
    expect(r.segments.map((s) => s.flightDate)).toEqual(['2026-12-05', '2026-12-10']);
    expect(r.segments[0].departAt).toBe('2026-12-05T06:45');
  });

  it('orders same-day legs by departure time, so the earlier text flight stays outbound', () => {
    const mad = seg({ fromIata: 'BCN', toIata: 'MAD', flightNumber: 'FR2', departAt: '2026-12-05T12:00', arriveAt: '2026-12-05T13:10' });
    const r = mergeParsed(bcbp({ fromIata: 'BCN', toIata: 'MAD', flightNumber: 'FR2' }), { segments: [mad, seg()] }, airports);
    expect(r.segments.map((s) => [s.fromIata, s.direction])).toEqual([['WAW', 'outbound'], ['BCN', 'outbound']]);
  });

  it('prefers a text flight with the same day over an undated one on the same route', () => {
    const undated = seg({ flightDate: null, departAt: null, arriveAt: null, flightNumber: 'U' });
    const dated = seg({ flightNumber: 'D', departAt: '2026-12-05T10:00', arriveAt: '2026-12-05T13:00' });
    const r = mergeParsed(bcbp(), { segments: [undated, dated] }, airports);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]).toMatchObject({ flightNumber: 'FR123', departAt: '2026-12-05T10:00' });
  });

  it('orders same-day flights by the departure instant, not the local clock', () => {
    const zones = (iata: string) =>
      ({ NRT: { timezone: 'Asia/Tokyo' }, LAX: { timezone: 'America/Los_Angeles' }, SFO: { timezone: 'America/Los_Angeles' } })[iata as 'NRT'];
    const nrt = seg({ fromIata: 'NRT', toIata: 'LAX', flightNumber: 'N', departAt: '2026-12-05T17:00', arriveAt: '2026-12-05T20:00' });
    const lax = seg({ fromIata: 'LAX', toIata: 'SFO', flightNumber: 'L', departAt: '2026-12-05T12:00', arriveAt: '2026-12-05T13:30' });
    const r = mergeParsed(bcbp({ fromIata: 'LAX', toIata: 'SFO', flightNumber: 'L' }), { segments: [lax, nrt] }, zones);
    expect(r.segments.map((s) => s.flightNumber)).toEqual(['N', 'L']);
  });

  it('orders across time zones by the UTC instant even when the local dates are reversed', () => {
    const zones = (iata: string) =>
      ({ NRT: { timezone: 'Asia/Tokyo' }, HNL: { timezone: 'Pacific/Honolulu' }, SFO: { timezone: 'America/Los_Angeles' } })[iata as 'NRT'];
    const nrt = seg({ fromIata: 'NRT', toIata: 'HNL', flightNumber: 'N', flightDate: '2026-12-06', departAt: '2026-12-06T00:30', arriveAt: '2026-12-05T12:00' });
    const hnl = seg({ fromIata: 'HNL', toIata: 'SFO', flightNumber: 'H', flightDate: '2026-12-05', departAt: '2026-12-05T15:00', arriveAt: '2026-12-05T23:00' });
    const r = mergeParsed(bcbp({ fromIata: 'HNL', toIata: 'SFO', flightNumber: 'H', flightDate: '2026-12-05' }), { segments: [hnl, nrt] }, zones);
    expect(r.segments.map((s) => s.flightNumber)).toEqual(['N', 'H']);
  });

  it('puts an untimed connection right before the timed flight it feeds', () => {
    const feed = seg({ fromIata: 'BCN', toIata: 'MAD', flightNumber: 'X', departAt: '2026-12-05T12:00', arriveAt: '2026-12-05T13:10' });
    const conn = seg({ flightNumber: 'C', departAt: null, arriveAt: null });
    const r = mergeParsed(bcbp({ fromIata: 'BCN', toIata: 'MAD', flightNumber: 'X' }), { segments: [feed, conn] }, airports);
    expect(r.segments.map((s) => [s.flightNumber, s.direction])).toEqual([['C', 'outbound'], ['X', 'outbound']]);
  });

  it('keeps an untimed leg last when it continues an earlier timed flight', () => {
    const a = seg({ flightNumber: 'A' });
    const b = seg({ fromIata: 'BCN', toIata: 'MAD', flightNumber: 'B', departAt: null, arriveAt: null });
    const c = seg({ fromIata: 'MAD', toIata: 'WAW', flightNumber: 'C', departAt: '2026-12-05T20:00', arriveAt: '2026-12-05T22:50' });
    const r = mergeParsed(bcbp({ flightNumber: 'A' }), { segments: [c, b, a] }, airports);
    expect(r.segments.map((s) => [s.flightNumber, s.direction])).toEqual([['A', 'outbound'], ['C', 'outbound'], ['B', 'outbound']]);
  });

  it('treats an airport with an unknown time zone as UTC when ordering', () => {
    const unknown = seg({ fromIata: 'XXX', toIata: 'WAW', flightNumber: 'U', departAt: '2026-12-05T10:00', arriveAt: '2026-12-05T12:00' });
    const known = seg({ fromIata: 'BCN', toIata: 'WAW', flightNumber: 'K', departAt: '2026-12-05T10:30', arriveAt: '2026-12-05T13:00' });
    const r = mergeParsed(bcbp({ flightDate: '2026-12-01' }), { segments: [unknown, known] }, airports);
    // BCN 10:30 is 09:30 UTC, before XXX 10:00 (as UTC); a plain local-string compare would put XXX first.
    expect(r.segments.map((s) => s.flightNumber).slice(1)).toEqual(['K', 'U']);
  });
});
