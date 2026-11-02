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

// Trip 2026-11-10 .. 2026-11-12 = 3 days; 1000 minor per person; organizer only unless members given.
const base = { budgetPerPersonMinor: 1000, startDate: '2026-11-10', endDate: '2026-11-12', organizerName: 'Me', members: [] as { id: string; displayName: string }[] };
const run = (expenses: Expense[], today: string, over: Partial<typeof base> = {}) =>
  computeExpenseBudget({ ...base, ...over, expenses, today });
const organizer = (r: ReturnType<typeof run>) => r.people[0];

describe('computeExpenseBudget: totals', () => {
  it('group left = budget x travelers - all expenses; person left = budget - own expenses', () => {
    const r = run(
      [expense({ amountMinor: 300 }), expense({ amountMinor: 100, memberId: MEMBER })],
      '2026-11-01',
      { members: [{ id: MEMBER, displayName: 'Ola' }] },
    );
    expect(r.group).toMatchObject({ spentMinor: 400, leftMinor: 1600 });
    expect(r.people.map((p) => [p.memberId, p.displayName, p.spentMinor, p.leftMinor])).toEqual([
      [null, 'Me', 300, 700],
      [MEMBER, 'Ola', 100, 900],
    ]);
    expect(GroupBudgetSchema.safeParse(r.group).success).toBe(true);
    r.people.forEach((p) => expect(PersonBudgetSchema.safeParse(p).success).toBe(true));
  });

  it('ignores soft-deleted expenses everywhere', () => {
    const r = run([expense({ amountMinor: 300, deletedAt: '2026-11-02T00:00:00.000Z' })], '2026-11-11');
    expect(r.group).toMatchObject({ spentMinor: 0, leftMinor: 1000 });
    expect(organizer(r).byCategory.food).toBe(0);
    expect(organizer(r).today).toEqual({ allowedMinor: 666, leftMinor: 666, carryoverMinor: 333 });
  });

  it('counts an expense of an unknown member toward group totals without crashing', () => {
    const r = run([expense({ amountMinor: 200, memberId: REMOVED })], '2026-11-01');
    expect(r.group).toMatchObject({ spentMinor: 200, leftMinor: 800 });
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
      { members: [{ id: MEMBER, displayName: 'Ola' }] },
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
    expect(r.group).toMatchObject({ spentMinor: 50, leftMinor: 950 });
    expect(organizer(r).today).toEqual({ allowedMinor: 333, leftMinor: 333, carryoverMinor: 0 });
  });

  it('day 1 has no carryover', () => {
    expect(organizer(run([], '2026-11-10')).today).toEqual({ allowedMinor: 333, leftMinor: 333, carryoverMinor: 0 });
  });

  it('underspending on day 1 carries over to day 2', () => {
    const r = run([expense({ amountMinor: 100, spentOn: '2026-11-10' })], '2026-11-11');
    // floor(2000/3)=666 - 100 = 566; carry = 333 - 100 = 233
    expect(organizer(r).today).toEqual({ allowedMinor: 566, leftMinor: 566, carryoverMinor: 233 });
  });

  it('overspending on day 1 shrinks day 2 (negative carryover)', () => {
    const r = run([expense({ amountMinor: 500, spentOn: '2026-11-10' })], '2026-11-11');
    expect(organizer(r).today).toEqual({ allowedMinor: 166, leftMinor: 166, carryoverMinor: -167 });
  });

  it('subtracts today spending from leftToday', () => {
    const r = run([expense({ amountMinor: 100, spentOn: '2026-11-11' })], '2026-11-11');
    expect(organizer(r).today).toEqual({ allowedMinor: 666, leftMinor: 566, carryoverMinor: 333 });
  });

  it('accumulates over 3 days and 1000 / 3 days sums to exactly 1000', () => {
    const allowed = ['2026-11-10', '2026-11-11', '2026-11-12'].map(
      (d) => organizer(run([], d)).today,
    );
    expect(allowed.map((t) => t?.allowedMinor)).toEqual([333, 666, 1000]);
    // nothing spent: day allowances (allowed - carryover) add up to the whole budget
    expect(allowed.reduce((s, t) => s + (t ? t.allowedMinor - t.carryoverMinor : 0), 0)).toBe(1000);
  });

  it('an expense before the trip reduces the daily amount', () => {
    const r = run([expense({ amountMinor: 400, spentOn: '2026-11-05' })], '2026-11-10');
    expect(organizer(r).today).toEqual({ allowedMinor: 200, leftMinor: 200, carryoverMinor: 0 });
    expect(organizer(r).leftMinor).toBe(600);
  });

  it('floors correctly when over budget before the trip (negative B - P)', () => {
    const r = run([expense({ amountMinor: 1100, spentOn: '2026-11-05' })], '2026-11-10');
    // floor(-100/3) = -34
    expect(organizer(r).today).toEqual({ allowedMinor: -34, leftMinor: -34, carryoverMinor: 0 });
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
    // allowed = 1000 - 400; carry = floor(2000/3) - 400
    expect(organizer(r).today).toEqual({ allowedMinor: 600, leftMinor: 550, carryoverMinor: 266 });
  });

  it('group today is the sum of the persons', () => {
    const r = run([expense({ amountMinor: 100, spentOn: '2026-11-10' })], '2026-11-11', {
      members: [{ id: MEMBER, displayName: 'Ola' }],
    });
    expect(r.group.today).toEqual({ allowedMinor: 566 + 666, leftMinor: 566 + 666, carryoverMinor: 233 + 333 });
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
