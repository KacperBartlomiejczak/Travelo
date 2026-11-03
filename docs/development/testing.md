# Testing

## Tests first (TDD) — non-negotiable
- **No production code before a failing test.** For every plan step, tests are written first, run, and seen failing for the expected reason.
- **The work is not finished while any test fails** — new or existing. No step gets `[x]` and no task is reported as done until the full test suite, typecheck, and lint are green.
- Never delete, skip (`.skip`, `.only`, `xit`), or weaken an assertion to get green. If a test itself is wrong, say so, fix it, and log why in the feature's `plan.md`.
- The only steps without tests first are pure setup with no behavior (e.g. initializing the repo or the test runner). The plan must name them and say why, and Kacper approves that as part of the plan.

## Verification loop

A step is **not done** until all relevant checks pass, and **the work cannot be finished while any test fails**. After every step:

1. **Tests first, confirmed** — the step's tests existed and failed before the implementation was written.
2. **Typecheck** — `pnpm typecheck` (zero errors).
3. **Lint** — `pnpm lint`.
4. **Tests** — `pnpm test`, the **full suite**, not only the new tests:
   - every Zod schema has valid and invalid fixtures,
   - business logic (budgets, layovers, currency conversion) has unit tests,
   - UI behavior has component tests.
5. **Schema parity** — after any migration: regenerate Supabase types and the Zod ↔ DB parity check must pass.
6. **RLS** — for any table change: a test proving user A cannot read or write user B's trip, and a linked viewer cannot write.
7. **AI output** — tested against recorded Gemini fixtures (no live API calls in tests): output parses with Zod, and every `placeId` exists in the candidate set.
8. **Offline sync** — for any expense or sync change: tests for saving while offline, syncing on reconnect, retrying the same outbox entry without duplicates, a failed sync staying visible as `failed`, and a soft delete syncing.
9. **Manual UI check** — for what tests can't cover (look and feel), write short manual test steps for Kacper.

If a check fails: fix the code → rerun. Never "fix" it by weakening a test. After **3 failed attempts** on the same problem, stop, record it in the feature's `plan.md`, and report to Kacper as **blocked** — never as done. Work resumes only once the blocker is resolved, and it ends only when everything is green.

- Jest (`jest-expo` preset) + React Native Testing Library 14 (async `render` / `fireEvent`); `testPathIgnorePatterns` / `modulePathIgnorePatterns` skip `.claude/worktrees/`, so a Claude session worktree inside the checkout does not add its tests or a second `package.json` to the run; route tests use `renderRouter` from `expo-router/testing-library` with the real root layout.
- Test files never live under `src/app/` (Expo Router would turn them into routes); route tests sit in `src/__tests__/app/`.
- `package.json` → `jest.moduleNameMapper` maps `lucide-react-native` to its CommonJS build, because its React Native entry is `.mjs`, which jest-expo does not transform.
- `useColorScheme` / `useWindowDimensions` are mocked at `react-native/Libraries/Utilities/*` (RN imports them internally, so spying on `Appearance` / `Dimensions` does not work).
- Jest mocks RN `View` as a pass-through, so `aria-*` → native accessibility prop conversion is not observable in tests.
- Pickers (`@expo/ui`, `expo-image-picker`), `expo-crypto` and (in the home tests) `expo-status-bar` are mocked; the Supabase client test mocks `createClient` and `expo-sqlite/localStorage/install` and loads the module with `jest.isolateModules` per env (no network in tests); route tests use stand-in screens for steps they don't test; image `require`s are stubs carrying their path.
- Auth tests (auth-onboarding):
  - **`jest.setup.ts` defaults:**
    - the app session source is a signed-in fake (`src/test/fake-session-source.ts`);
    - the app profile repository holds a pre-filled profile;
    - `@/data/app-auth` is mocked, so no test loads the real client;
    - `renderRouter` waits strictly until the gate has settled (`src/test/settle-gate.ts`; opt out with `allowGateToStayLoading`);
    - an async `afterEach` reopens the user epoch (`src/test/user-epoch.ts`).
  - **Local store:** `src/test/reordering-db.ts` delays SQLite statements at random (seeded), to prove the serial queue and the epoch.
  - **Profile setup:** `ProfileSetupScreen.test.tsx` mocks `react-native/Libraries/ReactNative/RendererProxy`, so that `findNodeHandle` returns handles for the focus tests.
  - **SQL:** `supabase/tests/profiles.sql` (RLS, grants, the friend-code trigger, Storage); `src/schemas/__tests__/profiles-db-parity.test.ts` keeps the Zod and SQL rules in line.
- `jest.setup.ts` (`setupFilesAfterEnv`): `@/data/app-trip-repository` → the in-memory repository, `expo-network` → `src/test/mock-network.ts` (online unless a test calls `setNetwork`), and the test mocks of `react-native-gesture-handler`, `react-native-worklets` and `react-native-reanimated` (the drawer). Route tests that need a specific repository mock `@/data/app-trip-repository`. Route tests mount the home screen through the `(drawer)/(tabs)` groups (route maps need `'(drawer)/(tabs)/_layout': TabsLayout`; maps that omit the four empty screens make expo-router warn "Route … is extraneous"); the wizard guard tests drive the real `ConfirmDialog` (scrim „Zamknij", `requestClose`) instead of spying on `Alert`; `src/test/drawer-status.ts` reads the panel's open / closed status from the router state. The Reanimated mock does not apply animated props, so in Jest the drawer's scrim is not hidden while closed (the panel's own content is, through its `aria-hidden` wrapper).
- `jest.setup.ts` replaces `Date` with a subclass starting at 2026-10-04T12:00Z (it keeps ticking), so fixtures with fixed dates do not expire; a suite using `jest.useFakeTimers` with trip fixtures must pass `now: Date.now()`.
- Data-layer tests use a real SQLite (`node:sqlite`, Node 22) behind the `LocalDb` interface (`src/test/node-sqlite.ts`) and a fake Supabase client that records every query chain (`src/test/fake-supabase.ts`). The request-timeout tests in `supabase-trip-repository.test.ts` use the real `createClient` over a stub server that never answers (session pre-stored, fake timers, no network).
- `fake-supabase.ts` also records Storage calls (`storage.from(bucket)`: `upload`, `createSignedUrls`, `list`, `remove`). `jest.setup.ts` mocks `expo-image-manipulator` and `expo-file-system`; `src/test/__tests__/native-mocks.test.ts` keeps the mocks in line with the real typings.
- Photo database tests:
  - `trip_photos_rls.sql`: owner, a stranger who owns another trip, a linked member, anon; the idempotent insert; the cascade.
  - `trip_photos_storage.sql`: the bucket, the path helper, the Storage policies. Needs a local Supabase.
  - `trip_covers.sql`: the cover constraint and default, null refused (also through `create_trip`), the migration re-run on old values, RLS on the column, Storage for cover files (owner / viewer / stranger).
  - Counts after `reset role` are scoped to the test's own trips / users, so the SQL tests run on a used local database (trip-covers D13). There is no local `psql` on Kacper's machine; the files were run through `docker exec` in the db container.
- Database tests: `supabase/tests/trips_rls.sql` (RLS for owner / stranger / linked viewer / anon, constraints, idempotent `create_trip`, last write wins, the owner's rename / cover change (removing the cover is refused, 23502) and delete with cascade to members and segments) — `pnpm test:db`, not part of `pnpm test`. aria-hidden elements need `includeHiddenElements: true`. Some date/time tests set `process.env.TZ` inside the test, which does not change Node's time zone under Jest (next point); device-time-zone independence is checked by running the whole suite under `TZ=…`.
- Database tests: `supabase/tests/expenses_rls.sql` (RLS for owner, stranger, linked member and anon, column grants, last write wins, soft delete, member FK, D18 deletes).
- Jest cannot switch the time zone inside a test (`process.env.TZ` set in a test does not reach Node); time-zone checks need the whole run under `TZ=…`.
- Current suite: 158 suites, 3346 tests (2026-11-03, after merging main with expenses into docs-restructure). The last run under `TZ=Pacific/Auckland` was at 64 suites / 747 tests.
- A route registered in the root layout but missing from a test's own route map makes expo-router warn "Too many screens defined" (seen for `trips/[tripId]/photos` in the older route suites). It is only a warning.
- `WizardScreen.test.tsx` spies on `Keyboard.addListener` and fires `keyboardWillShow` / `keyboardWillHide` itself, with a fake `layout` event (it needs `persist()`), to check the bottom padding; it also fires `keyboardDidShow` with fake `measureInWindow` views for the focused field and the scroll view (`ScrollView.prototype.getNativeScrollRef`, `TextInput.State.currentlyFocusedInput`) to check the iOS scroll, and redefines `Platform.OS` as `'android'` for the Android case (jest-expo runs as iOS). `BottomSheet.test.tsx` drives the sheet's `KeyboardAvoidingView` the same way, on Android (`jest.replaceProperty(Platform, 'OS', 'android')`, `keyboardDidShow` / `keyboardDidHide`) and iOS. For the swipe it walks the responder chain itself (a `modal-host` view stands in for RN Modal's touch-claiming host, which Jest's Modal lacks) and checks the sheet's `translateY`.

