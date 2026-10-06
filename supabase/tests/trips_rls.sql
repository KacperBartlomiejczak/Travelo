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
    'cover_image_uri', null,
    'destination', 'BKK',
    'start_date', '2026-11-03',
    'end_date', '2026-11-15',
    'base_currency', 'THB',
    'budget_per_person_minor', 3000000,
    'budget_updated_at', '2026-10-04T12:00:00Z',
    'created_at', '2026-10-04T12:00:00Z'
  ) || overrides
$$;

create function test_helpers.members_payload(trip_id uuid) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('id', '20000000-0000-4000-8000-000000000001', 'trip_id', trip_id, 'user_id', null,
      'display_name', 'Kasia', 'role', 'viewer', 'interests', jsonb_build_array('beaches', 'nightlife')),
    jsonb_build_object('id', '20000000-0000-4000-8000-000000000002', 'trip_id', trip_id, 'user_id', null,
      'display_name', 'Ola', 'role', 'viewer', 'interests', jsonb_build_array())
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

-- A links C as a read-only member (the app cannot do this yet, A5).
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
values ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-a000-00000000000c', 'Celina', 'viewer', '{}');

-- ---------------------------------------------------------------------------
-- Last write wins on the budget
-- ---------------------------------------------------------------------------
update public.trips set budget_per_person_minor = 1, budget_updated_at = '2026-10-01T00:00:00Z'
where id = '10000000-0000-4000-8000-000000000001' and budget_updated_at < '2026-10-01T00:00:00Z';
select test_helpers.ok(
  (select budget_per_person_minor from public.trips) = 3000000,
  'an older budget change does not overwrite a newer one'
);

update public.trips set budget_per_person_minor = 2500000, budget_updated_at = '2026-10-06T09:30:00Z'
where id = '10000000-0000-4000-8000-000000000001' and budget_updated_at < '2026-10-06T09:30:00Z';
update public.trips set budget_per_person_minor = 2500000, budget_updated_at = '2026-10-06T09:30:00Z'
where id = '10000000-0000-4000-8000-000000000001' and budget_updated_at < '2026-10-06T09:30:00Z';
select test_helpers.ok(
  (select budget_per_person_minor from public.trips) = 2500000
    and (select budget_updated_at from public.trips) = '2026-10-06T09:30:00Z',
  'a newer budget change wins, and sending it twice changes nothing more'
);

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
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f4', '{"budget_per_person_minor": -1}'), '[]', '[]'),
  '23514', 'a negative budget is rejected');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f5', '{"base_currency": "thb"}'), '[]', '[]'),
  '23514', 'a lowercase currency is rejected');
select test_helpers.throws(
  format('select public.create_trip(%L, %L, %L)',
    test_helpers.trip_payload('10000000-0000-4000-8000-0000000000f6', '{"destination": "Bangkok"}'), '[]', '[]'),
  '23514', 'a destination that is not an IATA code is rejected');
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests)
    values ('20000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000001', 'Ewa', 'viewer', '{golf}')$$,
  '23514', 'an unknown interest is rejected');
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests)
    values ('20000000-0000-4000-8000-0000000000f2', '10000000-0000-4000-8000-000000000001', '   ', 'viewer', '{}')$$,
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
delete from public.flight_segments;

select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests)
    values ('20000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 'Intruder', 'viewer', '{}')$$,
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
      'display_name', 'Intruder', 'role', 'viewer', 'interests', jsonb_build_array())),
    '[]'),
  '42501', 'B cannot reuse A''s trip id to add members through create_trip');

-- ---------------------------------------------------------------------------
-- Linked viewer C reads, never writes
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000c');

select test_helpers.ok((select count(*) from public.trips) = 1, 'C sees the trip they are linked to');
select test_helpers.ok((select count(*) from public.trip_members) = 3, 'C sees the trip''s members');
select test_helpers.ok((select count(*) from public.flight_segments) = 3, 'C sees the trip''s segments');

update public.trips set name = 'Changed by C', budget_per_person_minor = 1;
delete from public.trips;
update public.trip_members set display_name = 'Changed by C';
delete from public.trip_members;
delete from public.flight_segments;

select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, display_name, role, interests)
    values ('20000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001', 'Friend of C', 'viewer', '{}')$$,
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
  (select name from public.trips) = 'Warsaw → Bangkok' and (select budget_per_person_minor from public.trips) = 2500000,
  'A''s trip is unchanged'
);
select test_helpers.ok(
  (select count(*) from public.trip_members) = 3
    and not exists (select 1 from public.trip_members where display_name in ('Hacked', 'Changed by C')),
  'A''s members are unchanged'
);
select test_helpers.ok((select count(*) from public.flight_segments) = 3, 'A''s segments are unchanged');

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

select 'trips_rls: all checks passed' as result;
rollback;
