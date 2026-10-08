# Task: Trip photos
Status: drafting — the full plan is drafted after trip-edit-menu is done (its ⋮ menu is the entry point)

## Understanding & assumptions
The organizer can add **photos from the trip** from the phone's gallery to a trip. Order: feature 3 of 4 (`prompts/trips-drawer/plan.md` D1).

Later purpose (Kacper, 2026-10-08): a **community forum**, a "travel Facebook" where people share their photos (nature, places) and recommend where it is worth going. That forum will need the user's **consent** before their photos are used.

## Decisions (Kacper, 2026-10-08)
- **D1 — Storage: Supabase Storage** (not only on the phone), because the forum needs the photos on the server.
- **D2 — Stored data now:**
  - the photo itself;
  - the date it was added;
  - the date it was taken (EXIF).
  
  **GPS is stripped.** Location and consent come later, together with the forum.
- **D3 — Entry point:** "trip photos" in the ⋮ menu (`prompts/trip-edit-menu/plan.md` D1).

## Approach
To be drafted.

## Data structures (Zod)
To be drafted (photo entity, upload input; Zod → migration → types → parity check).

## Tests
To be drafted.

## Files
To be drafted.

## Skills
To be drafted (`supabase`, `supabase-postgres-best-practices` for the table, bucket and Storage RLS).

## Steps
To be drafted.

## Progress log

## Risks & open questions
- ⚠ **Scope conflict:** `CLAUDE.md` lists "social feed" under *Out of scope — do not build*. The forum is a social feed. Nothing of the forum is built in this feature. Kacper decides about that rule when the forum is planned.
- To ask Kacper when this plan is drafted:
  - where the photos are shown on the trip screen (a strip or a grid?);
  - picking several photos at once;
  - deleting a photo;
  - a limit on the number or size of photos;
  - compression before upload;
  - behaviour offline (adding needs internet unless he decides otherwise);
  - whether the cover photo also moves to Storage (today it is a device-local URI, a known limitation);
  - whether photos are visible to linked viewers (RLS: viewers can read, cannot write).
- A new dependency may be needed to read EXIF or to strip GPS (`expo-image-manipulator` re-encodes without EXIF). It must be asked before adding.
