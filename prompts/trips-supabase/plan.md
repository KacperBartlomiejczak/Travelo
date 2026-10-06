# Task: Trips in Supabase, trip budget editable offline
Status: awaiting approval

## Understanding & assumptions
Today trips live in an in-memory repository and vanish on restart. Kacper wants every created trip (flights, friends with their interests, budget) **saved to Supabase** right after the wizard's "Utwórz podróż". On top of that, the **trip budget** ("ile chcę wydać" = `budgetPerPerson`) must be editable **offline**: it is written to SQLite on the device first and synced to Supabase when the connection is back.

"Done" means:
- Creating a trip writes `trips`, `trip_members` and `flight_segments` rows to Supabase in one transaction, owned by the signed-in (anonymous) user, protected by RLS.
- The home screen reads the nearest trip from Supabase; the last successful read is kept in SQLite, so after a restart without internet the home screen still shows the trip.
- The Budget card has "Zmień" → bottom sheet with the amount per person → "Zapisz" works with and without internet; the card shows `pending` / `failed` until the change reaches Supabase; a failed change retries with backoff and never disappears.
- A persistent offline banner on the home screen while the device is offline.
- Full suite, typecheck, lint green; SQL tests for RLS and constraints pass; manual device steps written for Kacper.

Assumptions:
- **A1** — "Budget" = the trip's `budgetPerPerson` (whole trip, without flights). Not a per-friend amount (`budgetLevel` stays optional and is not edited here).
- **A2** — Only the **amount** changes in the sheet; the currency stays the trip's base currency (Q-answer 2026-10-06).
- **A3** — Creating a trip still needs internet (server-first, Q-answer). Offline, "Utwórz podróż" shows an error and keeps the wizard's input; nothing is queued.
- **A4** — The organizer is still not a `TripMember` row; `trip.ownerId` = `auth.uid()` of the anonymous user. `travellerCount` = members + 1 as today.
- **A5** — Linked viewers (`trip_members.user_id`) get read-only access in RLS now, because `CLAUDE.md` requires it for every table — even though the app cannot link users yet.
- **A6** — The offline banner is added to the home screen only in this task (the only screen that reads server data). The wizard shows its existing save error.
- **A7** — Only one budget change per trip can be waiting: a newer local change replaces the older pending one (last write wins by `updatedAt`, `CLAUDE.md`).

## Decisions (Kacper, 2026-10-06)
- **D1 — Offline scope:** trip creation is online; only the trip budget is stored locally (SQLite) and editable offline, synced later.
- **D2 — Auth:** anonymous sign-in at first launch (as in `prompts/supabase-client/plan.md` D2). Kacper enables "Anonymous sign-ins" in the dashboard.
- **D3 — Migrations:** Supabase CLI (`supabase` devDependency), migrations in `supabase/migrations/`; Kacper runs `supabase db push` (no DB password in the repo or in this session).
- **D4 — Cover photo:** the device-local URI is stored as-is in `trips.cover_image_uri`; upload to Storage is a later task.
- **D5 — Budget edit UI:** "Zmień" on the home Budget card → bottom sheet with the amount (currency fixed) → "Zapisz"; small sync indicator on the card.
- **D6 — Offline after restart:** the nearest trip's overview is cached in SQLite after every successful server read (read-only copy); offline the home screen shows it.
- **D7 — Dependencies approved:** `supabase` (CLI, dev), `expo-network` (reconnect + offline banner), `react-native-url-polyfill` (closes `prompts/supabase-client/plan.md` Q1).
- **D8 — Example trips:** removed from development builds; the in-memory repository stays for tests only.

## Approach
1. **Server (Supabase):** three tables mirroring the Zod schemas, RLS on all of them, explicit `GRANT`s to `authenticated` (Data API exposure change, R4 of the previous plan). Trip creation goes through one RPC `public.create_trip(trip jsonb, members jsonb, segments jsonb)` with `security invoker` (RLS still applies) so the three inserts are atomic; ids are client-generated and inserts use `on conflict (id) do nothing`, so a retried create never duplicates. The budget is updated with a plain `update … where id = $1 and budget_updated_at < $2` (last write wins, idempotent).
2. **Auth:** `ensureSession()` signs in anonymously when there is no stored session; `AppState` starts/stops token auto-refresh (Supabase React Native guidance).
3. **Device (SQLite, `expo-sqlite`):** versioned local migrations; two tables — `trip_overview_cache` (JSON of `TripOverview`, parsed with Zod on read) and `trip_budget_changes` (one row per trip: the pending/failed budget change, acting as its own outbox).
4. **Repository:** `createSupabaseTripRepository` implements the existing `TripRepository` interface (+ `setBudget`, `syncBudgets`). `nearest()`: server → cache → overlay a not-yet-synced local budget; on a network error it falls back to the cache. `setBudget()` writes SQLite first, then tries to sync.
5. **Sync triggers:** after each save, on app foreground, on reconnect (`expo-network`), and a failed change retries with backoff (1 s, 2 s, 4 s … max 5 min).
6. **UI:** Budget card "Zmień" + `BudgetSheet` (design-context §10.12), sync indicator (§17), offline banner (§12 "Offline").

Rejected: a generic `outbox` table now (as planned for expenses) — one budget value per trip does not need it; the generic outbox comes with expenses. Rejected: making whole trips local-first — Kacper chose online creation (D1).

## Data structures (Zod)
`src/schemas/trip.ts` — the trip gets the timestamp needed for last-write-wins:
```ts
const tripShape = {
  ...existing,
  /** When budgetPerPerson last changed; last write wins on sync (D1, CLAUDE.md). */
  budgetUpdatedAt: IsoDateTimeSchema,
};
```
`src/schemas/sync.ts` (new):
```ts
export const SyncStatusSchema = z.enum(['synced', 'pending', 'failed']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
```
`src/schemas/trip-budget.ts` (new):
```ts
/** A budget change made on the device (D1). Sent to Supabase as-is (minus local fields). */
export const TripBudgetChangeSchema = z.object({
  tripId: z.uuid(),
  budgetPerPerson: MoneySchema,          // currency must equal the trip's baseCurrency (checked by the repository)
  updatedAt: IsoDateTimeSchema,
});
/** Device only (SQLite row of trip_budget_changes). */
export const LocalTripBudgetChangeSchema = TripBudgetChangeSchema.extend({
  syncStatus: SyncStatusSchema,
  syncError: z.string().optional(),
  attempts: z.int().nonnegative(),
  lastAttemptAt: IsoDateTimeSchema.optional(),
});
/** Form in the bottom sheet: amount only, currency fixed (D5). Reuses the wizard's rule (amount > 0). */
export const TripBudgetFormSchema = BudgetStepInputSchema;
```
`TripSummarySchema` / `TripOverviewSchema` keep their shapes; the home screen gets the sync status separately:
```ts
/** What the home screen shows: the overview + the state of a local budget change (D5, D6). */
export const NearestTripSchema = z.object({
  overview: TripOverviewSchema,
  budgetSyncStatus: SyncStatusSchema,     // 'synced' when no local change is waiting
  fromCache: z.boolean(),                 // read from SQLite because the server was unreachable
});
```
Row mapping (`src/data/trip-rows.ts`): `snake_case` rows ↔ entities, every server row parsed with the entity's Zod schema; the row types come from the generated `src/data/database.types.ts` (parity: the mappers must typecheck against them).

### Server tables (migration, mirrors the schemas)
| Table | Columns |
|---|---|
| `trips` | `id uuid pk`, `owner_id uuid not null default auth.uid() references auth.users on delete cascade`, `name text check (char_length between 1 and 60)`, `cover_image_uri text null`, `destination text check (~ '^[A-Z]{3}$')`, `start_date date`, `end_date date check (end_date >= start_date)`, `base_currency text check (~ '^[A-Z]{3}$')`, `budget_per_person_minor bigint check (>= 0)`, `budget_updated_at timestamptz`, `created_at timestamptz default now()` (budget currency = `base_currency`, one column) |
| `trip_members` | `id uuid pk`, `trip_id uuid references trips on delete cascade`, `user_id uuid null references auth.users`, `display_name text check (1–40 after trim)`, `role text check in ('owner','viewer')`, `interests text[] check (<@ the 17 tags)`, `budget_level text null check`, `pace text null check`, `dietary_notes text null check (≤ 200)` |
| `flight_segments` | `id uuid pk`, `trip_id uuid references trips on delete cascade`, `direction text check in ('outbound','return','internal')`, `position int check (>= 0)` (= `order`; `order` is reserved in SQL), `flight_number text null check (2–8)`, `from_iata`, `to_iata`, `depart_at timestamptz`, `depart_tz text`, `arrive_at timestamptz check (> depart_at)`, `arrive_tz text`, `unique (trip_id, direction, position)` |

Indexes on every foreign key (`trip_members.trip_id`, `trip_members.user_id`, `flight_segments.trip_id`, `trips.owner_id`).

**RLS** (all three tables, `to authenticated`, `(select auth.uid())`):
- `trips`: owner — select / insert / update / delete (`using` + `with check` on `owner_id`); linked member — select only.
- `trip_members`, `flight_segments`: owner of the parent trip — all; linked member of the trip — select only.
- "Linked member of the trip" via `private.is_trip_viewer(trip_id)` (`security definer`, in the non-exposed `private` schema, checks `auth.uid()`) to avoid recursive policies between `trips` and `trip_members`.
- `anon` gets no grants. `create_trip` is `security invoker`, `execute` granted to `authenticated` only.

### SQLite tables (device, local migration v1)
- `trip_overview_cache (trip_id text pk, overview_json text not null, cached_at text not null)` — `overview_json` parsed with `TripOverviewSchema` on read.
- `trip_budget_changes (trip_id text pk, amount_minor integer not null, currency text not null, updated_at text not null, sync_status text not null, sync_error text, attempts integer not null default 0, last_attempt_at text)` — parsed with `LocalTripBudgetChangeSchema` on read; money as INTEGER minor units.

## Tests
- **Step 2 (schemas):** `trip.test.ts` — `budgetUpdatedAt` required and must be ISO with offset; `sync.test.ts`; `trip-budget.test.ts` — valid change, invalid uuid / float amount / negative amount / bad currency / missing offset; local row with each `syncStatus`, unknown status rejected; form rejects 0. `NearestTripSchema` valid / invalid fixtures. `buildTrip` sets `budgetUpdatedAt = createdAt` and takes `ownerId` from its deps.
- **Step 3 (migration, SQL tests in `supabase/tests/`, plain SQL with `ASSERT`, run by `pnpm test:db` against a database URL):**
  - user A creates a trip via `create_trip` → trip, 2 members, 4 segments exist; calling it again with the same ids → still one of each;
  - user B cannot select, update or delete A's trip, members or segments, and cannot insert a member/segment into A's trip;
  - a linked viewer (member row with `user_id` = C) can select the trip, its members and segments, but cannot update/insert/delete;
  - `anon` cannot select anything; `create_trip` as `anon` fails;
  - constraints reject: name of 61 chars, `end_date < start_date`, negative budget, lowercase currency, unknown interest tag, `arrive_at <= depart_at`;
  - budget update with an older `budget_updated_at` changes nothing; with a newer one it changes the amount.
- **Step 4 (rows):** `trip-rows.test.ts` — `CreatedTrip` → rows → `TripOverview` round-trip is equal; `order` ↔ `position`; missing optional fields map to `null` and back to absent; a server row with a bad value (e.g. `budget_per_person_minor: 1.5`) throws a Zod error.
- **Step 5 (auth):** `auth.test.ts` (Supabase client mocked) — existing session → no sign-in; no session → `signInAnonymously` once; sign-in error → rejects with it; `AppState` `active` → `startAutoRefresh`, `background` → `stopAutoRefresh`.
- **Step 6 (local store):** `local-store.test.ts` (real SQLite via Node's built-in `node:sqlite` behind a small test adapter with the same async API we use from `expo-sqlite` — no new dependency) — migrations run once and record `user_version`; overview cache write → read returns the parsed overview; a corrupt cached JSON → treated as no cache (not a crash); budget change saved as `pending`; a newer change replaces the older; mark `synced` deletes the row; mark `failed` keeps it with `attempts + 1`, error and `lastAttemptAt`.
- **Step 7 (repository + sync):** `supabase-trip-repository.test.ts` (Supabase client mocked, local store on `node:sqlite`):
  - `create` calls `ensureSession` then `create_trip` with rows built from the wizard input; RPC error → rejects (nothing cached);
  - `nearest` online → returns server data, writes the cache, `fromCache: false`; network error → returns the cache, `fromCache: true`; network error and no cache → rejects; no trips → `null`;
  - a pending local budget overrides the server's amount in `nearest` and gives `budgetSyncStatus: 'pending'`;
  - **offline save:** `setBudget` while the update fails with a network error → row stays `pending`, `nearest` shows the new amount;
  - **sync on reconnect:** `syncBudgets` sends `update … budget_updated_at < updatedAt` and removes the row on success;
  - **retry without duplicates:** the same change sent twice → same `update` filter, server state the same (idempotent);
  - **failed stays visible:** a non-network server error → `failed` with its error, still in `nearest` as `failed`; next retry only after the backoff delay;
  - `setBudget` rejects a currency different from the trip's base currency and a non-positive amount.
- **Step 8 (wiring):** `AppProviders` / hooks tests — `useSetTripBudget` invalidates `['trips']`; sync runs on app foreground and when `expo-network` reports connected again; `useIsOffline` follows the network state. Route test: dev build no longer shows example trips.
- **Step 9 (UI):** home tests — Budget card shows "Zmień"; tapping opens the sheet with the current amount and fixed currency; "Zapisz" with 0 → field error "Podaj kwotę większą od zera" (existing key); valid save closes the sheet and the card shows the new amount; `pending` → small indicator "Oczekuje na synchronizację"; `failed` → "Nie udało się zsynchronizować" + "Spróbuj ponownie"; offline → banner "Jesteś offline. Zmiany zapiszą się po połączeniu."; cached data offline still renders the trip (not the error state). pl/en key parity test covers the new keys.

## Files
- **Create:** `supabase/config.toml` (via `supabase init`), `supabase/migrations/<timestamp>_trips.sql` (via `supabase migration new`), `supabase/tests/trips_rls.sql`, `scripts/test-db.sh`, `src/schemas/sync.ts`, `src/schemas/trip-budget.ts` (+ tests), `src/data/database.types.ts` (generated), `src/data/trip-rows.ts`, `src/data/auth.ts`, `src/data/local-db.ts`, `src/data/local-store.ts`, `src/data/supabase-trip-repository.ts`, `src/data/budget-sync.ts` (+ tests for each), `src/test/node-sqlite.ts` (test adapter), `src/hooks/useNetwork.ts`, `src/components/BottomSheet.tsx`, `src/components/SyncIndicator.tsx`, `src/components/OfflineBanner.tsx`, `src/features/home/BudgetSheet.tsx` (+ tests).
- **Modify:** `package.json` (deps, `test:db` script), `src/schemas/trip.ts`, `src/schemas/index.ts`, `src/data/trip-repository.ts` (interface + `buildTrip` owner/`budgetUpdatedAt`), `src/data/supabase.ts` (url polyfill import), `src/hooks/useTrips.ts`, `src/providers/AppProviders.tsx`, `src/app/index.tsx`, `src/features/home/NearestTrip.tsx`, `src/i18n/locales/pl.json`, `en.json`, existing tests touched by `budgetUpdatedAt`, `GLOSSARY.md` (budget change, sync status), `CLAUDE.md` "Decisions made" offline scope (+ `Trip.budgetUpdatedAt` in Data structures), `Architecture.md`.
- **Delete (made unused by D8):** `src/data/example-trips.ts`, `src/data/example-covers.ts` + their tests, `assets/images/examples/`.

## Skills
- `supabase` — steps 3, 5, 7 — check current docs/changelog for anonymous sign-in, `GRANT`s for the Data API, RPC calls and the React Native auth refresh before writing them.
- `supabase-postgres-best-practices` — step 3 — table types, constraints, indexes on foreign keys, RLS policy performance (`(select auth.uid())`).
- `domain-modeling` — step 2 — add "budget change" and "sync status" to `GLOSSARY.md`.
- `frontend-design` — step 9 — structure of the bottom sheet, indicator and banner within `context/design-context.md`.
- `ui-taste` — step 9 — final visual review of the Budget card and sheet.

## Steps
- [ ] 1. Setup, **no tests** (pure tooling, no behavior): add `supabase` (dev), `expo-network`, `react-native-url-polyfill` with versions from Expo's bundled list; `supabase init`; `pnpm test:db` script (applies migrations + runs `supabase/tests/*.sql` with `psql` against `$DB_URL`). — skill: none — verify: `pnpm install`, full suite / typecheck / lint still green, `supabase --version`.
- [ ] 2. [backend] Zod: `budgetUpdatedAt`, `SyncStatusSchema`, `TripBudgetChangeSchema`, `LocalTripBudgetChangeSchema`, `TripBudgetFormSchema`, `NearestTripSchema`; `buildTrip` takes `ownerId`, sets `budgetUpdatedAt`. — skill: `domain-modeling` — tests first: step 2 list — verify: red → green, full suite, typecheck, lint.
- [ ] 3. [backend] Migration: tables, constraints, indexes, grants, RLS, `private.is_trip_viewer`, `create_trip`. — skill: `supabase`, `supabase-postgres-best-practices` — tests first: SQL tests (red: tables missing) — verify: `pnpm test:db` on a local Postgres 16 in this container with a minimal `auth` stub (no Docker here) **and** on Kacper's local Supabase (`supabase start`) before `db push`.
- [ ] 4. [backend] Generate `database.types.ts` + row mappers. — skill: none — tests first: step 4 list — verify: red → green, full suite, typecheck (= parity), lint.
- [ ] 5. [frontend] `ensureSession` + `AppState` auto-refresh; url polyfill import in `supabase.ts`. — skill: `supabase` — tests first: step 5 list — verify: as above.
- [ ] 6. [frontend] SQLite: `local-db.ts` (open + versioned migrations), `local-store.ts` (cache + budget changes). — skill: none — tests first: step 6 list — verify: as above.
- [ ] 7. [frontend] `createSupabaseTripRepository` + `budget-sync.ts` (send, backoff). — skill: `supabase` — tests first: step 7 list (incl. offline-sync cases from Verification loop §8) — verify: as above.
- [ ] 8. [frontend] Wiring: `AppProviders` uses the Supabase repository (example trips removed and their files deleted), hooks `useSetTripBudget`, `useIsOffline`, sync triggers (save, foreground, reconnect, backoff timer). — skill: none — tests first: step 8 list — verify: as above.
- [ ] 9. [frontend] UI: Budget card "Zmień", `BottomSheet`, `BudgetSheet`, `SyncIndicator`, `OfflineBanner`, i18n pl/en. — skill: `frontend-design`, `ui-taste` — tests first: step 9 list — verify: as above + manual steps.
- [ ] 10. Docs: `GLOSSARY.md`, `CLAUDE.md` (offline scope decision, `Trip.budgetUpdatedAt`), `Architecture.md`. — verify: everything described exists in code.

Each step goes through the verifier before `[x]`.

## Verification
- Every step: red first, then `pnpm test` (full), `pnpm typecheck`, `pnpm lint`.
- Step 3: `pnpm test:db` (RLS: A vs B, linked viewer read-only, anon nothing; constraints; idempotent `create_trip`; last-write-wins).
- Step 4: types regenerated from the migrated database; mappers typecheck against them (Zod ↔ DB parity).
- Steps 6–7: offline sync cases (save offline, sync on reconnect, retry without duplicates, failed stays visible). No soft delete here — budgets are never deleted.
- No live Supabase calls in Jest.
- **Kacper, before the app can work against the real project:**
  1. Dashboard → Authentication → Sign In / Providers → enable **Anonymous sign-ins**.
  2. `pnpm supabase login`, `pnpm supabase link --project-ref hwsqdlxojllclbwlhuwb`, `pnpm supabase start` (OrbStack/Docker), `DB_URL=<local url> pnpm test:db`, then `pnpm supabase db push`.
- **Manual device steps (Kacper):** create a trip online → it appears in the dashboard's Table Editor (`trips`, `trip_members` with interests, `flight_segments`); restart the app → the trip is still there; airplane mode → banner shows, the trip still shows; "Zmień" budget offline → new amount + "Oczekuje na synchronizację"; kill the app, reopen offline → still the new amount; turn internet on → indicator disappears and the dashboard shows the new amount; try to create a trip offline → error, wizard input kept.

## Risks & open questions
- **R1 — No Docker in this cloud session:** I can't run `supabase start` here. I'll run the migration and SQL tests on the plain Postgres 16 that is installed here, with a small stub of Supabase's `auth` schema and roles (test-only, not a migration). It is close but not identical to Supabase, so the final check is yours on local Supabase (step 3 verification) before `db push`.
- **R2 — Generating types needs a database:** `supabase gen types` normally needs Docker or a linked project. If it doesn't work against the local Postgres here, step 4 waits until you run `pnpm supabase gen types typescript --local > src/data/database.types.ts` and send the result (I'll mark it **blocked**, not guess types).
- **R3 — `node:sqlite` in Jest:** Node 22 has it built in; if jest-expo's environment can't load it, I'll come back to you (alternative: `better-sqlite3` as a dev dependency — needs your OK).
- **R4 — Anonymous user lost = trips lost:** if the app is deleted or its storage cleared, the anonymous session is gone and its trips can no longer be read (until e-mail/Apple linking exists). Fine for development; must be solved before real users.
- **R5 — Bottom sheet:** built on React Native `Modal` + `react-native-gesture-handler`/`reanimated` (already installed) for swipe-down; no new library.
- **R6 — `travellerCount`** stays `members + 1` (the organizer is not a member row, A4); this changes once the organizer becomes a member (out of scope).
