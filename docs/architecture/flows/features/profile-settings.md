# Settings, edit profile, avatar, delete account

Entry: the gear on the „Profil” tab (`/settings`) and the profile photo (`/avatar`, or the gallery when there is no photo). Screens: `/settings`, `/edit-profile`, `/avatar` in [frontend.md](../../frontend.md).

- **Theme and language:** `usePreferences` reads and writes `preferences` (`src/data/preferences.ts`, `expo-sqlite/kv-store`, a separate database that `clearUserData` does not touch), so both stay on the phone after sign-out (D8). They are applied at startup: the theme through `Appearance.setColorScheme` (`applyThemePreference`), and the language through `resolveLanguage`. Works offline.
- **Edit profile:** `useUpdateProfile` → `ProfileRepository.updateProfile` (Supabase, then the profile copy in SQLite). Input is `ProfileEditInputSchema`. A taken nick returns `UsernameTakenError`. Server-first: saving is disabled offline, and the offline banner there says editing needs internet (`settings.editProfileOffline` via `AuthFormScreen`'s `offlineText`, D21) instead of the default „changes will be saved” text.
- **Avatar:** `usePickAvatar` (gallery, square crop) → `useChangeAvatar` / `useRemoveAvatar` → `ProfileRepository.changeAvatar` / `removeAvatar` (private `avatars` bucket). Server-first.
- **Sign out:** `SettingsScreen` → `ConfirmDialog`, with a warning when budget changes have not been sent yet → `Session.signOut`. Disabled offline.
- **Delete account:** `DeleteAccountDialog` (the own nick must match) → `useDeleteAccount` → `ProfileRepository.deleteAccount` → Edge Function `delete-account` (see [backend.md](../../backend.md)). The function removes the owned trips' photos, then the avatar, then the auth user; the database cascades the rest. A linked friend's member row and expenses stay (D11). After success, `Session.signOutAfterDelete` clears the phone (`clearUserDataOnPhone`: image caches, `Paths.cache`, SQLite) and `WelcomeScreen` shows the goodbye message while `Session.accountDeleted` is true. A wrong nick returns `UsernameMismatchError`.

Plan and decisions: `prompts/profile-settings/plan.md`.
