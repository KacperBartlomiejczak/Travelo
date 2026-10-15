# Task: Trip photos
Status: in progress — plan approved 2026-10-15 (with P1–P8 and the recommendations to Q1–Q5); branch `feature/trip-photos`

## Understanding & assumptions
The organizer can add **photos from the trip** from the phone's gallery to a trip. Order: feature 3 of 4 (`prompts/trips-drawer/plan.md` D1).

Later purpose (Kacper, 2026-10-08): a **community forum**, a "travel Facebook" where people share their photos (nature, places) and recommend where it is worth going. That forum will need the user's **consent** before their photos are used.

**Done means:** on the trip view of the home screen, right under the title, a row with a square „+” tile and a horizontal carousel of the trip's photos. „+” opens the gallery (up to 20 photos at once). Each photo is downscaled, loses its EXIF (and so its GPS), and is uploaded to Supabase Storage with its row (date taken, date added). It shows in the carousel at once with its sending state. Tapping a photo opens it full screen: swipe between photos, „Usuń zdjęcie” with a confirmation. Offline, the photos the phone already has still show, and „+” and delete are disabled with a hint. Deleting a trip also deletes its photos from Storage.

Assumptions (to confirm with the plan):
- **A1** — Only the trip's owner adds and deletes photos. Members linked by user ID only read them (`CLAUDE.md` RLS rule). Linking members by user ID does not exist yet, so there is no viewer-only UI; the server enforces the rule.
- **A2** — Files live in a **private** Storage bucket `trip-photos` under `<tripId>/<photoId>.jpg` (and `<tripId>/<photoId>_thumb.jpg`, Q3). The app shows them through **signed URLs** (valid 1 h). expo-image caches them on the phone under the photo's id (`cacheKey`), so a photo seen once still shows offline although its URL has expired. A public bucket was rejected: anyone with a link could open someone's holiday photos.
- **A3** — The photo list is its **own query**, not part of the trip overview. The trip shows at once, the strip loads its photos (skeleton tiles), and an error stays inside the strip (design-context §10.20 "never block the entire screen if partial content is available"). Folding photos into `TripOverview` was rejected: every trip copy and every test fixture would change.
- **A4** — Uploads run **one at a time** while the app is open; they are **not** kept on the phone (D8). Closing the app or switching the trip in the side panel mid-way loses the photos not sent yet; they are still in the gallery.
- **A5** — Sending a photo is **idempotent**: the photo id is a client UUID, the file upload overwrites (`upsert`), and the row insert ignores an id that already exists. Retrying the same photo never creates two.
- **A6** — The strip shows a square crop of each photo (`contentFit="cover"`); the viewer shows the whole photo (`contain`) on ink.
- **A7** — No pinch-to-zoom in the viewer (not asked).

## Decisions (Kacper, 2026-10-08)
- **D1 — Storage: Supabase Storage** (not only on the phone), because the forum needs the photos on the server.
- **D2 — Stored data now:**
  - the photo itself;
  - the date it was added;
  - the date it was taken (EXIF).
  
  **GPS is stripped.** Location and consent come later, together with the forum.
- **D3 — Entry point:** "trip photos" in the ⋮ menu (`prompts/trip-edit-menu/plan.md` D1). *Replaced 2026-10-15 by D4.*

## Decisions (Kacper, 2026-10-15)
- **D4 — Placement and entry point:** on the trip view of the home screen, **under the trip title** (name + dates), a row: a **square placeholder tile** with an "add photo" icon, and **to its right a horizontal carousel** of the trip's photos.
- **D5 — Later purpose:** a slideshow to show the trip to family, and the forum. Neither is built in this feature.
- **D6 — Tapping a photo** opens it **full screen**; swiping moves between photos; "Usuń zdjęcie" there, with a confirmation. No slideshow.
- **D7 — Adding:** the tile opens the gallery with **several photos at once** (up to 20 per pick), **no cropping**; photos are **downscaled before upload** (longer side ~2048 px) and GPS is stripped (D2); each photo shows in the carousel at once with its upload progress. **No limit** per trip.
- **D8 — Online only:** without internet the add tile and "Usuń zdjęcie" are disabled with a hint (as rename / delete in trip-edit-menu D5); the carousel shows the photos the phone already has. The offline scope in `CLAUDE.md` does not change.
- **D9 — Covers are a separate plan:** preset covers, the required cover and uploading a gallery cover to Storage are `prompts/trip-covers/plan.md`, done right after this feature (it uses this feature's Storage).
- **D10 — Order:** by the date the photo was taken, oldest first (chronological, for the later slideshow). Confirmed with the intent restate ("kontynuuj", 2026-10-15).
- **D11 — No "photos" item in the ⋮ menu:** the add tile is the entry point (replaces D3). Confirmed with the intent restate.
- **Out of scope (confirmed):** slideshow, forum, publishing consent, photo location, uploading offline, taking photos with the camera (gallery only), captions, editing or cropping trip photos.
- **Plan approved** by Kacper on 2026-10-15 ("Akceptuję plan trip-photos razem z P1–P8 i rekomendacjami do Q1–Q5 (w tym obie nowe zależności)"), so:
  - **D12 (Q1)** — the date taken is the camera's clock as is (`LocalDateTimeSchema`, `timestamp without time zone`), a written exception to "timestamps with offset";
  - **D13 (Q2)** — photos without a date taken go at the end, in the order they were added;
  - **D14 (Q3)** — a thumbnail (longer side 480 px) is uploaded next to each photo; the strip uses thumbnails, the viewer the full photo;
  - **D15 (Q4)** — sending shows a spinner per tile and the „Wysyłam zdjęcia: 3 z 10” line, no per-byte bar;
  - **D16 (Q5)** — new dependencies `expo-image-manipulator` (new native module → new dev build) and `expo-file-system` (direct dependency, already installed with `expo`);
  - P1–P8 as written, including P7 (deleting a trip deletes its photos) and the copy in P8.
- **Decisions after step 3** (Kacper, 2026-10-15; this machine has no `psql`, Docker or local Supabase):
  - **D17 (R1)** — steps 4–5 are written now: migrations, SQL tests, and `database.types.ts` updated by hand in the generator's exact format. Kacper later runs `pnpm supabase start`, `DB_URL=… pnpm test:db` and `pnpm db:types`; the generated file must come out identical. Steps 4–5 stay `[ ]` until then, and the next steps continue meanwhile, as trip-edit-menu step 2 did.
  - **D18 (P9)** — the iOS `photosPermission` text becomes „Travelo uses your photos so you can add them to a trip and choose its cover.” (step 10, `app.json`).
  - **D19** — one commit per step (conventional, English), not pushed until Kacper says so.
  - **D20** — `.env` is added to `.gitignore`; `.env.example` goes back to empty values (the real ones stay in `.env`).
- **D21 (Kacper, 2026-10-15, replaces D17)** — Docker Desktop is running on this machine ("doker jest odpalony mozesz sprawdzic teraz").
  - Local Supabase is started here with `pnpm supabase start`; migrations are applied with `pnpm supabase migration up`; types come from `pnpm db:types`. Nothing is written by hand.
  - There is no `psql` on the host, so `pnpm test:db` runs the same files through the database container's `psql` (`docker exec -i <db container> psql …`). `scripts/test-db.sh` is unchanged.
  - Steps 4–5 therefore get a real red → green.
  - The first try at step 4 (under D17) ended when the session stopped, before any file was written.

## Proposals (design-context has no carousel or photo viewer — Kacper approves or changes them with the plan)
- **P1 — Where the strip sits:** directly **under the hero** (the photo has faded into ink there, so it reads as "under the title"), as the first element of the content column, before „Loty”. It scrolls sideways; its first tile lines up with the cards' side padding (20dp, 16dp below 360dp). *Alternative:* inside the hero, under the date line. Rejected because a 2-line name at large Dynamic Type would not fit in half the screen.
- **P2 — Tiles:** square **80dp** tiles (new token `size.photoTile`), `radius.md` (12dp), 8dp apart (`spacing[2]`). The „+” tile has a `surface.secondary` background and an `ImagePlus` icon (24dp) in `text.secondary`, with the screen reader label „Dodaj zdjęcia”. With no photos yet, a one-line hint sits next to „+”: „Dodaj zdjęcia z tej podróży.”
- **P3 — States in the strip:**
  - **Loading:** three static skeleton tiles (§10.18).
  - **Error:** „Nie udało się wczytać zdjęć.” and a ghost „Spróbuj ponownie” next to „+”.
  - **Sending:** each photo shows its own preview under `overlay.scrim` with a small spinner, and a line under the strip reads „Wysyłam zdjęcia: 3 z 10” (polite live region). There is no per-byte bar (Q4).
  - **Failed:** a `CircleX` over the preview, plus a line „Nie udało się wysłać 2 zdjęć” with „Spróbuj ponownie”, which sends all failed photos again. Tapping a failed tile sends that photo again.
  - **Offline:** „+” is disabled (opacity 0.4, §10.2) and „Bez internetu nie dodasz ani nie usuniesz zdjęć.” shows under the strip.
- **P4 — Viewer (full screen, always ink like the trip view):**
  - The photo fills the screen whole (`contain`) and you swipe left / right between photos.
  - Top left: „Zamknij” (`X`); top right: „Usuń zdjęcie” (`Trash2`). Both are round `HeroIconButton`s, as over the hero.
  - A counter „3 z 12” in Caption, `hero.textSecondary`.
  - System back closes. The status bar is light.
  - Offline, delete is disabled.
  - A photo that is not on the phone and cannot load shows „Nie udało się wczytać zdjęcia.”
- **P5 — Delete confirmation:** a bottom sheet like `DeleteTripSheet`: „Usunąć to zdjęcie?”, „Zniknie z tej podróży. Tego nie da się cofnąć.”, a destructive „Usuń zdjęcie” above „Anuluj”. After a delete the viewer shows the next photo (the previous one when it was the last), and closes when none is left. No snackbar: the photo visibly disappears.
- **P6 — Upload order on the screen:** a photo being sent already takes its place by date taken, as it will after sending (no jump). The strip does not scroll by itself; the „Wysyłam zdjęcia” line says what is happening.
- **P7 — Deleting a trip deletes its photos too:**
  - The trip's files are removed from Storage **before** the trip row. If that fails, nothing else is deleted and the error shows as today, so no personal photos are left on the server.
  - The rows go with the trip by cascade.
  - The delete sheet's body becomes „Znikną loty, uczestnicy, budżet i zdjęcia. Tego nie da się cofnąć.” (EN „Flights, members, budget and photos will be gone. This can't be undone.”).
- **P8 — Copy:**

  | key | PL | EN |
  |---|---|---|
  | `tripPhotos.title` (strip's accessibility label) | Zdjęcia z podróży | Trip photos |
  | `tripPhotos.add` | Dodaj zdjęcia | Add photos |
  | `tripPhotos.emptyHint` | Dodaj zdjęcia z tej podróży. | Add photos from this trip. |
  | `tripPhotos.photo` (tile label) | Zdjęcie {{index}} z {{count}} | Photo {{index}} of {{count}} |
  | `tripPhotos.sending` | Wysyłam zdjęcia: {{done}} z {{total}} | Sending photos: {{done}} of {{total}} |
  | `tripPhotos.failed` (one / other) | Nie udało się wysłać {{count}} zdjęcia / zdjęć | {{count}} photo couldn't be sent / {{count}} photos couldn't be sent |
  | `tripPhotos.retry` | Spróbuj ponownie | Try again |
  | `tripPhotos.loadError` | Nie udało się wczytać zdjęć. | Couldn't load the photos. |
  | `tripPhotos.offlineHint` | Bez internetu nie dodasz ani nie usuniesz zdjęć. | You need internet to add or delete photos. |
  | `tripPhotos.pickError` | Nie udało się otworzyć galerii. | Couldn't open the gallery. |
  | `photoViewer.close` | Zamknij | Close |
  | `photoViewer.counter` | {{index}} z {{count}} | {{index}} of {{count}} |
  | `photoViewer.delete` | Usuń zdjęcie | Delete photo |
  | `photoViewer.loadError` | Nie udało się wczytać zdjęcia. | Couldn't load the photo. |
  | `deletePhoto.title` | Usunąć to zdjęcie? | Delete this photo? |
  | `deletePhoto.body` | Zniknie z tej podróży. Tego nie da się cofnąć. | It will be removed from this trip. This can't be undone. |
  | `deletePhoto.confirm` | Usuń zdjęcie | Delete photo |
  | `deletePhoto.cancel` | Anuluj | Cancel |
  | `deletePhoto.error` | Nie udało się usunąć zdjęcia. Spróbuj ponownie. | Couldn't delete the photo. Try again. |
  | `deleteTrip.body` (changed, P7) | Znikną loty, uczestnicy, budżet i zdjęcia. Tego nie da się cofnąć. | Flights, members, budget and photos will be gone. This can't be undone. |

## Approach
- **Server (steps 4–5):** two migrations, so the table can be checked on plain Postgres like before. The bucket and Storage policies need Supabase's `storage` schema (R1).
  - `trip_photos` table with RLS: the owner reads, inserts and deletes; a linked member only reads; no updates.
  - A private bucket `trip-photos` (JPEG only, 10 MB per file) with policies on `storage.objects`:
    - insert only into a folder of a trip you own;
    - read your own files, or files of a trip you are linked to;
    - update and delete only your own files.
  - Upsert needs insert + select + update (`supabase` skill checklist).
- **Device copy (step 6):** SQLite migration v3 adds `trip_photos_cache` (one JSON list per trip, parsed with Zod). The list prune (`cacheList`) and `forgetTrip` drop it with the trip's other copies.
- **Photo files (step 7):** `preparePhoto(uri)` in `src/data/photo-files.ts`:
  - `expo-image-manipulator` re-encodes to JPEG (quality 0.8), which drops EXIF, so no GPS goes to the server (D2). The longer side becomes at most 2048 px, never upscaled (D7), and the thumbnail's at most 480 px (Q3).
  - `expo-file-system`'s `File.bytes()` reads the bytes for upload.
  - The date taken comes from the picker's EXIF (`DateTimeOriginal`) before re-encoding; nothing else from EXIF is read.
- **Repository (step 8):** `TripRepository` gets three methods.
  - `photos(tripId)`: the rows, then one `createSignedUrls` call for the files and thumbnails. Results are sorted (D10, Q2), saved as the trip's copy, and returned. When the server is unreachable it returns the copy; with no copy it throws.
  - `addPhoto(tripId, photoId, picked)`: prepare → upload the thumbnail and the file (`upsert`) → insert the row (`ignoreDuplicates`, A5) → seed expo-image's cache with the local thumbnail, so the tile does not download it again.
  - `deletePhoto(photo)`: deletes the row, then the two files. If the file removal fails after the row is gone, the files stay behind (R6).
  - `delete(tripId)` first lists the trip's folder and removes its files (P7).
  - The in-memory repository mirrors all of this for tests.
- **Hooks (step 9):**
  - `useTripPhotos(tripId)`: query `['trip-photos', tripId]`, `networkMode: 'always'` so the offline copy answers. The key sits outside `['trips']`, so budget saves and renames do not re-sign every photo.
  - `usePhotoUploads(tripId)`: in-memory queue, one upload at a time. Each item is `waiting | sending | failed`, with retry for one or for all. After each success it invalidates the photos query.
  - `useDeleteTripPhoto()`.
- **Strip (steps 10–11):** `src/features/trip-photos/PhotoStrip.tsx` with `PhotoTile`, using the existing `useIsOffline`. The „+” tile calls `pickTripPhotos()`: `launchImageLibraryAsync` with `allowsMultipleSelection`, `selectionLimit: 20` and `exif: true`; each asset is parsed with `PickedPhotoSchema`. `CurrentTrip` renders the strip right after `TripHero` (P1).
- **Viewer (step 12):** route `src/app/trips/[tripId]/photos.tsx?photoId=…` (`fullScreenModal`, no header). It reads the same query and shows a horizontal paging `FlatList` (`initialScrollIndex`, fixed item width = window). The delete sheet is a `BottomSheet` over it. A route, not a Modal inside `CurrentTrip`, so the delete sheet's Modal never opens on top of another Modal (trip-edit-menu A6).
- **Rejected:** uploading through `File.createUploadTask` with a signed upload URL for a real per-byte progress bar. It needs more code and a second upload path (Q4).

## Data structures (Zod)
New `src/schemas/trip-photo.ts` (exported from `src/schemas/index.ts`):
```ts
/** One photo of a trip (D2). Files in Storage: photoPaths(photo); GPS is never stored. */
export const TripPhotoSchema = z.object({
  id: z.uuid(),                              // client UUID (A5)
  tripId: z.uuid(),
  /** When it was taken: the camera's own clock from EXIF DateTimeOriginal, no offset (Q1); absent when the file has none. */
  takenAt: LocalDateTimeSchema.optional(),
  /** When it was added (D2). */
  createdAt: IsoDateTimeSchema,
});
export type TripPhoto = z.infer<typeof TripPhotoSchema>;

/** A photo as the app shows it: signed URLs of the file and its thumbnail (A2). */
export const ShownTripPhotoSchema = TripPhotoSchema.extend({ url: z.url(), thumbnailUrl: z.url() });
export type ShownTripPhoto = z.infer<typeof ShownTripPhotoSchema>;

/** The trip's photos in display order (D10, Q2); also the phone's copy (D8). */
export const TripPhotoListSchema = z.array(ShownTripPhotoSchema);
export type TripPhotoList = z.infer<typeof TripPhotoListSchema>;

/** One photo from the gallery before it is sent (the picker's result is a boundary). */
export const PickedPhotoSchema = z.object({ uri: z.string().min(1), takenAt: LocalDateTimeSchema.optional() });
export type PickedPhoto = z.infer<typeof PickedPhotoSchema>;
```
- `LocalDateTimeSchema` is the existing minute-precision wall clock (`common.ts:34`). Photos taken in the same minute keep the order they were added.
- Server table (migration `<ts>_trip_photos.sql`):
  ```sql
  create table public.trip_photos (
    id uuid primary key,
    trip_id uuid not null references public.trips (id) on delete cascade,
    taken_at timestamp without time zone,      -- the camera's clock (Q1)
    created_at timestamptz not null
  );
  create index trip_photos_trip_id_idx on public.trip_photos (trip_id);
  -- RLS: select = owner or linked member; insert / delete = owner; no update. Grants: authenticated select, insert, delete.
  ```
- Storage (migration `<ts>_trip_photos_storage.sql`):
  - bucket `trip-photos` (`public = false`, `file_size_limit = 10485760`, `allowed_mime_types = {image/jpeg}`);
  - a `private.trip_id_of_object(name text) returns uuid` helper, which returns null for a malformed path instead of failing;
  - policies on `storage.objects` (A2, Approach).
- SQLite v3: `trip_photos_cache (trip_id text primary key, photos_json text not null, cached_at text not null)`, read with `TripPhotoListSchema`.
- Order (D10, Q2): by `takenAt`, oldest first; photos without `takenAt` at the end, in the order they were added (`createdAt`, then `id`).
- After the migration: `pnpm db:types` → `database.types.ts`; `photoFromRow` / `toPhotoRow` typecheck against it (parity, as in trips-supabase step 4).
- `GLOSSARY.md` gets "Trip photo" (`domain-modeling`).

## Tests
- **Step 2 (schemas)** `src/schemas/__tests__/trip-photo.test.ts`:
  - **Valid:** with and without `takenAt`; a shown photo with URLs; an empty list.
  - **Invalid:** not a UUID; `takenAt` with seconds, with an offset, or on an impossible date; `createdAt` without an offset; a URL that is not a URL; an empty `uri`.
- **Step 3 (pure logic)** `src/lib/__tests__/trip-photos.test.ts`:
  - `takenAtFromExif`:
    - reads `DateTimeOriginal` (`2026:10:14 18:03:22` → `2026-10-14T18:03`);
    - falls back to `DateTime`;
    - `0000:00:00 00:00:00`, garbage, a missing tag, and `null` / undefined exif give none.
  - `sortTripPhotos`: by date taken; same minute → by added; no date → at the end, by added; stable for equal values.
  - `photoPaths`: `<trip>/<id>.jpg` and `<trip>/<id>_thumb.jpg`.
  - `fitWithin`: landscape, portrait, square, already small (no upscale), 0 sizes.
- **Step 4 (table)** `supabase/tests/trip_photos_rls.sql` (`pnpm test:db`):
  - The owner inserts, reads and deletes their trip's photos.
  - A stranger cannot read, insert into or delete another trip's photos.
  - A linked member reads but cannot insert or delete.
  - `anon` gets nothing, and nobody can update.
  - Deleting the trip deletes its photos (cascade).
  - Repeating an insert with the same id under `on conflict do nothing` adds nothing.
  - Row mapping (`src/data/__tests__/trip-rows.test.ts`): round trip; null `taken_at` → no `takenAt`; Postgres `+00:00` timestamps; a bad row throws.
- **Step 5 (Storage)** `supabase/tests/trip_photos_storage.sql`:
  - **Owner:** can insert a file into their trip's folder, but not into another trip's folder or a malformed path; can update and delete their own file.
  - **Linked member:** can read the trip's files, but not insert or delete.
  - **Stranger:** can read nothing.
  - **Bucket:** private, JPEG only, 10 MB limit.
- **Step 6 (SQLite)** `src/data/__tests__/local-db.test.ts`, `local-store.test.ts`:
  - v2 → v3 migration on an existing database;
  - save / read a photo copy per trip;
  - a corrupt copy reads as none;
  - `cacheList` drops copies of trips no longer listed;
  - `forgetTrip` drops the trip's photo copy and keeps other trips'.
- **Step 7 (files)** `src/data/__tests__/photo-files.test.ts`, with `expo-image-manipulator` and `expo-file-system` mocked:
  - resizes the longer side to 2048 (file) and 480 (thumbnail); no resize when already small;
  - saves JPEG at 0.8 and returns both byte arrays;
  - a manipulator failure rejects.
- **Step 8 (repository)** `supabase-trip-repository.test.ts`, `trip-repository.test.ts`; `fake-supabase` gets a recorded `storage.from(bucket)` (upload, createSignedUrls, list, remove):
  - **`photos`:** the query for one trip; one signing call for every file and thumbnail; sorted; cached; unreachable → the copy; no copy → rejects; a row that fails Zod → rejects; signing error → rejects.
  - **`addPhoto`:**
    - prepares, then uploads the thumbnail and the file with the right paths, `contentType: 'image/jpeg'` and `upsert: true`, then inserts the row with `ignoreDuplicates`;
    - seeds the image cache;
    - unreachable → `ServerUnreachableError`; an upload error → rejects and no row is inserted;
    - retrying the same id sends the same paths and id (A5).
  - **`deletePhoto`:** the row, then both files; 0 rows deleted (not the owner) → rejects and the files are kept.
  - **`delete(trip)`:** lists and removes the folder's files, then deletes the trip. A removal error → rejects and the trip is not deleted. An empty folder works as today, and the existing delete tests still pass.
  - **In-memory repository:** the same behaviour, without files.
- **Step 9 (hooks)** `src/hooks/__tests__/useTripPhotos.test.tsx`:
  - **`useTripPhotos`:** answers offline from the copy.
  - **`usePhotoUploads`:**
    - one upload at a time, in pick order, with statuses waiting → sending → done;
    - a failure leaves the item `failed`, and the next photo is still sent;
    - retrying one or all;
    - the photos query is invalidated after each success;
    - no new upload starts while offline.
  - **`useDeleteTripPhoto`:** invalidates the photos query.
- **Step 10 (strip)** `src/features/trip-photos/__tests__/PhotoStrip.test.tsx`:
  - the „+” tile has its label and its press opens the picker with `allowsMultipleSelection`, `selectionLimit: 20` and `exif: true`;
  - a cancelled pick does nothing; a picker error shows `pickError`;
  - no photos → the hint;
  - the tiles are in order and labelled „Zdjęcie 2 z 5”;
  - loading → skeletons; error → message + retry refetches;
  - sending → the status line; failed → the line + retry;
  - offline → „+” is disabled and the hint shows;
  - pressing a tile navigates to the viewer with its id;
  - tokens only (theme test for `size.photoTile`).
  - Plus the i18n key parity test.
- **Step 11 (home)** `src/__tests__/app/home.test.tsx`: the strip is right after the hero and before „Loty”, with the trip's photos from the in-memory repository; offline the strip shows the copy and the disabled „+”; the existing home tests still pass.
- **Step 12 (viewer)** `src/__tests__/app/trips/photos.test.tsx`, `src/features/trip-photos/__tests__/DeletePhotoSheet.test.tsx`:
  - opens on the tapped photo and the counter says „3 z 12”; swiping changes the counter;
  - close and Android back return home;
  - delete → sheet → confirm → the next photo shows (the previous one after the last; it closes when none is left);
  - a delete error shows inline and the sheet cannot be dismissed while deleting;
  - offline → delete is disabled;
  - an unknown `photoId` opens on the first photo, and no photos → it closes.

## Files
- **Create:**
  - `src/schemas/trip-photo.ts`;
  - `src/lib/trip-photos.ts`;
  - `supabase/migrations/<ts>_trip_photos.sql`, `supabase/migrations/<ts>_trip_photos_storage.sql`;
  - `supabase/tests/trip_photos_rls.sql`, `supabase/tests/trip_photos_storage.sql`;
  - `src/data/photo-files.ts`;
  - `src/hooks/useTripPhotos.ts`;
  - `src/features/trip-photos/` (`PhotoStrip.tsx`, `PhotoTile.tsx`, `pick-trip-photos.ts`, `PhotoViewer.tsx`, `DeletePhotoSheet.tsx`);
  - `src/app/trips/[tripId]/photos.tsx`;
  - a test for each of the above.
- **Modify:**
  - `src/schemas/index.ts`;
  - `src/data/database.types.ts` (generated);
  - `src/data/trip-rows.ts` (`photoFromRow`, `toPhotoRow`);
  - `src/data/local-db.ts` (v3), `src/data/local-store.ts`;
  - `src/data/trip-repository.ts` (interface and in-memory), `src/data/supabase-trip-repository.ts`;
  - `src/test/fake-supabase.ts` (`storage`);
  - `src/features/home/CurrentTrip.tsx`;
  - `src/app/_layout.tsx` (the viewer screen's options);
  - `src/theme/tokens.ts` (`size.photoTile`);
  - `app.json` (the iOS `photosPermission` text, D18, step 10);
  - `src/i18n/locales/pl.json`, `en.json`;
  - `jest.setup.ts` (mocks for `expo-image-manipulator` and `expo-file-system`);
  - `package.json` and `pnpm-lock.yaml` (two packages, Q5);
  - `GLOSSARY.md`;
  - their existing tests.
- **Untouched:** `TripOverview`, the wizard, `CoverPicker` (trip-covers).

## Skills
- `test-driven-development` + `incremental-implementation` — every step with behaviour (2–12): red → green, one coherent diff per step.
- `domain-modeling` — step 2: the "trip photo" entity and its glossary entry.
- `supabase` + `supabase-postgres-best-practices` — steps 4–5: table, bucket, Storage policies, index, the security checklist (upsert = insert + select + update).
- `security-and-hardening` + `doubt-driven-development` — steps 4, 5, 8: RLS / Storage access, personal photos, deleting files.
- `source-driven-development` — steps 1, 7, 8, 10, 12: `expo-image-manipulator` (`manipulate` / `renderAsync` / `saveAsync`), `expo-file-system` (`File.bytes()`), `expo-image` (`cacheKey`, `writeToCacheAsync`), `expo-image-picker` (`allowsMultipleSelection`, `selectionLimit`, `exif`), supabase-js Storage (`upload`, `createSignedUrls`, `list`, `remove`). Checked in the docs 2026-10-15, cited again in the progress log.
- `api-and-interface-design` — step 8: the three repository methods and the changed `delete`.
- `frontend-ui-engineering` — steps 10–12: states, accessibility, Dynamic Type.
- `ui-taste` — verifier, steps 10–12.
- `code-review-and-quality` — verifier, every step.

## Steps
- [x] 1. [frontend] Install `expo-image-manipulator` and `expo-file-system` (Q5) and add their Jest mocks — skill: source-driven-development — **no tests first: pure setup**, named here so it is approved; no behaviour, the mocks are exercised by steps 7–8 — verify: `npx expo install` versions match `bundledNativeModules.json` (both `~57.0.x`), full suite, typecheck, lint.
- [x] 2. [backend] Zod: `trip-photo.ts` + `GLOSSARY.md` — skill: domain-modeling, test-driven-development — tests first: step 2 list — verify: red → green, full suite, typecheck, lint; verifier.
- [x] 3. [backend] Pure logic `src/lib/trip-photos.ts` — skill: test-driven-development — tests first: step 3 list — verify: as above; verifier.
- [x] 4. [backend] Migration `trip_photos` + RLS, SQL tests, types, row mapping — skill: supabase, supabase-postgres-best-practices, security-and-hardening, doubt-driven-development — tests first: step 4 list — verify: `pnpm test:db` red → green, `pnpm db:types`, parity (typecheck), full suite, lint; verifier.
- [x] 5. [backend] Migration Storage bucket + policies, SQL tests — skill: supabase, security-and-hardening, doubt-driven-development — tests first: step 5 list — verify: `pnpm test:db` against a local Supabase (R1); verifier.
- [x] 6. [backend] SQLite v3 + `LocalStore` photo copy — skill: test-driven-development — tests first: step 6 list — verify: red → green, full suite, typecheck, lint; verifier.
- [x] 7. [backend] `photo-files.ts` (downscale, thumbnail, bytes) — skill: source-driven-development, test-driven-development — tests first: step 7 list — verify: as above; verifier.
- [ ] 8. [backend] Repository `photos` / `addPhoto` / `deletePhoto`, trip delete removes files (P7), fake Storage — skill: api-and-interface-design, source-driven-development, security-and-hardening, doubt-driven-development — tests first: step 8 list — verify: as above; verifier.
- [ ] 9. [frontend] Hooks `useTripPhotos`, `usePhotoUploads`, `useDeleteTripPhoto` — skill: test-driven-development — tests first: step 9 list — verify: as above; verifier.
- [ ] 10. [frontend] `size.photoTile`, i18n (P8), `PhotoStrip` + `PhotoTile` + `pickTripPhotos` — skill: frontend-ui-engineering, source-driven-development — tests first: step 10 list — verify: as above; verifier (+ ui-taste).
- [ ] 11. [frontend] Strip in `CurrentTrip` (P1), `deleteTrip.body` (P7) — skill: frontend-ui-engineering — tests first: step 11 list — verify: as above; verifier.
- [ ] 12. [frontend] Viewer route + `DeletePhotoSheet` (P4, P5) — skill: frontend-ui-engineering, source-driven-development — tests first: step 12 list — verify: as above; verifier (+ ui-taste).
- [ ] 13. [tester] Device run of the manual steps below on a new dev build (R2) — skill: none — verify: tester PASS per scenario; the steps the emulator cannot cover go to Kacper's phone.

## Manual test steps (Kacper / tester)
1. Trip view → right under the hero: the „+” tile and „Dodaj zdjęcia z tej podróży.”; without and with a cover photo.
2. „+” → the gallery lets you pick several, at most 20 → pick 5. They show at once with spinners; „Wysyłam zdjęcia: 1 z 5” counts up; then the thumbnails show, ordered by date taken.
3. Restart the app → the photos are still there.
4. Supabase dashboard → Storage → `trip-photos/<tripId>/` → download a photo. It has **no GPS / EXIF** (photo info on the phone or `exiftool`), its longer side is ≤ 2048 px, and the `_thumb` is ≤ 480 px. A **portrait** photo, taken upright on an iPhone and on an Android phone, is upright in the strip, in the viewer and in the downloaded file (EXIF orientation is applied before the EXIF is dropped; step 7 finding).
4b. Android: pick 20 large photos (~12 MP) at once. All are sent one after another without the app closing or slowing down badly, and there is no "native object already released" error (step 7 releases native memory explicitly).
5. Tap a photo → full screen, swipe left / right, the counter changes; „Zamknij” and the system back close it.
6. „Usuń zdjęcie” → the sheet → „Usuń zdjęcie” → the next photo shows; deleting the last one closes the viewer.
7. Airplane mode → the photos already seen show in the strip and the viewer; „+” and delete are disabled with the hint; a photo never opened full screen shows „Nie udało się wczytać zdjęcia.”
8. Pick 5 photos, then turn off Wi-Fi mid-way → the rest fail with „Nie udało się wysłać …” → back online → „Spróbuj ponownie” sends them, without duplicates.
9. Delete the trip → its folder in Storage is empty.
10. Screen reader: „Dodaj zdjęcia”, „Zdjęcie 2 z 7”, the viewer's buttons and counter.
11. Largest font size: the strip still works and the hint wraps.

## Progress log
- Step 1 (2026-10-15, frontend agent): pure setup, no tests first (approved).
  - **What changed:**
    - `package.json` got `expo-file-system ~57.0.7` and `expo-image-manipulator ~57.0.20`; 57.0.21 is installed, in range and matching `bundledNativeModules.json`.
    - `pnpm-lock.yaml`: only the two packages, plus harmless `libc` metadata lines on a few optional native packages.
    - `jest.setup.ts`: global mocks (`ImageManipulator.manipulate(...).resize().renderAsync()` → `saveAsync()`, `SaveFormat`; `File` with `bytes()` on the prototype), matching the real typings.
  - **Extra test:** `src/test/__tests__/native-mocks.test.ts` (2 tests). They exercise the mocks with the calls the photo code will make and typecheck against the real packages, so the mocks cannot drift. red ✓ without the mocks → green ✓.
  - **No `app.json` change.** `expo-image-manipulator` has no config plugin; `expo-file-system`'s plugin only adds storage permissions and iOS file-sharing flags we don't use, and it is not listed.
  - **Deviation:** `npx expo install` under pnpm 12 rewrote ~1,700 lockfile lines (peer suffixes). The agent reset both files and relocked with `npx pnpm@10 add --lockfile-only`. `pnpm install --frozen-lockfile` (pnpm 12) then reports "up to date". Note: avoid `pnpm add` / `expo install` with pnpm 12 here.
  - **Checks:** suite 70 suites / 898 tests ✓, typecheck ✓, lint ✓.
  - **Verifier:** PASS. Its notes:
    - the global `expo-file-system` stub replaces jest-expo's default mock, so steps 7–8 stub `File` per test;
    - `app.json`'s iOS `photosPermission` text speaks only of a cover photo; raised with Kacper (P9 below).
  - **Skill used:** source-driven-development (the installed packages' typings and plugin source).
- Step 2 (2026-10-15, backend agent).
  - **What changed:**
    - `src/schemas/trip-photo.ts`: `TripPhotoSchema`, `ShownTripPhotoSchema`, `TripPhotoListSchema`, `PickedPhotoSchema` and their `z.infer` types, reusing `LocalDateTimeSchema` / `IsoDateTimeSchema`; the `takenAt` JSDoc states the D12 exception.
    - Exported from `src/schemas/index.ts`.
    - `GLOSSARY.md` has a "Trip photo" entry in `## Trip`.
  - **Tests:** `src/schemas/__tests__/trip-photo.test.ts`, 40 tests. red ✓ (all failed with `Cannot read properties of undefined (reading 'safeParse')`, module missing) → green ✓.
  - **Deviation (orchestrator's call, security-and-hardening):** `url` / `thumbnailUrl` use `z.url({ protocol: /^https?$/ })`, not plain `z.url()`.
    - Zod 4.6.5's `z.url()` accepts `javascript:`, `file:`, `data:` and `ftp:`; signed Supabase URLs are always http(s).
    - `z.httpUrl()` was rejected because it refuses `http://127.0.0.1:54321/…` (local Supabase).
    - Reject tests were added: red ✓ (`Expected: false, Received: true`) → green ✓.
  - **Checks:** suite 71 / 938 ✓, typecheck ✓, lint ✓.
  - **Verifier:** PASS. Note: the glossary entry also mentions the strip and the viewer (UI detail); kept for now.
  - **Skill used:** domain-modeling, test-driven-development.
- Step 3 (2026-10-15, backend agent).
  - **What changed:** `src/lib/trip-photos.ts` exports `PHOTO_MAX_SIDE` (2048), `THUMBNAIL_MAX_SIDE` (480) and four functions:
    - `takenAtFromExif`: `DateTimeOriginal`, then `DateTime` → `YYYY-MM-DDTHH:mm`, validated with `LocalDateTimeSchema`; no other tag is read;
    - `sortTripPhotos`: date taken, then added (as instants), then id; undated photos last; the input is not mutated;
    - `photoPaths`;
    - `fitWithin`: never upscales; returns null for 0 or non-finite sizes.
  - **Tests:** `src/lib/__tests__/trip-photos.test.ts`, 30 tests. red ✓ ("Could not locate module @/lib/trip-photos") → green ✓.
  - **Checks:** suite 72 / 968 ✓, typecheck ✓, lint ✓.
  - **Verifier:** PASS. Minor notes, not changed:
    - `compareTakenAt` uses a nested ternary;
    - an EXIF value with trailing characters is treated as unusable (a `.trim()` could be added if a device shows that).
  - **Skill used:** test-driven-development.
- Step 4 (2026-10-15, backend agent, local Supabase per D21).
  - **What changed:**
    - `supabase/migrations/20261015182337_trip_photos.sql`: table `trip_photos` (FK with cascade, `taken_at timestamp without time zone`, `created_at timestamptz not null`), index on `trip_id`.
    - RLS: select = owner or linked member, insert / delete = owner, no update policy.
    - Grants: authenticated select / insert / delete, `service_role` all, nothing for anon.
    - Applied locally with `pnpm supabase migration up` (not pushed).
    - `src/data/database.types.ts` regenerated with `pnpm db:types` (only the new table; plain UTF-8, LF).
    - `src/data/trip-rows.ts`: `PhotoRow`, `photoFromRow` (keeps `YYYY-MM-DDTHH:mm`; PostgREST returns `taken_at` as `2026-10-14T18:03:00`), `toPhotoRow`.
  - **SQL tests:** `supabase/tests/trip_photos_rls.sql` covers:
    - owner A: insert / read / delete; idempotent `on conflict do nothing`; `created_at` required; no update;
    - stranger B, **owner of another trip**: reads none of A's photos, cannot insert into A's trip, cannot take A's photo id; deletes by id, by trip and without `WHERE` remove none of A's photos;
    - linked member C: reads, cannot write;
    - anon: nothing;
    - deleting a trip cascades.
  - **Red / green:** red ✓ (`relation "public.trip_photos" does not exist`) → green ✓ ("trip_photos_rls: all checks passed"); `trips_rls.sql` still green.
  - **Mutation checks** (live DB only, each restored), every one caught:
    - RLS off; select / insert / delete open; select owner only; update granted; select granted to anon; FK without cascade; `created_at` nullable;
    - after the verifier's note, also the three "owner of ANY trip" variants of select / insert / delete.
  - **Jest:** 12 new tests in `trip-rows.test.ts`. red ✓ (`toPhotoRow is not a function`) → green ✓.
  - **Checks:** suite 72 / 980 ✓, typecheck (= parity with the regenerated types) ✓, lint ✓. The orchestrator re-ran both SQL files: green.
  - **Verifier:** PASS.
    - It ran both SQL files and regenerated the types into a scratch file (identical).
    - Its note that B owned no trip (so "owner of any trip" policies slipped through) was fixed before `[x]`.
    - Its notes, not changed: `created_at` is client-supplied (owner only, affects order only); reusing another trip's photo id with `on conflict do nothing` is a silent no-op that leaks nothing.
  - **Finding:** a delete with `WHERE` is filtered by the select policy, so only an unqualified delete tests the delete policy on its own; the test has one.
  - **Skill used:** supabase, supabase-postgres-best-practices, security-and-hardening, test-driven-development; verifier: doubt-driven-development.
- Step 5 (2026-10-15, backend agent, local Supabase per D21).
  - **What changed:** `supabase/migrations/20261015184306_trip_photos_storage.sql`, applied locally (not pushed). It adds:
    - **Bucket** `trip-photos`: private, 10 MiB, `image/jpeg` only. It is a plain insert, so it fails loudly if the bucket already exists.
    - **Helper** `private.trip_id_of_object(name)` (immutable, `search_path = ''`, execute for `authenticated` only): returns the trip id only for `^<lowercase uuid>/<lowercase uuid>(_thumb)?\.jpg$`, else null; it never raises.
    - **Policies** on `storage.objects`, all `to authenticated` and scoped to the bucket:
      - insert: own `owner_id` + `is_trip_owner(folder)`;
      - select: own `owner_id` or `is_trip_viewer(folder)`;
      - update: using own `owner_id`; with check own `owner_id` + bucket + `is_trip_owner(folder)`;
      - delete: own `owner_id`.
      - Owner-based select / delete is deliberate: the organizer can clean up files even of a trip already gone (P7, R6). A linked member reads by trip.
  - **Findings:**
    - The Storage server writes the JWT `sub` into `owner_id` (text) and `owner` (uuid).
    - Supabase blocks direct SQL deletes unless `storage.allow_delete_query = 'true'` (the server sets it per transaction), so only the Storage API deletes files.
    - `storage` is not exposed over REST.
  - **SQL tests:** `supabase/tests/trip_photos_storage.sql` covers:
    - the bucket row;
    - the helper on 31 malformed names;
    - owner A: own uploads, upsert, update, delete; refused into B's folder, a missing trip, bad names (uppercase ids included), another owner, another bucket, moves out of the folder;
    - stranger B, who owns another trip;
    - linked member C;
    - anon;
    - other buckets untouched.
    - Unqualified update / delete statements are included (the step 4 finding).
  - **Red / green:** red ✓ (`ERROR: FAILED: the trip-photos bucket exists`; the verifier reproduced it in a rolled-back transaction) → first green attempt had one test-side failure (default collation sorts `_thumb.jpg` first; fixed with `collate "C"`, no assertion weakened) → green ✓. `trips_rls.sql` and `trip_photos_rls.sql` are still green.
  - **Mutation checks:** 51 (bucket, helper, every policy), all caught. Five slipped through the first round (four masked by the select policy, one unescaped-dot helper); tests were added, then 51/51. `supabase db advisors --local`: no issues.
  - **Live Storage API probe** (scratchpad script only, local API, three anonymous users): 49/49 as expected.
    - upload, 409 without upsert, upsert, signed URLs → 200, list, download;
    - PNG → 415, over 10 MiB → 413;
    - bad paths, B's folder and moves → 403;
    - B and anon get nothing; C reads but cannot write;
    - cleaned up.
  - **Checks:** parity: types regenerated into a scratch file, no diff (`storage` is not in `--schema public`). Jest 72 / 980, typecheck, lint ✓.
  - **Verifier:**
    - first FAIL only because the red run was not in its brief (the orchestrator's omission);
    - after the evidence, PASS;
    - it ran its own 6 mutations and a 27-check API probe.
    - Non-blocking notes: copy / `createSignedUploadUrl` are untested (the app does not use them); the MIME limit is by Content-Type header; an upload during a trip delete can leave an orphan (R6 family); account deletion (not built) will need a cleanup path.
  - **For step 8:**
    - `list(folder)` returns 100 entries by default; P7 must page it (`limit: 1000` + offset until a short page; checked with 130 files);
    - ids in paths must be lowercase (they are: `randomUUID()` and Postgres uuids).
  - **Skill used:** supabase, supabase-postgres-best-practices, security-and-hardening, test-driven-development; verifier: doubt-driven-development.
- Step 6 (2026-10-15, backend agent).
  - **What changed:**
    - `src/data/local-db.ts`: migration v3 adds `trip_photos_cache` (v1 and v2 untouched).
    - `src/data/local-store.ts`:
      - `cachePhotos` validates with `TripPhotoListSchema`, so an invalid list writes nothing and the old copy stays;
      - `cachedPhotos` returns null for no row, corrupt JSON or a Zod failure;
      - `cacheList` prunes the photo copies of trips no longer listed;
      - `forgetTrip` drops the trip's photo copy inside its transaction.
  - **Tests:** 14 new (3 in `local-db.test.ts`, 11 in `local-store.test.ts`). red ✓ (`cachePhotos is not a function`, `no such table: trip_photos_cache`, `user_version` stayed 2) → green ✓.
    - Two existing local-db tests now expect version 3 and the new table, as the migration intends (nothing else changed).
    - The all-or-nothing `forgetTrip` test also checks that the photo copy survives a failed transaction.
  - **Checks:** suite 72 / 994 ✓, typecheck ✓, lint ✓.
  - **Verifier:** PASS. Its note for step 9: the photo copy holds signed URLs that expire after 1 h, which is fine because offline the strip relies on expo-image's disk cache (`cacheKey`); an expired URL must not be treated as an error.
  - **Skill used:** test-driven-development.
- Step 7 (2026-10-15, backend agent).
  - **What changed:** `src/data/photo-files.ts` adds `preparePhoto(uri)` → `{ file, thumbnail, thumbnailUri }`.
    - It renders the picked file once, then derives both outputs from that ref: the file at most 2048 px, the thumbnail at most 480 px, never upscaled.
    - It **always** re-encodes as JPEG 0.8, even when no resize is needed (D2), and reads the bytes with `new File(saved.uri).bytes()`. The picked file is never read.
  - **Follow-up (orchestrator):** every manipulator context and rendered ref is `release()`d exactly once in `finally`, after its last use. Up to 20 photos of 12 MP go through this one after another, so relying on GC risks running out of memory on Android.
    - `jest.setup.ts` mocks got `release: jest.fn()`.
    - `native-mocks.test.ts` got one test for `release`.
  - **Tests:** `src/data/__tests__/photo-files.test.ts`, 19 tests.
    - red ✓ ("Could not locate module @/data/photo-files"; later release counts `[0,0,0]`, `context.release is not a function`) → green ✓.
    - Mutation: releasing the rendered ref too early made 15 tests fail ("used after release").
  - **Source findings** (installed packages):
    - `manipulate` accepts an `ImageRef`.
    - EXIF orientation is applied before re-encoding: iOS `ImageFixOrientationTransformer`; Android through `expo-image-loader` → Glide `Downsampler`.
    - The JPEG is written fresh, without the source metadata.
    - All of this still needs the device check (manual 4, 4b).
  - **Checks:** suite 73 / 1014 ✓, typecheck ✓, lint ✓.
  - **Verifier:** PASS. It checked that the tests catch a skipped re-encode, a read of the original, a wrong resize side, and a missing, early or double release.
  - **Deviation:** the agent downloaded a Glide sources jar to read one file (R10).
  - **Skill used:** source-driven-development, test-driven-development.

## Risks & open questions
- **R10 (step 7) — the agent downloaded a file outside its brief.** It fetched `glide-5.0.5-sources.jar` from Maven Central into the session scratchpad and read only `Downsampler.java` (never ran it, nothing in the repo). It was told not to download anything outside a brief again.
- **Q1 — How the date taken is stored.** Cameras write their own clock without a time zone, and we strip GPS, so the zone is unknown. Recommendation: keep the camera's clock as is (`LocalDateTimeSchema`, Postgres `timestamp without time zone`). This is a written exception to "timestamps with offset", like flights keep the airport's clock. *Alternative:* convert it with the trip destination's time zone (a guess: wrong for layovers or other places).
- **Q2 — Photos without a date taken** (screenshots, WhatsApp photos). Recommendation: at the end of the strip, in the order they were added. *Alternative:* use the date added in their place (they then mix in with the trip's photos).
- **Q3 — Thumbnails.** Recommendation: upload a small copy (longer side 480 px, a few dozen KB) next to each photo, so the strip downloads ~40 KB per photo instead of ~600 KB (roaming!). The full photo downloads only in the viewer. It costs a second file per photo. *Alternative:* the full photo everywhere (simpler, much more data).
- **Q4 — Upload progress.** Recommendation: a spinner per tile and the line „Wysyłam zdjęcia: 3 z 10” (P3). A per-byte bar per photo needs a second upload path (`File.createUploadTask` + signed upload URL). *Alternative:* that bar (more code).
- **Q5 — New dependencies** (`CLAUDE.md`: ask before adding):
  - `expo-image-manipulator ~57.0.20`: downscale and re-encode without EXIF. It is a **new native module → a new dev build** (EAS) before the device run.
  - `expo-file-system ~57.0.7`: read the bytes for upload. Already installed as a dependency of `expo`, so no new native code; only a direct dependency.
  - *Alternative to the second:* the manipulator's base64 output decoded with `atob`, which means more string handling in JS.
- **P9 (decided: D18; found by the step 1 verifier) — iOS photo permission text.** `app.json` → `expo-image-picker` → `photosPermission` reads „Travelo uses your photos so you can choose a cover photo for a trip.” It no longer covers trip photos. Proposal: „Travelo uses your photos so you can add them to a trip and choose its cover.” It is in English only, like today. This is needed before step 10 and has to be asked of Kacper.
- **R1 — Storage tests need Supabase's `storage` schema.** The earlier SQL tests ran on plain Postgres with a stub `auth` schema. Step 4 still can. Step 5 needs `pnpm supabase start` (Docker); if that is not available here, step 5 is **blocked** until Kacper runs `pnpm test:db` locally (as trip-edit-menu step 2).
- **R2 — Dev build:** the new native module means rebuilding the dev client (EAS) before steps 13 and Kacper's checks; the current build would crash on `expo-image-manipulator`.
- **R3 — EXIF stripping is not stated in `expo-image-manipulator`'s docs.** Re-encoding writes a new JPEG without the original metadata on iOS and Android, but this is checked on a real file in manual step 4. If GPS survives, stop and ask.
- **R4 — Uploads are lost on app close or trip switch** (A4); a failed tile stays until it is sent or the screen goes away (it is never dropped silently while the strip is shown).
- **R5 — Signed URLs last 1 h.** A viewer left open longer can fail to load a photo the phone does not have yet → the load error. Reopening the viewer re-signs the URLs.
- **R6 — Orphan files:** if the row of a deleted photo is gone but removing its files fails, the files stay in Storage (not visible in the app). Rare; logged as a known limitation.
- **R7 — Race (like trip-edit-menu N7):** a photos fetch running while the trip is deleted can write the deleted trip's photo copy back; the next list read prunes it.
- **R8 — Storage size:** the free Supabase plan has 1 GB of Storage, about 1,500 photos with thumbnails. That is fine for now; it is worth knowing before real users (with the paid / free decision).
- **R9 — Migrations are not pushed to the project yet** (Architecture); Kacper pushes them, as before.
- ⚠ **Scope conflict:** `CLAUDE.md` lists "social feed" under *Out of scope — do not build*. The forum is a social feed. Nothing of the forum is built in this feature. Kacper decides about that rule when the forum is planned.
