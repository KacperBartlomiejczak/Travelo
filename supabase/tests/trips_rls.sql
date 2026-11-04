-- Trips, members and flight segments: RLS, constraints, idempotent create_trip, last-write-wins budget.
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

-- A trip as the app sends it: WAW → DXB → BKK, BKK → WAW, two friends.
create function test_helpers.trip_payload(trip_id uuid, overrides jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', trip_id,
    'name', 'Warsaw → Bangkok',
    'cover_image_uri', 'preset:auckland',
    'destination', 'BKK',
    'start_date', '2026-11-03',
    'end_date', '2026-11-15',
    'base_currency', 'THB',
    'daily_budget_minor', 3000000,
    'budget_updated_at', '2026-10-04T12:00:00Z',
    'created_at', '2026-10-04T12:00:00Z'
  ) || overrides
$$;

create function test_helpers.members_payload(trip_id uuid) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('id', '20000000-0000-4000-8000-000000000001', 'trip_id', trip_id, 'user_id', null,
      'display_name', 'Kasia', 'role', 'viewer', 'interests', jsonb_build_array('beaches', 'nightlife'), 'daily_budget_minor', 100000),
    jsonb_build_object('id', '20000000-0000-4000-8000-000000000002', 'trip_id', trip_id, 'user_id', null,
      'display_name', 'Ola', 'role', 'viewer', 'interests', jsonb_build_array(), 'daily_budget_minor', 150000)
  )
$$;

create function test_helpers.segments_payload(trip_id uuid) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('id', '30000000-0000-4000-8000-000000000001', 'trip_id', trip_id, 'direction', 'outbound', 'position', 0,
      'flight_number', 'EK180', 'from_iata', 'WAW', 'to_iata', 'DXB',
      'depart_at', '2026-11-02T10:00:00+01:00', 'depart_tz', 'Europe/Warsaw', 'arrive_at', '2026-11-02T18:30:00+04:00', 'arrive_tz', 'Asia/Dubai'),
    jsonb_build_object('id', '30000000-0000-4000-8000-000000000002', 'trip_id', trip_id, 'direction', 'outbound', 'position', 1,
      'flight_number', null, 'from_iata', 'DXB', 'to_iata', 'BKK',
      'depart_at', '2026-11-03T03:30:00+04:00', 'depart_tz', 'Asia/Dubai', 'arrive_at', '2026-11-03T12:45:00+07:00', 'arrive_tz', 'Asia/Bangkok'),
    jsonb_build_object('id', '30000000-0000-4000-8000-000000000003', 'trip_id', trip_id, 'direction', 'return', 'position', 0,
      'flight_number', null, 'from_iata', 'BKK', 'to_iata', 'WAW',
      'depart_at', '2026-11-15T09:00:00+07:00', 'depart_tz', 'Asia/Bangkok', 'arrive_at', '2026-11-15T16:00:00+01:00', 'arrive_tz', 'Europe/Warsaw')
  )
$$;

grant execute on all functions in schema test_helpers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Organizer A creates a trip
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

-- owner_id in the payload is ignored: the trip always belongs to the caller.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000001', '{"owner_id": "00000000-0000-4000-a000-00000000000b"}'),
  test_helpers.members_payload('10000000-0000-4000-8000-000000000001'),
  test_helpers.segments_payload('10000000-0000-4000-8000-000000000001')
);

select test_helpers.ok((select count(*) from public.trips) = 1, 'A sees the trip they created');
select test_helpers.ok(
  (select owner_id from public.trips) = '00000000-0000-4000-a000-00000000000a',
  'the trip belongs to the caller, not to the owner_id sent in the payload'
);
select test_helpers.ok((select count(*) from public.trip_members) = 2, 'A sees both friends');
select test_helpers.ok(
  (select interests from public.trip_members where display_name = 'Kasia') = array['beaches', 'nightlife'],
  'friends keep their interests'
);
select test_helpers.ok((select count(*) from public.flight_segments) = 3, 'A sees all three segments');

-- Retrying the same create (lost response, sync retry) adds nothing.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000001'),
  test_helpers.members_payload('10000000-0000-4000-8000-000000000001'),
  test_helpers.segments_payload('10000000-0000-4000-8000-000000000001')
);
select test_helpers.ok(
  (select count(*) from public.trips) = 1
    and (select count(*) from public.trip_members) = 2
    and (select count(*) from public.flight_segments) = 3,
  'create_trip is idempotent'
);

-- C is a linked read-only member of A's trip. The owner cannot write user_id any more (friend-invite D12: the server
-- links only by friend code), so the fixture row is written as the superuser; friend_invite.sql covers the real path.
reset role;
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests, daily_budget_minor)
values ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-a000-00000000000c', 'Celina', 'viewer', '{}', 100000);
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

-- The owner cannot hand the trip to someone else.
select test_helpers.throws(
  $$update public.trips set owner_id = '00000000-0000-4000-a000-00000000000b' where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot change the owner of a trip');

-- ---------------------------------------------------------------------------
-- Last write wins on the budget
-- ---------------------------------------------------------------------------
select test_helpers.ok(
  (select daily_budget_minor from public.trips) = 3000000
    and (select daily_budget_minor from public.trip_members where display_name = 'Ola') = 150000,
  'create_trip stores the organizer''s and each friend''s daily budget'
);

select public.set_trip_budget('10000000-0000-4000-8000-000000000001', 1, jsonb_build_array(
  jsonb_build_object('member_id', '20000000-0000-4000-8000-000000000002', 'daily_budget_minor', 1)), '2026-10-01T00:00:00Z');
select test_helpers.ok(
  (select daily_budget_minor from public.trips) = 3000000
    and (select daily_budget_minor from public.trip_members where display_name = 'Ola') = 150000,
  'an older budget change does not overwrite a newer one, members included'
);

select public.set_trip_budget('10000000-0000-4000-8000-000000000001', 2500000, jsonb_build_array(
  jsonb_build_object('member_id', '20000000-0000-4000-8000-000000000001', 'daily_budget_minor', 2500000),
  jsonb_build_object('member_id', '20000000-0000-4000-8000-000000000002', 'daily_budget_minor', 90000)), '2026-10-06T09:30:00Z');
select public.set_trip_budget('10000000-0000-4000-8000-000000000001', 2500000, jsonb_build_array(
  jsonb_build_object('member_id', '20000000-0000-4000-8000-000000000001', 'daily_budget_minor', 2500000),
  jsonb_build_object('member_id', '20000000-0000-4000-8000-000000000002', 'daily_budget_minor', 90000)), '2026-10-06T09:30:00Z');
select test_helpers.ok(
  (select daily_budget_minor from public.trips) = 2500000
    and (select budget_updated_at from public.trips) = '2026-10-06T09:30:00Z'
    and (select daily_budget_minor from public.trip_members where display_name = 'Kasia') = 2500000
    and (select daily_budget_minor from public.trip_members where display_name = 'Ola') = 90000,
  'a newer budget change wins for the trip and its friends, and sending it twice changes nothing more'
);

-- A member of another trip is rejected, and nothing at all is changed.
reset role;
insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency, daily_budget_minor, budget_updated_at)
values ('10000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-a000-00000000000a', 'Other trip', 'BKK',
        '2026-11-03', '2026-11-15', 'THB', 100, '2026-10-04T12:00:00Z');
insert into public.trip_members (id, trip_id, display_name, role, interests, daily_budget_minor)
values ('20000000-0000-4000-8000-0000000000a9', '10000000-0000-4000-8000-0000000000a9', 'Elsewhere', 'viewer', '{}', 100);
select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.throws(
  $$select public.set_trip_budget('10000000-0000-4000-8000-000000000001', 7, jsonb_build_array(
    jsonb_build_object('member_id', '20000000-0000-4000-8000-0000000000a9', 'daily_budget_minor', 7)), '2026-10-07T00:00:00Z')$$,
  '22023', 'set_trip_budget rejects a member who is not in the trip');
select test_helpers.ok(
  (select daily_budget_minor from public.trips where id = '10000000-0000-4000-8000-000000000001') = 2500000
    and (select daily_budget_minor from public.trip_members where display_name = 'Elsewhere') = 100,
  'a rejected set_trip_budget changes nothing');
reset role;
delete from public.trips where id = '10000000-0000-4000-8000-0000000000a9';
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

-- ---------------------------------------------------------------------------
-- Constraints mirror the Zod schemas
-- ---------------------------------------------------------------------------
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f1', jsonb_build_object('name', repeat('a', 61))), '[]', '[]'),
  '23514', 'a 61-character name is rejected');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f2', '{"name": ""}'), '[]', '[]'),
  '23514', 'an empty name is rejected');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f3', '{"end_date": "2026-11-01"}'), '[]', '[]'),
  '23514', 'an end date before the start date is rejected');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f4', '{"daily_budget_minor": 0}'), '[]', '[]'),
  '23514', 'a zero daily budget is rejected');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f5', '{"base_currency": "thb"}'), '[]', '[]'),
  '23514', 'a lowercase currency is rejected');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f6', '{"destination": "Bangkok"}'), '[]', '[]'),
  '23514', 'a destination that is not an IATA code is rejected');
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests, daily_budget_minor)
    values ('20000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000001', 'Ewa', 'viewer', '{golf}', 100000)$$,
  '23514', 'an unknown interest is rejected');
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests, daily_budget_minor)
    values ('20000000-0000-4000-8000-0000000000f2', '10000000-0000-4000-8000-000000000001', '   ', 'viewer', '{}', 100000)$$,
  '23514', 'a blank display name is rejected');
select test_helpers.throws(
  $$insert into public.flight_segments (id, trip_id, direction, position, from_iata, to_iata, depart_at, depart_tz, arrive_at, arrive_tz)
    values ('30000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000001', 'internal', 0, 'BKK', 'HKT',
            '2026-11-05T10:00:00+07:00', 'Asia/Bangkok', '2026-11-05T10:00:00+07:00', 'Asia/Bangkok')$$,
  '23514', 'an arrival that is not after the departure is rejected');
select test_helpers.throws(
  $$insert into public.flight_segments (id, trip_id, direction, position, from_iata, to_iata, depart_at, depart_tz, arrive_at, arrive_tz)
    values ('30000000-0000-4000-8000-0000000000f2', '10000000-0000-4000-8000-000000000001', 'outbound', 0, 'WAW', 'DXB',
            '2026-11-02T10:00:00+01:00', 'Europe/Warsaw', '2026-11-02T18:30:00+04:00', 'Asia/Dubai')$$,
  '23505', 'two segments in the same place of one direction are rejected');

-- ---------------------------------------------------------------------------
-- Stranger B sees and changes nothing
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000b');

select test_helpers.ok((select count(*) from public.trips) = 0, 'B cannot see A''s trip');
select test_helpers.ok((select count(*) from public.trip_members) = 0, 'B cannot see A''s members');
select test_helpers.ok((select count(*) from public.flight_segments) = 0, 'B cannot see A''s segments');

update public.trips set name = 'Hacked';
delete from public.trips;
update public.trip_members set display_name = 'Hacked';
delete from public.trip_members;
update public.flight_segments set flight_number = 'XX1';
delete from public.flight_segments;

select test_helpers.throws(
  $$insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency,
                              daily_budget_minor, budget_updated_at)
    values ('10000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-a000-00000000000a', 'Planted', 'BKK',
            '2026-11-03', '2026-11-15', 'THB', 1, now())$$,
  '42501', 'B cannot create a trip owned by A');

select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests, daily_budget_minor)
    values ('20000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 'Intruder', 'viewer', '{}', 100000)$$,
  '42501', 'B cannot add a member to A''s trip');
select test_helpers.throws(
  $$insert into public.flight_segments (id, trip_id, direction, position, from_iata, to_iata, depart_at, depart_tz, arrive_at, arrive_tz)
    values ('30000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 'internal', 0, 'BKK', 'HKT',
            '2026-11-05T10:00:00+07:00', 'Asia/Bangkok', '2026-11-05T11:30:00+07:00', 'Asia/Bangkok')$$,
  '42501', 'B cannot add a segment to A''s trip');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-000000000001'),
    jsonb_build_array(jsonb_build_object('id', '20000000-0000-4000-8000-0000000000b2', 'trip_id', '10000000-0000-4000-8000-000000000001',
      'display_name', 'Intruder', 'role', 'viewer', 'interests', jsonb_build_array(), 'daily_budget_minor', 100000)),
    '[]'),
  '42501', 'B cannot reuse A''s trip id to add members through create_trip');

select test_helpers.throws(
  $$select public.set_trip_budget('10000000-0000-4000-8000-000000000001', 1, '[]', '2030-01-01T00:00:00Z')$$,
  '42501', 'B cannot change A''s budget through set_trip_budget');

-- ---------------------------------------------------------------------------
-- Linked viewer C reads, never writes
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000c');

select test_helpers.ok((select count(*) from public.trips) = 1, 'C sees the trip they are linked to');
select test_helpers.ok((select count(*) from public.trip_members) = 3, 'C sees the trip''s members');
select test_helpers.ok((select count(*) from public.flight_segments) = 3, 'C sees the trip''s segments');

update public.trips set name = 'Changed by C', daily_budget_minor = 1;
delete from public.trips;
update public.trip_members set display_name = 'Changed by C';
delete from public.trip_members;
update public.flight_segments set flight_number = 'XX1';
delete from public.flight_segments;

select test_helpers.throws(
  $$select public.set_trip_budget('10000000-0000-4000-8000-000000000001', 1, '[]', '2030-01-01T00:00:00Z')$$,
  '42501', 'C cannot change the budget through set_trip_budget');
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests, daily_budget_minor)
    values ('20000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001', 'Friend of C', 'viewer', '{}', 100000)$$,
  '42501', 'C cannot add a member');
select test_helpers.throws(
  $$insert into public.flight_segments (id, trip_id, direction, position, from_iata, to_iata, depart_at, depart_tz, arrive_at, arrive_tz)
    values ('30000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001', 'internal', 0, 'BKK', 'HKT',
            '2026-11-05T10:00:00+07:00', 'Asia/Bangkok', '2026-11-05T11:30:00+07:00', 'Asia/Bangkok')$$,
  '42501', 'C cannot add a segment');

-- ---------------------------------------------------------------------------
-- Nothing B or C tried changed A's data
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

select test_helpers.ok(
  (select name from public.trips) = 'Warsaw → Bangkok' and (select daily_budget_minor from public.trips) = 2500000,
  'A''s trip is unchanged'
);
select test_helpers.ok(
  (select count(*) from public.trip_members) = 3
    and not exists (select 1 from public.trip_members where display_name in ('Hacked', 'Changed by C')),
  'A''s members are unchanged'
);
select test_helpers.ok(
  (select count(*) from public.flight_segments) = 3
    and not exists (select 1 from public.flight_segments where flight_number = 'XX1'),
  'A''s segments are unchanged'
);
select test_helpers.ok(
  (select owner_id from public.trips) = '00000000-0000-4000-a000-00000000000a',
  'A still owns the trip'
);

-- ---------------------------------------------------------------------------
-- Owner A edits and deletes a trip (trip-edit-menu, step 2)
-- Uses its own trip, so the fixture trip above and the checks around it are not affected.
-- ---------------------------------------------------------------------------
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-0000000000e1', '{"name": "Old name", "cover_image_uri": "preset:bali"}'),
  jsonb_build_array(
    jsonb_build_object('id', '20000000-0000-4000-8000-0000000000e1', 'trip_id', '10000000-0000-4000-8000-0000000000e1',
      'user_id', null, 'display_name', 'Basia', 'role', 'viewer', 'interests', jsonb_build_array('museums'))),
  jsonb_build_array(
    jsonb_build_object('id', '30000000-0000-4000-8000-0000000000e1', 'trip_id', '10000000-0000-4000-8000-0000000000e1',
      'direction', 'outbound', 'position', 0, 'flight_number', null, 'from_iata', 'WAW', 'to_iata', 'BKK',
      'depart_at', '2026-11-02T10:00:00+01:00', 'depart_tz', 'Europe/Warsaw',
      'arrive_at', '2026-11-03T12:45:00+07:00', 'arrive_tz', 'Asia/Bangkok'))
);

update public.trips set name = 'Thailand 2026', cover_image_uri = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c'
where id = '10000000-0000-4000-8000-0000000000e1';
select test_helpers.ok(
  (select name from public.trips where id = '10000000-0000-4000-8000-0000000000e1') = 'Thailand 2026'
    and (select cover_image_uri from public.trips where id = '10000000-0000-4000-8000-0000000000e1') = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c',
  'A can change the name and the cover of their trip'
);

-- A cover is required now (trip-covers); the cases are in trip_covers.sql.
select test_helpers.throws(
  $$update public.trips set cover_image_uri = null where id = '10000000-0000-4000-8000-0000000000e1'$$,
  '23502', 'A cannot remove the cover (null)');
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '10000000-0000-4000-8000-0000000000e1') = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c'
    and (select name from public.trips where id = '10000000-0000-4000-8000-0000000000e1') = 'Thailand 2026',
  'the refused update left the cover and the name as they were'
);

delete from public.trips where id = '10000000-0000-4000-8000-0000000000e1';

-- Counted without RLS (back to the connecting role), so "gone" cannot be a side effect of the policies hiding rows.
reset role;
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-0000000000e1') = 0,
  'deleting a trip also deletes its members and segments (cascade)'
);
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000001') = 1
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000001') = 3
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-000000000001') = 3,
  'deleting one trip leaves the owner''s other trip, its members and segments alone'
);

-- ---------------------------------------------------------------------------
-- Existing trips are converted by the migration (daily-budget B5): floor(total / days), at least 1.
-- The migration's UPDATE calls private.daily_from_total, so this tests the real formula.
-- ---------------------------------------------------------------------------
select test_helpers.ok(
  private.daily_from_total(700, '2026-11-03', '2026-11-09') = 100
    and private.daily_from_total(3000000, '2026-11-03', '2026-11-15') = 230769
    and private.daily_from_total(5, '2026-11-03', '2026-11-09') = 1,
  'the backfill is floor(total / days), and at least 1'
);

-- ---------------------------------------------------------------------------
-- Requests without a session get nothing
-- ---------------------------------------------------------------------------
select test_helpers.logout();

select test_helpers.throws('select count(*) from public.trips', '42501', 'anon cannot read trips');
select test_helpers.throws('select count(*) from public.trip_members', '42501', 'anon cannot read members');
select test_helpers.throws('select count(*) from public.flight_segments', '42501', 'anon cannot read segments');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)', test_helpers.trip_payload('10000000-0000-4000-8000-0000000000a1'), '[]', '[]'),
  '42501', 'anon cannot create a trip');
select test_helpers.throws(
  $$select private.is_trip_owner('10000000-0000-4000-8000-000000000001')$$,
  '42501', 'anon cannot call the access helpers');

select 'trips_rls: all checks passed' as result;
rollback;
