# Task: Profile screen (header, photo, nick, travel stats card) + Settings with sign-out
Status: in progress — revision 2 approved by Kacper 2026-10-20. Revision 1 was approved earlier the same day; Kacper then sent a
second reference screenshot and changed the layout and the stats. Nothing was built under revision 1 (only the baseline check).

## Understanding & assumptions
The "Profil" pill screen (`/profile`, today an empty placeholder from `prompts/profile-tab/`) becomes the user's profile, mixing
two reference screenshots from Kacper (2026-10-20):

- **Header:** "Profil" on the left, a gear icon button on the right (`justify-content: space-between`).
- **Profile row:** the round profile photo on the left, the nick on its right.
- **Stats card** below (like "Activities" in the second screenshot) with five numbers of the user's **past** trips:
  **Podróże**, **Kraje**, **Dni w podróży**, **Loty**, **Przelecone km**.
- **The gear** opens a new **Settings** screen with one button, **"Wyloguj się"**, which asks for confirmation first.

"Done" means: the profile screen shows the photo (or the placeholder), the nick and the five numbers, also offline; the gear
opens Settings; "Wyloguj się" → confirm → the welcome screen with the phone's user data cleared; full suite, typecheck and lint
green; device run PASS.

### Decisions (Kacper, 2026-10-20)
- **D1 — Name:** the **nick** (`profile.username`). No new "first name" field.
- **D2 — Stats:** past trips, countries, days travelled, flights, km flown (revision 2). Followers / following are not shown.
- **D3 — Gear:** opens a new **Settings** screen with "Wyloguj się" (closes the idea auth-onboarding D8).
- **D4 — Left out:** "Edytuj profil", "Udostępnij profil", the "Requests" / rating row, the notifications screen
  (Kudos / Comments — no friends or comments exist; a social feed is out of scope).
- **D5 — Sign-out confirm:** a `ConfirmDialog` "Wylogować się?". With unsent budget changes the message also warns that they
  will be lost. Sign-out is not blocked by them.
- **D6 — Header title:** "Profil" / "Profile" (the existing `nav.profile` text). `nav.profileTitle` becomes unused and is removed.
- **D7 — What counts:** every trip on the side panel's list (own, and once friend-invite lands, the ones the user was added to)
  that is **past** by the side panel's rule: `endDate < today` (phone's date, `tripSections`). An ongoing trip does not count yet.
- **D8 — Sign-out offline:** the button is disabled offline and shows "Połącz się z internetem, żeby się wylogować." /
  "Connect to the internet to sign out.", like sign-in.
- **D9 — Loading = pulsing skeleton:** while the trip list loads, each stat value is a skeleton block with the value's geometry
  that pulses in **opacity** 1 → 0.5 → 1 (`opacity.skeletonPulseMin: 0.5`), one cycle 1200 ms (§10.18), ease in-out; never
  scale (§9.4). Reduced motion on → static. Colors §10.18 (light `neutral.100`, dark `surface.secondary`). Only this new skeleton
  pulses; the existing static skeletons stay as they are.
- **D10 — Layout (revision 2):** "mixed": header and photo + nick as in the first screenshot, the stats card below.
- **D11 — Offline stats (extends the offline scope):** the stats work offline. The side panel's trip list, already copied to
  SQLite (trips-drawer D3), also carries each trip's **destination** and its **flight routes** (from → to of every segment).
- **D12 — Km:** great-circle distance between the two airports of each segment, summed over the past trips, rounded to whole km
  at the end. The bundled airport list gains coordinates; Kacper agreed to re-run `scripts/build-airports.mjs`, which downloads
  the public sources (OurAirports, mwgg/Airports, country-codes) at dev time.
- **D13 — Days and flights:** days are counted **inclusive** (10–12 Oct = 3 days, the existing `tripDayCount`); every
  **segment** is one flight (WAW→FRA→LIS = 2 flights).
- **D14 — App background gradient:** Kacper wants a gradient (his light and dark colors) as the background of the **whole app**.
  That is a separate feature with its own plan (`prompts/app-background-gradient/`), not part of this one. See Q3.
- **D15 — Data layer belongs to backend (2026-10-20, after the step 4 review):** `.claude/agents/backend.md` and the CLAUDE.md
  agent table now let the backend agent edit `src/data/`, `src/lib/`, `src/providers/`, `src/test/` (as steps 2–4 did).
- **D16 — Sign-out error (2026-10-20, from the auth-js source, step 4):** with `scope: 'local'` auth-js removes the session on
  the phone (and fires `SIGNED_OUT`) even when the server request fails, then returns the error. So Settings shows **no error**
  after a rejected sign-out: the gate moves to the welcome screen as on success. In the rare case the session stays (the stored
  session could not be read), the button is enabled again and the user can retry.

- **D17 — Settings back button 44 dp (2026-10-21, after the step 7 device run):** the header back control on Settings gets a
  touch area of at least 44 dp (design-context §5.2); its look stays the same.
- **D18 — Photo reloads on reconnect (2026-10-21):** when the profile photo failed to load (offline) and the phone comes back
  online, the photo is tried again right away, without restarting the app (extends A3).
- **D19 — Extra device checks (2026-10-21):** a test trip so the non-zero stats can be checked on the device, and a separate
  device test of the pulsing skeleton and its static reduced-motion version. The test trip is a **past** trip; Kacper adds it
  himself in the app. Steps 6b, 6c approved by Kacper 2026-10-21.
- **D20 — Photo skeleton (2026-10-21, after the D18 device FAIL; changes A3):** when the user **has** a photo (`avatarId` set)
  but it is not shown yet — loading, no signed url (offline start), or it failed — the photo's place is a round 96 dp pulsing
  skeleton (the same `SkeletonBlock` as D9, static with reduced motion). It **keeps pulsing the whole time** until the photo
  loads, offline too (Kacper chose this over a static skeleton offline). The photo is tried again when the phone is back online
  (6c, 6d). A user **without** a photo (`avatarId` null) keeps the person placeholder (A3).
- **D21 — A shown photo stays (2026-10-21, Q4):** when the photo is already on screen and a re-signed url of the same photo
  fails to load, the photo already shown stays (no skeleton); it is tried again on the next offline → online change.
- **D22 — Photo fades in (2026-10-21, Q5):** when the photo has loaded it replaces the skeleton with a short cross-fade of
  `duration.small` (180 ms, §9.1); with reduced motion on, at once.
- **D23 — A shown photo also stays without a url (2026-10-21, Q6):** when the photo is already on screen and a later profile
  read comes back **without** a url (server unreachable → the phone's copy; signing failed), the photo already shown stays, as
  in D21; it is tried again on the next offline → online change.
- **D24 — Dark skeleton colour (2026-10-22, after Kacper saw "nothing pulses"):** on the emulator the photo skeleton did pulse,
  but in dark mode the brightness changed by only ~7/255 (`surface.secondary` #202A23 on the background #111712, pulsing to
  0.5). The default skeleton colour in dark becomes the existing `border` token (#39443B); light stays `neutral.100`. Applies
  to every `SkeletonBlock` without an explicit `color` (profile photo, stats, trip hero); app-loading-skeleton D5 already uses
  `border` for blocks inside cards in dark. design-context §10.18 is updated in step 8.
- **D25 — App-loading chrome over the new skeleton (2026-10-22, during 6g):** `AppLoading.tsx` draws the menu button and the
  pill skeletons in `colors.border` over the hero skeleton; with D24 the hero is `border` too in dark, so they would vanish
  (caught by `AppLoading.test.tsx:112`). In dark they become `input.border` (#4A564C, existing token); light stays `border`.
  Kacper chose this as the fix inside step 6g.
- **D26 — Back button height on Android (2026-10-22, Kacper, after the 9.1 device FAIL):** on Android the Settings back
  button also gets `minHeight: size.touchTarget` (44 dp), no `minWidth` (6b showed a wider control pushes the title); iOS
  unchanged. Step 6i.
- **D27 — Light skeleton colour (2026-10-22, Kacper, Q9):** the light `colors.skeleton` becomes `border` (`neutral.200`
  #DDD5C7), mirroring D24; `AppLoading`'s chrome (menu button, pill skeletons) becomes `input.border` in light too (as D25 in
  dark), so it stays visible over the hero skeleton. Step 6j. design-context §10.18 updated in step 8.
- **D28 — 6f fade checked by unit tests only (2026-10-22, Kacper):** the 180 ms fade (D22) cannot be caught on the device with
  screenshots; the 6f unit tests are its evidence.

### Assumptions (please confirm — see Risks & open questions)
- A1. **Country of a trip** = the country of its `destination` airport (`Airport.countryCode`). A domestic trip counts the home
  country. An IATA missing from the bundled list counts as a trip, not as a country, and its segments add flights but no km.
- A2. **Other states:** when the list fails and the phone has no copy, every value shows "–" (no retry on the profile; the side
  panel has one). No past trips → every value is "0". **Approved exception to design-context §12** (error icon, explanation,
  retry): A2 was approved by Kacper with revision 2 (2026-10-20); recorded as an exception after the step 5 review.
- A3. **Photo:** the profile's signed `avatarUrl`; without a photo, or when it cannot load (offline), the same placeholder as on
  profile setup. Size `size.avatarSetup` (96 dp). Not tappable.
- A4. **Settings** sits in the root stack above the drawer (like `/trips/new`), route `/settings`, back button, title
  "Ustawienia"; no pill on it.
- A5. **Copy (pl / en):** card title "Twoje podróże" / "Your travels"; labels "Podróże" / "Trips", "Kraje" / "Countries",
  "Dni w podróży" / "Days travelled", "Loty" / "Flights", "Przelecone km" / "Km flown"; "Ustawienia" / "Settings",
  "Wyloguj się" / "Sign out", dialog "Wylogować się?" / "Sign out?", message "Wylogujesz się z tego telefonu." / "You will be
  signed out on this phone.", with unsent changes "… Niewysłane zmiany budżetu przepadną." / "… Unsent budget changes will be
  lost.", buttons "Wyloguj" / "Sign out" (destructive), "Anuluj" / "Cancel".
- A6. **Card layout:** a `Card` (existing component) with the title, then a 2-column grid: Podróże | Kraje, Dni w podróży | Loty,
  and Przelecone km full width. Each stat: a lucide icon (`Luggage`, `Globe`, `CalendarDays`, `Plane`, `Route`), the value in
  the numeric type style, the label below. Numbers use `Intl.NumberFormat` of the app language (`12 345 km`). At large Dynamic
  Type the grid becomes one column. Screen-reader label per stat: "<value> <label>".
- A7. **Sign-out scope:** this phone only (`signOut({ scope: 'local' })`).

## Approach
1. Airports get `latitude` / `longitude` from OurAirports (already the source of the list): change the build script, re-run it.
2. `TripListItemSchema` gains `destination` and `flights: FlightRoute[]`. `list()` selects `destination` and
   `flight_segments(from_iata, to_iata)` in the same query; no migration (both exist in the DB). The list copy in SQLite stores
   the whole parsed item, so it carries both at no extra cost (D11).
3. A pure `travelStats(trips, today, airports)` in `src/lib/` returns `{ trips, countries, days, flights, km }`, reusing the
   "past" rule of `tripSections` and `tripDayCount`.
4. `SessionSource.signOut()` → Supabase `auth.signOut({ scope: 'local' })`; the existing `signedOut` path in `SessionProvider`
   clears the phone's user data and shows the welcome screen (auth-onboarding D14). `TripRepository.hasUnsentChanges()` from the
   local store's `unsyncedBudgetChanges()`.
5. Frontend: profile screen with the stats card and the pulsing skeleton, Settings screen, hooks, i18n, tokens.

*Rejected:* a server function computing the stats — the airport data (country, coordinates) lives only in the app, and it would
not work offline (D11).

## Data structures (Zod)
```ts
// src/schemas/airport.ts — coordinates for the km stat (D12)
export const AirportSchema = z.object({
  ...unchanged,
  latitude: z.number().min(-90).max(90),    // NEW
  longitude: z.number().min(-180).max(180), // NEW
});

// src/schemas/flight.ts — just the route of a segment, for the trip list (D11)
export const FlightRouteSchema = z.object({ fromIata: IataCodeSchema, toIata: IataCodeSchema });
export type FlightRoute = z.infer<typeof FlightRouteSchema>;

// src/schemas/trip.ts
export const TripListItemSchema = z
  .object({
    id: tripShape.id,
    name: tripShape.name,
    destination: tripShape.destination,  // NEW
    flights: z.array(FlightRouteSchema), // NEW — every segment's route, any order
    coverImageUri: tripShape.coverImageUri,
    coverUrls: CoverUrlsSchema.optional(),
    startDate: tripShape.startDate,
    endDate: tripShape.endDate,
  })
  .superRefine(/* unchanged */);
```
`travelStats` returns `{ trips: number; countries: number; days: number; flights: number; km: number }`, a derived value inside
the app (not a boundary, not stored), so no schema. No change to `ProfileSchema`. No migration, no RLS change.

## Tests
Written first and seen failing for the expected reason.

**Step 1 (airport coordinates)**
- `src/schemas/__tests__/airport.test.ts`: valid with coordinates; invalid without them, with latitude 91 / longitude -181.
- `src/data/__tests__/airports.test.ts` (existing, checks every row against `AirportSchema`): fails red until the regenerated
  list has coordinates; plus spot checks: WAW ≈ 52.17 / 20.97, JFK ≈ 40.64 / -73.78.
- The re-run must change **only** the coordinates: a script-side check that compares the new list with the old one minus
  coordinates; any other difference (rows added / removed, renamed cities) stops the step and goes to Kacper (R4).

**Step 2 (`destination` + `flights` on the list)**
- `trip.test.ts`: an item with `destination` and `flights` parses; missing either, a bad IATA in a route → fails; `flights: []` ok.
- rows test: `listItemFromRow` maps `destination` and `flight_segments` → `flights`.
- `supabase-trip-repository.test.ts`: `list()` selects `destination, flight_segments(from_iata, to_iata)` and returns them.
- `local-store.test.ts`: the list copy keeps both; an **old copy without them** reads as no copy (`null`), not a crash.
- In-memory repository / fixtures updated so the existing suite stays green.

**Step 3 (`travelStats`)** — `src/lib/__tests__/travel-stats.test.ts`
- no trips → all 0;
- ended yesterday counts; ends today (ongoing) and future do not;
- countries: `BCN` + `MAD` → 1, `BCN` + `LIS` → 2;
- days: 10–12 Oct → 3; two trips add up;
- flights: WAW→FRA, FRA→LIS → 2;
- km: WAW→JFK ≈ 6 860 km (tolerance ±15 km); a route there and back doubles; summed then rounded once;
- an IATA not in the list: counts as a trip, a flight, no country, no km.

**Step 4 (sign-out + unsent changes)**
- `session-source.test.ts`: `signOut()` calls `auth.signOut({ scope: 'local' })`; an error is thrown to the caller.
- `Session.test.tsx`: after a sign-out the order holds: `clear:start`, `clear:done`, `state:signedOut`.
- repository / local store: `hasUnsentChanges()` false with no changes; true with `pending` or `failed`; false after sync.
- What `auth.signOut` does offline is checked in the `@supabase/auth-js` source first (cited in the log).

**Step 5 (profile screen)** — `src/__tests__/app/profile.test.tsx` (+ `tabs.test.tsx` updated)
- header "Profil" / "Profile", gear button labelled "Ustawienia" / "Settings" → navigates to `/settings`;
- nick shown; photo when `avatarUrl` is set, placeholder when not;
- with past + upcoming trips: the five values and labels match `travelStats`; numbers formatted per language (`12 345`);
- loading → five skeleton blocks, hidden from screen readers, one "loading" label for the card; failing with no copy → "–";
  empty list → "0";
- pulse: reduced motion off → the opacity animation runs with `duration.skeletonPulse`; on → none, opacity stays 1;
- each stat reads as one element "<value> <label>"; old placeholder text gone; dark theme uses dark tokens.

**Step 6 (settings + sign-out)** — `src/__tests__/app/settings.test.tsx`
- title "Ustawienia", back button, "Wyloguj się";
- dialog: short message; with unsent changes the warning message;
- "Anuluj" does nothing; "Wyloguj" signs out once (double tap → once);
- offline: button disabled, offline message shown (D8);
- sign-out rejects (D16) → no error shown; when the fake source emits `signedOut` the welcome screen shows; when it does not,
  the button is enabled again;
- success → welcome screen (through the fake session source); `/settings` not reachable signed out.

## Files
- Step 1: `scripts/build-airports.mjs`, `src/data/airports.json` (regenerated), `src/schemas/airport.ts`, their tests.
- Step 2: `src/schemas/flight.ts`, `src/schemas/trip.ts`, `src/data/trip-rows.ts`, `src/data/supabase-trip-repository.ts`,
  `src/data/local-store.ts` (only if needed), fakes / fixtures in `src/test/`, their tests.
- Step 3: `src/lib/travel-stats.ts` + test.
- Step 4: `src/data/session-source.ts`, `src/data/app-session-source.ts`, `src/providers/Session.tsx`,
  `src/data/trip-repository.ts`, `src/data/supabase-trip-repository.ts`, fakes, tests.
- Step 5: `src/app/(drawer)/(tabs)/profile.tsx`, `src/features/profile/ProfileScreen.tsx`, `src/features/profile/TravelStatsCard.tsx`,
  `src/components/SkeletonBlock.tsx`, `src/theme/tokens.ts` (`duration.skeletonPulse: 1200`, `opacity.skeletonPulseMin: 0.5`),
  `src/i18n/locales/pl.json`, `en.json`, tests.
- Step 6: `src/app/settings.tsx`, `src/app/_layout.tsx`, `src/features/profile/SettingsScreen.tsx`, `src/hooks/useSignOut.ts`,
  i18n, tests.
- Step 8: `Architecture.md`, `context/app-context.md`, `CLAUDE.md` (offline scope line: the list copy carries routes, D11),
  `context/design-context.md` (§10.18: the pulse values of D9), `GLOSSARY.md` if a term is added.

## Skills
- domain-modeling — steps 1, 2 — airport coordinates, the list item's new fields, "country of a trip".
- source-driven-development — steps 1, 2, 4 — OurAirports columns; PostgREST nested select; `auth.signOut` offline.
- doubt-driven-development — step 4 — sign-out deletes the phone's user data.
- test-driven-development — steps 1–6.
- frontend-design, frontend-ui-engineering — steps 5, 6.
- ui-taste — steps 5, 6 (verifier).

## Steps
- [x] 1. [backend] Airport coordinates: schema, build script, regenerated `airports.json` (only coordinates change). — skill: domain-modeling, source-driven-development, test-driven-development — tests first: step 1 — verify: red → green, full suite, typecheck, lint; verifier.
- [x] 2. [backend] `FlightRouteSchema`; `destination` + `flights` on `TripListItemSchema`, rows, `list()` select, list copy, fakes. — skill: domain-modeling, source-driven-development, test-driven-development — tests first: step 2 — verify: as above; verifier.
- [x] 3. [backend] `src/lib/travel-stats.ts`. — skill: test-driven-development — tests first: step 3 — verify: as above; verifier.
- [x] 4. [backend] `SessionSource.signOut()` + `useSession().signOut`, `TripRepository.hasUnsentChanges()`. — skill: source-driven-development, doubt-driven-development, test-driven-development — tests first: step 4 — verify: as above; verifier.
- [x] 5. [frontend] Profile screen: header + gear, photo, nick, stats card, pulsing skeleton + tokens, states, i18n; `nav.profileTitle` removed. — skill: frontend-design, frontend-ui-engineering, test-driven-development — tests first: step 5 — verify: as above; verifier + ui-taste.
- [x] 6. [frontend] Settings `/settings`, "Wyloguj się" + `ConfirmDialog` (D5), disabled offline (D8), hooks, i18n. — skill: frontend-ui-engineering, test-driven-development — tests first: step 6 — verify: as above; verifier + ui-taste.
- [x] 6b. [frontend] D17: Settings header back control ≥ 44 dp touch area, same look. — skill: frontend-ui-engineering, test-driven-development — tests first: settings.test.tsx asserts the back control's touch area (min width/height or hitSlop) ≥ the touch-target token and that it still calls `router.back()` — verify: full suite, typecheck, lint; verifier; device (tester).
- [x] 6c. [frontend] D18: `ProfilePhoto` retries a failed photo when the phone goes from offline to online. — skill: frontend-ui-engineering, test-driven-development — tests first: profile.test.tsx — photo fails → placeholder; going online → the `Image` is shown again with the same uri; staying offline → placeholder stays; a photo that fails again online → placeholder (no loop) — verify: full suite, typecheck, lint; verifier; device (tester, airplane on → off).
- [x] 6d. (approved by Kacper 2026-10-21) [frontend] D18 after an offline start: when the phone goes offline →
  online, the Profile screen refetches the own profile (fresh signed `avatarUrl`), so the photo appears without a relaunch; a
  failing refetch keeps the copy and never sends the app to the gate's error screen. — skill: frontend-ui-engineering,
  test-driven-development — tests first: profile.test.tsx — offline start with a copy without `avatarUrl` → placeholder; going
  online → `myProfile` called again and the `Image` shown with the new url; refetch rejects → placeholder stays, screen and gate
  unchanged; staying offline → no refetch — verify: full suite, typecheck, lint; verifier; device (scenario 9).
- [x] 6e. (approved by Kacper 2026-10-21) [frontend] D20: `ProfilePhoto` shows a round pulsing `SkeletonBlock`
  (`size.avatarSetup`, `radius.full`) instead of the person placeholder whenever `avatarId` is set and the photo is not shown yet
  (no url, loading until expo-image `onLoad`, or failed); the placeholder only for `avatarId` null. — skill:
  frontend-ui-engineering, test-driven-development — tests first: profile.test.tsx — `avatarId` set + no url (offline start) →
  skeleton, no placeholder; url set, before `load` → skeleton, after `load` → photo only; `error` → skeleton (not the placeholder);
  `avatarId` null → placeholder, no skeleton; reduced motion → static skeleton; skeleton hidden from screen readers; the 6c/6d D18
  tests updated from "placeholder" to "skeleton" where the user has a photo (assertion meaning per D20, logged) — verify: full
  suite, typecheck, lint; verifier + ui-taste; device (scenario 9).
- [x] 6f. (approved by Kacper 2026-10-21) [frontend] D21 + D22 in `ProfilePhoto`. — skill:
  frontend-ui-engineering, test-driven-development — tests first: profile.test.tsx — photo shown → reconnect → the re-signed url
  fails → `profile-photo` stays, no skeleton; next offline → online → tried again; a photo never shown that fails → skeleton
  (unchanged D20); after `load` the skeleton fades out over `duration.small` (Reanimated/expo-image timing asserted like the pulse
  tests); reduced motion on → no fade, swap at once — verify: full suite, typecheck, lint; verifier + ui-taste; device (scenario 9).
  **Revision (approved by Kacper 2026-10-21, after the verifier FAIL):** also D23 — photo shown → a read without a url →
  `profile-photo` stays (same uri), no skeleton; the next read with a url → no bare circle, no ignored failure; plus the verifier's
  test fixes: "opacity only" asserted on the fading wrapper (scale mutation must go red); the fade timer cleared when the avatar
  changes or the screen unmounts mid-fade (cleanup mutation must go red).
- [x] 6g. (approved by Kacper 2026-10-22) [frontend] D24: the theme gets a `colors.skeleton` role (light
  `neutral.100`, dark `dark.border`) and `SkeletonBlock`'s default colour uses it; explicit `color` props unchanged. — skill:
  frontend-ui-engineering, test-driven-development — tests first: `SkeletonBlock.test.tsx` — dark theme default background =
  `#39443B`, light = `neutral.100`, an explicit `color` still wins; theme test for the new role in both schemes — verify: full
  suite, typecheck, lint; verifier; device (dark mode: the photo skeleton's pulse clearly visible).
- [x] 6h. (approved by Kacper 2026-10-22) [frontend] Q8: drop the `Image`'s `backgroundColor: surface.secondary`
  (`ProfileScreen.tsx:165`) so the photo skeleton pulses on the page while a photo loads, as it does offline; the skeleton
  already covers the Image until it has loaded and faded. — skill: test-driven-development — tests first: profile.test.tsx —
  while a url loads, nothing under the photo skeleton has the skeleton's colour (Image has no background colour), light and
  dark — verify: full suite, typecheck, lint; verifier; device (scenario 9, light and dark).
- [x] 6i. (approved by Kacper 2026-10-22) [frontend] D26: Android back button on Settings gets `minHeight: size.touchTarget`,
  no `minWidth`; iOS keeps both. — skill: frontend-ui-engineering, test-driven-development — tests first: settings.test.tsx —
  Android (`jest.replaceProperty(Platform, 'OS')`): back button `minHeight` = `size.touchTarget`, no 44 `minWidth`; iOS
  unchanged; still calls `router.back()` — verify: full suite, typecheck, lint; verifier; device (9.1 vertical reach ≥ 44 dp,
  title not moved).
- [x] 6j. (approved by Kacper 2026-10-22) [frontend] D27: light `colors.skeleton` = `neutral[200]`; `AppLoading` chrome =
  `colors.input.border` in both schemes. — skill: frontend-ui-engineering, test-driven-development — tests first:
  theme.test.ts (light skeleton #DDD5C7), SkeletonBlock.test.tsx (light default = #DDD5C7), AppLoading.test.tsx (light chrome
  = #C5BBAA, still ≠ hero, ≠ background) — verify: full suite, typecheck, lint; verifier; device (light photo skeleton pulse
  noticeable, app-loading chrome visible).
- [ ] 7. [tester] Device run of the manual steps below. — skill: none — verify: PASS per scenario. First run done 2026-10-21 (see log); re-run after 6b, 6c + scenarios 7, 8.
- [x] 8. [orchestrator] Docs (see Files). — skill: none — verify: every statement checked in the code.

## Manual test steps (step 7)
1. Open "Profil": "Profil" left, gear right, photo (or placeholder), nick, the card with five values that match the account's
   past trips (compare with "Minione" in the side panel; km roughly as on a flight-distance site).
2. Airplane mode, restart the app, open "Profil": the same numbers; the photo shows the placeholder if it cannot load.
3. Cold start / slow network: pulsing skeleton, then the numbers; with "Usuń animacje" on, static. Light and dark mode; the
   largest system font (one column, nothing cut off).
4. Gear → "Ustawienia" with a back button; back returns to "Profil".
5. "Wyloguj się" → "Anuluj": still signed in. "Wyloguj się" → "Wyloguj": welcome screen; signing in again loads the trips.
6. Offline: "Wyloguj się" disabled with the offline message. Online with an unsent (`failed`) budget change: the dialog warns.
7. (D19) With the test trip that already ended: "Profil" shows Podróże 1, Kraje 1, the trip's days counted inclusive, Loty =
   number of segments, km roughly as on a flight-distance site.
8. (D19) Skeleton: fresh sign-in (the sign-out clears the phone's copy) on a slowed network (emulator `network speed`/`delay`),
   open "Profil" while the list loads → five pulsing blocks; repeat with "Usuń animacje" on → static blocks. Screen recording as
   evidence.
9. (D17, D18, D20) Settings back button easy to hit; airplane on → restart → the photo's place pulses (skeleton, not the person
   placeholder) → airplane off → the photo comes back without a restart. Then, with the photo shown, airplane on → off again:
   the photo stays, no skeleton flashes over it.

## Progress log
- 2026-10-20: baseline before step 1 — 120 suites / 2490 tests green, typecheck 0, lint clean. Branch `feature/profile-screen`
  created from `feature/auth-onboarding`; Kacper's uncommitted changes left untouched, not part of this feature's commits.
- Step 1 (2026-10-20, `backend`): tests written (red ✓: schema range/type cases `Expected: false, Received: true`; airports.test.ts
  "every row parses" failed on rows without coordinates; WAW/JFK spot checks `Received: 52.17 / 40.64`) · `AirportSchema` +
  `latitude`/`longitude`; `scripts/build-airports.mjs` reads OurAirports `latitude_deg`/`longitude_deg` (header verified), rounds
  to 4 decimals, exits 1 without writing if a kept airport has none; `airports.json` regenerated (3153 rows, 471,572 → 595,514 B)
  · green ✓ 120 suites / 2500 tests, typecheck 0, lint clean · verifier PASS · skills used: domain-modeling,
  source-driven-development, test-driven-development · deviations: (1) R4 triggered — besides coordinates, 3 rows changed upstream
  (EFL name + `large` → true, HAH `large` → false, ZTH name + `large` → true); Kacper accepted them (2026-10-20). (2) Schema tests
  went into the existing `src/schemas/__tests__/entities.test.ts` Airport block, not a new `airport.test.ts`. (3)
  `src/lib/__tests__/airport-search.test.ts` fixture helper gained `latitude: 0, longitude: 0` (typecheck). Note: the script reads
  `/usr/share/zoneinfo/zone.tab`, missing on Windows; it was run with a scratchpad preload pointing that one read at WSL's copy
  (time zones identical to HEAD). A future run needs WSL/Linux or a `ZONE_TAB` override — not changed (surgical).
- Step 2 (2026-10-20, `backend`): tests written (red ✓: 29 failed / 418 passed in the six affected files — fields stripped by
  the old schema, `FlightRouteSchema` undefined, old select string, old-shape copy still parsing) · `FlightRouteSchema` in
  `flight.ts`; `TripListItemSchema` + `destination`, `flights`; `TripListRow` = generated `Pick` & nested
  `flight_segments(from_iata, to_iata)`; `listItemFromRow` maps them; `fetchList` select extended (still one query, same order);
  in-memory `list()` adds the routes; `local-store.ts` unchanged (its try/catch already turns an old copy into `null`, R1) ·
  green ✓ 120 suites / 2521 tests, typecheck 0, lint clean · verifier PASS · skills used: domain-modeling,
  source-driven-development (postgrest-js embedded resources, same pattern as `fetchTrip`), test-driven-development ·
  deviations: fixture-only additions in 5 existing tests; `useTrips.test.tsx` exact expectation extended (strengthened). The
  segments RLS policy already covers the nested read. The Jest "worker failed to exit gracefully" warning predates this feature
  (seen in the baseline run).
- Step 3 (2026-10-20, `backend`): tests written (red ✓ against a stub returning zeros: 8 failed / 1 passed by design — e.g.
  `Expected: 1 / Received: 0`, `Expected: 201 / Received: 0`, km `Expected: <= 15 / Received: 6860`) · new
  `src/lib/travel-stats.ts` (`travelStats(trips, today, airports)`, plain `TravelStats` type; reuses `tripSections().past` and
  `tripDayCount`; haversine R = 6371, summed then rounded once) + 9 tests incl. one on the real `AIRPORTS` (WAW→JFK = 6848 km) ·
  green ✓ 121 suites / 2530 tests, typecheck 0, lint clean · verifier PASS · skill used: test-driven-development · deviations:
  none (days test uses June dates instead of the October example — same arithmetic). Verifier note not acted on: no guard for
  `a > 1` in the haversine (only antipodal airports, not a real case).
- Step 4 (2026-10-20, `backend`): tests written (red ✓ against stubs: `toHaveBeenCalledTimes(1)` received 0; promise resolved
  instead of rejected; status stayed `signedIn`; `hasUnsentChanges` `Expected: true / Received: false`) · `SessionSource.signOut()`
  (`auth.signOut({ scope: 'local' })`, throws the error, never clears data itself); `useSession()` → `{ state, retry, signOut }`
  (stable `useCallback`); `TripRepository.hasUnsentChanges()` — Supabase: `unsyncedBudgetChanges().length > 0` (synced rows are
  deleted), rejects when the device store cannot be read; in-memory: always false (it has no pending state); fake session source
  emits `signedOut` on `signOut` · green ✓ 121 suites / 2547 tests, typecheck 0, lint clean · verifier FAIL (scope: backend.md
  allowed only schemas/supabase) → Kacper D15 widened backend.md → re-check PASS · skills used: source-driven-development
  (`@supabase/auth-js` 2.117.2 `GoTrueClient._signOut` / `_removeSession`, `GoTrueAdminApi.signOut`, `lib/fetch`),
  doubt-driven-development, test-driven-development · deviations: (1) auth-js finding → D16 (no error after a rejected
  sign-out); step 6 tests changed accordingly. (2) Guard tests green from the start, not red first (documenting existing or
  impossible-to-be-red behaviour): "does not clear the user data itself", "keeps the same function between renders", the
  offline-ordering test, in-memory false cases, and "rejects when the device store cannot be read". (3) One-line
  `hasUnsentChanges` additions to inline repositories in `TripsDrawer.test.tsx`, `useTrips.test.tsx`. (4) `app-session-source.ts`
  needed no change. Note for later: when offline expenses land, `hasUnsentChanges` must include them.
- Step 5 (2026-10-20, `frontend`): tests written (red ✓ against stubs — `ProfileScreen` = `EmptyScreen` "Profil",
  `TravelStatsCard` = `Card`, `SkeletonBlock` = static `View`: profile.test.tsx 24 failed / 2 passed, e.g. `Unable to find an
  element with role: button, name: Ustawienia`, `...accessibility label: 3 Podróże`, `...testID: stat-skeleton`;
  TravelStatsCard 16 failed; SkeletonBlock `Expected: 1200 / Received: undefined`, pulse `>= 1 / Received: 0`; tabs real-screen
  test failed on the gear) · `profile.tsx` → `src/features/profile/ProfileScreen.tsx` (header `heading1` + gear `IconButton` →
  `/settings`, 96 dp photo via expo-image with placeholder fallback, nick `heading2`, `OfflineBanner` like home, `ScrollView`),
  `TravelStatsCard.tsx` (`Card`, `heading3` title, `numericL` values, `bodyS` labels, `text.secondary` icons, one column above
  `fontScale` 1.3, `Intl.NumberFormat`, "–" spoken as `profile.noData`), shared `src/components/SkeletonBlock.tsx` (Reanimated
  opacity 1 → 0.5 → 1, 1200 ms, `surface.secondary`, static with reduced motion), tokens `duration.skeletonPulse`,
  `opacity.skeletonPulseMin`, i18n `profile.*`, `nav.profileTitle` removed · green ✓ 125 suites / 2599 tests, typecheck 0, lint
  clean · verifier FAIL (missing red evidence in its brief; §12 error state; two vacuous assertions) → evidence supplied, A2
  recorded as approved §12 exception, assertions rewritten and proven by temporary mutation → re-check PASS · skills used:
  frontend-design, frontend-ui-engineering, test-driven-development, ui-taste (verifier, code-level) · deviations / notes:
  (1) `@ts-expect-error` with a reason on `router.push('/settings')` (typed routes) — **step 6 removes it**. (2) Placeholder icon
  is `User` (profile setup's circle shows a camera) — to confirm with Kacper. (3) Literal `borderWidth: 1` as elsewhere in the
  repo (no border-width token exists). (4) Skeleton width 48 dp, real values may be wider — check on device (step 7). (5) A list
  failing with no copy shows the skeleton ~7 s (default query retries) before the dashes, same as the side panel.
- Step 6 (2026-10-20, `frontend`) — **implemented, verifier NOT run yet (session usage limit); not `[x]`**: tests written (red ✓
  against a `null` stub: 23/23 failed, `Unable to find an element with role: button, name: Wyloguj się`) · `src/app/settings.tsx`,
  `Stack.Screen name="settings"` in the `app` guard (native header, `HeaderBackButton` "Profil"), `SettingsScreen.tsx`
  (`TextButton variant="destructive"` bottom-anchored, D8 offline message + `OfflineBanner`, `hasUnsentChanges` → D5 dialog,
  failed check = warning), `src/hooks/useSignOut.ts` (one call in flight, rejection swallowed per D16, `pending` stays true after
  success), i18n `settings.*`; `@ts-expect-error` in `ProfileScreen.tsx` removed · reported green 127 suites / 2625 tests,
  typecheck 0, lint clean (to be re-run by the verifier) · deviation: 3 `useSignOut` hook tests written after the hook, proven by
  mutation instead of red-first. Open for Kacper: empty space above the bottom button (alternative: right under the header).
  Next: verifier for step 6 → step 7 (tester) → step 8 (docs).
- Step 6 verification (2026-10-21): verifier PASS (typecheck 0, lint clean, 127 suites / 2625 tests) with minor notes →
  `frontend` fixed two of them: (1) "has no pill on it" was vacuous (queried only inside `settings-screen`); now opens
  `/settings` directly and asserts no `pill-nav` in the whole app, plus a control test that finds it on `/profile`; proven by
  temporary mutation (`Received: <View testID="pill-nav" />`), reverted. (2) Side gutter now follows design-context §18 like
  `ProfileScreen` (`width < breakpoints.compact ? spacing[4] : spacing[5]`); new test red `Expected: 16 / Received: 20` → green ·
  full suite green ✓ 127 suites / 2627 tests, typecheck 0, lint clean · skills used: frontend-ui-engineering,
  test-driven-development, ui-taste (verifier, code-level). Notes not acted on: "44 dp" test checks a token constant and
  "bottom" checks `justifyContent` (real geometry → step 7); double-tap screen test may not reach the second press (the guard is
  covered by `useSignOut.test.tsx`); sign-out order asserted with `arrayContaining` (order covered by the step 4 Session test).
  Copy not in A5: `settings.back` "Wróć, Profil" / "Back, Profile" (screen-reader label of the header back button) — for Kacper.
  The 3 `useSignOut` tests written after the hook (proven by mutation) — for Kacper to accept. Step 7: no device or emulator
  connected on 2026-10-21.
- Step 7 (2026-10-21, `tester`) — **not `[x]` yet, open questions for Kacper**: mobilenext cloud refused the account ("not
  eligible to allocate a device"); a local release APK did not build on Windows (JDK 25 from Android Studio breaks CMake configure;
  with JDK 17 the C++ build hits the path limit, `LongPathsEnabled = 0`, not changed). The project runs in Expo Go, so the run used
  Kacper's phone (CPH2699, Android 16, Expo Go, Metro on 8083 via `.claude/launch.json` `expo-metro`; emulator was busy with the
  friend-invite session). Results: 1 PASS (only the all-zero case: the account has no past trips; non-zero counting covered by unit
  tests only) · 2 PASS (same numbers offline from the copy, placeholder photo, offline banner) · 3 light/dark, font 2.0 → one column,
  nothing cut off PASS; skeleton pulse and static reduced-motion skeleton **not observable** (the list loads from the copy in < 1 s)
  · 4 PASS · 5 PASS (Cancel keeps the session; Sign out → welcome; signing in again left for Kacper) · 6 offline: disabled +
  message PASS; unsent-change warning SKIPPED (needs a real data change; covered by unit tests). Device settings restored. No data
  changed. Minor findings: (1) native header back button on Settings ≈ 30×30 dp (< 44 dp); (2) the back arrow once not drawn on the
  first Settings open (in the a11y tree, not reproduced); (3) photo stays the placeholder after reconnect until a relaunch (A3
  silent); (4) outside this feature: pill nav labels break at font 2.0; (5) at font 2.0 photo + nick scroll under the header
  with no divider. Kacper (2026-10-21): fix (1) → D17 / step 6b, fix (3) → D18 / step 6c, test trip + skeleton test → D19.
- Step 6b (2026-10-21, `frontend`): tests written (red ✓: `Expected: >= 44, Received: 0.5` — the library's hairline minWidth) ·
  first version set `minWidth`/`minHeight` = `size.touchTarget` on every platform → verifier FAIL: on Android the back button and
  the title share the left header view, so a 44 dp minWidth (plus the library's `marginHorizontal: 11`) pushes the title ~20 dp
  right, and Android already has `hitSlop` 16 on each side (`HeaderButton.js:9`), i.e. the tester's ~30 dp measured the element,
  not the touch area; also no assertion on the button's `onPress`. Fix: the min size only on iOS (no hitSlop there); Android keeps
  the library default. Tests: iOS min sizes = token; Android (`jest.replaceProperty(Platform, 'OS')`) no 44 override (red ✓
  `Expected: not 44` against the all-platform version); pressing the real header button calls `router.back()` and returns to
  `/profile` (coverage test, green first — could not be made red without breaking production code) · green ✓ 127 suites / 2630
  tests, typecheck 0, lint clean · verifier re-check PASS · skills used: frontend-ui-engineering, test-driven-development ·
  deviation: D17's Android part is met by the existing hitSlop, not by a code change; Android's rendered hitSlop is not assertable
  in Jest (Platform.select bound to iOS) → device run.
- Step 6c (2026-10-21, `frontend`, earlier session cut off before logging) — **verifier PASS, device check (step 7, scenario 9)
  pending; not `[x]` yet**: `ProfilePhoto` keeps the failed uri in state; an effect clears it only on an offline → online change
  (`wasOffline` ref), so the `Image` is rendered again with the same uri; a photo that fails again online stays the placeholder
  until the next reconnect (no loop). Tests: the D18 `describe` in `profile.test.tsx` (fails → placeholder; going online → same
  uri; staying offline → placeholder; fails again online → placeholder, next reconnect retries). Red evidence: not recorded when
  written, supplied afterwards by the verifier with temporary mutations (file restored byte-identical): (a) reconnect effect
  removed → 2 red (`expect(photo()).toBeTruthy()` received null); (b) reset on every `offline` change → 1 red (no-loop test,
  placeholder received null after online → offline); (c) reset after any error → 5 red. Green ✓ 127 suites / 2634 tests,
  typecheck 0, lint clean · skills used: frontend-ui-engineering, test-driven-development · deviation: red-first not recorded,
  proven by mutation instead (for Kacper to accept). Verifier notes not acted on: the `wasOffline` ref is redundant
  (`if (!offline) setFailed(null)` on `[offline]` is equivalent — optional simplification); the "staying offline" test cannot tell
  a reset-on-any-report version apart (covered by the no-loop test). **Device risk:** expo-image may keep its failed state for an
  identical source — scenario 9 settles it.
- Step 7 re-run (2026-10-21, `tester`, emulator Medium Phone API 37, Expo Go, Metro 8083 of this checkout; 8081 is the
  friend-invite worktree, untouched) — **paused, D18 FAIL**: 1 PASS (zero case; the three upcoming trips correctly not counted) ·
  2 PASS (cold start offline: same numbers, placeholder, banner) · 3 light/dark + font 2.0 PASS, skeleton pending (8) · 4 PASS ·
  5 PASS (Cancel keeps the session; Sign out → welcome), sign-in-again pending · 6 offline disabled + message PASS, unsent warning
  SKIPPED · 7 NOT RUN: the side panel shows no past trip on the account (only Test friend-invite, Warsaw → Frankfurt, Warsaw →
  Jakarta, all upcoming) — asked Kacper · 8 pending a sign-in by Kacper (network slowed: `emu network delay gprs`, `speed gsm`) ·
  9 D17: horizontal touch area ≈ 46–54 dp (8 dp outside the 30 dp icon registers), vertical not measured; **D18 FAIL**: airplane
  on → cold start → placeholder → airplane off → the placeholder stays (checked at ~1 and ~2 min, tab switch did not help); the
  photo returns only after a relaunch online. Also: without a relaunch, going offline keeps the photo (expo-image memory cache).
  **Root cause (orchestrator, from the code):** after an offline start the profile comes from the SQLite copy, which never stores
  the signed `avatarUrl` (`local-store.ts` `cacheProfile`), so `ProfilePhoto` gets `uri = undefined` — not an `onError`. Step 6c
  only clears the failed state; nothing refetches the profile on reconnect (`useMyProfile` has `retry: false`, and TanStack's
  `onlineManager` is not wired to expo-network, so `refetchOnReconnect` never fires in React Native). The 6c tests covered only a
  uri that fails, not a missing uri. Proposed fix → step 6d (awaiting Kacper's approval).
- Step 6d (2026-10-21, `frontend`) — **verifier FAIL, not `[x]`**: `ProfileScreen` calls `useMyProfile().refetch()` once on
  offline → online (`wasOffline` ref); nothing in `src/data/`, `src/providers/`, `useProfile.ts`; no global `onlineManager`.
  5 tests in a new D18 describe; red ✓ ("going online" `Received: null`; "failing read" `Expected: 1, Received: 0`; "one read
  per reconnect" `Received: null`), 2 guards. Full suite 127 / 2642 green, typecheck 0, lint clean. Verifier mutations: refetch
  removed → 3 red; refetch on every `offline` change → 1 red; every render → 2 red; every online report → 1 red. **FAIL:** the
  gate part of "refetch rejects" is vacuous — a gate checking `isError` before `data` (`useGateView.ts:21-23`) still passes,
  because the assertions run before TanStack's notify timers flush (`profile.test.tsx:311-313`); with
  `jest.runOnlyPendingTimers()` in the `act` it goes red under that mutation. Minor: the read-count `waitFor(... toBe(2))` at
  `:344` passes on first poll, so a later extra read is not caught. Fix → back to `frontend` (tests only).
  **Blocked on coordination:** two other running sessions edit the same checkout — "Skeleton loader dla logowania"
  (`prompts/app-loading-skeleton/`, changes `SkeletonBlock.tsx` + `TripHeroSkeleton.tsx`, step 1 adds a `radius` prop that 6e
  needs) and "Karty ostatnich podróży na profilu" (`src/features/profile/TravelStatsCard.tsx` and `__tests__/` changed at
  21:45–21:47). The 6d fix and 6e edit `ProfileScreen.tsx`, `profile.test.tsx` and use `SkeletonBlock` — asked Kacper.
  Kacper: no other session edits the profile any more → continue.
- Step 6d fix (2026-10-21, `frontend`, tests only): `flushTimers` helper (`jest.runOnlyPendingTimers()` in `act`; the file runs
  on fake timers from `renderRouter`); the failing-read test flushes twice and asserts `reads()` still 1 before the gate; every
  read count in the D18 describe is asserted after a flush. Mutations (frontend, reproduced by the verifier): isError-first gate
  → failing-read test RED (`profile-error` rendered, `:322`); an extra delayed refetch → 3 RED (`Expected: 1 Received: 2`). No
  assertion weakened. Green ✓ 128 suites / 2655 tests (other sessions add tests), typecheck 0, lint clean · **verifier re-check
  PASS** · skills used: frontend-ui-engineering, test-driven-development. 6c and 6d get `[x]` after the device check (scenario 9).
- Step 6e (2026-10-21, `frontend`) — **verifier PASS (2nd round), device check pending; not `[x]`**: `ProfileScreen` passes
  `avatarId` to `ProfilePhoto`; `avatarId` null → person placeholder; photo without url or with a failed url → `SkeletonBlock`
  `profile-photo-skeleton` (96 dp, `radius.full`); with a url → one 96 dp box, the `Image` under an absolute skeleton until
  `onLoad`. `loaded` is keyed by `avatarId` (a re-signed url of the same photo keeps it shown; expo-image without `recyclingKey`
  keeps the old pixels until the new source loads — `Image.types.ts:274-282`, `ImageView.swift:66-72`,
  `ExpoImageViewWrapper.kt:147-151`); `failed` stays keyed by url (6c). Tests: `profile.test.tsx` 34 → 45. Red ✓ 14 failed / 28
  passed (`profile-photo-skeleton` not found); re-signed-url test red on the first version (skeleton found). Changed existing
  assertions (D20 meaning, every other assertion kept): "falls back to the placeholder…" → skeleton (+ placeholder null); 6c
  "failed while offline", "staying offline", "fails again while online" (3×) → skeleton; 6d "offline start", "a read that
  fails", "staying offline" → skeleton (+ placeholder null). Test infra: Reanimated via `jest.spyOn` (a `jest.mock` in this
  router file is ignored); fresh expo-image events per `fireEvent`. 1st verifier round **FAIL**: `loaded` keyed by the signed
  url → the skeleton flashed back over a shown photo after every reconnect refetch → fixed as above + 3 tests (re-signed url,
  different `avatarId`, pulses offline). Verifier mutations (2nd round): key by url → 1 red; `onError` not clearing `loaded` →
  red (verifier's temporary test); static photo skeleton offline → 1 red; no 6c reset → 2 red; no 6d refetch → 6 red. Green ✓
  128 suites / 2668 tests, typecheck 0, lint clean · skills used: frontend-ui-engineering, test-driven-development, ui-taste
  (verifier, code-level). Open for Kacper: Q4, Q5. Nits not acted on: `loaded` not reset if `avatarId` goes null and back;
  `wasOffline` in `ProfilePhoto` redundant; the "pulses offline" test compares `withRepeat` counts with a baseline.
- Step 6f (2026-10-21, `frontend`) — **verifier FAIL, not `[x]`**: `ProfilePhoto` keeps `loaded`/`faded` booleans reset at render
  time on an `avatarId` change; `onError` → `if (!loaded) setFailed(uri)` (D21); local `SkeletonCover` fades the overlay with
  Reanimated `withTiming(0, duration.small)` and removes it by a JS timer of the same length; reduced motion → at once (D22).
  expo-image keeps old pixels after a failed source change (verified by the verifier in the native sources). Tests 45 → 50, red ✓
  3 failed / 47 passed; changed setup: `skeletonAppears()` now gets a skeleton from a different `avatarId` (assertions kept).
  Green ✓ 129 / 2689, typecheck, lint. Verifier mutations: onError always fails → 1 red; reset removed → 4 red; duration changed
  → 1 red; reduced motion ignored → 2 red; timer early → 1 red; **fade via scale → 0 red** (the "opacity only" assertion reads
  the inner SkeletonBlock, not the fading wrapper — major); timer cleanup removed → 0 red (minor). **Also found (code reading):**
  a shown photo whose later read has no url (online paths in `supabase-profile-repository.ts`: refresh fails → copy; status 0 →
  copy; `signAvatar` fails → no url) goes back to the skeleton; when the url returns, the Image remounts with `loaded && faded`
  still true → a bare circle without pulse, and a failed remount is ignored → blank until the next reconnect (defect). Asked
  Kacper about the no-url case (Q6). Note: the verifier's first full run hit git merge markers in `SkeletonBlock.tsx` left
  mid-edit by the app-loading-skeleton session; the re-run was green.
- Step 6f round 2 (D23 + test fixes, `frontend`): `loadedUri` replaces `loaded`; `source = uri ?? loadedUri` keeps the last
  loaded url when a read has none; `SkeletonCover` wrapper `testID="profile-photo-fade"`; tests 50 → 54 (D23 red: photo null;
  fade test red: testID missing; cut-short timer test). Verifier **FAIL**: the fade assertion `{ opacity: 0 }` was also produced
  by SkeletonBlock's pulse in the Reanimated mock (`withSequence = () => 0`), so a wrapper stuck at opacity 1 stayed green (M4).
- Step 6f round 3 (`frontend`): the D22 describe mocks `withSequence` to a distinct 0.77 (restored in `afterEach`); at rest the
  animated opacities contain 1 and 0.77, no 0; after `load` 0 and no 1, opacity-only keys. `onLoad` also clears `failed` + test
  "a url that failed before comes back while another photo is shown" (red: skeleton shown; reached through a `SettingsStub`
  route that mounts a second profile reader). Tests 54 → 55. Red evidence for round 2–3: as reported by `frontend` (red runs
  above); verifier mutations M1 scale, M2 no timer cleanup, M3 `source = uri`, M4 wrapper `{ opacity: 1 }`, M5 no
  `setFailed(null)` → each exactly 1 red, files restored byte-identical. Green ✓ 132 suites / 2895 tests, typecheck 0, lint
  clean · **verifier PASS (round 3)** · skills used: frontend-ui-engineering, test-driven-development, ui-taste (verifier). No
  easing token → Q7. Not `[x]` until the device check (scenario 9).
- Step 6g + D25 (2026-10-22, `frontend`) — **verifier PASS, device check pending**: `colors.skeleton` role in `theme.ts`
  (light `neutral[100]`, dark `dark.border`); `SkeletonBlock` default `color ?? theme.colors.skeleton`; `AppLoading.tsx` chrome
  `theme === darkTheme ? input.border : border` (same check as `HomeSkeleton.tsx:42`). Tests red → green: `theme.test.ts`
  (skeleton role), `SkeletonBlock.test.tsx` (default per scheme, explicit wins), `AppLoading.test.tsx` (per scheme; red
  `Expected "#4A564C", Received "#39443B"`; guards `not.toBe(hero)`, `not.toBe(background)` kept). Changed for D24 meaning:
  `HomeSkeleton.test.tsx:131`, `profile.test.tsx:1029` (the latter landed in Kacper's WIP commit `b49f9d2`). Verifier mutations:
  default back to `surface.secondary` → 4 red; chrome back to `border` → 1 red; dark role = `surfaceSecondary` → 2 red. Green ✓
  132 / 2897, typecheck 0, lint clean · skills used: frontend-ui-engineering, test-driven-development. **Found:** while a photo
  with a url loads, its skeleton sits on the `Image`'s own backdrop `surface.secondary` (`ProfileScreen.tsx:165`, since step 5):
  light skeleton #EEE8DD on #EEE8DD → the pulse is invisible; dark #39443B on #202A23. Offline start (no url) is fine — the
  skeleton sits on the page. Proposed fix → 6h (Q8).
- Step 6h (2026-10-22, `frontend`) — **verifier PASS, device check pending**: `ProfileScreen.tsx:165` Image style is just
  `circle` (no backdrop). Test `it.each` light/dark (`profile.test.tsx:454-466`): before `load` the Image has no
  `backgroundColor` and the skeleton is `theme.colors.skeleton`; red ✓ light `Received: "#EEE8DD"`, dark `"#202A23"`
  (reproduced by the verifier in a scratchpad copy). No existing assertion changed. Green ✓ 132 / 2899, typecheck 0, lint clean
  · skill used: test-driven-development. The skeleton now sits on the page in both schemes: light #EEE8DD on #F7F3EA (1.10:1,
  faint — from D24, judge on the device), dark #39443B on #111712 (1.79:1).
- Step 7 re-run 2 (2026-10-22, `tester`, emulator Medium Phone API 37, Android 17, Expo Go `exp://10.0.2.2:8083` = this
  checkout; phone language English) — **paused at the scenario 8 sign-in**: 9.1 D17 **FAIL vertically** — horizontal reach
  ≥ 44 dp, but taps 20 dp above / below the icon centre do nothing (17 dp above works), so ≈ 36–40 dp tall; return to Profile
  works, look unchanged. Cause (orchestrator, from the code): on Android the library's `hitSlop` 16 on every side
  (`expo-router/build/react-navigation/elements/Header/HeaderButton.js:9-12`) cannot reach outside the parent header view, so
  the 6b deviation "Android met by the existing hitSlop" holds horizontally only. · 9.2 / 9.3 and the photo-skeleton visibility
  (3, D24/6h) NOT RUN: an offline cold start in Expo Go fails ("Failed to download remote update", the bundle comes from Metro
  over the network). Next attempt: `adb reverse tcp:8083 tcp:8083` + `exp://127.0.0.1:8083`, so the bundle loads over adb while
  airplane mode cuts the internet. · 9.4 PASS (photo stays through airplane on → off; screenshots 2–5 s apart, recording did not
  save, so a sub-second flash is not excluded) · 3 light / dark look PASS (all stats 0: the only trip is upcoming) · 8 network
  slowed (`gsm` / `gprs`), sign-out → confirm → welcome PASS; stats skeleton NOT RUN yet (waits for Kacper's sign-in). Notes:
  heavy input lag on the slowed network (late taps landed on other screens: Places tab, side panel, the new-trip wizard — left
  with back, nothing created); night mode flipped to light once by itself (set back); home shows a budget line "Total … · ~… per
  person a day" not from this plan. Device: airplane off, dark mode restored; network still slowed on purpose.
  Sign-in for scenario 8 blocked (Supabase auth logs, 09:57–09:58 UTC): Google login succeeded, but the callback went to the
  Site URL `http://localhost:3000` because `exp://10.0.2.2:8083/--/auth/callback` is not an allowed Redirect URL; the email
  code request returned 200 (sent by Supabase) but did not reach the inbox. Emulator network restored to full meanwhile.
  Kacper (2026-10-22): **scenario 8 skipped** — the stats skeleton (D9) stays covered by unit tests only; resume the tester on
  9.2 / 9.3 and the photo-skeleton visibility (light / dark) via `adb reverse` once he is signed in.
- Step 7 re-run 2, resumed (2026-10-22, `tester`; Kacper signed in with the e-mail code — Google kept landing on the Site URL
  although the dashboard lists `exp://**`; offline cold starts from `exp://127.0.0.1:8083` over `adb reverse tcp:8083`, sign-in
  shared with the `172.22.176.1` instance; first load hung ~6.5 min, later 1–1.5 min) · 9.2 (D20) **PASS**: offline cold start →
  `profile-photo-skeleton` 96 dp, no placeholder; pulse measured on 7 frames, peak ≈ #39443B, trough ≈ half opacity · 9.3 (D18)
  **PASS**: airplane off, no restart → `profile-photo` within ~4 s; the 180 ms fade (D22) not captured (screenshots too slow) ·
  3 dark (D24) **PASS**: pulse clearly visible on #111712 · 3 light (6h) **not noticeable**: skeleton 238–242 / 232–237 / 221–226
  on the page 247/243/234, the pulse moves ~4 levels of 255 → Q9 · 9.4 PASS (earlier) · 9.1 D17 vertical FAIL (earlier) → 6i
  proposed. Screen recording failed twice (mobile-mcp), evidence = screenshots in the session scratchpad. Device restored:
  airplane off, dark mode, `adb reverse` 8083 removed, network full / none (re-confirmed by the orchestrator), app left on Profile.
  **Marked `[x]`:** 6c, 6d, 6e, 6g, 6h (device check passed for their decisions; the light faintness is a colour question, Q9,
  not a 6h defect — 6h's skeleton now sits on the page). **6f stays `[ ]`** until Kacper accepts the fade as unit-test-only.
  Kacper then accepted D26–D28 → 6f `[x]`.
- Step 6i (2026-10-22, `frontend`) — **verifier PASS, device check pending**: `_layout.tsx:103-107` Android style
  `{ minHeight: size.touchTarget }` (no minWidth), iOS unchanged, comment gives the D26 reason. `settings.test.tsx:142-143`: the
  6b Android test changed meaning per D26 (`minHeight` undefined → 44; "minWidth not 44" kept). Red ✓ `Expected: 44, Received:
  undefined` (:143). Verifier mutations: Android minHeight removed → 1 red; Android minWidth 44 → 1 red; files restored
  byte-identical. · skills used: frontend-ui-engineering, test-driven-development.
- Step 6j (2026-10-22, `frontend`, run in parallel with 6i on disjoint files) — **verifier PASS, device check pending**:
  `theme.ts:59` light skeleton `neutral[200]`; `AppLoading.tsx:26` chrome `input.border` in both schemes, `darkTheme` import
  removed. Tests: theme.test (light #DDD5C7 = border), SkeletonBlock.test (light literal #DDD5C7 replaces "= surface.secondary"),
  AppLoading.test (light chrome #C5BBAA, guards ≠ hero / ≠ background kept), and — outside the step's file list, D27 meaning
  changes found by the full run — HomeSkeleton.test (light blocks / hero #DDD5C7 + guards ≠ surface), TripHero.test:163
  (TripHeroSkeleton light bg #DDD5C7). Red ✓ `Expected "#DDD5C7" Received "#EEE8DD"`, AppLoading `Expected "#C5BBAA" Received
  "#DDD5C7"`. Verifier mutations: light skeleton back to neutral[100] → 4 red; chrome back to `border` → 2 red. Light contrast:
  cards 1.46:1, hero 1.32:1, chrome over hero 1.30:1. Green ✓ 132 suites / 2899 tests, typecheck 0, lint clean (verifier's own
  run); `local-store-queue.test.ts` failed once during the parallel runs, 3 isolated re-runs + full run green (timing flake, not
  this feature). Stale comments found: `SkeletonBlock.tsx:19` (light neutral.100, from 6j) and `HomeSkeleton.tsx:10` (dark
  `surface.secondary`, from 6g) → comment-only fix by `frontend`; design-context §10.18 → step 8. · skills used:
  frontend-ui-engineering, test-driven-development.
  Comment fix (2026-10-22, `frontend`): `SkeletonBlock.tsx:19`, `HomeSkeleton.tsx:10` now match the code; comments only;
  typecheck 0, lint clean, the two files' tests 21/21 green.
- Device check 6i + 6j (2026-10-22, `tester`, same emulator; JS reloaded, back control bounds 79×79 → 79×115 px = 44 dp tall):
  9.1 (D17/D26) **PASS** light and dark — taps 20 and 22 dp above / below and 22 dp left of the icon centre all return to
  Profile; the "Settings" title at the same position as before (not moved). 6j light photo skeleton **PASS** — offline cold
  start (adb reverse), peak 221/213/199 = #DDD5C7, trough 234 = halfway to the page 247, swing ≈ 13 levels, judged
  noticeable (Kacper to confirm on his screen); 9.3 quick re-check PASS (photo ≈ 3 s after airplane off). App-loading chrome in
  light NOT RUN (the gate shows too briefly to capture without slowing the network; covered by `AppLoading.test.tsx`). Dark
  Profile / Settings unchanged. Device restored (airplane off, dark, adb reverse 8083 removed, app on Profile). → 6i, 6j `[x]`.
  **Step 7 left:** scenario 7 (needs a past trip from Kacper); 8 skipped by Kacper; 6 unsent-budget warning skipped (unit
  tests).
- Step 8 (2026-10-22, orchestrator) — docs, every statement checked against the code first: `Architecture.md` (last updated,
  overview sign-out + „Profil”, folder tree, Modules — routes, schemas, data `signOut` / `hasUnsentChanges`, lib `travelStats`,
  hooks `useSignOut`, providers `signOut`, new Profile feature row, `AppLoading` chrome; Data model — airport coordinates,
  `FlightRouteSchema`, list item fields; Data flow — list select, sign-out path; Frontend — `/profile`, `/settings`, root gate,
  `SkeletonBlock`; Theme tokens; Key decisions; Known limitations; Changelog), `context/app-context.md` (roadmap item 16, ideas,
  navigation map, §3.8 sign-out, new §3.9, Airport model, offline table + scope, folders, reusable pieces, known gaps),
  `CLAUDE.md` (offline-scope line, D11; `Airport` + coordinates), `context/design-context.md` §10.18 (colour roles D24 / D27,
  chrome D25, pulse D9). `GLOSSARY.md` unchanged (no new term). Not changed (outside this feature, surgical): the stale idea
  "Prefill the profile setup …" in app-context (done by theme-split). · skill used: none.

## Risks & open questions
- **Q3 — Order with the background gradient (D14)** — accepted with revision 2 as proposed: profile first. Proposal was: this feature first on today's background, then
  `app-background-gradient` as its own plan (new palette colors + design-context rule, every screen's background, the hero's fade
  and the headers that today use the solid `colors.background`). Or the gradient first, so the profile is built on it.
- ~~Q4~~ → D21 (keep the shown photo). ~~Q5~~ → D22 (fade in). ~~Q6~~ → D23.
- **Q7 — Easing token (6f):** design-context §9.2 maps exits to cubic-bezier `(0.4, 0, 1, 1)`, but the theme has no easing
  token, so the photo fade uses Reanimated's default. Add easing tokens (§9.2) as a separate theme step, or keep the default?
- ~~Q9~~ → D27 (step 6j). ~~6i proposal~~ → D26. ~~6f fade on device~~ → D28.
- Device note (2026-10-22): while the branch was being merged, `src/app/_layout.tsx` briefly held git conflict markers, so Metro
  failed to bundle and the emulator kept a stale bundle; reloaded after the merge was resolved. The round button next to the
  nick on the emulator is Expo Go's "Tools" button, not the app.
- R1. **Old list copy after the update:** a copy saved before step 2 lacks the new fields, so it reads as no copy. Starting
  offline before ever going online after the update shows the side panel's offline error once. Fine for a dev build.
- R2. The list query now also reads every trip's flight routes: a little more data per list load (a few segments per trip).
- R3. `friend-invite` (awaiting approval) touches the same `src/data/` files; the two features run one after the other.
- R4. **Re-running the airport script** may also bring changes from the sources since 2026-10-04 (new or closed airports, city
  names). Step 1 keeps only the coordinates; if anything else differs it stops and asks you.
