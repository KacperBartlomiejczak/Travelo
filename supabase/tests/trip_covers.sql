-- Trip covers: the cover column is required and has one of two shapes, existing covers are rewritten by the
-- migration, and the Storage rules of trip-photos already cover a gallery cover's files
-- (prompts/trip-covers/plan.md, step 4).
-- Plain SQL (not pgTAP): run with `pnpm test:db`. Everything is rolled back at the end.
-- Needs Supabase's own `storage` schema (a local Supabase, not plain Postgres) and psql (for \ir).
--
-- A cover is `preset:<id>` (a photo bundled in the app, nothing in Storage) or `photo:<lowercase uuid>`
-- (a gallery photo at <tripId>/<uuid>.jpg and <tripId>/<uuid>_thumb.jpg, the same path shapes as trip photos).
--
-- Fixtures: trip A1 belongs to organizer A (linked viewer C), trip B1 belongs to stranger B.
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

-- The statement the Storage server runs for an upload of `object_name` by `uploader`.
create function test_helpers.upload_sql(object_name text, uploader uuid) returns text language sql as $$
  select format(
    'insert into storage.objects (name, owner, owner_id, bucket_id, metadata) values (%L, %L, %L, %L, %L)',
    object_name, uploader, uploader::text, 'trip-photos', '{"mimetype": "image/jpeg"}');
$$;

-- A trip with a valid cover and only the columns that have no default.
create function test_helpers.insert_trip(trip_id uuid, owner uuid, cover text) returns void language plpgsql as $$
begin
  insert into public.trips (id, owner_id, name, cover_image_uri, destination, start_date, end_date, base_currency,
                            budget_per_person_minor, budget_updated_at)
  values (trip_id, owner, 'Warsaw → Bangkok', cover, 'BKK', '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z');
end $$;

grant execute on all functions in schema test_helpers to anon, authenticated;

-- The Storage server turns this on in the transaction of every delete.
select set_config('storage.allow_delete_query', 'true', true);

-- Organizer A, stranger B, linked viewer C.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-00000000000a'),
  ('00000000-0000-4000-a000-00000000000b'),
  ('00000000-0000-4000-a000-00000000000c');

-- ---------------------------------------------------------------------------
-- The column: required, with the default preset
-- ---------------------------------------------------------------------------
select test_helpers.ok(
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'trips' and column_name = 'cover_image_uri') = 'NO',
  'the cover column is not null');
select test_helpers.ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'trips' and column_name = 'cover_image_uri') like '%preset:auckland%',
  'the cover column defaults to the default preset');

-- A row inserted without the column gets the default preset.
insert into public.trips (id, owner_id, name, destination, start_date, end_date, base_currency,
                          budget_per_person_minor, budget_updated_at)
values ('1a000000-0000-4000-8000-0000000000d0', '00000000-0000-4000-a000-00000000000a', 'No cover given', 'BKK',
        '2026-11-03', '2026-11-15', 'THB', 3000000, '2026-10-04T12:00:00Z');
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '1a000000-0000-4000-8000-0000000000d0') = 'preset:auckland',
  'an insert without a cover gets preset:auckland');

-- Every preset and a lowercase gallery id are accepted.
select test_helpers.insert_trip(('1a000000-0000-4000-8000-0000000000d' || n)::uuid, '00000000-0000-4000-a000-00000000000a', 'preset:' || id)
from (values (1, 'auckland'), (2, 'bali'), (3, 'beijing'), (4, 'jakarta'), (5, 'majorka')) as presets(n, id);
select test_helpers.ok(
  (select count(*) from public.trips where id::text like '1a000000-0000-4000-8000-0000000000d_' and cover_image_uri like 'preset:%') = 6,
  'all five presets are accepted (and the default one)');
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000d6', '00000000-0000-4000-a000-00000000000a',
                                'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c');
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '1a000000-0000-4000-8000-0000000000d6') = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c',
  'a lowercase gallery cover is accepted');

-- Anything else is rejected, on insert and on update (23514 = check violation).
select test_helpers.throws(
  format('select test_helpers.insert_trip(%L, %L, %L)', '1a000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-a000-00000000000a', bad),
  '23514', 'insert rejects the cover ' || quote_literal(bad))
from (values
  (''),
  ('preset:'),
  ('preset:paris'),
  ('preset:Bali'),
  ('Preset:bali'),
  ('preset:bali '),
  (' preset:bali'),
  (E'preset:bali\n'),
  ('preset:bali|preset:bali'),
  ('preset:auckland/../x'),
  ('photo:'),
  ('photo:5b1f0f6a'),
  ('photo:5B1F0F6A-2C7D-4A8E-9B3C-1D2E3F4A5B6C'),
  ('photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6g'),
  ('photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c/../x'),
  (E'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c\n'),
  ('photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg'),
  ('xphoto:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c'),
  ('file:///cache/cover.jpg'),
  ('content://media/external/images/1'),
  ('https://example.com/cover.jpg')
) as invalid(bad);
select test_helpers.throws(
  format('select test_helpers.insert_trip(%L, %L, null)', '1a000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-a000-00000000000a'),
  '23502', 'insert rejects a null cover (not null violation)');

select test_helpers.throws(
  $$update public.trips set cover_image_uri = 'file:///cache/cover.jpg' where id = '1a000000-0000-4000-8000-0000000000d1'$$,
  '23514', 'update rejects a device URI as the cover');
select test_helpers.throws(
  $$update public.trips set cover_image_uri = 'preset:paris' where id = '1a000000-0000-4000-8000-0000000000d1'$$,
  '23514', 'update rejects an unknown preset');
select test_helpers.throws(
  $$update public.trips set cover_image_uri = null where id = '1a000000-0000-4000-8000-0000000000d1'$$,
  '23502', 'update rejects removing the cover (null)');
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '1a000000-0000-4000-8000-0000000000d1') = 'preset:auckland',
  'the refused updates left the cover as it was');

-- create_trip passes the cover through: it needs one (the app always sends it), and it is checked like any insert.
-- An explicit null does not fall back to the column default (jsonb_populate_record sets the field to null).
create function test_helpers.create_with_cover(trip_id uuid, cover jsonb) returns void language plpgsql as $$
begin
  perform public.create_trip(
    jsonb_build_object('id', trip_id, 'name', 'Warsaw → Bangkok', 'cover_image_uri', cover, 'destination', 'BKK',
      'start_date', '2026-11-03', 'end_date', '2026-11-15', 'base_currency', 'THB', 'budget_per_person_minor', 3000000,
      'budget_updated_at', '2026-10-04T12:00:00Z', 'created_at', '2026-10-04T12:00:00Z'),
    '[]', '[]');
end $$;
grant execute on function test_helpers.create_with_cover(uuid, jsonb) to authenticated;

select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.create_with_cover('1a000000-0000-4000-8000-0000000000c1', '"preset:bali"');
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '1a000000-0000-4000-8000-0000000000c1') = 'preset:bali',
  'create_trip stores the cover it is given');
select test_helpers.create_with_cover('1a000000-0000-4000-8000-0000000000c1', '"preset:jakarta"');
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '1a000000-0000-4000-8000-0000000000c1') = 'preset:bali',
  'create_trip is still idempotent: sending the same trip again changes nothing');
select test_helpers.throws(
  $$select test_helpers.create_with_cover('1a000000-0000-4000-8000-0000000000c2', 'null')$$,
  '23502', 'create_trip rejects a trip with a null cover');
select test_helpers.throws(
  $$select test_helpers.create_with_cover('1a000000-0000-4000-8000-0000000000c3', '"file:///cache/cover.jpg"')$$,
  '23514', 'create_trip rejects a device URI as the cover');
reset role;

-- ---------------------------------------------------------------------------
-- The migration rewrites the covers that exist (A3). The schema is put back as it was before the migration, covers of
-- every old kind are inserted, and the migration file itself is run again on them.
-- ---------------------------------------------------------------------------
alter table public.trips drop constraint trips_cover_image_uri_check;
alter table public.trips alter column cover_image_uri drop not null;
alter table public.trips alter column cover_image_uri drop default;
alter table public.trips add constraint trips_cover_image_uri_check check (char_length(cover_image_uri) >= 1);

-- Old covers: none, a device URI, a bundled preset, a stored gallery cover, a cover the new shape would refuse.
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-a000-00000000000a', null);
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-a000-00000000000a', 'file:///data/user/0/cache/cover.jpg');
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-a000-00000000000a', 'preset:bali');
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-a000-00000000000a', 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c');
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-a000-00000000000a', 'photo:5B1F0F6A-2C7D-4A8E-9B3C-1D2E3F4A5B6C');
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-a000-00000000000a', 'preset:paris');

\ir ../migrations/20261018120000_trip_covers.sql

select test_helpers.ok(
  (select array_agg(cover_image_uri order by id) from public.trips where id::text like '1a000000-0000-4000-8000-0000000000f%') = array[
    'preset:auckland',
    'preset:auckland',
    'preset:bali',
    'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c',
    'preset:auckland',
    'preset:auckland'],
  'the migration sets a missing, device-URI or invalid cover to the default preset and leaves valid covers alone');
select test_helpers.ok(
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'trips' and column_name = 'cover_image_uri') = 'NO'
  and (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'trips' and column_name = 'cover_image_uri') like '%preset:auckland%',
  'after the migration the column is not null with the default preset again');
select test_helpers.throws(
  $$update public.trips set cover_image_uri = 'file:///cache/cover.jpg' where id = '1a000000-0000-4000-8000-0000000000f3'$$,
  '23514', 'after the migration a device URI is refused again');

-- ---------------------------------------------------------------------------
-- Who may change a cover (RLS of trips)
-- ---------------------------------------------------------------------------
select test_helpers.insert_trip('1a000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-a000-00000000000a', 'preset:auckland');
select test_helpers.insert_trip('1b000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-a000-00000000000b', 'preset:auckland');
insert into public.trip_members (id, trip_id, user_id, display_name, role, interests)
values ('20000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-a000-00000000000c', 'Celina', 'viewer', '{}');

select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  test_helpers.changes($$update public.trips set cover_image_uri = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c'
    where id = '1a000000-0000-4000-8000-0000000000a1'$$) = 1,
  'A can change the cover of their trip');
select test_helpers.ok(
  test_helpers.changes($$update public.trips set cover_image_uri = 'preset:majorka'
    where id = '1b000000-0000-4000-8000-0000000000b1'$$) = 0,
  'A cannot change the cover of B''s trip');

select test_helpers.login('00000000-0000-4000-a000-00000000000c');
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '1a000000-0000-4000-8000-0000000000a1') = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c',
  'the linked viewer C sees the cover');
select test_helpers.ok(
  test_helpers.changes($$update public.trips set cover_image_uri = 'preset:majorka'
    where id = '1a000000-0000-4000-8000-0000000000a1'$$) = 0,
  'the linked viewer C cannot change the cover');

select test_helpers.login('00000000-0000-4000-a000-00000000000b');
select test_helpers.ok(
  (select count(*) from public.trips where id = '1a000000-0000-4000-8000-0000000000a1') = 0,
  'stranger B cannot see A''s trip and so not its cover');
select test_helpers.ok(
  test_helpers.changes($$update public.trips set cover_image_uri = 'preset:majorka'
    where id = '1a000000-0000-4000-8000-0000000000a1'$$) = 0,
  'stranger B cannot change A''s cover');
reset role;
select test_helpers.ok(
  (select cover_image_uri from public.trips where id = '1a000000-0000-4000-8000-0000000000a1') = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c',
  'A''s cover is what A set after all of that');

-- ---------------------------------------------------------------------------
-- Storage: the files of a gallery cover (<tripId>/<uuid>.jpg and <tripId>/<uuid>_thumb.jpg) fall under the existing
-- trip-photos rules, so they need no Storage migration.
-- ---------------------------------------------------------------------------
select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c_thumb.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload the thumbnail of a cover into the folder of their trip');
select test_helpers.ok(
  test_helpers.changes(test_helpers.upload_sql(
    '1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg',
    '00000000-0000-4000-a000-00000000000a')) = 1,
  'A can upload the file of a cover into the folder of their trip');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 2,
  'A reads both cover files');
select test_helpers.throws(
  test_helpers.upload_sql('1b000000-0000-4000-8000-0000000000b1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a cover file into B''s folder');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/5B1F0F6A-2C7D-4A8E-9B3C-1D2E3F4A5B6C.jpg',
                          '00000000-0000-4000-a000-00000000000a'),
  '42501', 'A cannot upload a cover file with an uppercase id (the cover shape is lowercase only)');

-- Linked viewer C: reads, cannot write.
select test_helpers.login('00000000-0000-4000-a000-00000000000c');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 2,
  'the linked viewer C can read the cover files');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/6c2f1a7b-3d8e-4b9f-8c4d-2e3f4a5b6c7d.jpg',
                          '00000000-0000-4000-a000-00000000000c'),
  '42501', 'the linked viewer C cannot upload a cover file');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"size": 1}'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg'$$) = 0,
  'the linked viewer C cannot replace a cover file');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg'$$) = 0,
  'the linked viewer C cannot delete a cover file');

-- Stranger B: sees nothing, writes nothing.
select test_helpers.login('00000000-0000-4000-a000-00000000000b');
select test_helpers.ok(
  (select count(*) from storage.objects where bucket_id = 'trip-photos') = 0,
  'stranger B cannot read A''s cover files');
select test_helpers.throws(
  test_helpers.upload_sql('1a000000-0000-4000-8000-0000000000a1/6c2f1a7b-3d8e-4b9f-8c4d-2e3f4a5b6c7d.jpg',
                          '00000000-0000-4000-a000-00000000000b'),
  '42501', 'stranger B cannot upload a cover file into A''s folder');
select test_helpers.ok(
  test_helpers.changes($$update storage.objects set metadata = '{"size": 1}'
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg'$$) = 0,
  'stranger B cannot replace A''s cover file');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects
    where bucket_id = 'trip-photos' and name = '1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg'$$) = 0,
  'stranger B cannot delete A''s cover file');

-- The owner removes the files of a replaced cover (what the app does after changing a gallery cover).
select test_helpers.login('00000000-0000-4000-a000-00000000000a');
select test_helpers.ok(
  test_helpers.changes($$delete from storage.objects where bucket_id = 'trip-photos'
    and name in ('1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c.jpg',
                 '1a000000-0000-4000-8000-0000000000a1/5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c_thumb.jpg')$$) = 2,
  'A can delete both files of a cover');
reset role;

select 'trip_covers: all checks passed' as result;
rollback;
