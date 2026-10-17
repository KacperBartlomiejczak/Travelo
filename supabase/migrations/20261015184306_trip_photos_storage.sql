-- Trip photos in Storage: the private bucket and its access rules (prompts/trip-photos/plan.md, step 5).
-- Files live at <tripId>/<photoId>.jpg and <tripId>/<photoId>_thumb.jpg (photoPaths in src/lib/trip-photos.ts).
-- The owner of a trip uploads, replaces and deletes files in its folder; a linked member only reads them.
-- The app shows the files through signed URLs, so the bucket is private.

-- ---------------------------------------------------------------------------
-- Bucket: private, JPEG only (the app re-encodes every photo to JPEG), 10 MiB per file
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 10485760, array['image/jpeg']);

-- ---------------------------------------------------------------------------
-- The trip a file belongs to, read from its path. Only the exact shapes the app uploads match
-- (lowercase ids, no sub-folders); anything else gives null instead of an error, and a null trip is never owned.
-- Lowercase only: one spelling per folder, so deleting a trip's files by its prefix cannot miss a twin.
-- ---------------------------------------------------------------------------
create function private.trip_id_of_object(name text) returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_thumb)?\.jpg$'
      then split_part(name, '/', 1)::uuid
  end;
$$;

revoke execute on function private.trip_id_of_object(text) from public, anon;
grant execute on function private.trip_id_of_object(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security on storage.objects (already enabled by Storage). owner_id is the uploader's user id as text,
-- written by the Storage server from the JWT, never by the client.
-- An upsert (upload with upsert: true) needs insert, select and update together.
-- ---------------------------------------------------------------------------
create policy "Owners upload trip photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and owner_id = (select auth.uid())::text
    and (select private.is_trip_owner(private.trip_id_of_object(name)))
  );

create policy "Owners and linked members read trip photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-photos'
    and (
      owner_id = (select auth.uid())::text
      or (select private.is_trip_viewer(private.trip_id_of_object(name)))
    )
  );

-- with check also stops a move: into a folder of a trip the caller does not own, into a malformed name,
-- out of the bucket, or to another owner.
create policy "Owners replace trip photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'trip-photos' and owner_id = (select auth.uid())::text)
  with check (
    bucket_id = 'trip-photos'
    and owner_id = (select auth.uid())::text
    and (select private.is_trip_owner(private.trip_id_of_object(name)))
  );

-- By owner_id only (not by trip), so the owner can still clean up files whose trip is already gone.
create policy "Owners delete trip photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-photos' and owner_id = (select auth.uid())::text);
