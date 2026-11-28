import { parseBcbp } from '../bcbp';

const KNOWN = new Set(['WAW', 'MAD', 'STN', 'LHR']);
const known = (iata: string) => KNOWN.has(iata);

const NAME = 'DOE/JOHN';
const PNR = 'ZXQ4TK';

const pad = (s: string, n: number) => s.padEnd(n, ' ').slice(0, n);
const leg = (o: { from: string; to: string; carrier: string; flight: string; julian: string; cond?: string }) =>
  pad(PNR, 7) +
  o.from +
  o.to +
  pad(o.carrier, 3) +
  pad(o.flight, 5) +
  o.julian +
  'Y' +
  '012A' +
  '00001' +
  '1' +
  (o.cond ?? '').length.toString(16).toUpperCase().padStart(2, '0') +
  (o.cond ?? '');
const header = (legs: number) => `M${legs}${pad(NAME, 20)}E`;

const TODAY = '2026-11-19';

describe('parseBcbp', () => {
  it('parses a single leg', () => {
    const raw = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123', julian: '340' });
    // 2026 day 340 = 2026-12-06
    expect(parseBcbp(raw, TODAY, known)).toEqual({
      legs: [{ fromIata: 'WAW', toIata: 'MAD', flightNumber: 'FR123', flightDate: '2026-12-06' }],
    });
  });

  it('parses two legs and skips conditional data', () => {
    const raw =
      header(2) +
      leg({ from: 'WAW', to: 'STN', carrier: 'FR', flight: '1234', julian: '340', cond: '>5321OO0' }) +
      leg({ from: 'STN', to: 'WAW', carrier: 'FR', flight: '1235', julian: '345' });
    const r = parseBcbp(raw, TODAY, known);
    expect(r?.legs.map((l) => [l.fromIata, l.toIata, l.flightNumber, l.flightDate])).toEqual([
      ['WAW', 'STN', 'FR1234', '2026-12-06'],
      ['STN', 'WAW', 'FR1235', '2026-12-11'],
    ]);
  });

  it('keeps a trailing letter and strips leading zeros', () => {
    const raw = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123A', julian: '340' });
    expect(parseBcbp(raw, TODAY, known)?.legs[0].flightNumber).toBe('FR123A');
  });

  it('wraps the year for a day already past', () => {
    const raw = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123', julian: '005' });
    expect(parseBcbp(raw, '2026-12-30', known)?.legs[0].flightDate).toBe('2027-01-05');
  });

  it('uses today when the day matches', () => {
    // 2026-11-19 is day 323
    const raw = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123', julian: '323' });
    expect(parseBcbp(raw, TODAY, known)?.legs[0].flightDate).toBe('2026-11-19');
  });

  it('handles leap-year day 060 (Feb 29 in 2028, Mar 1 otherwise)', () => {
    const raw = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123', julian: '060' });
    expect(parseBcbp(raw, '2027-12-30', known)?.legs[0].flightDate).toBe('2028-02-29');
    expect(parseBcbp(raw, '2026-12-30', known)?.legs[0].flightDate).toBe('2027-03-01');
  });

  it('day 366 resolves to the nearest leap year', () => {
    const raw = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123', julian: '366' });
    expect(parseBcbp(raw, TODAY, known)?.legs[0].flightDate).toBe('2028-12-31');
  });

  it('returns null for invalid input', () => {
    const good = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123', julian: '340' });
    expect(parseBcbp(good.replace('MAD', 'ZZZ'), TODAY, known)).toBeNull();
    expect(parseBcbp('X' + good.slice(1), TODAY, known)).toBeNull();
    expect(parseBcbp(good.slice(0, 40), TODAY, known)).toBeNull();
    expect(parseBcbp(good.replace('M1', 'M0'), TODAY, known)).toBeNull();
    expect(parseBcbp(good.replace('M1', 'M5'), TODAY, known)).toBeNull();
    expect(parseBcbp(good.replace('MAD', 'WAW'), TODAY, known)).toBeNull();
    expect(parseBcbp(good.replace('340', '000'), TODAY, known)).toBeNull();
    expect(parseBcbp(good.replace('340', '367'), TODAY, known)).toBeNull();
    expect(parseBcbp(good.replace('0123 ', '01-3 '), TODAY, known)).toBeNull();
    expect(parseBcbp('', TODAY, known)).toBeNull();
  });

  it('output never contains the passenger name or PNR', () => {
    const raw = header(1) + leg({ from: 'WAW', to: 'MAD', carrier: 'FR', flight: '0123', julian: '340' });
    const out = JSON.stringify(parseBcbp(raw, TODAY, known));
    expect(out).not.toContain('DOE');
    expect(out).not.toContain('JOHN');
    expect(out).not.toContain(PNR);
  });
});
