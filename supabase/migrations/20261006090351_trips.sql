-- Trips, their members and flight segments (prompts/trips-supabase/plan.md, step 3).
-- Mirrors src/schemas/trip.ts, member.ts, flight.ts. Money: integer minor units; the budget's currency is base_currency.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  cover_image_uri text check (char_length(cover_image_uri) >= 1),
  destination text not null check (destination ~ '^[A-Z]{3}$'),
  start_date date not null,
  end_date date not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  budget_per_person_minor bigint not null check (budget_per_person_minor >= 0),
  budget_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint trips_end_date_not_before_start check (end_date >= start_date)
);
create index trips_owner_id_idx on public.trips (owner_id);

create table public.trip_members (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- null = friend without an account
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (display_name = btrim(display_name) and char_length(display_name) between 1 and 40),
  role text not null check (role in ('owner', 'viewer')),
  interests text[] not null default '{}' check (interests <@ array[
    'nightlife', 'theme_parks', 'concerts_festivals',
    'mountains_hiking', 'beaches', 'nature_parks',
    'museums', 'landmarks', 'art_galleries',
    'local_cuisine', 'cafes_desserts', 'street_food',
    'water_sports', 'cycling',
    'spa_wellness', 'shopping', 'photography'
  ]::text[]),
  budget_level text check (budget_level in ('low', 'mid', 'high')),
  pace text check (pace in ('relaxed', 'normal', 'intense')),
  dietary_notes text check (char_length(dietary_notes) <= 200)
);
create index trip_members_trip_id_idx on public.trip_members (trip_id);
create index trip_members_user_id_idx on public.trip_members (user_id);

create table public.flight_segments (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  direction text not null check (direction in ('outbound', 'return', 'internal')),
  -- `order` in the Zod schema; ORDER is a reserved word in SQL
  position integer not null check (position >= 0),
  flight_number text check (flight_number = btrim(flight_number) and char_length(flight_number) between 2 and 8),
  from_iata text not null check (from_iata ~ '^[A-Z]{3}$'),
  to_iata text not null check (to_iata ~ '^[A-Z]{3}$'),
  depart_at timestamptz not null,
  depart_tz text not null check (char_length(depart_tz) >= 1),
  arrive_at timestamptz not null,
  arrive_tz text not null check (char_length(arrive_tz) >= 1),
  constraint flight_segments_arrive_after_depart check (arrive_at > depart_at),
  constraint flight_segments_trip_direction_position_key unique (trip_id, direction, position)
);
-- trip_id lookups use the unique index above (trip_id is its first column).

-- ---------------------------------------------------------------------------
-- Access helpers: not exposed through the Data API (private schema).
-- security definer so the policies of trips and trip_members do not call each other in a loop.
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_trip_owner(trip_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trips
    where id = is_trip_owner.trip_id and owner_id = (select auth.uid())
  );
$$;

create function private.is_trip_viewer(trip_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_members.trip_id = is_trip_viewer.trip_id and user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_trip_owner(uuid), private.is_trip_viewer(uuid) from public, anon;
grant execute on function private.is_trip_owner(uuid), private.is_trip_viewer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: the owner does everything, a linked member only reads.
-- ---------------------------------------------------------------------------
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.flight_segments enable row level security;

create policy "Owners and linked members read trips" on public.trips
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_trip_viewer(id)));
create policy "Owners create their trips" on public.trips
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners update their trips" on public.trips
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners delete their trips" on public.trips
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners and linked members read members" on public.trip_members
  for select to authenticated
  using ((select private.is_trip_owner(trip_id)) or (select private.is_trip_viewer(trip_id)));
create policy "Owners add members" on public.trip_members
  for insert to authenticated
  with check ((select private.is_trip_owner(trip_id)));
create policy "Owners update members" on public.trip_members
  for update to authenticated
  using ((select private.is_trip_owner(trip_id)))
  with check ((select private.is_trip_owner(trip_id)));
create policy "Owners remove members" on public.trip_members
  for delete to authenticated
  using ((select private.is_trip_owner(trip_id)));

create policy "Owners and linked members read segments" on public.flight_segments
  for select to authenticated
  using ((select private.is_trip_owner(trip_id)) or (select private.is_trip_viewer(trip_id)));
create policy "Owners add segments" on public.flight_segments
  for insert to authenticated
  with check ((select private.is_trip_owner(trip_id)));
create policy "Owners update segments" on public.flight_segments
  for update to authenticated
  using ((select private.is_trip_owner(trip_id)))
  with check ((select private.is_trip_owner(trip_id)));
create policy "Owners remove segments" on public.flight_segments
  for delete to authenticated
  using ((select private.is_trip_owner(trip_id)));

-- ---------------------------------------------------------------------------
-- Data API exposure: explicit grants, nothing for anon (requests without a session).
-- ---------------------------------------------------------------------------
revoke all on public.trips, public.trip_members, public.flight_segments from public, anon, authenticated;
grant select, insert, update, delete on public.trips, public.trip_members, public.flight_segments to authenticated;
grant all on public.trips, public.trip_members, public.flight_segments to service_role;

-- ---------------------------------------------------------------------------
-- create_trip: the trip, its members and segments in one transaction.
-- security invoker: RLS applies as for direct inserts. Ids come from the device, so a retry adds nothing.
-- The owner is always the caller; an owner_id in the payload is ignored.
-- ---------------------------------------------------------------------------
create function public.create_trip(trip jsonb, members jsonb, segments jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.trips (id, owner_id, name, cover_image_uri, destination, start_date, end_date,
                            base_currency, budget_per_person_minor, budget_updated_at, created_at)
  select t.id, (select auth.uid()), t.name, t.cover_image_uri, t.destination, t.start_date, t.end_date,
         t.base_currency, t.budget_per_person_minor, t.budget_updated_at, t.created_at
  from jsonb_populate_record(null::public.trips, trip) as t
  on conflict (id) do nothing;

  insert into public.trip_members (id, trip_id, user_id, display_name, role, interests,
                                   budget_level, pace, dietary_notes)
  select m.id, m.trip_id, m.user_id, m.display_name, m.role, coalesce(m.interests, '{}'),
         m.budget_level, m.pace, m.dietary_notes
  from jsonb_populate_recordset(null::public.trip_members, members) as m
  on conflict (id) do nothing;

  insert into public.flight_segments (id, trip_id, direction, position, flight_number, from_iata, to_iata,
                                      depart_at, depart_tz, arrive_at, arrive_tz)
  select s.id, s.trip_id, s.direction, s.position, s.flight_number, s.from_iata, s.to_iata,
         s.depart_at, s.depart_tz, s.arrive_at, s.arrive_tz
  from jsonb_populate_recordset(null::public.flight_segments, segments) as s
  on conflict (id) do nothing;
end;
$$;

revoke execute on function public.create_trip(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_trip(jsonb, jsonb, jsonb) to authenticated, service_role;
