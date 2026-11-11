# Feature flows

Feature flows live in [`features/`](features/), one file per feature that exists in the app today; this folder keeps the cross-cutting ones (server-first pattern, offline rules, AI rules). Each says where the user enters it and how data moves (hooks → repository → Supabase / SQLite). Concrete history of each feature is in `prompts/<feature-name>/plan.md`.

| Feature | File | Needs internet |
|---|---|---|
| Server-first pattern (how screens read and write) | [server-first.md](server-first.md) | reads: no (copies) |
| Sign-in, sign-out, gate | [auth-and-gate.md](features/auth-and-gate.md) | yes |
| Profile setup | [profile-setup.md](features/profile-setup.md) | yes |
| Profile screen and travel stats | [profile-screen.md](features/profile-screen.md) | no |
| Settings, edit profile, avatar, delete account | [profile-settings.md](features/profile-settings.md) | edits and delete: yes |
| Create a trip (wizard, cover) | [trip-create.md](features/trip-create.md) | yes |
| Friend invite (friend code) | [friend-invite.md](features/friend-invite.md) | yes |
| Home screen, trip list, side panel | [trip-home.md](features/trip-home.md) | no (copies) |
| Edit and delete a trip | [trip-edit.md](features/trip-edit.md) | yes |
| Trip budget | [trip-budget.md](features/trip-budget.md) | no (offline write) |
| Trip photos | [trip-photos.md](features/trip-photos.md) | add/delete: yes |
| Pill navigation, confirm dialog | [pill-navigation.md](features/pill-navigation.md) | no |
| Startup, splash, loading screen | [startup-and-splash.md](features/startup-and-splash.md) | no |
| Expenses | [expenses.md](features/expenses.md) | no (offline write) |
| Discover places (Google Places + Gemini) | [discover-places.md](features/discover-places.md) | yes |
| Offline rules | [offline.md](offline.md) | — |
| AI day plan (rules, not built) | [ai-day-plan.md](ai-day-plan.md) | — |

The placeholder tab „Plan” has no flow yet; „Miejsca” was removed (places-legal-navbar D3).
