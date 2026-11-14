import type { GeneratedPlan } from '../../schemas/trip-plan.ts';
import { validateGeneratedPlan } from '../plan-validate';

const M1 = '11111111-1111-4111-8111-111111111111';
const refs = { P1: 'owner', P2: M1 } as const;
const dates = ['2026-12-01', '2026-12-02'];
const allowedCities = ['AAA', 'BBB'];
const placesByCity = { AAA: new Set(['a1', 'a2']), BBB: new Set(['b1']) };
type Items = GeneratedPlan['days'][number]['items'];
const item = (placeId: string, forPeople = ['P1']) => ({ placeId, slot: 'morning' as const, reason: 'r', forPeople });
const plan = (d1: Items, d2: Items = [item('b1')]): GeneratedPlan => ({
  days: [
    { date: '2026-12-01', cityId: 'AAA', items: d1 },
    { date: '2026-12-02', cityId: 'BBB', items: d2 },
  ],
});
const run = (generated: GeneratedPlan, tripDates: string[] = dates) =>
  validateGeneratedPlan({ plan: generated, placesByCity, allowedCities, dates: tripDates, refs });

describe('validateGeneratedPlan', () => {
  it('maps a valid plan to stored days with person refs', () => {
    expect(run(plan([item('a1', ['P1', 'P2'])]))).toEqual({
      ok: true,
      days: [
        { date: '2026-12-01', cityIata: 'AAA', items: [{ placeId: 'a1', slot: 'morning', reason: 'r', forPeople: ['owner', M1] }] },
        { date: '2026-12-02', cityIata: 'BBB', items: [{ placeId: 'b1', slot: 'morning', reason: 'r', forPeople: ['owner'] }] },
      ],
    });
  });

  it('drops a foreign placeId', () => {
    const res = run(plan([item('zzz'), item('a1')]));
    expect(res.ok && res.days[0]!.items.map((i) => i.placeId)).toEqual(['a1']);
  });

  it('drops a placeId from another city', () => {
    const res = run(plan([item('b1'), item('a1')]));
    expect(res.ok && res.days[0]!.items.map((i) => i.placeId)).toEqual(['a1']);
  });

  it('drops a placeId repeated across the trip, keeping the first', () => {
    const res = run({
      days: [
        { date: '2026-12-01', cityId: 'AAA', items: [item('a1'), item('a2')] },
        { date: '2026-12-02', cityId: 'AAA', items: [item('a1'), item('a2')] },
      ],
    });
    expect(res.ok && res.days[0]!.items).toHaveLength(2);
    expect(res.ok && res.days[1]!.items).toHaveLength(0);
  });

  it('drops unknown personIds and items left without people', () => {
    const res = run(plan([item('a1', ['P1', 'P9']), item('a2', ['P8'])]));
    expect(res.ok && res.days[0]!.items).toEqual([{ placeId: 'a1', slot: 'morning', reason: 'r', forPeople: ['owner'] }]);
  });

  it('drops prototype keys used as personIds', () => {
    const res = run(plan([item('a1', ['toString', 'constructor']), item('a2', ['toString', 'P1'])]));
    expect(res.ok && res.days[0]!.items).toEqual([{ placeId: 'a2', slot: 'morning', reason: 'r', forPeople: ['owner'] }]);
  });

  it.each([
    ['ideal for P1 on arrival', ''],
    ["P12's pick", ''],
    ['Porto, PPP, MP3 and P0', 'Porto, PPP, MP3 and P0'],
  ])('reason %j becomes %j', (reason, expected) => {
    const res = run(plan([{ ...item('a1'), reason }]));
    expect(res.ok && res.days[0]!.items).toEqual([expect.objectContaining({ placeId: 'a1', reason: expected })]);
  });

  it('rejects a city that is not allowed', () => {
    const bad: GeneratedPlan = { days: [{ date: '2026-12-01', cityId: 'XXX', items: [item('a1')] }, plan([]).days[1]!] };
    expect(run(bad).ok).toBe(false);
  });

  it.each([
    ['missing', ['2026-12-01']],
    ['extra', ['2026-12-01', '2026-12-02', '2026-12-03']],
    ['reordered', ['2026-12-02', '2026-12-01']],
  ])('rejects %s dates', (_name, tripDates) => {
    expect(run(plan([item('a1')]), tripDates).ok).toBe(false);
  });

  it('rejects when every day ends up empty', () => {
    expect(run(plan([item('zzz')], [item('nope')])).ok).toBe(false);
  });
});
