# APP CONTEXT — TRAVELO

What the app is, what it does and what it contains. Read this before planning or building any feature.

- **Product rules, process and engineering rules:** `CLAUDE.md`.
- **Visual system (Sunline):** `context/design-context.md`.
- **How the code is built right now:** `docs/architecture/` (overview, frontend, backend, shared, flows, decisions, known limitations).
- **Domain terms:** `GLOSSARY.md`.
- **Plans and progress of each feature:** `prompts/<feature-name>/plan.md`.

If this file and the code disagree, the code wins and this file gets updated. If this file and `docs/architecture/` disagree about the current state, check the code and fix whichever is wrong.

---

## 1. What the app is

Travelo is a mobile app for **the one person who organizes a trip for a group of friends** (the *organizer*). Only the organizer needs the app.

- **Friends** are added to a trip by name and interests. They have no account.
- A friend who does have an account can optionally be added by their **friend code** as a **linked member**, to follow the trip read-only (except their own expenses, which they add and edit — `prompts/expenses/plan.md` D15).
- The app helps the organizer set up the trip, plan the days from real places, and keep the money under control during the trip.

Platforms: iOS and Android (Expo / React Native). Languages: Polish (`pl`) and English (`en`), following the choice in Settings, by default the device language (English as fallback). Light and dark mode, by default following the phone.

### Out of scope — do not build
- Flight / hotel booking, a social feed, user reviews.
- Settlements ("who owes whom") — not in the MVP.

---

## 2. Roadmap

### Done (works in the app today)
1. **Trip setup (create-trip wizard)** — flights, friends, a daily budget per person („Razem” one amount for all / „Osobno” per person), name and cover photo.
2. **Members** — friends with interests (17 interest tags in 6 groups).
3. **Flights and layovers** — manual entry of flight segments; layovers are derived from consecutive segments.
4. **Trips in Supabase** — Postgres with RLS, trip list and the current trip.
5. **Side panel with all trips** — "Nadchodzące" / "Minione", choose the current trip, start a new trip.
6. **Trip menu** — rename, change the cover, change the budget, delete the trip.
7. **Trip photos** — photo strip under the hero, full-screen viewer, upload to private Supabase Storage.
8. **Offline budget** — the daily budgets can be changed without internet and syncs later.
9. **Offline reading** — the trip list and every trip opened on the phone are kept in SQLite.
10. **Pill navigation** — a floating bottom pill with four screens (one placeholder); „Miejsca” removed (places-legal-navbar D3).
11. **Confirm dialog** — in-app dialog used when leaving the wizard with entered data.
12. **Trip covers** (`prompts/trip-covers/`) — every trip has a cover: one of five bundled photos (Auckland by default) or a photo from the gallery, uploaded to Storage.
13. **Profile tab** (`prompts/profile-tab/`) — the last pill item is "Profil" (route `/profile`, title "Profil użytkownika", `CircleUser` icon); since profile-screen it is the profile screen (title "Profil").
14. **Sign-in and profile** (`prompts/auth-onboarding/`) — a required account: Google, Discord or e-mail with a 6-digit code; on first sign-in a profile with a unique nick, interests and an optional photo; a server-generated friend code, not shown yet. The device run (step 9) is partly done.
15. **Friend invite** (`prompts/friend-invite/`) — in the wizard's friends step a friend can be added by their 6-character friend code: the card fills with their nick and interests and the account is linked to the trip at once, read-only except their own expenses, which they add and edit (`prompts/expenses/plan.md` D15). The linked friend sees the rest of the trip without edit controls. Layover labels line up with the flight lines on the home screen and the summary. On the hosted Supabase; device check passed.
16. **Profile screen and sign-out** (`prompts/profile-screen/`) — "Profil" shows the photo, the nick and five numbers of the past trips (trips, countries, days travelled, flights, km flown), also offline; the gear opens Settings with "Wyloguj się" (a confirmation, disabled offline). The device run is done except the stats of a past trip (scenario 7).
17. **Avatar and settings** (`prompts/profile-settings/`) — a full-screen avatar preview with change and remove, theme and language, profile editing, and account deletion. Done: the `delete-account` function is deployed and the device run partly passed on Android (iOS and a few deletion cases are not checked yet, see the plan).
17. **Expenses** (`prompts/expenses/`, done 2026-11-02). The "Wydatki" screen has a trip bar (opens the side panel), budget left for the group or "Ja" with today's amount and carryover from earlier days, a bar per person split by category, a timeline by day, and adding by the button in the empty state, then a floating button. One person per expense, the trip's base currency only, offline. The organizer edits anyone's expenses; a linked friend adds and edits only their own.
18. **Discover places** (`prompts/places-legal-navbar/`, stream C, 2026-11-07) — from the home screen's empty state, "Odkryj miejsca" opens `/discover`, and with a trip the Plan tab's „Odkryj” switch shows it inside the tab (`prompts/plan-discover-switch/`): pick a city (airport search) and interests, get up to 10 real places from Google Places with a short AI reason why they fit its Google rating, and up to 3 swipeable photos with the author's credit (`prompts/places-photo-carousel/`), open each in Google Maps. 5 searches per user per day; needs internet.

### In progress (plans in `prompts/`)
- None.

### Not started (MVP)
- **AI day plans** — per-day schedule from real places, cost ranges, group splits (the "Plan" screen).
- **Expenses, later parts** — other currencies with FX rates, split a bill equally between people, receipt photo, quick-add from every screen.
- **Plan vs reality** — the daily budget comes with Expenses; still to do: plan ↔ expense link and the end-of-trip summary shareable as an image.

### Ideas recorded, not planned yet
- Showing the friend code (with a QR code) somewhere in the app, so a friend can share it; a rate limit for code lookups before real users (friend-invite R1).
- Leaving a trip as a linked friend, and unlinking a friend as the organizer (friend-invite D10).
- Prefill the profile setup with the name and photo from Google / Discord (Kacper, 2026-10-19).

### Next (after the MVP)
- "Rebuild the rest of today" (rain, closed place, tired group) — keeps locked activities.
- Receipt photo / one-sentence expense entry parsed by AI.

---

## 3. Screens and flows

### 3.1 Navigation shape
```
Root Stack (a gate decides which group exists)
├── (auth)                 Signed out only
│   ├── /welcome           Welcome + sign-in sheet (Google, Discord, e-mail)
│   ├── /email             E-mail address
│   └── /code              6-digit code from the e-mail
├── /onboarding            Signed in without a profile: profile setup
├── /settings              Settings (signed in, above the drawer, no pill)
├── /edit-profile          Nick and interests
├── /avatar                Full-screen avatar preview, always dark
├── /auth/callback         OAuth redirect landing (redirects by state)
├── (drawer)               Signed in with a profile. Side panel with all trips (swipe from the left edge only on "Podróż")
│   └── (tabs)             Floating pill with four screens
│       ├── /              Podróż    — the current trip (home screen)
│       ├── /expenses      Wydatki   — budget, who spent what, timeline, add expense
│       ├── /plan          Plan      — placeholder; with a trip a „Plan” / „Odkryj” switch (Discover inside the tab)
│       └── /profile       Profil    — photo, nick, travel stats; gear → /settings
├── /trips/new/*           Create-trip wizard (nested Stack, 4 steps)
└── /trips/[tripId]/photos Full-screen photo viewer
```
The pill is not shown in the wizard or in the photo viewer. The placeholder screen "Plan" shows only a title and "Ten ekran pojawi się wkrótce."; when there is a current trip, the title is replaced by a „Plan” / „Odkryj” switch and „Odkryj” shows Discover places inside the tab (`prompts/plan-discover-switch/`) (a deliberate exception to design-context §10.13, §10.19 and §12 until their features exist).

### 3.2 Home screen — "Podróż" (`/`)
Shows the **current trip**: the one chosen in the side panel (remembered on the phone), else the **default trip** (the soonest upcoming or ongoing one, else the most recently ended). Always dark.

States: loading (skeleton hero), error (retry), empty (no trips, "Utwórz podróż"), trip, and offline (banner at the bottom).

The trip view, top to bottom:
- **Hero** — the cover photo fading into ink over half the screen, with the trip name, dates and number of days. Over it: a round menu button (☰, top-left, opens the side panel) and a round ⋮ button (top-right, opens the trip menu).
- **Photo strip** — a "+" tile, then the trip's photos ordered by date taken.
- **"Loty"** — outbound and return flights in airport-local time, with layover labels.
- **"Podróżni · N"** — "Ty" plus the friends' names. A linked friend sees "<organizer's nick> (organizator)" (or "Organizator" without a nick), "Ty", then the others.
- **A linked friend's view** is read-only (their own expenses excepted, D15 in `prompts/expenses/plan.md`): no ⋮, no "Zmień" on the budget, no "+" photo tile, no delete in the photo viewer, and no photo strip on a trip without photos.
- **"Budżet"** — the daily budget (per person, or the group's sum per day when amounts differ) and the total for the trip; "Zmień" opens the budget sheet; a sync indicator shows while a change has not been sent.

### 3.3 Side panel
"Twoje podróże", with sections "Nadchodzące" (not ended yet, soonest first) and "Minione" (most recently ended first). A row has a thumbnail, the name (2 lines) and the dates; the open trip is marked. Tapping another trip makes it the current trip and closes the panel. Footer: "Nowa podróż" (starts the wizard). Loading, error, empty and offline states exist.

### 3.4 Trip menu (⋮)
A bottom sheet with: **"Nazwa i zdjęcie"** (rename up to 60 characters, change the cover — a cover is always required), **"Zmień budżet"** and **"Usuń podróż"** (a confirmation sheet; afterwards the home screen shows the default trip or the empty state and a "Podróż usunięta." snackbar). Rename, cover change and delete go straight to Supabase and are **disabled offline**.

### 3.5 Create-trip wizard (`/trips/new`)
Four steps. Each step validates its slice with a Zod schema on "Dalej". Leaving with entered data asks through the in-app confirm dialog ("Odrzucić wpisane dane?").

1. **Flights** — a "Lot tam" / "Powrót" switch shows one direction at a time. Segment cards with airport search (a bundled list of ~3,150 airports), date/time pickers in the airport's local time, an optional flight number, "Dodaj przesiadkę" for layovers, amber layover labels between segments, and a stepper for the number of companions (0–19). The return is suggested as the outbound reversed.
2. **Friends** — a card per friend: an optional "Kod znajomego", then a name and interest chips. Skipped when travelling alone.
   - The code is uppercased and checked after the 6th character ("Sprawdzam kod…"). A found code fills the card with the friend's nick and interests, not editable; editing the code gives back an empty card.
   - Messages: "To Twój kod.", "Nie ma użytkownika z tym kodem.", "Ten znajomy jest już dodany.", "Połącz się z internetem, żeby sprawdzić kod." (the field is disabled offline), "Nie udało się sprawdzić kodu. Spróbuj ponownie.", "Kod ma 6 znaków.".
   - "Dalej" waits until every typed code is found or cleared.
3. **Budget** — a daily amount per person (without flights) and a currency (destination currency, PLN, EUR, USD); with friends a „Razem / Osobno” switch (one amount for everyone / an amount per person); shows each person's total and the group total for the trip.
4. **Summary** — the trip name (default "<from city> → <destination city>", max 60), the cover, and cards with "Zmień" back to each step. "Utwórz podróż" saves (needs internet) and returns home; the new trip becomes the current trip.

### 3.6 Budget sheet
Changes the daily budgets with the same „Razem / Osobno” switch as the wizard (currency fixed to the trip's base currency). Works **with or without internet**; the indicator shows "Czeka na wysłanie" (pending) or "Nie udało się wysłać" (failed, with retry).

### 3.7 Photos
- Add up to 20 photos at a time from the gallery. Each is downscaled (longer side ≤ 2048 px), re-encoded as JPEG **without EXIF (so without GPS)**, and uploaded with a 480 px thumbnail, one at a time. It appears at once with its sending or failed state.
- Tapping a photo opens a full-screen viewer (swipe, counter, delete with a confirmation).
- Adding and deleting need internet. Photos already seen show offline (the list is copied to SQLite; the images stay in the image cache).
- Photos not yet sent are lost if the app closes.

### 3.8 Sign-in and profile setup
- **Welcome** (always dark, a full-screen cover photo): "Witaj w Travelo", one sentence, "Zaloguj się".
- **Sign-in sheet:** "Kontynuuj z Google", "Kontynuuj z Discordem", "Kontynuuj z e-mailem".
  - Google and Discord open the system browser and come back to the app.
  - A cancel does nothing; a failure shows fixed copy for that provider.
  - The buttons use Google's and Discord's own brand colours (a written exception to the design context).
- **E-mail:** the address, then "Wyślij kod" → a 6-digit code from the e-mail.
  - The code is checked as soon as the 6th digit is typed.
  - "Wyślij kod ponownie" becomes available after 60 s.
  - A wrong code keeps the digits and shows an error.
- **Profile setup**, on the first sign-in only, and it cannot be skipped:
  - an optional photo (gallery, square crop);
  - a nick: 3–20 characters `a–z 0–9 _ .`, starts with a letter, lowercased as you type, unique ("Ten nick jest zajęty.");
  - at least one of the 17 interests;
  - then "Zapisz i zaczynamy" → "Podróż". A failed save scrolls to the first error.
- **Offline:** the banner shows and the sign-in and save buttons are disabled. A signed-in user with a profile opens the app offline normally.
- **Signing out:** everything of the previous user is erased from the phone (including cached images and files; theme and language stay), then the welcome screen shows. It happens when the server ends the session, or when the account was deleted (checked once at startup in the background), and when the user signs out in Settings (see 3.9).

### 3.9 Profile and Settings (`/profile`, `/settings`)
- **Profil:** the title "Profil" with a gear (→ Settings), the round photo and the nick, then the card "Twoje podróże" with Podróże, Kraje, Dni w podróży, Loty, Przelecone km.
  - The numbers count trips that already ended (end date before today on the phone); an ongoing trip does not count yet. A trip's country is its destination airport's country; days are inclusive; every flight segment is one flight; km is the great-circle distance between the airports, summed.
  - They come from the trip list, so they show offline too. Loading: pulsing blocks; no list and no copy: "–"; no past trips: "0".
  - The photo: a pulsing circle until it is shown (also offline), a person placeholder without a photo; after an offline start it loads when the phone is back online.
  - Tapping the photo opens a full-screen dark preview (close, three dots → "Zmień zdjęcie" / "Usuń zdjęcie"). Without a photo it opens the gallery directly. After a change the preview stays with the new photo; a removal needs no confirmation and closes it. Offline the preview works, but the dots are disabled with the reason; without a photo the circle is disabled.
- **Ustawienia:** one scrolling list: Konto ("Edytuj profil"), Wygląd ("Motyw" and "Język": Systemowy plus two options, applied at once and kept on the phone), O aplikacji (version, "Polityka prywatności" and "Regulamin", which open `/legal/privacy` and `/legal/terms`), then the two buttons below.
- **Edytuj profil:** nick and interests as in the profile setup; save is disabled without a change, offline and with an invalid nick; no limit on nick changes.
- **Usuń konto:** disabled offline with "Połącz się z internetem, żeby usunąć konto.". A dialog warns what disappears and enables the button only after the user types their own nick. It erases the account, profile, photo and every trip the user organizes with its plans, expenses and photos, also for linked friends. In other people's trips the user's nick and expenses stay as a friend without an account. Afterwards the welcome screen says "Konto usunięte.". A failure says photos may already be gone and allows a retry; a nick changed on another phone asks for the current one and erases nothing.
- **Wyloguj się:** at the bottom. It asks "Wylogować się?" first; the message warns when budget changes were not sent yet (they are lost). Disabled offline with "Połącz się z internetem, żeby się wylogować.". Signing out ends the session on this phone only.

---

## 4. Domain model

Canonical definitions are Zod schemas in `src/schemas/` (the planned monorepo layout in `docs/architecture/overview.md` is the target; the app currently sits at the repo root). Constants are `XSchema`, types are `X = z.infer<typeof XSchema>`.

```
Money          { amountMinor: int, currency: ISO4217 }
CostEstimate   { minMinor: int, maxMinor: int, currency: ISO4217, perPerson: boolean }

Trip           { id, ownerId, name (1–60), destination: IATA,       // destination = outbound's final airport
                 coverImageUri,                                     // required: 'preset:<id>' | 'photo:<uuid>'
                 startDate, endDate,                                // dates derived from flights
                 baseCurrency, dailyBudget: Money,                  // organizer's per day, without flights; friends' on TripMember.dailyBudgetMinor
                 budgetUpdatedAt, createdAt }                       // last write wins on sync

TripMember     { id, tripId, userId: string | null,                 // null = friend without an account
                 displayName, role: 'owner' | 'viewer',
                 interests: InterestTag[], budgetLevel?, pace?, dietaryNotes? }

Airport        { iata, name, city, countryCode, timezone: IANA, currency, large, latitude, longitude }   // bundled list, not a server table
FlightSegment  { id, tripId, direction: 'outbound' | 'return' | 'internal', order,
                 flightNumber?, fromIata, toIata, departAt, departTz, arriveAt, arriveTz }
               // A layover is the gap between consecutive segments of one direction. Derived, never stored.

TripPhoto      { id (client UUID), tripId, takenAt?, createdAt? }   // takenAt = camera clock, no time zone
TripBudgetChange / LocalTripBudgetChange   // a budget change made on the device; its own outbox row

Profile        { id (= auth user id), username (unique, 3–20, a–z 0–9 _ .),
                 friendCode (6 chars, server-generated, no 0 O 1 I L),
                 interests: InterestTag[] (≥ 1), avatarId: uuid | null,     // photo in the private `avatars` bucket
                 createdAt, updatedAt }
```

`Expense` / `LocalExpense` are in code (`src/schemas/expense.ts`). Planned (in `docs/architecture/shared.md`, not in code yet): `Day`, `Activity`, `DayPlanDraft`. `OutboxEntry` is not used: local rows carry their own sync state.

Key facts:
- The **organizer is not a `TripMember` row**; traveller count = members + 1.
- Members are shown sorted by name (no stored order).
- Budget is **a daily amount per person, without flights** (the organizer's on the trip, each friend's on the member). Totals for the trip = daily × trip days; unspent money carries over to the next day.
- Trip dates come from the flights. Times are stored as airport-local wall clock + IANA zone, never converted through the device time zone. A local time that does not exist (DST gap) is rejected, not shifted.
- Money is **integer minor units + ISO 4217 code**, with digits from a static table. No floats for money.

---

## 5. Data and offline behavior

| What | Where it lives | Works offline? |
|---|---|---|
| Create a trip | Supabase (`create_trip` RPC) | **No** — needs internet |
| Rename, cover, delete trip | Supabase | **No** — disabled offline |
| Trip photos (add, delete) | Supabase Storage + `trip_photos` | **No** |
| **Daily budgets** | SQLite first, synced to Supabase | **Yes** — last write wins by `budgetUpdatedAt` |
| Read the trip list and any trip opened before | SQLite copies of Supabase data | **Yes** — read-only |
| Chosen (current) trip | SQLite only, never sent to Supabase | **Yes** |
| Photo list | SQLite copy | Yes (read-only; signed URLs expire after 1 h, images stay in the image cache) |
| Own profile | Supabase `profiles`, SQLite copy | Read: **yes** (read-only copy). Creating it needs internet |
| Sign-in | Supabase Auth | **No** — a signed-in user stays signed in offline |
| Sign-out | Supabase Auth, then the phone's data is erased | **No** — the button is disabled offline |
| Profile stats | Computed on the phone from the trip list copy | **Yes** |
| **Expenses** | SQLite, the local row is its own outbox entry, synced to Supabase | **Yes** (decided; see below) |

**Offline scope (MVP decision):** expenses and changes to a trip's daily budgets work offline. Everything else is server-first. Read-only copies cover the trip list (with each trip's destination and flight routes, for the profile stats — profile-screen D11), every trip opened on the phone, and the user's own profile (auth-onboarding D9). Extending offline to other entities is a new decision for Kacper.

**Budget sync:** `setBudget` writes a `pending` row to `trip_budget_changes` in SQLite with no network. A sync worker sends it with `rpc('set_trip_budget')` (organizer + friends in one call, last write wins by `budget_updated_at`). Unreachable → stays `pending` and retries with backoff (1 s × 2ⁿ, max 5 min); refused → `failed` and visible. It runs on start, on reconnect, on app foreground, after each save and on a timer.

**Reading when unreachable:** a request that gets no answer within 20 s counts as "unreachable" and falls back to the SQLite copy. A trip never opened on the phone has no copy, so choosing it offline shows the error state.

**Sync status** of a change made on the phone: `synced | pending | failed`.

**Auth:** a real account is required (Google, Discord or an e-mail code); there are no anonymous sessions. Signing in again after a reinstall restores access to the trips. Whenever the phone is signed out, all local user data is erased first.

---

## 6. Backend

- **Supabase:** Postgres, Auth (Google and Discord OAuth with PKCE, e-mail OTP code; anonymous sign-ins off), Row Level Security, Storage. Edge Functions: `delete-account` (the only way to erase an account).
- **Tables:** `trips`, `trip_members`, `flight_segments`, `trip_photos`. RLS on all of them: the owner can read and write; a linked member (`trip_members.user_id`) can only read.
- **`profiles`:** one row per user. The user reads, creates and updates only their own row, and never deletes it. The friend code is set by a server trigger and cannot be changed by the app.
- **Storage:**
  - A private bucket `trip-photos`, JPEG only, 10 MiB per file. Objects are `<tripId>/<photoId>.jpg` and `<tripId>/<photoId>_thumb.jpg`, shown through signed URLs valid for 1 hour. Deleting a trip removes its files first.
  - A private bucket `avatars`, JPEG only, 2 MiB. Objects are `<userId>/<avatarId>.jpg`, and only the owner can access them.
- **RPC:** `create_trip(trip, members, segments)` — one transaction, idempotent per id; a member with a friend code is linked to that account by the server (the app never sends an account id).
- **Friend invite:** `find_profile_by_friend_code` (nick + interests only), `trip_organizer_username` (the organizer's nick, only for the trip's people). Only the server sets `trip_members.user_id`, and only from a friend code.
- **Migrations** mirror the Zod schemas. Order for any data change: Zod → migration → regenerate types (`pnpm db:types`) → parity check. Applied migrations are never edited. Kacper pushes migrations to the project.
- **Tests:** plain-SQL RLS tests in `supabase/tests/` (`pnpm test:db`, needs `DB_URL` and, for Storage, a local Supabase in Docker).

### Planned external services
| Service | For | Called from |
|---|---|---|
| Google Places API | Real places (attractions, food); only `placeId` is stored long-term | Edge Function |
| Google Routes API | Travel times | Edge Function |
| An FX rates API | Multi-currency expenses | Edge Function |
| Google Gemini (Gemini API, AI Studio key) | Day plans, with JSON-schema structured output generated from Zod | Edge Function only |

Gemini model: `gemini-3.8-flash` from the `GEMINI_MODEL` secret (never hardcoded; places-legal-navbar D20). Free tier only in development, paid before release (D17). Google Places and Gemini are already used by Discover places (`recommend-places`).

### AI rules (when built)
- The model **never invents places**: Places candidates → the model selects and orders them by `placeId` → output parsed with Zod → any `placeId` outside the candidate set is rejected.
- Prices are **estimates shown as ranges** with a `~` prefix, never exact amounts.
- Keys never ship in the app. AI calls are rate-limited per user and cached.

---

## 7. Frontend

- **Stack:** Expo SDK 57, React Native 0.86, React 19.2 (New Architecture, React Compiler, typed routes), expo-router, TypeScript strict, TanStack Query, Zod, `expo-sqlite`, `@supabase/supabase-js`, i18next, lucide icons.
- **Fonts:** DM Sans (body) and Fraunces (display).
- **Folders** (`src/`): `app/` (routes only), `components/` (shared UI), `features/` (`auth`, `drawer`, `home`, `nav`, `profile`, `trip-create`, `trip-photos`, `expenses`), `hooks/` (TanStack Query hooks), `data/` (repositories, Supabase client, SQLite store, sync), `lib/` (pure logic: time zones, layovers, money, airport search, travel stats), `schemas/`, `providers/`, `i18n/` (pl / en dictionaries), `theme/` (tokens and light/dark themes), `test/` (helpers), `__tests__/app/` (route tests).
- **Data access:** screens use hooks → a `TripRepository` or a `ProfileRepository` interface, and the session comes from a `SessionProvider`. The app's implementations are Supabase + SQLite; tests use in-memory ones.
- **Design rules:** all colors, spacing, radii and type come from theme tokens (no hardcoded values); all text goes through i18n keys; touch targets ≥ 44 pt; money is always shown with its currency; every screen has loading, empty, error and (where relevant) offline states. See `context/design-context.md`.
- **Reusable pieces:** `PillNav`, `ConfirmDialog`, `BottomSheet` (swipe down to close), `Snackbar`, `OfflineBanner`, `SyncIndicator`, `PrimaryButton`, `TextButton`, `IconButton`, `HeroIconButton`, form fields (`TextField`, `AirportField`, `DateTimeField`, `AmountField`), `Chip`, `InterestChips`, `Stepper`, `SegmentedControl`, `Card`, `CoverPicker`, `TripHero`, `SkeletonBlock` (pulsing placeholder); for forms without a wizard, `AuthFormScreen` (`src/features/auth/`), `Fab`.

---

## 8. Principles that shape every feature

- **Built for one hand, on the move.** Primary actions sit in the thumb zone.
- **Adding an expense takes under 5 seconds** from the Expenses screen (quick-add, category chips; the trip's base currency is fixed for now).
- **Local first for the offline scope.** Saving never waits for the network; the UI reads from SQLite.
- **Zod is the single source of truth.** Validate at every boundary: forms, server responses, SQLite rows, external APIs, AI output.
- **Privacy:** GPS is never read or stored from photos; no secret keys in the repo.

---

## 9. Known gaps (short list)

The full list is in `docs/architecture/known-limitations.md`. The ones that matter for product decisions:
- One of four pill screens ("Plan") is a placeholder.
- Photos not yet sent are lost if the app closes.
- Sign-in:
  - Sign in with Apple is needed before an iOS release;
  - real users need a custom SMTP for the code e-mails;
  - Google's consent screen is still in testing mode;
  - in Expo Go, sign-in only comes back to the app through `127.0.0.1` (not a LAN IP).
- Retrying "Utwórz podróż" after a lost response can create a second trip.
- Several device checks (iOS, dark mode, large fonts, TalkBack/VoiceOver) are still pending for the pill navigation.
- The planned monorepo layout (`apps/mobile`, `packages/schemas`, see `docs/architecture/overview.md`) is not applied yet; the app is a single package at the repo root.
