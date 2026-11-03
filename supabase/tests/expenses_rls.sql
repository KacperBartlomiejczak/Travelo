-- Expenses: RLS (owner writes all, linked member writes only their own), constraints, last-write-wins upsert, delete rules
-- (prompts/expenses/plan.md, step 2, D15, D17, D18).
-- Plain SQL (not pgTAP): run with `pnpm test:db`. Everything is rolled back at the end; counts are scoped to this test's own rows.
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

-- Acts as a request without a session (publishable key only).
create function test_helpers.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create function test_helpers.ok(condition boolean, description text) returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', description;
  end if;
end $$;

create function test_helpers.throws(query text, expected_state text, description text) returns void language plpgsql as $$
begin
  begin
    execute query;
  exception when others then
    if sqlstate = expected_state then
      return;
    end if;
    raise exception 'FAILED: % (expected SQLSTATE %, got %: %)', description, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAILED: % (expected SQLSTATE %, but it succeeded)', description, expected_state;
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

-- Organizer A, stranger B, linked member C, organizer D (their account is deleted at the end).
insert into auth.users (id) values
  ('00000000-0000-4000-a000-0000000000a1'),
  ('00000000-0000-4000-a000-0000000000b1'),
  ('00000000-0000-4000-a000-0000000000c1'),
  ('00000000-0000-4000-a000-0000000000d1');

-- Fixtures are written as the superuser (links included: user_id is not writable by owners); the policies under test run after login.
-- Trip e1 (A): Kasia e1 (no account), Celina e2 (linked to C). Trip e2 (B): Bartek e3. Trip e3 (A): Ola e4. Trip e4 (D): Dan e5.
insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency, budget_per_person_minor, budget_updated_at) values
  ('10000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-a000-0000000000a1', 'A trip', 'BKK', '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z'),
  ('10000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-a000-0000000000b1', 'B trip', 'BKK', '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z'),
  ('10000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-a000-0000000000a1', 'A second trip', 'BKK', '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z'),
  ('10000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-a000-0000000000d1', 'D trip', 'BKK', '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z');
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests) values
  ('20000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', null, 'Kasia', 'viewer', '{}'),
  ('20000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-a000-0000000000c1', 'Celina', 'viewer', '{}'),
  ('20000000-0000-4000-8000-0000000000e3', '10000000-0000-4000-8000-0000000000e2', null, 'Bartek', 'viewer', '{}'),
  ('20000000-0000-4000-8000-0000000000e4', '10000000-0000-4000-8000-0000000000e3', null, 'Ola', 'viewer', '{}'),
  ('20000000-0000-4000-8000-0000000000e5', '10000000-0000-4000-8000-0000000000e4', null, 'Dan', 'viewer', '{}');

-- ---------------------------------------------------------------------------
-- Owner A: writes any expense of their trip
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-0000000000a1');
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000e1', null));
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e1'));
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2'));
select test_helpers.ok(
  (select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e1') = 3,
  'A writes the organizer''s, a friend''s and a linked member''s expense in their trip');

update public.expenses set name = 'Pad thai 2', updated_at = '2026-11-04T11:00:00Z' where id = '30000000-0000-4000-8000-000000000002';
select test_helpers.ok((select name from public.expenses where id = '30000000-0000-4000-8000-000000000002') = 'Pad thai 2',
  'A edits a friend''s expense');

-- ---------------------------------------------------------------------------
-- Idempotent upsert, last write wins
-- ---------------------------------------------------------------------------
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000e1', null));
select test_helpers.ok(
  (select count(*) from public.expenses where id = '30000000-0000-4000-8000-000000000001') = 1,
  'the same upsert twice leaves one row');

select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000e1', null,
  '{"name": "Newer", "amount_minor": 15000, "updated_at": "2026-11-04T12:00:00Z"}'));
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000e1', null,
  '{"name": "Older", "amount_minor": 1, "updated_at": "2026-11-04T09:00:00Z"}'));
select test_helpers.ok(
  (select name from public.expenses where id = '30000000-0000-4000-8000-000000000001') = 'Newer'
    and (select amount_minor from public.expenses where id = '30000000-0000-4000-8000-000000000001') = 15000,
  'an older updated_at does not overwrite a newer one');

select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000e1', null,
  '{"name": "Newer", "updated_at": "2026-11-04T13:00:00Z", "deleted_at": "2026-11-04T13:00:00Z"}'));
select test_helpers.ok(
  (select deleted_at from public.expenses where id = '30000000-0000-4000-8000-000000000001') = '2026-11-04T13:00:00Z',
  'a soft delete syncs through the same upsert');
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000e1', null,
  '{"name": "Zombie", "updated_at": "2026-11-04T12:30:00Z"}'));
select test_helpers.ok(
  (select deleted_at is not null and name = 'Newer' from public.expenses where id = '30000000-0000-4000-8000-000000000001'),
  'an older edit does not resurrect a newer soft delete');

-- trip_id is not updatable, not even for the owner of both trips.
select test_helpers.throws(
  $$update public.expenses set trip_id = '10000000-0000-4000-8000-0000000000e3', member_id = null where id = '30000000-0000-4000-8000-000000000001'$$,
  '42501', 'trip_id cannot be updated');

-- No delete for anyone, owner included.
select test_helpers.throws($$delete from public.expenses where id = '30000000-0000-4000-8000-000000000001'$$,
  '42501', 'A has no delete privilege on expenses');

-- member_id must belong to the same trip, also for the owner.
select test_helpers.throws(
  format('select public.upsert_expense(%L)',
    test_helpers.expense('30000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e4')),
  '23503', 'A cannot attach a member of their other trip to an expense');
select test_helpers.throws(
  format('select public.upsert_expense(%L)',
    test_helpers.expense('30000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e3')),
  '23503', 'A cannot attach B''s member to an expense');
select test_helpers.throws(
  $$update public.expenses set member_id = '20000000-0000-4000-8000-0000000000e4' where id = '30000000-0000-4000-8000-000000000002'$$,
  '23503', 'A cannot re-point an expense to a member of another trip');

-- ---------------------------------------------------------------------------
-- Constraints mirror ExpenseSchema
-- ---------------------------------------------------------------------------
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-0000000000e1', null, '{"amount_minor": 0}')),
  '23514', 'a zero amount is rejected');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-0000000000f2', '10000000-0000-4000-8000-0000000000e1', null, '{"amount_minor": -5}')),
  '23514', 'a negative amount is rejected');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-0000000000f3', '10000000-0000-4000-8000-0000000000e1', null, jsonb_build_object('name', repeat('a', 61)))),
  '23514', 'a 61-character name is rejected');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-0000000000f4', '10000000-0000-4000-8000-0000000000e1', null, '{"name": "   "}')),
  '23514', 'a blank name is rejected');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-0000000000f5', '10000000-0000-4000-8000-0000000000e1', null, '{"currency": "thb"}')),
  '23514', 'a lowercase currency is rejected');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-0000000000f6', '10000000-0000-4000-8000-0000000000e1', null, '{"category": "drinks"}')),
  '23514', 'an unknown category is rejected');
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-0000000000f7', '10000000-0000-4000-8000-0000000000e1', null,
  jsonb_build_object('name', repeat('a', 60), 'category', 'other')));
select test_helpers.ok((select count(*) from public.expenses where id = '30000000-0000-4000-8000-0000000000f7') = 1,
  'a 60-character name is accepted');

-- ---------------------------------------------------------------------------
-- Stranger B: no access to A's trip
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-0000000000b1');
select test_helpers.ok((select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0,
  'B reads no expense of A''s trip');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-0000000000e1', null)),
  '42501', 'B cannot insert into A''s trip');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-0000000000e2', null, '{"name": "Hijack", "updated_at": "2030-01-01T00:00:00Z"}')),
  '42501', 'B cannot take over A''s expense id, not even by moving it into B''s own trip');
update public.expenses set name = 'Hijack' where id = '30000000-0000-4000-8000-000000000002';
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-0000000000e2', null));
select test_helpers.ok((select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e2') = 1, 'B writes in their own trip');

-- ---------------------------------------------------------------------------
-- Linked member C (Celina = member e2 of trip e1)
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-0000000000c1');
select test_helpers.ok((select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e1' and id::text like '30000000-0000-4000-8000-0000000000%') = 4,
  'C reads every expense of the trip, the organizer''s and friends'' too');
select test_helpers.ok((select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e2') = 0,
  'C reads nothing of B''s trip');

select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2'));
select test_helpers.ok((select count(*) from public.expenses where id = '30000000-0000-4000-8000-000000000030') = 1, 'C adds an expense of their own');
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2',
  '{"name": "Edited", "updated_at": "2026-11-04T11:00:00Z"}'));
select test_helpers.ok((select name from public.expenses where id = '30000000-0000-4000-8000-000000000030') = 'Edited', 'C edits their own expense');
select public.upsert_expense(test_helpers.expense('30000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2',
  '{"name": "Edited", "updated_at": "2026-11-04T12:00:00Z", "deleted_at": "2026-11-04T12:00:00Z"}'));
select test_helpers.ok((select deleted_at is not null from public.expenses where id = '30000000-0000-4000-8000-000000000030'), 'C soft-deletes their own expense');

select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e1')),
  '42501', 'C cannot add an expense of another member');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-0000000000e1', null)),
  '42501', 'C cannot add an expense of the organizer (member_id null)');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e1',
    '{"name": "Hijack", "updated_at": "2030-01-01T00:00:00Z"}')),
  '42501', 'C cannot overwrite another member''s expense');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-0000000000e2',
    '{"updated_at": "2030-01-01T00:00:00Z"}')),
  '42501', 'C cannot take over the organizer''s expense by claiming it as their own');
update public.expenses set name = 'Hijack' where id = '30000000-0000-4000-8000-000000000002';
select test_helpers.throws(
  $$update public.expenses set member_id = '20000000-0000-4000-8000-0000000000e1' where id = '30000000-0000-4000-8000-000000000030'$$,
  '42501', 'C cannot reassign their own expense to another member');
select test_helpers.throws(
  $$update public.expenses set member_id = null where id = '30000000-0000-4000-8000-000000000030'$$,
  '42501', 'C cannot reassign their own expense to the organizer');
select test_helpers.throws(
  $$update public.expenses set trip_id = '10000000-0000-4000-8000-0000000000e3' where id = '30000000-0000-4000-8000-000000000030'$$,
  '42501', 'C cannot move an expense to another trip');
select test_helpers.throws($$delete from public.expenses where id = '30000000-0000-4000-8000-000000000030'$$,
  '42501', 'C has no delete privilege on expenses');

reset role;
select test_helpers.ok((select name from public.expenses where id = '30000000-0000-4000-8000-000000000002') = 'Pad thai 2',
  'no refused or unmatched write changed the friend''s expense');

-- ---------------------------------------------------------------------------
-- Anonymous: nothing
-- ---------------------------------------------------------------------------
select test_helpers.logout();
select test_helpers.throws($$select count(*) from public.expenses$$, '42501', 'anon cannot read expenses');
select test_helpers.throws(format('select public.upsert_expense(%L)',
  test_helpers.expense('30000000-0000-4000-8000-000000000040', '10000000-0000-4000-8000-0000000000e1', null)),
  '42501', 'anon cannot call upsert_expense');
reset role;

-- ---------------------------------------------------------------------------
-- Delete rules (D17, D18). Members of trip e1 (Kasia, Celina) and of D's trip have expenses, live and soft-deleted.
-- ---------------------------------------------------------------------------
insert into public.expenses (id, trip_id, member_id, name, amount_minor, currency, category, spent_on, created_at, updated_at, deleted_at) values
  ('30000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000e4', '20000000-0000-4000-8000-0000000000e5', 'Dan live', 100, 'THB', 'food', '2026-11-04', now(), now(), null),
  ('30000000-0000-4000-8000-0000000000d2', '10000000-0000-4000-8000-0000000000e4', '20000000-0000-4000-8000-0000000000e5', 'Dan gone', 100, 'THB', 'food', '2026-11-04', now(), now(), now());

-- (a) a member with expenses, live or soft-deleted, cannot be deleted
select test_helpers.throws($$delete from public.trip_members where id = '20000000-0000-4000-8000-0000000000e1'$$,
  '23503', 'a member with a live expense cannot be deleted');
update public.expenses set deleted_at = now(), updated_at = now() where member_id = '20000000-0000-4000-8000-0000000000e1';
select test_helpers.throws($$delete from public.trip_members where id = '20000000-0000-4000-8000-0000000000e1'$$,
  '23503', 'a member whose expenses are all soft-deleted still cannot be deleted');
-- a member without expenses can go
delete from public.trip_members where id = '20000000-0000-4000-8000-0000000000e4';
select test_helpers.ok((select count(*) from public.trip_members where id = '20000000-0000-4000-8000-0000000000e4') = 0,
  'a member without expenses is deleted');

-- (b) deleting a whole trip whose members have expenses (live and soft-deleted) removes the expenses
delete from public.trips where id = '10000000-0000-4000-8000-0000000000e1';
select test_helpers.ok(
  (select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0,
  'deleting a trip with member expenses (live and soft-deleted) succeeds and removes the expenses');

-- (c) deleting the organizer's account cascades through trips, members and expenses
delete from auth.users where id = '00000000-0000-4000-a000-0000000000d1';
select test_helpers.ok(
  (select count(*) from public.expenses where trip_id = '10000000-0000-4000-8000-0000000000e4') = 0
    and (select count(*) from public.trips where id = '10000000-0000-4000-8000-0000000000e4') = 0,
  'deleting the organizer''s account with member expenses succeeds and removes them');

rollback;
