-- Profiles: one row per signed-in user, with a unique nick, interests, a friend code and an optional avatar
-- (prompts/auth-onboarding/plan.md, step 2). Mirrors src/schemas/profile.ts (ProfileSchema, UsernameSchema,
-- FriendCodeSchema). A trip member may later link to a profile by user_id; the two stay separate entities.
--
-- Access: a user reads, creates and updates only their own row. Anonymous users cannot create one.
-- The friend code is generated here by a trigger; clients can neither set nor change it (column grants + trigger).
-- Avatars live in a private Storage bucket at <userId>/<avatarId>.jpg and are visible only to their owner for now.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Same rule as UsernameSchema: starts with a letter, then lowercase letters, digits, "_" and "."; 3 to 20
  -- characters; no "..", no trailing ".". Unique, and since only lowercase is allowed, unique regardless of case.
  username text not null
    constraint profiles_username_key unique
    constraint profiles_username_format check (
      username ~ '^[a-z][a-z0-9_.]{2,19}$' and username !~ '\.\.' and username !~ '\.$'
    ),
  -- Set by the before-insert trigger below, which replaces whatever the insert says. 6 characters from the alphabet
  -- without 0 O 1 I L (FRIEND_CODE_ALPHABET). The empty default only makes the column optional in the generated insert
  -- type; it fails the format check below, so an insert can never keep it (e.g. if the trigger were ever dropped).
  friend_code text not null default ''
    constraint profiles_friend_code_key unique
    constraint profiles_friend_code_format check (friend_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  interests text[] not null
    constraint profiles_interests_check check (
      cardinality(interests) >= 1 and interests <@ array[
        'nightlife', 'theme_parks', 'concerts_festivals',
        'mountains_hiking', 'beaches', 'nature_parks',
        'museums', 'landmarks', 'art_galleries',
        'local_cuisine', 'cafes_desserts', 'street_food',
        'water_sports', 'cycling',
        'spa_wellness', 'shopping', 'photography'
      ]::text[]
    ),
  -- The file is <id>/<avatar_id>.jpg in the `avatars` bucket; null = no photo.
  avatar_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Friend code: always generated here, whatever the insert says.
-- 6 characters, each drawn from the 31-character alphabet by rejection sampling on random bytes from pgcrypto:
-- a byte is used only when it is below 248 (= 31 * 8) and mapped with byte % 31, so every character is equally
-- likely (no modulo bias). The draw repeats until no profile has the code; the unique constraint stays the last guard
-- (31^6 = 887 million codes; two inserts racing for the same fresh code would make one fail with a unique violation
-- on profiles_friend_code_key).
-- security definer: the check must see every profile, not only the caller's. Not callable by clients.
-- ---------------------------------------------------------------------------
create function private.set_friend_code() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  random_bytes bytea;
  byte_value integer;
  i integer;
begin
  loop
    candidate := '';
    while length(candidate) < 6 loop
      random_bytes := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        byte_value := get_byte(random_bytes, i);
        if byte_value < 248 and length(candidate) < 6 then
          candidate := candidate || substr(alphabet, (byte_value % 31) + 1, 1);
        end if;
      end loop;
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = candidate);
  end loop;
  new.friend_code := candidate;
  return new;
end;
$$;

revoke execute on function private.set_friend_code() from public, anon, authenticated;

create trigger profiles_set_friend_code
  before insert on public.profiles
  for each row execute function private.set_friend_code();

-- ---------------------------------------------------------------------------
-- Updates: id, friend_code and created_at never change (also for a privileged writer, next to the column grants),
-- and updated_at moves. clock_timestamp() rather than now(), so it also moves between two updates in one transaction.
-- ---------------------------------------------------------------------------
create function private.touch_profile() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.id := old.id;
  new.friend_code := old.friend_code;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke execute on function private.touch_profile() from public, anon, authenticated;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function private.touch_profile();

-- ---------------------------------------------------------------------------
-- Row Level Security: own row only. No delete policy; the row goes away with its auth user (on delete cascade).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Users read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- An anonymous session (is_anonymous claim) can never get a profile. Sign-in is required and anonymous sign-ins are
-- off, but a token issued earlier stays valid until it expires.
create policy "Users create their own profile" on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Data API exposure: explicit grants, nothing for anon. Clients write only the columns they own;
-- friend_code, created_at and updated_at are set by the database.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, interests, avatar_id) on public.profiles to authenticated;
grant update (username, interests, avatar_id) on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- Storage: the private avatars bucket. Files are <userId>/<avatarId>.jpg (lowercase ids, no thumbnail, no sub-folders),
-- JPEG only (the app re-encodes every photo), 2 MiB per file. Shown through signed URLs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg']);

-- The user a file belongs to, read from its path. Only the exact shape the app uploads matches; anything else gives
-- null instead of an error, and a null folder never equals a user id. Lowercase only: one spelling per folder.
create function private.user_id_of_avatar(name text) returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      then split_part(name, '/', 1)::uuid
  end;
$$;

revoke execute on function private.user_id_of_avatar(text) from public, anon;
grant execute on function private.user_id_of_avatar(text) to authenticated;

-- owner_id is the uploader's user id as text, written by the Storage server from the JWT, never by the client.
-- An upsert (upload with upsert: true) needs insert, select and update together.
-- Only the owner sees their avatar for now; friends will see each other's in the friends feature.
create policy "Users upload their avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and owner_id = (select auth.uid())::text
    and private.user_id_of_avatar(name) = (select auth.uid())
  );

create policy "Users read their avatar" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and private.user_id_of_avatar(name) = (select auth.uid())
  );

-- with check also stops a move: into another user's folder, into a malformed name, out of the bucket, or to another owner.
create policy "Users replace their avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text)
  with check (
    bucket_id = 'avatars'
    and owner_id = (select auth.uid())::text
    and private.user_id_of_avatar(name) = (select auth.uid())
  );

-- By owner_id only (not by path), so a user can still remove a file whose name the helper does not recognise.
create policy "Users delete their avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);
