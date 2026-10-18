# Task: Profile tab (rename „Ustawienia”)
Status: done — 2026-10-18

## Understanding & assumptions
The fifth pill-nav screen „Ustawienia” becomes the user's profile (Kacper, 2026-10-18). Only the name, the route and the icon change. The screen stays an empty placeholder („Ten ekran pojawi się wkrótce.”), because what a profile shows is not decided.

Done when: the pill shows „Profil” / „Profile” with a person icon, the screen's title is „Profil użytkownika” / „User profile”, the route is `/profile`, `/settings` no longer exists, and the full suite, typecheck and lint are green.

## Decisions (Kacper, 2026-10-18)
- **D1 — Label:** „Profil” in the pill, because „Profil użytkownika” does not fit next to four other items. The screen's title is „Profil użytkownika”.
- **D2 — Icon:** a person icon instead of the gear.

## Approach
Rename the route file `settings.tsx` → `profile.tsx`, the tab key `settings` → `profile`, and the i18n key `nav.settings` → `nav.profile`. Add `nav.profileTitle` for the screen's title. The icon becomes lucide `CircleUser`, which is already installed. The rest of the pill nav stays the same.
*Rejected:* keeping the route `settings` and only changing the label. Then the code would name the screen differently from what the user sees.

## Data structures (Zod)
None. No data changes.

## Tests
Written first and seen failing:
- `src/features/nav/__tests__/tabs.test.ts`: the fifth tab is `['profile', 'nav.profile', CircleUser]`.
- `src/__tests__/app/tabs.test.tsx`:
  - PL label „Profil”, EN „Profile”;
  - path `/profile`;
  - the empty screen's title is „Profil użytkownika” / „User profile”;
  - `/settings` is not a route.
- `src/__tests__/app/drawer-swipe.test.tsx`: the edge swipe is off on `/profile`.
- `src/components/__tests__/PillNav.test.tsx`: key `profile`.

## Files
- Renamed: `src/app/(drawer)/(tabs)/settings.tsx` → `profile.tsx`.
- Modified: `src/features/nav/tabs.ts`, `src/i18n/locales/pl.json`, `src/i18n/locales/en.json`, the four tests above, `Architecture.md` (pill nav description, route tree).

## Skills
- test-driven-development — step 1 — the red → green loop.

## Steps
- [x] 1. [frontend] Rename the tab to profile (route, key, i18n, icon). Skill: test-driven-development. Tests first: the list above. Verify: red → green, full suite, typecheck, lint; verifier.
- [x] 2. [tester] On a device: the pill shows „Profil” with the person icon, tapping it opens „Profil użytkownika”. Skill: none.

## Progress log
- Step 1 (2026-10-18): tests written (red ✓: tabs.test.ts and PillNav failed on `settings`/old labels; tabs.test.tsx and drawer-swipe.test.tsx failed to run because `(tabs)/profile` did not exist) · `settings.tsx` → `profile.tsx` (git mv, `ProfileScreen`, title `nav.profileTitle`), `tabs.ts` (`profile`, `nav.profile`, `CircleUser`), pl/en: `nav.settings` removed, `nav.profile` + `nav.profileTitle` added; `(tabs)/_layout.tsx` unchanged · green ✓ 86 suites / 1371 tests, typecheck 0, lint clean · verifier PASS · skill used: test-driven-development · deviations: new test "no /settings route" only exercises the test's own route map (it could not be red before the rename); the real guard is that `settings.tsx` is gone. Step 2 (device) runs together with trip-covers step 6, on one dev build.

- Step 2 (2026-10-18, `tester`, Android emulator, Expo Go): PASS — the fifth item reads „Profil” with a person icon and is selected, the screen shows „Profil użytkownika” and „Ten ekran pojawi się wkrótce.”, a swipe from 70 px on `/profile` does not open the side panel (the same swipe on `/` does), „Podróż” goes back. Architecture.md updated.

## Risks & open questions
- At large Dynamic Type the pill shows only icons (pill-nav R1), so the icon alone has to read as „profile”. `CircleUser` does.
