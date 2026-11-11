-- Per-user daily quota for AI / Places requests (places-legal-navbar plan, step C3, D17).
-- Only the Edge Function (service role) touches it: RLS is on and there are no client policies.

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;

-- Takes one unit of today's (UTC) quota in a single atomic statement. Returns the remaining count,
-- or null when the limit was already reached. The limit comes from the caller.
create function public.consume_ai_quota(p_user_id uuid, p_limit int) returns int
language sql security invoker set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, day, count)
  select p_user_id, (now() at time zone 'utc')::date, 1 where p_limit > 0
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning p_limit - u.count
$$;

revoke execute on function public.consume_ai_quota(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, int) to service_role;
