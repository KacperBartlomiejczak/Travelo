-- ai_usage + consume_ai_quota (places-legal-navbar plan, step C3, D17). Run with `pnpm test:db`; rolled back at the end.
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

insert into auth.users (id) values
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000b');

select test_helpers.ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_usage'::regclass),
  'Row Level Security is enabled on ai_usage');
select test_helpers.ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_usage'),
  'ai_usage has no client policies');

-- Five calls count down to 0, the sixth is refused; another user is independent.
select test_helpers.ok(
  (select array_agg(public.consume_ai_quota('00000000-0000-4000-a000-00000000000a', 5) order by n)
   from generate_series(1, 6) as n) = array[4, 3, 2, 1, 0, null]::int[],
  'five calls give 4,3,2,1,0 and the sixth gives null');
select test_helpers.ok(
  (select count from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000a') = 5,
  'a refused call does not raise the count');
select test_helpers.ok(
  public.consume_ai_quota('00000000-0000-4000-a000-00000000000b', 5) = 4,
  'another user has their own quota');
select test_helpers.ok(
  (select day from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000b') = (now() at time zone 'utc')::date,
  'the day is the UTC date');

-- Clients: no table access, no function access.
select test_helpers.ok(
  not has_table_privilege('authenticated', 'public.ai_usage', 'select')
    and not has_table_privilege('authenticated', 'public.ai_usage', 'insert')
    and not has_table_privilege('anon', 'public.ai_usage', 'select'),
  'clients have no privilege on ai_usage');
select test_helpers.ok(
  not has_function_privilege('authenticated', 'public.consume_ai_quota(uuid, int)', 'execute')
    and not has_function_privilege('anon', 'public.consume_ai_quota(uuid, int)', 'execute')
    and has_function_privilege('service_role', 'public.consume_ai_quota(uuid, int)', 'execute'),
  'only service_role executes consume_ai_quota');

set local role authenticated;
select test_helpers.throws('select * from public.ai_usage', '42501', 'authenticated cannot select ai_usage');
select test_helpers.throws(
  $q$insert into public.ai_usage (user_id, day, count) values ('00000000-0000-4000-a000-00000000000a', current_date, 0)$q$,
  '42501', 'authenticated cannot insert into ai_usage');
select test_helpers.throws(
  $q$select public.consume_ai_quota('00000000-0000-4000-a000-00000000000a', 5)$q$,
  '42501', 'authenticated cannot execute consume_ai_quota');
reset role;

-- Deleting the auth user removes the usage rows.
delete from auth.users where id = '00000000-0000-4000-a000-00000000000a';
select test_helpers.ok(
  (select count(*) from public.ai_usage where user_id = '00000000-0000-4000-a000-00000000000a') = 0,
  'deleting the user cascades to ai_usage');

rollback;
