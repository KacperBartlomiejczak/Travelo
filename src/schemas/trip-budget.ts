import { z } from 'zod';

import { IsoDateTimeSchema, MoneySchema } from './common';
import { addSharedModeIssues, BudgetModeSchema, DailyMinorSchema } from './create-trip-form';
import { SyncStatusSchema } from './sync';
import { TripOverviewSchema } from './trip';

/** A trip budget change made on the device, possibly offline (trips-supabase D1). */
export const TripBudgetChangeSchema = z.object({
  tripId: z.uuid(),
  /** The organizer's daily budget; must be in the trip's base currency, the repository checks it. */
  organizerDailyBudget: MoneySchema.extend({ amountMinor: z.int().positive() }),
  /** Every friend's daily budget, in minor units of the base currency. */
  members: z.array(z.object({ memberId: z.uuid(), dailyBudgetMinor: z.int().positive() })),
  updatedAt: IsoDateTimeSchema,
});
export type TripBudgetChange = z.infer<typeof TripBudgetChangeSchema>;

/** Device only: a row of the SQLite `trip_budget_changes` table. */
export const LocalTripBudgetChangeSchema = TripBudgetChangeSchema.extend({
  syncStatus: SyncStatusSchema,
  syncError: z.string().optional(),
  attempts: z.int().nonnegative(),
  lastAttemptAt: IsoDateTimeSchema.optional(),
});
export type LocalTripBudgetChange = z.infer<typeof LocalTripBudgetChangeSchema>;

/** The budget bottom sheet: the same "Razem / Osobno" form as the wizard, the currency stays the trip's (trips-supabase D5, daily-budget B4). */
export const TripBudgetFormSchema = z
  .object({
    mode: BudgetModeSchema,
    organizerDailyMinor: DailyMinorSchema,
    members: z.array(z.object({ memberId: z.uuid(), dailyMinor: DailyMinorSchema })),
  })
  .superRefine(
    (form, ctx) => {
      addSharedModeIssues(
        ctx,
        form.mode,
        form.organizerDailyMinor,
        form.members.map((member) => member.dailyMinor),
        (i) => ['members', i, 'dailyMinor'],
      );
    },
    // Compare only once every amount parsed.
    { when: (payload) => payload.issues.length === 0 },
  );
export type TripBudgetForm = z.infer<typeof TripBudgetFormSchema>;

/** What the home screen shows: the current trip, the state of a local budget change, and where it was read from (D5, D6; trips-drawer). */
export const CurrentTripSchema = z.object({
  overview: TripOverviewSchema,
  /** 'synced' when no local change is waiting. */
  budgetSyncStatus: SyncStatusSchema,
  /** Read from the SQLite copy because Supabase could not be reached. */
  fromCache: z.boolean(),
});
export type CurrentTrip = z.infer<typeof CurrentTripSchema>;
