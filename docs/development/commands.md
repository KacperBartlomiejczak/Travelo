# Commands and tooling

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios` or `npx expo run:android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Project tooling

| Area | Setup |
|---|---|
| Runtime | Expo SDK 58, React Native 0.88 (Strict TypeScript API), React 19.3, New Architecture, React Compiler and typed routes enabled in `app.json` |
| Language | TypeScript 6 strict; `types: ["jest"]` (TS 6 no longer includes `@types/*` automatically); aliases `@/*` → `src/*`, `@/assets/*` → `assets/*` |
| Package manager | **pnpm** (`pnpm-lock.yaml`, `.npmrc` with `node-linker=hoisted`). Add dependencies with `npx expo install` (it detects pnpm); where it cannot reach the Expo API, `pnpm add <pkg>@<version from node_modules/expo/bundledNativeModules.json>`. |
| Lint | `pnpm lint` (`expo lint`) |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) |
| Tests | `pnpm test` (Jest); `pnpm test:db` (SQL tests, needs `DB_URL`) |
| Supabase | `pnpm supabase …` (CLI, devDependency); `pnpm db:types` (types from local Supabase) |
| Web preview | `.claude/launch.json` → `expo-web` (Expo web on :8081) |
| Native projects | `ios/` and `android/` are generated (Continuous Native Generation) and git-ignored |

### Dependencies in use
`expo-router` (incl. `expo-router/drawer`, on `react-native-drawer-layout` + `react-native-gesture-handler` + `react-native-reanimated` / `react-native-worklets`, already installed), `expo-font`, `expo-splash-screen`, `expo-localization`, `i18next`, `react-i18next`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/fraunces`, `lucide-react-native`, `react-native-svg`, `react-native-safe-area-context`, `zod`, `@tanstack/react-query`, `@expo/ui` (date/time pickers), `expo-crypto` (UUIDs), `expo-image-picker` (cover photo and trip photos from the gallery), `expo-image` (cover preview, trip hero, side panel thumbnails, trip photos and their disk cache), `expo-status-bar` (light bar over the hero), `@supabase/supabase-js` (trips, auth), `expo-sqlite` (auth session `localStorage`, and the database for budget changes, trip copies and the chosen trip), `expo-network` (offline detection, reconnect), `react-native-url-polyfill` (Supabase on React Native), `expo-image-manipulator` (downscale and re-encode trip photos without EXIF), `expo-file-system` (read the photo bytes for upload), `expo-web-browser` (the OAuth browser session), `expo-linking` (the OAuth redirect URL), `lottie-react-native` 7.5 (the animated splash). Dev: `supabase` (CLI), `@types/node` (tests: `fs`, `node:sqlite`).

### Dependencies installed for planned features (not used by any code yet)

| Package | Intended use |
|---|---|
| `expo-asset` | Was used only for the example trip photos (removed in trips-supabase); no code imports it now — keep or remove is Kacper's call |

