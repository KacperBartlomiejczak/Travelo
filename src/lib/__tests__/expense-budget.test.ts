import type { Expense, LocalExpense } from '@/schemas';
import { ExpenseDaySchema, GroupBudgetSchema, PersonBudgetSchema } from '@/schemas';

import { computeExpenseBudget, groupExpensesByDay } from '../expense-budget';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const REMOVED = '33333333-3333-4333-8333-333333333333';

let n = 0;
function expense(over: Partial<LocalExpense> & { amountMinor: number }): LocalExpense {
  n += 1;
  const { amountMinor, ...rest } = over;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    tripId: TRIP_ID,
    memberId: null,
    name: 'x',
    amount: { amountMinor, currency: 'EUR' },
    category: 'food',
    spentOn: '2026-11-01',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    syncStatus: 'synced',
    attempts: 0,
    ...rest,
  };
}

type TestMember = { id: string; displayName: string; dailyBudgetMinor: number };
// Trip 2026-11-10 .. 2026-11-12 = 3 days; organizer 300/day (pool 900); organizer only unless members given.
const base = { organizerDailyMinor: 300, startDate: '2026-11-10', endDate: '2026-11-12', organizerName: 'Me', members: [] as TestMember[] };
const run = (expenses: Expense[], today: string, over: Partial<typeof base> = {}) =>
  computeExpenseBudget({ ...base, ...over, expenses, today });
const organizer = (r: ReturnType<typeof run>) => r.people[0];

describe('computeExpenseBudget: totals', () => {
  it('group left = sum of pools - all expenses; person left = own pool - own expenses', () => {
    const r = run(
      [expense({ amountMinor: 300 }), expense({ amountMinor: 100, memberId: MEMBER })],
      '2026-11-01',
      { members: [{ id: MEMBER, displayName: 'Ola', dailyBudgetMinor: 200 }] },
    );
    expect(r.group).toMatchObject({ spentMinor: 400, leftMinor: 1100 });
    expect(r.people.map((p) => [p.memberId, p.displayName, p.spentMinor, p.leftMinor])).toEqual([
      [null, 'Me', 300, 600],
      [MEMBER, 'Ola', 100, 500],
    ]);
    expect(GroupBudgetSchema.safeParse(r.group).success).toBe(true);
    r.people.forEach((p) => expect(PersonBudgetSchema.safeParse(p).success).toBe(true));
  });

  it('ignores soft-deleted expenses everywhere', () => {
    const r = run([expense({ amountMinor: 300, deletedAt: '2026-11-02T00:00:00.000Z' })], '2026-11-11');
    expect(r.group).toMatchObject({ spentMinor: 0, leftMinor: 900 });
    expect(organizer(r).byCategory.food).toBe(0);
    expect(organizer(r).today).toEqual({ allowedMinor: 600, leftMinor: 600, carryoverMinor: 300 });
  });

  it('counts an expense of an unknown member toward group totals without crashing', () => {
    const r = run([expense({ amountMinor: 200, memberId: REMOVED })], '2026-11-01');
    expect(r.group).toMatchObject({ spentMinor: 200, leftMinor: 700 });
    expect(r.people).toHaveLength(1);
    expect(organizer(r).spentMinor).toBe(0);
  });

  it('sums each of the 5 categories per person', () => {
    const r = run(
      [
        expense({ amountMinor: 10, category: 'food' }),
        expense({ amountMinor: 20, category: 'food' }),
        expense({ amountMinor: 30, category: 'transport' }),
        expense({ amountMinor: 40, category: 'other', memberId: MEMBER }),
      ],
      '2026-11-01',
      { members: [{ id: MEMBER, displayName: 'Ola', dailyBudgetMinor: 200 }] },
    );
    expect(organizer(r).byCategory).toEqual({ food: 30, transport: 30, stay: 0, activities: 0, other: 0 });
    expect(r.people[1].byCategory.other).toBe(40);
  });
});

describe('computeExpenseBudget: today (D7)', () => {
  it('has no today before or after the trip, and post-trip expenses count only toward totals', () => {
    const post = expense({ amountMinor: 50, spentOn: '2026-11-20' });
    for (const today of ['2026-11-09', '2026-11-13']) {
      const r = run([post], today);
      expect(r.group.today).toBeUndefined();
      expect(organizer(r).today).toBeUndefined();
    }
    const r = run([post], '2026-11-10');
    expect(r.group).toMatchObject({ spentMinor: 50, leftMinor: 850 });
    expect(organizer(r).today).toEqual({ allowedMinor: 300, leftMinor: 300, carryoverMinor: 0 });
  });

  it('day 1 has no carryover', () => {
    expect(organizer(run([], '2026-11-10')).today).toEqual({ allowedMinor: 300, leftMinor: 300, carryoverMinor: 0 });
  });

  it('underspending on day 1 carries over to day 2', () => {
    const r = run([expense({ amountMinor: 100, spentOn: '2026-11-10' })], '2026-11-11');
    // 600 - 100 = 500; carry = 300 - 100 = 200
    expect(organizer(r).today).toEqual({ allowedMinor: 500, leftMinor: 500, carryoverMinor: 200 });
  });

  it('overspending on day 1 shrinks day 2 (negative carryover)', () => {
    const r = run([expense({ amountMinor: 500, spentOn: '2026-11-10' })], '2026-11-11');
    expect(organizer(r).today).toEqual({ allowedMinor: 100, leftMinor: 100, carryoverMinor: -200 });
  });

  it('subtracts today spending from leftToday', () => {
    const r = run([expense({ amountMinor: 100, spentOn: '2026-11-11' })], '2026-11-11');
    expect(organizer(r).today).toEqual({ allowedMinor: 600, leftMinor: 500, carryoverMinor: 300 });
  });

  it('accumulates over 3 days and the day allowances sum to exactly the pool', () => {
    const allowed = ['2026-11-10', '2026-11-11', '2026-11-12'].map(
      (d) => organizer(run([], d)).today,
    );
    expect(allowed.map((t) => t?.allowedMinor)).toEqual([300, 600, 900]);
    // nothing spent: day allowances (allowed - carryover) add up to the whole pool
    expect(allowed.reduce((s, t) => s + (t ? t.allowedMinor - t.carryoverMinor : 0), 0)).toBe(900);
  });

  it('an expense before the trip reduces the daily amount', () => {
    const r = run([expense({ amountMinor: 400, spentOn: '2026-11-05' })], '2026-11-10');
    expect(organizer(r).today).toEqual({ allowedMinor: 166, leftMinor: 166, carryoverMinor: 0 }); // floor(500/3)
    expect(organizer(r).leftMinor).toBe(500);
  });

  it('floors correctly when over budget before the trip (negative B - P)', () => {
    const r = run([expense({ amountMinor: 1100, spentOn: '2026-11-05' })], '2026-11-10');
    // floor(-200/3) = -67
    expect(organizer(r).today).toEqual({ allowedMinor: -67, leftMinor: -67, carryoverMinor: 0 });
  });

  it('day 3 after spending on days 1 and 2', () => {
    const r = run(
      [
        expense({ amountMinor: 100, spentOn: '2026-11-10' }),
        expense({ amountMinor: 300, spentOn: '2026-11-11' }),
        expense({ amountMinor: 50, spentOn: '2026-11-12' }),
      ],
      '2026-11-12',
    );
    // allowed = 900 - 400; carry = 600 - 400
    expect(organizer(r).today).toEqual({ allowedMinor: 500, leftMinor: 450, carryoverMinor: 200 });
  });

  it('group today is the sum of the persons, each on their own daily amount', () => {
    const r = run([expense({ amountMinor: 100, spentOn: '2026-11-10' })], '2026-11-11', {
      members: [{ id: MEMBER, displayName: 'Ola', dailyBudgetMinor: 200 }],
    });
    expect(organizer(r).today).toEqual({ allowedMinor: 500, leftMinor: 500, carryoverMinor: 200 });
    expect(r.people[1].today).toEqual({ allowedMinor: 400, leftMinor: 400, carryoverMinor: 200 });
    expect(r.group.today).toEqual({ allowedMinor: 900, leftMinor: 900, carryoverMinor: 400 });
  });

  it('a longer trip grows the pool, not the daily amount', () => {
    const r = run([], '2026-11-10', { endDate: '2026-11-14' });
    expect(organizer(r).leftMinor).toBe(1500);
    expect(organizer(r).today).toEqual({ allowedMinor: 300, leftMinor: 300, carryoverMinor: 0 });
    expect(r.group.leftMinor).toBe(1500);
  });
});

describe('groupExpensesByDay', () => {
  it('groups by spentOn descending, createdAt descending within a day, with day totals', () => {
    const a = expense({ amountMinor: 10, spentOn: '2026-11-01', createdAt: '2026-11-01T08:00:00.000Z' });
    const b = expense({ amountMinor: 20, spentOn: '2026-11-01', createdAt: '2026-11-01T09:00:00.000Z' });
    const c = expense({ amountMinor: 40, spentOn: '2026-11-03', createdAt: '2026-11-03T08:00:00.000Z' });
    const deleted = expense({ amountMinor: 99, spentOn: '2026-11-02', deletedAt: '2026-11-02T10:00:00.000Z' });
    const days = groupExpensesByDay([a, c, deleted, b]);
    expect(days.map((d) => [d.spentOn, d.totalMinor, d.expenses.map((e) => e.id)])).toEqual([
      ['2026-11-03', 40, [c.id]],
      ['2026-11-01', 30, [b.id, a.id]],
    ]);
    days.forEach((d) => expect(ExpenseDaySchema.safeParse(d).success).toBe(true));
    expect(groupExpensesByDay([])).toEqual([]);
  });

  it('orders createdAt by instant, not by string, when offsets differ', () => {
    const plus2 = expense({ amountMinor: 1, createdAt: '2026-11-01T10:00:00+02:00' }); // 08:00Z
    const utc = expense({ amountMinor: 1, createdAt: '2026-11-01T09:00:00Z' });
    expect(groupExpensesByDay([plus2, utc])[0].expenses.map((e) => e.id)).toEqual([utc.id, plus2.id]);
  });
});
