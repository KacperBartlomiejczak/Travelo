# Profile setup and own profile

Entry: the onboarding screen after the first sign-in.

- **Profile** (`createSupabaseProfileRepository`):
  - `myProfile()`: reads the own row (no row → `null`, copy cleared), signs the avatar URL (a failure there is not fatal), writes the SQLite copy. Unreachable → the copy, which D14 guarantees is the signed-in user's. The repository checks `copy.id === userId` only when the session is readable; with `userId === null` (an offline start) the copy is used unchecked (`supabase-profile-repository.ts:136-139`).
  - `createProfile(input)`:
    1. Zod first (`ProfileSetupInputSchema`, `src/schemas/profile.ts:54`);
    2. `prepareAvatar` (≤ 512 px, JPEG 0.8, no EXIF) and an upload to `avatars/<userId>/<avatarId>.jpg` (`upsert: false`);
    3. insert `id, username, interests, avatar_id`.
    - A `23505` on `profiles_username_key` → `UsernameTakenError`, and the uploaded file is removed.
    - An unreachable insert, or a 5xx, keeps the file, because the row may exist.
    - A pkey conflict returns the stored profile if the read finds a row; otherwise the uploaded file is removed and an error is thrown (`supabase-profile-repository.ts:234-241`).

- **Screen** (`ProfileSetupScreen`, route `src/app/onboarding.tsx`), title "Create your profile":
  - The form is prefilled from the account. A typed nick and a photo picked from the gallery always win over the prefill.
  - The nick is forced to lowercase. "Save and start" stays disabled until `ProfileSetupInputSchema` accepts the input, and while offline.
  - A taken nick → a field error and focus on the nick. Any other failure → the announced message `auth.profile.saveError` and a `profile-save-error` line.
  - A photo that arrives late (after the user already typed) never overwrites the user's choice.
  - Labels: "Username", "Your interests".
