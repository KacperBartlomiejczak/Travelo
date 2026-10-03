# Architecture
Last updated: 2026-10-03 · after task: trips-empty-state (home screen — empty trips state with "Create trip" button)

## Overview
Traveling is a mobile app for the person who organizes a trip for a group of friends: trip setup, members, flights and layovers, AI day plans built from real places, offline expenses, and a plan-vs-reality budget summary. The product scope and rules are defined in `CLAUDE.md`; the visual system ("Sunline") is defined in `context/design-context.md`.

**Current state: UI foundation + first screen.** The app has a theme (light/dark tokens from the design context), i18n (Polish/English), font loading, and two routes: the Trips screen at `/`, which always shows its empty state, and a placeholder `/trips/new`. There is no data layer yet: no Zod schemas, no Supabase, no TanStack Query, no SQLite. Feature plans live in `prompts/<feature-name>/plan.md`.

## Folder tree
```
traveling/
├── .agents/skills/             Real skill files (installed by the `skills` CLI)
├── .claude/
│   ├── agents/                 Subagent definitions (Explorer, Planner, Backend, Frontend, Verifier)
│   ├── skills/                 Symlinks to ../.agents/skills/* so Claude Code finds them
│   ├── launch.json             Preview config: Expo web on port 8081 (dev tooling only)
│   └── settings.json           Enables the official `expo` Claude plugin
├── .vscode/                    Editor settings + recommended Expo extension
├── assets/                     App icon, Android adaptive icon, splash, favicon, template images
├── context/design-context.md   Design system — single source of truth for visuals
├── prompts/
│   └── trips-empty-state/plan.md   Plan + progress log of the first feature
├── src/
│   ├── app/                    Expo Router routes ONLY (every file here becomes a screen)
│   │   ├── _layout.tsx         Root Stack: fonts, splash screen, i18n init
│   │   ├── index.tsx           `/` — Trips screen (empty state)
│   │   └── trips/new.tsx       `/trips/new` — placeholder "New trip" screen
│   ├── components/             Shared UI components (+ `__tests__/`)
│   ├── i18n/                   i18next setup and pl/en dictionaries (+ `__tests__/`)
│   ├── theme/                  Design tokens, light/dark themes, `useTheme` (+ `__tests__/`)
│   └── __tests__/app/          Route tests, mirroring `src/app/` (kept outside `app/`)
├── .npmrc                      pnpm: `node-linker=hoisted`
├── AGENTS.md                   Expo-specific rules for coding agents
├── Architecture.md             This file
├── CLAUDE.md                   Project rules
├── app.json                    Expo config (plugins: expo-router, expo-splash-screen, expo-sqlite, expo-localization)
├── eslint.config.js            ESLint flat config (eslint-config-expo)
├── package.json                Dependencies, scripts, Jest config
├── pnpm-lock.yaml              pnpm lockfile
└── tsconfig.json               TypeScript strict, `@/*` → `src/*`, `types: ["jest"]`
```

### Folders named in `CLAUDE.md` that do not exist yet
`CLAUDE.md` describes a monorepo layout. The Expo app still sits at the repository root.

| Planned path | Planned purpose | Current equivalent |
|---|---|---|
| `apps/mobile/` | Expo app | repository root (`src/`) |
| `packages/schemas/` | Zod schemas | none |
| `supabase/migrations/` | SQL migrations | none |
| `supabase/functions/` | Edge Functions | none |

## Modules
| Module | Path | Responsibility | Depends on |
|---|---|---|---|
| Routes | `src/app/` | Root Stack layout and screens | `expo-router`, components, theme, i18n |
| Theme | `src/theme/` | Primitive tokens (`tokens.ts`), type scale (`typography.ts`), semantic `lightTheme` / `darkTheme` and `Theme` type (`theme.ts`), `useTheme()` hook | `react-native` (`useColorScheme`) |
| i18n | `src/i18n/` | One i18next instance with `pl` / `en` resources; language picked from the device | `i18next`, `react-i18next`, `expo-localization` |
| Components | `src/components/` | `PrimaryButton`, `TripsEmptyIllustration` | theme, `lucide-react-native`, `react-native-svg` |

## Data model
None in code. The conceptual model is described in `CLAUDE.md` → "Data structures". There are no Zod schemas, no server tables and no local SQLite tables.

## Data flow
- Server-first: not implemented. The Trips screen has no data source and always renders its empty state.
- Offline expenses: not implemented.
- AI day plan: not implemented.

## Backend
- Tables & RLS policies: none. No Supabase project is configured in the repo.
- Edge Functions: none.

## Frontend
### Screens & routes
| Route | File | What it shows |
|---|---|---|
| (root) | `src/app/_layout.tsx` | Stack navigator. Keeps the splash screen until DM Sans (400/500/600/700) and Fraunces (500/600/700) are loaded; on a font error it renders with system fonts. Imports `@/i18n`. Header hidden on `index`. |
| `/` | `src/app/index.tsx` | Trips screen, empty state: title "Twoje podróże" (Heading 1, `header` role), suitcase illustration, heading + description, one full-width "Utwórz podróż" button at the bottom → `router.push('/trips/new')`. Safe-area aware; side padding 20dp, 16dp below 360dp width; content max width 720dp, centred. |
| `/trips/new` | `src/app/trips/new.tsx` | Placeholder: native Stack header titled "Nowa podróż", back button labelled "Twoje podróże"; header and body use theme tokens. |

### Shared components / hooks
- `PrimaryButton` (`src/components/PrimaryButton.tsx`) — design-context §10.1: min height 52dp (grows with Dynamic Type), 16dp horizontal padding, 12dp radius; states default / pressed / focused (2dp brand ring, 4dp offset) / disabled / loading (spinner, `busy`); optional leading lucide icon (20dp, stroke 2, hidden from screen readers).
- `TripsEmptyIllustration` (`src/components/TripsEmptyIllustration.tsx`) — 160×160 SVG suitcase with a luggage tag in theme colours (brand body, `text.primary` outline, `category.transport` tag), wrapped in a `View` with `aria-hidden` so it is hidden from screen readers on iOS, Android and web.
- `useTheme()` (`src/theme/useTheme.ts`) — returns `darkTheme` when the system colour scheme is `dark`, otherwise `lightTheme`.

### Theme & i18n
- **Tokens** live in `src/theme/tokens.ts` (palette, dark roles, semantic/budget/category colours, spacing, radius, size, breakpoints) and `src/theme/typography.ts` (type scale; font weight is encoded in the `@expo-google-fonts` family name). Components consume semantic tokens from `theme.ts` (`colors.background`, `colors.text.*`, `colors.action.*`, …), never raw palette values.
- **i18n**: `src/i18n/index.ts` creates its own i18next instance (`createInstance()` + `initReactI18next`, synchronous init). Language = the device's first preferred locale if it is `pl` or `en`, otherwise `en`. It is read once at startup. Dictionaries: `src/i18n/locales/pl.json`, `en.json` (same keys, checked by a test).

## Testing
- Jest (`jest-expo` preset) + React Native Testing Library 14 (async `render` / `fireEvent`); route tests use `renderRouter` from `expo-router/testing-library` with the real root layout.
- Test files never live under `src/app/` (Expo Router would turn them into routes); route tests sit in `src/__tests__/app/`.
- `package.json` → `jest.moduleNameMapper` maps `lucide-react-native` to its CommonJS build, because its React Native entry is `.mjs`, which jest-expo does not transform.
- `useColorScheme` / `useWindowDimensions` are mocked at `react-native/Libraries/Utilities/*` (RN imports them internally, so spying on `Appearance` / `Dimensions` does not work).
- Jest mocks RN `View` as a pass-through, so `aria-*` → native accessibility prop conversion is not observable in tests.
- Current suite: 6 suites, 40 tests.

## Tooling
| Area | Setup |
|---|---|
| Runtime | Expo SDK 57, React Native 0.86, React 19.2, New Architecture, React Compiler and typed routes enabled in `app.json` |
| Language | TypeScript 6 strict; `types: ["jest"]` (TS 6 no longer includes `@types/*` automatically); aliases `@/*` → `src/*`, `@/assets/*` → `assets/*` |
| Package manager | **pnpm** (`pnpm-lock.yaml`, `.npmrc` with `node-linker=hoisted`). Add dependencies with `npx expo install` (it detects pnpm). |
| Lint | `pnpm lint` (`expo lint`) |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) |
| Tests | `pnpm test` (Jest) |
| Web preview | `.claude/launch.json` → `expo-web` (Expo web on :8081) |
| Native projects | `ios/` and `android/` are generated (Continuous Native Generation) and git-ignored |

### Dependencies in use
`expo-router`, `expo-font`, `expo-splash-screen`, `expo-localization`, `i18next`, `react-i18next`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/fraunces`, `lucide-react-native`, `react-native-svg`, `react-native-safe-area-context`.

### Dependencies installed for planned features (not used by any code yet)
| Package | Intended use |
|---|---|
| `zod` | Schemas as the single source of truth |
| `@tanstack/react-query` | Server state |
| `expo-sqlite` | Offline expenses and sync outbox |
| `@supabase/supabase-js` | Supabase client |

## Claude Code configuration
### Subagents (`.claude/agents/`)
| Agent | Model | Tools | Role |
|---|---|---|---|
| `explorer` | haiku | Read, Grep, Glob | Read-only scout: finds code, schemas and patterns |
| `planner` | opus | Read, Grep, Glob | Read-only: drafts a plan in the plan template format |
| `backend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one backend step test-first (schemas, migrations, RLS, Edge Functions) |
| `frontend` | sonnet | Read, Edit, Write, Grep, Glob, Bash | Executes one frontend step test-first, following the design context |
| `verifier` | opus | Read, Grep, Glob, Bash | Independent PASS/FAIL review of a finished step; never fixes |

### Skills (`.claude/skills/`)
| Skill | Source | Purpose |
|---|---|---|
| `domain-modeling` | mattpocock/skills | Sharpen domain terms; write `GLOSSARY.md` and ADRs |
| `grill-me` | mattpocock/skills | Interview the user to sharpen a plan (user-invoked only) |
| `improve-codebase-architecture` | mattpocock/skills | Find refactoring opportunities and report them (user-invoked only) |
| `frontend-design` | anthropics/skills | Guidance for building distinctive UI |
| `ui-taste` | uizze.sh | UI polish and review playbooks for web and iOS |
| `find-skills` | vercel-labs/skills | Discover and install further skills |

## External services
| Service | Used for | Called from | Secrets |
|---|---|---|---|
| — | none integrated yet | — | — |

## Key decisions
- 2026-10-03 — Plans live in `prompts/<feature-name>/plan.md`, one folder per feature — Kacper's rule, added to `CLAUDE.md`.
- 2026-10-03 — Package manager switched from npm to pnpm (`node-linker=hoisted`) — npm was too slow (D6 in `prompts/trips-empty-state/plan.md`).
- 2026-10-03 — i18n with `i18next` + `react-i18next` + `expo-localization`; unsupported device languages fall back to English (D4, D5).
- 2026-10-03 — Trips screen is UI-only for now; loading / error / offline states arrive with the data task (D1).
- 2026-10-03 — Design-context gaps decided by Kacper: back button label (D7), native header style (D8), dark disabled button colours (D9), focus ring offset (D10), screen spacing (D11), empty-state illustration (D12) — see `prompts/trips-empty-state/plan.md`.

## Known limitations & tech debt
- `CLAUDE.md` and the agent definitions assume a monorepo (`apps/mobile`, `packages/schemas`, `supabase/`); the app is a single package at the repo root.
- `.claude/agents/Planner.md`, `Frontend.md` and `Backend.md` still mention a root `PLAN.md`; plans now live in `prompts/<feature-name>/plan.md` (awaiting Kacper's decision whether to update them).
- Trips screen has no `ScrollView`; at very large Dynamic Type on a small phone the content may not fit (manual check pending).
- Language is read once at startup; on Android a system-language change may only apply after an app restart.
- Peer-range warnings: `lucide-react-native@1.50` declares `react-native ^0.87.1` (project has 0.86.3); `test-renderer` (RNTL 14) wants `react ^19.3.0` (project has 19.2.3). Both work in tests; device check pending.
- `pnpm install` skipped the `unrs-resolver` build script (pnpm build-script approval); lint works without it.
- `package.json` has a `reset-project` script pointing at `scripts/reset-project.js`, which does not exist.
- `README.md` is the unmodified Expo template (mentions npm).
- Template images in `assets/images/` (React/Expo logos, `tabIcons/`, `tutorial-web.png`) are not referenced by any code.
- The project folder is on the iCloud-synced Desktop, so `node_modules` is synced too and installs can stall.

## Changelog
- 2026-10-03 — Initial workspace audit and dependency setup — first version of this document; added runtime dependencies, ESLint, Jest and the `typecheck`/`test` scripts.
- 2026-10-03 — trips-empty-state — switched to pnpm; added theme tokens + `useTheme`, i18n (pl/en), font loading in the root layout, `PrimaryButton`, `TripsEmptyIllustration`, the Trips empty screen at `/` and the placeholder `/trips/new`; first test suite (40 tests); route tests live in `src/__tests__/app/`.
