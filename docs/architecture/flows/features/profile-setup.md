# Profile setup and own profile

Entry: the onboarding screen after the first sign-in.

- **Profile** (`createSupabaseProfileRepository`):
  - `myProfile()`: reads the own row (no row → `null`, copy cleared), signs the avatar URL (a failure there is not fatal), writes the SQLite copy. Unreachable → the copy, which D14 guarantees is the signed-in user's.
  - `createProfile(input)`:
    1. Zod first;
    2. `prepareAvatar` (≤ 512 px, JPEG 0.8, no EXIF) and an upload to `avatars/<userId>/<avatarId>.jpg` (`upsert: false`);
    3. insert `id, username, interests, avatar_id`.
    - A `23505` on `profiles_username_key` → `UsernameTakenError`, and the uploaded file is removed.
    - An unreachable insert, or a 5xx, keeps the file, because the row may exist.
    - A pkey conflict returns the stored profile.
