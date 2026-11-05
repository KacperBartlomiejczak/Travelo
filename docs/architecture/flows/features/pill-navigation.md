# Pill navigation and confirm dialog

Entry: every screen inside the `(drawer)/(tabs)` group.

the home screen is the first of four screens in a `(tabs)` group inside the drawer, switched by a floating white **pill** at the bottom: the selected tab is a coral capsule with icon + label that slides to the tapped tab, the others are round icon buttons — „Podróż” (the current trip), „Wydatki”, „Plan”, „Profil” (`CircleUser` icon). „Plan” is an empty placeholder (a title and „Ten ekran pojawi się wkrótce.”). „Profil” is the user's profile: the title „Profil” with a gear to Settings, the round photo (a pulsing skeleton until it is shown; a person placeholder without a photo) and the nick, then a „Twoje podróże” card with five numbers of the past trips — trips, countries, days travelled, flights, km flown — counted on the phone from the trip list, so they show offline too. The pill overlays the screens, so the home screen leaves room for it (`usePillClearance`). The side panel opens only on „Podróż”. The pill is not shown in the wizard or the photo viewer.

leaving the create-trip wizard with entered data asks through the in-app `ConfirmDialog` („Odrzucić wpisane dane?”), not a system alert.

Plan and decisions: `prompts/pill-nav-and-dialog/plan.md`; the four-tab capsule look: `prompts/places-legal-navbar/plan.md` (D3–D8).
