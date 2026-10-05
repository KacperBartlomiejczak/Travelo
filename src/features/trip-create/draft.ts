import type { z } from 'zod';

import { defaultCurrency } from '@/lib/airport-search';
import { parseAmountToMinor } from '@/lib/money';

import type {
  CreateTripInputSchema,
  FlightsStepInputSchema,
  FriendInputSchema,
  FriendsStepInputSchema,
  SegmentInputSchema,
} from '@/schemas';

// What the wizard holds while it is being filled in. Validated with the step schemas on "Next".
/** `key` identifies a segment card on screen; the schema strips it. */
export type SegmentDraft = z.input<typeof SegmentInputSchema> & { key: string };
export type FriendDraft = z.input<typeof FriendInputSchema>;
export type TripDraft = Omit<z.input<typeof FlightsStepInputSchema>, 'outbound' | 'return'> & {
  outbound: SegmentDraft[];
  return: SegmentDraft[];
} & z.input<typeof FriendsStepInputSchema> & {
    /** The amount as typed; parsed to minor units on "Next". `currency` is only what the user tapped. */
    budget: { amountText: string; currency: string };
  };

let nextSegmentKey = 0;

export function emptySegment(): SegmentDraft {
  nextSegmentKey += 1;
  return { key: String(nextSegmentKey), fromIata: '', departTz: '', toIata: '', arriveTz: '', departAt: '', arriveAt: '' };
}

export function emptyDraft(): TripDraft {
  return {
    outbound: [emptySegment()],
    return: [emptySegment()],
    companionCount: 0,
    friends: [],
    budget: { amountText: '', currency: '' },
  };
}

/** One friend per companion; filled-in friends are kept when the count changes (D10). */
export function withCompanionCount(draft: TripDraft, companionCount: number): TripDraft {
  const friends = Array.from(
    { length: companionCount },
    (_, i) => draft.friends[i] ?? { displayName: '', interests: [] },
  );
  return { ...draft, companionCount, friends };
}

/** Adds a layover segment that departs from where the last segment landed. */
export function addLayover(segments: SegmentDraft[]): SegmentDraft[] {
  const last = segments[segments.length - 1];
  return [...segments, { ...emptySegment(), fromIata: last.toIata, departTz: last.arriveTz }];
}

// Return airports suggested from the outbound: last arrival → first departure (D25).
function suggestedReturnAirports(outbound: SegmentDraft[]) {
  const first = outbound[0];
  const last = outbound[outbound.length - 1];
  return { fromIata: last.toIata, departTz: last.arriveTz, toIata: first.fromIata, arriveTz: first.departTz };
}

function hasAirports(segment: SegmentDraft, airports: ReturnType<typeof suggestedReturnAirports>): boolean {
  return segment.fromIata === airports.fromIata && segment.toIata === airports.toIata;
}

/**
 * Replaces the outbound. While the single return segment's airports are empty or still the previous
 * suggestion, they follow the outbound reversed (D25); once the user changed them, they are kept.
 */
export function withOutbound(draft: TripDraft, outbound: SegmentDraft[]): TripDraft {
  const [back, ...more] = draft.return;
  const empty = { fromIata: '', departTz: '', toIata: '', arriveTz: '' };
  const follows = more.length === 0 && (hasAirports(back, empty) || hasAirports(back, suggestedReturnAirports(draft.outbound)));
  if (!follows) return { ...draft, outbound };
  return { ...draft, outbound, return: [{ ...back, ...suggestedReturnAirports(outbound) }] };
}

const OTHER_CURRENCIES = ['PLN', 'EUR', 'USD']; // D34

/** Destination currency first, then PLN, EUR, USD (D34). */
export function budgetCurrencyOptions(draft: TripDraft): string[] {
  const destination = defaultCurrency(draft.outbound[draft.outbound.length - 1].toIata);
  return [...new Set([...(destination ? [destination] : []), ...OTHER_CURRENCIES])];
}

/** The user's pick while it is still offered, otherwise the destination's currency (D8, D36). */
export function budgetCurrency(draft: TripDraft): string {
  const options = budgetCurrencyOptions(draft);
  return options.includes(draft.budget.currency) ? draft.budget.currency : options[0];
}

/** What the summary saves; the schema strips draft-only fields such as segment keys. */
export function toCreateTripInput(draft: TripDraft, locale: string): z.input<typeof CreateTripInputSchema> {
  const currency = budgetCurrency(draft);
  return {
    flights: { outbound: draft.outbound, return: draft.return, companionCount: draft.companionCount },
    friends: { friends: draft.friends },
    // The budget step only lets valid amounts through; 0 makes the schema reject anything else.
    budget: { budgetPerPerson: { amountMinor: parseAmountToMinor(draft.budget.amountText, currency, locale) ?? 0, currency } },
  };
}
