# Pill navigation and confirm dialog

Entry: every screen inside the `(drawer)/(tabs)` group.

The home screen is the first of four screens in a `(tabs)` group inside the drawer (`src/features/nav/tabs.ts`, `src/app/(drawer)/(tabs)/_layout.tsx`), switched by a floating **pill** at the bottom (`PillNav`, an elevated surface with a `brand.primary` indicator, so it is not white in dark mode). The selected tab is a coral capsule with icon + label that slides to the tapped tab, the others are round icon buttons: "Trip" (the current trip), "Expenses", "Plan", "Profile" (`CircleUser` icon). Tapping the active tab does nothing, `tabPress` can be prevented, and tabs are created lazily and stay mounted when blurred.

- **"Plan"** with a current trip shows a "Plan" / "Discover" segmented control (its mode is local and always starts on "Plan"; see [ai-trip-plan.md](ai-trip-plan.md) and [discover-places.md](discover-places.md)). Without a current trip (also while trips load, and on a trips error) it is a placeholder: `EmptyScreen` with the title "Plan" and the message "This screen is coming soon." (`nav.comingSoon`).
- **"Profile"** is the user's profile: the title "Profile" with a gear to Settings, the round photo and the nick (with the PRO badge), the `FriendCode`, a "Your travels" card with five numbers of the past trips (trips, countries, days travelled, flights, km flown) counted on the phone from the trip list, so they show offline too, and the "Past trips" list. Details: [profile-screen.md](profile-screen.md).

The pill overlays the screens, so they leave room for it (`usePillClearance`). The side panel opens from "Trip" and from "Expenses". The pill is not shown in the wizard or the photo viewer.

Leaving the create-trip wizard with entered data asks through the in-app `ConfirmDialog` ("Discard entered data?", "The trip will not be saved.", buttons "Discard" and "Stay"; `src/app/trips/new/_layout.tsx`), not a system alert.

Plan and decisions: `prompts/pill-nav-and-dialog/plan.md`; the four-tab capsule look: `prompts/places-legal-navbar/plan.md` (D3–D8).
