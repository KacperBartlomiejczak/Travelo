# Trip photos

Entry: the photo strip under the hero and the full-screen viewer. Adding and deleting need internet; seen photos show offline.

- **Photos** (`photos(tripId)`):
  1. Read the rows: `order('id').range()`, in pages of 1000 (= PostgREST `max_rows`).
  2. Sign the files: one `createSignedUrls` call per ≤ 1000 paths, valid 1 h.
  3. Parse with `TripPhotoListSchema`, then `sortTripPhotos`: date taken, oldest first; the same minute by when added; photos without a date last.
  4. Write the SQLite copy.
  - Unreachable → the copy; no copy → rejects.
- **Add photo** (`addPhoto(tripId, photoId, picked)`):
  1. Validate: lowercase UUIDs, `PickedPhotoSchema`.
  2. `preparePhoto`: render once; the longer side ≤ 2048 (the thumbnail ≤ 480), never upscaled; JPEG 0.8 without the source metadata; native refs released.
  3. Upload the thumbnail, then the file (`upsert: true`).
  4. Insert the row (`ignoreDuplicates`).
  5. Seed expo-image's cache with the local thumbnail.
  - Retrying the same id never creates a duplicate.
  - `usePhotoUploads` drives it one photo at a time from `PhotoStrip`. Queued photos live in memory only, so they are lost when the app closes or the trip changes.
- **Delete photo** (`deletePhoto`):
  1. Delete the row by id and trip. 0 rows → a visibility check: `photo-not-deletable` while the photo is still visible.
  2. Remove both files, best effort.
- **Photo strip** (`PhotoStrip`, `PhotoTile`): the first tile is "Add photos"; photos and queued uploads are merged by date taken. Empty → "Add photos from this trip."; load error → "Couldn't load the photos." with "Try again"; progress "Sending photos: {{done}} of {{total}}"; a failed upload shows a line with "Try again". A linked friend sees the strip read-only, and on home it is hidden when empty. The picker (`pickTripPhotos`) is multi-select, 20 per pick, no crop; EXIF is read only for the date taken. A failed gallery open shows "Couldn't open the gallery."
- **Queue states** (`src/hooks/useTripPhotos.ts`): `waiting`, `sending`, `failed`. Offline, waiting photos fail at once.
- **Viewer** (route `/trips/[tripId]/photos`, a full-screen modal, optional `photoId` param; `PhotoViewer`): "Delete photo" is owner-only and disabled offline, with the hint "You need internet to add or delete photos.". `DeletePhotoSheet`: "Delete this photo?", "It will be removed from this trip. This can't be undone.", "Delete photo" / "Cancel".
