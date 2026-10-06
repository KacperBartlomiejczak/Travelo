# Task: Supabase client and configuration
Status: done (approved by Kacper 2026-10-06) — Q1 still open

## Understanding & assumptions
Connect the app to the Supabase project `hwsqdlxojllclbwlhuwb` at the **client level only**: env config, a validated config, and one shared Supabase client ready for later features. No feature uses it yet — trips stay in the in-memory repository (D1).

"Done" means: `.env.local` holds the project URL and publishable key (git-ignored), the config is parsed with Zod at startup of the client module (missing/invalid env → a clear error), `src/data/supabase.ts` exports a configured client, the full suite + typecheck + lint are green, and a manual check confirms the URL and key reach the project.

Assumptions:
- **A1** — The publishable key (`sb_publishable_…`) is meant to ship in the app (it is the public client key; access is enforced by RLS later). The secret key never goes in the repo or the app.
- **A2** — Env names follow the snippet Kacper pasted: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`.
- **A3** — Expo inlines `EXPO_PUBLIC_*` only for static `process.env.NAME` access, so the client reads both variables by name and passes them to the Zod schema as an object.
- **A4** — The client lives in `src/data/` (next to the trip repository — the data-access layer), not in `src/lib/` (pure functions). The snippet's `utils/supabase.ts` path does not match our layout.
- **A5** — The snippet's `App.tsx` (todos list) is **not** added: the app uses expo-router and there is no `todos` table. It was a Supabase quickstart example.

## Decisions (Kacper, 2026-10-06)
- **D1 — Scope:** only the client and configuration. Trips stay in memory; tables, RLS and `SupabaseTripRepository` are a separate feature.
- **D2 — Auth (for the next feature):** anonymous sign-in at first launch; linking e-mail/Apple later. Not built in this task.
- **D3 — Tooling (for the next feature):** Supabase CLI + local Supabase in Docker (or OrbStack) for migrations and RLS tests, then `supabase db push` to the remote project. Not installed in this task.
- **D4 — Session storage:** `expo-sqlite/localStorage/install` (already a dependency), not AsyncStorage — no new dependency, matches the current Supabase Expo docs.

## Approach
`SupabaseConfigSchema` (Zod) validates the two env values. `src/data/supabase.ts` parses them and calls `createClient` with `auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }` after importing `expo-sqlite/localStorage/install`. Pausing token refresh on `AppState` background is left for the auth feature (no session exists yet).

Rejected: copying the snippet as-is — it needs AsyncStorage (new dependency), skips Zod at the env boundary and adds a demo screen.

## Data structures (Zod)
`src/schemas/supabase-config.ts`:
```ts
export const SupabaseConfigSchema = z.object({
  url: z.url({ protocol: /^https$/ }),   // https://<ref>.supabase.co
  key: z.string().startsWith('sb_publishable_'),
});
export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;
```
Requiring the `sb_publishable_` prefix makes it impossible to ship a secret key (`sb_secret_…`) by mistake.

No database tables, no SQLite tables.

## Tests
- **Step 1 — `src/schemas/__tests__/supabase-config.test.ts`:** accepts the real-shaped config; rejects a missing URL, a non-URL string, an `http://` URL, an empty key, a `sb_secret_…` key, an undefined key.
- **Step 2 — `src/data/__tests__/supabase.test.ts`** (`@supabase/supabase-js` `createClient` and `expo-sqlite/localStorage/install` mocked; env set per test with `jest.isolateModules`):
  - creates the client with the env URL and key and the auth options above (storage is `localStorage`, `detectSessionInUrl: false`);
  - throws an error naming the variable when `EXPO_PUBLIC_SUPABASE_URL` is missing;
  - throws when the key is a secret key.

## Files
- Create: `src/schemas/supabase-config.ts`, `src/schemas/__tests__/supabase-config.test.ts`, `src/data/supabase.ts`, `src/data/__tests__/supabase.test.ts`, `.env.example`
- Modify: `src/schemas/index.ts` (export), `Architecture.md`
- Already created (no review needed, git-ignored): `.env.local`

## Skills
- `supabase` — step 2 — check the current supabase-js client options for Expo before writing the call. (Kacper installed it; it is not yet in the `CLAUDE.md` skills table.)

## Steps
- [x] 1. [backend] `SupabaseConfigSchema` + export — skill: none — tests first: schema fixtures above — verify: red → green, full suite, typecheck, lint.
- [x] 2. [frontend] `src/data/supabase.ts` client — skill: `supabase` — tests first: client tests above — verify: red → green, full suite, typecheck, lint.
- [x] 3. Setup, no tests (pure config, no behavior): `.env.example` with both variable names and empty values; confirm `.env.local` is ignored (`git check-ignore`). — verify: manual check below.
- [x] 4. Update `Architecture.md` (Data model, Backend, External services, dependencies: `@supabase/supabase-js` moves to "in use", changelog, decisions D1–D4).

## Verification
- Every step: tests red first, then `pnpm test` (full), `pnpm typecheck`, `pnpm lint`.
- Manual (orchestrator, step 3): `curl` `GET <url>/auth/v1/settings` with the publishable key as `apikey` → HTTP 200 proves URL + key match the project. No live calls in Jest.
- Manual (Kacper): `pnpm start`, open the app — it starts without the config error.

## Risks & open questions
- **Q1 — `react-native-url-polyfill`:** the Supabase Expo docs still install it (React Native's `URL` was historically incomplete). It is a new dependency, so it needs your decision: add it now (recommended, follows the docs), or skip it and add it only if a real Supabase call fails on a device.
- **R1** — `expo-sqlite/localStorage/install` on **web** uses the browser's `localStorage`; fine for the dev preview.
- **R3 (next feature)** — Anonymous sign-ins are **disabled** in the project (`/auth/v1/settings` → `anonymous_users: false`); D2 needs them enabled in the dashboard (Authentication → Sign In / Providers).
- **R4 (next feature)** — Supabase changelog 2026-04-28: new `public` tables are no longer exposed to the Data API automatically (enforced for all projects from 2026-10-30) — migrations must `GRANT` to `authenticated` explicitly, together with RLS.
- **R2** — After changing `.env.local`, Metro must be restarted (`expo start -c`) to pick up new values.

## Progress log
- Step 1: tests written (`src/schemas/__tests__/supabase-config.test.ts`, 7 cases) · red ✓ (schema undefined) · added `src/schemas/supabase-config.ts` + export in `src/schemas/index.ts` · green ✓ · full suite 43/389, typecheck, lint ✓ · skill used: none.
- Step 2: tests written (`src/data/__tests__/supabase.test.ts`, 3 cases; `createClient` and `expo-sqlite/localStorage/install` mocked) · red ✓ (module not found) · added `src/data/supabase.ts` · green ✓ · full suite 44/392, typecheck, lint ✓ (lint warning on `require()` in `isolateModules` silenced with the same `eslint-disable-next-line` as `src/i18n/__tests__/i18n.test.ts`) · skill used: `supabase` (changelog scanned: no breaking change for client setup; Expo quickstart confirms the `expo-sqlite/localStorage/install` + `localStorage` storage options).
- Step 3: `.env.example` (names, empty values); `.env.local` ignored (`.gitignore:34`), `.env.example` tracked · manual check: `GET /auth/v1/settings` with the publishable key → HTTP 200.
- Verifier (steps 1–3, one run instead of one per step — the steps are ~30 lines in total): **PASS**. Two minor notes applied: test fixtures use fake values (`https://example.supabase.co`, `sb_publishable_test`) instead of the real project's URL/key; the error says "Invalid Supabase env variables" (values may come from EAS env, not only `.env.local`). Suite still 44/392, typecheck, lint ✓.
- Moved to a new branch `feature/supabase-client` from `origin/main` (Kacper's request; PR #2 was already merged). Full suite on the new base: 44 suites / 414 tests, typecheck, lint ✓.
- Step 4: `Architecture.md` updated (Data model, Modules, Backend, Testing, dependencies, External services, Key decisions, Known limitations, Changelog).
- Q1 (`react-native-url-polyfill`) is still open — nothing added. Nothing imports the client yet, so it cannot break on a device until the next feature.
