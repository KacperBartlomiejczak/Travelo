-- Friend invite, link only by code (prompts/friend-invite/plan.md, step 2b, D12).
-- Step 2 let create_trip store any user_id the app sent, and co-members' user_ids are readable, so an account could be
-- linked without its friend code. From here the server links an account only from a friend code it resolves itself:
--   - a user_id in the create_trip payload is ignored (stored null);
--   - a member with a friend_code is linked by a security definer helper in the private schema;
--   - the owner can no longer write trip_members.user_id directly (insert policy + column privileges).
-- The previous migration (20261020120000_friend_invite.sql) is not edited.

-- ---------------------------------------------------------------------------
-- Lookup by friend code: nick and interests only, no account id (the id is never sent to the app).
-- Same rules as before: security definer, exact match, nothing for a session without a real account, anon refused.
-- The return type changes, so the function is dropped and created again.
-- ---------------------------------------------------------------------------
drop function public.find_profile_by_friend_code(text);

create function public.find_profile_by_friend_code(code text)
returns table (username text, interests text[])
language sql stable security definer set search_path = ''
as $$
  select p.username, p.interests
  from public.profiles p
  where p.friend_code = find_profile_by_friend_code.code
    and (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;

revoke execute on function public.find_profile_by_friend_code(text) from public, anon;
grant execute on function public.find_profile_by_friend_code(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Linking helper: the only code that sets trip_members.user_id.
-- security definer so it can read the profile behind a code (profiles are readable only by their owner) and write the
-- column the caller has no privilege on. Lives in the private schema, which the Data API does not expose
-- (supabase/config.toml [api] schemas = public, graphql_public), so clients cannot call it over HTTP; create_trip, which
-- runs as the caller, does. authenticated therefore needs execute; anon does not get it.
--   - the member must belong to a trip the caller owns (42501 otherwise), so a reused member id cannot link into
--     someone else's trip;
--   - an unknown code (or any code that is not an exact match) raises FI002;
--   - the caller's own code raises FI001;
--   - the same account twice in one trip fails on trip_members_trip_user_key (23505);
--   - only a member without a link is linked: an already linked member is left alone, so a retried create_trip is a
--     no-op and a retry can never re-point an existing link.
-- ---------------------------------------------------------------------------
create function private.link_trip_member(member_id uuid, code text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  member_trip_id uuid;
  target_id uuid;
begin
  select m.trip_id into member_trip_id from public.trip_members m where m.id = link_trip_member.member_id;
  if member_trip_id is null or not (select private.is_trip_owner(member_trip_id)) then
    raise exception 'not allowed to link this member' using errcode = '42501';
  end if;

  select p.id into target_id from public.profiles p where p.friend_code = link_trip_member.code;
  if target_id is null then
    raise exception 'no user has this friend code' using errcode = 'FI002';
  end if;
  if target_id = (select auth.uid()) then
    raise exception 'cannot link yourself as a trip member' using errcode = 'FI001';
  end if;

  update public.trip_members set user_id = target_id
  where id = link_trip_member.member_id and user_id is null;
end;
$$;

revoke execute on function private.link_trip_member(uuid, text) from public, anon;
grant execute on function private.link_trip_member(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_trip: same signature, security invoker and grants. Members are inserted with user_id null whatever the payload
-- says; each member with a non-null friend_code is then linked through the helper.
--   FI001 own code · FI002 unknown code · 23505 same friend twice. Any of them rolls back the whole call.
-- Idempotent retry: the trip, members and segments conflict on id and are skipped; the link step then finds the member
-- already linked (or links it again to the same account, since a friend code never changes) and does nothing.
-- ---------------------------------------------------------------------------
create or replace function public.create_trip(trip jsonb, members jsonb, segments jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  link record;
begin
  insert into public.trips (id, owner_id, name, cover_image_uri, destination, start_date, end_date,
                            base_currency, budget_per_person_minor, budget_updated_at, created_at)
  select t.id, (select auth.uid()), t.name, t.cover_image_uri, t.destination, t.start_date, t.end_date,
         t.base_currency, t.budget_per_person_minor, t.budget_updated_at, t.created_at
  from jsonb_populate_record(null::public.trips, trip) as t
  on conflict (id) do nothing;

  insert into public.trip_members (id, trip_id, user_id, display_name, role, interests,
                                   budget_level, pace, dietary_notes)
  select m.id, m.trip_id, null, m.display_name, m.role, coalesce(m.interests, '{}'),
         m.budget_level, m.pace, m.dietary_notes
  from jsonb_populate_recordset(null::public.trip_members, members) as m
  on conflict (id) do nothing;

  insert into public.flight_segments (id, trip_id, direction, position, flight_number, from_iata, to_iata,
                                      depart_at, depart_tz, arrive_at, arrive_tz)
  select s.id, s.trip_id, s.direction, s.position, s.flight_number, s.from_iata, s.to_iata,
         s.depart_at, s.depart_tz, s.arrive_at, s.arrive_tz
  from jsonb_populate_recordset(null::public.flight_segments, segments) as s
  on conflict (id) do nothing;

  for link in
    select x.id, x.friend_code
    from jsonb_to_recordset(members) as x(id uuid, friend_code text)
    where x.friend_code is not null
  loop
    perform private.link_trip_member(link.id, link.friend_code);
  end loop;
end;
$$;

revoke execute on function public.create_trip(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_trip(jsonb, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Direct writes: no user_id from the owner, ever.
-- Insert: only members without an account (the policy is re-created with user_id is null).
-- Update: table-level UPDATE is replaced by UPDATE on the columns the owner may edit. user_id is not among them, and
-- neither are id and trip_id (a primary key does not change, and a member does not move to another trip).
-- ---------------------------------------------------------------------------
drop policy "Owners add members" on public.trip_members;
create policy "Owners add members" on public.trip_members
  for insert to authenticated
  with check ((select private.is_trip_owner(trip_id)) and user_id is null);

revoke update on public.trip_members from authenticated;
grant update (display_name, role, interests, budget_level, pace, dietary_notes) on public.trip_members to authenticated;
