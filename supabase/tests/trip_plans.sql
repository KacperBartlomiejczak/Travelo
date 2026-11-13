-- trip_plans RLS + per-kind AI quota (ai-trip-plan plan, step 3; D3, D8, D9, D14, D15). Run with `pnpm test:db`; rolled back at the end.
begin;

create schema test_helpers;
grant usage on schema test_helpers to anon, authenticated;

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

-- Owner A, stranger B, linked viewer C.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000b'),
  ('00000000-0000-4000-a000-00000000000c');

insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency,
                          daily_budget_minor, budget_updated_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-a000-00000000000a', 'Warsaw → Bangkok', 'BKK',
   '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-a000-00000000000b', 'Krakow → Rome', 'FCO',
   '2026-09-01', '2026-09-07', 'EUR', 80000, '2026-08-04T12:00:00Z');
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests, daily_budget_minor)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-a000-00000000000c', 'Celina', 'viewer', '{}', 100000);

-- Fixtures: the Edge Function writes with the service role (here: the connecting role).
insert into public.trip_plans (trip_id, days, model) values
  ('10000000-0000-4000-8000-000000000001', '[]'::jsonb, 'gemini-test'),
  ('10000000-0000-4000-8000-000000000003', '[]'::jsonb, 'gemini-test');

select test_helpers.ok(
  (select relrowsecurity from pg_class where oid = 'public.trip_plans'::regclass),
  'Row Level Security is enabled on trip_plans');

-- Owner and linked member read; the stranger sees nothing of A's plan.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select test_helpers.ok((select count(*) from public.trip_plans) = 1
  and exists (select 1 from public.trip_plans where trip_id = '10000000-0000-4000-8000-000000000001'),
  'owner reads only their own trip plan');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select test_helpers.ok((select count(*) from public.trip_plans) = 1
  and exists (select 1 from public.trip_plans where trip_id = '10000000-0000-4000-8000-000000000001'),
  'linked member reads the plan of their trip');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select test_helpers.ok(not exists (select 1 from public.trip_plans where trip_id = '10000000-0000-4000-8000-000000000001'),
  'a stranger does not read the plan');

-- Nobody writes through the Data API, not even the owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select test_helpers.throws(
  $q$insert into public.trip_plans (trip_id, days, model) values ('10000000-0000-4000-8000-000000000001', '[]', 'x')$q$,
  '42501', 'authenticated cannot insert a plan');
select test_helpers.throws(
  $q$update public.trip_plans set model = 'x'$q$, '42501', 'authenticated cannot update a plan');
select test_helpers.throws(
  $q$delete from public.trip_plans$q$, '42501', 'authenticated cannot delete a plan');
reset role;

set local role anon;
select test_helpers.throws('select * from public.trip_plans', '42501', 'anon cannot read plans');
reset role;

-- Deleting the trip deletes its plan.
delete from public.trips where id = '10000000-0000-4000-8000-000000000003';
select test_helpers.ok(not exists (select 1 from public.trip_plans where trip_id = '10000000-0000-4000-8000-000000000003'),
  'deleting a trip cascades to its plan');

-- Quota per kind: counters are independent; the 2-argument function counts kind places.
select test_helpers.ok(
  (select array_agg(public.consume_ai_quota('00000000-0000-4000-a000-00000000000a', 3, 'trip_plan') order by n)
   from generate_series(1, 4) as n) = array[2, 1, 0, null]::int[],
  'trip_plan limit 3 gives 2,1,0 and the 4th gives null');
select test_helpers.ok(public.consume_ai_quota('00000000-0000-4000-a000-00000000000a', 5) = 4,
  'the 2-argument function still counts places, independent of trip_plan');
select test_helpers.ok(
  (select count from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000a' and kind = 'places') = 1
  and (select count from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000a' and kind = 'trip_plan') = 3,
  'each kind has its own row');

-- Refund: decrements that kind only, never below 0.
select public.refund_ai_quota('00000000-0000-4000-a000-00000000000a', 'trip_plan');
select test_helpers.ok(public.consume_ai_quota('00000000-0000-4000-a000-00000000000a', 3, 'trip_plan') = 0,
  'after a refund one more plan fits');
select test_helpers.ok(
  (select count from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000a' and kind = 'places') = 1,
  'refund does not touch the other kind');
select public.refund_ai_quota('00000000-0000-4000-a000-00000000000b', 'trip_plan');
select test_helpers.ok(
  not exists (select 1 from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000b' and count < 0),
  'refund with no usage never goes below 0');
select public.refund_ai_quota('00000000-0000-4000-a000-00000000000a', 'places');
select public.refund_ai_quota('00000000-0000-4000-a000-00000000000a', 'places');
select test_helpers.ok(
  (select count from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000a' and kind = 'places') = 0,
  'refund stops at 0');
select test_helpers.throws(
  $q$select public.consume_ai_quota('00000000-0000-4000-a000-00000000000a', 3, 'bogus')$q$, '23514', 'unknown kind is rejected');

-- Only the service role executes the functions.
select test_helpers.ok(
  not has_function_privilege('authenticated', 'public.consume_ai_quota(uuid, int, text)', 'execute')
    and not has_function_privilege('anon', 'public.consume_ai_quota(uuid, int, text)', 'execute')
    and has_function_privilege('service_role', 'public.consume_ai_quota(uuid, int, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.refund_ai_quota(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.refund_ai_quota(uuid, text)', 'execute')
    and has_function_privilege('service_role', 'public.refund_ai_quota(uuid, text)', 'execute'),
  'only service_role executes the new quota functions');
set local role authenticated;
select test_helpers.throws(
  $q$select public.consume_ai_quota('00000000-0000-4000-a000-00000000000a', 3, 'trip_plan')$q$,
  '42501', 'authenticated cannot execute consume_ai_quota(uuid, int, text)');
select test_helpers.throws(
  $q$select public.refund_ai_quota('00000000-0000-4000-a000-00000000000a', 'trip_plan')$q$,
  '42501', 'authenticated cannot execute refund_ai_quota');
reset role;

rollback;
