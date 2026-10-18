# Task: Trip covers (preset covers, required cover)
Status: done — 2026-10-18 (device checks B4–B6 left for Kacper)

## Understanding & assumptions
Every trip has a cover photo. The organizer picks it from ready-made photos bundled in the app, or from the phone's gallery. One preset is selected from the start, so the wizard never blocks on the cover.

Photos are compressed so they never load for ages:
- presets are converted once, before they go into the app;
- a gallery photo is shrunk and re-encoded on the phone before it is sent.

Asked by Kacper on 2026-10-15 together with trip photos; refined on 2026-10-18.

Done when:
- the wizard summary and „Nazwa i zdjęcie” show the preset row plus „Z galerii”, with one tile always selected;
- every trip in the database has a cover;
- a gallery cover lives in Storage and shows on other phones and after a reinstall;
- the hero, the side panel and the picker show covers from compressed files, with a placeholder while they load and the default preset if one fails;
- full suite, typecheck and lint are green, and the SQL tests are green.

Assumptions (confirm by approving the plan):
- **A1** — The organizer can change the cover only online, the same as today: „Nazwa i zdjęcie” and creating a trip are server-first.
- **A2** — A gallery cover is **not** one of the trip's photos. It is not shown in the photo strip, but it lives in the same Storage folder, so deleting the trip removes it too (trip-photos P7).
- **A3** — Existing covers that are device-local URIs (from before this feature) cannot be uploaded from the server. The migration sets them to the default preset. These are test trips only.

## Decisions
Kacper, 2026-10-15:
- **D1 — The cover is required.** It comes from the presets **or** from the gallery (the gallery keeps today's 16:9 crop). Removing the cover goes away.
- **D2 — Presets:** one set, the same for every trip, bundled in the app (works offline). *Superseded by D6.*
- **D3 — Source of the presets:** Claude searches free photos. *Superseded by D6.*
- **D4 — Default:** one preset is **preselected** in the wizard (it can be changed). Existing trips without a cover get the same default.
- **D5 — A gallery cover is uploaded to Supabase Storage** (the trip-photos bucket).

Kacper, 2026-10-18:
- **D6 — Kacper supplies the presets** in `assets/template-images/`. The current set is Auckland, Bali, Beijing, Jakarta and Majorka. It is matched to nothing, every trip can pick any of them. Supersedes D2 and D3.
- **D7 — Default preset: any.** The first in the list, `auckland`.
- **D8 — The gallery stays**, with compression and upload to Storage (D5).
- **D9 — Larger presets:** the current files are 640 px and blurry on the hero. Kacper sends larger originals, and Claude converts them once (C1).
- **D10 — Plan approved** (2026-10-18), with P1 (picker look) and Q1 (failed gallery upload: the trip keeps the default cover, plus a snackbar) as proposed and Q2's preset names. Q3 (licence) and R4 (originals in git) Kacper answers separately; they do not block the steps.
- **D11 — A picked gallery photo stays as the first tile** after a preset is chosen, so the organizer can go back to it without opening the gallery again (Kacper, 2026-10-18).
- **D12 — The tile row scrolls sideways** (P1), an exception to design-context §4.4 ("rows wrap") for the cover picker only. Kacper confirmed scrolling (2026-10-18: „Tak zostaw przewijane”).
- **D13 — SQL tests must not depend on an empty database** (Kacper, 2026-10-18). `trip_photos_rls.sql` (and any other SQL test with the same assumption) counts only its own rows, so `pnpm test:db` runs on the used local database. This fixes a wrong test (it assumed an empty table); the local data is kept, no `db reset`.
- **D14 — How the Q1 snackbar reaches the home screen: a route param** (Kacper, 2026-10-18). The summary closes the wizard with `router.dismissTo({ pathname: '/', params: { coverUploadFailed: '1' } })`; `HomeScreen` reads it, shows its existing snackbar with the Q1 text and clears the param so it does not repeat. *Rejected:* an app-level flash-message store (a new shared mechanism), and a snackbar on the summary with a delayed close.

## Approach
**How a cover is stored.** `trips.cover_image_uri` keeps its name, but holds one of two values:
- `preset:<id>` — a bundled photo;
- `photo:<uuid>` — a gallery cover in Storage at `<tripId>/<uuid>.jpg` plus `<tripId>/<uuid>_thumb.jpg`. These are the same path shapes as trip photos, so the existing Storage rules cover it with no Storage migration.

A stable id is stored, never a path to the bundled file. That path changes between builds, so a stored path would break after an update. The name `coverImageUri` stays: `preset:` and `photo:` are URI-shaped (scheme:value), and keeping the name saves a rename across the code and the database.

**Compression (C1–C3):**
- **C1, presets, once, before they enter the app.** `scripts/build-covers.ps1` writes two files per preset into `assets/covers/`:
  - `<id>.jpg`: longer side at most 2048 px, JPEG quality 80, no EXIF;
  - `<id>_thumb.jpg`: longer side at most 480 px.

  These are the same sizes the gallery path uses. The script uses Windows' built-in `System.Drawing`, so no new dependency. Only these files are bundled; the originals are never `require`d. Expect about 250–400 KB per cover and 30 KB per thumbnail, so 5 presets add about 2 MB.
- **C2, gallery, on the phone.** The existing `preparePhoto` shrinks the photo to at most 2048 px, makes a 480 px thumbnail, and re-encodes both as JPEG 0.8 without EXIF. Both go to Storage. The hero loads the file and the side panel and the picker load the thumbnail, never the 12 MP original.
- **C3, display, in one `CoverImage` component.** Covers show through `expo-image` with:
  - the placeholder surface behind the image and a short `transition`;
  - a gallery cover's `cacheKey` set to its Storage path, so it comes from the disk cache offline and after its signed URL expires (like trip-photos D8);
  - `onError` showing the default preset, so a missing file is never an empty hole.

**Order of steps.** Schemas, then the new picker and `CoverImage`, then the server switch, then the wiring. The picker and `CoverImage` come before the switch, because the switch makes `coverImageUri` required. If the UI still produced `undefined` at that point, the suite would go red between steps. This deviates from the usual "schemas → backend → frontend" order.

*Rejected:*
- A separate `cover_preset_id` column next to `cover_image_uri`: two columns for one fact, plus a "one of them must be set" check.
- `sharp` as a dev dependency for C1: a new dependency for a one-off job.

## Data structures (Zod)
New `src/schemas/cover.ts`:
```ts
export const COVER_PRESET_IDS = ['auckland', 'bali', 'beijing', 'jakarta', 'majorka'] as const;
export const CoverPresetIdSchema = z.enum(COVER_PRESET_IDS);

/** A stored cover: a bundled preset or a gallery cover in Storage (trip-covers D1, D5). */
export const CoverSchema = z.union([
  z.templateLiteral(['preset:', CoverPresetIdSchema]),
  z.templateLiteral(['photo:', z.string().regex(LOWERCASE_UUID)]), // lowercase: it becomes a Storage path
]);
export type Cover = z.infer<typeof CoverSchema>;

export const DEFAULT_COVER = 'preset:auckland' satisfies Cover; // D7

/** What the picker hands over: a stored cover, or a gallery photo picked but not yet sent. */
export const CoverChoiceSchema = z.union([CoverSchema, z.templateLiteral(['file://', z.string().min(1)])]);
export type CoverChoice = z.infer<typeof CoverChoiceSchema>;

/** Signed URLs of a gallery cover, present only for `photo:` covers (the server is a boundary). */
export const CoverUrlsSchema = z.object({ url: HttpUrlSchema, thumbnailUrl: HttpUrlSchema });
```
The `uuid` check inside `templateLiteral` is confirmed in the Zod 4 docs in step 2. If `templateLiteral` does not take it, a `z.string().regex()` over the whole value is used instead, and the progress log records it.

Changes:
- `trip.ts`:
  - `coverImageUri: CoverSchema` (**required**);
  - `TripSummarySchema` and `TripListItemSchema` get `coverUrls: CoverUrlsSchema.optional()`;
  - a refine: `coverUrls` is present only when the cover is `photo:`.
- `create-trip-form.ts`: `TripDetailsInputSchema.coverImageUri: CoverChoiceSchema` (**required**).
- `HttpUrlSchema` moves from `trip-photo.ts` to `common.ts`, so both features use it.

Migration `<ts>_trip_covers.sql` (Zod → migration → `pnpm db:types` → parity check `trip-rows.test.ts`):
- `update trips set cover_image_uri = 'preset:auckland' where cover_image_uri is null or cover_image_uri !~ '<shape>'` (A3);
- `alter column cover_image_uri set default 'preset:auckland', set not null`;
- a new check: `^preset:(auckland|bali|beijing|jakarta|majorka)$|^photo:<lowercase uuid>$`. It replaces the old `char_length >= 1`.
- `create_trip` needs no change if it passes the value through; step 4 checks this.

SQLite: no migration. The trip copies are JSON parsed with Zod (`local-store.ts`), so an old copy without a cover fails to parse, counts as "no copy", and is fetched again online.

## Tests
- **Step 2 (Zod)** — `src/schemas/__tests__/cover.test.ts`:
  - valid: every preset, `photo:<lowercase uuid>`;
  - invalid: an unknown preset, `preset:`, an uppercase or broken uuid, an empty value, `https://…`, `content://…`;
  - `CoverChoice` also accepts `file://…`;
  - `DEFAULT_COVER` parses;
  - `CoverUrls` rejects `file:`, `javascript:` and `data:`.
- **Step 3 (frontend)**:
  - `CoverImage`:
    - a preset shows its bundled file, or its thumbnail when `variant="thumbnail"`;
    - a `photo:` cover shows the URL with `cacheKey` = Storage path;
    - a `file://` cover shows that file;
    - `onError` switches to the default preset;
    - it is `aria-hidden` where the parent says so.
  - `CoverPicker`:
    - a radio group with one tile per preset plus „Z galerii”;
    - the value is the selected tile, with a screen-reader label and „selected”;
    - tapping a preset emits `preset:<id>`;
    - the gallery result emits `file://…` and its tile shows selected first in the row;
    - a cancelled gallery changes nothing;
    - a gallery error shows the error and keeps the value;
    - there is no „Usuń”;
    - the field is not marked optional.
  - The wizard draft starts with `DEFAULT_COVER`, and the summary always sends a cover.
  - `TripDetailsSheet` starts with the trip's cover and sends the choice.
  - Hero and side panel use `CoverImage`.
- **Step 4 (backend)**:
  - SQL (`supabase/tests/trips_rls.sql` or a new `trip_covers.sql`):
    - existing null and invalid covers become the default;
    - insert or update with an invalid cover is rejected;
    - the owner can upload `<tripId>/<uuid>.jpg`, a linked viewer can read it and cannot write it.
  - `trip-rows.test.ts` parity.
  - Repository, in-memory and Supabase (fake Storage):
    - a create with `preset:` stores it, uploads nothing;
    - a create with `file://` prepares the photo, uploads file + thumbnail into the new trip's folder and stores `photo:<id>`;
    - if the upload fails, the trip stays with `DEFAULT_COVER` and the call reports the failed cover (Q1);
    - details with a new gallery cover upload it, store it, then remove the old cover's files; a preset → preset change uploads nothing;
    - lists and overviews sign `photo:` covers (`coverUrls`), presets have none;
    - deleting a trip also removes its cover files.
- **Step 5 (frontend)**:
  - the hero and side panel pass `coverUrls`;
  - the snackbar for a failed cover upload (Q1);
  - `coverPicker.remove` is gone from both locales.

## Files
- Created:
  - `scripts/build-covers.ps1`;
  - `assets/covers/*.jpg` (5 × 2 files);
  - `src/schemas/cover.ts` + test;
  - `src/components/CoverImage.tsx` + test;
  - `src/lib/cover-presets.ts` (preset id → `require` of both files, display name key);
  - `supabase/migrations/<ts>_trip_covers.sql`.
- Modified:
  - schemas: `src/schemas/trip.ts`, `create-trip-form.ts`, `common.ts`, `trip-photo.ts`, `index.ts`;
  - data: `src/data/trip-repository.ts`, `supabase-trip-repository.ts`, `trip-rows.ts`, `database.types.ts`;
  - UI: `src/components/CoverPicker.tsx`, `TripHero.tsx`, `src/features/drawer/TripsDrawer.tsx`, `src/features/home/TripDetailsSheet.tsx`, `src/features/trip-create/draft.ts`, `src/app/trips/new/summary.tsx`;
  - theme and i18n: `src/theme/*` (`size.coverTile`), `src/i18n/locales/{pl,en}.json`;
  - SQL tests, `GLOSSARY.md` (Cover), `Architecture.md`, `CLAUDE.md` "Data structures" (Trip.coverImageUri).

## Skills
- domain-modeling, test-driven-development — step 2 — the Cover value and the Zod schemas.
- source-driven-development — steps 2, 3, 4:
  - Zod 4 `templateLiteral`;
  - `expo-image` `placeholder` / `transition` / `onError` / `cacheKey`;
  - `require` of image assets in Jest;
  - supabase-js Storage.
- frontend-ui-engineering, frontend-design, ui-taste — step 3 — the new picker (radio group, states, a11y); ui-taste in the verifier's review.
- security-and-hardening, doubt-driven-development — step 4 — the migration rewrites existing data, and the Storage paths and URLs are a boundary.
- debugging-and-error-recovery — any step, if something fails for an unclear reason.

## Steps
- [x] 1. [frontend] Run `scripts/build-covers.ps1` and add `assets/covers/` (C1). Skill: none. **No tests first: pure asset setup with no behaviour**, named here so it can be approved. It runs now on the current 640 px files, so the work is not blocked, and runs again with the same names when Kacper's larger files arrive (D9). Verify: sizes and dimensions listed in the progress log, no EXIF.
- [x] 2. [backend] Zod `cover.ts`, `HttpUrlSchema` moved to `common.ts`, `GLOSSARY.md`. Skill: domain-modeling, source-driven-development, test-driven-development. Tests first: step 2 list. Verify: red → green, full suite, typecheck, lint; verifier.
- [x] 3. [frontend] `cover-presets.ts`, `CoverImage`, new `CoverPicker` (P1), wizard default, details sheet, hero and side panel on `CoverImage`, i18n. Skill: frontend-ui-engineering, frontend-design, source-driven-development. Tests first: step 3 list. Verify: as above; verifier + ui-taste.
- [x] 4. [backend] Make the cover required:
  - in Zod: `trip.ts` and `create-trip-form.ts`;
  - in the database: the migration, `db:types`, parity;
  - in the repositories: `trip-rows`, upload / sign / replace / delete, SQL tests.

  Skill: security-and-hardening, doubt-driven-development, source-driven-development, test-driven-development. Tests first: step 4 list. Verify: red → green, `pnpm test:db`, full suite, typecheck, lint; verifier.
- [x] 5. [frontend] Pass `coverUrls` to the hero, side panel and `TripDetailsSheet` picker, add the failed-upload snackbar (Q1), remove i18n left-overs; also (from step 4 review) remove the no-cover branches in `TripHero` / `TripsDrawer` and the test casts that kept them alive, and show the existing generic error for `cover-not-current`. Skill: frontend-ui-engineering. Tests first: step 5 list. Verify: as above; verifier.
- [x] 6. [tester] Device run of the manual steps below on a new dev build. Skill: none. Verify: tester PASS per scenario; what the emulator cannot do goes to Kacper's phone.

## Manual test steps (for step 6 and Kacper)
1. Create a trip without touching the cover: it gets Auckland, and the hero is sharp.
2. Pick each preset in the wizard: the preview changes at once, and the hero shows it after creating the trip.
3. „Z galerii” with a 12 MP photo: after creating the trip, the hero shows it within a second or two, and the side panel thumbnail too.
4. The same trip on a second phone or after a reinstall: the gallery cover shows.
5. Airplane mode, restart the app: the hero and side panel still show presets and the gallery cover (cache).
6. Change a gallery cover to another gallery photo: the old file is gone from Storage (Supabase dashboard).
7. Light and dark mode, largest Dynamic Type: the picker row scrolls, and the selected tile is clear.
8. TalkBack / VoiceOver: each tile reads „Bali, zaznaczone” / „Z galerii”.

## Progress log
- Step 1 (2026-10-18): no tests (approved pure setup) · new `scripts/build-covers.ps1` (System.Drawing only, HighQualityBicubic, JPEG quality 80, never upscales, applies EXIF orientation 2–8, keeps the largest source per id) and `assets/covers/`: auckland 1920×1280 380 KB, bali 1920×1280 497 KB, beijing 1920×1280 590 KB, jakarta 640×427 72 KB, majorka 1920×1306 557 KB; thumbnails 480 px wide, 23–40 KB · outputs carry no EXIF / GPS / orientation (only GDI+ quantization-table items); the sources' ICC profile is dropped · verifier PASS, 2 minor script issues (an undisposed `EncoderParameters`, defaults relative to the current directory) sent back to the implementer and fixed (`EncoderParameters` disposed in `finally`; defaults from `$PSScriptRoot`; re-run from `scripts/` gave identical outputs) · skill used: none · deviations: Kacper added `*-md.jpg` (1920 px) originals meanwhile, so 4 of 5 presets are already large; **Jakarta is still only 640×427** and stays soft on the hero until a larger original arrives (D9). Majorka's new original is landscape, so R1 no longer applies. Covers are 380–590 KB each, total ≈ 2.4 MB with thumbnails (slightly above R3's estimate).
- Step 2 (2026-10-18): tests written (red ✓: cover.test.ts 37/37 failed with "Cannot read properties of undefined (reading 'safeParse')" — schemas not exported yet; common.test.ts HttpUrl 8 failed, same reason) · new `src/schemas/cover.ts` (`COVER_PRESET_IDS`, `CoverPresetIdSchema`, `CoverSchema` = `z.templateLiteral` of `preset:` + enum | `photo:` + lowercase-uuid regex, `DEFAULT_COVER`, `CoverChoiceSchema`, `CoverUrlsSchema`), `HttpUrlSchema` moved to `common.ts` (unchanged), `index.ts` export, GLOSSARY "Cover photo" · green ✓ 87 suites / 1428 tests, typecheck 0, lint clean · verifier PASS; its minor note (`file://` followed by only whitespace or a line break was accepted) fixed test-first: the part after `file://` must start and end with a non-space and has no line breaks, inner spaces allowed because expo-image-picker types do not promise URL-encoding (red 8 failed → green; full suite 1437 passed) · skills used: domain-modeling, source-driven-development (installed Zod 4.6.5 source `v4/core/schemas.js` `$ZodTemplateLiteral`: enum and regex parts are enforced at runtime, so no fallback), test-driven-development · deviations: extra exported types `CoverPresetId`, `CoverUrls` (used from step 3).
- Step 3 (2026-10-18): tests written (red ✓: cover-presets and CoverImage "Cannot find module"; CoverPicker "Unable to find role radio" / still marked optional / still had „Usuń”; theme `coverTile` undefined; draft without a cover; summary and TripDetailsSheet without radios; hero and side-panel preset cases got `[]` for a bundled module) · new `src/lib/cover-presets.ts` (`COVER_PRESETS` Record over the ids with `require` of both files + name key, `resolveCoverSource`: preset → bundled module; `photo:` + urls → `{ uri, cacheKey: cover:<uuid>:<variant> }`; `photo:` without urls, legacy or invalid → default preset; `file://` → that uri), new `src/components/CoverImage.tsx` (`surface.secondary` behind, `transition` `duration.small` or 0 with reduce motion, `onError` → default once, aria-hidden unless labelled), `CoverPicker` rewritten per P1 (required, 16:9 preview, radiogroup of 16:9 tiles `size.coverTile` 112dp, „Twoje zdjęcie” first when the value is not a preset, gallery last, 2dp brand border (`size.focusRing`) + `Check`, no „Usuń”), `tokens.ts` `size.coverTile`, `draft.ts` required `coverImageUri: CoverChoice` starting on `DEFAULT_COVER`, `TripDetailsSheet` starts on the trip's cover or the default, hero and side-panel row on `CoverImage` (no-cover branches kept for step 5), i18n: `coverPicker.gallery`, `yourPhoto`, `presets.*` (Q2), removed `choose` / `change` / `remove` / `preview` · green ✓ 89 suites / 1478 · verifier FAIL (only: red runs missing from my brief) → evidence supplied; polish fixed test-first (red 5 failed → green): one radius `radius.sm` for preview and tiles (§5.4), the row opens scrolled to the selected tile and goes back to the start after a gallery pick → verifier PASS, 89 suites / 1483, typecheck 0, lint clean · skills used: frontend-ui-engineering, frontend-design, source-driven-development (installed expo-image 57.0.5 sources: `cacheKey`, `transition`, `onError`; jest-expo `assetFileTransformer`), ui-taste (verifier, code-only) · deviations / for Kacper: a picked gallery photo stays as a tile after a preset is chosen (implementer's reading of P1); the row scrolls sideways while design-context §4.4 asks rows to wrap (P1 approved scrolling); the selected border borrows `size.focusRing` (2dp); `home.test.tsx` now expects `preset:auckland` when a trip without a cover is saved (behaviour change, D4).
- Step 4 (2026-10-18): tests written (red ✓: production files reverted to HEAD → 7/7 affected suites failing, 65 failed / 350 passed, e.g. `TripListItem` missing `coverUrls`, `requires a cover` Expected false / Received true, `buildTrip` kept `file:///cache/cover.jpg`, `create` stored the file URI as the cover, an old LocalStore copy without a cover was accepted; SQL `FAILED: the cover column is not null`) · Zod: `Trip.coverImageUri: CoverSchema` required, `coverUrls` on `TripSummary` / `TripListItem` (forbidden on presets), `TripDetailsInput.coverImageUri: CoverChoiceSchema` required · migration `20261018120000_trip_covers.sql` (null / non-matching → `preset:auckland`, default, not null, check with the exact Zod shape; `create_trip` unchanged), applied to the local Supabase only · `database.types.ts` regenerated, parity test compares the migration regex with `CoverSchema` · `trip-rows` always maps the cover and parses signed URLs · repositories: create (preset as is; `file://` → trip on the default, `preparePhoto`, upload thumb + file `upsert: false`, update to `photo:<uuid>`; any failure resolves with the default + cleanup, Q1), updateDetails (reads the stored cover first; `file://` uploads; a `photo:` that is not the stored cover rejects `cover-not-current`; old cover files removed after success, best effort), list / current sign `photo:` covers in batches, delete removes cover files with the folder · SQL `trip_covers.sql` (constraint, default, null refusal, re-run of the migration on old values, RLS on the column, Storage owner / viewer / stranger) · `trips_rls.sql`: „A can remove the cover” became „A cannot remove the cover (23502)” (behaviour change, D1) · green ✓ 89 suites / 1564 · verifier FAIL: only the `pnpm test:db` gate (`trip_photos_rls.sql` assumed an empty DB; the local DB holds real rows) + minors → Kacper D13: fixed the wrong tests (post-`reset role` counts in `trip_photos_rls.sql` and `trip_photos_storage.sql` scoped to the test's own trips / users, expected numbers unchanged); `photo:` check in updateDetails and a cover-file delete test added test-first (red 9 failed → green) → verifier PASS: 89 suites / 1570, typecheck 0, lint clean, all 4 SQL files pass on the dev DB, dev rows unchanged (1 / 3 / 6) · skills used: security-and-hardening, doubt-driven-development, source-driven-development (storage-js 2.117.2 `upload` / `createSignedUrls` / `remove`; Postgres ARE `$` and CHECK), test-driven-development · deviations: test fixtures across `src/` got a cover; TripHero / TripsDrawer / TripDetailsSheet tests keep the no-cover branch with casts until step 5; `updateDetails` makes one extra read per save; cacheKey is `cover:<uuid>:<variant>` (step 3), not the Storage path from C3. Local `psql` is missing, SQL tests ran through `docker exec` in the db container.
- Step 5 (2026-10-18): tests written (red ✓: hero, side panel and details-sheet gallery-cover cases "Expected - 2 / + Received + 1", the default preset showed because `coverUrls` was not passed; Q1 "Unable to find an element with text: Nie udało się wysłać zdjęcia okładki…" and the English one; `cover-not-current` and the two no-snackbar cases were green at once, kept as regression guards) · `TripHero` / `TripsDrawer` pass `trip.coverUrls` and lost their no-cover branches (`Plane` placeholder gone), `TripDetailsSheet` passes `urls` to the picker and starts on `trip.coverImageUri` (legacy fallback removed — the cover is Zod-required at the repository boundary), `summary.tsx` closes with `coverUploadFailed: 1` when a `file://` cover came back as a preset (D14), `HomeScreen` shows its existing snackbar once and clears the param, new key `newTrip.summary.coverUploadFailed`, stale drawer comments updated · removed tests (states the required cover forbids): hero „plain ink without a cover”, three details-sheet tests for a missing / legacy cover; drawer placeholder assertions became `trip-row-cover` assertions and the D8 surface test now checks the cover · green ✓ 89 suites / 1574, typecheck 0, lint clean · verifier PASS · skill used: frontend-ui-engineering · deviations: `router.setParams` did not clear the param from the home screen, `navigation.setParams` (the screen's own route) does; the snackbar is set during render (lint forbids setState in an effect, same pattern as `Snackbar`). Notes for Kacper: after `cover-not-current` the sheet keeps its stale value until it is reopened; a Q1 message is dropped if another snackbar is already showing.
- Step 6 (2026-10-18, `tester`, Android emulator „Medium Phone API 37.0”, Expo Go, Polish, hosted Supabase after `supabase db push` of `20261018120000_trip_covers.sql`, approved by Kacper): manual steps 1, 2, 3, 7, 8 PASS — summary without „(opcjonalnie)”, Auckland preselected with border + check, „Z galerii” last, no „Usuń”; hero sharp on Auckland, side-panel thumbnail; presets switch the preview at once without a layout jump; „Nazwa i zdjęcie” opens with the trip's preset selected and in view, saving Majorka updates the hero; a gallery photo becomes „Twoje zdjęcie” first, stays after a preset (D11), uploads and shows on the hero and in the side panel (~4 s); dark mode and font scale 1.3 fine; tiles are radios „Auckland / Bali / Pekin / Dżakarta / Majorka” with a checked state, „Z galerii” a button. **Not runnable here, for Kacper:** 4 (second phone / reinstall), 5 (offline — a Metro bundle in Expo Go cannot start offline; the offline cover cache is covered by unit tests only), 6 (Storage dashboard: old file removed after a cover change). Not triggered: the Q1 snackbar (covered by route tests). Test trips „Test okładki 1” and „Test okładki 2” stay on the hosted project for Kacper to delete. Tester questions answered from the docs: the trip ends on the return departure date (existing trips-supabase rule, not this task); the trip view and its sheets are always dark (`DarkThemeScope`, by design); the checked state is announced by the screen reader from `accessibilityState`, so the label stays the name only.

## Risks & open questions
- **P1 — How the picker looks (needs approval, the design context has no picker).**
  - Field „Zdjęcie okładki” with no „opcjonalne”.
  - At the top, a large 16:9 preview of the selected cover.
  - Under it, a horizontal row of 16:9 tiles (thumbnail files, about 112×63dp), with „Z galerii” (`ImagePlus` + label) as the last tile.
  - A gallery photo, once picked, is the first tile.
  - The selected tile has a 2dp brand-colour border and a small `Check` badge.
  - Existing tokens only, plus a new size token `size.coverTile`.
  - *Alternative:* a 2-column grid of tiles. It takes more height in the summary.
- **Q1 — A gallery cover that fails to upload when creating a trip.** The trip must exist before its files can be sent, because the Storage rules check the owner. My proposal: the trip is created with the default cover, then the photo is sent. If sending fails, the trip stays on Auckland and a snackbar says „Nie udało się wysłać zdjęcia okładki. Zmień je w „Nazwa i zdjęcie”.” *Alternative:* delete the new trip and show an error on the summary, which is stricter but loses the trip.
- **Q2 — Preset names.** City names in both languages: „Auckland”, „Bali”, „Pekin” / „Beijing”, „Dżakarta” / „Jakarta”, „Majorka” / „Mallorca”. They are used only for the screen reader.
- **Q3 — Licence of the presets.** Where are the photos from, and does their licence allow use in an app (and attribution, if needed)? Kacper's call, recorded here.
- **R1 — Majorka is portrait (640×853).** The 16:9 tile and the hero crop it. Larger originals ideally have at least 2048 px on the longer side, and their subject in the middle.
- **R2 — `System.Drawing` exists only on Windows.** The script is a one-off tool for Kacper's machine, not part of the build. The converted files are committed.
- **R3 — App size:** about 2 MB for 5 presets (C1).
- **R5 — Old dev builds** that send `cover_image_uri: null` to `create_trip` get a Postgres 23502 until rebuilt (no released users).
- **R6 — A failed gallery upload on create is silent in the repository** (Q1): the caller tells it by "asked `file://`, got a preset". `CreateTripInputSchema` also accepts `photo:` on create without a file check; the UI never sends one.
- **R7 — `updateDetails` reads, then writes** (not atomic): two of the owner's own phones changing the cover at once could overwrite each other.
- **R4 — Originals in `assets/template-images/`** are not tracked by git yet. Do we commit them (source for re-running C1) or leave them out?
