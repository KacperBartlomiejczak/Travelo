-- Trip photos in Storage: bucket settings, path helper and the policies on storage.objects
-- (prompts/trip-photos/plan.md, step 5).
-- Plain SQL (not pgTAP): run with `pnpm test:db`. Everything is rolled back at the end.
-- Needs Supabase's own `storage` schema (a local Supabase, not plain Postgres).
--
-- Rows are written to and read from storage.objects directly, as the signed-in role, with the same statements the
-- Storage server runs for a user (it sets owner and owner_id to the JWT's sub, upserts with ON CONFLICT DO UPDATE and
-- deletes with storage.allow_delete_query on). The live API is probed separately, by hand.
--
-- Fixtures: trips A1 / A2 belong to organizer A (A1 has linked viewer C), trip B1 belongs to stranger B.
-- Folder ids contain hex letters, so an uppercase spelling of the same id differs from the lowercase one.
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
                                        bucket text default 'trip-photos') returns text language sql as $$
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

-- Organizer A, stranger B, linked viewer C.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000b'),
  ('00000000-0000-4000-a000-00000000000c');

-- A's two trips and B's own trip (so a policy that only asks "is the caller an owner of any trip?" is caught),
-- and C linked to A's first trip as a read-only member.
insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency,
                          budget_per_person_minor, budget_updated_at)
values
  ('1a000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-a000-00000000000a', 'Warsaw → Bangkok', 'BKK',
   '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z'),
  ('1a000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-a000-00000000000a', 'Warsaw → Lisbon', 'LIS',
   '2026-12-01', '2026-12-08', 'EUR', 90000, '2026-10-04T12:00:00Z'),
  ('1b000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-a000-00000000000b', 'Krakow → Rome', 'FCO',
   '2026-09-01', '2026-09-07', 'EUR', 80000, '2026-08-04T12:00:00Z');
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
values ('20000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-a000-00000000000c', 'Celina', 'viewer', '{}');

-- A second bucket, to see that the policies of trip-photos reach nothing else.
insert into storage.buckets (id, name) values ('other-bucket', 'other-bucket');

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------
select test_helpers.ok(exists (select 1 from storage.buckets where id = 'trip-photos'), 'the trip-photos bucket exists');
select test_helpers.ok(
  (select name from storage.buckets where id = 'trip-photos') = 'trip-photos',
  'the bucket''s name is trip-photos');
select test_helpers.ok(
  (select public from storage.buckets where id = 'trip-photos') = false,
  'the bucket is private (photos are shown through signed URLs)');
select test_helpers.ok(
  (select file_size_limit from storage.buckets where id = 'trip-photos') = 10485760,
  'the bucket limits a file to 10 MiB (10485760 bytes)');
select test_helpers.ok(
  (select allowed_mime_types from storage.buckets where id = 'trip-photos') = array['image/jpeg'],
  'the bucket accepts image/jpeg only');

-- ---------------------------------------------------------------------------
-- private.trip_id_of_object: the trip folder of an exact photo path, null for anything else (never an error)
-- ---------------------------------------------------------------------------
select test_helpers.ok(
  private.trip_id_of_object('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg')
    = '1a000000-0000-4000-8000-0000000000a1'::uuid,
  'the helper returns the trip id of <trip>/<photo>.jpg');
select test_helpers.ok(
  private.trip_id_of_object('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb.jpg')
    = '1a000000-0000-4000-8000-0000000000a1'::uuid,
  'the helper returns the trip id of <trip>/<photo>_thumb.jpg');

-- Every malformed name gives null. Only lowercase ids are allowed: the app's ids come from randomUUID (lowercase), and
-- a second spelling of the same folder would escape the cleanup that deletes a trip's files by its lowercase prefix.
select test_helpers.ok(private.trip_id_of_object(name) is null, 'the helper returns null for ' || quote_literal(name))
from (values
  (''),
  ('notatrip/x.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1'),
  ('1a000000-0000-4000-8000-0000000000a1/'),
  ('1a000000-0000-4000-8000-0000000000a1/x.png'),
  ('1a000000-0000-4000-8000-0000000000a1/x.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.png'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpeg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb.png'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumbnail.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb_thumb.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001xjpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumbxjpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg/'),
  ('1a000000-0000-4000-8000-0000000000a1/sub/5f000000-0000-4000-8000-000000000001.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/../5f000000-0000-4000-8000-000000000001.jpg'),
  ('/1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'),
  ('x/1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/ 5f000000-0000-4000-8000-000000000001.jpg'),
  ('1A000000-0000-4000-8000-0000000000A1/5f000000-0000-4000-8000-000000000001.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5F000000-0000-4000-8000-000000000001.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_THUMB.jpg'),
  ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.JPG'),
  ('1a00000000004000800000000000a1/5f000000-0000-4000-8000-000000000001.jpg'),
  ('1g000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'),
  (E'1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg\n'),
  (E'1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg\nx'),
  (E'1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001\n.jpg')
) as malformed(name);
select test_helpers.ok(private.trip_id_of_object(null) is null, 'the helper returns null for a null name');

select test_helpers.ok(
  has_function_privilege('authenticated', 'private.trip_id_of_object(text)', 'execute')
    and not has_function_privilege('anon', 'private.trip_id_of_object(text)', 'execute'),
  'only signed-in users may run the helper (not anon)');

-- ---------------------------------------------------------------------------
-- Owner A uploads, reads, replaces, moves and deletes files of their trips
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

-- A photo and its thumbnail in trip A1, a photo in trip A2.
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload a photo into the folder of their trip');
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload a thumbnail into the folder of their trip');
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1a000000-0000-4000-8000-0000000000a2/5f000000-0000-4000-8000-000000000003.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload a photo into the folder of their other trip');

select test_helpers.ok(
  (select array_agg(name order by name collate "C") from storage.objects where bucket_id = 'trip-photos') = array[
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb.jpg',
    '1a000000-0000-4000-8000-0000000000a2/5f000000-0000-4000-8000-000000000003.jpg'],
  'A reads their own files');

-- Uploading the same name again (retry, or upsert: true) replaces the file: ON CONFLICT DO UPDATE needs the
-- insert, select and update policies together.
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
    '00000000-0000-4000-a000-00000000000a', true)) = 1,
  'A can upload the same photo again with upsert (replaces the file)');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 3,
  'the upsert replaced the row, it did not add one');

-- Update in place.
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"size": 1}'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$) = 1,
  'A can update their own file under the same name');

-- Where A may not upload.
select test_helpers.throws(
  test_helpers.upload_sql('1b000000-0000-4000-8000-0000000000b1/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into the folder of B''s trip, although A owns other trips');
select test_helpers.throws(
  test_helpers.upload_sql('1b000000-0000-4000-8000-0000000000b1/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a', true),
  '42501', 'A cannot upsert into the folder of B''s trip');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000ff/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into the folder of a trip that does not exist');

-- Malformed paths, in A's own trip folder.
select test_helpers.throws(
  test_helpers.upload_sql('notatrip/x.jpg', '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload to a path whose first part is not a trip id');
select test_helpers.throws(
  test_helpers.upload_sql('x.jpg', '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload to the root of the bucket');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/x.png', '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a .png (and a name that is not a photo id) into their folder');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009.png',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload <photo id>.png into their folder');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/x.jpg', '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a name that is not a photo id into their folder');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/sub/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into a sub-folder of their trip folder');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009_thumbnail.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a name with another suffix than _thumb');
select test_helpers.throws(
  test_helpers.upload_sql('1A000000-0000-4000-8000-0000000000A1/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload into an uppercase spelling of their trip id (only lowercase ids are allowed)');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5F000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload an uppercase photo id (only lowercase ids are allowed)');
select test_helpers.throws(
  test_helpers.upload_sql(E'1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009.jpg\n',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a name with a trailing newline');

-- Other owner ids and other buckets.
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000b'),
  '42501', 'A cannot upload a file owned by another user (owner_id of B) into their own folder');
select test_helpers.throws(
  $$insert into storage.objects (name, bucket_id) values ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009.jpg', 'trip-photos')$$,
  '42501', 'A cannot upload a file without an owner_id');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a', false, 'other-bucket'),
  '42501', 'the trip-photos policies do not let A upload into another bucket');

-- Moves: a file cannot leave its owner's trips, the bucket, or its owner.
select test_helpers.throws(
  $$update storage.objects set name = '1b000000-0000-4000-8000-0000000000b1/5f000000-0000-4000-8000-000000000001.jpg'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$,
  '42501', 'A cannot move a file into the folder of B''s trip');
select test_helpers.throws(
  $$update storage.objects set name = '1a000000-0000-4000-8000-0000000000a1/x.png'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$,
  '42501', 'A cannot rename a file to a malformed path');
select test_helpers.throws(
  $$update storage.objects set bucket_id = 'other-bucket'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$,
  '42501', 'A cannot move a file out of the bucket');
select test_helpers.throws(
  $$update storage.objects set owner_id = '00000000-0000-4000-a000-00000000000b'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$,
  '42501', 'A cannot hand a file over to B (owner_id)');
select test_helpers.ok(
  (select array_agg(name order by name collate "C") from storage.objects where bucket_id = 'trip-photos') = array[
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb.jpg',
    '1a000000-0000-4000-8000-0000000000a2/5f000000-0000-4000-8000-000000000003.jpg'],
  'after the refused uploads and moves A still has exactly their three files');

-- A deletes one of their files and keeps the rest.
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000002.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload a second photo');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000002.jpg'$$) = 1,
  'A can delete their own file');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 3,
  'A''s other files are still there after deleting one');

-- ---------------------------------------------------------------------------
-- Other buckets are not reachable through the trip-photos policies
-- ---------------------------------------------------------------------------
reset role;
-- An object in another bucket, owned by A, with a valid photo path in A's trip folder.
insert into storage.objects (name, owner, owner_id, bucket_id)
values ('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000005.jpg',
        '00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000a', 'other-bucket');

select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'other-bucket') = 0,
  'A cannot read their own object in another bucket through the trip-photos policies');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"size": 1}' where bucket_id = 'other-bucket'$$) = 0,
  'A cannot update an object in another bucket');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects where bucket_id = 'other-bucket'$$) = 0,
  'A cannot delete an object in another bucket');

-- A statement with no WHERE (and no RETURNING) is not filtered by the select policy, so these test the update policy
-- on its own: its USING must keep the other bucket's object out, and its WITH CHECK must refuse every move.
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"size": 2}'$$) = 3,
  'A''s update with no WHERE changes only their three trip-photos files, not the object in another bucket');
select test_helpers.throws(
  $$update storage.objects set bucket_id = 'other-bucket'$$,
  '42501', 'A cannot move their files out of the bucket (update with no WHERE)');
select test_helpers.throws(
  $$update storage.objects set owner_id = '00000000-0000-4000-a000-00000000000b'$$,
  '42501', 'A cannot hand their files over to B (update with no WHERE)');
select test_helpers.throws(
  $$update storage.objects set name = '1b000000-0000-4000-8000-0000000000b1/5f000000-0000-4000-8000-000000000008.jpg'$$,
  '42501', 'A cannot move their files into the folder of B''s trip (update with no WHERE)');
select test_helpers.throws(
  $$update storage.objects set name = 'x.jpg'$$,
  '42501', 'A cannot rename their files to a malformed path (update with no WHERE)');

select test_helpers.login('00000000-0000-4000-a000-00000000000c');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'other-bucket') = 0,
  'C (linked to the trip in the path) cannot read an object in another bucket');

reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'other-bucket') = 1
    and (select metadata from storage.objects where bucket_id = 'other-bucket') is null,
  'the object in the other bucket is unchanged');

-- ---------------------------------------------------------------------------
-- Stranger B (owner of a different trip) sees and changes nothing of A's
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000b');

select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 0,
  'B cannot read A''s files');
select test_helpers.ok(
  (select count(*) from storage.objects) = 0,
  'B sees no object of any bucket that is not theirs');

-- B is a normal owner of their own trip.
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1b000000-0000-4000-8000-0000000000b1/5f000000-0000-4000-8000-000000000004.jpg',
    '00000000-0000-4000-a000-00000000000b')) = 1,
  'B can upload into the folder of their own trip');
select test_helpers.ok(
  (select array_agg(name) from storage.objects where bucket_id = 'trip-photos') =
    array['1b000000-0000-4000-8000-0000000000b1/5f000000-0000-4000-8000-000000000004.jpg'],
  'B sees their own file, and only that one (not A''s)');

select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000b'),
  '42501', 'B cannot upload into A''s folder, although B owns another trip');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000009.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'B cannot upload into A''s folder by claiming A as the owner');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
                          '00000000-0000-4000-a000-00000000000b', true),
  '42501', 'B cannot overwrite A''s file with an upsert');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
                          '00000000-0000-4000-a000-00000000000a', true),
  '42501', 'B cannot overwrite A''s file with an upsert that claims A as the owner');

-- B moves their own file into A's folder: refused.
select test_helpers.throws(
  $$update storage.objects set name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000004.jpg'
    where bucket_id = 'trip-photos' and name = '1b000000-0000-4000-8000-0000000000b1/5f000000-0000-4000-8000-000000000004.jpg'$$,
  '42501', 'B cannot move their own file into the folder of A''s trip');

-- B updates and deletes: A's files are not visible to these statements, so they change nothing of A's.
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"size": 1}'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$) = 0,
  'B''s update of A''s file by name changes nothing');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$) = 0,
  'B''s delete of A''s file by name changes nothing');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"hacked": true}'$$) = 1,
  'B''s update with no WHERE changes only B''s own file');

-- Counted without RLS (back to the connecting role), so "nothing changed" cannot be a side effect of the policies
-- hiding rows.
reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos' and owner_id = '00000000-0000-4000-a000-00000000000a') = 3
    and not exists (select 1 from storage.objects where owner_id = '00000000-0000-4000-a000-00000000000a' and metadata ? 'hacked')
    and (select metadata from storage.objects where bucket_id = 'other-bucket') is null
    and exists (select 1 from storage.objects where owner_id = '00000000-0000-4000-a000-00000000000b' and metadata ? 'hacked'),
  'B''s updates changed none of A''s files (nor the other bucket''s object), only B''s own');

-- A delete with no WHERE is filtered by the delete policy alone (a WHERE delete is also filtered by the select policy).
select test_helpers.login('00000000-0000-4000-a000-00000000000b');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects$$) = 1,
  'B''s delete with no WHERE removes only B''s own file');

reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 3
    and (select count(*) from storage.objects where bucket_id = 'trip-photos' and owner_id = '00000000-0000-4000-a000-00000000000a') = 3
    and (select count(*) from storage.objects where bucket_id = 'other-bucket') = 1,
  'B''s delete removed none of A''s files (nor the other bucket''s object)');

-- ---------------------------------------------------------------------------
-- Linked viewer C reads the trip's files, never writes
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000c');

select test_helpers.ok(
  (select array_agg(name order by name collate "C") from storage.objects where bucket_id = 'trip-photos') = array[
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb.jpg'],
  'C reads the files of the trip they are linked to, and only that trip''s (not trip A2''s)');

select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-0000000000c1.jpg',
                          '00000000-0000-4000-a000-00000000000c'),
  '42501', 'C cannot upload into the trip they are linked to');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-0000000000c1.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'C cannot upload there by claiming A as the owner');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
                          '00000000-0000-4000-a000-00000000000c', true),
  '42501', 'C cannot overwrite A''s file with an upsert');

select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"hacked": true}'$$) = 0,
  'C''s update with no WHERE changes nothing');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"hacked": true}'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$) = 0,
  'C''s update of a file they can read changes nothing');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-0000000000c2.jpg'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$) = 0,
  'C cannot rename a file they can read');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'$$) = 0,
  'C''s delete of a file they can read changes nothing');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects$$) = 0,
  'C''s delete with no WHERE changes nothing');

reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 3
    and not exists (select 1 from storage.objects where metadata ? 'hacked')
    and exists (select 1 from storage.objects
                where name = '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg'),
  'C changed and removed none of A''s files');

-- ---------------------------------------------------------------------------
-- Requests without a session get nothing
-- ---------------------------------------------------------------------------
select test_helpers.logout();

select test_helpers.ok((select count(*) from storage.objects) = 0, 'anon reads no object');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-0000000000a1.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'anon cannot upload');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"hacked": true}'$$) = 0,
  'anon''s update changes nothing');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects$$) = 0,
  'anon''s delete changes nothing');

reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 3
    and not exists (select 1 from storage.objects where metadata ? 'hacked'),
  'anon changed and removed nothing');

-- ---------------------------------------------------------------------------
-- A's files are unchanged after everything B, C and anon tried
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');

select test_helpers.ok(
  (select array_agg(name order by name collate "C") from storage.objects where bucket_id = 'trip-photos') = array[
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001.jpg',
    '1a000000-0000-4000-8000-0000000000a1/5f000000-0000-4000-8000-000000000001_thumb.jpg',
    '1a000000-0000-4000-8000-0000000000a2/5f000000-0000-4000-8000-000000000003.jpg'],
  'A''s three files are intact at the end');

-- A removes everything they own (what deleting a trip does for its folder). With no WHERE the delete policy alone
-- decides, so it must leave A's object in the other bucket alone.
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects$$) = 3,
  'A can delete all their files, and only those (not the object in another bucket)');

reset role;
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 0
    and (select count(*) from storage.objects where bucket_id = 'other-bucket') = 1,
  'the other bucket''s object survived A''s delete with no WHERE');

select 'trip_photos_storage: all checks passed' as result;
rollback;
