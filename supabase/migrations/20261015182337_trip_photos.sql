-- Trip photos: one row per photo of a trip (prompts/trip-photos/plan.md, step 4).
-- Mirrors TripPhotoSchema in src/schemas/trip-photo.ts. The files themselves live in Storage (next migration).
-- Rows are append-and-delete only: a photo is never edited, so there is no update grant or policy.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.trip_photos (
  -- client-generated UUID: sending the same photo again never creates a second row (A5)
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- the camera's own clock, minute precision, no time zone (D12); null when the file has no date
  taken_at timestamp without time zone,
  created_at timestamptz not null
);
create index trip_photos_trip_id_idx on public.trip_photos (trip_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: the owner adds, reads and removes; a linked member only reads.
-- Uses the helpers from the trips migration (security definer, not exposed through the Data API).
-- ---------------------------------------------------------------------------
alter table public.trip_photos enable row level security;

create policy "Owners and linked members read photos" on public.trip_photos
  for select to authenticated
  using ((select private.is_trip_owner(trip_id)) or (select private.is_trip_viewer(trip_id)));
create policy "Owners add photos" on public.trip_photos
  for insert to authenticated
  with check ((select private.is_trip_owner(trip_id)));
create policy "Owners remove photos" on public.trip_photos
  for delete to authenticated
  using ((select private.is_trip_owner(trip_id)));

-- ---------------------------------------------------------------------------
-- Data API exposure: explicit grants, nothing for anon (requests without a session), no update for anyone.
-- ---------------------------------------------------------------------------
revoke all on public.trip_photos from public, anon, authenticated;
grant select, insert, delete on public.trip_photos to authenticated;
grant all on public.trip_photos to service_role;
