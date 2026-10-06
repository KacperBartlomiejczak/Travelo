import { z } from 'zod';

import { todayIn, zonedLocalToDate } from '@/lib/time';

import { IATA_CODE_PATTERN, isLocalDateTime, isTimeZone, MoneySchema } from './common';
import { FLIGHT_NUMBER_MAX_LENGTH } from './flight';
import { InterestTagSchema } from './interests';
import { DISPLAY_NAME_MAX_LENGTH } from './member';

// Create-trip wizard input. Error messages are i18n keys, translated by the screens.

export const MAX_COMPANIONS = 19;

const airportCode = z.string().regex(IATA_CODE_PATTERN, { error: 'validation.airportRequired' });
const airportTimezone = z.string().refine(isTimeZone, { error: 'validation.airportRequired' });
const localDateTime = z.string().refine(isLocalDateTime, { error: 'validation.dateTimeRequired' });

// Cross-field checks run only once every field parsed, so they never see half-filled input.
const onlyWhenFieldsValid = { when: (payload: { issues: readonly unknown[] }) => payload.issues.length === 0 };

function instant(local: string, timeZone: string): number {
  return zonedLocalToDate(local, timeZone).getTime();
}

/** One flight segment as entered: airport-local times + the airports' time zones. */
export const SegmentInputSchema = z
  .object({
    fromIata: airportCode,
    departTz: airportTimezone,
    toIata: airportCode,
    arriveTz: airportTimezone,
    departAt: localDateTime,
    arriveAt: localDateTime,
    flightNumber: z
      .string()
      .trim()
      .max(FLIGHT_NUMBER_MAX_LENGTH, { error: 'validation.flightNumberInvalid' })
      .optional()
      .transform((value) => value || undefined)
      .refine((value) => value === undefined || value.length >= 2, { error: 'validation.flightNumberInvalid' }),
  })
  .superRefine((segment, ctx) => {
    if (segment.fromIata === segment.toIata) {
      ctx.addIssue({ code: 'custom', path: ['toIata'], message: 'validation.sameAirport' });
    }
    if (instant(segment.arriveAt, segment.arriveTz) <= instant(segment.departAt, segment.departTz)) {
      ctx.addIssue({ code: 'custom', path: ['arriveAt'], message: 'validation.arrivalBeforeDeparture' });
    }
  }, onlyWhenFieldsValid);
export type SegmentInput = z.infer<typeof SegmentInputSchema>;

function checkChain(segments: SegmentInput[], direction: 'outbound' | 'return', ctx: z.RefinementCtx) {
  for (let i = 1; i < segments.length; i++) {
    const previous = segments[i - 1];
    const current = segments[i];
    if (current.fromIata !== previous.toIata) {
      ctx.addIssue({ code: 'custom', path: [direction, i, 'fromIata'], message: 'validation.layoverAirportMismatch' });
    } else if (instant(current.departAt, current.departTz) <= instant(previous.arriveAt, previous.arriveTz)) {
      ctx.addIssue({
        code: 'custom',
        path: [direction, i, 'departAt'],
        message: 'validation.departsBeforePreviousArrival',
      });
    }
  }
}

/** Step 1: flights (outbound + return, layovers as extra segments) and how many friends fly along. */
export const FlightsStepInputSchema = z
  .object({
    outbound: z.array(SegmentInputSchema).min(1),
    return: z.array(SegmentInputSchema).min(1),
    companionCount: z.int().min(0).max(MAX_COMPANIONS),
  })
  .superRefine((flights, ctx) => {
    checkChain(flights.outbound, 'outbound', ctx);
    checkChain(flights.return, 'return', ctx);

    const firstOut = flights.outbound[0];
    // "Today" at the departure airport (D15).
    if (firstOut.departAt.slice(0, 10) < todayIn(firstOut.departTz)) {
      ctx.addIssue({ code: 'custom', path: ['outbound', 0, 'departAt'], message: 'validation.departureInPast' });
    }

    const lastOut = flights.outbound[flights.outbound.length - 1];
    const firstBack = flights.return[0];
    if (instant(firstBack.departAt, firstBack.departTz) <= instant(lastOut.arriveAt, lastOut.arriveTz)) {
      ctx.addIssue({ code: 'custom', path: ['return', 0, 'departAt'], message: 'validation.returnBeforeOutbound' });
    }
  }, onlyWhenFieldsValid);
export type FlightsStepInput = z.infer<typeof FlightsStepInputSchema>;

export const FriendInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: 'validation.nameRequired' })
    .max(DISPLAY_NAME_MAX_LENGTH, { error: 'validation.nameTooLong' }),
  interests: z.array(InterestTagSchema),
});
export type FriendInput = z.infer<typeof FriendInputSchema>;

/** Step 2: one entry per companion. */
export const FriendsStepInputSchema = z.object({ friends: z.array(FriendInputSchema) });
export type FriendsStepInput = z.infer<typeof FriendsStepInputSchema>;

/** Step 3: budget per person for the whole trip (D5). */
export const BudgetStepInputSchema = z.object({
  budgetPerPerson: MoneySchema.extend({ amountMinor: z.int().positive({ error: 'validation.amountPositive' }) }),
});
export type BudgetStepInput = z.infer<typeof BudgetStepInputSchema>;

/** Everything the wizard collects; what the summary saves. */
export const CreateTripInputSchema = z
  .object({ flights: FlightsStepInputSchema, friends: FriendsStepInputSchema, budget: BudgetStepInputSchema })
  .refine((input) => input.friends.friends.length === input.flights.companionCount, {
    path: ['friends', 'friends'],
    error: 'validation.friendCountMismatch',
  });
export type CreateTripInput = z.infer<typeof CreateTripInputSchema>;
