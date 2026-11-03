# Feature flows

One file per feature that exists in the app today. Each says where the user enters it and how data moves (hooks → repository → Supabase / SQLite). Concrete history of each feature is in `prompts/<feature-name>/plan.md`.

| Feature | File | Needs internet |
|---|---|---|
| Server-first pattern (how screens read and write) | [server-first.md](server-first.md) | reads: no (copies) |
| Sign-in, sign-out, gate | [auth-and-gate.md](auth-and-gate.md) | yes |
| Profile setup | [profile-setup.md](profile-setup.md) | yes |
| Profile screen and travel stats | [profile-screen.md](profile-screen.md) | no |
| Create a trip (wizard, cover) | [trip-create.md](trip-create.md) | yes |
| Friend invite (friend code) | [friend-invite.md](friend-invite.md) | yes |
| Home screen, trip list, side panel | [trip-home.md](trip-home.md) | no (copies) |
| Edit and delete a trip | [trip-edit.md](trip-edit.md) | yes |
| Trip budget | [trip-budget.md](trip-budget.md) | no (offline write) |
| Trip photos | [trip-photos.md](trip-photos.md) | add/delete: yes |
| Pill navigation, confirm dialog | [pill-navigation.md](pill-navigation.md) | no |
| Startup, splash, loading screen | [startup-and-splash.md](startup-and-splash.md) | no |
| Offline expenses (rules, not built) | [offline.md](offline.md) | — |
| AI day plan (rules, not built) | [ai-day-plan.md](ai-day-plan.md) | — |

Placeholder tabs „Wydatki”, „Miejsca”, „Plan” have no flow yet.
