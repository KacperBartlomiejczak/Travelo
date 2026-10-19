-- Profiles (prompts/auth-onboarding/plan.md, step 2): the table, the friend-code trigger, Row Level Security, column
-- grants, and the private `avatars` bucket with its policies on storage.objects.
-- Plain SQL (not pgTAP): run with `pnpm test:db`. Everything is rolled back at the end.
-- Needs Supabase's own `auth` and `storage` schemas (a local Supabase, not plain Postgres).
--
-- Storage rows are written to storage.objects directly, as the signed-in role, with the same statements the Storage
-- server runs for a user (see trip_photos_storage.sql). The live API is probed separately, by hand.
--
-- Fixtures: users A and B (real, non-anonymous) and an anonymous user E. The tests count only their own rows:
-- a real database may hold other profiles and files.
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

-- The statement the Storage server runs for an upload of `object_name` by `uploader` (a plain insert,
-- or the ON CONFLICT DO UPDATE it runs for an upsert).
create function test_helpers.upload_sql(object_name text, uploader uuid, upsert boolean default false,
                                        bucket text default 'avatars') returns text language sql as $$
  select format(
    'insert into storage.objects (name, owner, owner_id, bucket_id, metadata) values (%L, %L, %L, %L, %L) %s',
    object_name, uploader, uploader::text, bucket, '{"mimetype": "image/jpeg"}',
    case when upsert
      then 'on conflict (bucket_id, name collate "C") where archived_at is null do update set metadata = excluded.metadata, owner = excluded.owner, owner_id = excluded.owner_id'
      else ''
    end);
$$;

grant execute on all functions in schema test_helpers to anon, authenticated;

-- The Storage server turns this on in the transaction of every delete (Supabase's protect_objects_delete trigger
-- refuses direct deletes otherwise), so the delete policy is what decides here.
select set_config('storage.allow_delete_query', 'true', true);

-- User A, user B, and anonymous user E.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000b'),
  ('00000000-0000-4000-a000-00000000000e');

-- ---------------------------------------------------------------------------
-- The table: shape, Row Level Security, grants
-- ---------------------------------------------------------------------------
select test_helpers.ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'Row Level Security is enabled on profiles');

select test_helpers.ok(
  (select array_agg(column_name::text order by column_name)
   from information_schema.columns where table_schema = 'public' and table_name = 'profiles')
  = array['avatar_id', 'created_at', 'friend_code', 'id', 'interests', 'updated_at', 'username'],
  'profiles has exactly the columns of ProfileSchema');

select test_helpers.ok(
  not has_table_privilege('anon', 'public.profiles', 'select')
    and not has_table_privilege('anon', 'public.profiles', 'insert')
    and not has_table_privilege('anon', 'public.profiles', 'update')
    and not has_table_privilege('anon', 'public.profiles', 'delete'),
  'anon has no privilege on profiles');
select test_helpers.ok(
  has_table_privilege('authenticated', 'public.profiles', 'select')
    and not has_table_privilege('authenticated', 'public.profiles', 'delete')
    and not has_table_privilege('authenticated', 'public.profiles', 'truncate')
    and not has_table_privilege('authenticated', 'public.profiles', 'references')
    and not has_table_privilege('authenticated', 'public.profiles', 'trigger'),
  'authenticated may select, and may not delete / truncate');
select test_helpers.ok(
  has_column_privilege('authenticated', 'public.profiles', 'username', 'insert')
    and has_column_privilege('authenticated', 'public.profiles', 'id', 'insert')
    and has_column_privilege('authenticated', 'public.profiles', 'interests', 'insert')
    and has_column_privilege('authenticated', 'public.profiles', 'avatar_id', 'insert')
    and not has_column_privilege('authenticated', 'public.profiles', 'friend_code', 'insert')
    and not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'insert'),
  'authenticated may insert id, username, interests and avatar_id only');
select test_helpers.ok(
  has_column_privilege('authenticated', 'public.profiles', 'username', 'update')
    and has_column_privilege('authenticated', 'public.profiles', 'interests', 'update')
    and has_column_privilege('authenticated', 'public.profiles', 'avatar_id', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'id', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'friend_code', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'update'),
  'authenticated may update username, interests and avatar_id only');
select test_helpers.ok(
  not has_function_privilege('authenticated', 'private.set_friend_code()', 'execute')
    and not has_function_privilege('anon', 'private.set_friend_code()', 'execute'),
  'the friend-code trigger function cannot be called by clients');

-- ---------------------------------------------------------------------------
-- The friend-code trigger and the update trigger (as the connecting superuser; RLS does not apply)
-- ---------------------------------------------------------------------------
-- A client-written code is ignored: the trigger always generates its own.
insert into public.profiles (id, username, friend_code, interests)
values ('00000000-0000-4000-a000-00000000000e', 'nobody', 'AAAAAA', '{museums}');
select test_helpers.ok(
  (select friend_code from public.profiles where id = '00000000-0000-4000-a000-00000000000e') <> 'AAAAAA',
  'a friend_code written by the insert is replaced by a generated one');
delete from public.profiles where id = '00000000-0000-4000-a000-00000000000e';

-- 200 profiles give 200 distinct, valid codes.
create temp table bulk_users as
  select gen_random_uuid() as id, 'bulk' || lpad(n::text, 4, '0') as username from generate_series(1, 200) as n;
insert into auth.users (id) select id from bulk_users;
insert into public.profiles (id, username, interests) select id, username, '{beaches}' from bulk_users;
select test_helpers.ok(
  (select count(distinct friend_code) from public.profiles where id in (select id from bulk_users)) = 200,
  '200 profiles get 200 distinct friend codes');
select test_helpers.ok(
  (select count(*) from public.profiles where id in (select id from bulk_users)
     and friend_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$') = 200,
  'every generated code is 6 characters from the alphabet without 0 O 1 I L');
select test_helpers.ok(
  (select count(*) from public.profiles where id in (select id from bulk_users)
     and friend_code ~ '[01OIL]') = 0,
  'no generated code contains a look-alike character');

-- The update trigger keeps id, friend_code and created_at, and moves updated_at (also inside one transaction).
create temp table before_update as
  select id, friend_code, created_at, updated_at from public.profiles where username = 'bulk0001';
update public.profiles
set id = '00000000-0000-4000-a000-00000000000f', friend_code = 'AAAAAA',
    created_at = '2000-01-01T00:00:00Z', updated_at = '2000-01-01T00:00:00Z', avatar_id = gen_random_uuid()
where username = 'bulk0001';
select test_helpers.ok(
  (select p.id = b.id and p.friend_code = b.friend_code and p.created_at = b.created_at
     from public.profiles p, before_update b where p.username = 'bulk0001'),
  'the update trigger keeps id, friend_code and created_at, even for a privileged writer');
select test_helpers.ok(
  (select p.updated_at > b.updated_at and p.updated_at > p.created_at
     from public.profiles p, before_update b where p.username = 'bulk0001'),
  'the update trigger moves updated_at forward, even inside one transaction');

-- ---------------------------------------------------------------------------
-- User A creates their own profile
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

select test_helpers.ok(
  test_helpers.changes($$insert into public.profiles (id, username, interests)
    values ('00000000-0000-4000-a000-00000000000a', 'kacper', '{museums,street_food}')$$) = 1,
  'A can create their own profile');
select test_helpers.ok(
  (select count(*) from public.profiles) = 1,
  'A sees exactly one profile: their own');
select test_helpers.ok(
  (select friend_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'
          and username = 'kacper' and interests = array['museums', 'street_food']
          and avatar_id is null and created_at is not null and updated_at is not null
   from public.profiles where id = '00000000-0000-4000-a000-00000000000a'),
  'A''s profile has a generated friend code, their nick and interests, no avatar, and both timestamps');

select test_helpers.throws(
  $$insert into public.profiles (id, username, interests)
    values ('00000000-0000-4000-a000-00000000000a', 'kacper2', '{museums}')$$,
  '23505', 'A cannot create a second profile (one per user)');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests)
    values ('00000000-0000-4000-a000-00000000000b', 'bee', '{museums}')$$,
  '42501', 'A cannot create a profile for B''s id');

-- ---------------------------------------------------------------------------
-- User B: refused inserts (one fault each), then a valid one
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000b');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests, friend_code)
    values ('00000000-0000-4000-a000-00000000000b', 'bee', '{museums}', 'ABCDEF')$$,
  '42501', 'a client cannot choose the friend code (column privilege)');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests, created_at)
    values ('00000000-0000-4000-a000-00000000000b', 'bee', '{museums}', '2000-01-01T00:00:00Z')$$,
  '42501', 'a client cannot choose created_at');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests, updated_at)
    values ('00000000-0000-4000-a000-00000000000b', 'bee', '{museums}', '2000-01-01T00:00:00Z')$$,
  '42501', 'a client cannot choose updated_at');

select test_helpers.throws(
  $$insert into public.profiles (id, username, interests)
    values ('00000000-0000-4000-a000-00000000000b', 'kacper', '{museums}')$$,
  '23505', 'a nick that another user already has is refused with a unique violation');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', 'Kacper', '{museums}')$$,
  '23514', 'an uppercase nick is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', 'ab', '{museums}')$$,
  '23514', 'a 2-character nick is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', 'kac..per', '{museums}')$$,
  '23514', 'a nick with two dots in a row is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', 'kacper.', '{museums}')$$,
  '23514', 'a nick ending with a dot is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', '1abc', '{museums}')$$,
  '23514', 'a nick starting with a digit is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', 'a2345678901234567890x', '{museums}')$$,
  '23514', 'a 21-character nick is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', E'abc\n', '{museums}')$$,
  '23514', 'a nick with a trailing newline is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', 'bee', '{}')$$,
  '23514', 'empty interests are refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-00000000000b', 'bee', '{museums,skydiving}')$$,
  '23514', 'an unknown interest tag is refused');
select test_helpers.throws(
  $$insert into public.profiles (id, username) values ('00000000-0000-4000-a000-00000000000b', 'bee')$$,
  '23502', 'interests are required');

select test_helpers.ok(
  test_helpers.changes($$insert into public.profiles (id, username, interests, avatar_id)
    values ('00000000-0000-4000-a000-00000000000b', 'bee.keeper_1', '{beaches}', '5f000000-0000-4000-8000-0000000000b1')$$) = 1,
  'B can create their own profile, with an avatar id');

-- ---------------------------------------------------------------------------
-- Anonymous users and requests without a session cannot create a profile
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000e', true);
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests)
    values ('00000000-0000-4000-a000-00000000000e', 'nobody', '{museums}')$$,
  '42501', 'an anonymous user cannot create a profile (is_anonymous claim)');
select test_helpers.ok((select count(*) from public.profiles) = 0, 'an anonymous user sees no profile');

select test_helpers.logout();
select test_helpers.throws(
  $$insert into public.profiles (id, username, interests)
    values ('00000000-0000-4000-a000-00000000000e', 'nobody', '{museums}')$$,
  '42501', 'the anon role cannot create a profile');
select test_helpers.throws($$select * from public.profiles$$, '42501', 'the anon role cannot read profiles');
select test_helpers.throws($$update public.profiles set username = 'x1x'$$, '42501', 'the anon role cannot update profiles');
select test_helpers.throws($$delete from public.profiles$$, '42501', 'the anon role cannot delete profiles');

-- ---------------------------------------------------------------------------
-- A and B cannot read or change each other's profile
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

select test_helpers.ok(
  (select count(*) from public.profiles where id = '00000000-0000-4000-a000-00000000000b') = 0,
  'A cannot read B''s profile by id');
select test_helpers.ok(
  (select count(*) from public.profiles where username = 'bee.keeper_1') = 0,
  'A cannot look B up by nick');
select test_helpers.ok(
  (select count(*) from public.profiles) = 1,
  'A sees only their own row, whatever the filter');
select test_helpers.ok(
  test_helpers.changes($$update public.profiles set username = 'hacked' where id = '00000000-0000-4000-a000-00000000000b'$$) = 0,
  'A cannot update B''s profile');
select test_helpers.ok(
  test_helpers.changes($$update public.profiles set interests = '{cycling}' where username = 'bee.keeper_1'$$) = 0,
  'A cannot update B''s profile by nick');
select test_helpers.ok(
  test_helpers.changes($$update public.profiles set avatar_id = null$$) = 1,
  'A''s update with no WHERE changes only A''s own row');

-- A's own updates
select test_helpers.ok(
  test_helpers.changes($$update public.profiles
    set username = 'kacper_b', interests = '{cycling,museums}', avatar_id = '5f000000-0000-4000-8000-0000000000a1'
    where id = '00000000-0000-4000-a000-00000000000a'$$) = 1,
  'A can update their own nick, interests and avatar');
select test_helpers.ok(
  (select username = 'kacper_b' and interests = array['cycling', 'museums']
          and avatar_id = '5f000000-0000-4000-8000-0000000000a1' and updated_at > created_at
   from public.profiles where id = '00000000-0000-4000-a000-00000000000a'),
  'A''s changes are stored, and updated_at is later than created_at');

-- Fields A may not change (column privileges), and bad values
select test_helpers.throws(
  $$update public.profiles set friend_code = 'ABCDEF' where id = '00000000-0000-4000-a000-00000000000a'$$,
  '42501', 'A cannot change their friend code');
select test_helpers.throws(
  $$update public.profiles set id = '00000000-0000-4000-a000-00000000000b' where id = '00000000-0000-4000-a000-00000000000a'$$,
  '42501', 'A cannot change their id (to take B''s, or at all)');
select test_helpers.throws(
  $$update public.profiles set created_at = '2000-01-01T00:00:00Z'$$,
  '42501', 'A cannot change created_at');
select test_helpers.throws(
  $$update public.profiles set updated_at = '2000-01-01T00:00:00Z'$$,
  '42501', 'A cannot set updated_at');
select test_helpers.throws(
  $$update public.profiles set username = 'bee.keeper_1'$$,
  '23505', 'A cannot take B''s nick');
select test_helpers.throws(
  $$update public.profiles set username = 'Kacper'$$, '23514', 'A cannot change their nick to a bad one');
select test_helpers.throws(
  $$update public.profiles set interests = '{}'$$, '23514', 'A cannot empty their interests');
select test_helpers.throws(
  $$update public.profiles set interests = '{skydiving}'$$, '23514', 'A cannot set an unknown interest');
select test_helpers.throws(
  $$delete from public.profiles where id = '00000000-0000-4000-a000-00000000000a'$$,
  '42501', 'A cannot delete their own profile (no delete privilege)');

reset role;
select test_helpers.ok(
  (select username from public.profiles where id = '00000000-0000-4000-a000-00000000000b') = 'bee.keeper_1'
    and (select interests from public.profiles where id = '00000000-0000-4000-a000-00000000000b') = array['beaches'],
  'B''s profile is unchanged after everything A tried');
select test_helpers.ok(
  (select friend_code from public.profiles where id = '00000000-0000-4000-a000-00000000000a') ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$',
  'A''s friend code is still a valid generated code');

-- Deleting the auth user removes the profile (on delete cascade), done by the system, not by a client.
delete from auth.users where id = '00000000-0000-4000-a000-00000000000e';
insert into auth.users (id) values ('00000000-0000-4000-a000-0000000000e1');
insert into public.profiles (id, username, interests) values ('00000000-0000-4000-a000-0000000000e1', 'gone', '{museums}');
delete from auth.users where id = '00000000-0000-4000-a000-0000000000e1';
select test_helpers.ok(
  (select count(*) from public.profiles where id = '00000000-0000-4000-a000-0000000000e1') = 0,
  'deleting an auth user deletes their profile');

-- ---------------------------------------------------------------------------
-- Storage: the avatars bucket
-- ---------------------------------------------------------------------------
select test_helpers.ok(exists (select 1 from storage.buckets where id = 'avatars'), 'the avatars bucket exists');
select test_helpers.ok(
  (select public from storage.buckets where id = 'avatars') = false,
  'the bucket is private (avatars are shown through signed URLs)');
select test_helpers.ok(
  (select file_size_limit from storage.buckets where id = 'avatars') = 2097152,
  'the bucket limits a file to 2 MiB (2097152 bytes)');
select test_helpers.ok(
  (select allowed_mime_types from storage.buckets where id = 'avatars') = array['image/jpeg'],
  'the bucket accepts image/jpeg only');

-- private.user_id_of_avatar: the user folder of an exact avatar path, null for anything else (never an error)
select test_helpers.ok(
  private.user_id_of_avatar('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg')
    = '00000000-0000-4000-a000-00000000000a'::uuid,
  'the helper returns the user id of <user>/<avatar>.jpg');
select test_helpers.ok(private.user_id_of_avatar(name) is null, 'the helper returns null for ' || quote_literal(name))
from (values
  (''),
  ('x.jpg'),
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000a/'),
  ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.png'),
  ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpeg'),
  ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1_thumb.jpg'),
  ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg.jpg'),
  ('00000000-0000-4000-a000-00000000000a/x.jpg'),
  ('00000000-0000-4000-a000-00000000000a/sub/5f000000-0000-4000-8000-0000000000a1.jpg'),
  ('00000000-0000-4000-a000-00000000000a/../5f000000-0000-4000-8000-0000000000a1.jpg'),
  ('/00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'),
  ('x/00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'),
  ('00000000-0000-4000-A000-00000000000A/5f000000-0000-4000-8000-0000000000a1.jpg'),
  ('00000000-0000-4000-a000-00000000000a/5F000000-0000-4000-8000-0000000000a1.jpg'),
  ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.JPG'),
  ('0000000000004000a00000000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'),
  ('0000000g-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'),
  (E'00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg\n'),
  (E'00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg\nx')
) as malformed(name);
select test_helpers.ok(private.user_id_of_avatar(null) is null, 'the helper returns null for a null name');
select test_helpers.ok(
  has_function_privilege('authenticated', 'private.user_id_of_avatar(text)', 'execute')
    and not has_function_privilege('anon', 'private.user_id_of_avatar(text)', 'execute'),
  'only signed-in users may run the helper (not anon)');

-- A second bucket, to see that the avatars policies reach nothing else.
insert into storage.buckets (id, name) values ('other-bucket', 'other-bucket');

-- A uploads, reads, replaces and deletes in their own folder
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload an avatar into their own folder');
select test_helpers.ok(
  (select array_agg(name) from storage.objects where bucket_id = 'avatars')
    = array['00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'],
  'A reads their own avatar');
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg',
    '00000000-0000-4000-a000-00000000000a', true)) = 1,
  'A can upload the same avatar again with upsert (replaces the file)');
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a2.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload a second avatar (a replaced photo has a new id)');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"size": 1}'
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'$$) = 1,
  'A can update their own avatar under the same name');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a2.jpg'$$) = 1,
  'A can delete their own avatar');

-- Where A may not upload
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000a3.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into B''s folder');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000a3.jpg',
                          '00000000-0000-4000-a000-00000000000a', true),
  '42501', 'A cannot upsert into B''s folder');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-0000000000a3.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into a folder that is not a user (a trip-shaped path)');
select test_helpers.throws(
  test_helpers.upload_sql('x.jpg', '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload to the root of the bucket');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a3.png',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a .png into their folder');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a3_thumb.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a thumbnail (avatars have none)');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/x.jpg', '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a name that is not an avatar id');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/sub/5f000000-0000-4000-8000-0000000000a3.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into a sub-folder of their folder');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-A000-00000000000A/5f000000-0000-4000-8000-0000000000a3.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into an uppercase spelling of their id');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a3.jpg',
                          '00000000-0000-4000-a000-00000000000b'),
  '42501', 'A cannot upload a file owned by B into their own folder');
select test_helpers.throws(
  $$insert into storage.objects (name, bucket_id) values ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a3.jpg', 'avatars')$$,
  '42501', 'A cannot upload a file without an owner_id');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a3.jpg',
                          '00000000-0000-4000-a000-00000000000a', false, 'other-bucket'),
  '42501', 'the avatars policies do not let A upload into another bucket');

-- Moves
select test_helpers.throws(
  $$update storage.objects set name = '00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000a1.jpg'
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'$$,
  '42501', 'A cannot move an avatar into B''s folder');
select test_helpers.throws(
  $$update storage.objects set name = '00000000-0000-4000-a000-00000000000a/x.png'
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'$$,
  '42501', 'A cannot rename an avatar to a malformed path');
select test_helpers.throws(
  $$update storage.objects set bucket_id = 'other-bucket'
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'$$,
  '42501', 'A cannot move an avatar out of the bucket');
select test_helpers.throws(
  $$update storage.objects set owner_id = '00000000-0000-4000-a000-00000000000b'
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'$$,
  '42501', 'A cannot hand an avatar over to B (owner_id)');

-- B uploads their own; A sees and changes nothing of it
select test_helpers.login('00000000-0000-4000-a000-00000000000b');
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000b1.jpg',
    '00000000-0000-4000-a000-00000000000b')) = 1,
  'B can upload an avatar into their own folder');
select test_helpers.ok(
  (select array_agg(name) from storage.objects where bucket_id = 'avatars')
    = array['00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000b1.jpg'],
  'B sees their own avatar, and only that one (not A''s)');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg',
                          '00000000-0000-4000-a000-00000000000b', true),
  '42501', 'B cannot overwrite A''s avatar with an upsert');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg',
                          '00000000-0000-4000-a000-00000000000a', true),
  '42501', 'B cannot overwrite A''s avatar with an upsert that claims A as the owner');
select test_helpers.throws(
  $$update storage.objects set name = '00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000b1.jpg'
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000b1.jpg'$$,
  '42501', 'B cannot move their own avatar into A''s folder');

select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  (select array_agg(name) from storage.objects where bucket_id = 'avatars')
    = array['00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a1.jpg'],
  'A cannot read B''s avatar');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"hacked": true}'
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000b1.jpg'$$) = 0,
  'A''s update of B''s avatar by name changes nothing');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects
    where bucket_id = 'avatars' and name = '00000000-0000-4000-a000-00000000000b/5f000000-0000-4000-8000-0000000000b1.jpg'$$) = 0,
  'A''s delete of B''s avatar by name changes nothing');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"hacked": true}'$$) = 1,
  'A''s update with no WHERE changes only A''s own avatar');

reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'avatars'
     and owner_id in ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000b')) = 2
    and not exists (select 1 from storage.objects where owner_id = '00000000-0000-4000-a000-00000000000b' and metadata ? 'hacked'),
  'A changed and removed none of B''s avatars');

-- Other buckets are not reachable through the avatars policies.
insert into storage.objects (name, owner, owner_id, bucket_id)
values ('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a5.jpg',
        '00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000a', 'other-bucket');
select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'other-bucket') = 0,
  'A cannot read their own object in another bucket through the avatars policies');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects where bucket_id = 'other-bucket'$$) = 0,
  'A cannot delete an object in another bucket');

-- Requests without a session get nothing
select test_helpers.logout();
select test_helpers.ok((select count(*) from storage.objects) = 0, 'anon reads no object');
select test_helpers.throws(
  test_helpers.upload_sql('00000000-0000-4000-a000-00000000000a/5f000000-0000-4000-8000-0000000000a9.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'anon cannot upload');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects$$) = 0, 'anon''s delete changes nothing');

-- A deletes everything they can: a delete with no WHERE is decided by the delete policy alone, which must leave
-- B's avatar and A's object in the other bucket alone.
select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects$$) = 1,
  'A''s delete with no WHERE removes only A''s own avatar');
reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'avatars'
     and owner_id = '00000000-0000-4000-a000-00000000000b') = 1
    and (select count(*) from storage.objects where bucket_id = 'other-bucket') = 1,
  'B''s avatar and the object in the other bucket survived A''s delete with no WHERE');

select 'profiles: all checks passed' as result;
rollback;
