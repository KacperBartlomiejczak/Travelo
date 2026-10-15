# Task: Trip covers (preset covers, required cover)
Status: drafting — the full plan is drafted after trip-photos is done (it uses that feature's Storage, `prompts/trip-photos/plan.md` D9)

## Understanding & assumptions
Every trip has a cover photo. The organizer picks it from a set of ready-made photos bundled in the app (no cropping needed) or from the phone's gallery. Asked by Kacper on 2026-10-15 together with trip photos ("Nazwa i zdjęcie" in the ⋮ menu).

## Decisions (Kacper, 2026-10-15)
- **D1 — The cover is required.** It comes from the preset covers **or** from the gallery (the gallery keeps today's crop). Removing the cover goes away.
- **D2 — Presets:** one generic set of **~8–12 photos by kind of trip** (beach, mountains, city, lake, winter, …), the same for every trip, bundled in the app (works offline), not matched to the destination.
- **D3 — Source of the presets:** Claude searches free photos under a licence that allows use in an app (e.g. Unsplash, Pexels), shows the list, and **Kacper approves every download**.
- **D4 — Default:** in the create-trip wizard one preset is **preselected** (it can be changed), so "Utwórz podróż" never blocks on the cover. Existing trips without a cover get the same default.
- **D5 — A cover from the gallery is uploaded to Supabase Storage** (the trip-photos Storage), so it survives a reinstall and other phones can show it.

## Approach
To be drafted.

## Data structures (Zod)
To be drafted (`coverImageUri` becomes required; how a preset is stored, e.g. a preset id vs a URI; Zod → migration with a default for existing nulls → types → parity check).

## Tests
To be drafted.

## Files
To be drafted (`CoverPicker` is shared by the wizard summary and `TripDetailsSheet`).

## Skills
To be drafted.

## Steps
To be drafted.

## Progress log

## Risks & open questions
- Licence terms of each preset photo (attribution, use in an app) are checked before Kacper approves the download.
- App size: 8–12 photos bundled; their resolution and format are set in the plan.
