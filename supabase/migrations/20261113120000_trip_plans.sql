-- AI trip plan storage + per-kind AI quota (ai-trip-plan plan, step 3; D3, D8, D9, D14, D15).
-- Mirrors StoredPlanDaySchema / TripPlanSchema in src/schemas/trip-plan.ts. Only placeIds are stored (D14).

-- One plan per trip, overwritten by the Edge Function (service role) on regenerate (D15).
create table public.trip_plans (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  days jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

alter table public.trip_plans enable row level security;

create policy "Owners and linked members read plans" on public.trip_plans
  for select to authenticated
  using ((select private.is_trip_owner(trip_id)) or (select private.is_trip_viewer(trip_id)));

revoke all on public.trip_plans from public, anon, authenticated;
grant select on public.trip_plans to authenticated;
grant all on public.trip_plans to service_role;

-- Quota per kind: existing rows are 'places'.
alter table public.ai_usage add column kind text not null default 'places'
  check (kind in ('places', 'trip_plan'));
alter table public.ai_usage drop constraint ai_usage_pkey;
alter table public.ai_usage add primary key (user_id, day, kind);

-- Same semantics as the 2-argument function, per kind. Returns the remaining count or null at the limit.
create function public.consume_ai_quota(p_user_id uuid, p_limit int, p_kind text) returns int
language sql security invoker set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, day, kind, count)
  select p_user_id, (now() at time zone 'utc')::date, p_kind, 1 where p_limit > 0
  on conflict (user_id, day, kind) do update set count = u.count + 1 where u.count < p_limit
  returning p_limit - u.count
$$;

-- The 2-argument form keeps working for recommend-places (kind 'places'). Its grants are kept by create or replace.
create or replace function public.consume_ai_quota(p_user_id uuid, p_limit int) returns int
language sql security invoker set search_path = ''
as $$
  select public.consume_ai_quota(p_user_id, p_limit, 'places')
$$;

-- Gives back one unit of today's (UTC) quota after a failed attempt (D9); never below 0.
create function public.refund_ai_quota(p_user_id uuid, p_kind text) returns void
language sql security invoker set search_path = ''
as $$
  update public.ai_usage set count = count - 1
  where user_id = p_user_id and day = (now() at time zone 'utc')::date and kind = p_kind and count > 0
$$;

revoke execute on function public.consume_ai_quota(uuid, int, text) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, int, text) to service_role;
revoke execute on function public.refund_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai_quota(uuid, text) to service_role;
