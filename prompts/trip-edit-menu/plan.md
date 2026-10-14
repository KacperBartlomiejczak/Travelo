# Task: Trip edit menu (⋮)
Status: drafting — the full plan is drafted after trips-drawer is done (it builds on the drawer's home screen and hero button)

## Understanding & assumptions
Kacper wants a **three-vertical-dots button** (lucide `EllipsisVertical`, SVG from `lucide-react-native`) on the trip screen. It opens the actions for editing the open trip. Order: feature 2 of 4 (`prompts/trips-drawer/plan.md` D1).

## Decisions (Kacper, 2026-10-08)
- **D1 — Menu items in this task:**
  - change the trip's **name and cover photo**;
  - change the **budget** (opens the existing budget sheet, which works offline);
  - **trip photos** (the entry point; the photos themselves are `prompts/trip-photos/plan.md`);
  - **delete the trip**.
- **D2 — Budget meaning.** "Aktualizowanie budżetu" in the original request turned out to mean *adding expenses*. That is `prompts/expenses/plan.md`, not this feature. Here "budget" is only the existing change of the budget per person.

## Approach
To be drafted.

## Data structures (Zod)
To be drafted (name/cover update input, delete).

## Tests
To be drafted.

## Files
To be drafted.

## Skills
To be drafted.

## Steps
To be drafted.

## Progress log

## Risks & open questions
To ask Kacper when this plan is drafted:
- **Menu form:** a bottom sheet with a list of actions (thumb zone) or a small pop-up menu next to the button?
- **Placement:** the ⋮ button in the top-right corner over the photo, mirroring the menu button (`trips-drawer` P5)?
- **Name and cover editing:** a bottom sheet or a separate screen? It needs internet (trips are server-first). What happens offline: disabled with an explanation, or an error after saving?
- **Delete:**
  - confirmation dialog copy (§13.6);
  - what the home screen shows afterwards (the default trip, `trips-drawer` A1);
  - online only?
  - Server: a `delete` RLS policy already exists for the owner — check cascades (members, segments, photos).
- **Trip photos entry** before trip-photos exists: hide it, or ship both features together?
