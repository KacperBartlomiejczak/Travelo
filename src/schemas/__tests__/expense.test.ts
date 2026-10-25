import {
  EXPENSE_NAME_MAX_LENGTH,
  ExpenseCategorySchema,
  ExpenseDaySchema,
  ExpenseFormSchema,
  ExpenseRowSchema,
  ExpenseSchema,
  GroupBudgetSchema,
  LocalExpenseSchema,
  PersonBudgetSchema,
} from '@/schemas';

const ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a02';
const MEMBER_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a03';

const expense = {
  id: ID,
  tripId: TRIP_ID,
  memberId: MEMBER_ID,
  name: 'Tapas',
  amount: { amountMinor: 1850, currency: 'EUR' },
  category: 'food',
  spentOn: '2026-11-02',
  createdAt: '2026-11-02T20:00:00.000Z',
  updatedAt: '2026-11-02T20:00:00.000Z',
  deletedAt: null,
};

describe('ExpenseCategory', () => {
  it.each(['food', 'transport', 'stay', 'activities', 'other'])('accepts %s', (c) => {
    expect(ExpenseCategorySchema.safeParse(c).success).toBe(true);
  });
  it('rejects an unknown category', () => {
    expect(ExpenseCategorySchema.safeParse('shopping').success).toBe(false);
  });
});

describe('Expense', () => {
  it('accepts a valid expense, with memberId null (organizer) and a deletedAt', () => {
    expect(ExpenseSchema.safeParse(expense).success).toBe(true);
    expect(ExpenseSchema.safeParse({ ...expense, memberId: null }).success).toBe(true);
    expect(ExpenseSchema.safeParse({ ...expense, deletedAt: '2026-11-03T08:00:00.000Z' }).success).toBe(true);
  });

  it('trims the name', () => {
    expect(ExpenseSchema.parse({ ...expense, name: '  Tapas ' }).name).toBe('Tapas');
  });

  it.each([
    ['empty name', { name: '' }],
    ['blank name', { name: '   ' }],
    ['too long name', { name: 'x'.repeat(EXPENSE_NAME_MAX_LENGTH + 1) }],
    ['zero amount', { amount: { amountMinor: 0, currency: 'EUR' } }],
    ['negative amount', { amount: { amountMinor: -5, currency: 'EUR' } }],
    ['fractional amount', { amount: { amountMinor: 10.5, currency: 'EUR' } }],
    ['lowercase currency', { amount: { amountMinor: 100, currency: 'eur' } }],
    ['bad currency', { amount: { amountMinor: 100, currency: 'EURO' } }],
    ['bad date', { spentOn: '2026-02-30' }],
    ['unknown category', { category: 'shopping' }],
    ['non-uuid id', { id: 'abc' }],
    ['missing deletedAt', { deletedAt: undefined }],
    ['bad createdAt', { createdAt: 'yesterday' }],
  ])('rejects %s', (_, patch) => {
    expect(ExpenseSchema.safeParse({ ...expense, ...patch }).success).toBe(false);
  });

  it('accepts a name of exactly the maximum length', () => {
    expect(ExpenseSchema.safeParse({ ...expense, name: 'x'.repeat(EXPENSE_NAME_MAX_LENGTH) }).success).toBe(true);
  });
});

describe('LocalExpense', () => {
  const local = { ...expense, syncStatus: 'pending', attempts: 0 };
  it('accepts a local row with optional syncError and lastAttemptAt', () => {
    expect(LocalExpenseSchema.safeParse(local).success).toBe(true);
    expect(
      LocalExpenseSchema.safeParse({
        ...local,
        syncStatus: 'failed',
        syncError: 'denied',
        attempts: 2,
        lastAttemptAt: '2026-11-02T20:01:00.000Z',
      }).success,
    ).toBe(true);
  });
  it('rejects a missing or unknown status and negative attempts', () => {
    expect(LocalExpenseSchema.safeParse(expense).success).toBe(false);
    expect(LocalExpenseSchema.safeParse({ ...local, syncStatus: 'syncing' }).success).toBe(false);
    expect(LocalExpenseSchema.safeParse({ ...local, attempts: -1 }).success).toBe(false);
  });
});

describe('ExpenseForm', () => {
  const form = { name: 'Tapas', amount: { amountMinor: 1850, currency: 'EUR' }, category: 'food', memberId: null, spentOn: '2026-11-02' };
  it('accepts a valid form', () => {
    expect(ExpenseFormSchema.safeParse(form).success).toBe(true);
  });
  it.each([
    ['no category', { category: undefined }],
    ['zero amount', { amount: { amountMinor: 0, currency: 'EUR' } }],
    ['empty name', { name: '' }],
    ['bad date', { spentOn: 'tomorrow' }],
  ])('rejects %s', (_, patch) => {
    expect(ExpenseFormSchema.safeParse({ ...form, ...patch }).success).toBe(false);
  });
  it('carries the amount error key of the budget form', () => {
    const result = ExpenseFormSchema.safeParse({ ...form, amount: { amountMinor: 0, currency: 'EUR' } });
    expect(result.error?.issues[0].message).toBe('validation.amountPositive');
  });
});

describe('ExpenseRow', () => {
  const row = {
    id: ID,
    trip_id: TRIP_ID,
    member_id: null,
    name: 'Tapas',
    amount_minor: 1850,
    currency: 'EUR',
    category: 'food',
    spent_on: '2026-11-02',
    created_at: '2026-11-02T20:00:00+00:00',
    updated_at: '2026-11-02T20:00:00+00:00',
    deleted_at: null,
  };
  it('accepts a server row', () => {
    expect(ExpenseRowSchema.safeParse(row).success).toBe(true);
  });
  it.each([
    ['zero amount', { amount_minor: 0 }],
    ['bad currency', { currency: 'eur' }],
    ['unknown category', { category: 'x' }],
    ['bad date', { spent_on: '2026-13-01' }],
    ['camelCase leftovers only', { trip_id: undefined }],
  ])('rejects %s', (_, patch) => {
    expect(ExpenseRowSchema.safeParse({ ...row, ...patch }).success).toBe(false);
  });
});

describe('budget output schemas', () => {
  const byCategory = { food: 100, transport: 0, stay: 0, activities: 0, other: 0 };
  const person = { memberId: null, displayName: 'Ty', spentMinor: 100, leftMinor: -50, byCategory };

  it('accepts a person budget with negative left and an optional today', () => {
    expect(PersonBudgetSchema.safeParse(person).success).toBe(true);
    expect(
      PersonBudgetSchema.safeParse({ ...person, today: { allowedMinor: 500, leftMinor: -20, carryoverMinor: -10 } }).success,
    ).toBe(true);
  });
  it('rejects fractional minor amounts and a missing category', () => {
    expect(PersonBudgetSchema.safeParse({ ...person, spentMinor: 1.5 }).success).toBe(false);
    expect(PersonBudgetSchema.safeParse({ ...person, byCategory: { food: 1 } }).success).toBe(false);
    expect(PersonBudgetSchema.safeParse({ ...person, memberId: 'abc' }).success).toBe(false);
  });
  it('accepts a group budget and rejects a fractional one', () => {
    const group = { spentMinor: 300, leftMinor: 700, today: { allowedMinor: 100, leftMinor: 50, carryoverMinor: 0 } };
    expect(GroupBudgetSchema.safeParse(group).success).toBe(true);
    expect(GroupBudgetSchema.safeParse({ spentMinor: 300, leftMinor: 700 }).success).toBe(true);
    expect(GroupBudgetSchema.safeParse({ ...group, leftMinor: 0.5 }).success).toBe(false);
  });
  it('accepts an expense day and rejects a bad date', () => {
    const local = { ...expense, syncStatus: 'synced', attempts: 0 };
    const day = { spentOn: '2026-11-02', totalMinor: 1850, expenses: [local] };
    expect(ExpenseDaySchema.safeParse(day).success).toBe(true);
    expect(ExpenseDaySchema.safeParse({ ...day, spentOn: 'x' }).success).toBe(false);
    expect(ExpenseDaySchema.safeParse({ ...day, expenses: [expense] }).success).toBe(false);
  });
});
