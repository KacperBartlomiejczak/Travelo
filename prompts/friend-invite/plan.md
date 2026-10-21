# Task: Friend invite by code (+ layover label alignment)
Status: done (2026-10-21) — nothing committed yet; migration history on the hosted project still needs `supabase migration repair` (see progress log)

## Understanding & assumptions
The organizer can link a friend who has an account to a trip by typing that friend's **friend code** (6 chars, e.g. `5ZMRX8`)
in the create-trip wizard, step "Znajomi". The linked friend then sees the trip in their own app, **read-only**.
Separately, the layover label is mis-indented on the home screen and in the wizard summary.

"Done" means:
- In step 2 of the wizard every friend card has an optional "Kod znajomego" field. After the 6th character the code is checked
  on the server. A found code fills the card with the friend's nick and interests (not editable); without a code the card works as today.
- "Utwórz podróż" saves linked friends as `trip_members` rows with `user_id` set (role `viewer`).
- The linked friend sees the trip in the side panel and on "Podróż", without any edit controls, and "Podróżni" shows
  "<organizer nick> (organizator)", "Ty", then the others.
- The layover label on "Podróż" → "Loty" and in the summary's "Loty" card lines up with the flight text (no left inset).
  The wizard's flights step keeps its 16 dp inset between cards (trip-create-wizard D27).

### Decisions (Kacper, 2026-10-20)
- **D1 — Invite model:** a valid code links the friend **at once**, no acceptance step. The friend is a linked, read-only member (existing `trip_members.user_id` + RLS).
- **D2 — Scope:** wizard + the trip visible to the friend, read-only. The friend code is **not** shown on the Profile screen in this feature (separate feature).
- **D3 — Wizard UI:** the code is a field inside each friend card ("Kod znajomego (opcjonalnie)"). A found code shows the nick and the profile's interests, not editable.
- **D4 — Friend's "Podróżni":** "<organizer nick> (organizator)", "Ty", then the other members by name. Needs a server function that gives the organizer's nick to the trip's participants.
- **D5 — When to check:** right after the 6th character (like the e-mail code), uppercase forced while typing. Offline: field disabled with a message.
- **D6 — Organizer's view:** no marker for linked friends; they show like any friend (their nick).
- **D7 — Copy (pl):** unknown "Nie ma użytkownika z tym kodem." · own "To Twój kod." · duplicate "Ten znajomy jest już dodany." · offline "Połącz się z internetem, żeby sprawdzić kod." · server error "Nie udało się sprawdzić kodu. Spróbuj ponownie."
- **D12 — Link only by code (Kacper, 2026-10-20, answer to R4):** the server links an account to a trip only from a friend code it resolves itself; a `user_id` sent by the app is never trusted. See "Plan change — step 2b".
- **D13 — Unresolved code blocks "Dalej" (Kacper, 2026-10-20):** a card whose code field is not empty and not found (unknown, own, duplicate, incomplete, check failed or pending) blocks "Dalej", which scrolls to it like a missing name. Incomplete code (1–5 chars): "Kod ma 6 znaków." / "The code has 6 characters."
- **D14 — Server rejects a code on "Utwórz podróż" (Kacper, 2026-10-20):** the summary shows the specific D7 text (own / unknown / duplicate) in the place of the generic save error; the user fixes it through "Zmień" on the friends card.
- **D15 — Keep the cached organizer nick (Kacper, 2026-10-20):** a refresh whose organizer rpc returns nothing does not overwrite a nick already in the SQLite copy (small data-layer change, done in step 5). With no nick at all, the first "Podróżni" row reads "Organizator" / "Organizer".
- **D16 — Checking copy (Kacper, 2026-10-20):** while the code is checked a spinner row under the field reads "Sprawdzam kod…" / "Checking the code…" (also its accessibility label).
- **D17 — Linked member's photos (Kacper, 2026-10-20):** a trip without photos shows no photo strip at all for a linked member; the "Bez internetu nie dodasz ani nie usuniesz zdjęć." hint is hidden for them (strip and viewer); the "Jesteś offline" banner stays.
- **D8 — Layover alignment:** fix on "Podróż" (Loty) and in the wizard summary; the wizard flights step keeps D27's inset.

### Assumptions (please confirm — see Risks & open questions)
- A1. The linked member's `displayName` is a **snapshot** of the nick at save time (no live rename).
- A2. "Is this my trip?" = `trip.ownerId === myProfile.id`; the own profile is cached in SQLite, so this works offline too (session `userId` can be null on an offline start).
- A3. The read-only view hides: the ⋮ trip menu, budget "Zmień", the photo strip's "+" tile and the delete button in the photo viewer. Everything else (flights, hero, photos) shows as for the owner.
- A4. The organizer's nick is cached with the trip overview (SQLite), so the friend's "Podróżni" works offline.
- A5. The second test account is created by Kacper on the device (sign-in + profile); no test account is created by agents.

## Approach
Reuse what exists: `trip_members.user_id` and the "owners write / linked members read" RLS already work, `create_trip` already inserts `user_id`.
New server pieces are two small `security definer` functions (lookup by code, organizer nick) and two guards (no duplicate link, no self-link).
The app adds a lookup to `ProfileRepository`, a code field in `FriendCard`, an `organizerUsername` on the overview, and a read-only mode on the home screen.
Rejected: opening `profiles` to everyone through an RLS select policy — it would expose every profile (friend codes included) to any signed-in user.

## Data structures (Zod)
```ts
// src/schemas/profile.ts
/** User input for a friend code: trimmed and uppercased, then the same rules as FriendCodeSchema. */
export const FriendCodeInputSchema = z.string().trim().toUpperCase().pipe(FriendCodeSchema);
/** What `find_profile_by_friend_code` returns: enough to fill a friend card (D3). */
export const FoundFriendSchema = ProfileSchema.pick({ username: true, interests: true }); // 2b: no account id
export type FoundFriend = z.infer<typeof FoundFriendSchema>;

// src/schemas/create-trip-form.ts
export const FriendInputSchema = z.object({
  displayName: ...unchanged,
  interests: ...unchanged,
  /** 2b (D12): set when the code was found; null = friend without an account. The server resolves it to an account. */
  friendCode: FriendCodeSchema.nullable().default(null),
});
export const FriendsStepInputSchema = z.object({ friends: z.array(FriendInputSchema) })
  .superRefine(/* no two friends with the same non-null friendCode → 'validation.friendDuplicate' on friends[i].friendCode */);

// src/schemas/member.ts (2b)
/** The member payload `create_trip` receives (snake_case); `friend_code` nullish, no `user_id`. */
export const CreateTripMemberPayloadSchema = ...;

// src/schemas/trip.ts
export const TripOverviewSchema = z.object({
  trip, members, segments,  // unchanged
  /** The organizer's nick, only when the signed-in user is a linked member, not the owner (D4). Old cached copies lack it. */
  organizerUsername: UsernameSchema.optional(),
});
```
The wizard's draft keeps the typed text of the code as UI state (e.g. `codeText: string`), not in the schema; `friendCode` is set only after a successful lookup and cleared when the text changes (D9).

DB (mirrors the schemas; `20261020120000_friend_invite.sql`, then `20261020130000_friend_invite_code_only.sql` from step 2b — final state described in "Plan change — step 2b"):
- `public.find_profile_by_friend_code(code text) returns table (id uuid, username text, interests text[])` — `security definer`, `authenticated` only, exact match, returns 0 or 1 row.
- `public.trip_organizer_username(trip_id uuid) returns text` — `security definer`; the owner's nick when the caller is the owner or a linked member, else null.
- `create unique index trip_members_trip_user_key on trip_members (trip_id, user_id) where user_id is not null`.
- `create_trip` replaced (`create or replace`, new migration) to reject a member whose `user_id` = the caller.

## Tests
- **Step 1 (Zod):** `FriendCodeInputSchema` accepts ` 5zmrx8 ` → `5ZMRX8`, rejects 5/7 chars and look-alikes (`0 O 1 I L`); `FoundFriendSchema` valid/invalid fixtures; `FriendInputSchema` defaults `userId` to null, rejects a non-UUID; `FriendsStepInputSchema` rejects two friends with the same `userId`, accepts two with null; `TripOverviewSchema` accepts with and without `organizerUsername`, rejects an invalid nick. `CreateTripInputSchema` still passes with linked friends.
- **Step 2 (SQL, `supabase/tests/`, `pnpm test:db`):** lookup returns the profile for a valid code, nothing for an unknown code, is not callable by `anon`; `trip_organizer_username` returns the nick to the owner and to a linked member, null to user C; `create_trip` with the same `user_id` twice fails; with `user_id = auth.uid()` fails; a linked viewer still cannot update trips/members/segments/budget; user B still cannot read user A's trip. Parity test extended for the new schema fields; `pnpm db:types` regenerated.
- **Step 3 (data):** `ProfileRepository.findByFriendCode` — found → `FoundFriend`, unknown → null, invalid code → `ZodError` before any request, malformed server row → rejects, offline/unreachable → rejects with the existing unreachable error; in-memory version for tests. (2b) `buildTrip` keeps `userId: null`; the code travels to the `create_trip` payload as `friend_code`. `current()` sets `organizerUsername` only when the trip's owner is not the caller; it is stored in and read back from the SQLite copy.
- **Step 4 (wizard):** typing lowercase shows uppercase; 6th char triggers one lookup; found → nick + interests shown read-only, `friendCode` in the draft; each D7 message for unknown / own / duplicate / offline / server error; clearing the code returns the card to manual entry; "Dalej" blocks a pending check; summary lists the linked friend by nick; created trip input contains the `userId`.
- **Step 5 (read-only home):** as owner — ⋮, "Zmień", "+" tile visible (unchanged). As linked member — none of them rendered, "Podróżni" reads "<nick> (organizator)", "Ty", others by name; works from the offline copy. Photo viewer hides delete for a linked member.
- **Step 6 (layover):** `LayoverLabel` has no left inset on home and summary, keeps 16 dp in the wizard flights step (style asserted in component tests).

## Files
- Modify: `src/schemas/profile.ts`, `src/schemas/create-trip-form.ts`, `src/schemas/trip.ts`, `src/schemas/index.ts`, `src/schemas/__tests__/*` (profile, create-trip-form, trip, parity).
- Create: `supabase/migrations/<ts>_friend_invite.sql`, `supabase/tests/friend_invite.sql`.
- Modify: `src/data/database.types.ts` (regenerated), `src/data/profile-repository.ts`, `src/data/supabase-profile-repository.ts`, `src/data/trip-repository.ts`, `src/data/supabase-trip-repository.ts`, `src/data/trip-rows.ts` (if the overview mapping lives there), tests in `src/data/__tests__/`.
- Modify: `src/features/trip-create/FriendCard.tsx`, `src/features/trip-create/draft.ts`, `src/app/trips/new/friends.tsx`, `src/app/trips/new/summary.tsx` (D14), new hook `src/hooks/useFriendLookup.ts`, `src/i18n/` (pl, en), tests in `src/features/trip-create/__tests__/`, `src/__tests__/app/trips/new/`.
- Modify: `src/features/home/CurrentTrip.tsx`, the photo viewer `src/app/trips/[tripId]/photos.tsx` + `src/features/trip-photos/PhotoViewer.tsx`, `src/features/trip-photos/PhotoStrip.tsx`, tests in `src/__tests__/app/home.test.tsx` and photo tests.
- Modify: `src/components/LayoverLabel.tsx`, `src/app/trips/new/index.tsx`, its test.
- At the end: `Architecture.md`, `context/app-context.md` (roadmap + screens).

## Skills
- `test-driven-development` — every step — red → green for each step.
- `incremental-implementation` — steps 3–6 — one coherent diff per step.
- `security-and-hardening` + `doubt-driven-development` — step 2 — `security definer` functions, RLS, a lookup that exposes profiles.
- `source-driven-development` — steps 2–3 — Supabase docs on `security definer`/`search_path` and `rpc()`.
- `frontend-ui-engineering` — steps 4–6 — field states, accessibility, read-only mode.
- `code-review-and-quality` — verifier, every step.

## Plan change — step 2b (D12, approved by Kacper 2026-10-20)
Why: after step 2 anyone who knows a user's id (co-members' `user_id`s are readable to linked members) could link that user to their own trip without the code.
Change:
- **Zod (first):** `FriendInputSchema.userId` → `friendCode: FriendCodeSchema.nullable().default(null)` (set when the code was found; null = friend without an account); the duplicate refine compares `friendCode` (`validation.friendDuplicate`). `FoundFriendSchema` = `ProfileSchema.pick({ username, interests })` — the lookup no longer returns the account id at all. "To Twój kod." is checked on the phone by comparing with the own profile's `friendCode` (works offline, no request).
- **New migration** `20261020130000_friend_invite_code_only.sql` (step 2's migration is not edited):
  - `find_profile_by_friend_code` re-created to return `(username, interests)` only.
  - `create_trip`: a member's `user_id` from the payload is ignored (stored null); a member with `friend_code` is linked by a `security definer` helper in the `private` schema (not exposed to the API) that resolves the code, checks the caller owns the trip, and sets `user_id`. Unknown code → SQLSTATE `FI002`, own code → `FI001`, same friend twice → `23505`.
  - Direct writes: the "Owners add members" insert policy gets `user_id is null`; `update (user_id)` on `trip_members` is revoked from `authenticated` (other columns stay updatable). Only the helper can set `user_id`.
  - Types regenerated, parity tests updated.
- **Tests first:** step 1 schema tests updated for `friendCode`/no `id`; SQL: lookup returns no id; `create_trip` with a raw `user_id` and no code → stored null; with a code → linked to the right account; unknown code → `FI002`; own code → `FI001`; duplicate → `23505`; direct insert with `user_id` → denied; direct `update set user_id` → denied; owner can still update other member columns; viewer still read-only; C sees nothing.
- **Step 3 changes:** the app sends `friend_code` per member in the `create_trip` payload instead of `user_id`; `findByFriendCode` returns `{ username, interests }`; error mapping `FI001`/`FI002`/`23505`.
- R4 resolved by this step; R5 resolved too (no direct write of `user_id`).

## Steps
- [x] 1. [backend] Zod: `FriendCodeInputSchema`, `FoundFriendSchema`, `userId` on `FriendInputSchema` + duplicate refine, `organizerUsername` on `TripOverviewSchema` — skill: test-driven-development — tests first: Step 1 list — verify: typecheck, lint, full suite.
- [x] 2. [backend] Migration: lookup + organizer-nick functions, unique index, self-link guard in `create_trip`; regenerate types; SQL tests — skill: security-and-hardening, doubt-driven-development, source-driven-development — tests first: Step 2 list — verify: `pnpm test:db`, parity, full suite. Kacper pushes the migration.
- [x] 2b. [backend] Link only by code (D12): Zod `friendCode` instead of `userId`, `FoundFriendSchema` without id, migration `20261020130000_friend_invite_code_only.sql`, types, parity, SQL tests — skill: security-and-hardening, doubt-driven-development, test-driven-development — verify: SQL tests, parity, full suite.
- [x] 3. [frontend] Data layer: `findByFriendCode` (Supabase + in-memory), `create_trip` payload carries `friend_code` (2b), `organizerUsername` in `current()` + SQLite copy — skill: test-driven-development, source-driven-development — verify: full suite.
- [x] 4. [frontend] Wizard: code field in `FriendCard`, `useFriendLookup`, states and D7 copy, i18n pl/en — skill: frontend-ui-engineering — verify: full suite + tester on device.
- [x] 5. [frontend] Read-only home for linked members + organizer in "Podróżni" (D4, D15 fallback "Organizator") + photo viewer + keep the cached organizer nick (D15) — skill: frontend-ui-engineering — verify: full suite + tester with the second account.
- [x] 6. [frontend] Layover label alignment (home + summary, wizard keeps D27) — skill: test-driven-development — verify: full suite + screenshot.
- [x] 7. Architecture.md + app-context.md updated.
- [x] 8. Device check (tester, two accounts) — migrations pushed 2026-10-21 — manual steps below.

## Verification
Per CLAUDE.md loop: tests red first, then `pnpm typecheck`, `pnpm lint`, `pnpm test` (full), `pnpm test:db` for step 2, verifier after each step, tester on the emulator for steps 4–6.

Manual test steps (tester / Kacper):
1. Account A (organizer): new trip, 1 companion, in "Znajomi" type `5zmrx8` → shows `5ZMRX8`, then the nick and interests of account B, fields locked.
2. Type A's own code → "To Twój kod."; a made-up code → "Nie ma użytkownika z tym kodem."; same code in two cards → "Ten znajomy jest już dodany."; airplane mode → field disabled with the offline message.
3. Create the trip. Sign in as account B → the trip is in the side panel; "Podróż" shows no ⋮, no "Zmień", no "+"; "Podróżni": "<A's nick> (organizator)", "Ty". Airplane mode + restart → the same offline.
3b. As B: tap a photo → no trash icon; a trip without photos → nothing between the hero and "Loty"; airplane mode → no "Bez internetu nie dodasz…" line, banner "Jesteś offline" stays.
3c. Back as A: ⋮, "Zmień", "+" and photo delete are there; "Podróżni" = "Ty" + friends.
3d. Spinner "Sprawdzam kod…" visible while checking; editing a found code empties the card; typing 4 chars + "Dalej" → "Kod ma 6 znaków." and the screen scrolls to the card.
4. Home "Loty" and summary "Loty" of a trip with a layover: the clock icon lines up with the flight lines' left edge; wizard flights step unchanged.

## Progress log
- Baseline (worktree, before step 1): typecheck ✓, lint ✓; `pnpm test` 1 failure on the first run, 2473/2473 green on the rerun — a flaky test under load, not caused by this feature.
- Step 1: tests written (red ✓ — missing exports `TypeError`, `userId` stripped → `undefined`, duplicate not rejected, bad `organizerUsername` accepted) · `src/schemas/profile.ts` (`FriendCodeInputSchema`, `FoundFriendSchema`), `src/schemas/create-trip-form.ts` (`userId` default null + duplicate `superRefine`), `src/schemas/trip.ts` (`organizerUsername`) · tests in `profile.test.ts`, `create-trip-form.test.ts`, `entities.test.ts` (TripOverview fixture lives there, not `trip.test.ts`) · green ✓ · typecheck ✓ lint ✓ full suite 2498/2498 ✓ · verifier PASS · skill used: test-driven-development · deviation: i18n key `validation.friendDuplicate` deferred to step 4 (no test enforces dictionary keys; `validation.friendCountMismatch` is also missing today — pre-existing).

- Step 2: tests written (red ✓ — `supabase/tests/friend_invite.sql` before the migration: `function "public.find_profile_by_friend_code(text)" does not exist`; parity test 3 of 7 red against the old `database.types.ts`) · new `supabase/migrations/20261020120000_friend_invite.sql`: `find_profile_by_friend_code` (security definer, `search_path = ''`, exact match, id/username/interests only, nothing without `auth.uid()` or for an anonymous JWT), `trip_organizer_username` (owner nick to the owner or a linked member, else null — no existence oracle), unique partial index `trip_members_trip_user_key`, `create_trip` replaced with a self-link guard (SQLSTATE `FI001`; duplicate link = `23505`) · new `supabase/tests/friend_invite.sql`, `src/schemas/__tests__/friend-invite-db-parity.test.ts`; `src/data/database.types.ts` regenerated (only the two functions added) · migration applied to the LOCAL DB with `supabase migration up --local` (Kacper still pushes it to the project) · green ✓: all `supabase/tests/*.sql` via `docker exec … psql` (no host psql, so not through `pnpm test:db`; `trip_covers.sql` run with its `\ir` inlined), mutation check (6 mutants, all caught), typecheck ✓ lint ✓ Jest 2505/2505 ✓ · verifier: code PASS on every check; FAIL only for missing red evidence in its brief, resolved with the implementer's red record above · skills used: security-and-hardening, doubt-driven-development, test-driven-development (source-driven-development: no doc tool available to the agent, followed the repo's existing definer pattern) · deviations: lookup also granted to `service_role` (repo convention, returns nothing without a uid); anonymous-JWT check added beyond the plan.

- Step 2b: tests written (red ✓ — `friend_invite.sql`: `function "private.link_trip_member(uuid, text)" does not exist`; Jest schema tests 15 red before the Zod change; parity 2 red against stale types; `trips_rls.sql` red with `new row violates row-level security policy for table "trip_members"` on its old fixture, by design) · Zod: `FriendInputSchema.friendCode` (replaces `userId`), duplicate refine on `friendCode`, `FoundFriendSchema` without `id`, new `CreateTripMemberPayloadSchema` in `src/schemas/member.ts` · new `supabase/migrations/20261020130000_friend_invite_code_only.sql`: lookup re-created (username, interests), `private.link_trip_member(member_id, code)` definer (42501 not owner, `FI002` unknown code, `FI001` own code, sets `user_id` only where null), `create_trip` inserts members with `user_id` null then links by `friend_code`, insert policy `user_id is null`, UPDATE on `trip_members` re-granted only on display_name/role/interests/budget_level/pace/dietary_notes · `supabase/tests/friend_invite.sql` rewritten; `supabase/tests/trips_rls.sql` fixture for C's link row now inserted as superuser (no assertion changed) · types regenerated, parity test updated (also asserts `private` is not API-exposed) · applied to the LOCAL DB · green ✓: all SQL tests (via docker exec; trip_covers via inlined `\ir`), 10 mutants killed, typecheck ✓ lint ✓ Jest 2518/2518 ✓ · verifier PASS · skills used: security-and-hardening, doubt-driven-development, test-driven-development · deviations: `id` and `trip_id` also not updatable by the owner (a member never moves; tested); `CreateTripMemberPayloadSchema` added (Zod-first for the RPC payload); `private.link_trip_member`/`create_trip` don't check `is_anonymous` (anonymous sign-ins are off, latent only) · notes for step 3: send `friend_code` per member (the app still sends `user_id`, ignored by the server → friends stay unlinked until step 3); map `FI001`/`FI002`/`23505` (HTTP 400, SQLSTATE in `code`); a retry after the friend's profile was deleted fails with `FI002` though the link exists (rare). Ops: keep `private` out of the exposed schemas on the hosted project; push both migrations in order.

- Step 3: tests written (red ✓ — `npx jest src/data`: 41 failed in 5 suites, e.g. `TypeError: repository.findByFriendCode is not a function`, payload still with `user_id`, missing error exports, organizer rpc not called) · `src/data/errors.ts`: `OwnFriendCodeError` (FI001), `UnknownFriendCodeError` (FI002), `FriendAlreadyAddedError` (23505 on `trip_members_trip_user_key`) · `ProfileRepository.findByFriendCode` (interface, in-memory with `friendAccounts`, Supabase: `FriendCodeInputSchema` before any request, `signedIn()`, rpc, `FoundFriendSchema.array().max(1)`, status 0 → `ServerUnreachableError`) · `CreatedTrip.friendCodes` (member id → code) from `buildTrip`; `toCreateTripArgs` parses members with `CreateTripMemberPayloadSchema` (`friend_code`, no `user_id`; hand `MemberPayload` type removed) · in-memory trip repo links by code (`friendAccounts`, `ownFriendCode`) with the same errors · Supabase `create()` maps only FI001/FI002/23505-on-the-index · `fetchTrip` sets `organizerUsername` for a non-owner via `trip_organizer_username` before caching; owner → no call; refusal/null/invalid nick → field absent; unreachable → cache · test helpers adjusted where typecheck forced it (`...base` spreads, `user_id: null` in stored-row fixtures); trip-rows assertion `user_id: null` → `friend_code: null` + no `user_id` (new contract, stronger) · green ✓ typecheck ✓ lint ✓ Jest 2565/2565 ✓ · verifier PASS · skills used: test-driven-development, incremental-implementation (source-driven: postgrest-js error shape checked against the existing fake/`failure()`, no doc tool) · known minor: a refused/null organizer rpc on a later refresh overwrites a cached nick (see Q4).

- Step 4: new `src/hooks/useFriendLookup.ts` (query key `['friend-lookup', code]`, `retry: false`, `gcTime: 0`, `networkMode: 'always'`) · `draft.ts`: `FriendDraft` + `codeText` (UI only), `emptyFriend`, `withCodeText` (D9), `withFoundFriend`, `hasUnresolvedCode` (D13); `toCreateTripInput` strips `codeText` · new pure `src/features/trip-create/friend-code.ts` `friendCodeStatus(...)` (found → offline → empty → incomplete → unknown → own → duplicate → checking → lookup answer) · `FriendCard`: "Kod znajomego (opcjonalnie)" above the name, uppercase, max 6, spinner row "Sprawdzam kod…" (D16), found → read-only name + disabled chips · `friends.tsx`: D13 blocking + scroll · `summary.tsx`: D14 texts · i18n pl/en (`newTrip.friends.code*`, `validation.friendDuplicate`) · tests: `useFriendLookup.test.tsx` (red: module missing), `draft.test.ts` (red: `emptyFriend is not a function`), `friend-code.test.ts` (table-driven; red: module missing), `friends.test.tsx` +27, `summary.test.tsx` +5 · **TDD deviation:** the route tests in `friends.test.tsx` / `summary.test.tsx` were written after `FriendCard`/`friends`/`summary`; red reproduced afterwards against the HEAD versions (31 failed) and backed by a mutation check — 12 mutants, all killed (the `networkMode` mutant first survived → new hook test, red against the mutant); verifier re-ran 4 mutants itself, all killed · verifier: first FAIL (TDD order, invented spinner copy) → copy approved as D16, mutation evidence → PASS · green ✓ typecheck ✓ lint ✓ Jest 2645/2645 ✓ · skills used: frontend-ui-engineering, test-driven-development, incremental-implementation · known limitation: if the own profile has not loaded yet, typing the own code asks the server; the save then fails with FI001 and D14 shows "To Twój kod." · device check (tester) deferred until the two migrations are on the Supabase project the app uses.

- Step 5: tests written first and run red (`supabase-trip-repository.test.ts` D15: `Expected: "kacper.b" Received: undefined` ×3; `home.test.tsx` linked-member block 9 of 11 red, e.g. `toBeNull()` received the "Opcje podróży" button; `photos.test.tsx` 5 red, delete button / hint present; D17 gap: `Received: <View testID="photo-strip" />`) · `src/hooks/useProfile.ts`: `useMyProfileId`, `useIsTripOwner` (false while unknown, so a member never sees an edit control; an owner may briefly see the read-only view on first render) · `CurrentTrip.tsx`: member → no ⋮, no budget "Zmień", `PhotoStrip readOnly`, no strip/wrapper when the trip has no photos (D17); "Podróżni" = "<nick> (organizator)" or "Organizator" (D15), "Ty", others (own row excluded) · `PhotoStrip.tsx` `readOnly` (no add tile, no offline hint) · `PhotoViewer.tsx` `isOwner` (delete only when true) + `photos.tsx` derives it · D15 in `fetchTrip`: a nick-less refresh keeps the cached nick · in-memory `LOCAL_OWNER_ID` = `LOCAL_PROFILE_ID` (tests-only repo; fixtures `'local-user'` → `LOCAL_PROFILE_ID` in `home.test.tsx`, `home-clearance.test.tsx`, no assertion changed) · i18n `home.organizer`, `home.organizerUnknown` · green ✓ typecheck ✓ lint ✓ Jest 2669/2669 ✓ · verifier PASS (twice: step + D17 gap fix) · skills used: frontend-ui-engineering, test-driven-development · notes: a member's empty strip shows a skeleton that disappears once photos load as `[]`; a member who never loaded the photo list sees the same load-error line as the owner offline; server-side the viewer cannot write (RLS, steps 2/2b) — hiding controls is UX only · device check pending (needs migrations on the project).

- Step 6: tests first (red ✓ — `LayoverLabel.test.tsx` default: `Expected: 0 / Received: 16`; home and summary: `Expected instance not to have style: paddingLeft: 16`; flights-step guard green before and after) · `src/components/LayoverLabel.tsx`: `inset?: boolean` (default false → `theme.spacing[0]`; true → `theme.spacing[4]`, D27) · `src/app/trips/new/index.tsx` passes `inset`; home and summary call sites unchanged · green ✓ typecheck ✓ lint ✓ Jest 2674/2674 ✓ · verifier PASS (nit: literal 0 → `theme.spacing[0]`, applied) · skill used: test-driven-development · screenshot pending with the device check.
- Step 7: `Architecture.md` (header, data model, tables, data flow incl. friend lookup and organizer nick, backend RPC / friend-invite functions / grants, migrations not pushed, routes, hooks, key decisions, limitations, changelog) and `context/app-context.md` (roadmap item 15, ideas, home and wizard screens, backend) updated after checking the code; final run by the orchestrator: typecheck ✓, lint ✓, Jest 122 suites / 2674 tests ✓.
- Migrations pushed (2026-10-21, orchestrator via Supabase MCP `apply_migration`, on Kacper's instruction): `friend_invite` then `friend_invite_code_only` on project `hwsq…`, both succeeded. Preflight: `private` schema and `is_trip_owner`/`is_trip_viewer` present, no duplicate (trip_id, user_id) links. Checked after: `find_profile_by_friend_code` returns (username, interests), definer; `trip_organizer_username` definer; `private.link_trip_member` definer; none executable by `anon`; `authenticated` has no UPDATE on `trip_members.user_id`, has it on `display_name`; insert policy has `user_id is null`; `trip_members_trip_user_key` exists. REST with `Accept-Profile: private` → PGRST106 (only public, graphql_public exposed). Security advisor: the two public definer functions flagged for `authenticated` (intended, D1/D4); `rls_auto_enable` callable by anon is pre-existing, not this feature. **Deviation:** MCP recorded the versions as `20261021125912` / `20261021125935`, not the file timestamps; re-aligning `schema_migrations` was refused by the permission classifier, left to Kacper (`supabase migration repair`). Step 8 not started: no local device or emulator connected.
- Step 8, run 1 — account A (2026-10-21, `tester`, emulator Medium Phone API 37, Expo Go from Metro in the worktree with `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1` + `adb reverse tcp:8081`; the worktree got a copy of the gitignored `.env`). First attempt blocked: no Metro was running. Account check: `JY9Z9V` → "To Twój kod." (A). B's nick: `baxton`. Trip "Test friend-invite" created (WAW→FRA→NRT with a 2 h FRA layover, 1 companion linked to `5ZMRX8`).
  - 1 PASS (`5zmrx8` → `5ZMRX8`, card "baxton" + interests, read-only) · 2 PASS (own / unknown `XYZ234` / duplicate / airplane mode → each D7 text, field disabled offline) · 3d PASS (one backspace empties the card; 4 chars + "Dalej" → "Kod ma 6 znaków." and scroll; spinner caught in the element list as `friend-code-checking` "Sprawdzam kod…", D16) · 3-A PASS after a recheck (first report FAIL was a misread: the card was under the button; element list: "Ty", "baxton — <interests>"; `screenshots/friend-invite/summary-travellers.png`) · 3c PASS (⋮ with "Nazwa i zdjęcie / Zmień budżet / Usuń podróż", "Zmień budżet", "+" tile, "Podróżni": "Ty", "baxton") · 4 PASS (`home-loty-layover.png`, `summary-loty-layover.png`, `wizard-flights-layover.png`).
  - Not covered: owner's photo-viewer delete (trip has no photos).
  - Side effect: during the recheck a repeated tap on the "Dalej"/"Utwórz podróż" spot created a second test trip "Warsaw → Frankfurt" (also linked to baxton) in account A; left in place for Kacper.
  - Observation (not a plan item, unconfirmed): once on the budget step a "Dalej" tap returned to step 1 with no error; a second tap moved on.
  - Account B part: Kacper had no sign-out in this branch (it is profile-screen step 6), so Expo Go data on the emulator was cleared (`adb -s emulator-5554 shell pm clear host.exp.exponent`, on Kacper's OK) and Kacper signed in as B.
- Step 8, run 2 — account B (2026-10-21, `tester`, same emulator, app in English after the reset; texts checked against `en.json` keys). 3-B PASS (drawer lists "Test friend-invite"; no ⋮, no budget "Change", no "+" tile; "Travellers · 2 people": "kacperbartlomiejczak (organizer)", "You"; B's nick not listed) · 3b PASS (no photos → `home-flights` starts right under `trip-hero`, no strip/skeleton/hint, D17) · 3-offline PASS (airplane mode: offline banner, no photo hint; force-stop + reopen offline → same read-only view and travellers from the SQLite copy) · extra: "Warsaw → Frankfurt" shows the same read-only view · screenshots `b-trip-home.png`, `b-travellers.png`, `b-offline-restart.png` · not run on device: photo-viewer delete for owner and member (no photos; covered by `photos.test.tsx`) · observations, not plan items: dev-only LogBox warning "Can't perform a React state update on a component that hasn't mounted yet" on cold start (`ExpoRoot.js`, origin not checked); the offline banner overlays the lower part of the home at top scroll (existing behavior).
- Final check (orchestrator, 2026-10-21): typecheck ✓, lint ✓, Jest 122 suites / 2674 tests ✓.

## Risks & open questions
- **Q4 — Organizer nick lost on a refused refresh (step 3) — answered D15.**
- **Q1 — Clearing a found code (answered 2026-10-20, D9):** clearing or editing the code returns the card to an empty manual card (name + interests editable).
- **Q2 — Leaving / unlinking (answered 2026-10-20, D10):** out of scope, a later feature.
- **Q3 — Branch (answered 2026-10-20, D11):** a new branch `feature/friend-invite`. Base (Kacper, 2026-10-20): a git worktree `.claude/worktrees/friend-invite` branched from `feature/auth-onboarding` (d631b14), so the main checkout's uncommitted work and the other session stay untouched.
- **R1 — Code guessing:** 31⁶ ≈ 887 M codes; the lookup returns nick + interests. No rate limit in this plan; a per-user limit would be a new decision.
- **R2 — Snapshot nick (A1):** if the friend changes their nick later, the trip keeps the old one (nick editing doesn't exist yet).
- **R4 — Linking without a code (verifier, step 2) — resolved by step 2b (D12):** `create_trip` accepts any existing `user_id`, and co-members' `user_id`s are readable to linked members. Someone who knows a user's id could link them to their own trip without the code (unsolicited link; no read leak). Decision for Kacper.
- **R5 — resolved by step 2b** — Self-link only guarded in `create_trip`: a direct owner insert/update of `trip_members` with their own `user_id` is not blocked (not reachable from the app).
- **R3 — Retry duplicates:** the known "retry after lost response creates a second trip" gap still applies; the new unique index only guards one trip's members.
