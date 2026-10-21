-- Friend invite (prompts/friend-invite/plan.md, steps 2 and 2b): the friend-code lookup (nick and interests, no id), the
-- organizer's nick for participants, linking only by a friend code the server resolves itself (D12), the unique link
-- per trip, the self-link guard, direct writes of user_id refused, and that a linked friend stays read-only.
-- Plain SQL (not pgTAP): run with `pnpm test:db`. Everything is rolled back at the end.
-- Needs Supabase's own `auth` schema (a local Supabase, not plain Postgres).
--
-- Fixtures: organizer A, linked friend B, stranger C, and an anonymous-session user E. The tests look only at their
-- own rows: a real database may hold other profiles and trips.
begin;

-- ---------------------------------------------------------------------------
-- Helpers (rolled back with the test)
-- ---------------------------------------------------------------------------
create schema test_helpers;
grant usage on schema test_helpers to anon, authenticated;

-- Acts as a signed-in user for the rest of the transaction, like a request with that user's JWT.
-- `anonymous` sets the is_anonymous claim, as Supabase does for anonymous sign-ins.
create function test_helpers.login(user_id uuid, anonymous boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated', 'is_anonymous', anonymous)::text, true);
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

-- Runs a statement as the current role and returns how many rows it changed. Row Level Security hides rows
-- instead of failing for select / update / delete, so "nothing changed" is a count of 0, not an error.
create function test_helpers.changes(query text) returns bigint language plpgsql as $$
declare
  affected bigint;
begin
  execute query;
  get diagnostics affected = row_count;
  return affected;
end $$;

-- A trip as the app sends it: WAW → DXB → BKK, BKK → WAW.
create function test_helpers.trip_payload(trip_id uuid) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', trip_id,
    'name', 'Warsaw → Bangkok',
    'cover_image_uri', 'preset:auckland',
    'destination', 'BKK',
    'start_date', '2026-11-03',
    'end_date', '2026-11-15',
    'base_currency', 'THB',
    'budget_per_person_minor', 3000000,
    'budget_updated_at', '2026-10-04T12:00:00Z',
    'created_at', '2026-10-04T12:00:00Z'
  )
$$;

-- One member as create_trip receives it: a friend without an account, or one with a friend_code to link.
-- `raw_user_id` is what a hostile client could send; the server must ignore it.
create function test_helpers.member(member_id uuid, trip_id uuid, friend_code text, display_name text,
                                    raw_user_id uuid default null) returns jsonb language sql as $$
  select jsonb_build_object('id', member_id, 'trip_id', trip_id, 'friend_code', friend_code, 'user_id', raw_user_id,
    'display_name', display_name, 'role', 'viewer', 'interests', jsonb_build_array('beaches'))
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

-- Organizer A, linked friend B, stranger C, anonymous-session user E.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000b'),
  ('00000000-0000-4000-a000-00000000000c'),
  ('00000000-0000-4000-a000-00000000000e');

-- Profiles with fixed friend codes (the trigger would draw random ones, and a random code could be all digits, which
-- would make the lowercase check meaningless). Triggers are switched off only for these inserts.
set local session_replication_role = replica;
insert into public.profiles (id, username, friend_code, interests) values
  ('00000000-0000-4000-a000-00000000000a', 'alice', 'ABCDEF', array['museums']),
  ('00000000-0000-4000-a000-00000000000b', 'bella', 'K7QX2M', array['beaches', 'nightlife']),
  ('00000000-0000-4000-a000-00000000000c', 'carol', 'NPRSTU', array['cycling']);
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- find_profile_by_friend_code: grants
-- ---------------------------------------------------------------------------
select test_helpers.ok(
  has_function_privilege('authenticated', 'public.find_profile_by_friend_code(text)', 'execute')
    and not has_function_privilege('anon', 'public.find_profile_by_friend_code(text)', 'execute'),
  'the lookup is executable by authenticated and not by anon');
select test_helpers.ok(
  not has_function_privilege('anon', 'private.link_trip_member(uuid, text)', 'execute')
    and has_function_privilege('authenticated', 'private.link_trip_member(uuid, text)', 'execute'),
  'the linking helper is executable by authenticated (create_trip runs as the caller) and not by anon');
select test_helpers.ok(
  not exists (select 1 from pg_proc where proname = 'link_trip_member' and pronamespace = 'public'::regnamespace),
  'the linking helper is not in the public schema, so the Data API does not expose it');
select test_helpers.ok(
  has_function_privilege('authenticated', 'public.trip_organizer_username(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.trip_organizer_username(uuid)', 'execute'),
  'the organizer-nick function is executable by authenticated and not by anon');

-- ---------------------------------------------------------------------------
-- find_profile_by_friend_code: behavior
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

select test_helpers.ok(
  (select count(*) from public.find_profile_by_friend_code('K7QX2M')) = 1
    and (select username from public.find_profile_by_friend_code('K7QX2M')) = 'bella'
    and (select interests from public.find_profile_by_friend_code('K7QX2M')) = array['beaches', 'nightlife'],
  'a valid code returns that profile''s username and interests');
select test_helpers.ok(
  (select proargnames from pg_proc where proname = 'find_profile_by_friend_code' and pronamespace = 'public'::regnamespace)
    = array['code', 'username', 'interests'],
  'the lookup returns exactly username and interests (never the account id, the friend code or the avatar)');
select test_helpers.ok(
  (select count(*) from pg_proc where proname = 'find_profile_by_friend_code' and pronamespace = 'public'::regnamespace) = 1,
  'there is one lookup function (the old one that returned the id is gone)');
select test_helpers.ok(
  (select count(*) from public.find_profile_by_friend_code('QQQQQQ')) = 0,
  'an unknown code returns no rows');
select test_helpers.ok(
  (select count(*) from public.find_profile_by_friend_code('k7qx2m')) = 0,
  'a lowercase code returns no rows (exact match)');
select test_helpers.ok(
  (select count(*) from public.find_profile_by_friend_code(' K7QX2M')) = 0
    and (select count(*) from public.find_profile_by_friend_code('K7QX2')) = 0
    and (select count(*) from public.find_profile_by_friend_code('K7QX2M%')) = 0
    and (select count(*) from public.find_profile_by_friend_code('%')) = 0
    and (select count(*) from public.find_profile_by_friend_code('')) = 0
    and (select count(*) from public.find_profile_by_friend_code(null)) = 0,
  'padded, partial, wildcard, empty and null codes return no rows');
select test_helpers.ok(
  (select username from public.find_profile_by_friend_code('ABCDEF')) = 'alice',
  'a caller can look up their own code (the app rejects it on its side)');

-- A session without a real account gets nothing.
select test_helpers.login('00000000-0000-4000-a000-00000000000e', true);
select test_helpers.ok(
  (select count(*) from public.find_profile_by_friend_code('K7QX2M')) = 0,
  'an anonymous-session user finds nothing');

-- Requests without a session are refused.
select test_helpers.logout();
select test_helpers.throws($$select * from public.find_profile_by_friend_code('K7QX2M')$$, '42501',
  'anon cannot call the lookup');
select test_helpers.throws($$select public.trip_organizer_username('10000000-0000-4000-8000-000000000001')$$, '42501',
  'anon cannot call the organizer-nick function');

-- The lookup must not open profiles up: C still reads only their own row.
select test_helpers.login('00000000-0000-4000-a000-00000000000c');
select test_helpers.ok(
  (select count(*) from public.profiles where id in
    ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000b')) = 0
    and (select count(*) from public.profiles where id = '00000000-0000-4000-a000-00000000000c') = 1,
  'the lookup does not let C read other profiles directly');

-- ---------------------------------------------------------------------------
-- create_trip: accounts are linked only by a friend code the server resolves (D12)
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

-- A user_id sent without a code is ignored: the member is stored as a friend without an account, and B cannot see the trip.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000006'),
  jsonb_build_array(
    test_helpers.member('20000000-0000-4000-8000-000000000071', '10000000-0000-4000-8000-000000000006', null, 'Sneaky',
      '00000000-0000-4000-a000-00000000000b')),
  '[]'::jsonb
);
select test_helpers.ok(
  (select user_id from public.trip_members where id = '20000000-0000-4000-8000-000000000071') is null,
  'a user_id in the payload without a friend code is stored as null');
-- Even next to a valid code the raw user_id loses: the code decides, not the id.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000007'),
  jsonb_build_array(
    test_helpers.member('20000000-0000-4000-8000-000000000072', '10000000-0000-4000-8000-000000000007', 'NPRSTU', 'carol',
      '00000000-0000-4000-a000-00000000000b')),
  '[]'::jsonb
);
select test_helpers.ok(
  (select user_id from public.trip_members where id = '20000000-0000-4000-8000-000000000072')
    = '00000000-0000-4000-a000-00000000000c',
  'with a friend code the member is linked to that code''s account, whatever user_id was sent');

-- A normal linked member (B, by code) next to a friend without an account.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000001'),
  jsonb_build_array(
    test_helpers.member('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'K7QX2M', 'bella'),
    test_helpers.member('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, 'Kasia')),
  test_helpers.segments_payload('10000000-0000-4000-8000-000000000001')
);
select test_helpers.ok(
  (select user_id from public.trip_members where id = '20000000-0000-4000-8000-000000000001')
    = '00000000-0000-4000-a000-00000000000b'
    and (select user_id from public.trip_members where id = '20000000-0000-4000-8000-000000000002') is null,
  'create_trip links the member with a friend code to that account and leaves the other one unlinked');

-- Retrying the same request (lost response): no error, no duplicate, still linked once.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000001'),
  jsonb_build_array(
    test_helpers.member('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'K7QX2M', 'bella'),
    test_helpers.member('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, 'Kasia')),
  test_helpers.segments_payload('10000000-0000-4000-8000-000000000001')
);
select test_helpers.ok(
  (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000001') = 2
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000001'
         and user_id = '00000000-0000-4000-a000-00000000000b') = 1
    and (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000001') = 1
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-000000000001') = 3,
  'a retried create_trip with a linked member adds no duplicate and keeps the link');
-- A retry can never re-point an existing link: a different code for the same member id is ignored.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000001'),
  jsonb_build_array(
    test_helpers.member('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'NPRSTU', 'bella')),
  '[]'::jsonb
);
select test_helpers.ok(
  (select user_id from public.trip_members where id = '20000000-0000-4000-8000-000000000001')
    = '00000000-0000-4000-a000-00000000000b',
  'a retry with another code does not re-point an existing link');

-- An unknown code, a lowercase code and an empty code: FI002, nothing saved.
select test_helpers.throws(
  $$select public.create_trip(
      test_helpers.trip_payload('10000000-0000-4000-8000-000000000008'),
      jsonb_build_array(
        test_helpers.member('20000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000008', 'QQQQQQ', 'ghost')),
      '[]'::jsonb)$$,
  'FI002', 'an unknown friend code fails with FI002');
select test_helpers.throws(
  $$select public.create_trip(
      test_helpers.trip_payload('10000000-0000-4000-8000-000000000008'),
      jsonb_build_array(
        test_helpers.member('20000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000008', 'k7qx2m', 'bella')),
      '[]'::jsonb)$$,
  'FI002', 'a lowercase friend code fails with FI002 (exact match)');
select test_helpers.throws(
  $$select public.create_trip(
      test_helpers.trip_payload('10000000-0000-4000-8000-000000000008'),
      jsonb_build_array(
        test_helpers.member('20000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000008', '', 'ghost')),
      '[]'::jsonb)$$,
  'FI002', 'an empty friend code fails with FI002');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000008') = 0
    and (select count(*) from public.trip_members where id = '20000000-0000-4000-8000-000000000081') = 0,
  'a refused create_trip leaves no trip and no member behind');

-- A cannot link themselves; FI001 is what the app maps to "That is your own code". Nothing saved.
select test_helpers.throws(
  $$select public.create_trip(
      test_helpers.trip_payload('10000000-0000-4000-8000-000000000005'),
      jsonb_build_array(
        test_helpers.member('20000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000005', 'ABCDEF', 'alice')),
      '[]'::jsonb)$$,
  'FI001', 'the caller''s own friend code fails with FI001');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000005') = 0
    and (select count(*) from public.trip_members where id = '20000000-0000-4000-8000-000000000041') = 0,
  'a refused self-link leaves no trip and no member behind');

-- The same friend code twice in one trip: the unique index refuses (23505), nothing saved.
select test_helpers.throws(
  $$select public.create_trip(
      test_helpers.trip_payload('10000000-0000-4000-8000-000000000002'),
      jsonb_build_array(
        test_helpers.member('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 'K7QX2M', 'bella'),
        test_helpers.member('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 'K7QX2M', 'bella again')),
      '[]'::jsonb)$$,
  '23505', 'the same friend code twice in one trip fails with 23505');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000002') = 0
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000002') = 0,
  'a refused duplicate leaves no trip and no member behind');

-- Several friends without an account are fine (the index covers only linked members).
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000003'),
  jsonb_build_array(
    test_helpers.member('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000003', null, 'Kasia'),
    test_helpers.member('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000003', null, 'Ola')),
  '[]'::jsonb
);
select test_helpers.ok(
  (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000003') = 2,
  'two friends without an account in one trip are allowed');

-- The same account in two different trips is fine.
select public.create_trip(
  test_helpers.trip_payload('10000000-0000-4000-8000-000000000004'),
  jsonb_build_array(
    test_helpers.member('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000004', 'K7QX2M', 'bella')),
  '[]'::jsonb
);
select test_helpers.ok(
  (select count(*) from public.trip_members where user_id = '00000000-0000-4000-a000-00000000000b') = 2,
  'the same account can be linked to two different trips');

-- ---------------------------------------------------------------------------
-- Direct writes of user_id are refused (D12): only the server-side linking can set it
-- ---------------------------------------------------------------------------
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
    values ('20000000-0000-4000-8000-000000000051', '10000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-a000-00000000000c', 'carol directly', 'viewer', '{}')$$,
  '42501', 'the owner cannot insert a member with a user_id directly');
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
    values ('20000000-0000-4000-8000-000000000052', '10000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-a000-00000000000a', 'myself directly', 'viewer', '{}')$$,
  '42501', 'the owner cannot link themselves by a direct insert');
select test_helpers.throws(
  $$update public.trip_members set user_id = '00000000-0000-4000-a000-00000000000c'
    where id = '20000000-0000-4000-8000-000000000002'$$,
  '42501', 'the owner cannot set user_id by a direct update');
select test_helpers.throws(
  $$update public.trip_members set user_id = null where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', 'the owner cannot unlink by a direct update either');
select test_helpers.throws(
  $$update public.trip_members set trip_id = '10000000-0000-4000-8000-000000000003' where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', 'the owner cannot move a member to another trip');
-- A plain friend without an account can still be added directly.
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
values ('20000000-0000-4000-8000-000000000053', '10000000-0000-4000-8000-000000000003', null, 'Zuzia', 'viewer', '{}');
select test_helpers.ok(
  (select count(*) from public.trip_members where id = '20000000-0000-4000-8000-000000000053') = 1,
  'the owner can still add a member without an account directly');
-- The owner can still edit the other columns of a linked member.
select test_helpers.ok(
  test_helpers.changes($$update public.trip_members set display_name = 'Bella B.', interests = array['museums'], pace = 'relaxed',
    budget_level = 'mid', dietary_notes = 'vegan' where id = '20000000-0000-4000-8000-000000000001'$$) = 1
    and (select user_id from public.trip_members where id = '20000000-0000-4000-8000-000000000001')
      = '00000000-0000-4000-a000-00000000000b',
  'the owner can update the name, interests, pace, budget level and notes of a linked member, which stays linked');
-- ...and delete a member.
select test_helpers.ok(
  test_helpers.changes($$delete from public.trip_members where id = '20000000-0000-4000-8000-000000000053'$$) = 1,
  'the owner can delete a member');

-- The helper cannot be used to link into a trip the caller does not own.
select test_helpers.login('00000000-0000-4000-a000-00000000000c');
select test_helpers.throws(
  $$select private.link_trip_member('20000000-0000-4000-8000-000000000002', 'NPRSTU')$$,
  '42501', 'C cannot call the linking helper for a member of A''s trip');
select test_helpers.throws(
  $$select public.create_trip(
      test_helpers.trip_payload('10000000-0000-4000-8000-000000000009'),
      jsonb_build_array(
        test_helpers.member('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', 'K7QX2M', 'hijack')),
      '[]'::jsonb)$$,
  '42501', 'C cannot link into A''s member by reusing its id in create_trip');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000009') = 0,
  'the refused hijack leaves no trip behind');
select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  (select user_id from public.trip_members where id = '20000000-0000-4000-8000-000000000002') is null,
  'A''s unlinked member is still unlinked');

-- ---------------------------------------------------------------------------
-- trip_organizer_username
-- ---------------------------------------------------------------------------
select test_helpers.ok(
  public.trip_organizer_username('10000000-0000-4000-8000-000000000001') = 'alice',
  'the owner gets their own nick');

select test_helpers.login('00000000-0000-4000-a000-00000000000b');
select test_helpers.ok(
  public.trip_organizer_username('10000000-0000-4000-8000-000000000001') = 'alice',
  'a linked member gets the organizer''s nick');
select test_helpers.ok(
  public.trip_organizer_username('10000000-0000-4000-8000-000000000003') is null,
  'B gets null for a trip they are not part of');

select test_helpers.login('00000000-0000-4000-a000-00000000000c');
select test_helpers.ok(
  public.trip_organizer_username('10000000-0000-4000-8000-000000000001') is null,
  'an unrelated user gets null');
select test_helpers.ok(
  public.trip_organizer_username('99999999-0000-4000-8000-000000000999') is null
    and public.trip_organizer_username(null) is null,
  'an unknown or null trip gives null');

-- ---------------------------------------------------------------------------
-- The linked friend B sees the trip, read-only; the stranger C sees nothing
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000b');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000001') = 1
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000001') = 2
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-000000000001') = 3,
  'B reads the trip, its members and its segments');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000003') = 0,
  'B does not see a trip they are not linked to');

select test_helpers.ok(
  test_helpers.changes($$update public.trips set name = 'Hacked' where id = '10000000-0000-4000-8000-000000000001'$$) = 0,
  'B cannot update the trip');
select test_helpers.ok(
  test_helpers.changes($$update public.trips set budget_per_person_minor = 1, budget_updated_at = '2030-01-01T00:00:00Z'
    where id = '10000000-0000-4000-8000-000000000001'$$) = 0,
  'B cannot change the budget');
select test_helpers.ok(
  test_helpers.changes($$update public.trip_members set display_name = 'Hacked' where trip_id = '10000000-0000-4000-8000-000000000001'$$) = 0,
  'B cannot update members');
select test_helpers.throws(
  $$update public.trip_members set user_id = null where trip_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', 'B cannot unlink members');
select test_helpers.ok(
  test_helpers.changes($$update public.flight_segments set flight_number = 'XX999' where trip_id = '10000000-0000-4000-8000-000000000001'$$) = 0,
  'B cannot update segments');
select test_helpers.ok(
  test_helpers.changes($$delete from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000001'$$) = 0
    and test_helpers.changes($$delete from public.flight_segments where trip_id = '10000000-0000-4000-8000-000000000001'$$) = 0
    and test_helpers.changes($$delete from public.trips where id = '10000000-0000-4000-8000-000000000001'$$) = 0,
  'B cannot delete the trip, its members or its segments');
select test_helpers.throws(
  $$insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
    values ('20000000-0000-4000-8000-000000000061', '10000000-0000-4000-8000-000000000001', null, 'Intruder', 'viewer', '{}')$$,
  '42501', 'B cannot add a member');
select test_helpers.throws(
  $$select private.link_trip_member('20000000-0000-4000-8000-000000000002', 'NPRSTU')$$,
  '42501', 'B cannot call the linking helper for a member of A''s trip');

select test_helpers.login('00000000-0000-4000-a000-00000000000c');
select test_helpers.ok(
  (select count(*) from public.trips where id = '10000000-0000-4000-8000-000000000001') = 0
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000001') = 0
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-000000000001') = 0,
  'C cannot read A''s trip, members or segments');

-- Nothing of B's attempts took effect.
reset role;
select test_helpers.ok(
  (select name from public.trips where id = '10000000-0000-4000-8000-000000000001') = 'Warsaw → Bangkok'
    and (select budget_per_person_minor from public.trips where id = '10000000-0000-4000-8000-000000000001') = 3000000
    and (select count(*) from public.trip_members where trip_id = '10000000-0000-4000-8000-000000000001') = 2
    and (select count(*) from public.flight_segments where trip_id = '10000000-0000-4000-8000-000000000001') = 3,
  'the trip is unchanged after B''s write attempts');

select 'friend_invite: all checks passed' as result;
rollback;
