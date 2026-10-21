# Task: Friend invite by code (+ layover label alignment)
Status: awaiting approval

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
export const FoundFriendSchema = ProfileSchema.pick({ id: true, username: true, interests: true });
export type FoundFriend = z.infer<typeof FoundFriendSchema>;

// src/schemas/create-trip-form.ts
export const FriendInputSchema = z.object({
  displayName: ...unchanged,
  interests: ...unchanged,
  /** Set when the friend was found by their code (D1); null = friend without an account. */
  userId: z.uuid().nullable().default(null),
});
export const FriendsStepInputSchema = z.object({ friends: z.array(FriendInputSchema) })
  .superRefine(/* no two friends with the same non-null userId → 'validation.friendDuplicate' on friends[i].userId */);

// src/schemas/trip.ts
export const TripOverviewSchema = z.object({
  trip, members, segments,  // unchanged
  /** The organizer's nick, only when the signed-in user is a linked member, not the owner (D4). Old cached copies lack it. */
  organizerUsername: UsernameSchema.optional(),
});
```
The wizard's draft keeps the typed code as UI state next to `FriendDraft` (`friendCode: string`), not in the schema: it is never saved.

DB (mirrors the schemas, new migration `supabase/migrations/<ts>_friend_invite.sql`):
- `public.find_profile_by_friend_code(code text) returns table (id uuid, username text, interests text[])` — `security definer`, `authenticated` only, exact match, returns 0 or 1 row.
- `public.trip_organizer_username(trip_id uuid) returns text` — `security definer`; the owner's nick when the caller is the owner or a linked member, else null.
- `create unique index trip_members_trip_user_key on trip_members (trip_id, user_id) where user_id is not null`.
- `create_trip` replaced (`create or replace`, new migration) to reject a member whose `user_id` = the caller.

## Tests
- **Step 1 (Zod):** `FriendCodeInputSchema` accepts ` 5zmrx8 ` → `5ZMRX8`, rejects 5/7 chars and look-alikes (`0 O 1 I L`); `FoundFriendSchema` valid/invalid fixtures; `FriendInputSchema` defaults `userId` to null, rejects a non-UUID; `FriendsStepInputSchema` rejects two friends with the same `userId`, accepts two with null; `TripOverviewSchema` accepts with and without `organizerUsername`, rejects an invalid nick. `CreateTripInputSchema` still passes with linked friends.
- **Step 2 (SQL, `supabase/tests/`, `pnpm test:db`):** lookup returns the profile for a valid code, nothing for an unknown code, is not callable by `anon`; `trip_organizer_username` returns the nick to the owner and to a linked member, null to user C; `create_trip` with the same `user_id` twice fails; with `user_id = auth.uid()` fails; a linked viewer still cannot update trips/members/segments/budget; user B still cannot read user A's trip. Parity test extended for the new schema fields; `pnpm db:types` regenerated.
- **Step 3 (data):** `ProfileRepository.findByFriendCode` — found → `FoundFriend`, unknown → null, invalid code → `ZodError` before any request, malformed server row → rejects, offline/unreachable → rejects with the existing unreachable error; in-memory version for tests. `buildTrip` keeps `userId` of linked friends. `current()` sets `organizerUsername` only when the trip's owner is not the caller; it is stored in and read back from the SQLite copy.
- **Step 4 (wizard):** typing lowercase shows uppercase; 6th char triggers one lookup; found → nick + interests shown read-only, `userId` in the draft; each D7 message for unknown / own / duplicate / offline / server error; clearing the code returns the card to manual entry; "Dalej" blocks a pending check; summary lists the linked friend by nick; created trip input contains the `userId`.
- **Step 5 (read-only home):** as owner — ⋮, "Zmień", "+" tile visible (unchanged). As linked member — none of them rendered, "Podróżni" reads "<nick> (organizator)", "Ty", others by name; works from the offline copy. Photo viewer hides delete for a linked member.
- **Step 6 (layover):** `LayoverLabel` has no left inset on home and summary, keeps 16 dp in the wizard flights step (style asserted in component tests).

## Files
- Modify: `src/schemas/profile.ts`, `src/schemas/create-trip-form.ts`, `src/schemas/trip.ts`, `src/schemas/index.ts`, `src/schemas/__tests__/*` (profile, create-trip-form, trip, parity).
- Create: `supabase/migrations/<ts>_friend_invite.sql`, `supabase/tests/friend_invite.sql`.
- Modify: `src/data/database.types.ts` (regenerated), `src/data/profile-repository.ts`, `src/data/supabase-profile-repository.ts`, `src/data/trip-repository.ts`, `src/data/supabase-trip-repository.ts`, `src/data/trip-rows.ts` (if the overview mapping lives there), tests in `src/data/__tests__/`.
- Modify: `src/features/trip-create/FriendCard.tsx`, `src/features/trip-create/draft.ts`, `src/app/trips/new/friends.tsx`, new hook `src/hooks/useFriendLookup.ts`, `src/i18n/` (pl, en), tests in `src/features/trip-create/__tests__/`, `src/__tests__/app/trips/new/`.
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

## Steps
- [ ] 1. [backend] Zod: `FriendCodeInputSchema`, `FoundFriendSchema`, `userId` on `FriendInputSchema` + duplicate refine, `organizerUsername` on `TripOverviewSchema` — skill: test-driven-development — tests first: Step 1 list — verify: typecheck, lint, full suite.
- [ ] 2. [backend] Migration: lookup + organizer-nick functions, unique index, self-link guard in `create_trip`; regenerate types; SQL tests — skill: security-and-hardening, doubt-driven-development, source-driven-development — tests first: Step 2 list — verify: `pnpm test:db`, parity, full suite. Kacper pushes the migration.
- [ ] 3. [frontend] Data layer: `findByFriendCode` (Supabase + in-memory), `buildTrip` keeps `userId`, `organizerUsername` in `current()` + SQLite copy — skill: test-driven-development, source-driven-development — verify: full suite.
- [ ] 4. [frontend] Wizard: code field in `FriendCard`, `useFriendLookup`, states and D7 copy, i18n pl/en — skill: frontend-ui-engineering — verify: full suite + tester on device.
- [ ] 5. [frontend] Read-only home for linked members + organizer in "Podróżni" + photo viewer — skill: frontend-ui-engineering — verify: full suite + tester with the second account.
- [ ] 6. [frontend] Layover label alignment (home + summary, wizard keeps D27) — skill: test-driven-development — verify: full suite + screenshot.
- [ ] 7. Architecture.md + app-context.md updated; feature done.

## Verification
Per CLAUDE.md loop: tests red first, then `pnpm typecheck`, `pnpm lint`, `pnpm test` (full), `pnpm test:db` for step 2, verifier after each step, tester on the emulator for steps 4–6.

Manual test steps (tester / Kacper):
1. Account A (organizer): new trip, 1 companion, in "Znajomi" type `5zmrx8` → shows `5ZMRX8`, then the nick and interests of account B, fields locked.
2. Type A's own code → "To Twój kod."; a made-up code → "Nie ma użytkownika z tym kodem."; same code in two cards → "Ten znajomy jest już dodany."; airplane mode → field disabled with the offline message.
3. Create the trip. Sign in as account B → the trip is in the side panel; "Podróż" shows no ⋮, no "Zmień", no "+"; "Podróżni": "<A's nick> (organizator)", "Ty". Airplane mode + restart → the same offline.
4. Home "Loty" and summary "Loty" of a trip with a layover: the clock icon lines up with the flight lines' left edge; wizard flights step unchanged.

## Progress log

## Risks & open questions
- **Q1 — Clearing a found code (answered 2026-10-20, D9):** clearing or editing the code returns the card to an empty manual card (name + interests editable).
- **Q2 — Leaving / unlinking (answered 2026-10-20, D10):** out of scope, a later feature.
- **Q3 — Branch (answered 2026-10-20, D11):** a new branch `feature/friend-invite`. Base still open: `main` lacks 25 commits of `feature/auth-onboarding` (open PR), and the checkout has uncommitted changes from other work.
- **R1 — Code guessing:** 31⁶ ≈ 887 M codes; the lookup returns nick + interests. No rate limit in this plan; a per-user limit would be a new decision.
- **R2 — Snapshot nick (A1):** if the friend changes their nick later, the trip keeps the old one (nick editing doesn't exist yet).
- **R3 — Retry duplicates:** the known "retry after lost response creates a second trip" gap still applies; the new unique index only guards one trip's members.
