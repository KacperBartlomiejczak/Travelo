# DESIGN CONTEXT — SUNLINE

**Product:** Group trip planner  
**Platform:** React Native + Expo  
**Language:** TypeScript  
**Platforms:** iOS + Android  
**Modes:** Planning Mode + Trip Mode  
**Locales:** Polish (`pl`) + English (`en`)  
**Theme:** Light + Dark from day one  
**Primary user:** Trip organizer  
**Design direction:** Sunline  
**Status:** Implementation-ready specification

---

## 0. Design Direction

Sunline is a warm editorial travel-planning system built around deep ink, warm paper, terracotta, sage, sky, and amber.

The product should feel like a modern travel journal during planning and a reliable navigation/control surface during the trip.

### Core emotional goals

| Context | Target feeling | Design consequence |
|---|---|---|
| Before trip | Excitement | Rich hierarchy, imagery, editorial typography |
| Planning | Control | Clear comparisons, predictable structure |
| During trip | Calm | High contrast, compact information, obvious actions |
| Money | Safety | Explicit currencies, neutral budget states |
| Summary | Pride | Strong composition and shareable visual hierarchy |

### Competitive positioning

Sunline should feel:
- more personal and editorial than a generic itinerary tool;
- less financially dominant than Splitwise;
- less dashboard-heavy than Wanderlog;
- more distinctive than a standard mobile CRUD application.

### Non-negotiable visual rules

1. No purple-blue gradients.
2. No glassmorphism.
3. No decorative emoji as interface icons.
4. No arbitrary shadows.
5. No arbitrary spacing.
6. No arbitrary colors.
7. No hardcoded text outside i18n.
8. Never use color as the only semantic signal.
9. Never display an AI estimate as an exact price.
10. Never display money without a currency.
11. Primary trip-mode actions must be reachable by one thumb.
12. Every screen must support loading, empty, error, and offline states.

---

# 1. Principles

## 1.1 Glance before reading

Trip-mode information must be understandable from the first visual scan.

**Do:** show `120 PLN left today` with a meter before secondary budget details.  
**Don't:** require opening a budget screen to understand today's remaining budget.

**Psychology:** reduces cognitive load when attention is divided.

## 1.2 One obvious next action

Every important screen has exactly one visually dominant action.

**Do:** `+ Expense` is the strongest action on the trip overview.  
**Don't:** give `Add expense`, `Edit trip`, `Share`, and `Manage members` equal visual weight.

**Psychology:** reduces decision friction.

## 1.3 Planning can breathe; trip mode cannot

Planning screens may contain richer exploration while trip mode prioritizes speed.

**Do:** use larger editorial sections in planning mode.  
**Don't:** use the same dense dashboard treatment everywhere.

**Psychology:** matches interface density to the user's available attention.

## 1.4 Money informs, never judges

Budget states communicate information rather than success or failure.

**Do:** `Near your daily limit · 120 PLN left`.  
**Don't:** `You're overspending!`.

**Psychology:** neutral language reduces financial stress and defensiveness.

## 1.5 AI proposes; humans decide

AI output is always presented as editable assistance.

**Do:** `AI suggestion` + `Lock` + `Edit`.  
**Don't:** present generated activities as authoritative itinerary decisions.

**Psychology:** visible user control increases trust.

## 1.6 Forgiveness beats precision

The app should make accidental actions easy to recover from.

**Do:** undo after saving an expense.  
**Don't:** require multiple confirmation dialogs for ordinary reversible actions.

**Psychology:** lowers the perceived cost of acting quickly.

## 1.7 Recognition beats recall

Use consistent visual patterns and explicit labels.

**Do:** always show currency beside an amount.  
**Don't:** expect users to remember which currency the trip uses.

**Psychology:** recognition requires less working memory.

---

# 2. Color

## 2.1 Brand palette

| Token | Hex | Purpose |
|---|---:|---|
| `brand.50` | `#FFF1EC` | Brand tint |
| `brand.100` | `#FFE0D7` | Selected backgrounds |
| `brand.200` | `#FFC0AF` | Soft emphasis |
| `brand.300` | `#F59A82` | Illustration/accent |
| `brand.400` | `#E9795C` | Secondary brand |
| `brand.500` | `#D85C3A` | Primary brand |
| `brand.600` | `#BD472A` | Pressed brand |
| `brand.700` | `#96361F` | Dark brand |
| `brand.800` | `#702B1C` | High contrast brand |
| `brand.900` | `#4D2118` | Deep brand |

## 2.2 Neutral scale

| Token | Hex |
|---|---:|
| `neutral.0` | `#FFFFFF` |
| `neutral.50` | `#F7F3EA` |
| `neutral.100` | `#EEE8DD` |
| `neutral.200` | `#DDD5C7` |
| `neutral.300` | `#C5BBAA` |
| `neutral.400` | `#A79C8B` |
| `neutral.500` | `#877C6D` |
| `neutral.600` | `#665D51` |
| `neutral.700` | `#494239` |
| `neutral.800` | `#302B26` |
| `neutral.900` | `#17211B` |

## 2.3 Semantic colors

| Semantic | Light | Dark | Meaning |
|---|---|---|---|
| Success | `#397A5A` | `#79C69A` | Completed/safe |
| Warning | `#9A6810` | `#E8B85A` | Attention |
| Error | `#B13B32` | `#F28B82` | Failed/invalid |
| Info | `#356F92` | `#7DB9D8` | Informational |

Every semantic state must additionally use an icon, label, or pattern.

## 2.4 Budget-state colors

Budget colors must not communicate moral judgment.

| State | Light | Dark | Secondary cue |
|---|---|---|---|
| Under budget | `#397A5A` | `#79C69A` | Check icon |
| Near limit | `#9A6810` | `#E8B85A` | Clock/attention icon |
| Over budget | `#B45F42` | `#E89A7A` | Neutral upward trend icon |

Never use red for over-budget status.

## 2.5 Expense category colors

| Category | Light | Dark |
|---|---|---|
| Food | `#D85C3A` | `#F08A6C` |
| Transport | `#356F92` | `#7DB9D8` |
| Stay | `#71856F` | `#A4C39E` |
| Activities | `#8A6699` | `#C1A4D1` |
| Other | `#877C6D` | `#B9B0A2` |

Charts must use labels, legends, and direct values in addition to color.

---

# 3. Color Roles

## 3.1 Light theme

| Role | Token |
|---|---|
| Background | `neutral.50` |
| Surface | `neutral.0` |
| Surface secondary | `neutral.100` |
| Surface elevated | `neutral.0` |
| Text primary | `neutral.900` |
| Text secondary | `neutral.600` |
| Text tertiary | `neutral.500` |
| Border | `neutral.200` |
| Divider | `neutral.100` |
| Brand | `brand.500` |
| Brand pressed | `brand.600` |
| On brand | `neutral.0` |

## 3.2 Dark theme

| Role | Token |
|---|---|
| Background | `#111712` |
| Surface | `#17211B` |
| Surface secondary | `#202A23` |
| Surface elevated | `#263229` |
| Text primary | `#F7F3EA` |
| Text secondary | `#C9C2B6` |
| Text tertiary | `#9E978B` |
| Border | `#39443B` |
| Divider | `#2A342D` |
| Brand | `#F08A6C` |
| Brand pressed | `#F59A82` |
| On brand | `#17211B` |

## 3.3 Contrast requirements

Contrast values below are WCAG 2.x relative luminance calculations.

| Pair | Approx. ratio | Required |
|---|---:|---|
| Light primary text / `neutral.50` | 14.7:1 | AAA |
| Light secondary text / `neutral.50` | 5.0:1 | AA |
| Light tertiary text / `neutral.50` | 4.0:1 | AA for large text only |
| Light primary text / white | 16.1:1 | AAA |
| Dark primary text / dark background | 15.2:1 | AAA |
| Dark secondary text / dark background | 8.1:1 | AAA |
| Dark tertiary text / dark background | 5.2:1 | AA |
| White / `brand.600` | 5.3:1 | AA |
| `neutral.900` / `brand.300` | 7.0:1 | AAA |
| White / success light | 4.8:1 | AA |
| `neutral.900` / success dark | 6.1:1 | AA |
| `neutral.900` / warning | 5.4:1 | AA |
| `neutral.900` / info | 5.2:1 | AA |

For production, contrast must be validated automatically against the final rendered tokens using a WCAG contrast utility. Outdoor trip-mode text must use primary or secondary text tokens only; tertiary text is forbidden for essential information.

---

# 4. Typography

## 4.1 Font families

**Primary:** `DM Sans`  
**Display:** `Fraunces`

Both are free Google Fonts and can be loaded through Expo Google Fonts.

```ts
DM Sans:
400 Regular
500 Medium
600 SemiBold
700 Bold

Fraunces:
500 Medium
600 SemiBold
700 Bold
```

## 4.2 Type scale

| Style | Font | Size | Line height | Weight | Letter spacing | Use |
|---|---|---:|---:|---:|---:|---|
| Display XL | Fraunces | 36 | 42 | 600 | -0.7 | Trip hero |
| Display L | Fraunces | 30 | 36 | 600 | -0.5 | Summary total |
| Heading 1 | DM Sans | 26 | 32 | 700 | -0.4 | Screen title |
| Heading 2 | DM Sans | 22 | 28 | 700 | -0.3 | Section title |
| Heading 3 | DM Sans | 18 | 24 | 700 | -0.2 | Card title |
| Body L | DM Sans | 17 | 24 | 400 | 0 | Primary readable body |
| Body M | DM Sans | 15 | 22 | 400 | 0 | Default body |
| Body M Medium | DM Sans | 15 | 22 | 500 | 0 | Labels/emphasis |
| Body S | DM Sans | 14 | 20 | 400 | 0 | Secondary content |
| Caption | DM Sans | 12 | 16 | 500 | 0.1 | Metadata |
| Button | DM Sans | 15 | 20 | 600 | 0 | Buttons |
| Numeric XL | DM Sans | 32 | 38 | 700 | -0.5 | Money totals |
| Numeric L | DM Sans | 24 | 30 | 700 | -0.3 | Budget amount |
| Numeric M | DM Sans | 17 | 22 | 600 | 0 | List amounts |

## 4.3 Money typography

All money styles must use tabular figures.

```ts
fontVariant: ['tabular-nums']
```

Money must always render:

`120 PLN`

Never:

`120`

Never:

`PLN 120`

unless required by locale-specific formatting.

Use `Intl.NumberFormat` for locale-aware formatting.

## 4.4 Dynamic Type

Text must scale with React Native accessibility font scaling.

Rules:
- never disable font scaling globally;
- minimum supported text size: 12dp;
- body text must remain readable at 200% scaling;
- horizontal rows must allow wrapping;
- buttons may grow vertically;
- fixed-height text containers are prohibited unless text is single-line and truncation is intentional.

---

# 5. Spacing, Layout & Shape

## 5.1 Spacing scale

| Token | dp |
|---|---:|
| `space.0` | 0 |
| `space.1` | 4 |
| `space.2` | 8 |
| `space.3` | 12 |
| `space.4` | 16 |
| `space.5` | 20 |
| `space.6` | 24 |
| `space.7` | 28 |
| `space.8` | 32 |
| `space.10` | 40 |
| `space.12` | 48 |
| `space.16` | 64 |

## 5.2 Layout

| Rule | Value |
|---|---:|
| Standard screen horizontal padding | 20dp |
| Compact trip-mode horizontal padding | 16dp |
| Maximum content width | 720dp |
| Standard section gap | 24dp |
| Card internal padding | 16dp |
| Dense card padding | 12dp |
| List row minimum height | 64dp |
| Bottom safe-area padding | 16dp + inset |
| Primary button height | 52dp |
| Compact button height | 44dp |
| Icon button | 44 × 44dp |
| Minimum touch target | 44 × 44dp |

## 5.3 Grid

Base grid: 4dp.

All spacing values must be multiples of 4dp.

## 5.4 Corner radii

| Token | dp | Use |
|---|---:|---|
| `radius.none` | 0 | Full-bleed elements |
| `radius.sm` | 8 | Inputs/chips |
| `radius.md` | 12 | Buttons/list surfaces |
| `radius.lg` | 16 | Cards |
| `radius.xl` | 24 | Bottom sheets |
| `radius.full` | 999 | Avatars/pills |

## 5.5 Thumb-zone

Primary actions belong in the bottom 40% of the viewport.

Rules:
- floating quick-add: bottom safe-area + 20dp;
- bottom-sheet confirmation: full-width primary button above safe-area;
- destructive action must not be adjacent to primary action;
- top-right actions are secondary only.

---

# 6. Elevation & Surfaces

## 6.1 Elevation levels

| Level | iOS shadow | Android elevation | Use |
|---|---|---:|---|
| 0 | none | 0 | Flat content |
| 1 | opacity 0.08, radius 3, offset 0/1 | 1 | Cards |
| 2 | opacity 0.12, radius 6, offset 0/2 | 3 | Floating controls |
| 3 | opacity 0.16, radius 12, offset 0/4 | 6 | Bottom sheets |
| 4 | opacity 0.20, radius 20, offset 0/8 | 12 | Dialogs |

Shadow color: `#17211B`.

Dark mode must use surface contrast rather than stronger black shadows.

Dark surfaces:
- level 0: background `#111712`
- level 1: surface `#17211B`
- level 2: secondary surface `#202A23`
- level 3: elevated surface `#263229`

---

# 7. Iconography

## Library

Use `lucide-react-native`.

## Rules

| Element | Size | Stroke |
|---|---:|---:|
| Inline icon | 16dp | 2 |
| Standard icon | 20dp | 2 |
| Primary icon | 24dp | 2 |
| Large feature icon | 32dp | 2 |

Rules:
- use outline icons;
- stroke width is always 2;
- icons never replace text for critical actions;
- do not mix icon libraries;
- do not use emoji as interface icons.

Recommended semantic icons:
- success: `CircleCheck`
- warning: `CircleAlert`
- error: `CircleX`
- info: `Info`
- expense: `Receipt`
- transport: `TrainFront`
- flight: `Plane`
- stay: `Hotel`
- food: `Utensils`
- activity: `Ticket`
- AI: `Sparkles`
- lock: `Lock`
- split: `GitBranch`

---

# 8. Illustration Style

Empty-state illustrations use:
- 2–3 flat colors;
- 2dp outline;
- no gradients;
- geometric travel objects;
- 160 × 160dp canvas;
- brand + neutral + one category color maximum.

Illustrations must communicate context, not decoration.

---

# 9. Motion

## 9.1 Durations

| Motion | Duration |
|---|---:|
| Micro feedback | 100ms |
| Button state | 120ms |
| Small transition | 180ms |
| Standard transition | 240ms |
| Bottom sheet | 280ms |
| Dialog | 220ms |
| Celebration | 500ms |

## 9.2 Easing

Use:
- enter: cubic-bezier equivalent `(0.2, 0.8, 0.2, 1)`
- exit: `(0.4, 0, 1, 1)`
- standard: `(0.2, 0, 0, 1)`

For React Native animation libraries, map these curves to the closest supported easing implementation.

## 9.3 Animate

Allowed:
- opacity;
- transform;
- progress;
- height where necessary;
- list insertion/removal.

Never animate:
- critical text position while reading;
- currency values with decorative rolling counters;
- errors;
- accessibility labels.

## 9.4 Reduced motion

When reduced motion is enabled:
- duration becomes 0ms for decorative transitions;
- preserve opacity changes only when necessary for state communication;
- no parallax;
- no celebration movement;
- no bouncing;
- no scale-pulse.

## 9.5 Required microinteractions

### Expense saved
1. Button transitions to success for 120ms.
2. Bottom sheet closes in 180ms.
3. Snackbar appears after 100ms.
4. Amount briefly receives a 100ms opacity/scale confirmation.

### Plan generated
1. `Sparkles` rotates for 500ms maximum.
2. Skeleton transitions into content over 180ms.
3. AI label fades in over 120ms.

### Activity locked
1. Lock icon changes from unlocked to locked over 120ms.
2. Card border changes to brand border.
3. No bounce.

### Group split revealed
1. Timeline lanes expand over 240ms.
2. Avatars fade in over 120ms.
3. Lane labels appear after 80ms.
4. No infinite animation.

---

# 10. Components

## 10.1 Buttons

### Primary

Size: 52dp height, 16dp horizontal padding, 12dp radius.

Colors:
- default: brand.500 / neutral.0
- pressed: brand.600 / neutral.0
- focused: brand.500 + 2dp focus ring
- disabled: neutral.200 / neutral.500
- loading: brand.500 with spinner
- error: never use error styling for the button itself; communicate action failure separately

### Secondary

- background: transparent
- border: 1dp neutral.300
- text: neutral.900
- pressed background: neutral.100
- disabled: neutral.100 + neutral.400 text
- focused: 2dp brand focus ring

### Ghost

- background: transparent
- text: brand.600
- pressed: brand.50
- disabled: neutral.400

### Destructive

- default text/background: error token
- pressed: darker error token
- disabled: neutral.400
- must require confirmation for irreversible actions.

## 10.2 Icon button

44 × 44dp.

States:
- default: transparent
- pressed: neutral.100
- focused: 2dp brand ring
- disabled: opacity 0.4
- loading: centered 16dp spinner

## 10.3 Floating quick-add button

Size: 56 × 56dp.

Position:
- right: 20dp
- bottom: safe-area + 20dp

Icon: `Plus`, 24dp.

Label:
- planning mode: optional extended button `Add expense`;
- trip mode: icon-only unless accessibility requires label.

Psychological role: provides a predictable emergency action without scanning.

## 10.4 Text input

Height: 52dp.

Padding: 16dp.

Border:
- default: 1dp neutral.300
- focused: 2dp brand.500
- error: 2dp error
- disabled: neutral.100

States:
- default;
- focused;
- filled;
- disabled;
- loading;
- error.

Error message appears below with 4dp gap.

## 10.5 Amount input

Height: 64dp.

Amount font: Numeric XL.

Currency selector: 52dp high.

Behavior:
- numeric keyboard;
- decimal separator localized;
- currency shown beside amount;
- no hidden currency assumptions;
- amount validation occurs immediately;
- zero is valid only where the business rule explicitly permits it.

Example:

`120.00 PLN`

Never show an unlabeled numeric amount.

## 10.6 Chips

Height: 36dp.

Horizontal padding: 12dp.

Radius: 999dp.

States:
- default;
- selected;
- pressed;
- disabled;
- focused.

Category chips use category colors plus text/icon.

## 10.7 Avatar

Sizes:
- small: 28dp
- standard: 36dp
- large: 48dp

Group:
- overlap: 8dp;
- maximum visible avatars: 4;
- remaining count uses a neutral circular avatar.

## 10.8 List rows

Minimum height: 64dp.

Structure:

`[icon/avatar] [title + metadata] [trailing value/action]`

Horizontal padding: 16dp.

Divider: 1dp neutral divider.

Press feedback: surface secondary for 120ms.

## 10.9 Trip card

Padding: 16dp.

Radius: 16dp.

Structure:
1. destination;
2. dates;
3. member avatars;
4. budget status;
5. optional trip image.

Trip name is Heading 3.

## 10.10 Activity card

Padding: 12dp.

Radius: 16dp.

Contains:
- time;
- activity name;
- location;
- estimated cost range;
- AI label if generated;
- lock state.

AI estimate example:

`~40–60 PLN`

Never:

`45 PLN`

## 10.11 Flight card

Height: minimum 116dp.

Structure:
- departure time;
- departure airport;
- flight duration;
- arrival time;
- arrival airport;
- flight identifier.

Layover indicator:
- vertical or horizontal connector;
- amber status label;
- explicit layover duration.

Example:

`2h 10m layover`

## 10.12 Bottom sheet

Radius: 24dp top corners.

Maximum height: 90% viewport.

Handle:
- width 36dp;
- height 4dp;
- centered;
- 999 radius.

Dismiss:
- swipe down;
- backdrop tap;
- system back.

Primary action remains above safe area.

## 10.13 Tabs

Height: 48dp.

Selected indicator: 2dp brand line.

Text: Body S Medium.

Do not use icons-only tabs for primary navigation.

## 10.14 Segmented control

Height: 40dp.

Radius: 10dp.

Selected background: surface.

Selected text: primary.

Unselected text: secondary.

Use for:
- Plan / Reality;
- Day / Overview;
- category filtering.

## 10.15 Daily budget meter

Height: 12dp.

Radius: 999dp.

Track: neutral.200.

Progress:
- under budget: success;
- near limit: warning;
- over budget: budget-over token.

Always pair with textual amount.

Example:

`120 PLN left today`

The text is mandatory.

## 10.16 Toast / snackbar

Minimum height: 48dp.

Maximum width: 360dp.

Placement:
- bottom safe-area + 16dp;
- above bottom navigation if present.

Auto-dismiss: 3500ms.

Undo snackbar: 5000ms.

## 10.17 Dialog

Width: viewport - 40dp.

Radius: 16dp.

Padding: 24dp.

Title: Heading 3.

Body: Body M.

Actions:
- primary;
- secondary/destructive depending on task.

Never use dialogs for ordinary reversible actions.

## 10.18 Skeleton loaders

Use neutral surfaces:
- light: neutral.100;
- dark: surface secondary.

Animation:
- 1200ms shimmer only if reduced motion is off;
- otherwise static.

Skeleton must match the final content geometry.

## 10.19 Empty states

Structure:
1. illustration;
2. heading;
3. short explanation;
4. one action.

Maximum copy: 2 sentences.

## 10.20 Loading states

Never block the entire screen if partial content is available.

Use:
- skeleton for content;
- spinner only for isolated actions;
- progress indicator for AI generation.

---

# 11. Patterns & Key Screens

## 11.1 Screen 1 — Trips List

Structure:

```text
Safe area
↓
Header
  "Your trips"
  + Create trip
↓
Upcoming section
  Trip card
  Trip card
↓
Past section
  Trip card
↓
Bottom navigation
```

Primary action: `Create trip`.

Trip card should expose destination, dates, people, and budget state without opening the trip.

---

## 11.2 Screen 2 — Trip Overview

Structure:

```text
Safe area
↓
Back + trip title + overflow
↓
Destination/date hero
↓
Member avatar group
↓
Budget status
  Total
  Daily remaining
  Meter
↓
Flights
  Flight card
  Layover indicator
↓
Today's plan preview
↓
Floating quick-add
```

Trip mode prioritizes:
1. today's plan;
2. budget;
3. quick expense;
4. transport.

---

## 11.3 Screen 3 — Day Plan

Structure:

```text
Header
  Day selector
  Date

AI-generated plan banner

Timeline
  09:00
    Activity
  11:30
    Activity
  13:00
    Lunch
  15:00
    Split group

Parallel lanes:

Everyone
  ─ Activity ─ Activity ─

Kacper
  ─ Activity ───── Activity

Friend A
  ───── Activity ─ Activity
```

### Parallel lane rules

When a group splits:
- each lane receives a 36dp avatar;
- lane label remains visible while scrolling;
- shared events span all lanes;
- split events occupy only participating lanes;
- vertical time axis remains common;
- connectors use 2dp neutral lines;
- no color-only distinction between members.

---

## 11.4 Screen 4 — Quick Add Expense

Goal: under 5 seconds for a returning user.

### Interaction budget

Target:
- 2 taps for common expense;
- 3 taps if currency/category must change;
- maximum 5 seconds from tap to save.

Flow:

```text
Tap + Expense
↓
Bottom sheet opens
↓
Amount input automatically focused
↓
Type amount
↓
Tap Save
↓
Expense saved
↓
Undo snackbar
```

Default category is the most recently used category.

Default currency is the trip's most recently used currency.

These are suggestions, not hidden assumptions; currency remains visible.

---

## 11.5 Screen 5 — Trip Summary

Structure:

```text
Header
↓
Total spent
  1,240 PLN
↓
Plan vs Reality
  planned range
  actual total
↓
Category breakdown
  Food
  Transport
  Stay
  Activities
  Other
↓
Member contribution
↓
Share summary
```

### Shareable summary card

Standalone composition:
- canvas: 1080 × 1350 logical export composition;
- background: warm paper;
- top: destination + date;
- center: large total;
- middle: 3 key statistics;
- bottom: category mini-chart;
- footer: app brand.

No user-private data should be included unless explicitly selected for sharing.

The card should look complete without app chrome.

---

# 12. Reusable Screen States

Every screen implements the same four states.

## Loading

Use structural skeletons matching final layout.

Do not show a blank white screen.

## Empty

Use:
- illustration;
- heading;
- explanation;
- single primary action.

## Error

Use:
- error icon;
- concise explanation;
- retry action;
- preserve locally available content.

Never blame the user.

## Offline

Use a persistent compact banner:

PL:
`Jesteś offline. Zmiany zapiszą się po połączeniu.`

EN:
`You're offline. Changes will sync when you're connected.`

Offline actions that can safely be queued should remain available.

---

# 13. Voice & Microcopy

## 13.1 Voice

The voice is:
- concise;
- calm;
- human;
- supportive;
- practical;
- never judgmental.

Avoid:
- exclamation-heavy copy;
- financial shame;
- technical error messages;
- fake enthusiasm;
- AI self-praise.

## 13.2 Empty states

### Polish

**No trips**
`Nie masz jeszcze żadnej podróży.`
`Zaplanuj pierwszą i zaproś znajomych.`

**No expenses**
`Brak wydatków.`
`Dodaj pierwszy wydatek, gdy coś kupicie.`

### English

**No trips**
`You don't have any trips yet.`
`Plan your first one and invite your friends.`

**No expenses**
`No expenses yet.`
`Add your first expense when you buy something.`

## 13.3 Errors

### Polish

`Nie udało się zapisać. Spróbuj ponownie.`

`Plan nie został wygenerowany. Sprawdź połączenie i spróbuj ponownie.`

### English

`Couldn't save this. Try again.`

`The plan couldn't be generated. Check your connection and try again.`

## 13.4 Budget warnings

### Polish

Under:
`120 PLN zostało na dziś`

Near:
`Zbliżasz się do dziennego limitu · 120 PLN zostało`

Over:
`Dzisiejszy limit został przekroczony o 40 PLN`

### English

Under:
`120 PLN left today`

Near:
`You're nearing today's limit · 120 PLN left`

Over:
`Today's limit is exceeded by 40 PLN`

## 13.5 AI labels

PL:
`Sugestia AI`

EN:
`AI suggestion`

Estimate:

PL:
`Szacunkowo ~40–60 PLN`

EN:
`Estimated ~40–60 PLN`

## 13.6 Confirmations

PL:
`Wydatek zapisany.`

EN:
`Expense saved.`

PL:
`Plan gotowy.`

EN:
`Your plan is ready.`

---

# 14. AI-specific UX

## 14.1 AI identity

Every generated activity must display:

`Sugestia AI`

or:

`AI suggestion`

The label must be text, not only a sparkle icon.

## 14.2 Estimate uncertainty

AI cost estimates always use a range.

Allowed:
`~40–60 PLN`

Not allowed:
`50 PLN`

For multiple currencies:
`~€10–15`

Never fabricate exchange-rate precision.

## 14.3 Generating

Show:

PL:
`Tworzę plan dnia…`

EN:
`Creating your day plan…`

Under it:
`Sugestia AI`

Generation UI:
- skeleton activities;
- progress copy;
- cancel action;
- no fake percentage.

## 14.4 Editing AI content

Each generated activity exposes:
- Edit;
- Lock;
- Regenerate.

Locked activities must not be changed by regeneration.

## 14.5 Failed generation

Show:
- error state;
- preserved existing itinerary;
- Retry;
- manual add activity.

Never erase an existing plan because generation failed.

---

# 15. Accessibility

## Contrast

- body text: WCAG AA minimum;
- primary body text: target AAA;
- trip-mode essential text: minimum 4.5:1;
- large text: minimum 3:1;
- focus indicators: minimum 3:1 against adjacent surfaces.

## Touch targets

Minimum: 44 × 44dp.

Preferred primary actions: 48–52dp.

## Screen readers

Use labels in this pattern:

`[Action], [object], [state/value]`

Example:

`Add expense, trip Barcelona, button`

Budget:

`120 PLN left today, budget status`

AI activity:

`Visit museum, AI suggestion, estimated 40 to 60 PLN, editable`

## Focus order

Follow visual order:
1. navigation;
2. title/context;
3. primary content;
4. secondary content;
5. primary action;
6. secondary actions.

## Dynamic type

Support up to 200%.

Never hide important information solely because text becomes larger.

## Color blindness

Use:
- text labels;
- icons;
- patterns;
- direct values.

Never rely on green/yellow/orange alone.

## Reduced motion

Respect OS reduced-motion settings.

Decorative animation must be disabled.

---

# 16. Internationalization

All UI text must use i18n keys.

Example:

```ts
t('expense.save')
t('budget.remainingToday')
t('ai.suggestion')
```

Never:

```ts
<Text>Save expense</Text>
```

Currency formatting must use:

```ts
Intl.NumberFormat(locale, {
  style: 'currency',
  currency,
})
```

However, the rendered design must preserve the explicit currency requirement.

Dates must use locale-aware formatting.

Pluralization must be handled by the i18n layer.

---

# 17. Offline-first behavior

The app must remain useful with bad or missing connectivity.

## Locally safe actions

Queue:
- expenses;
- edits to existing activities;
- locks;
- notes.

Do not queue actions requiring guaranteed server-side uniqueness without a conflict strategy.

## Sync state

Use:
- `Synced`;
- `Pending`;
- `Failed`.

Every pending item gets a small sync indicator.

Offline mode must never make the app appear broken.

---

# 18. Responsive behavior

React Native dimensions are in dp.

Breakpoints:

| Mode | Width |
|---|---:|
| Compact | `< 360dp` |
| Standard | `360–599dp` |
| Large | `600–899dp` |
| Tablet | `>= 900dp` |

On compact screens:
- reduce horizontal padding from 20dp to 16dp;
- preserve 44dp touch targets;
- allow text wrapping.

On tablet:
- max content width 720dp;
- center content;
- use two-column planning layouts where appropriate.

---

# 19. Implementation Architecture

Recommended theme structure:

```text
apps/mobile/src/theme/
  tokens.ts
  theme.ts
  typography.ts
  shadows.ts
  motion.ts
```

Component styling must consume semantic theme tokens rather than raw palette values.

Correct:

```ts
backgroundColor: theme.colors.surface
```

Incorrect:

```ts
backgroundColor: '#FFFFFF'
```

Correct:

```ts
padding: theme.spacing[4]
```

Incorrect:

```ts
padding: 16
```

---

# 20. Rules for the Implementing Agent

1. Use only design tokens.
2. Never hardcode colors.
3. Never hardcode spacing.
4. Never hardcode radii.
5. Never hardcode typography values.
6. Never hardcode animation durations.
7. Never hardcode shadows.
8. All user-facing text must use i18n keys.
9. Every component must implement default, pressed, focused, disabled, loading, and error states where applicable.
10. Every screen must implement loading, empty, error, and offline states.
11. Every money value must include currency.
12. Every AI-generated item must be marked `AI suggestion` / `Sugestia AI`.
13. Every AI estimate must be a range.
14. Never use color as the only semantic indicator.
15. All touch targets must be at least 44 × 44dp.
16. Respect Dynamic Type.
17. Respect reduced motion.
18. Do not introduce another icon library.
19. Do not introduce another font family without explicit approval.
20. Do not create gradients unless a future token explicitly defines one.
21. Do not use glassmorphism.
22. Do not use emoji as interface icons.
23. Preserve user-entered data during errors.
24. Preserve existing plans when AI generation fails.
25. Offline-safe actions must remain usable.
26. Use `Intl.NumberFormat` for money.
27. Use locale-aware date formatting.
28. Keep planning mode visually rich but trip mode operationally dense.
29. Primary actions belong in the thumb zone.
30. If a requirement is not covered by this document, ask the product/design owner. Do not invent a new visual rule.

---

# 21. Token Naming Convention

Use:

```text
colors.brand.500
colors.neutral.900
colors.semantic.success
colors.budget.nearLimit

spacing.4
radius.lg

typography.heading1
typography.bodyM
typography.numericXL

elevation.level2
motion.standard
```

Semantic tokens must be preferred over primitive tokens in components.

Example:

```ts
colors.text.primary
colors.surface.default
colors.action.primary
colors.status.error
```

Primitive tokens exist to build semantic tokens, not to be used arbitrarily.

---

# 22. Definition of Done

A component is complete only when:

- [ ] Light theme implemented
- [ ] Dark theme implemented
- [ ] Default state implemented
- [ ] Pressed state implemented
- [ ] Focused state implemented
- [ ] Disabled state implemented
- [ ] Loading state implemented
- [ ] Error state implemented
- [ ] Screen-reader label implemented
- [ ] 44dp minimum touch target verified
- [ ] Dynamic Type verified
- [ ] Reduced motion verified
- [ ] Offline behavior verified where relevant
- [ ] i18n keys added
- [ ] Currency behavior verified where relevant
- [ ] No hardcoded design values remain
- [ ] No color-only semantic communication remains

---

# 23. Product North Star

The organizer should be able to answer these questions immediately:

1. Where are we going?
2. What are we doing next?
3. Who is going?
4. Where did the group split?
5. How much have we spent?
6. How much is left today?
7. What needs my attention?
8. Can I fix it quickly?

If a screen does not help answer one of these questions, its visual hierarchy should be reconsidered.
