# Task: PKCE with SHA-256 (WebCrypto polyfill on React Native)
Status: done in code (approved by Kacper 2026-10-19); device check by Kacper pending

## Understanding & assumptions
- On every OAuth sign-in (Google / Discord) Metro logs
  `WARN  WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.`
- Source: `@supabase/auth-js` 2.117.2, `lib/helpers.js` `generatePKCEChallenge`. It checks
  `typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined' && typeof TextEncoder !== 'undefined'`.
  Hermes has no `crypto.subtle`, so the library sends the verifier itself as the challenge (`code_challenge_method=plain`).
  This is the known risk R16 / "PKCE strength" in `Architecture.md` and `prompts/auth-onboarding/plan.md`.
- A second weakness in the same file: when the global `crypto` is missing, `generatePKCEVerifier` builds the verifier
  from `Math.random()` (not a secure random source).
- Kacper's decision (2026-10-19): fix it, use `sha256` (S256).
- "Done" means:
  - no WebCrypto warning on the device on sign-in;
  - the authorize URL carries `code_challenge_method=s256` and a SHA-256 challenge; the verifier comes from a secure random source;
  - Google and Discord sign-in still work on the device (the server checks S256);
  - the background check of the stored session (auth-onboarding D22 / D23) behaves exactly as today.
- Assumption: no new dependency. `expo-crypto ~57.0.3` is already installed and has
  `digest(algorithm, data: BufferSource): Promise<ArrayBuffer>` and `getRandomValues(typedArray)` (checked in
  `node_modules/expo-crypto/build/Crypto.d.ts`). Its `CryptoDigestAlgorithm.SHA256` value is `'SHA-256'`, the WebCrypto name.

### The trap (why step 1 exists)
`GoTrueClient.getClaims()` also looks at the global: when `'subtle' in globalThis.crypto` and the JWT is asymmetric
(`alg` not `HS*`, with a `kid`), it stops asking the server and verifies locally with `crypto.subtle.importKey` / `verify`.
A polyfill with only `digest` would make that path throw a plain `TypeError`; `checkStoredSession` swallows every error,
so a deleted user would silently stay signed in (D23 broken, no test would notice on a device).

Today on React Native `getClaims(token)` ends in `getUser(token)` (`GET /user`) for every valid-looking token (an expired or malformed JWT is rejected locally first; `getSession()` refreshes the token before the check, so that case is rare and is never `user_not_found`) — the code comment in
`session-source.ts` already says so. `getUser(token)` gives the same errors and also removes the session itself on
`session_not_found` (checked in `GoTrueClient.js` `_getUser`). So `checkStoredSession` calls `getUser(token)` directly:
same behavior as today, and it no longer depends on what `crypto.subtle` can do.

## Approach
1. `checkStoredSession` uses `auth.getUser(token)` instead of `auth.getClaims(token)`.
2. A small polyfill `src/data/web-crypto.ts`, `installWebCrypto(target = globalThis)`, built on `expo-crypto`:
   - if `target.crypto` is missing, create it;
   - if `getRandomValues` is missing, add `expo-crypto`'s `getRandomValues`;
   - if `subtle` is missing, add `subtle = { digest(algorithm, data) }` that calls `expo-crypto`'s `digest`;
   - anything that already exists is left alone (web, Jest on Node).
   `src/data/supabase.ts` calls it before `createClient`, like the URL polyfill.

Rejected: `react-native-quick-crypto` (full WebCrypto) — a new native dependency, and it would also turn `getClaims` into a
local check that never asks the server, which changes D23. Our need is SHA-256 only.

## Data structures (Zod)
None. No entity, payload or storage shape changes. (`digest` takes bytes from the library, not external input.)

## Tests
**Step 1 — `src/data/__tests__/session-source.test.ts`** (the existing `checkStoredSession` tests move from `getClaims` to `getUser`; nothing removed or weakened):
- asks the server once with the stored token: `getUser('access')`, and never calls `getClaims`;
- `user_not_found` → `signOut({ scope: 'local' })` when the same user is still stored; not when someone else is;
- `session_not_found` / no connection / server error / a rejected promise → nothing happens, never rejects;
- no stored session → `getUser` not called.
- `src/test/fake-supabase.ts`: the fake auth gets `getUser(jwt)`.

**Step 2 — `src/data/__tests__/web-crypto.test.ts`** (expo-crypto mocked, delegating to Node's `crypto`):
- on an empty target: creates `crypto`, `getRandomValues` fills the array via expo-crypto, `subtle.digest('SHA-256', bytes)`
  returns the expo-crypto digest (known vector: SHA-256 of `"abc"` = `ba7816bf…`);
- an existing `crypto.subtle` / `getRandomValues` is not replaced;
- an existing `crypto` without `subtle` keeps its own `getRandomValues` and gets `subtle`;
- **library check**: with the polyfill installed on a global without WebCrypto, auth-js `signInWithOAuth({ skipBrowserRedirect: true })`
  returns a URL with `code_challenge_method=s256` and a challenge equal to base64url(SHA-256(stored verifier)); `console.warn` is not called.
- `src/data/__tests__/supabase.test.ts`: the polyfill is installed before `createClient` (same pattern as the URL polyfill test).

## Files
- Modify: `src/data/session-source.ts`, `src/test/fake-supabase.ts`, `src/data/__tests__/session-source.test.ts`
- Create: `src/data/web-crypto.ts`, `src/data/__tests__/web-crypto.test.ts`
- Modify: `src/data/supabase.ts`, `src/data/__tests__/supabase.test.ts`
- After the task: `Architecture.md` (remove the "PKCE strength" limitation, data module row, changelog)

## Skills
- test-driven-development — steps 1, 2 — red → green for every behavior
- source-driven-development — step 2 — check the installed `expo-crypto` 57 and `auth-js` 2.117.2 code before writing the polyfill
- security-and-hardening — steps 1, 2, verifier — auth flow and session check

## Steps
- [x] 1. [frontend] `checkStoredSession` asks `getUser(token)` instead of `getClaims(token)`; fake auth gets `getUser` — skill: test-driven-development, security-and-hardening — tests first: Tests §1 — verify: full suite, typecheck, lint; verifier.
- [x] 2. [frontend] `installWebCrypto` on `expo-crypto`, called in `supabase.ts` before `createClient` — skill: test-driven-development, source-driven-development, security-and-hardening — tests first: Tests §2 — verify: full suite, typecheck, lint; verifier; tester on the device (manual steps below).

## Verification
- Every step: `pnpm test` (full), `pnpm typecheck`, `pnpm lint`, verifier.
- Manual (device, after step 2):
  1. Fresh start, sign in with Google → no `WebCrypto API is not supported` in Metro; sign-in finishes, profile/home opens.
  2. Sign out, sign in with Discord → same.
  3. Signed in, restart the app offline → app opens as today (no sign-out).
  4. (Optional, needs a test account) delete the test user in Supabase Studio, restart the app online → the app signs out (D23).

## Progress log
- Step 1 deviation: the Files list missed `src/providers/__tests__/Session.test.tsx` (the D23 block runs the real session source over `fakeSupabase()` and stubs `getClaims`). Added to step 1 as a mechanical `getClaims` → `getUser` migration, no assertion changes meaning; `getClaims` then leaves `src/test/fake-supabase.ts`.
- Step 1: tests migrated first (red ✓: 5 in `session-source.test.ts`, `getUser` never called; 9 in `Session.test.tsx` after the production change) · `session-source.ts` `checkStoredSession` → `getUser(token)`, `Deps` picks `getUser`; fake auth `getUser` added, `getClaims` removed; D23 block in `Session.test.tsx` renamed (`UserAnswer`, `answerUser`) · green ✓ (117 suites, 2445 tests with `--testPathIgnorePatterns worktrees`), typecheck ✓, lint ✓ · verifier PASS (assertion counts unchanged, `getUser(jwt)` behavior checked in auth-js) · skills: test-driven-development, security-and-hardening · deviations: the `Session.test.tsx` file (above); "never calls getClaims" is implicit (the fake has no `getClaims`, a call would throw and fail the tests); the sentence about `getClaims` → `getUser` in "The trap" was made exact (expired tokens are rejected locally by `getClaims`).
- Note: plain `pnpm test` also collects stale copies under `.claude/worktrees/stoic-feynman-8bd8d4/**`, which fail on their own (not this task). The suite is run with `--testPathIgnorePatterns worktrees`; reported to Kacper.
- Step 2: tests first (red ✓: missing module `@/data/web-crypto`; with an empty stub 7 red — e.g. `Expected "s256", Received "plain"`, expo-crypto `getRandomValues` called 0 times; `supabase.test.ts` new test `Received: 0` calls) · new `src/data/web-crypto.ts` (`installWebCrypto`: creates `crypto`, adds `getRandomValues` and `subtle.digest` — `'SHA-256'` / `{ name }` only, others rejected — from `expo-crypto`, leaves existing ones alone), called in `supabase.ts` before `createClient` · tests: `web-crypto.test.ts` (9: known SHA-256 vector, rejection, no replacing, a real supabase-js `createClient` with `globalThis.crypto` removed: baseline `plain` + warning, with the polyfill `s256` and challenge = base64url(SHA-256(stored verifier)), verifier from expo-crypto and no `Math.random`), one test in `supabase.test.ts` · green ✓ (118 suites, 2455 tests), typecheck ✓, lint ✓ · verifier PASS with two minor notes, both fixed: the library `beforeEach` now clears the expo-crypto mocks (the verifier test was shown red by removing `getRandomValues` from the polyfill), `WebCryptoTarget` no longer exported · skills: test-driven-development, source-driven-development (installed auth-js 2.117.2 `helpers.js` / `GoTrueClient.js`, expo-crypto 57 `Crypto.d.ts`, `Crypto.types.d.ts`), security-and-hardening · deviation: no tester run — the device check needs a sign-in with a real Google / Discord account, so the manual steps go to Kacper.
- `Architecture.md` updated (data module row, background check, key decision, known limitation replaced, changelog).

## Risks & open questions
- R1: `expo-crypto` `digest` on Android/iOS needs the native module from the dev build. It is already in the build (used for UUIDs), so no new EAS build is expected.
- R2: if the hosted project uses asymmetric JWT keys, `getClaims` would have broken without step 1; step 1 removes the dependency either way.
- R3: auth-js also needs a global `TextEncoder` for S256. Hermes should have it; if the warning still shows on the device, this is the cause.
