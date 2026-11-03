# Profile screen and travel stats

Entry: tab „Profil” and the gear to Settings (sign-out). Stats are counted on the phone from the trip list, so they work offline.

`ProfileScreen`: header „Profil” + gear (`IconButton` → `/settings`), the photo + nick row, `TravelStatsCard`, the offline banner above the pill; refetches the own profile on offline → online (D18). `ProfilePhoto` (inside it): 96dp circle, not tappable; no `avatarId` → person placeholder; with one → `profile-photo-skeleton` (`SkeletonBlock`) until the `Image` has loaded, then the skeleton fades over `duration.small` (D22, none with reduced motion); a failed url is retried once per offline → online change; a photo already shown stays when a later url fails or a read has none (D21, D23). `TravelStatsCard`: `Card` „Twoje podróże”, 2-column grid (one column above `fontScale` 1.3), lucide icons, numbers by `Intl.NumberFormat`, one screen-reader element per stat; loading → five `SkeletonBlock`s, failed with no copy → „–”. `SettingsScreen`: „Wyloguj się” (`TextButton` destructive, at the bottom), disabled offline with „Połącz się z internetem, żeby się wylogować.”; `ConfirmDialog` „Wylogować się?” whose message adds the unsent-budget warning when `hasUnsentChanges()` is true or fails 

Plan and decisions: `prompts/profile-screen/plan.md`.
