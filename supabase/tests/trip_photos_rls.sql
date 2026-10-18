-- Trip photos: RLS, grants, cascade, idempotent insert, constraints (prompts/trip-photos/plan.md, step 4).
-- Plain SQL (not pgTAP): run with `pnpm test:db`. Everything is rolled back at the end.
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

grant execute on all functions in schema test_helpers to anon, authenticated;

-- Organizer A, stranger B, linked viewer C.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000b'),
  ('00000000-0000-4000-a000-00000000000c');

-- A's two trips and B's own trip (fixtures, inserted as the connecting role), and C linked to A's first trip
-- as a read-only member. B owns a trip, so a policy that only asks "is the caller an owner of any trip?" is caught.
insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency,
                          budget_per_person_minor, budget_updated_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-a000-00000000000a', 'Warsaw → Bangkok', 'BKK',
   '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-a000-00000000000a', 'Warsaw → Lisbon', 'LIS',
   '2026-12-01', '2026-12-08', 'EUR', 90000, '2026-10-04T12:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-a000-00000000000b', 'Krakow → Rome', 'FCO',
   '2026-09-01', '2026-09-07', 'EUR', 80000, '2026-08-04T12:00:00Z');
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-a000-00000000000c', 'Celina', 'viewer', '{}');

-- ---------------------------------------------------------------------------
-- Owner A adds, reads and removes photos of their trip
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

insert into public.trip_photos (id, trip_id, taken_at, created_at) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-11-04T18:03', '2026-11-05T09:00:00Z'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, '2026-11-05T09:00:01Z');

select test_helpers.ok((select count(*) from public.trip_photos) = 2, 'A sees both photos of their trip');
select test_helpers.ok(
  (select taken_at from public.trip_photos where id = '50000000-0000-4000-8000-000000000001') = '2026-11-04T18:03'::timestamp,
  'the date taken is stored as the camera''s own clock, without a time zone'
);
select test_helpers.ok(
  (select taken_at from public.trip_photos where id = '50000000-0000-4000-8000-000000000002') is null,
  'a photo without a date taken is allowed (taken_at is null)'
);

-- A photo with the same id again (retry after a lost response) adds nothing and keeps the first row (A5).
insert into public.trip_photos (id, trip_id, taken_at, created_at)
values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2030-01-01T00:00', '2030-01-01T00:00:00Z')
on conflict (id) do nothing;
select test_helpers.ok((select count(*) from public.trip_photos) = 2, 'sending the same photo id again adds no row');
select test_helpers.ok(
  (select taken_at from public.trip_photos where id = '50000000-0000-4000-8000-000000000001') = '2026-11-04T18:03'::timestamp
    and (select created_at from public.trip_photos where id = '50000000-0000-4000-8000-000000000001') = '2026-11-05T09:00:00Z',
  'sending the same photo id again keeps the original row'
);

-- Constraints
select test_helpers.throws(
  $$insert into public.trip_photos (id, trip_id, taken_at) values ('50000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000001', null)$$,
  '23502', 'a photo without created_at is rejected');

-- Nobody updates a photo: there is no update grant or policy.
select test_helpers.throws(
  $$update public.trip_photos set taken_at = '2020-01-01T00:00' where id = '50000000-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot update a photo');

-- A removes one photo and keeps the other.
delete from public.trip_photos where id = '50000000-0000-4000-8000-000000000002';
select test_helpers.ok(
  (select count(*) from public.trip_photos) = 1
    and not exists (select 1 from public.trip_photos where id = '50000000-0000-4000-8000-000000000002'),
  'A can delete a photo of their trip'
);

-- A second trip with a photo, to see later that nobody touches it.
insert into public.trip_photos (id, trip_id, taken_at, created_at)
values ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '2026-12-02T10:15', '2026-12-03T09:00:00Z');
select test_helpers.ok((select count(*) from public.trip_photos) = 2, 'A sees the photos of both trips');

-- ---------------------------------------------------------------------------
-- Stranger B (owner of a different trip) sees and changes nothing of A's
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000b');

select test_helpers.ok((select count(*) from public.trip_photos) = 0, 'B cannot see A''s photos');

-- B is a normal owner of their own trip.
insert into public.trip_photos (id, trip_id, taken_at, created_at)
values ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', '2026-09-02T12:00', '2026-09-03T09:00:00Z');
select test_helpers.ok(
  (select count(*) from public.trip_photos) = 1
    and (select trip_id from public.trip_photos) = '10000000-0000-4000-8000-000000000003',
  'B sees their own photo, and only that one (not A''s)'
);

select test_helpers.throws(
  $$insert into public.trip_photos (id, trip_id, taken_at, created_at)
    values ('50000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', null, now())$$,
  '42501', 'B cannot add a photo to A''s trip, although B owns another trip');
select test_helpers.throws(
  $$insert into public.trip_photos (id, trip_id, taken_at, created_at)
    values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null, now())
    on conflict (id) do nothing$$,
  '42501', 'B cannot add a photo to A''s trip, not even with an id that already exists (on conflict do nothing)');
select test_helpers.throws(
  $$update public.trip_photos set taken_at = null$$,
  '42501', 'B cannot update photos');

-- B reuses the id of A's photo for their own trip: the conflict is ignored and A's row is not touched.
insert into public.trip_photos (id, trip_id, taken_at, created_at)
values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', null, now())
on conflict (id) do nothing;
-- ... and B cannot turn that into taking A's photo over (on conflict do update needs the update privilege B does not have).
select test_helpers.throws(
  $$insert into public.trip_photos (id, trip_id, taken_at, created_at)
    values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', null, now())
    on conflict (id) do update set trip_id = excluded.trip_id$$,
  '42501', 'B cannot move A''s photo to their own trip (on conflict do update)');

-- Counted without RLS (back to the connecting role), so "nothing changed" cannot be a side effect of the policies hiding rows.
reset role;
select test_helpers.ok(
  (select count(*) from public.trip_photos where id = '50000000-0000-4000-8000-000000000001') = 1
    and (select trip_id from public.trip_photos where id = '50000000-0000-4000-8000-000000000001') = '10000000-0000-4000-8000-000000000001'
    and (select created_at from public.trip_photos where id = '50000000-0000-4000-8000-000000000001') = '2026-11-05T09:00:00Z',
  'B reusing A''s photo id changed nothing in A''s row and added no row'
);
select test_helpers.ok(
  (select count(*) from public.trip_photos where trip_id = '10000000-0000-4000-8000-000000000003') = 1,
  'B added no second photo to their own trip by reusing A''s photo id'
);

-- B tries to delete A's photos: by id and by trip (a WHERE clause also applies the select policy), and with no WHERE
-- at all (then only the delete policy decides). The last one also removes B's own photo, which B may do.
select test_helpers.login('00000000-0000-4000-a000-00000000000b');
delete from public.trip_photos where id = '50000000-0000-4000-8000-000000000001';
delete from public.trip_photos where trip_id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
delete from public.trip_photos;

reset role;
select test_helpers.ok(
  (select count(*) from public.trip_photos where trip_id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')) = 2,
  'B''s delete removed none of A''s photos'
);
select test_helpers.ok(
  (select count(*) from public.trip_photos where trip_id = '10000000-0000-4000-8000-000000000003') = 0,
  'B can delete their own photo'
);

-- ---------------------------------------------------------------------------
-- Linked viewer C reads, never writes
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000c');

select test_helpers.ok(
  (select count(*) from public.trip_photos) = 1
    and (select trip_id from public.trip_photos) = '10000000-0000-4000-8000-000000000001',
  'C sees the photos of the trip they are linked to, and only that trip''s'
);

select test_helpers.throws(
  $$insert into public.trip_photos (id, trip_id, taken_at, created_at)
    values ('50000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001', null, now())$$,
  '42501', 'C cannot add a photo');
select test_helpers.throws(
  $$update public.trip_photos set taken_at = null$$,
  '42501', 'C cannot update photos');

delete from public.trip_photos;

reset role;
-- Counted without RLS, so only the photos of this test's own trips (a real database may hold others).
select test_helpers.ok(
  (select count(*) from public.trip_photos
    where trip_id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003')) = 2,
  'C''s delete removed no photo');

-- ---------------------------------------------------------------------------
-- Nothing B or C tried changed A's photos
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

select test_helpers.ok(
  (select count(*) from public.trip_photos) = 2
    and exists (select 1 from public.trip_photos where id = '50000000-0000-4000-8000-000000000001' and taken_at = '2026-11-04T18:03'::timestamp)
    and exists (select 1 from public.trip_photos where id = '50000000-0000-4000-8000-000000000003'),
  'A''s photos are unchanged after B and C tried to delete them'
);

-- Kept after the stranger checks on purpose: a broken insert policy must be caught by B's check first, not by this one.
select test_helpers.throws(
  $$insert into public.trip_photos (id, trip_id, created_at) values ('50000000-0000-4000-8000-0000000000f2', '10000000-0000-4000-8000-0000000000ff', now())$$,
  '42501', 'a photo of a trip that does not exist is rejected (A is not its owner)');

-- ---------------------------------------------------------------------------
-- Deleting a trip deletes its photos (cascade)
-- ---------------------------------------------------------------------------
delete from public.trips where id = '10000000-0000-4000-8000-000000000002';

-- Counted without RLS (back to the connecting role), so "gone" cannot be a side effect of the policies hiding rows.
reset role;
select test_helpers.ok(
  (select count(*) from public.trip_photos where trip_id = '10000000-0000-4000-8000-000000000002') = 0,
  'deleting a trip also deletes its photos (cascade)'
);
select test_helpers.ok(
  (select count(*) from public.trip_photos where trip_id = '10000000-0000-4000-8000-000000000001') = 1,
  'deleting one trip leaves the photos of the owner''s other trip alone'
);

-- ---------------------------------------------------------------------------
-- Requests without a session get nothing
-- ---------------------------------------------------------------------------
select test_helpers.logout();

select test_helpers.throws('select count(*) from public.trip_photos', '42501', 'anon cannot read photos');
select test_helpers.throws(
  $$insert into public.trip_photos (id, trip_id, taken_at, created_at)
    values ('50000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001', null, now())$$,
  '42501', 'anon cannot add a photo');

select 'trip_photos_rls: all checks passed' as result;
rollback;
