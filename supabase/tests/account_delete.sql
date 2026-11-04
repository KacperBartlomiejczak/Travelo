-- Account deletion: what the foreign keys remove when an auth user is deleted (prompts/profile-settings/plan.md, step 2, D1, D11, R8).
-- Plain SQL (not pgTAP): run with `pnpm test:db`. Everything is rolled back at the end; no production code is involved.
begin;

-- ---------------------------------------------------------------------------
-- Helpers (rolled back with the test)
-- ---------------------------------------------------------------------------
create schema test_helpers;
grant usage on schema test_helpers to anon, authenticated;

-- Acts as a signed-in user for the rest of the transaction, like a request with that user's JWT.
create function test_helpers.login(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function test_helpers.ok(condition boolean, description text) returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', description;
  end if;
end $$;

-- An expense as the app sends it to upsert_expense.
create function test_helpers.expense(id uuid, trip_id uuid, member_id uuid, overrides jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', id, 'trip_id', trip_id, 'member_id', member_id,
    'name', 'Pad thai', 'amount_minor', 12000, 'currency', 'THB', 'category', 'food', 'spent_on', '2026-11-04',
    'created_at', '2026-11-04T10:00:00Z', 'updated_at', '2026-11-04T10:00:00Z', 'deleted_at', null
  ) || overrides
$$;

grant execute on all functions in schema test_helpers to anon, authenticated;

-- Organizer O, linked friend F, stranger S.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-0000000000a1'),
  ('00000000-0000-4000-a000-0000000000f1'),
  ('00000000-0000-4000-a000-0000000000b1');
insert into public.profiles (id, username, interests) values
  ('00000000-0000-4000-a000-0000000000a1', 'del_owner', '{beaches}'),
  ('00000000-0000-4000-a000-0000000000f1', 'del_friend', '{beaches}'),
  ('00000000-0000-4000-a000-0000000000b1', 'del_stranger', '{beaches}');

-- Trip e1 (O): Olga (owner row, linked to O), Filip (linked to F), Kasia (no account).
-- Trip e2 (S): Sam (no account), Olga2 (linked to O, so deleting O must leave S's trip alone).
-- Fixtures are written as the superuser.
insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency, budget_per_person_minor, budget_updated_at) values
  ('10000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-a000-0000000000a1', 'O trip', 'BKK', '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z'),
  ('10000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-a000-0000000000b1', 'S trip', 'BKK', '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z');
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests) values
  ('20000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-a000-0000000000a1', 'Olga', 'owner', '{}'),
  ('20000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-a000-0000000000f1', 'Filip', 'viewer', '{}'),
  ('20000000-0000-4000-8000-0000000000e3', '10000000-0000-4000-8000-0000000000e1', null, 'Kasia', 'viewer', '{}'),
  ('20000000-0000-4000-8000-0000000000e4', '10000000-0000-4000-8000-0000000000e2', null, 'Sam', 'viewer', '{}'),
  ('20000000-0000-4000-8000-0000000000e5', '10000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-a000-0000000000a1', 'Olga2', 'viewer', '{}');
insert into public.flight_segments (id, trip_id, direction, position, from_iata, to_iata, depart_at, depart_tz, arrive_at, arrive_tz) values
  ('40000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', 'outbound', 0, 'WAW', 'BKK', '2026-11-03T08:00:00Z', 'Europe/Warsaw', '2026-11-03T20:00:00Z', 'Asia/Bangkok'),
  ('40000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000e2', 'outbound', 0, 'WAW', 'BKK', '2026-11-03T08:00:00Z', 'Europe/Warsaw', '2026-11-03T20:00:00Z', 'Asia/Bangkok');
insert into public.trip_photos (id, trip_id, created_at) values
  ('50000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', now()),
  ('50000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000e2', now());
-- Expenses of e1: the organizer's, Filip's (live and soft-deleted), Kasia's. Expenses of e2: Sam's.
insert into public.expenses (id, trip_id, member_id, name, amount_minor, currency, category, spent_on, created_at, updated_at, deleted_at) values
  ('30000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', null, 'Organizer', 100, 'THB', 'food', '2026-11-04', now(), now(), null),
  ('30000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2', 'Filip live', 100, 'THB', 'food', '2026-11-04', now(), now(), null),
  ('30000000-0000-4000-8000-0000000000e3', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2', 'Filip gone', 100, 'THB', 'food', '2026-11-04', now(), now(), now()),
  ('30000000-0000-4000-8000-0000000000e4', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e3', 'Kasia live', 100, 'THB', 'food', '2026-11-04', now(), now(), null),
  ('30000000-0000-4000-8000-0000000000e5', '10000000-0000-4000-8000-0000000000e2', '20000000-0000-4000-8000-0000000000e4', 'Sam live', 100, 'THB', 'food', '2026-11-04', now(), now(), null);

-- ---------------------------------------------------------------------------
-- D11: a linked friend deletes their account. The trip, the member row (now without an account) and the expenses stay.
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-a000-0000000000f1';
select test_helpers.ok((select count(*) from public.profiles where id = '00000000-0000-4000-a000-0000000000f1') = 0,
  'the friend''s profile is gone');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-0000000000e1') = 1
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-0000000000e1') = 3
    and (select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e1') = 4,
  'the organizer''s trip, its members and all its expenses stay');
select test_helpers.ok(
  (select user_id is null and display_name = 'Filip' from public.trip_members where id = '20000000-0000-4000-8000-0000000000e2'),
  'the friend''s member row stays with the same name and no account (user_id null)');
select test_helpers.ok(
  (select count(*) from public.expenses where member_id = '20000000-0000-4000-8000-0000000000e2') = 2,
  'the friend''s expenses stay, live and soft-deleted');

-- The organizer still edits the former friend's expense, as the organizer.
select test_helpers.login('00000000-0000-4000-a000-0000000000a1');
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2',
  '{"name": "Filip edited", "updated_at": "2030-01-01T00:00:00Z"}'));
select test_helpers.ok((select name from public.expenses where id = '30000000-0000-4000-8000-0000000000e2') = 'Filip edited',
  'the organizer edits the former friend''s expense through RLS');
reset role;

-- ---------------------------------------------------------------------------
-- D1: the organizer deletes their account. Everything of theirs goes, members' expenses included (RESTRICT on member_id
-- must not block it); a stranger's trip is untouched, even where the organizer was a linked member.
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-a000-0000000000a1';
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.trip_photos where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.profiles where id = '00000000-0000-4000-a000-0000000000a1') = 0,
  'the organizer''s trips, members, flights, photos, expenses (live and soft-deleted, members'') and profile are gone');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-0000000000e2') = 1
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-0000000000e2') = 2
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-0000000000e2') = 1
    and (select count(*) from public.trip_photos where trip_id = '10000000-0000-4000-8000-0000000000e2') = 1
    and (select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e2') = 1
    and (select count(*) from public.profiles where id = '00000000-0000-4000-a000-0000000000b1') = 1,
  'a stranger''s trip, its rows and profile are untouched');
select test_helpers.ok(
  (select user_id is null and display_name = 'Olga2' from public.trip_members where id = '20000000-0000-4000-8000-0000000000e5'),
  'where the deleted organizer was a linked member of a stranger''s trip, only the link is cleared');

rollback;
