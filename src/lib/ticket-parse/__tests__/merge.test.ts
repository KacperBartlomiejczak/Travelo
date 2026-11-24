import type { BoardingPass, ParsedTicket, TicketSegment } from '../../../schemas/ticket';
import { isComplete, mergeParsed } from '../merge';

const airports = (iata: string) => (['WAW', 'BCN'].includes(iata) ? { timezone: 'Europe/Madrid' } : undefined);

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
  });

  it('lets the boarding pass win on the day and drops text times from another day', () => {
    const r = mergeParsed(bcbp({ flightDate: '2026-12-06' }), { segments: [seg()] }, airports);
    expect(r.segments[0]).toMatchObject({ flightDate: '2026-12-06', departAt: null, arriveAt: null });
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

  it('never returns more than 8 segments', () => {
    const many = Array.from({ length: 9 }, (_, i) => seg({ fromIata: 'WAW', toIata: 'BCN', flightDate: `2026-12-${String(10 + i).padStart(2, '0')}` }));
    expect(mergeParsed(bcbp(), { segments: many }, airports).segments).toHaveLength(8);
  });
});
