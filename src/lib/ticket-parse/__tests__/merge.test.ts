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

  it('ignores text segments on other routes', () => {
    const other = seg({ fromIata: 'BCN', toIata: 'WAW' });
    const r = mergeParsed(bcbp(), { segments: [other] }, airports);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].departAt).toBeNull();
  });
});
