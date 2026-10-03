# Architecture
Last updated: 2026-10-03 · after task: initial workspace audit and dependency setup

## Overview
Traveling is a mobile app for the person who organizes a trip for a group of friends: trip setup, members, flights and layovers, AI day plans built from real places, offline expenses, and a plan-vs-reality budget summary. The product scope and rules are defined in `CLAUDE.md`; the visual system ("Sunline") is defined in `context/design-context.md`.

**Current state: fresh Expo scaffold.** The repo contains the default `create-expo-app` template (one screen), the project rules, the design context, the agent and skill configuration, and the installed dependencies. No feature, schema, backend, theme, i18n or test exists yet. This file describes what is in the repo now; planned work belongs in `PLAN.md` (not created yet).

## Folder tree
```
traveling/
├── .agents/
│   └── skills/                 Real skill files (installed by the `skills` CLI)
│       ├── domain-modeling/
│       ├── find-skills/
│       ├── frontend-design/
│       ├── grill-me/
│       ├── improve-codebase-architecture/
│       └── ui-taste/
├── .claude/
│   ├── agents/                 Subagent definitions (Explorer, Planner, Backend, Frontend, Verifier)
│   ├── skills/                 Symlinks to ../.agents/skills/* so Claude Code finds them
│   └── settings.json           Enables the official `expo` Claude plugin
├── .vscode/                    Editor settings + recommended Expo extension
├── assets/
│   ├── expo.icon/              iOS app icon (Icon Composer format)
│   └── images/                 App icon, Android adaptive icon, splash, favicon, template images
│       └── tabIcons/           Template tab icons (unused by current code)
├── context/
│   └── design-context.md       Design system — single source of truth for visuals
├── src/
│   └── app/                    Expo Router routes (every file here is a screen)
│       ├── _layout.tsx         Root layout — a single Stack navigator
│       └── index.tsx           Home route — template placeholder screen
├── node_modules/               Installed dependencies (git-ignored)
├── AGENTS.md                   Expo-specific rules for coding agents (docs, commands, routing, EAS)
├── Architecture.md             This file
├── CLAUDE.md                   Project rules: product scope, TDD, Zod, agents, skills, verification loop
├── LICENSE
├── README.md                   Default Expo README
├── app.json                    Expo app config (name, icons, splash, plugins, experiments)
├── eslint.config.js            ESLint flat config (eslint-config-expo)
├── package.json                Dependencies, scripts, Jest preset
├── package-lock.json           npm lockfile
├── skills-lock.json            Sources and hashes of the installed skills
└── tsconfig.json               TypeScript config (strict, `@/*` → `src/*`)
```

### What each folder is for
| Folder | Purpose |
|---|---|
| `src/app/` | Routes only. Expo Router turns each file into a screen and each `_layout.tsx` into a navigator. Components, hooks and utilities must live outside it. |
| `assets/` | Static files bundled with the app: icons, splash, images. Referenced from `app.json` and importable through the `@/assets/*` alias. |
| `context/` | Reference documents that agents read before working. Currently only the design system. |
| `.claude/agents/` | Subagent definitions used by the orchestrator (see "Claude Code configuration"). |
| `.claude/skills/` | Entry point Claude Code scans for project skills. Contains only symlinks. |
| `.agents/skills/` | Where the skill content actually lives, shared by any agent tool that follows the `.agents` convention. |
| `.vscode/` | Format/organize-imports on save and the Expo Tools extension recommendation. |

### Folders named in `CLAUDE.md` that do not exist yet
`CLAUDE.md` describes a monorepo layout. None of it has been created; the Expo app currently sits at the repository root.

| Planned path | Planned purpose | Current equivalent |
|---|---|---|
| `apps/mobile/` | Expo app | repository root (`src/app/`) |
| `packages/schemas/` | Zod schemas | none |
| `supabase/migrations/` | SQL migrations | none |
| `supabase/functions/` | Edge Functions | none |
| `PLAN.md` | Live plan | none |

## Modules
| Module | Path | Responsibility | Depends on |
|---|---|---|---|
| Routes | `src/app/` | Root Stack layout and one placeholder screen | `expo-router`, `react-native` |

## Data model
None in code. The conceptual model is described in `CLAUDE.md` → "Data structures". There are no Zod schemas, no server tables and no local SQLite tables.

## Data flow
- Server-first: not implemented.
- Offline expenses: not implemented.
- AI day plan: not implemented.

## Backend
- Tables & RLS policies: none. No Supabase project is configured in the repo.
- Edge Functions: none.

## Frontend
- Screens & routes: `/` → `src/app/index.tsx` (template placeholder), wrapped by the Stack in `src/app/_layout.tsx`.
- Shared components / hooks: none.
- Theme & i18n: none. Tokens are specified in `context/design-context.md` but no theme file exists; no i18n library is installed.

## Tooling
| Area | Setup |
|---|---|
| Runtime | Expo SDK 57, React Native 0.86, React 19.2, New Architecture, React Compiler and typed routes enabled in `app.json` |
| Language | TypeScript strict, path aliases `@/*` → `src/*`, `@/assets/*` → `assets/*` |
| Package manager | npm (`package-lock.json`) |
| Lint | ESLint with `eslint-config-expo` — `npm run lint` |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) |
| Tests | Jest with the `jest-expo` preset and React Native Testing Library — `npm test`. No test files yet. |
| Native projects | `ios/` and `android/` are generated (Continuous Native Generation) and git-ignored |

### Dependencies installed for planned features (not used by any code yet)
| Package | Intended use |
|---|---|
| `zod` | Schemas as the single source of truth |
| `@tanstack/react-query` | Server state |
| `expo-sqlite` | Offline expenses and sync outbox |
| `@supabase/supabase-js` | Supabase client |
| `lucide-react-native`, `react-native-svg` | Icons (design context §7) |
| `@expo-google-fonts/dm-sans`, `@expo-google-fonts/fraunces` | Typography (design context §4.1) |

## Claude Code configuration
### Subagents (`.claude/agents/`)
| Agent | Model | Tools | Role |
|---|---|---|---|
| `explorer` | haiku | Read, Grep, Glob | Read-only scout: finds code, schemas and patterns |
| `planner` | opus | Read, Grep, Glob | Read-only: drafts a plan in the `PLAN.md` format |
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
- 2026-10-03 — Dependencies installed with npm via `npx expo install` — the repo has an npm lockfile and `AGENTS.md` requires `expo install`; `CLAUDE.md` still names `pnpm`.

## Known limitations & tech debt
- `CLAUDE.md` and the agent definitions assume a monorepo (`apps/mobile`, `packages/schemas`, `supabase/`) and `pnpm` commands; the repo is a single npm package at the root.
- `package.json` has a `reset-project` script pointing at `scripts/reset-project.js`, which does not exist.
- `package-lock.json` still lists `jest`, `jest-expo`, `@types/jest` and `eslint-config-expo` under `dependencies`; `package.json` has them under `devDependencies`. Running `npm install` once re-syncs the lockfile.
- The project folder is on the iCloud-synced Desktop, so `node_modules` is synced too and npm commands can stall.
- `README.md` is the unmodified Expo template.
- Template images in `assets/images/` (React/Expo logos, `tabIcons/`, `tutorial-web.png`) are not referenced by any code.
- No commits yet; all files are untracked.

## Changelog
- 2026-10-03 — Initial workspace audit and dependency setup — first version of this document; added runtime dependencies, ESLint, Jest and the `typecheck`/`test` scripts.
