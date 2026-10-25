import { z } from 'zod';

import { CurrencyCodeSchema, IsoDateSchema, IsoDateTimeSchema } from './common';
import { BudgetStepInputSchema } from './create-trip-form';
import { SyncStatusSchema } from './sync';

export const ExpenseCategorySchema = z.enum(['food', 'transport', 'stay', 'activities', 'other']);
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

export const EXPENSE_NAME_MAX_LENGTH = 60;

/** A positive amount; same rule and error key as the budget form. */
const PositiveMoneySchema = BudgetStepInputSchema.shape.budgetPerPerson;

/** An expense of a trip (expenses plan D5-D15). `memberId` null = the organizer. Currency = the trip's base currency, checked by the repository. */
export const ExpenseSchema = z.object({
  /** UUID generated on the device. */
  id: z.uuid(),
  tripId: z.uuid(),
  memberId: z.uuid().nullable(),
  name: z.string().trim().min(1, { error: 'validation.expenseNameRequired' }).max(EXPENSE_NAME_MAX_LENGTH, { error: 'validation.expenseNameTooLong' }),
  amount: PositiveMoneySchema,
  category: ExpenseCategorySchema,
  /** Local calendar date the money was spent. */
  spentOn: IsoDateSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  deletedAt: IsoDateTimeSchema.nullable(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

/** Device only: a row of the SQLite `expenses` table, its own outbox entry like LocalTripBudgetChange. */
export const LocalExpenseSchema = ExpenseSchema.extend({
  syncStatus: SyncStatusSchema,
  syncError: z.string().optional(),
  attempts: z.int().nonnegative(),
  lastAttemptAt: IsoDateTimeSchema.optional(),
});
export type LocalExpense = z.infer<typeof LocalExpenseSchema>;

/** The expense bottom sheet. The category has no default (design §9.3). */
export const ExpenseFormSchema = z.object({
  name: ExpenseSchema.shape.name,
  amount: PositiveMoneySchema,
  category: ExpenseCategorySchema,
  memberId: ExpenseSchema.shape.memberId,
  spentOn: IsoDateSchema,
});
export type ExpenseForm = z.infer<typeof ExpenseFormSchema>;

/** A row of the server table `expenses`, as Supabase returns it. */
export const ExpenseRowSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  member_id: z.uuid().nullable(),
  name: z.string(),
  amount_minor: z.int().positive(),
  currency: CurrencyCodeSchema,
  category: ExpenseCategorySchema,
  spent_on: IsoDateSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
});
export type ExpenseRow = z.infer<typeof ExpenseRowSchema>;

/** Results of the budget math (`src/lib/expense-budget.ts`). Minor amounts are integers; left and carryover may be negative. */
export const TodayBudgetSchema = z.object({
  allowedMinor: z.int(),
  leftMinor: z.int(),
  carryoverMinor: z.int(),
});
export type TodayBudget = z.infer<typeof TodayBudgetSchema>;

export const PersonBudgetSchema = z.object({
  memberId: z.uuid().nullable(),
  displayName: z.string(),
  spentMinor: z.int(),
  leftMinor: z.int(),
  byCategory: z.record(ExpenseCategorySchema, z.int()),
  /** Only while the trip is running. */
  today: TodayBudgetSchema.optional(),
});
export type PersonBudget = z.infer<typeof PersonBudgetSchema>;

export const GroupBudgetSchema = z.object({
  spentMinor: z.int(),
  leftMinor: z.int(),
  today: TodayBudgetSchema.optional(),
});
export type GroupBudget = z.infer<typeof GroupBudgetSchema>;

export const ExpenseDaySchema = z.object({
  spentOn: IsoDateSchema,
  totalMinor: z.int(),
  expenses: z.array(LocalExpenseSchema),
});
export type ExpenseDay = z.infer<typeof ExpenseDaySchema>;
