import type { z } from 'zod';

import { defaultCurrency } from '@/lib/airport-search';
import { parseAmountToMinor } from '@/lib/money';
import { defaultTripName } from '@/lib/trip-name';

import {
  DEFAULT_COVER,
  type CoverChoice,
  type BudgetStepInputSchema,
  type CreateTripInputSchema,
  type FlightsStepInputSchema,
  type FoundFriend,
  type FriendInputSchema,
  type FriendsStepInputSchema,
  type SegmentInputSchema,
  type TripDetailsInputSchema,
} from '@/schemas';
import type { BoardingPass, TicketSegment } from '@/schemas/ticket';

// What the wizard holds while it is being filled in. Validated with the step schemas on "Next".
/**
 * `key` identifies a segment card on screen; `suggestedDate` (YYYY-MM-DD) is the day a ticket gave when it had no times,
 * so the time pickers can open on it. The schema strips both.
 */
export type SegmentDraft = z.input<typeof SegmentInputSchema> & { key: string; suggestedDate?: string };
/**
 * `codeText` is the friend code as typed (UI state, never sent); `friendCode` is set only once that code was found on the
 * server (friend-invite D3, D9). A friend without code fields behaves as one without a code.
 */
export type FriendDraft = z.input<typeof FriendInputSchema> & { codeText?: string };
type DetailsInput = z.input<typeof TripDetailsInputSchema>;
export type TripDraft = Omit<z.input<typeof FlightsStepInputSchema>, 'outbound' | 'return'> & {
  outbound: SegmentDraft[];
  return: SegmentDraft[];
} & Omit<z.input<typeof FriendsStepInputSchema>, 'friends'> & {
    friends: FriendDraft[];
    /**
     * Daily amounts as typed; parsed to minor units on "Next". `amountText` is the organizer's (in "shared" mode, everyone's);
     * `friendAmountTexts` follow the order of `friends` and matter only in "individual" mode. `currency` is only what the user tapped.
     */
    budget: { mode: z.input<typeof BudgetStepInputSchema>['mode']; amountText: string; friendAmountTexts: string[]; currency: string };
    /** null = not typed yet: the default name follows the flights (trip-flight-tabs-name-cover A2). */
    name: DetailsInput['name'] | null;
    /** Always set: a preset from the start (trip-covers D4), or a gallery photo picked on this phone. */
    coverImageUri: CoverChoice;
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
    budget: { mode: 'shared', amountText: '', friendAmountTexts: [], currency: '' },
    name: null,
    coverImageUri: DEFAULT_COVER,
  };
}

export function emptyFriend(): FriendDraft {
  return { displayName: '', interests: [], friendCode: null, codeText: '' };
}

/**
 * The friend with the code text changed. A friend that was found by the old code goes back to an empty manual card (D9):
 * the nick and interests belonged to that account. One that was not found keeps the name and interests typed by hand.
 */
export function withCodeText(friend: FriendDraft, codeText: string): FriendDraft {
  if (friend.friendCode) return { ...emptyFriend(), codeText };
  return { ...friend, codeText };
}

/** The friend filled in from the account that has `code`: its nick as the name, its interests (D3). */
export function withFoundFriend(friend: FriendDraft, code: string, found: FoundFriend): FriendDraft {
  return { ...friend, displayName: found.username, interests: found.interests, friendCode: code, codeText: code };
}

/** Something is typed in the code field and no friend was found for it: "Dalej" waits (D13). */
export function hasUnresolvedCode(friend: FriendDraft): boolean {
  return (friend.codeText ?? '').trim() !== '' && !friend.friendCode;
}

/** One friend per companion; filled-in friends (code state included) are kept when the count changes (D10). */
export function withCompanionCount(draft: TripDraft, companionCount: number): TripDraft {
  const friends = Array.from({ length: companionCount }, (_, i) => draft.friends[i] ?? emptyFriend());
  // A removed friend's amount must not pre-fill a friend added later.
  const friendAmountTexts = Array.from({ length: companionCount }, (_, i) => draft.budget.friendAmountTexts[i] ?? '');
  return { ...draft, companionCount, friends, budget: { ...draft.budget, friendAmountTexts } };
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

type TimezoneOf = (iata: string) => string | undefined;

function ticketSegment(
  leg: { fromIata: string; toIata: string; flightNumber: string | null; flightDate: string | null; departAt?: string | null; arriveAt?: string | null },
  timezoneOf: TimezoneOf,
): SegmentDraft {
  return {
    ...emptySegment(),
    fromIata: leg.fromIata,
    toIata: leg.toIata,
    departTz: timezoneOf(leg.fromIata) ?? '',
    arriveTz: timezoneOf(leg.toIata) ?? '',
    departAt: leg.departAt ?? '',
    arriveAt: leg.arriveAt ?? '',
    flightNumber: leg.flightNumber ?? undefined,
    ...(leg.flightDate && !(leg.departAt && leg.arriveAt) ? { suggestedDate: leg.flightDate } : {}),
  };
}

/** Both directions come from the ticket (ticket-import D3); a direction it does not cover keeps one empty card. */
export function draftFromTicket(draft: TripDraft, segments: TicketSegment[], timezoneOf: TimezoneOf): TripDraft {
  const of = (direction: TicketSegment['direction']) => {
    const legs = segments.filter((s) => s.direction === direction).map((s) => ticketSegment(s, timezoneOf));
    return legs.length > 0 ? legs : [emptySegment()];
  };
  return { ...draft, outbound: of('outbound'), return: of('return') };
}

const isSegmentEmpty = (s: SegmentDraft) => !s.fromIata && !s.toIata && !s.departAt && !s.arriveAt && !s.flightNumber;

/** No flight field typed or imported yet, so a ticket can fill the draft without asking (ticket-import D3). */
export function isFlightsDraftEmpty(draft: TripDraft): boolean {
  return [...draft.outbound, ...draft.return].every(isSegmentEmpty);
}

/** Adds the legs of a scanned boarding pass to one direction (Z2); a lone empty card is replaced. Times stay empty (Z3). */
export function withBoardingPass(draft: TripDraft, pass: BoardingPass, direction: 'outbound' | 'return', timezoneOf: TimezoneOf): TripDraft {
  const legs = pass.legs.map((leg) => ticketSegment(leg, timezoneOf));
  const current = draft[direction];
  const kept = current.length === 1 && isSegmentEmpty(current[0]) ? [] : current;
  return { ...draft, [direction]: [...kept, ...legs] };
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

/** The name typed by the organizer, otherwise "<from city> → <destination city>" (D3). */
export function tripName(draft: TripDraft): string {
  return draft.name ?? defaultTripName(draft.outbound);
}

/** What the summary saves; the schema strips draft-only fields such as segment keys. */
export function toCreateTripInput(draft: TripDraft, locale: string): z.input<typeof CreateTripInputSchema> {
  const currency = budgetCurrency(draft);
  const organizerDaily = parseAmountToMinor(draft.budget.amountText, currency, locale) ?? 0;
  return {
    flights: { outbound: draft.outbound, return: draft.return, companionCount: draft.companionCount },
    // The typed code text stays on the phone; only a found code (`friendCode`) is sent (friend-invite D12).
    friends: {
      friends: draft.friends.map(({ displayName, interests, friendCode }) => ({ displayName, interests, friendCode })),
    },
    // The budget step only lets valid amounts through; 0 makes the schema reject anything else.
    budget: {
      mode: draft.budget.mode,
      currency,
      organizerDailyMinor: organizerDaily,
      friendDailyMinor: draft.friends.map((_, i) =>
        draft.budget.mode === 'shared' ? organizerDaily : (parseAmountToMinor(draft.budget.friendAmountTexts[i] ?? '', currency, locale) ?? 0),
      ),
    },
    details: { name: tripName(draft), coverImageUri: draft.coverImageUri },
  };
}
