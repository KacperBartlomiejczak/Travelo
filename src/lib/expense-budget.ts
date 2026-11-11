import type { Expense, ExpenseCategory, ExpenseDay, GroupBudget, LocalExpense, PersonBudget, TodayBudget } from '@/schemas';

import { tripDayCount } from './trip-days';

const CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'stay', 'activities', 'other'];

const sum = (expenses: Expense[]) => expenses.reduce((s, e) => s + e.amount.amountMinor, 0);

/** The organizer (memberId null) plus the trip members; unknown memberIds count only toward group totals. */
export type ExpenseBudgetInput = {
  expenses: Expense[];
  /** The organizer's daily amount; each member carries their own. */
  organizerDailyMinor: number;
  startDate: string;
  endDate: string;
  /** Today as YYYY-MM-DD; passed in so the math stays pure. */
  today: string;
  organizerName: string;
  members: { id: string; displayName: string; dailyBudgetMinor: number }[];
};

function personToday(own: Expense[], budget: number, input: ExpenseBudgetInput): TodayBudget | undefined {
  const { startDate, endDate, today } = input;
  const days = tripDayCount(startDate, endDate);
  const k = tripDayCount(startDate, today);
  if (k < 1 || k > days) return undefined;
  const pool = budget - sum(own.filter((e) => e.spentOn < startDate));
  const before = sum(own.filter((e) => e.spentOn >= startDate && tripDayCount(startDate, e.spentOn) < k));
  const spentToday = sum(own.filter((e) => e.spentOn === today));
  // floor on the cumulative amount, so rounding never drifts between days
  const carryoverMinor = Math.floor((pool * (k - 1)) / days) - before + 0; // + 0 turns -0 into 0
  const allowedMinor = Math.floor((pool * k) / days) - before;
  return { allowedMinor, leftMinor: allowedMinor - spentToday, carryoverMinor };
}

export function computeExpenseBudget(input: ExpenseBudgetInput): { group: GroupBudget; people: PersonBudget[] } {
  const live = input.expenses.filter((e) => e.deletedAt === null);
  const days = tripDayCount(input.startDate, input.endDate);
  // B3: the daily amount is fixed, so the trip length sets the pool
  const travelers = [
    { id: null as string | null, displayName: input.organizerName, pool: input.organizerDailyMinor * days },
    ...input.members.map((m) => ({ id: m.id, displayName: m.displayName, pool: m.dailyBudgetMinor * days })),
  ];
  const people = travelers.map((t): PersonBudget => {
    const own = live.filter((e) => e.memberId === t.id);
    const spentMinor = sum(own);
    return {
      memberId: t.id,
      displayName: t.displayName,
      spentMinor,
      leftMinor: t.pool - spentMinor,
      byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, sum(own.filter((e) => e.category === c))])) as Record<ExpenseCategory, number>,
      today: personToday(own, t.pool, input),
    };
  });
  const spentMinor = sum(live);
  const todays = people.map((p) => p.today);
  const group: GroupBudget = {
    spentMinor,
    leftMinor: travelers.reduce((s, t) => s + t.pool, 0) - spentMinor,
    today: todays.every((t) => t !== undefined)
      ? {
          allowedMinor: todays.reduce((s, t) => s + t.allowedMinor, 0),
          leftMinor: todays.reduce((s, t) => s + t.leftMinor, 0),
          carryoverMinor: todays.reduce((s, t) => s + t.carryoverMinor, 0),
        }
      : undefined,
  };
  return { group, people };
}

/** Timeline (D12): days newest first, newest created first within a day; soft-deleted rows left out. */
export function groupExpensesByDay(expenses: LocalExpense[]): ExpenseDay[] {
  const byDay = new Map<string, LocalExpense[]>();
  for (const e of expenses) {
    if (e.deletedAt === null) byDay.set(e.spentOn, [...(byDay.get(e.spentOn) ?? []), e]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([spentOn, list]) => ({
      spentOn,
      totalMinor: sum(list),
      expenses: list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) // by instant: offsets may differ,
    }));
}
