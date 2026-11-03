# Shared contract (Zod)

Zod schemas in `src/schemas/` are the single source of truth for every data shape, shared by the app, SQLite, Supabase and (later) Edge Functions.

## Zod is the single source of truth
- Every entity, API payload, Edge Function input/output, AI output, and form lives as a Zod schema in `src/schemas/` (planned move to `packages/schemas`, not adopted yet).
- TypeScript types come **only** from `z.infer`. Never hand-write a type that duplicates a schema.
- The JSON Schema sent to the LLM is **generated from Zod** (`z.toJSONSchema`), never hand-written.
- SQL migrations mirror the schemas. Any data change goes in this order: **Zod → migration → regenerate Supabase types → parity check passes.**
- Validate at every boundary: incoming requests, AI responses, external API responses, form input.

## Conceptual model

Conceptual model. **Canonical definitions live in `src/schemas/`** (planned move to `packages/schemas`, see [overview](overview.md)) — if this section and the schemas disagree, the schemas win and this section gets updated. Schema constants are named `XSchema`, types `X = z.infer<typeof XSchema>`.

```
Money          { amountMinor: int, currency: ISO4217 }
CostEstimate   { minMinor: int, maxMinor: int, currency: ISO4217, perPerson: boolean }

Trip           { id, ownerId, name, destination: IATA,     // destination = outbound's final airport
                                                           // name: organizer's, default "<from city> → <destination city>", ≤ 60 chars
                 coverImageUri,                            // required cover: 'preset:<id>' (bundled) | 'photo:<uuid>' (Storage)
                 startDate, endDate,                       // derived from flights
                 baseCurrency, budgetPerPerson: Money,     // whole trip, without flights; daily budget is derived
                 budgetUpdatedAt,                          // last budget change; last write wins on sync
                 createdAt }

Profile        { id,                                      // = auth user id; one per account
                 username,                                 // unique nick, 3–20 chars a–z 0–9 _ ., starts with a letter
                 friendCode,                               // 6 chars, server-generated, no 0 O 1 I L; not shown yet
                 interests: InterestTag[],                 // at least 1
                 avatarId: string | null,                  // photo in the private `avatars` bucket
                 createdAt, updatedAt }

TripMember     { id, tripId, userId: string | null,      // null = friend without an account
                 displayName, role: 'owner' | 'viewer',
                 interests: InterestTag[], budgetLevel?: 'low' | 'mid' | 'high',
                 pace?: 'relaxed' | 'normal' | 'intense', dietaryNotes?: string }
                 // budgetLevel / pace optional until member editing exists

Airport        { iata, name, city, countryCode, timezone: IANA, currency: ISO4217, large: boolean,
                 latitude, longitude }                    // coordinates for the km stat (profile-screen D12)
               // bundled static list (src/data/airports.json), not a server table

FlightSegment  { id, tripId, direction: 'outbound' | 'return' | 'internal', order: int,
                 flightNumber?, fromIata, toIata,
                 departAt, departTz, arriveAt, arriveTz }
               // Layover = gap between consecutive segments. Derived, not stored.

Day            { id, tripId, date, area?, notes? }

Activity       { id, dayId, startTime, endTime,
                 kind: 'sight' | 'food' | 'transport' | 'free' | 'layover',
                 title, placeId?, memberIds: string[],   // subset of members = group split
                 estimatedCost?: CostEstimate,
                 source: 'ai' | 'user', locked: boolean } // locked survives regeneration

Expense        { id, tripId,                              // id is a client-generated UUID
                 memberId: string | null,                  // who spent it; null = the organizer (not a TripMember)
                 name, amount: Money,                      // always the trip's baseCurrency (for now)
                 category: 'food' | 'transport' | 'stay' | 'activities' | 'other',
                 spentOn: date,                            // local calendar date
                 createdAt, updatedAt, deletedAt: string | null }
               // later: dayId / activityId (plan ↔ reality), split between several people

LocalExpense   // device only (SQLite), the row is its own outbox entry
               Expense & { syncStatus: 'synced' | 'pending' | 'failed', syncError?, attempts: int, lastAttemptAt? }

TripBudgetChange // a budget change made on the device, possibly offline
               { tripId, budgetPerPerson: Money, updatedAt }
LocalTripBudgetChange // device only (SQLite), the change is its own outbox row
               TripBudgetChange & { syncStatus, syncError?, attempts: int, lastAttemptAt? }

OutboxEntry    // device only (SQLite) — not used: expenses and budget changes keep sync state on their own row
               { id, entity: 'expense', entityId, op: 'upsert' | 'delete',
                 payload: Expense, attempts: int, createdAt, lastAttemptAt? }

DayPlanDraft   // AI output, validated before anything is saved
               { dayId, activities: Array<{ placeId, kind, startTime, endTime,
                 memberIds, estimatedCost, reason }> }
```

## Implemented schemas and tables
Zod schemas in `src/schemas/` (constants `XSchema`, types `X = z.infer<typeof XSchema>`):
- `common.ts` — `CurrencyCodeSchema`, `IataCodeSchema`, `IanaTimezoneSchema`, `IsoDateTimeSchema` (with offset), `IsoDateSchema`, `LocalDateTimeSchema` (airport-local wall clock from forms; must be a real calendar date — `isLocalDateTime`), `MoneySchema` (integer minor units + ISO 4217).
- `interests.ts` — `InterestTagSchema` (17 tags), `InterestGroupSchema` (6 groups), `INTEREST_GROUPS`.
- `airport.ts` — `AirportSchema` (iata, name, city, countryCode, IANA timezone, currency, large, `latitude` −90…90, `longitude` −180…180; profile-screen D12).
- `flight.ts` — `FlightSegmentSchema` (arrival after departure as instants), `FlightRouteSchema` (`{ fromIata, toIata }` — a segment's route on the trip list, profile-screen D11).
- `member.ts` — `TripMemberSchema` (friends: role `viewer`; `userId` null for a friend without an account, the friend's account id once linked by code; `budgetLevel`/`pace` optional); `CreateTripMemberPayloadSchema` (friend-invite 2b: the snake_case member `create_trip` receives, with `friend_code` nullish and no `user_id`).
- `cover.ts` — `COVER_PRESET_IDS` (auckland, bali, beijing, jakarta, majorka), `CoverSchema` (`preset:<id>` | `photo:<lowercase uuid>`, a `z.templateLiteral`), `DEFAULT_COVER` (`preset:auckland`), `CoverChoiceSchema` (a cover, or `file://<path>` = a gallery photo picked but not sent; no whitespace-only or line breaks), `CoverUrlsSchema` (`{ url, thumbnailUrl }`, http(s) only via `HttpUrlSchema` in `common.ts`).
- `trip.ts` — `TripSchema` (`name` 1–60 chars, required `coverImageUri: Cover`, `budgetPerPerson`, `budgetUpdatedAt`, end ≥ start, budget in base currency), `TripSummarySchema` (+ `travellerCount`, optional `coverUrls` — only on a `photo:` cover), `TripOverviewSchema` (`{ trip: TripSummary, members, segments, organizerUsername? }` — the organizer's nick, only for a linked member, friend-invite D4), `TripListItemSchema` (`id`, `name`, `destination`, `flights: FlightRoute[]` in any order, `coverImageUri`, optional `coverUrls` as above, `startDate`, `endDate` — one row of the side panel, also the input of the profile stats), `TripListSchema` (array; also the device copy), `SelectedTripSchema` (`{ tripId }` — device only, the chosen trip).
- `sync.ts` — `SyncStatusSchema` (`synced | pending | failed`).
- `trip-budget.ts` — `TripBudgetChangeSchema` (`tripId`, `budgetPerPerson`, `updatedAt`), `LocalTripBudgetChangeSchema` (+ `syncStatus`, `syncError?`, `attempts`, `lastAttemptAt?`), `TripBudgetFormSchema` (= the wizard's `BudgetStepInputSchema`, amount > 0), `CurrentTripSchema` (`{ overview, budgetSyncStatus, fromCache }` — what the home screen shows).
- `supabase-config.ts` — `SupabaseConfigSchema`:
  - `url`: an https URL. http is accepted only for the hosts `127.0.0.1`, `localhost` and `10.0.2.2`, so a local Supabase can be reached from the machine or the Android emulator (trip-photos D36).
  - `key`: must start with `sb_publishable_`, so a secret key cannot ship in the app.
- `trip-photo.ts`:
  - `TripPhotoSchema`: `id` (a client UUID), `tripId`, optional `takenAt` and `createdAt`. `takenAt` is the camera's clock as `LocalDateTimeSchema`, a written exception to "timestamps with offset" (D12).
  - `ShownTripPhotoSchema`: adds the signed `url` and `thumbnailUrl` (http(s) only).
  - `TripPhotoListSchema`: the photos in display order; also the copy on the phone.
  - `PickedPhotoSchema`: `uri` and an optional `takenAt`. The gallery result is a boundary, so it is parsed.
  - GPS is never read or stored.
- `profile.ts` (auth-onboarding P1, D4):
  - `UsernameSchema`: 3–20 characters `a–z 0–9 _ .`, starts with a letter, no `..`, no trailing `.`; one error key `validation.usernameFormat`.
  - `FRIEND_CODE_ALPHABET` (31 characters, without `0 O 1 I L`), `FRIEND_CODE_LENGTH` 6, `FriendCodeSchema`; `FriendCodeInputSchema` (typed code: trimmed, uppercased, then `FriendCodeSchema`).
  - `FoundFriendSchema` (friend-invite): `{ username, interests }` — what the lookup by friend code returns, never the account id.
  - `ProfileSchema`: `id` = the auth user id, `username`, `friendCode`, `interests` (≥ 1), `avatarId` (uuid or null), `createdAt`, `updatedAt`.
  - `ShownProfileSchema`: adds an optional signed `avatarUrl`.
  - `ProfileSetupInputSchema`: the form. The nick is trimmed and lowercased; an empty one gives `validation.usernameRequired`. Interests ≥ 1 (`validation.interestsRequired`). `avatarUri` is a `file://` path or null.
- `provider-profile.ts` — `ProviderMetadataSchema` (the `user_metadata` fields read after a Google / Discord sign-in, parsed leniently: a wrong type counts as absent), `ProviderProfileSchema` (`suggestedUsername` nullable, `avatarUrl` nullable, https only on the provider's own avatar host), `providerProfile()` (never throws) — pre-fills the profile setup.
- `index.ts` — re-exports the schemas.
- `auth.ts`:
  - `EmailSchema`: trimmed, lowercased, `validation.emailFormat`.
  - `OTP_CODE_LENGTH` 6, `OtpCodeSchema` (`validation.otpFormat`).
  - `EmailSignInInputSchema`, `EmailCodeInputSchema`.
- `create-trip-form.ts` — wizard input: `SegmentInputSchema` (each time must exist in its airport's zone — a time skipped when clocks go forward gives `validation.timeDoesNotExist`; arrival vs departure compared only when both exist), `FlightsStepInputSchema` (segment chain, return after outbound, first departure not before today at the departure airport, 0–19 companions), `FriendInputSchema` (`displayName`, `interests`, `friendCode` — null for a friend without an account, set once the code was found; friend-invite D12), `FriendsStepInputSchema` (no two friends with the same code → `validation.friendDuplicate`), `BudgetStepInputSchema`, `TripDetailsInputSchema` (name trimmed, required, ≤ 60; required cover, `CoverChoiceSchema`), `CreateTripInputSchema` (flights, friends, budget, details). Messages are i18n keys (`validation.*`).

**Server tables** (`supabase/migrations/20261006090351_trips.sql`, `20261102120000_expenses.sql`, `20261015182337_trip_photos.sql`, `20261015184306_trip_photos_storage.sql`, `20261018120000_trip_covers.sql`, `20261018150000_profiles.sql`, `20261020120000_friend_invite.sql` and `20261020130000_friend_invite_code_only.sql`, mirroring the schemas; row types generated into `src/data/database.types.ts`):
- `profiles` — one row per auth user.
  - Columns:
    - `id` (pk, references `auth.users`, on delete cascade);
    - `username` (unique, check = the `UsernameSchema` pattern);
    - `friend_code` (unique, check = 6 characters from the alphabet; set by `private.set_friend_code()` before insert, which overwrites any client value: pgcrypto bytes with rejection sampling, retried on collision);
    - `interests text[]` (≥ 1, ⊆ the 17 tags);
    - `avatar_id uuid` (null);
    - `created_at`, `updated_at`.
  - `private.touch_profile()` pins `id`, `friend_code` and `created_at` on update and sets `updated_at`.
  - A parity test (`profiles-db-parity.test.ts`) keeps the patterns, alphabet and columns in line with the Zod schemas.
- `trips` — `id`, `owner_id` (= `auth.uid()`), `name` (1–60), `cover_image_uri` (not null, default `preset:auckland`, check = the exact `CoverSchema` shape; a `photo:<uuid>` cover lives in Storage at `<tripId>/<uuid>.jpg` + `_thumb.jpg`, next to the trip's photos), `destination`, `start_date`, `end_date` (≥ start), `base_currency`, `budget_per_person_minor` (bigint ≥ 0; currency = `base_currency`), `budget_updated_at`, `created_at`.
- `trip_members` — `id`, `trip_id`, `user_id` (null = friend without an account; set only by `private.link_trip_member` from a friend code, friend-invite D12), `display_name` (trimmed, 1–40), `role`, `interests text[]` (⊆ the 17 tags), `budget_level`, `pace`, `dietary_notes` (≤ 200); unique `(trip_id, user_id) where user_id is not null` (`trip_members_trip_user_key`).
- `flight_segments` — `id`, `trip_id`, `direction`, `position` (= `order`), `flight_number` (2–8), `from_iata`, `to_iata`, `depart_at`, `depart_tz`, `arrive_at` (> depart), `arrive_tz`; unique `(trip_id, direction, position)`.
- `trip_photos` — `id`, `trip_id` (deleted with its trip by cascade), `taken_at` (`timestamp without time zone`, nullable), `created_at`; an index on `trip_id`; no updates.
- `expenses` (`20261102120000_expenses.sql`, schema `src/schemas/expense.ts`) — mirrors `ExpenseSchema`; `trip_id` cascades with the trip (D17); composite FK `(trip_id, member_id)` → `trip_members (trip_id, id)` with RESTRICT (D18): a member with expenses, also soft-deleted ones, can't be deleted (23503), while deleting a trip or the organizer's account works (`expenses_rls.sql`). RLS: owner reads and writes any row of the trip; a linked member reads all, writes only rows with their own `member_id` (D15); no delete for anyone; column-level update without `id`, `trip_id`, `created_at`. `public.upsert_expense(expense jsonb)` (security invoker): upsert by `id`, a stale or repeated `updated_at` is a silent no-op.

**Storage** (`20261015184306_trip_photos_storage.sql`):
- A private bucket `trip-photos`, JPEG only, 10 MiB per file.
- Objects are `<tripId>/<photoId>.jpg` and `<tripId>/<photoId>_thumb.jpg`, with lowercase UUIDs. `private.trip_id_of_object(name)` returns null for any other name.
- A private bucket `avatars` (`20261018150000_profiles.sql`), JPEG only, 2 MiB:
  - objects are `<userId>/<avatarId>.jpg`;
  - `private.user_id_of_avatar(name)` reads the folder;
  - each user may insert / select / update / delete only in their own folder;
  - shown through a signed URL (1 h).

**SQLite tables** (`src/data/local-db.ts`, migrations v1–v5, `pragma user_version`):
- `expenses` (v5) — mirrors `LocalExpenseSchema`: `id`, `trip_id`, `member_id` (null = organizer), `name`, `amount_minor INTEGER`, `currency`, `category`, `spent_on`, `created_at`, `updated_at`, `deleted_at`, `sync_status`, `sync_error`, `attempts`, `last_attempt_at`; index on `trip_id`. Cleared by `clearUserData`, a trip's rows dropped by `forgetTrip`; a trip that only vanished from the server list keeps its rows (D22).
- `trip_overview_cache (trip_id, overview_json, cached_at)` — a copy of every trip read from Supabase on this phone; parsed with `TripOverviewSchema` (a corrupt copy counts as none). Copies of trips no longer on the server's list are deleted when the list is read.
- `trip_list_cache (id = 1, list_json, cached_at)` (v2) — the last list read from Supabase; parsed with `TripListSchema`.
- `selected_trip (id = 1, trip_id)` (v2) — the trip chosen in the side panel; parsed with `SelectedTripSchema`; forgotten when a new server list no longer has it.
- `trip_budget_changes (trip_id, amount_minor INTEGER, currency, updated_at, sync_status, sync_error, attempts, last_attempt_at)` — one unsynced budget change per trip (its own outbox); parsed with `LocalTripBudgetChangeSchema`.
- `trip_photos_cache (trip_id, photos_json, cached_at)` (v3) — the last photo list read for a trip, parsed with `TripPhotoListSchema`.
  - The signed URLs in it expire after 1 h. The images themselves stay in expo-image's disk cache.
  - An invalid list is never written, and a corrupt one reads as none.
  - It is pruned with the list and dropped by `forgetTrip`.
- `my_profile_cache (id = 1, profile_json, cached_at)` (v4) — the signed-in user's own profile, without `avatarUrl` (signed URLs expire; the image stays in expo-image's cache under `avatar:<avatarId>`). Parsed with `ProfileSchema`; a corrupt copy reads as none.
- `clearUserData()` empties all six tables above in one transaction. It runs whenever the app is signed out (auth-onboarding D14).

The airport list is a static bundled file, validated row by row in its test (not parsed at runtime).

