# Task: App icon and splash from the new Travelo logo
Status: awaiting approval

## Understanding & assumptions
The app still uses the Expo template icon, adaptive icon, splash and favicon (blue `#E6F4FE` / `#208AEF`, the Expo symbol in `assets/expo.icon`). Kacper approved logo direction B "t-podróżnik" (2026-10-22). The finished logo kit is in `design/logo/kit/` (guidelines in `design/logo/kit/README.md`). This task swaps the app's icons and splash for the new logo.

"Done" means:
- `app.json` points only at files that exist;
- every icon has the size its platform needs;
- the icon and splash background colours are Sunline tokens;
- the old Expo template icon files used by the config are replaced or removed;
- the full suite, typecheck and lint are green.

Assumptions:
- A1. Light icon: paper `#F8F4EC` (`neutral.100`) ground, ink t, coral sun (`design/logo/kit/expo/icon.png`).
- A2. Android adaptive: foreground = the mark inside the 66 % safe zone, background = paper, monochrome = black mark (for Android 13+ themed icons).
- A3. Web favicon: the 48 px small cut (`design/logo/kit/expo/favicon.png`).
- A4. Only the icon and splash change. App name, `slug` and `scheme` stay as they are (`scheme` is in the OAuth redirect URLs).
- A5. The unused template images in `assets/images/` (React/Expo logos, `tabIcons/`, `tutorial-web.png`, `logo-glow.png`, `expo-badge*.png`) are pre-existing dead files. They stay unless Kacper asks (CLAUDE.md rule 3).

## Approach
Copy the finished PNGs from the logo kit into `assets/images/` under the names `app.json` already uses, so the diff is mostly binary files plus a few `app.json` values. A small Jest test reads `app.json` and guards the config: paths exist, PNG sizes are right, colours equal the tokens.

Rejected: generating icons at build time from the SVG masters. It needs a new dependency (an SVG rasterizer) for files that change once in years.

## Data structures (Zod)
None. App config is not app data, and no schema changes.

## Tests
Step 2 — `src/__tests__/app-config.test.ts`. It reads `app.json`, and checks PNG sizes from the IHDR header with `fs` (no new dependency):
- every local asset path in the config exists (`icon`, `ios.icon.*`, `android.adaptiveIcon.*`, `web.favicon`, splash `image` and `dark.image`);
- `icon` and the iOS icons are 1024×1024;
- adaptive foreground and background are equal squares ≥ 432 px, and monochrome is a square;
- favicon is 48×48;
- `android.adaptiveIcon.backgroundColor` = `colors.light.background.canvas` (`#F8F4EC`);
- splash `backgroundColor` = `colors.light.background.canvas`, and splash `dark.backgroundColor` = the dark canvas token (`#171716`), if Q2 = yes;
- the old Expo template colours `#E6F4FE` / `#208AEF` are gone.

Red: fails today on the colours (and on the missing dark splash/icon files). Green after step 2.

## Files
- Modified: `app.json` (icon, `ios.icon`, `android.adaptiveIcon`, splash plugin options).
- Replaced (binary): `assets/images/icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `splash-icon.png`, `favicon.png`.
- Added (binary): `assets/images/icon-dark.png`, `icon-tinted.png`, `splash-icon-dark.png` (depending on Q1/Q2).
- Deleted: `assets/expo.icon/` (no longer referenced after Q1 = A).
- Added test: `src/__tests__/app-config.test.ts`.
- Design kit (step 1): `design/logo/source/build_icons.py` gets the tinted iOS icon and the dark splash image; re-rendered into `design/logo/kit/expo/`.
- Docs: `Architecture.md` (`assets/` line, changelog, Known limitations).

## Skills
- `source-driven-development` — step 2 — the iOS `IOSIcons` object (light/dark/tinted) and the splash plugin's `dark` option. Already checked in the installed Expo SDK 57 types: `@expo/config-types@57.0.2` `ExpoConfig.d.ts` (`ios.icon?: string | IOSIcons`) and `expo-splash-screen` `plugin/build/types.d.ts` (`dark?: { backgroundColor, image }`).
- `test-driven-development` — step 2 — red → green for the config test.

## Steps
- [ ] 1. [design] Add the missing variants to the logo kit: the iOS tinted icon (grayscale mark on transparent, per Apple's tinted icon rules) and the dark splash image (reversed symbol). Render the PNGs. — skill: none — **tests first: none.** This is pure asset generation outside the app, with no app behavior; it is checked by looking at the rendered PNGs. — verify: renders viewed; `svg_audit.py` clean.
- [ ] 2. [frontend] Config test (red), then swap the icon files and update `app.json` (green); delete `assets/expo.icon/`. — skill: source-driven-development, test-driven-development — tests first: `app-config.test.ts` as above — verify: full suite, typecheck and lint green; `npx expo config --type public` resolves without errors and shows the new values; verifier PASS.
- [ ] 3. [manual] Device check of the icon and splash in a native build (see Q3). — skill: none — verify: tester (or Kacper) walks the manual steps below.

## Verification
- Steps 1–2: as listed per step. `npx expo config` proves the config parses, and the test proves the files and colours.
- Icons and splash are native resources. **Expo Go always shows its own icon and splash**, so only a native build can show them (Q3).
- Manual steps (step 3):
  1. Install the build. The home-screen icon shows the ink t with the coral sun on paper.
  2. Android 13+: turn on themed icons. The icon shows the monochrome t.
  3. Android: long-press the icon. The mark is not cut by the launcher mask (circle and squircle).
  4. Cold start in light mode: paper splash with the symbol. In dark mode: dark splash with the reversed symbol (if Q2 = yes).
  5. iOS (if a device is available): light, dark and tinted home-screen icons.
  6. Web (`expo start --web`): the browser tab shows the small-cut favicon.

## Progress log

## Risks & open questions
- **Q1 — iOS icon format.**
  - **A (recommended):** `ios.icon` = `{ light, dark, tinted }` PNGs. Works without a Mac, and Expo generates the sizes. iOS 26 adds the default glass effect to PNG icons.
  - **B:** the Icon Composer bundle `design/logo/kit/expo/travelo.icon` (separate glass layers for the t and the sun). It is written by hand and unchecked, and Icon Composer only runs on macOS.
- **Q2 — Splash follows the phone theme?**
  - **Recommended: yes.** Paper + symbol in light mode, `#171716` + reversed symbol in dark mode, like the rest of the app (design-context: every screen follows the phone's theme).
  - **No:** always paper.
- **Q3 — How do we check it on a phone?** There is no `eas.json`, and native folders are gitignored. Day to day the app runs in Expo Go, which never shows our icon or splash.
  - **A:** a local dev build `npx expo run:android` (needs Android Studio / SDK on this PC; the generated `android/` folder stays ignored).
  - **B:** set up EAS Build (`eas.json`, an Expo account). That is a new piece of the stack, so `stack-review` and a separate plan.
  - **C:** stop at step 2 and check the icon on the next native build, whenever that comes.
- **Q4 — App name.** The name under the icon is `"traveling"` (`expo.name`). Change it to `"Travelo"` in this task?
  - Only `name`; `slug` and `scheme` stay.
  - Recommended: yes, it is one line and the new icon says Travelo. But it is scope beyond "icons", so only with your yes.
- R1 — Coral on paper is 2.8 : 1 (just under 3 : 1 for graphics). The ink t carries recognition (≈ 15 : 1), so the icon still reads. Recorded in the logo guidelines.
- R2 — No trademark search has been done for the logo.
