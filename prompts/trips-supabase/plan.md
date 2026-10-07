# Task: Trips in Supabase, trip budget editable offline
Status: awaiting approval — follow-up steps 11–12 (CodeRabbit review on PR #5); steps 1–10 done, awaiting Kacper's manual steps (anonymous sign-ins, `db push`, device check) and approval of the logged deviations

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
- [x] 1. Setup, **no tests** (pure tooling, no behavior): add `supabase` (dev), `expo-network`, `react-native-url-polyfill` with versions from Expo's bundled list; `supabase init`; `pnpm test:db` script (runs `supabase/tests/*.sql` with `psql` against `$DB_URL`). — skill: none — verify: `pnpm install`, full suite / typecheck / lint still green, `supabase --version`.
- [x] 2. [backend] Zod: `budgetUpdatedAt`, `SyncStatusSchema`, `TripBudgetChangeSchema`, `LocalTripBudgetChangeSchema`, `TripBudgetFormSchema`, `NearestTripSchema`; `buildTrip` takes `ownerId`, sets `budgetUpdatedAt`. — skill: `domain-modeling` — tests first: step 2 list — verify: red → green, full suite, typecheck, lint.
- [x] 3. [backend] Migration: tables, constraints, indexes, grants, RLS, `private.is_trip_viewer`, `create_trip`. — skill: `supabase`, `supabase-postgres-best-practices` — tests first: SQL tests (red: tables missing) — verify: `pnpm test:db` on a local Postgres 16 in this container with a minimal `auth` stub (no Docker here) **and** on Kacper's local Supabase (`supabase start`) before `db push`.
- [x] 4. [backend] Generate `database.types.ts` + row mappers. — skill: none — tests first: step 4 list — verify: red → green, full suite, typecheck (= parity), lint.
- [x] 5. [frontend] `ensureSession` + `AppState` auto-refresh; url polyfill import in `supabase.ts`. — skill: `supabase` — tests first: step 5 list — verify: as above.
- [x] 6. [frontend] SQLite: `local-db.ts` (open + versioned migrations), `local-store.ts` (cache + budget changes). — skill: none — tests first: step 6 list — verify: as above.
- [x] 7. [frontend] `createSupabaseTripRepository` + `budget-sync.ts` (send, backoff). — skill: `supabase` — tests first: step 7 list (incl. offline-sync cases from Verification loop §8) — verify: as above.
- [x] 8. [frontend] Wiring: `AppProviders` uses the Supabase repository (example trips removed and their files deleted), hooks `useSetTripBudget`, `useIsOffline`, sync triggers (save, foreground, reconnect, backoff timer). — skill: none — tests first: step 8 list — verify: as above.
- [x] 9. [frontend] UI: Budget card "Zmień", `BottomSheet`, `BudgetSheet`, `SyncIndicator`, `OfflineBanner`, i18n pl/en. — skill: `frontend-design`, `ui-taste` — tests first: step 9 list — verify: as above + manual steps.
- [x] 10. Docs: `GLOSSARY.md`, `CLAUDE.md` (offline scope decision, `Trip.budgetUpdatedAt`), `Architecture.md`. — verify: everything described exists in code.

Each step goes through the verifier before `[x]`.

## Follow-up: CodeRabbit review on PR #5 (2026-10-07)
Two findings, both checked against the code and the installed `@supabase/*` 2.117.2 sources.

**Understanding.** (F1, major) The shared Supabase client (`src/data/supabase.ts`) has no request timeout. A request that never answers (captive portal; React Native's Android HTTP client has no default timeout) never settles, so: (a) `syncBudgets()` chains every call behind the previous `syncing` promise → all later syncs (save, foreground, reconnect, retry timer) wait forever and pending budgets stay unsent until restart; (b) `nearest()` falls back to the device copy (D6) only when a request *fails* → the home screen stays on the skeleton. (F2, minor) Approach §1 says a retried create "never duplicates", but the progress log (verifier notes) says a retry after a lost response builds new ids and can create a second trip.

**Decisions (Kacper, 2026-10-07):**
- **D14 — Request timeout: 20 s** for every request of the shared client (database, RPC, auth).
- **D15 — Fixes go on the PR branch** `claude/serene-hopper-h3r80a` so they land in PR #5.

**Checked in the libraries (no guessing):**
- postgrest-js: an aborted fetch (`AbortError`) is not retried and comes back as `{ error, status: 0 }` → `budget-sync.ts` already maps it to `pending`, `fetchNearest` to `ServerUnreachableError` → device copy.
- auth-js `_handleRequest`: any rejected fetch (aborted included) → `AuthRetryableFetchError` → already `pending` / device copy.
- supabase-js passes `global.fetch` to both the REST client and the auth client.

**Approach.** A small `fetchWithTimeout(ms)` wrapper in its own module (`src/data/fetch-timeout.ts`, testable without env vars): an `AbortController` aborts the request after 20 s; the caller's own `signal` still aborts it; the timer is cleared when the response arrives. `supabase.ts` passes it as `global: { fetch }`. No new dependency, no schema change (no new data shape → no Zod step). Rejected: a timeout around `syncBudgets` / `nearest` only — it would release the queue but leave the request (and auth calls elsewhere) hanging.

**Tests (written first, must fail first):**
- `src/data/__tests__/fetch-timeout.test.ts` (fake timers): a request that never answers rejects with `AbortError` after 20 s and not before (19 999 ms still pending); an answer before 20 s is passed through unchanged and no abort happens later; the caller's own abort signal still aborts; method / headers / body reach the underlying fetch.
- `src/data/__tests__/supabase.test.ts`: the client is created with `global: { fetch }` where that fetch is the 20 s timeout wrapper (assert on the extended `createClient` options).
- `src/data/__tests__/supabase-trip-repository.test.ts` (integration, real `createClient` from `@supabase/supabase-js` + `fetchWithTimeout` over a stub fetch that never answers `/rest/v1/`, session pre-seeded in an in-memory auth storage so no auth request is made; fake timers; no network): (1) a stalled `trips` read → after 20 s `nearest()` resolves with the device copy and `fromCache: true`; (2) a stalled budget `update` → that sync ends with the change still `pending`, and a later `syncBudgets()` runs and sends it (the queue is not stuck). Offline-sync rules (Verification §8): saving while offline and failed-stays-visible are already covered; this adds "stalled request → pending, next sync still runs".

**Files:** new `src/data/fetch-timeout.ts`, `src/data/__tests__/fetch-timeout.test.ts`; modified `src/data/supabase.ts`, `src/data/__tests__/supabase.test.ts`, `src/data/__tests__/supabase-trip-repository.test.ts`, `prompts/trips-supabase/plan.md` (F2 wording), `Architecture.md`.

**Skills:** `supabase` — step 11 — client options and network-error shapes (already checked in `node_modules`, see above).

**Steps:**
- [ ] 11. [frontend] 20 s request timeout on the shared Supabase client. — skill: `supabase` — tests first: the three test groups above (red: module missing / no `global.fetch` / repository hangs past 20 s) — verify: red → green, `pnpm test` (full), `pnpm typecheck`, `pnpm lint`, verifier.
- [ ] 12. Docs, **no tests** (wording only, no behavior): Approach §1 — "on conflict (id) do nothing makes a retry with the *same* ids a no-op; the app builds new ids per attempt, so retrying after a lost response can create a second trip (known, A3)"; `Architecture.md` — client timeout in Data flow / Known limitations, changelog line. — verify: everything described exists in code.

**Not acted on:** CodeRabbit's ESLint failure (`expo/tsconfig.base` not found — its sandbox had no `node_modules`; `pnpm lint` is green locally); docstring coverage 49 % < 80 % (CodeRabbit's default check, not a project rule).

**Risks:** R7 — the integration test needs the real `createClient` inside jest-expo: probed before the plan (throwaway test, deleted) — `AbortController`, `Headers`, `Response` exist and a query with a stub `global.fetch` works. If fake timers turn out to clash with supabase-js internals, I stop and ask before changing the test approach.

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

## Decisions during execution
- **D9 (Kacper, 2026-10-06):** `@types/node ~22` as a devDependency (tests read the migration file and use Node's built-in SQLite); `tsconfig` `types: ["jest", "node"]`.

- **D10 (Kacper, 2026-10-06) — Sync indicator:** a line under the amount on the Budget card: pending → `Clock` 16dp + "Czeka na wysłanie" (info colour); failed → `CircleX` 16dp + "Nie udało się wysłać" (error colour) + ghost "Spróbuj ponownie". Synced → no line.
- **D11 — Offline banner:** pinned just above "Utwórz podróż" at the bottom of the home screen (thumb zone, does not cover the photo); `WifiOff` icon + design-context copy, info colours.
- **D12 — Sheet scrim:** new token `colors.overlay.scrim` = ink `#17211B` at 50 % opacity.
- **D13 — After "Zapisz":** the sheet closes; the card shows the new amount (and the indicator while not sent). No snackbar.

## Risks & open questions
- **R1 — No Docker in this cloud session:** I can't run `supabase start` here. I'll run the migration and SQL tests on the plain Postgres 16 that is installed here, with a small stub of Supabase's `auth` schema and roles (test-only, not a migration). It is close but not identical to Supabase, so the final check is yours on local Supabase (step 3 verification) before `db push`.
- **R2 — Generating types needs a database:** `supabase gen types` normally needs Docker or a linked project. If it doesn't work against the local Postgres here, step 4 waits until you run `pnpm supabase gen types typescript --local > src/data/database.types.ts` and send the result (I'll mark it **blocked**, not guess types).
- **R3 — `node:sqlite` in Jest:** Node 22 has it built in; if jest-expo's environment can't load it, I'll come back to you (alternative: `better-sqlite3` as a dev dependency — needs your OK).
- **R4 — Anonymous user lost = trips lost:** if the app is deleted or its storage cleared, the anonymous session is gone and its trips can no longer be read (until e-mail/Apple linking exists). Fine for development; must be solved before real users.
- **R5 — Bottom sheet:** built on React Native `Modal` + `react-native-gesture-handler`/`reanimated` (already installed) for swipe-down; no new library.
- **R6 — `travellerCount`** stays `members + 1` (the organizer is not a member row, A4); this changes once the organizer becomes a member (out of scope).

## Progress log
- Step 1 (setup, no tests): added `expo-network ~57.0.2` (Expo bundled version), `react-native-url-polyfill ^4.0.0` (not in Expo's bundled list; latest), `supabase ^2.119.0` (dev; CLI binary works via `npx supabase`); `supabase init` → `supabase/config.toml` (+ its `.gitignore`), local `enable_anonymous_sign_ins = true` (D2); `pnpm test:db` → `scripts/test-db.sh` runs every `supabase/tests/*.sql` with `psql` against `$DB_URL` (each file rolls back). Deviation: the script does not apply migrations — `supabase start` / `supabase db reset` already do that on local Supabase. Note: these are plain-SQL tests, not pgTAP, so use `pnpm test:db`, not `supabase test db`. Suite 48/501, typecheck, lint ✓. Throwaway Postgres 16 started in the session scratchpad for step 3 (R1). skill used: none.
- Step 2: tests written — `src/schemas/__tests__/trip-budget.test.ts` (new, 26 cases: `SyncStatus`, `TripBudgetChange`, `LocalTripBudgetChange`, `TripBudgetForm`, `NearestTrip`), `entities.test.ts` (+`budgetUpdatedAt` required / with offset), `trip-repository.test.ts` (`buildTrip` takes `ownerId`, sets `budgetUpdatedAt = createdAt`; in-memory repo owns trips by `LOCAL_OWNER_ID`) · red ✓ (schemas undefined; `budgetUpdatedAt` missing; `ownerId` still the constant) · added `src/schemas/sync.ts`, `src/schemas/trip-budget.ts`, exports; `TripSchema.budgetUpdatedAt`; `buildTrip` deps `{ now, newId, ownerId }`; `budgetUpdatedAt` added to the trip fixtures in `TripHero.test.tsx` and `home.test.tsx` (required field, no assertion changed) · green ✓ · suite 49/528, typecheck, lint ✓ · `GLOSSARY.md`: "Budget change", "Sync status" · skill used: `domain-modeling`.
- Step 3: tests written — `supabase/tests/trips_rls.sql` (plain SQL, helpers `login` / `logout` / `ok` / `throws` in a rolled-back `test_helpers` schema; 40 checks: A creates via `create_trip` and sees 1 trip / 2 members (with interests) / 3 segments; `owner_id` in the payload ignored; retry adds nothing; last write wins on the budget (older ignored, newer applied, resend no-op); constraints (61-char / empty name, end < start, negative budget, lowercase currency, non-IATA destination, unknown interest, blank display name, arrival not after departure, duplicate direction+position); stranger B sees nothing, its updates/deletes change nothing, inserts → 42501, reusing A's trip id in `create_trip` → 42501; linked viewer C reads trip/members/segments, writes change nothing / 42501; anon → 42501 on read and `create_trip`) · red ✓ (`create_trip` does not exist) · added `supabase/migrations/20261006090351_trips.sql` (created with `supabase migration new`): `trips`, `trip_members`, `flight_segments` with checks mirroring Zod, FK indexes, `private.is_trip_owner` / `private.is_trip_viewer` (security definer, `search_path = ''`, not exposed, execute only for `authenticated`), RLS policies `to authenticated` with `(select auth.uid())`, explicit revoke from `anon` / grant to `authenticated`, `public.create_trip(trip, members, segments)` (security invoker, `on conflict (id) do nothing`, owner = caller) · green ✓ on plain Postgres 16 in this session with a Supabase `auth` stub (roles, `auth.users`, Supabase's `auth.uid()` body, Supabase-like default privileges) kept outside the repo (R1) · mutation check: disabling RLS on `trips` → "B cannot see A's trip" fails; an always-true member insert policy → "B cannot add a member" fails · Jest suite 49/528, typecheck, lint ✓ · Deviations: `flight_segments` has no separate `trip_id` index — the unique `(trip_id, direction, position)` index covers it; `trip_members.user_id` is `on delete set null`. Docs fetched via Context7 (supabase.com is blocked by this session's network policy): explicit grants for Data API exposure confirmed. **Pending on Kacper's machine:** `supabase start` + `pnpm test:db` on real local Supabase, `supabase db advisors`. · skills used: `supabase`, `supabase-postgres-best-practices`.
- Step 4: tests written — `src/data/__tests__/trip-rows.test.ts` (15 cases: `toCreateTripArgs` trip / members / segments / cover; `overviewFromRows` round trip, nulls → absent fields, member details kept, Postgres `+00:00` timestamps, segments ordered outbound → return by position, members ordered by name, bad trip rows (fraction, lowercase currency, no offset) / unknown interest / unknown direction throw; parity: the migration's interest list = `InterestTagSchema`) · red ✓ (module `@/data/trip-rows` missing) · `src/data/database.types.ts` generated with `supabase gen types typescript --db-url …?sslmode=disable --schema public` from the migrated local Postgres (R2 resolved without Docker); `pnpm db:types` script for regenerating from local Supabase (`--local`); `src/data/trip-rows.ts` typed against the generated `Row` / `Insert` / `create_trip` `Args` (parity = typecheck) · green ✓ · suite 50/543, typecheck, lint ✓ · Deviations: added `@types/node` (D9, asked first); members have no stored order, so `overviewFromRows` sorts them by name (the wizard order is not kept) — to confirm with Kacper; the generated file is unformatted CLI output, left as generated. · skill used: none.
- Step 5: tests written — `src/data/__tests__/auth.test.ts` (7 cases: stored session → no sign-in; no session → `signInAnonymously` once; concurrent calls share one sign-in; sign-in error rejects and the next call retries; `getSession` error rejects; `AppState` active → `startAutoRefresh`, background → `stopAutoRefresh`; dispose removes the listener), `supabase.test.ts` (+ URL polyfill loaded before `createClient`) · red ✓ (module `@/data/auth` missing; polyfill not imported) · added `src/data/auth.ts` (`ensureSession` returns the user id, in-flight sign-in shared per client; `keepSessionFresh(auth, appState)`), `import 'react-native-url-polyfill/auto'` first in `src/data/supabase.ts` (closes supabase-client Q1) · green ✓ · suite 51/551, typecheck, lint ✓ · Deviations: added the "share one sign-in" behavior (two screens starting together would otherwise create two anonymous users); `keepSessionFresh` is wired in step 8. Docs via Context7 (Supabase React Native quickstart: `react-native-url-polyfill/auto`, AppState start/stop auto refresh, skipped on web). · skill used: `supabase`.
- Step 6: tests written — `src/data/__tests__/local-db.test.ts` (4: tables created + `user_version` 1; migrations run once, data kept; `amount_minor` is INTEGER; `openLocalDb` opens `travelo.db` and migrates), `local-store.test.ts` (12: empty cache; cache round trip; only the latest nearest kept, `null` clears; corrupt / outdated JSON → no copy; budget change saved as pending with 0 attempts; newer change replaces older and resets to pending; unsynced list has pending + failed; synced → removed; a newer change saved during sending survives `markBudgetSynced`; failed attempts count up with error and time; unreachable server → still pending with the attempt counted; a row not matching the schema throws) · red ✓ (module `@/data/local-db` missing) · added `src/data/local-db.ts` (`LocalDb` interface = the expo-sqlite methods used; versioned `MIGRATIONS` run in one transaction each with `pragma user_version`; `openLocalDb`), `src/data/local-store.ts` (`createLocalStore`: `cacheNearest` / `cachedNearest`, `saveBudgetChange` (upsert), `budgetChange`, `unsyncedBudgetChanges`, `markBudgetSynced`, `recordBudgetAttempt`), test adapter `src/test/node-sqlite.ts` (Node's built-in SQLite, R3 resolved — no new dependency) · green ✓ · suite 53/567, typecheck, lint ✓ · Deviation: the cache holds only the last nearest trip (replaced on each server read) instead of one row per trip — the home screen only needs that one. Every row read is parsed with Zod; the budget row is its own outbox (one statement, so atomic). · skill used: none.
- Step 7: tests written — `src/data/__tests__/supabase-trip-repository.test.ts` (24 cases, fake Supabase client `src/test/fake-supabase.ts` recording every query chain + real SQLite on `node:sqlite`): create (signs in, one `create_trip` RPC with the mapped rows; anonymous sign-in on first launch; server refusal / offline reject and cache nothing; invalid input never reaches the server); nearest (query shape `select('*, trip_members(*), flight_segments(*)').order('start_date').order('created_at').limit(1)`; null + cache cleared; copy shown offline with `fromCache: true`, also when sign-in fails for lack of connection; no copy → rejects; server error is not hidden behind the copy; bad row rejects); budget (save without network; base currency, non-positive / fractional rejected; offline → new amount shown as pending, also from the copy; reconnect → `update … eq(id) lt(budget_updated_at) select(id)` and the row is forgotten; retry of the same change sends an identical update and ends synced; refusal → `failed` with its error, visible in `nearest`; trip invisible on the server → `failed` `trip-not-found` (never dropped silently); backoff `nextAttemptAt` 1 s then 2 s; nothing to retry → null; a newer server budget wins; one sync at a time), `budget-sync.test.ts` (backoff 1/2/4/8 s, cap 5 min), `trip-repository.test.ts` (+ in-memory `setBudget`, `syncBudgets`) · red ✓ (modules missing) · added `src/data/budget-sync.ts` (`retryDelayMs`, `syncBudgetChanges`: unreachable (postgrest status 0 / `AuthRetryableFetchError`) → pending, refused → failed; 0 rows updated → checks the server's `budget_updated_at` before calling it synced), `src/data/supabase-trip-repository.ts`; `TripRepository` now returns `NearestTrip` and has `setBudget(trip, amountMinor)` + `syncBudgets()`; in-memory implementation updated · green ✓ · suite 55/593 (55 suites — miscounted as 56 before, verifier), typecheck, lint ✓ · Deviations: (1) `setBudget` takes the trip and builds the money in its base currency, so a wrong currency cannot be passed (the planned "rejects another currency" test is moot); (2) `setBudget` only writes SQLite — the hook triggers the sync after saving (step 8), keeping saving free of network waits; (3) backoff is applied by scheduling (`nextAttemptAt`), every trigger sends all waiting changes; (4) `nearest()` returns `NearestTrip`, so `src/app/index.tsx` passes `data.overview` and the existing hook/route tests read `data.overview` (shape change only, no assertion weakened); the home test's repository mock wraps its overview the same way. · skill used: `supabase` (postgrest-js and auth-js network-error shapes checked in `node_modules`).
- Verifier (steps 1–7, one run, fresh context): **PASS**, no blockers. It re-ran typecheck / lint / Jest, `pnpm test:db` on the local Postgres, and regenerated the types (identical to `database.types.ts`). Notes and what was done:
  - (major) the device copy kept the old budget after a successful sync → fixed: `markBudgetSynced` writes the synced amount into the copy of that trip first (unless the copy is already newer), then forgets the change; `BudgetSyncProvider` cancels an in-flight trips read before refetching. Tests: local-store "writes the synced amount into the device copy…", "leaves the copy alone…"; repository "after a successful sync, going offline shows the new amount from the copy, as synced".
  - (minor) a newer server budget showed the stale local status → now `synced`; test extended.
  - (minor) a failed local migration left an open transaction → `rollback` then rethrow; test "rolls a failed migration back…".
  - (minor) RLS test gaps → added: owner cannot change `owner_id`; B cannot insert a trip owned by A, delete members, update segments; C cannot update segments; anon cannot call `private.is_trip_owner`. `pnpm test:db` ✓.
  - (needs Kacper) step 7 deviations 1–3 and member order by name (step 4) — asked in the final report. Retrying a create after a lost response can create a second trip (new ids per attempt; A3 — creation is online) — reported. A rejected refresh token makes `ensureSession` fail until the app data is cleared (R4) — reported.
  - (process) steps 1–7 were marked `[x]` before the verifier ran; noted here.
- Step 8: tests written — `src/data/__tests__/app-trip-repository.test.ts` (3: Supabase repository with the app client and the opened SQLite store; `keepSessionFresh` on phones, not on web), `src/providers/__tests__/BudgetSync.test.tsx` (10: sync on start online; none while offline, sync when the connection is back; sync on foreground; retry when the backoff delay is over (fake timers); trips refetched after a sync; a failing sync does not crash; `useIsOffline` for 4 network states), `useTrips.test.tsx` (+3: `useSetTripBudget` saves, refreshes, requests a sync; saves while TanStack thinks it is offline; `useNearestTrip` runs offline) · red ✓ (modules / hook missing; offline query paused) · added `src/data/app-trip-repository.ts` (`createAppTripRepository`), `src/providers/BudgetSync.tsx` (`BudgetSyncProvider`, `useRequestBudgetSync`, `useIsOffline` on `expo-network`'s `useNetworkState`), `useSetTripBudget` (`networkMode: 'always'`), `useNearestTrip` `networkMode: 'always'`; `AppProviders` uses the app repository and wraps children in `BudgetSyncProvider`; `jest.setup.ts` (`setupFilesAfterEnv`) mocks `@/data/app-trip-repository` with the in-memory repository and `expo-network` with `src/test/mock-network.ts` (online by default); home / summary route tests mock `@/data/app-trip-repository` instead of the in-memory factory · deleted (D8): `src/data/example-trips.ts`, `example-covers.ts`, their tests, `assets/images/examples/`; the in-memory repository lost its `initial` trips parameter and its 2 tests (only the example trips used it) · green ✓ · suite 55/593, typecheck, lint ✓ · Deviations: the React Compiler lint forbids a callback referring to itself and setState in an effect, so the retry timer calls the latest `sync` through a ref. · skill used: none.
- Step 9: decisions D10–D13 asked first (design-context had no answer for the indicator, banner placement, scrim, after-save). Tests written — `theme.test.ts` (+ `overlay.scrim` in both themes), `money.test.ts` (+ `formatAmountInput`: pl/en separators, 0/3-digit currencies, round trip with `parseAmountToMinor`), `SyncIndicator.test.tsx` (4: synced → nothing; pending → "Czeka na wysłanie" in info colour, no button; failed → "Nie udało się wysłać" in error colour + retry; English), `OfflineBanner.test.tsx` (2: copy + polite live region; English), `BottomSheet.test.tsx` (6: header + content; hidden; 36×4 handle, 24dp top corners, 90 % max, elevated surface; backdrop "Zamknij" with the scrim closes; reduced motion → no slide; system back closes), `home.test.tsx` (+14: "Zmień budżet" opens the sheet with the current amount and fixed currency; solo wording; 0 / empty / text not saved with the wizard's messages; save → `setBudget(trip, 250050)`, sheet closes, card shows "2500,50 THB" + "Czeka na wysłanie", sync requested; device save failure keeps the sheet with "Nie udało się zapisać. Spróbuj ponownie." (announced); backdrop closes without saving; pending / failed (+ retry sends) / synced on the card; English; offline: trip from the copy with the banner above "Utwórz podróż", budget still changeable, banner on the empty screen too, no banner online) · red ✓ (modules missing, no button, token undefined) · added `src/components/BottomSheet.tsx` (RN `Modal` + `PanResponder` swipe-down on the handle area, `KeyboardAvoidingView` on iOS, safe-area bottom padding), `SyncIndicator.tsx`, `OfflineBanner.tsx`, `src/features/home/BudgetSheet.tsx`, `formatAmountInput` in `src/lib/money.ts`, `palette.overlay.scrim` + `colors.overlay` in the theme, pl/en keys (`home.changeBudget`, `home.saveBudget`, `home.saveBudgetError`, `sync.*`, `offline.banner`, `common.close`); `NearestTrip` gets `budgetSyncStatus`, a "Zmień" ghost button in the Budget card header (screen reader: "Zmień budżet"), the indicator and the banner; `src/app/index.tsx` passes the status and shows the banner on the empty / error screens · green ✓ · suite 58/625, typecheck, lint ✓ (also with `TZ=America/Los_Angeles`) · ui-taste review (code + design-context only — the app cannot be rendered in this session without the Supabase keys): added reduced-motion handling and the iOS announcement of a save error; the rest left for the manual check · Deviations: the sheet repeats the wizard's 8-line amount validation instead of sharing it (refactoring the wizard step was out of scope); swipe-down is not covered by a test (PanResponder gestures cannot be driven in Jest) — manual step. · skills used: `frontend-design`, `ui-taste`.
- Verifier (steps 8–9 + fixes after the first review, fresh context): **FAIL**, 1 blocker — `useSetTripBudget` awaited the trips refetch (a Supabase read) in `onSuccess`, so the sheet closed and the sync started only after a server round trip (a hanging request kept the spinner forever). Fixed test-first: home test "closes right after saving on the device, without waiting for Supabase" (red ✓: sheet stayed open) → the invalidation is no longer awaited and the sync is requested at once · green ✓. Minor notes applied: the 8dp swipe start threshold is named (`SWIPE_START`); the offline banner is now also asserted on the error screen. Left as is (noted): a thrown `syncBudgets` waits for the next trigger instead of a timer; every sync refetches the trips (one extra read at start). Note for the manual check: the sheet is dark (it opens from the always-dark home screen) and the 50 % ink scrim barely shows over the ink hero. Suite 58/627, typecheck, lint ✓; `pnpm test:db` ✓ (verifier).
- Step 10: `GLOSSARY.md` (step 2), `CLAUDE.md` (offline scope decision, `Trip.budgetUpdatedAt`, `TripBudgetChange` / `LocalTripBudgetChange`), `Architecture.md` (overview, tree, modules, data model with server + SQLite tables, data flow, backend, frontend, testing, tooling, dependencies, services, decisions, limitations, changelog). PR: KacperBartlomiejczak/Travelo#5 (draft).
