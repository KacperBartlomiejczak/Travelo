-- Daily budget per person (prompts/daily-budget/plan.md, step 2; B1-B6, A1-A3).
-- trips.budget_per_person_minor (a whole-trip amount) becomes trips.daily_budget_minor (the organizer's amount per day);
-- every friend gets trip_members.daily_budget_minor. The organizer is not a trip_members row (A2).
-- Previous migrations are not edited.

-- ---------------------------------------------------------------------------
-- Existing trips (B5): daily amount = floor(old total / number of days), the same for everyone.
-- Days count both the first and the last day, like tripDayCount in src/lib/trip-days.ts. A total smaller than the
-- number of days (or zero) would floor to 0, which the check forbids, so such a trip gets 1 minor unit per day.
-- ---------------------------------------------------------------------------
create function private.daily_from_total(total bigint, start_date date, end_date date) returns bigint
language sql immutable set search_path = ''
as $$ select greatest(1, total / (end_date - start_date + 1)) $$;

revoke execute on function private.daily_from_total(bigint, date, date) from public, anon;

alter table public.trips add column daily_budget_minor bigint check (daily_budget_minor > 0);

update public.trips
set daily_budget_minor = private.daily_from_total(budget_per_person_minor, start_date, end_date);

alter table public.trips alter column daily_budget_minor set not null;
alter table public.trips drop column budget_per_person_minor;

alter table public.trip_members add column daily_budget_minor bigint check (daily_budget_minor > 0);

update public.trip_members m
set daily_budget_minor = t.daily_budget_minor
from public.trips t
where t.id = m.trip_id;

alter table public.trip_members alter column daily_budget_minor set not null;

-- ---------------------------------------------------------------------------
-- create_trip: same signature, security invoker and grants as in 20261020130000; now reads daily_budget_minor for the
-- trip and for each member.
-- ---------------------------------------------------------------------------
create or replace function public.create_trip(trip jsonb, members jsonb, segments jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  link record;
begin
  insert into public.trips (id, owner_id, name, cover_image_uri, destination, start_date, end_date,
                            base_currency, daily_budget_minor, budget_updated_at, created_at)
  select t.id, (select auth.uid()), t.name, t.cover_image_uri, t.destination, t.start_date, t.end_date,
         t.base_currency, t.daily_budget_minor, t.budget_updated_at, t.created_at
  from jsonb_populate_record(null::public.trips, trip) as t
  on conflict (id) do nothing;

  insert into public.trip_members (id, trip_id, user_id, display_name, role, interests,
                                   budget_level, pace, dietary_notes, daily_budget_minor)
  select m.id, m.trip_id, null, m.display_name, m.role, coalesce(m.interests, '{}'),
         m.budget_level, m.pace, m.dietary_notes, m.daily_budget_minor
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
-- set_trip_budget: the organizer's amount and the listed friends' amounts in one transaction (A3).
-- members = [{ "member_id": uuid, "daily_budget_minor": int }, ...].
-- security definer, because the owner has no UPDATE privilege on trip_members.daily_budget_minor (the grant list of
-- 20261020130000 is unchanged); the owner check is made inside, so nobody else gets in.
--   - not the owner of the trip (or no such trip): 42501;
--   - a member id that is not in this trip: 22023, nothing is changed;
--   - last write wins on budget_updated_at: an older (or equal) updated_at changes nothing, and is not an error, so a
--     retried or stale offline change simply ends as synced.
-- ---------------------------------------------------------------------------
create function public.set_trip_budget(trip_id uuid, organizer_daily_minor bigint, members jsonb, updated_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.is_trip_owner(set_trip_budget.trip_id)) then
    raise exception 'not allowed to change this trip budget' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(set_trip_budget.members) as x(member_id uuid, daily_budget_minor bigint)
    where not exists (
      select 1 from public.trip_members m where m.id = x.member_id and m.trip_id = set_trip_budget.trip_id
    )
  ) then
    raise exception 'member is not in this trip' using errcode = '22023';
  end if;

  update public.trips t
  set daily_budget_minor = set_trip_budget.organizer_daily_minor, budget_updated_at = set_trip_budget.updated_at
  where t.id = set_trip_budget.trip_id and t.budget_updated_at < set_trip_budget.updated_at;
  if not found then
    return;
  end if;

  update public.trip_members m
  set daily_budget_minor = x.daily_budget_minor
  from jsonb_to_recordset(set_trip_budget.members) as x(member_id uuid, daily_budget_minor bigint)
  where m.id = x.member_id and m.trip_id = set_trip_budget.trip_id;
end;
$$;

revoke execute on function public.set_trip_budget(uuid, bigint, jsonb, timestamptz) from public, anon;
grant execute on function public.set_trip_budget(uuid, bigint, jsonb, timestamptz) to authenticated, service_role;
