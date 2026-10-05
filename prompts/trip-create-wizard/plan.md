# Task: Create trip — multi-step form (flights → friends → budget → summary)
Status: done (2026-10-04) — awaiting Kacper's manual device check

## Understanding & assumptions
Kacper's request (2026-10-04), in short:
1. **Screen 1 — trip & flight:** when and where the organizer flies, option to add layovers and how long each layover takes, optionally upload a ticket that fills in everything, and how many people fly with the organizer. If it is only the organizer, screen 2 is skipped (organizer's own profile comes later).
2. **Screen 2 — friends:** each friend's preferences, hobbies and interests, grouped into categories (fun: nightlife, aquaparks; nature; museums; …) — more categories than the examples given.
3. **Screen 3 — budget:** how much the group wants to spend per person.
4. **Screen 4 — summary** of everything entered.
5. After saving: the earliest trip is shown, and the data is sent to the database (Supabase, not configured yet).

**Done means:** from "Utwórz podróż" the organizer goes through the steps, enters outbound + return flights (with layover segments), the number of companions, each companion's name + interests, a per-person budget, sees a summary, saves, and lands on "Twoje podróże", which lists the saved trips with the soonest one first. All data shapes are Zod schemas; every screen works in pl/en and light/dark; full suite, typecheck and lint are green; `Architecture.md` is updated.

### Decisions (Kacper, 2026-10-04)
- **D1 (Q1) — Storage until Supabase:** in-memory repository behind an interface, read/written via TanStack Query. Data is lost on app restart. Supabase replaces only the implementation later.
- **D2 (Q2) — Ticket upload:** visible but disabled "Upload ticket" button with a "coming soon" note. No parsing, no file picker, no backend now.
- **D3 (Q3) — Layovers:** entered as flight segments (from, to, depart, arrive); layover duration is derived and shown by the app, never typed or stored.
- **D4 (Q4) — Flights & dates:** outbound + return, each with optional layover segments. Trip dates are derived from flights: start = outbound arrival date, end = return departure date.
- **D5 (Q5) — Budget:** one amount per person for the whole trip, shared by the whole group. Daily budget is derived later, not stored.
- **D6 (Q6) — After saving:** back to "Your trips", which now lists trip cards, the soonest trip first.
- **D7 — Friends:** name + interests only. Pace, budget level and dietary notes come later in member editing.
- **D8 (Q8) — Currency:** default = currency of the destination country (from the outbound arrival airport, e.g. BCN → EUR), changeable by hand. Budget is entered in that currency. No FX conversion now (needs an FX API via backend).
- **D9 — Airports:** searchable field ("Barc…" or "BCN") over a local airport list bundled with the app (code, name, city, country, IANA timezone, currency). Gives timezone and currency automatically.
- **D10 — Companions:** field "How many people fly with you" (0 = alone → friends step skipped). For N, the friends step shows N friend cards to fill in. Going back and changing N keeps already-filled cards (extra ones are dropped when N decreases).
- **D11 — Interests:** 17 tags in 6 groups, shown as chips under group headers:
  - Fun: nightlife · theme parks & aquaparks · concerts & festivals
  - Nature: mountains & hiking · beaches · national parks & nature
  - Culture: museums · landmarks & architecture · art & galleries
  - Food: local cuisine · cafés & desserts · street food & markets
  - Active: water sports · cycling & excursions
  - Relax & more: spa & wellness · shopping · photography
- **D12 — Step indicator:** "Krok 2 z 4" text + thin progress bar in brand colour. Travelling alone: "Krok 2 z 3".
- **D13 — Trip name:** automatically the destination city ("Barcelona"); renaming comes later with trip editing.
- **D14 — Trip card:** destination, dates, number of travellers, "Budżet: 3000 EUR / os.". Expense status arrives with the expenses feature.
- **D15 — No past trips:** the first outbound departure must be today or later. The list therefore has only upcoming trips, soonest first.
- **D19 (Kacper, 2026-10-04) — leaving the wizard:** if anything was entered, leaving (back on step 1 or the gesture) asks "Discard entered data?" — Discard / Stay. With nothing entered it leaves at once. → step 5.
- **D20 (Kacper, 2026-10-04) — large airports rank higher in search:** the dataset gets a `large` flag (OurAirports `large_airport`); within the same match rank, large airports come first. → new step 3a.
- **D21 (Kacper, 2026-10-04) — search acceptance criterion relaxed:** "lon" cannot put London first with only rank + large flag (Long Beach is large and sorts first); accepted: London airports in the top 5, BCN top 4 for "bar", Paris first for "par". No traffic data.
- **D22 (Kacper, 2026-10-04) — leave confirmation uses the system dialog** (native alert on iOS/Android, browser confirm on web), not a custom §10.17 dialog — no new visual rules (no scrim token needed).
- **D23 (Kacper, 2026-10-04) — progress bar:** "Krok 2 z 4" in Body S `text.secondary`, 8dp gap, 4dp bar with full radius, track `border`, fill `action.primary`, no animation, 24dp to the step content.
- **D24 (Kacper, 2026-10-04) — flights screen layout:** heading "Kiedy i dokąd lecisz?"; disabled secondary "Wyślij bilet · wkrótce" at the top; "Lot tam" and "Powrót" sections (Heading 3), each segment a card "Odcinek N" (Skąd, Dokąd, Wylot, Przylot, Nr lotu optional; "Usuń" on segments after the first); amber layover label between cards (§10.11); ghost "+ Dodaj przesiadkę" per section; "Ile osób leci z Tobą?" stepper; "Dalej" pinned. Date/time: field → tap → native picker (iOS wheel under the field, Android date then time dialog, web browser input).
- **D25 (Kacper, 2026-10-04) — return suggestion:** while the return's airports are empty (or still equal to the previous suggestion), they follow the outbound reversed (outbound WAW→…→BKK ⇒ return BKK→WAW); dates stay empty; the user can change them (open-jaw).
- **D26 (Kacper, 2026-10-04) — input border token:** new role `input.border` — light `neutral.300` #C5BBAA (§10.4), dark #4A564C; focus 2dp `action.primary`, error 2dp `status.error` (§10.4).
- **D27 (Kacper, 2026-10-04) — fields and segment card:** field label Body M Medium `text.primary` (corrected 2026-10-04: "Body S Medium" is not in the §4.2 type scale; Body M Medium is its "Labels" style), 4dp above; field 52dp, padding 16, radius sm, background `surface.default`; error Body S `status.error` 4dp below with `CircleX` 16; "(opcjonalnie)" in `text.secondary` next to the label. Segment card: `surface.default`, radius lg, padding 16, elevation level 1 in light / none in dark (§6.1), title Body M Medium, 12dp between fields. Layover: `Clock` 16 + Body M Medium in `status.warning`, inset 16 between cards.
- **D28 (Kacper, 2026-10-04) — secondary / ghost / icon buttons in both modes:** secondary: 1dp `input.border`, text `text.primary`, pressed `surface.secondary`, disabled `surface.secondary` + `text.tertiary`. Ghost: text new role `action.link` (light brand.600 per §10.1, dark #F08A6C), pressed `surface.secondary`, disabled `text.tertiary`. Icon button 44×44: pressed `surface.secondary`, disabled opacity 0.4 (§10.2). Disabled text uses `text.tertiary` instead of §10.1's neutral.400 for contrast (as D9).
- **D29 (Kacper, 2026-10-04) — failed "Next":** scroll to the first field with an error and announce "Popraw zaznaczone pola" to screen readers.
- **D30 (Kacper, 2026-10-04) — Android time format** follows the device's 12/24h setting (not the app language).
- **D31 (Kacper, 2026-10-04) — iOS:** opening an empty date field takes the suggested value shown by the wheel (previous segment's arrival, the segment's departure for arrival, else today 12:00).
- **D32 (Kacper, 2026-10-04) — friends screen and interest chips:** heading "Kto leci z Tobą?" + Body M secondary hint "Zaznacz, co lubią — plan dnia to uwzględni."; one card per friend ("Znajomy N", same card style as segments) with "Imię" and "Co lubi?" (Body M Medium), group names Body S `text.secondary`, chips wrap with 8dp gaps. Chip (§10.6): 36dp, padding 12, radius full, Body S; unselected `surface.default` + 1dp `input.border` + `text.primary`; selected `action.primary` + `action.onPrimary` + `Check` 16; pressed `surface.secondary` / `action.primaryPressed`.
- **D33 (Kacper, 2026-10-04) — budget excludes flights;** hint: "Na cały wyjazd, bez lotów: noclegi, jedzenie, atrakcje, transport na miejscu."
- **D34 (Kacper, 2026-10-04) — currency choice:** segmented control with the destination currency + PLN + EUR + USD (deduplicated), destination preselected (D8).
- **D35 (Kacper, 2026-10-04) — derived figures under the amount:** group total ("Razem dla 3 osób: 9000 EUR", only when more than one traveller) and "~231 EUR dziennie na osobę" (budget per person ÷ trip days, inclusive start…end, rounded to whole units; "~" because it is an average).
- Implementation notes (step 8, following design-context): the currency segmented control is 52dp high (§10.5 "currency selector 52dp"; §10.14's 40dp would be below the 44pt touch target), radius 10 (§10.14, new token `radius.segmented`), track `surface.secondary`, selected `surface.default` + `text.primary`, unselected `text.secondary`. Amount field 64dp, Numeric XL, currency code beside the amount (§10.5); an unparsable amount is flagged while typing ("validation occurs immediately").
- **D36 (Kacper, 2026-10-04) — currency after changing the destination:** only a currency the user tapped is stored; the shown one is "the user's pick if it is still among the options, otherwise the destination's currency". A hand-picked PLN/EUR/USD stays; the old destination's currency falls back to the new one's.
- **D37 (Kacper, 2026-10-04) — budget copy for a solo trip:** alone: "Ile chcesz wydać?" + field "Kwota"; with friends: "Ile chcecie wydać na osobę?" + "Kwota na osobę".
- **D38 (Kacper, 2026-10-04) — summary screen:** heading "Sprawdź podróż"; three cards, each with a ghost "Zmień" that returns to that step (draft kept): trip (city as Heading 3, dates + number of days, outbound/return segment lines "WAW 2 lis, 22:00 → DXB 3 lis, 06:30" with amber layover labels), travellers ("Podróżni · N osoby": "Ty", then each friend with interests or "bez zainteresowań"), budget (per person in Numeric L, then group total and ~per day). Save error: `CircleX` + "Nie udało się zapisać podróży. Spróbuj ponownie." above the button; "Utwórz podróż" shows loading while saving; after saving → "Twoje podróże" (D6) without the discard question.
- **D39 (Kacper, 2026-10-04) — trips list:** "Twoje podróże" (Heading 1); "Najbliższa podróż" (Heading 3) with the soonest trip, then "Później" with the rest; card (wizard card style): city Heading 3, date range Body M, `Users` icon + "N osoby", "Budżet: 3000 THB / os."; "Utwórz podróż" stays pinned at the bottom. Loading: 2 static skeleton cards (`surface.secondary`). Error: `CircleX` + "Nie udało się wczytać podróży." + secondary "Spróbuj ponownie" (§12). Empty: unchanged. Cards not pressable yet (trip details are a separate task).
- **D40 (Kacper, 2026-10-04) — summary budget line confirmed:** "Razem … · ~… dziennie na osobę".
- **D16 (Q9–Q13) — accepted as proposed** with the plan approval (2026-10-04): max 19 companions; a friend may have 0 interests; add `expo-crypto` for UUIDs; download the 3 airport sources at dev time and bundle the generated JSON; trip card shows "N osoby" + `Users` icon instead of avatars.

### Assumptions (correct me if any is wrong)
- **A1 — Repo layout.** Schemas go to `src/schemas/` (the app is a single package at the repo root, see `Architecture.md`), not `packages/schemas/`. Moving to a monorepo is a separate decision. The `backend` subagent's allowed path is adapted to `src/schemas/` + `scripts/` + `src/data/` in its briefs.
- **A2 — Organizer is not a member yet.** "User info comes later", so this task creates only guest members (friends). Traveller count = friends + 1 (organizer). The organizer's own `TripMember` arrives with auth/profile.
- **A3 — No auth yet.** `Trip.ownerId` is set to a constant `LOCAL_OWNER_ID` by the in-memory repository until Supabase Auth exists.
- **A4 — Data model changes vs. CLAUDE.md** (schemas win; CLAUDE.md "Data structures" gets updated in the last step):
  - `Trip.dailyBudget?: Money` → replaced by `Trip.budgetPerPerson: Money` (D5; daily budget becomes derived).
  - `TripMember.budgetLevel` and `pace` become **optional** until member editing exists (D7).
- **A5 — Times are entered in the airport's local time** (as printed on a ticket). Stored as ISO 8601 with offset + the airport's IANA timezone, per CLAUDE.md. Conversion local time + IANA tz → offset is done with `Intl` (no new dependency).
- **A6 — Open-jaw allowed.** The return flight does not have to start where the outbound ended, nor end where it started (e.g. into BCN, out of MAD). Destination = outbound final arrival airport.
- **A7 — Flight number** is an optional field per segment (it is in the CLAUDE.md model).
- **A8 — Date/time picker:** `@expo/ui/community/datetime-picker`, already installed (has iOS, Android and web implementations). No new dependency.
- **A9 — Screen states.** The Trips screen gets loading, empty, error and list states. Offline state is not shown: data is in memory, there is no network. Wizard screens have no loading state (nothing to load); the summary's save button has loading + an error message.

## Approach
The wizard is a nested Expo Router stack: `src/app/trips/new/_layout.tsx` holds a `TripDraftProvider` (React context + `useReducer`) and four routes — `flights`, `friends`, `budget`, `summary`. Native back/swipe-back moves between steps for free; the draft lives in the layout, so it survives going back and forth and is discarded when the wizard is closed. Every step validates its slice with its Zod schema before "Dalej" moves on; the summary assembles `CreateTripInput`, parses it with Zod and calls `useCreateTrip()` (TanStack Query mutation → `TripRepository`). The repository is an interface with an in-memory implementation now (D1); Supabase later swaps the implementation, not the hooks or screens. Pure logic (timezone conversion, layovers, trip dates, airport search, amount parsing, money formatting) lives in `src/lib/` with unit tests.

Rejected: a single `/trips/new` screen with internal step state — needs custom Android back / swipe handling that the nested stack gives for free.

## Data structures (Zod)
All in `src/schemas/`, types only via `z.infer`.

> **As implemented (step 1):** schema constants are named `XSchema` and types `X = z.infer<typeof XSchema>` (e.g. `TripSchema` / `Trip`), because `const Trip` + `type Trip` fails the `@typescript-eslint/no-redeclare` lint rule. `companions` is named `companionCount` (glossary). `SegmentInputSchema` also carries `departTz` / `arriveTz` (filled from the chosen airport) so cross-time-zone rules need no airport lookup. The sketch below keeps the original names.

```ts
// common.ts
export const CurrencyCode = z.string().regex(/^[A-Z]{3}$/);          // ISO 4217
export const IataCode     = z.string().regex(/^[A-Z]{3}$/);
export const IanaTimezone = z.string().refine(isValidTimeZone);      // Intl check
export const IsoDateTime  = z.iso.datetime({ offset: true });        // 2026-11-02T10:15:00+01:00
export const IsoDate      = z.iso.date();                            // 2026-11-02
export const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/); // form input, airport-local
export const Money = z.object({ amountMinor: z.int().nonnegative(), currency: CurrencyCode });

// interests.ts
export const InterestTag = z.enum([
  'nightlife', 'theme_parks', 'concerts_festivals',
  'mountains_hiking', 'beaches', 'nature_parks',
  'museums', 'landmarks', 'art_galleries',
  'local_cuisine', 'cafes_desserts', 'street_food',
  'water_sports', 'cycling',
  'spa_wellness', 'shopping', 'photography',
]);
export const InterestGroup = z.enum(['fun', 'nature', 'culture', 'food', 'active', 'relax']);
export const INTEREST_GROUPS: Record<InterestGroup, InterestTag[]> = { ... };  // D11, test: every tag in exactly one group

// airport.ts
export const Airport = z.object({
  iata: IataCode, name: z.string().min(1), city: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2}$/), timezone: IanaTimezone, currency: CurrencyCode,
});

// flight.ts
export const FlightDirection = z.enum(['outbound', 'return', 'internal']);
export const FlightSegment = z.object({
  id: z.uuid(), tripId: z.uuid(), direction: FlightDirection, order: z.int().nonnegative(),
  flightNumber: z.string().trim().min(2).max(8).optional(),
  fromIata: IataCode, toIata: IataCode,
  departAt: IsoDateTime, departTz: IanaTimezone, arriveAt: IsoDateTime, arriveTz: IanaTimezone,
}).refine(arriveAt > departAt);

// member.ts
export const TripMember = z.object({
  id: z.uuid(), tripId: z.uuid(), userId: z.string().nullable(),
  displayName: z.string().trim().min(1).max(40), role: z.enum(['owner', 'viewer']),
  interests: z.array(InterestTag),
  budgetLevel: z.enum(['low', 'mid', 'high']).optional(),          // A4
  pace: z.enum(['relaxed', 'normal', 'intense']).optional(),       // A4
  dietaryNotes: z.string().max(200).optional(),
});

// trip.ts
export const Trip = z.object({
  id: z.uuid(), ownerId: z.string().min(1), name: z.string().min(1),
  destination: IataCode,                                            // outbound final arrival airport
  startDate: IsoDate, endDate: IsoDate,                             // derived from flights (D4), end >= start
  baseCurrency: CurrencyCode, budgetPerPerson: Money,               // A4; budgetPerPerson.currency === baseCurrency
  createdAt: IsoDateTime,
});
export const TripSummary = Trip.extend({ travellerCount: z.int().min(1) });  // list item

// create-trip-form.ts — wizard input, airport-local times
export const SegmentInput = z.object({
  fromIata: IataCode, toIata: IataCode, departAt: LocalDateTime, arriveAt: LocalDateTime,
  flightNumber: z.string().trim().min(2).max(8).optional(),
});  // + refine: fromIata !== toIata
export const FlightsStepInput = z.object({
  outbound: z.array(SegmentInput).min(1),
  return: z.array(SegmentInput).min(1),
  companions: z.int().min(0).max(MAX_COMPANIONS),                   // see open question Q9
}); // superRefine (needs airports for tz): each arriveAt > departAt; segment n+1 departs from segment n's arrival
    //   airport and after it lands; return departs after outbound lands; first departure >= today (D15)
export const FriendInput = z.object({ displayName: z.string().trim().min(1).max(40), interests: z.array(InterestTag) });
export const FriendsStepInput = z.object({ friends: z.array(FriendInput) });   // + length === companions (checked in CreateTripInput)
export const BudgetStepInput = z.object({ budgetPerPerson: Money.refine(m => m.amountMinor > 0) });
export const CreateTripInput = z.object({ flights: FlightsStepInput, friends: FriendsStepInput, budget: BudgetStepInput })
  .refine(friends.length === flights.companions);
```

## Tests
Location convention: next to the code in `__tests__/`; route tests in `src/__tests__/app/`.

- **Step 1 — schemas** (`src/schemas/__tests__/*.test.ts`): valid + invalid fixtures for every schema:
  - `CurrencyCode`/`IataCode`: `EUR` ok; `eur`, `EU`, `EURO` rejected. `IanaTimezone`: `Europe/Madrid` ok, `Mars/Base` rejected. `IsoDateTime` without offset rejected.
  - `Money`: float amount, negative amount, lowercase currency rejected.
  - `INTEREST_GROUPS`: every `InterestTag` in exactly one group; 17 tags, 6 groups.
  - `FlightSegment`: arrival before departure rejected.
  - `TripMember`: guest with `userId: null` and no pace/budgetLevel ok; empty/whitespace name rejected; unknown interest rejected.
  - `Trip`: `endDate < startDate` rejected; `budgetPerPerson.currency !== baseCurrency` rejected.
  - `FlightsStepInput`: segment arriving before departing; layover segment departing from a different airport than the previous arrival; layover segment departing before previous arrival; return before outbound lands; first departure yesterday → each rejected with an error on the right field path; 0 and MAX companions ok, -1 / MAX+1 / 1.5 rejected. Time-zone edge: a flight WAW 23:30 → JFK 02:10 (next day local) is valid.
  - `BudgetStepInput`: 0 rejected. `CreateTripInput`: friends count ≠ companions rejected.
- **Step 2 — airport data** (`src/data/__tests__/airports.test.ts`): every row parses with `Airport`; IATA codes unique; spot checks WAW (Warsaw, PL, Europe/Warsaw, PLN), BCN (EUR, Europe/Madrid), DXB (AED, Asia/Dubai), JFK (USD, America/New_York).
- **Step 3 — logic** (`src/lib/__tests__/*.test.ts`):
  - `localToIso('2026-11-02T10:15', 'Europe/Madrid')` → `2026-11-02T10:15:00+01:00`; summer time → `+02:00`; DST-change day; `Asia/Kolkata` (+05:30).
  - `getLayovers(segments)` → `[{ airport: 'DXB', minutes: 540 }]`; single segment → `[]`. `formatDuration(130)` → `2h 10m` (pl: `2 godz. 10 min`), `45` → `45m`.
  - `deriveTripDates(flights)` → start = outbound last arrival date (local), end = return first departure date (local).
  - `searchAirports('BCN')` → BCN first; `'barc'` → Barcelona; `'krakow'` matches `Kraków` (diacritics-insensitive); empty query → `[]`; max 8 results.
  - `parseAmountToMinor('3 000,50', 'PLN', 'pl')` → 300050; `'1,234.5'` in en → 123450; JPY `'1000'` → 1000 (0 minor digits); `'abc'`, `'-5'`, too many decimals → error. `formatMoney({ amountMinor: 300000, currency: 'EUR' }, 'pl')` → contains `3000` and `EUR`.
  - `defaultCurrency(destinationIata)` → `EUR` for BCN.
- **Step 4 — data layer** (`src/data/__tests__/trip-repository.test.ts`, `src/hooks/__tests__/trips.test.tsx`):
  - `buildTrip(input, now)` → Trip with name = destination city, dates from flights, `baseCurrency` = budget currency; members = friends (guest, `userId: null`, role `viewer`); segments with `order`, ISO offsets and timezones; every output parses with Zod.
  - in-memory repo: `create` then `list` returns the trip with `travellerCount` = friends + 1; `list` sorted by `startDate` ascending.
  - `useTrips` returns the sorted list; `useCreateTrip` success invalidates `useTrips` (new trip appears); repository rejection → mutation error.
- **Step 5 — wizard shell** (`src/__tests__/app/trips/new/layout.test.tsx`, `src/components/__tests__/StepIndicator.test.tsx`):
  - `StepIndicator` renders `Krok 2 z 4` and exposes progress to accessibility (`progressbar`, value 2/4).
  - `/trips/new` redirects to the flights step; draft reducer keeps entered data when going back; companions 0 → step count 3 and "Dalej" on flights goes straight to budget; changing N from 3 to 2 keeps the first two friends.
- **Step 6 — flights screen** (`src/__tests__/app/trips/new/flights.test.tsx`, component tests for `AirportField`, `DateTimeField`, `Stepper`, `TextField`):
  - typing `barc` shows Barcelona, choosing it fills the field; "Dodaj przesiadkę" adds a segment pre-filled with the previous arrival airport; layover label `9h przesiadki w DXB` appears between segments; removing a layover segment works.
  - "Wyślij bilet" is disabled and labelled "wkrótce" (D2).
  - companions stepper: − disabled at 0, + disabled at max.
  - "Dalej" with invalid data shows the Zod error messages (i18n) under the right fields and does not navigate; with valid data navigates to friends (N > 0) or budget (N = 0).
- **Step 7 — friends screen** (`.../friends.test.tsx`, `Chip.test.tsx`): N cards render; chip toggles `selected` state (accessibility `checked`); group headers visible; empty name blocks "Dalej" with an error; valid → budget.
- **Step 8 — budget screen** (`.../budget.test.tsx`, `AmountField.test.tsx`): currency preselected from destination (BCN → EUR); changing currency works; `0` / text / empty blocks "Dalej"; valid → summary.
- **Step 9 — summary screen** (`.../summary.test.tsx`): shows destination, dates, every segment and layover, travellers with interests, budget per person; "Utwórz podróż" shows loading, saves via the repository and returns to `/` where the trip is listed; repository error → error message, stays on summary, data kept.
- **Step 10 — Trips screen** (`src/__tests__/app/index.test.tsx` extended, `TripCard.test.tsx`): loading state; empty state (existing tests kept); error state with "Spróbuj ponownie" that refetches; list with the soonest trip first under "Najbliższa podróż", the rest under "Później"; card shows city, dates, `4 osoby`, `Budżet: 3 000 EUR / os.`.
- Every step: pl/en dictionaries keep identical keys (existing test).

## Files
**New**
- `src/schemas/{common,interests,airport,flight,member,trip,create-trip-form,index}.ts` + `src/schemas/__tests__/`
- `scripts/build-airports.mjs` (dev-only generator), `src/data/airports.json` (generated), `src/data/airports.ts` (typed, Zod-parsed export) + test
- `src/lib/{time,layovers,trip-dates,airport-search,money}.ts` + `src/lib/__tests__/`
- `src/data/trip-repository.ts` (interface + in-memory + `buildTrip`) + test
- `src/hooks/useTrips.ts` + test; `src/providers/QueryProvider.tsx`
- `src/app/trips/new/{_layout,index,flights,friends,budget,summary}.tsx`
- `src/features/trip-create/TripDraftContext.tsx` (provider + reducer)
- `src/components/{StepIndicator,TextField,AirportField,DateTimeField,Stepper,Chip,AmountField,SecondaryButton,TripCard,FlightSegmentFields,LayoverLabel}.tsx` + tests
- `src/__tests__/app/trips/new/*.test.tsx`

**Modified**
- `src/app/_layout.tsx` (QueryProvider, `trips/new` screen options), `src/app/index.tsx` (states + list)
- `src/i18n/locales/{pl,en}.json`
- `src/app/trips/new.tsx` → removed (replaced by the `trips/new/` folder); its test `src/__tests__/app/trips/new.test.tsx` moves to the new layout test
- `CLAUDE.md` → "Data structures" (A4), `Architecture.md`

## Skills
- `domain-modeling` — step 1 — the task adds Trip, TripMember, FlightSegment, Airport and interests; sharpen terms (traveller vs member vs companion) before the schemas are written.
- `frontend-design` — steps 5–10 — structure of the new screens and components within `context/design-context.md`.
- `ui-taste` — steps 6–10 — verifier's visual review of each finished screen.
- `grill-me` — not used: it only redirects to a `grilling` skill that is not installed; the interview was done directly in chat (D1–D15).

## Steps
- [x] 1. [backend] Zod schemas in `src/schemas/` (Data structures above) — skill: domain-modeling — tests first: Step 1 fixtures — verify: tests red → green, full suite + typecheck + lint.
- [x] 2. [backend] Airport dataset: generator script downloads 3 public sources (see Risks), keeps large + medium airports with scheduled service and an IATA code, joins timezone + currency, writes `src/data/airports.json`; `src/data/airports.ts` exports it parsed with Zod — skill: none — tests first: Step 2 — verify: as above + file size noted in the log.
- [x] 3. [frontend] Pure logic in `src/lib/` — skill: none — tests first: Step 3 — verify: as above.
- [x] 4. [frontend] Repository (interface + in-memory + `buildTrip`), `QueryProvider` in root layout, `useTrips` / `useCreateTrip` — skill: none — tests first: Step 4 — verify: as above.
- [x] 3a. [backend+frontend] D20: `AirportSchema.large: boolean` → generator writes it → `searchAirports` ranks large airports first within a rank — skill: none — tests first: schema fixture requires `large`; dataset: LHR/BCN large, a small airport not; search: large before small within the same rank, real data: London airports in the top 5 for `lon`, BCN in the top 4 for `bar`, Paris first for `par` (criterion changed, D21) — verify: full suite + typecheck + lint, verifier.
- [x] 5. [frontend] Wizard shell: nested stack + `TripDraftProvider` + `StepIndicator` + step routing (skip friends at 0), leave confirmation (D19); step screens are empty placeholders with "Dalej" — skill: frontend-design — tests first: Step 5 — verify: as above + web preview walk-through.
- [x] 6. [frontend] Screen 1 — flights (outbound/return segments, airport search, date/time, layover labels, disabled ticket button, companions stepper, validation) — skill: frontend-design, ui-taste — tests first: Step 6 — verify: as above + preview screenshot light/dark.
- [x] 7. [frontend] Screen 2 — friends (N cards, name, grouped interest chips) — skill: frontend-design, ui-taste — tests first: Step 7 — verify: as above + screenshot.
- [x] 8. [frontend] Screen 3 — budget (amount + currency, default from destination) — skill: frontend-design, ui-taste — tests first: Step 8 — verify: as above + screenshot.
- [x] 9. [frontend] Screen 4 — summary + save → `/` — skill: frontend-design, ui-taste — tests first: Step 9 — verify: as above + screenshot.
- [x] 10. [frontend] Trips screen: loading / empty / error / list with `TripCard`, soonest first — skill: frontend-design, ui-taste — tests first: Step 10 — verify: as above + screenshot + manual test steps for Kacper.
- [x] 11. Docs: update CLAUDE.md "Data structures" (A4) and `Architecture.md` — no tests (docs only) — verify: every statement checked against the code.

## Manual test steps for Kacper (device; pl + en; light + dark)
1. Empty → "Utwórz podróż" opens "Krok 1 z 3/4".
2. Leave confirmation (D19): nothing typed → back leaves at once; after typing, back / iOS edge swipe / Android hardware back ask "Odrzucić wpisane dane?" — "Zostań" keeps, "Odrzuć" leaves.
3. Airports: "barc", "BCN", "krakow", "lon" — list under the field, not hidden by the keyboard.
4. Pickers — iOS: wheel under the field with a suggested value; a Bangkok flight at 02:30 on 29 Mar entered on a phone set to Warsaw still shows 02:30 in the summary. Android: date then time dialog; 12h vs 24h phone setting (D30); phone in a US time zone — the date must not move back a day.
5. Layovers: WAW→DXB→BKK shows "9 godz. przesiadki w DXB"; "Usuń" removes; return suggests BKK→WAW.
6. Validation: "Dalej" with empty fields scrolls to the first error; VoiceOver/TalkBack says "Popraw zaznaczone pola".
7. Keyboard never covers the focused field or "Dalej"; numeric keyboard on the amount; "3000,50" accepted in Polish.
8. Friends: 0 → budget is step 2 of 3; 3 → three cards; chips toggle with a check; back, change to 2 → first two kept.
9. Budget: BKK → THB; pick PLN, go back, change destination → PLN stays; totals and "~… dziennie na osobę" update.
10. Summary: each "Zmień" returns to its step with data kept; "Utwórz podróż" shows loading, then "Twoje podróże" without a dialog.
11. Trips list: soonest under "Najbliższa podróż", rest under "Później"; card shows city, dates, people, budget; tap does nothing (expected); a 28 Dec–3 Jan trip shows both years; restarting the app empties the list (D1).
12. Largest Dynamic Type / font size: text wraps, nothing clipped; chips/buttons grow; the list scrolls; "Utwórz podróż" stays visible.
13. VoiceOver / TalkBack: order title → section header → card → button; heading rotor jumps between sections and cities; step indicator read once; stepper adjustable; chips read as checkboxes; "Zmień: Bangkok" read in full; loading read as "Wczytywanie podróży".
14. Light/dark: card shadows (light only) not clipped at the list edges; input borders; chips; selected currency segment (subtle in dark); amber layover label readable.

## Verification
Per step: tests written first and seen failing for the expected reason → minimum code → `pnpm test` (full suite), `pnpm typecheck`, `pnpm lint` all green → `verifier` subagent PASS (with `ui-taste` review for screens) → step marked `[x]` with the progress log entry. Screens (5–10): walk-through in the Expo web preview with screenshots in light and dark, plus short manual test steps for Kacper on a device (date picker, keyboard, Dynamic Type). No schema parity / RLS checks: no migrations in this task.

## Progress log
- **Step 1 — done (2026-10-04).** Tests written first (red ✓: modules missing) → green ✓. Files: `src/schemas/{common,interests,airport,flight,member,trip,create-trip-form,index}.ts`, tests `src/schemas/__tests__/{common,interests,entities,create-trip-form}.test.ts`; `src/lib/time.ts` + test; `GLOSSARY.md`. Full suite 136/136, typecheck 0 errors, lint clean. Verifier: PASS (minor issues, all handled below). Skill used: domain-modeling (→ `GLOSSARY.md`: organizer, friend, companion count, traveller, member, interest, destination, budget per person, base currency, flight segment, outbound/return, layover).
  - Deviation: `src/lib/time.ts` (`zonedLocalToDate`, `localToIso`, `todayIn`) moved from step 3 into step 1 — the wizard's cross-segment rules compare airport-local times across time zones. `localToIso` is used by step 4.
  - Deviation: `XSchema` naming, `companionCount`, `departTz`/`arriveTz` on `SegmentInputSchema` (see Data structures note).
  - Deviation: `GLOSSARY.md` created by the domain-modeling skill (not in the Files list).
  - Decision (interpretation of D15): "today" is the calendar date **at the departure airport**, not on the device — otherwise an organizer in Warsaw after midnight could not enter a New York flight leaving that same evening. Test added first (red ✓ → green ✓).
  - Verifier fixes: removed untested upper-casing of the flight number (UI will use `autoCapitalize`); removed unused `localDate`.
  - Wizard validation messages are i18n keys (`validation.*`); they are added to `pl.json`/`en.json` in steps 6–9. Cross-field checks run only when all fields parsed (`superRefine(..., { when })`).
- **Step 2 — done (2026-10-04).** Verifier: FAIL → fixed → PASS. Full suite 154/154, typecheck 0, lint clean. Test `src/data/__tests__/airports.test.ts` written first (red ✓: module missing). Files: `scripts/build-airports.mjs` (dev-only generator), `src/data/airports.json` (3153 airports, ~429 KB — plan estimated ~300 KB), `src/data/airports.ts`. Skill used: none.
  - First verifier run: FAIL — mwgg IATA fallback matched reused codes in other countries (AVR India got Europe/Lisbon), some mwgg zones were across a border (MLN → Africa/Casablanca, ARI → America/Lima), NFD folding missed ł/ø/ß (Łódź → "Lodz"), odd mwgg cities (EZE "Ezeiza"), first-listed currency wrong for SV/PA/BT. Fix: tests for the bad rows added first (red ✓, 9 failing) → mwgg rows trusted only in the same country; zones checked against the system `zone.tab` (single-zone countries corrected automatically, 12 hand-checked `TIMEZONE_OVERRIDES`); `fold` maps extra letters; ~90 reviewed `CITY_OVERRIDES` for large airports; `CURRENCY_OVERRIDES` TR, XK, SV, PA, BT → green ✓ (154/154).
  - **D17 (Kacper, 2026-10-04) — city names:** keep the merge rule (mwgg's served city, OurAirports spelling when they agree) + hand overrides for large airports. Small airports may keep imperfect names; the trip can be renamed later.
  - **D18 (Kacper, 2026-10-04) — no runtime parsing of the airport list:** `AIRPORTS` is a typed export of the static JSON; every row is validated with `AirportSchema` in the test instead (avoids parsing ~3,150 rows with time-zone checks at startup). Deviation from the plan's "Zod-parsed export", approved.
  - Note: the generator reads `/usr/share/zoneinfo/zone.tab`, so it runs on macOS/Linux only and its output follows that machine's tz data (dev tool).
  - After PASS: weak test rows tightened (AVR, SAL had empty city / any time zone); PTY test written first (red ✓, "Tocumen") → override `Panama City` → green ✓.
  - Known gaps (accepted under D17): 91 airports dropped for no time zone or no city — mostly small, many in China (CN has 2 zones in zone.tab, so an unmatched Chinese airport cannot be resolved); the only large one is Xigazê. Some small airports keep odd city names (e.g. PKY, NLI, BTI).
- **Step 3 — done (2026-10-04).** Verifier: FAIL → fixed → PASS. Full suite 208/208, typecheck 0, lint clean. Tests first (red ✓: modules missing). Files: `src/lib/{layovers,trip-dates,airport-search,money,text}.ts` + tests; `duration.*` keys in `pl.json`/`en.json`. Skill used: none.
  - First verifier run: FAIL — `currencyMinorDigits` used the runtime's Intl digits, which differ from ISO 4217 (ICU: HUF/IDR/COP 0, IQD 0) and between engines, so stored minor units would depend on the device. Fix: static ISO 4217 exponent table (CLAUDE.md already requires ISO 4217 minor units). Tests first (red ✓) → green ✓.
  - Test-after (characterisation, passed immediately; code was already correct): DST layover (Lisbon), `'0'` → 0, en `'12,50'` → null, pl `'3.000'` → null.
  - Deviation: `getLayovers` returns `{ airportIata, minutes }` (plan said `airport`).
  - Choices: `formatMoney` joins amount and code with a no-break space and shows minor units only when non-zero (`120 PLN`, `120,50 PLN`); pl `Intl` does not group 4-digit numbers, so the trip card will read `Budżet: 3000 EUR / os.` (step 10 test follows Intl, design-context §4.3). `parseAmountToMinor` in pl also accepts `.` as the decimal separator.
  - Plan wording alignment: step 6 pl layover label is `9 godz. przesiadki w DXB` (from `formatDuration`), en `9h layover in DXB`.
- **Step 4 — done (2026-10-04).** Tests first (red ✓: modules missing; layout test red with "useTripRepository must be used inside AppProviders") → green ✓. Full suite 223/223, typecheck 0, lint clean. Verifier: PASS. Skill used: none.
  - Files: `src/data/trip-repository.ts` (`TripRepository`, `buildTrip`, `createInMemoryTripRepository`, `LOCAL_OWNER_ID`), `src/providers/AppProviders.tsx`, `src/hooks/useTrips.ts`, `src/app/_layout.tsx` (wrapped in `AppProviders`), `src/test/fixtures.ts`; tests `src/data/__tests__/trip-repository.test.ts`, `src/hooks/__tests__/useTrips.test.tsx`, new case in `src/__tests__/app/layout.test.tsx`. Added `expo-crypto ~57.0.3` (D16).
  - Deviations: one `AppProviders` (query client + repository context) instead of `QueryProvider.tsx`; shared test fixture `src/test/fixtures.ts`; hook test file named `useTrips.test.tsx`.
  - Verifier notes carried forward: `mutationFn` now wraps `repository.create` (safe for a class-based Supabase repo later); step 9 screen tests must pin the clock (fixture departs 2026-11-02, D15) and mock `expo-crypto` `randomUUID` with a valid v4 UUID (jest-expo returns undefined); step 10 must decide query retry for the error state (default 3 retries ≈ 7 s).
- **Step 3a — done (2026-10-04).** D20. Tests first (red ✓, 4 failing: schema requires `large`, dataset flag, search order, real-data "lon") → `AirportSchema.large`, generator writes `large`, `searchAirports` sorts rank → large first (stable) → green ✓. Full suite 228/228, typecheck 0, lint clean. Verifier: FAIL (procedural: acceptance criterion changed) → Kacper approved D21 → PASS. Skill used: none.
  - Test fix 1 (test was wrong): it assumed LCJ is not large, but OurAirports lists Łódź as `large_airport` (~1,150 large airports) → asserts SZY (Olsztyn-Mazury) is not large.
  - Test fix 2 (criterion changed, D21): "lon" → London first is impossible (LGB); now LGW+LHR in the top 5, BCN in the top 4 for "bar", Paris first for "par". Before D20: LHR 7th, BCN 7th.
- **Step 5 — done (2026-10-04).** Verifier: FAIL → fixed → PASS. Full suite 250/250, typecheck 0, lint clean. Tests first (red ✓: modules missing) → green ✓. Skill used: frontend-design (no visual rules beyond D22/D23).
  - Files: `src/features/trip-create/{steps,draft,confirm-discard}.ts`, `TripDraftContext.tsx`, `WizardScreen.tsx` (frame + `useGoToNextStep`), `src/components/StepIndicator.tsx`, `src/app/trips/new/{_layout,index,friends,budget,summary}.tsx`; root layout hides its header for `trips/new`; i18n `newTrip.step/next/back/discard.*`. Removed `src/app/trips/new.tsx` and its test (assertions moved, see below).
  - **Deviation — routes:** `trips/new/index.tsx` *is* the flights step (no `flights.tsx`, no redirect); `/trips/new` keeps working from the Trips screen. Step 6 tests go to `src/__tests__/app/trips/new/flights.test.tsx` but render the `index` route.
  - Step 1 of a nested stack has no native back button → `headerLeft` `HeaderBackButton` labelled "Twoje podróże" (trips-empty-state D7) calling `router.back()`; later steps use the native back with `headerBackTitle` "Wstecz". Header buttons render in Jest but `press` does not reach `router.back`, so tests drive leaving with `router.back()`; checked by hand in the web preview (step 1 ⇄ step 2 ⇄ trips list, no console errors; light + dark).
  - Leave guard: `usePreventRemove` (`expo-router/react-navigation`, no new dependency) in the wizard layout → guards removal of the whole `trips/new` route. `isDirty` = any draft change (even changing a value back counts) — fine under D19.
  - First verifier run: FAIL — moving the old `/trips/new` test dropped two assertions (English title, D7 back-button label). Restored (they pass), plus a new "Wstecz" back-title assertion. Also fixed: `TripDraft` now derived from `z.input` of the step schemas; step-indicator text hidden from screen readers so the label is read once (test first, red ✓); comment reference to the right D7; test hygiene (`confirm-discard` restores globals; root layout test maps the wizard route — no more "extraneous route" warning).
  - Manual check for Kacper later: on web, browser back/forward may bypass the leave confirmation.
- **Step 6 — done (2026-10-04).** Verifier (with ui-taste): FAIL → fixed → PASS; suite green under WIB, Europe/Warsaw, America/Los_Angeles, Asia/Kolkata. Skills: frontend-design (build), ui-taste (verifier review). Tests first in three parts, each red ✓ (modules missing / placeholder screen) → green ✓. Full suite 309/309, typecheck 0, lint clean.
  - Part A: theme roles `input.border` (D26), `action.link` (D28), `elevation.card` (§6.1; none in dark); `src/lib/date-time.ts` (`formatLocalDateTime`, `dateToLocal`, `localToDate`); `draft.ts` `addLayover`, `withOutbound` (D25); `field-errors.ts`.
  - Part B: components `Field` (label/error frame + `inputBorder`/`inputBoxStyle`/`inputTextStyle`), `TextField`, `AirportField`, `DateTimeField` (`.tsx` iOS wheel, `.android.tsx` date→time dialogs, `.web.tsx` browser input; shared `DateTimeFieldBase`), `IconButton`, `Stepper` (one adjustable element for screen readers), `TextButton` (secondary/ghost), `LayoverLabel`.
  - Part C: `src/features/trip-create/SegmentCard.tsx`, flights screen in `src/app/trips/new/index.tsx`; test `src/__tests__/app/trips/new/flights.test.tsx` (11 cases). i18n `newTrip.flights.*`, `validation.*`, `common.*`, `airportField.*`, `dateTimeField.*`, `layover`.
  - Shell tests (step 5) now use a stand-in step-1 screen (`ShellFlights`): the real flights form validates before "Next", which is covered by `flights.test.tsx`; routing assertions unchanged.
  - Web preview check (mobile, light + dark): airport search, D25 return suggestion (BKK→WAW), errors under fields, valid form → budget step, draft kept on header back, no console errors. Found and fixed (test first): the browser's own focus outline drew over the 2dp focus border.
  - Choices to note: the iOS wheel takes its start value when an empty field is opened (the wheel always shows a value); `IconButton` pressed background uses `radius.md` (§10.2 gives no radius); airport list rows 64dp (§10.8); city names come from the dataset in English (e.g. "Warsaw") — localized names are not available.
  - First verifier run: FAIL. (1) Blocker: pickers converted the wall clock through the device time zone — the suite failed with `TZ=Europe/Warsaw` and a Bangkok flight at 02:30 on 29 Mar entered on a Polish phone would have been saved as 03:30. (2) Android date dialog returns UTC midnight; reading it in device time moved dates a day back west of UTC. Fix (tests first, red ✓; the date-time tests switch `process.env.TZ` to Warsaw / Los Angeles / Jakarta / UTC): iOS picker shown with `timeZoneName="UTC"` + UTC helpers; Android date read in UTC, time dialog given the wall clock on 1 Jan 2000. Full suite also run with `TZ=Europe/Warsaw` and `TZ=America/Los_Angeles` — green. (3) Errors now in `accessibilityHint` (VoiceOver). (5) Segment cards have stable keys (`SegmentDraft.key`, stripped by the schema) — half-typed text no longer jumps cards. (6) Error assertions scoped to their card. All test first (red ✓).
  - D29 (scroll to first errored card + announce), D30 (Android 12/24h from `expo-localization` `getCalendars()`), D31 (iOS prefill confirmed) implemented test first (red ✓). Scrolling targets the card containing the first error (card top), not the exact field.
- **Step 7 — done (2026-10-04).** Verifier (with ui-taste): FAIL → fixed → PASS; 324/324 (also TZ=Europe/Warsaw). Skills: frontend-design (build), ui-taste (verifier review). Tests first (red ✓: `Chip` missing, friends screen was a placeholder) → green ✓. Full suite 322/322, typecheck 0, lint clean.
  - Files: `src/components/{Chip,Card}.tsx`, `src/features/trip-create/FriendCard.tsx`, `src/app/trips/new/friends.tsx`; `SegmentCard` now uses the shared `Card`; i18n `newTrip.friends.*`, `interests.*`, `interestGroups.*`, `validation.nameRequired/nameTooLong`. Tests: `src/components/__tests__/Chip.test.tsx`, `src/__tests__/app/trips/new/friends.test.tsx` (6 cases).
  - Chip is 36dp tall (§10.6) but gets `hitSlop` 4/4 for a 44dp touch target (Design principles); check icon is hidden from screen readers (the checkbox state is announced).
  - Failed "Next" on friends also announces and scrolls to the first friend with an error — same behaviour as D29, for consistency.
  - Shell test (`layout.test.tsx`) uses a stand-in for step 2 too (the real form validates; covered by `friends.test.tsx`).
  - Web preview (mobile, light + dark): 2 friend cards, 6 groups, chip selection, step 2 of 4; no console errors after a fresh load (one key warning came from a draft kept by hot reload from before segment keys existed).
  - First verifier run: FAIL — chip had a fixed `height: 36` (text clipped at large Dynamic Type, long labels could not wrap; §4.4) and my test asserted it (test was wrong → changed to `minHeight: 36`, plus a new test for wrapping; red ✓ → green ✓). Also fixed: `hitSlop` derived from `size.touchTarget`; `aria-checked` so react-native-web exposes the state (checked in the preview: false → true); heading + hint grouped with an 8dp gap instead of a negative margin; `validation.nameTooLong` interpolates `DISPLAY_NAME_MAX_LENGTH` (new screen test, red ✓). Not changed (noted): group names are plain text, not headers; card `onChange` builds from props (two updates in one JS tick could drop one — not reachable by taps).
- **Step 8 — done (2026-10-04).** Verifier (with ui-taste): FAIL → fixed → PASS; 352/352 (also TZ=Europe/Warsaw). Skills: frontend-design (build), ui-taste (verifier review). Tests first (red ✓: modules missing / placeholder screen) → green ✓. Full suite 342/342 (also TZ=America/Los_Angeles), typecheck 0, lint clean.
  - Files: `src/lib/trip-days.ts` (`tripDayCount` inclusive, `perPersonPerDay` rounded to whole units), `src/components/{SegmentedControl,AmountField}.tsx`, `src/app/trips/new/budget.tsx`; token `radius.segmented` (10, §10.14); i18n `newTrip.budget.*`, `validation.amountRequired/amountInvalid/amountPositive`. Tests: `trip-days`, `SegmentedControl`, `AmountField`, `src/__tests__/app/trips/new/budget.test.tsx` (8 cases); shell test got a stand-in for step 3.
  - The draft stores the typed text + currency; the screen parses it with `parseAmountToMinor` and validates with `BudgetStepInputSchema`. Unparsable text is flagged while typing (§10.5); empty after "Next"; zero immediately.
  - Web preview (mobile, light + dark): THB preselected for BKK, THB · PLN · EUR · USD, "Total for 3 people: 9,000 THB", "~231 THB per person per day"; no console errors during a fresh full run. Found and fixed (test first): on web the amount `input` did not shrink and pushed the currency code out of the field (`minWidth: 0`).
  - Note: in dark mode the selected segment (`surface.default` on `surface.secondary`, §10.14) is a subtle background change; the selected label is `text.primary` vs `text.secondary`.
  - First verifier run: FAIL — the screen wrote the destination's currency into the draft on open, so after going back and changing the destination the old currency stayed (no option selected, trip savable in THB for Barcelona). Fix per D36 (test first, red ✓): only a tapped currency is stored; `budgetCurrencyOptions` / `budgetCurrency` in `draft.ts` derive the shown one (reused by the summary). Also: D37 solo copy; whole-number hint for 0-digit currencies (`validation.amountInvalidWhole`); tests now press "Next" with empty / 0 / unparsable and assert the announcement; `AmountField` test imports i18n (no warning).
- **Step 9 — done (2026-10-04).** Verifier (with ui-taste): FAIL → fixed → PASS; 372/372 (also TZ=Europe/Warsaw). Skills: frontend-design (build), ui-taste (verifier review). Tests first (red ✓: missing helpers / placeholder) → green ✓. Full suite 367/367 (also TZ=Europe/Warsaw), typecheck 0, lint clean.
  - Files: `src/app/trips/new/summary.tsx`; `src/lib/date-time.ts` (`formatLocalShort`, `formatDateRange`), `src/lib/airport-search.ts` (`destinationName`, now also used by `buildTrip`), `src/features/trip-create/draft.ts` (`toCreateTripInput`), `TripDraftContext` (`isComplete`/`complete`), wizard layout guard skips after saving, `WizardScreen` action gets `icon` + `error`; i18n `newTrip.summary.*` (Polish plural forms `_one/_few/_many/_other` in both files for key parity). Tests: date-time, airport-search, draft, `src/__tests__/app/trips/new/summary.test.tsx` (10 cases incl. save, save failure, "Zmień" per card, solo, incomplete draft).
  - Saving: `useCreateTrip().mutate(toCreateTripInput(draft))` → on success `complete()`; an effect then calls `router.dismissTo('/')`, so the leave guard sees the saved state and does not ask (D38). "Zmień" uses `router.dismissTo(stepRoute(step))`; travellers → flights when alone.
  - An incomplete draft (e.g. `/trips/new/summary` opened by URL on web) redirects to step 1 instead of crashing (found by the shell test; test first).
  - Date range is "3 lis – 15 lis 2026" (two formatted dates; `Intl.formatRange` avoided for Hermes support).
  - Shell/budget tests use stand-ins for the summary (the real one needs a complete draft).
  - Web preview (mobile, light): full flow WAW→DXB→BKK, 2 friends, 3000 THB → summary as in D38 → "Create trip" → back at `/`, `window.confirm` never called, no console errors. The trips list itself is step 10.
  - First verifier run: FAIL — missing planned loading test; save error not announced on iOS (live region is Android-only); summary budget line "Razem 9000 THB · ~231 THB dziennie" read as a group figure. Fixes (tests first, red ✓): loading test (save held until released; spinner, busy, disabled); failure test also checks the content stays and the announcement; copy now "… ~231 THB dziennie na osobę" (D35 wording; confirmed by Kacper as D40); only the amount is Numeric L ("3000 THB" + "na osobę" in body text); "Zmień" buttons read "Zmień: Bangkok / Podróżni · 3 osoby / Budżet" for screen readers (`TextButton.accessibilityLabel`); extra space above "Lot tam"/"Powrót"; hours without a leading zero ("6:30", "6:30 AM"); tests for "5 osób", English, and `toCreateTripInput` → 0 on an unparsable amount; summary reuses `toCreateTripInput` for the amount. Left as is: card titles (city Heading 3 per D38, the other two Body M Medium).
- **Step 10 — done (2026-10-04).** Verifier (with ui-taste): FAIL → fixed → PASS; 382/382 (also TZ=Europe/Warsaw). Skills: frontend-design (build), ui-taste (verifier review). Tests first (red ✓: `TripCard` missing, screen had no states) → green ✓. Full suite 381/381 before the verifier fixes, typecheck 0, lint clean.
  - Files: `src/components/{TripCard,TripCardSkeleton}.tsx`, `src/app/index.tsx` (loading / error with retry / empty / list in a `ScrollView`, sections "Najbliższa podróż" + "Później"), i18n `trips.*` (plural forms). Tests: `src/components/__tests__/TripCard.test.tsx`, `src/__tests__/app/trips-list.test.tsx` (mocked repository: loading, sections, single trip, error → retry); `src/__tests__/app/index.test.tsx` helper now waits for loading to finish (assertions unchanged).
  - Query retry stays at TanStack's default (3 retries) — the error state appears after the retries; the test advances timers.
  - Web preview (mobile, light + dark): created Barcelona (solo, Jan 2027) then Bangkok (3 people, Nov 2026) via the wizard → list shows Bangkok under "Next trip", Barcelona under "Later", correct people and budget lines; no console errors.
  - First verifier run: FAIL — loading container was not an accessibility element on iOS (label/busy never read); the list test fixture gave every trip the same id (duplicate React keys). Fixes (tests first, red ✓): `accessible` loading container; unique fixture UUIDs; wizard route mapped in the list test (no "extraneous route" warning); load error announced; date range shows both years across New Year ("28 gru 2026 – 3 sty 2027"); skeleton reuses `Card` (same shadow/geometry); budget line read as "… na osobę" by screen readers (`trips.budgetA11y`).
  - Web-only caveat: TanStack's default `networkMode: 'online'` would pause the query (skeletons forever) if the browser reports offline; native is unaffected (no NetInfo wired to `onlineManager`).
- **Step 11 — done (2026-10-04).** No tests (docs only). `CLAUDE.md` → Data structures: `Trip.budgetPerPerson` (replaces `dailyBudget`, daily budget derived), optional `TripMember.budgetLevel`/`pace`, `Airport`, note on `src/schemas/` and `XSchema` naming. `Architecture.md` rewritten for the current state (modules, data model, data flow, routes, components, tokens, testing, dependencies, external sources, key decisions, known limitations, changelog), checked against the file tree. Full suite 382/382, typecheck 0, lint clean. First verifier run: FAIL (CLAUDE.md data comment still said "guest" — now "friend", like the schema; airport size ~470 KB after the `large` flag; removed the stale iCloud line; root layout row updated) → fixed. Product wording "guests" in CLAUDE.md (What you're building, Core features) left for Kacper to decide.

## Risks & open questions
**Need Kacper's answer (can be answered together with approval):**
- **Q9 — Max companions.** Proposal: up to 19 (group of 20). Other number?
- **Q10 — Interests required?** Proposal: a friend can have 0 interests (can be filled in later). Or at least 1?
- **Q11 — UUIDs.** Ids need UUIDs; React Native has no reliable `crypto.randomUUID`. Proposal: add `expo-crypto` (`npx expo install expo-crypto`) — also needed later for client-generated expense ids. Alternative: a small hand-written v4 generator on `Math.random` (not cryptographically strong; fine for in-memory, not for offline expenses).
- **Q12 — Downloading the airport sources** (dev-time only, output committed as JSON, nothing downloaded by the app):
  - OurAirports `airports.csv` (public domain, ~12 MB) — airport type, scheduled service, IATA, city, country
  - mwgg/Airports `airports.json` (MIT, ~8 MB) — IANA timezone per airport
  - datasets/country-codes `country-codes.csv` (PDDL, ~150 KB) — country → ISO 4217 currency
  Expected output ~3,000 airports, ~300 KB JSON in the app bundle. OK to download and bundle?
- **Q13 — Trip card avatars.** Design-context §10.9 puts member avatars on the card. The organizer has no name/profile yet (A2), so the card shows "4 osoby" with a `Users` icon instead; avatars come with the organizer profile. OK?

**Risks**
- Rare open-jaw trip crossing the date line west-bound could make the return's local departure date earlier than the outbound's local arrival date: the budget's per-day figure would divide by ≤0 days and `TripSchema` (end ≥ start) would reject the save. Not handled in this task.
- Device checks still needed for pickers (tests mock them): iOS wheel shown in UTC displays the airport wall clock as entered; Android date→time dialogs on a phone set to a US time zone; Polish Android in 12h vs 24h mode.
- Web: the date input's error is not tied with `aria-describedby` (web is a preview target).
- Airport search has no airport-size signal: `lon` lists Longview before Heathrow, `bar` lists BCN 7th. Raise with Kacper (option: add a `large` flag to the dataset and rank large airports first).
- `GLOSSARY.md` says "friend" (avoid "guest" in UI copy); CLAUDE.md's data comment now says "friend", but its product description still says "guests" — Kacper to decide.
- `isTimeZone` accepts any zone `Intl` accepts (incl. wrong letter case); Hermes ICU data may differ from Node's.
- `Intl` time-zone support on Hermes (for local time → offset): Hermes uses platform ICU; must be checked on a device in step 3's manual test. Fallback would be a date library (new dependency → ask).
- `@expo/ui` date-time picker behaviour differs between iOS, Android and web; tests mock it, so device check is manual.
- Agent definitions (`.claude/agents/Backend.md`, `Frontend.md`) assume `packages/schemas` / `apps/mobile`; briefs will name the real paths (A1).
- Data is lost on app restart until Supabase (D1) — expected, not a bug.
