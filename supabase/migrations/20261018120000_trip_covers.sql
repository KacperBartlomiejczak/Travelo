-- Trip covers: every trip has a cover (prompts/trip-covers/plan.md, step 4).
-- Mirrors src/schemas/cover.ts (CoverSchema). trips.cover_image_uri keeps its name and holds one of two values:
--   preset:<id>      a photo bundled in the app (auckland, bali, beijing, jakarta, majorka); nothing is stored for it
--   photo:<uuid>     a gallery photo in Storage at <tripId>/<uuid>.jpg and <tripId>/<uuid>_thumb.jpg, the same path
--                    shapes as trip photos, so the Storage rules of trip-photos already cover it (no Storage change)
-- The uuid is lowercase only: it becomes a Storage path, and the Storage rules accept only lowercase ids.
--
-- create_trip is not changed: it copies cover_image_uri from the payload as is, and the app always sends one.
-- A payload with an explicit null (or without the key) therefore fails the not null below instead of getting the
-- default: jsonb_populate_record sets the field to null and a column default only applies to an omitted column.

-- Covers that exist today were device-local file URIs (or none), which the server cannot show on another phone;
-- they and anything else that does not match become the default preset (A3: test trips only).
update public.trips
set cover_image_uri = 'preset:auckland'
where cover_image_uri is null
   or cover_image_uri !~ '^(preset:(auckland|bali|beijing|jakarta|majorka)|photo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$';

-- The old check (a non-empty string) is replaced by the exact shape of the Zod schema. Same name, new meaning.
alter table public.trips drop constraint trips_cover_image_uri_check;

alter table public.trips
  alter column cover_image_uri set default 'preset:auckland',
  alter column cover_image_uri set not null;

alter table public.trips
  add constraint trips_cover_image_uri_check check (
    cover_image_uri ~ '^(preset:(auckland|bali|beijing|jakarta|majorka)|photo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
  );
