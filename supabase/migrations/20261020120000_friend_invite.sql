-- Friend invite (prompts/friend-invite/plan.md, step 2): the organizer links a friend who has an account by typing the
-- friend's friend code. A linked friend is a trip_members row with user_id set (role viewer); the existing RLS already
-- lets them read the trip and not write. profiles stays readable only by its owner (no select policy is added):
-- the two functions below are the only extra doors, and each exposes the minimum.

-- ---------------------------------------------------------------------------
-- Lookup by friend code (friend-invite D1, D3).
-- security definer: the caller cannot read other profiles, this function can. It returns at most one row and only
-- id, username and interests (FoundFriendSchema), never the friend code or the avatar. Exact match: the app sends the
-- code already uppercased and validated; nothing here widens it (no case folding, no trimming, no LIKE).
-- Needs a real signed-in account: execute is revoked from anon, and an anonymous-sign-in session (is_anonymous claim)
-- finds nothing, as it can never own a profile either.
-- ---------------------------------------------------------------------------
create function public.find_profile_by_friend_code(code text)
returns table (id uuid, username text, interests text[])
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.interests
  from public.profiles p
  where p.friend_code = find_profile_by_friend_code.code
    and (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;

revoke execute on function public.find_profile_by_friend_code(text) from public, anon;
grant execute on function public.find_profile_by_friend_code(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The organizer's nick for the trip's participants (friend-invite D4).
-- security definer: a linked member cannot read the organizer's profile. Returns the owner's username only when the
-- caller is the trip's owner or one of its linked members (same helpers as the RLS policies), else null.
-- Unknown trip, null trip or a stranger all give null, so the function does not reveal whether a trip exists.
-- ---------------------------------------------------------------------------
create function public.trip_organizer_username(trip_id uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select p.username
  from public.trips t
  join public.profiles p on p.id = t.owner_id
  where t.id = trip_organizer_username.trip_id
    and ((select private.is_trip_owner(trip_organizer_username.trip_id))
         or (select private.is_trip_viewer(trip_organizer_username.trip_id)));
$$;

revoke execute on function public.trip_organizer_username(uuid) from public, anon;
grant execute on function public.trip_organizer_username(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- One link per account per trip (friend-invite D1). Members without an account (user_id null) are not limited.
-- ---------------------------------------------------------------------------
create unique index trip_members_trip_user_key on public.trip_members (trip_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- create_trip: as before (trips_supabase), plus a guard against linking yourself.
-- A member whose user_id is the caller is refused with SQLSTATE FI001 ("cannot link yourself as a trip member"); the
-- app maps it to the "own code" message. Linking the same account twice fails with the unique violation (23505) of
-- trip_members_trip_user_key. Either failure rolls the whole call back. A retry of an already saved trip stays
-- idempotent: its members conflict on id and are skipped.
-- ---------------------------------------------------------------------------
create or replace function public.create_trip(trip jsonb, members jsonb, segments jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if exists (
    select 1
    from jsonb_populate_recordset(null::public.trip_members, members) as m
    where m.user_id = (select auth.uid())
  ) then
    raise exception 'cannot link yourself as a trip member' using errcode = 'FI001';
  end if;

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
