-- Expenses of a trip (prompts/expenses/plan.md, step 2). Mirrors src/schemas/expense.ts (ExpenseSchema / ExpenseRowSchema).
-- Money: integer minor units + ISO 4217 code. Ids come from the device, so there is no default on id.
-- Deletes are soft (deleted_at) so they can sync; nobody gets a delete privilege.

-- A composite foreign key needs a unique key on the target.
alter table public.trip_members add constraint trip_members_trip_id_id_key unique (trip_id, id);

create table public.expenses (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- null = the organizer (not a trip member)
  member_id uuid,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  category text not null check (category in ('food', 'transport', 'stay', 'activities', 'other')),
  spent_on date not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  -- The member must belong to the same trip (checked for every writer, the owner included). Not matched when member_id is null.
  -- Members with expenses, live or soft-deleted, cannot be deleted (D18); deleting the trip removes them together.
  constraint expenses_member_fkey foreign key (trip_id, member_id) references public.trip_members (trip_id, id) on delete restrict
);
-- Serves trip lookups and the foreign key checks when a member is deleted.
create index expenses_trip_id_member_id_idx on public.expenses (trip_id, member_id);

-- ---------------------------------------------------------------------------
-- Access helper: is this member row the caller's own, in this trip?
-- security definer like the helpers of the trips migration; private schema, not exposed through the Data API.
-- ---------------------------------------------------------------------------
create function private.is_own_member(trip_id uuid, member_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_members.trip_id = is_own_member.trip_id
      and trip_members.id = is_own_member.member_id
      and trip_members.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_own_member(uuid, uuid) from public, anon;
grant execute on function private.is_own_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (D15): the owner reads and writes every expense of the trip; a linked member reads them all and
-- writes only expenses whose member_id is their own member row in that trip (never null, never someone else's).
-- The check applies to the new row of an insert and of an update, so a row cannot be handed to someone else.
-- ---------------------------------------------------------------------------
alter table public.expenses enable row level security;

create policy "Owners and linked members read expenses" on public.expenses
  for select to authenticated
  using ((select private.is_trip_owner(trip_id)) or (select private.is_trip_viewer(trip_id)));
create policy "Owners and members add expenses" on public.expenses
  for insert to authenticated
  with check ((select private.is_trip_owner(trip_id)) or (select private.is_own_member(trip_id, member_id)));
create policy "Owners and members update expenses" on public.expenses
  for update to authenticated
  using ((select private.is_trip_owner(trip_id)) or (select private.is_own_member(trip_id, member_id)))
  with check ((select private.is_trip_owner(trip_id)) or (select private.is_own_member(trip_id, member_id)));

-- ---------------------------------------------------------------------------
-- Data API exposure: explicit grants, nothing for anon, no delete for anyone. trip_id, id and created_at never change.
-- ---------------------------------------------------------------------------
revoke all on public.expenses from public, anon, authenticated;
grant select, insert on public.expenses to authenticated;
grant update (member_id, name, amount_minor, currency, category, spent_on, updated_at, deleted_at) on public.expenses to authenticated;
grant all on public.expenses to service_role;

-- ---------------------------------------------------------------------------
-- upsert_expense: idempotent upsert by id, last write wins by updated_at.
-- A retry is a no-op (the same updated_at is not "newer"); an older updated_at never overwrites a newer row, and a soft
-- delete is just a row with deleted_at set. security invoker: the policies above apply, so taking over an id that
-- belongs to a trip the caller cannot write fails with 42501. trip_id and created_at of an existing row are kept.
-- Call: supabase.rpc('upsert_expense', { expense: <snake_case row of ExpenseRowSchema> }).
-- ---------------------------------------------------------------------------
create function public.upsert_expense(expense jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.expenses (id, trip_id, member_id, name, amount_minor, currency, category, spent_on,
                               created_at, updated_at, deleted_at)
  select e.id, e.trip_id, e.member_id, e.name, e.amount_minor, e.currency, e.category, e.spent_on,
         e.created_at, e.updated_at, e.deleted_at
  from jsonb_populate_record(null::public.expenses, expense) as e
  on conflict (id) do update set
    member_id = excluded.member_id, name = excluded.name, amount_minor = excluded.amount_minor,
    currency = excluded.currency, category = excluded.category, spent_on = excluded.spent_on,
    updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
  where public.expenses.updated_at < excluded.updated_at;
end;
$$;

revoke execute on function public.upsert_expense(jsonb) from public, anon;
grant execute on function public.upsert_expense(jsonb) to authenticated, service_role;
