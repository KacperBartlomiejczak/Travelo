# TRAVELO DESIGN SYSTEM — SUNLINE EDITORIAL

**Status:** FINAL / Phase 4 complete — Foundations, Components, Screens, Copy, AI UX, Accessibility & Agent Rules  
**Applies to:** React Native + Expo mobile app  
**Canonical token file:** `src/theme/tokens.ts`  
**Direction:** Sunline Editorial  
**Theme support:** Light + Dark. Every screen, the `/` “Podróż” trip view included, follows the phone's theme (`theme-split-and-profile-prefill` D1). Only the welcome screen and the photo viewer are drawn dark in both themes, through `DarkThemeScope`.

> Implementation contract: every color, spacing value, radius, type style, elevation and motion value must come from `tokens.ts`. No component-level hex values or magic numbers.

## Project notes (Travelo app, `prompts/sunline-redesign/plan.md`)

“DESIGN.md” in the text below means this file. Where this file and an older feature decision differ, this file wins, except for the points below, which Kacper decided for this app:

- **Trip view follows the theme** (D2). The hero photo fades into the current theme's `background.canvas`; trip name and dates sit below the photo in `text.primary` / `text.secondary`. `hero.text` over `hero.scrim` is used only where text really sits on a photo: the welcome screen and the photo viewer (D6).
- **Partner sign-in buttons** (Google, Discord) keep their providers' official colors, the same in both themes. They live in `tokens.ts` as `partnerBrand` and are used for these two buttons only (auth-onboarding D10, D13).
- **Disabled partner buttons** keep their provider colors (no opacity, no disabled tokens); they show disabled only through no response and the accessibility state (D11, exception to §8.0 for these two buttons).
- **Shared control tokens** (D10): `components.button.borderWidth` (1 dp outline of secondary, destructive and hero controls), `components.focusRing` (`width` 2 dp, `offset` 2 dp gap, §8.0 focused state for every interactive component), `motion.press.scale` (0.98, §8.1 pressed motion for every button variant).
- **App-specific sizes** not covered by the system (drawer width, drawer thumbnail, photo tile, cover tile, profile-setup avatar, welcome entrance duration, hero fade start) are tokens in `tokens.ts` under `components` / `screenMetrics` / `motion`, each with a comment naming its decision.
- **Skeletons pulse** (opacity 1 → 0.5 → 1 over 1200 ms, static under reduced motion) in `skeleton.base` instead of the §8.19 shimmer, until a later task replaces it (D5, profile-screen D9).
- **Copy:** Section 11 (voice and canonical strings) is not applied yet; today's i18n texts stay until a copy task (D7).
- **Expense category icons:** §2.8 and §8.6 name different icons; the choice is made with the expenses UI (D8).
- Components the app does not have yet (FAB, Avatar Group, Activity Card, Flight Card, Daily-Budget Meter, timeline, quick-add, share summary) are specified here for their future features; they are not built by the redesign (D1).

---

# 1. Principles

## 1.1 Destination first, utility immediately after

Travelo should make the trip feel worth anticipating, then get out of the organizer’s way.

| Do | Don't |
|---|---|
| Use one high-impact destination image or editorial heading at the top of a major travel screen. | Stack multiple decorative image cards before the user reaches useful information. |
| Use Fraunces for the trip name, day title or summary moment. | Use Fraunces for form labels, tables, inputs or dense budget UI. |
| Move from emotional hero → operational content in one scroll. | Turn every card into an editorial poster. |

**Psychological rationale:** a single emotional anchor builds anticipation without taxing working memory during task-focused use.

## 1.2 One organizer, one clear next action

The interface is designed for the person coordinating the trip, not for a social feed.

| Do | Don't |
|---|---|
| Give each screen one visually dominant action. | Present several coral buttons with equal weight. |
| Keep secondary actions as text, ghost, menu or sheet actions. | Make every possible action visible at once. |
| Put the next task in the lower thumb zone when possible. | Put the primary action in the top-right corner on a tall phone. |

**Psychological rationale:** one dominant next action lowers choice paralysis when the organizer is already managing people, time and money.

## 1.3 Coral means action, not decoration

`brand.primary` is scarce and functional.

| Do | Don't |
|---|---|
| Use coral for the primary CTA, current day, selected state and a small number of actionable accents. | Use coral as a card background just to make a screen “less empty.” |
| Use `text.brand` for inline brand-colored text. | Use `brand.primary` as normal text on light backgrounds. |
| Use semantic colors for status. | Use coral for errors just because it resembles red. |

**Psychological rationale:** a scarce accent becomes a pre-attentive cue for where action is possible.

## 1.4 Money informs; it never judges

Budget states describe the situation without framing spending as moral success or failure.

| Do | Don't |
|---|---|
| Say “120 PLN left today” and pair the state with a meter + label. | Say “You spent too much.” |
| Use teal → amber → terracotta for under / near / over budget. | Use green reward vs aggressive red punishment. |
| Show currency on every monetary value. | Show unlabeled numbers and expect the user to remember the currency. |

**Psychological rationale:** neutral financial feedback reduces avoidance and makes the user more willing to keep recording expenses.

## 1.5 Offline state is visible, never mysterious

Local-first actions must feel saved even when the network is unavailable.

| Do | Don't |
|---|---|
| Save eligible data immediately and show `pending`, `synced` or `failed`. | Block a local-first save behind a spinner. |
| Keep the sync state next to the thing it affects. | Hide sync failure only in global settings. |
| Explain which actions require internet. | Make a disabled button look broken. |

**Psychological rationale:** visible system status protects trust when connectivity is unreliable during travel.

## 1.6 AI proposes; the organizer decides

AI-generated plans are drafts built from real candidates, not authoritative answers.

| Do | Don't |
|---|---|
| Label generated sections and make edit / lock affordances obvious. | Blend AI content into confirmed plans without provenance. |
| Display estimated cost as a range with `~`. | Present an AI-estimated price as an exact amount. |
| Preserve locked activities when rebuilding later. | Silently overwrite user decisions. |

**Psychological rationale:** explicit agency prevents automation bias and increases trust in suggestions that are inherently uncertain.

## 1.7 Glanceable while moving

Core travel information must remain readable outdoors and with one hand.

| Do | Don't |
|---|---|
| Use `text.primary` / `text.secondary` for active-trip content and ≥44 touch targets. | Put essential trip data in low-contrast captions. |
| Prefer short rows, direct labels and tabular numbers. | Hide crucial values in prose paragraphs. |
| Keep persistent primary actions in the lower 40% of usable screen height. | Require precision taps against the top safe-area edge. |

**Psychological rationale:** high contrast, predictable placement and larger targets reduce visual search and motor error while walking or standing.

---

# 2. Color

## 2.1 Color strategy

Sunline Editorial uses warm ivory, ink, coral, Mediterranean sea blue, olive and sun-gold. Light Mode should resemble warm paper; Dark Mode should resemble ink and charcoal rather than pure black.

Coral is the brand action color. It is **not** the error color. Budget and system states use their own semantic palette.

### Primitive neutral scale — exactly 10 steps

| Token | Hex | Primary use |
|---|---|---|
| `neutral.0` | `#FFFFFF` | Elevated Light surfaces |
| `neutral.100` | `#F8F4EC` | Light canvas |
| `neutral.200` | `#EEE8DE` | Sunken Light surface / disabled fill |
| `neutral.300` | `#DED8CE` | Light subtle divider |
| `neutral.400` | `#B8B1A6` | Dark secondary text / Light border |
| `neutral.500` | `#8B857C` | Interactive border / disabled text |
| `neutral.600` | `#6D6962` | Light tertiary text |
| `neutral.700` | `#56524C` | Light secondary text |
| `neutral.800` | `#35322F` | Dark skeleton highlight / deep surface |
| `neutral.900` | `#171716` | Dark canvas |

Additional primitives: `ink = #242321`, `paper = #FFFCF7`, `white = #FFFFFF`, `black = #000000`.

## 2.2 Brand palette

| Role | Light | Dark | Usage |
|---|---|---|---|
| `brand.primary` | `#E96F51` | `#F07D5E` | Primary CTA fill, selected locator |
| `brand.pressed` | `#DC6B4E` | `#E96F51` | Pressed CTA |
| `brand.tint` | `#FBE4DC` | `#442A24` | Selected chip / low-emphasis brand surface |
| `brand.text` | `#913222` | `#FF967A` | Brand-colored text and links |
| `brand.focus` | `#B54A33` | `#FF967A` | Focus ring |
| `brand.onBrand` | `#242321` | `#171716` | Text/icons over primary CTA |

**Rule:** never use Light `brand.primary #E96F51` as normal-size text on ivory/white; use `brand.text #913222`.

## 2.3 Full Light semantic palette

| Token | Value |
|---|---|
| `background.canvas` | `#F8F4EC` |
| `background.sunken` | `#EEE8DE` |
| `surface.primary` | `#FFFCF7` |
| `surface.elevated` | `#FFFFFF` |
| `surface.inverse` | `#242321` |
| `surface.overlay` | `#FFFFFF` |
| `text.primary` | `#242321` |
| `text.secondary` | `#56524C` |
| `text.tertiary` | `#6D6962` |
| `text.inverse` | `#F8F4EC` |
| `text.disabled` | `#56524C` |
| `text.brand` | `#913222` |
| `border.subtle` | `#DED8CE` |
| `border.default` | `#B8B1A6` |
| `border.interactive` | `#8B857C` |
| `border.focus` | `#B54A33` |
| `hero.scrim` | `rgba(17, 17, 16, 0.82)` |
| `hero.text` | `#FFFFFF` |

## 2.4 Full Dark semantic palette

| Token | Value |
|---|---|
| `background.canvas` | `#171716` |
| `background.sunken` | `#111110` |
| `surface.primary` | `#201F1D` |
| `surface.elevated` | `#292724` |
| `surface.inverse` | `#F8F4EC` |
| `surface.overlay` | `#302E2B` |
| `text.primary` | `#F5F1E8` |
| `text.secondary` | `#B8B1A6` |
| `text.tertiary` | `#AAA398` |
| `text.inverse` | `#171716` |
| `text.disabled` | `#AAA398` |
| `text.brand` | `#FF967A` |
| `border.subtle` | `#3A3733` |
| `border.default` | `#4D4943` |
| `border.interactive` | `#777064` |
| `border.focus` | `#FF967A` |
| `hero.scrim` | `rgba(17, 17, 16, 0.82)` |
| `hero.text` | `#FFFFFF` |


## 2.5 Supporting theme tokens

These tokens are part of the same theme contract and may be used only for their named purpose.

| Role | Light | Dark | Rule |
|---|---|---|---|
| `accent.sea` | `#4C8FA3` | `#82AFBA` | Decorative travel/route accent; not body text |
| `accent.olive` | `#8D9464` | `#A4AA78` | Decorative nature accent; not status |
| `accent.sun` | `#D6A34D` | `#E0B45E` | Decorative sunlight/arrival accent; not warning |
| `icon.primary` | `#242321` | `#F5F1E8` | Primary icon |
| `icon.secondary` | `#6D6962` | `#B8B1A6` | Secondary icon |
| `icon.disabled` | `#56524C` | `#AAA398` | Disabled icon |
| `disabled.background` | `#EEE8DE` | `#292724` | Disabled control fill |
| `disabled.foreground` | `#56524C` | `#AAA398` | Disabled label/icon |
| `sync.synced` | `#357A69` | `#67B59D` | Always paired with “Synced”/localized equivalent or icon |
| `sync.pending` | `#A87512` | `#E0B45E` | Always paired with pending copy/icon |
| `sync.failed` | `#A95449` | `#E5897F` | Always paired with failed copy/icon |
| `skeleton.base` | `#EEE8DE` | `#292724` | Loading block |
| `skeleton.highlight` | `#FFFCF7` | `#35322F` | Shimmer highlight; disabled under reduced motion |
| `hero.controlBackground` | `rgba(17,17,16,0.72)` | same | Photo-overlay control fill |
| `hero.controlBorder` | `rgba(255,255,255,0.28)` | same | Photo-overlay control border |

`accent.*` colors are decorative/thematic only. They must never replace semantic success/warning/error/info colors.

## 2.6 Semantic status colors

### Light

| State | Foreground | Background | Solid |
|---|---|---|---|
| Success | `#1E534E` | `#E1F0ED` | `#3E8279` |
| Warning | `#604308` | `#F4E8C8` | `#A87512` |
| Error | `#7D342D` | `#F7E2DF` | `#A95449` |
| Info | `#1F5060` | `#DFEDF1` | `#347B98` |

### Dark

| State | Foreground | Background | Solid |
|---|---|---|---|
| Success | `#9AD3CB` | `#1A3431` | `#67B59D` |
| Warning | `#F1CE78` | `#3A311C` | `#E0B45E` |
| Error | `#F2A29A` | `#3A2522` | `#E5897F` |
| Info | `#8EC5D4` | `#1B3037` | `#70A3B2` |

Use success for successful sync/confirmation, warning for attention without failure, error for validation/system failure, and info for neutral system guidance.

## 2.7 Budget-state colors

Budget state must always be conveyed through **color + label + icon/meter state**, never color alone.

### Light

| State | Foreground | Background | Meter | Copy intent |
|---|---|---|---|---|
| Under budget | `#1E534E` | `#E1F0ED` | `#4D948B` | Informative: remaining amount |
| Near limit | `#604308` | `#F4E8C8` | `#B9831C` | Heads-up: remaining amount + pace |
| Over budget | `#7D342D` | `#F7E2DF` | `#B85B50` | Factual: exceeded amount, no blame |

### Dark

| State | Foreground | Background | Meter | Copy intent |
|---|---|---|---|---|
| Under budget | `#9AD3CB` | `#1A3431` | `#67B59D` | Informative |
| Near limit | `#F1CE78` | `#3A311C` | `#E0B45E` | Heads-up |
| Over budget | `#F2A29A` | `#3A2522` | `#E5897F` | Factual |

**Threshold contract for later budget components:** `under` = forecast spend ≤ 80% of available daily budget; `near` = >80% and ≤100%; `over` = >100%. The UI must also show the exact remaining/exceeded amount, because thresholds alone are not meaningful enough.

## 2.8 Expense category colors

| Category | Light | Dark | Required icon | Non-color marker |
|---|---|---|---|---|
| Food | `#B86F16` | `#E6A64D` | `UtensilsCrossed` | Circle |
| Transport | `#347B98` | `#68A9C1` | `Route` | Square |
| Stay | `#8064A2` | `#B49AD1` | `BedDouble` | Diamond |
| Activities | `#357A69` | `#67B59D` | `Ticket` | Triangle |
| Other | `#6D6962` | `#B8B1A6` | `Shapes` | Ring |

Rules:
1. Every chart legend shows category icon + localized label + value.
2. A chart segment may never be identified only by hue.
3. If a chart library supports point/marker shapes, use the marker above.
4. For a donut/pie, use direct labels or a legend immediately adjacent; do not require matching colors from memory.
5. Do not introduce a sixth category color without adding a new token in both themes and testing it against the existing set.

## 2.9 Verified text contrast

Contrast ratios below were calculated with the WCAG relative-luminance formula. Normal text requires ≥4.5:1; AAA is ≥7:1. The system intentionally targets AAA for primary and secondary body text wherever feasible.

| Mode | Text role | Background role | Pair | Ratio | WCAG |
|---|---|---|---|---:|---|
| Light | `textPrimary` | `canvas` | `#242321` / `#F8F4EC` | 14.31:1 | AAA |
| Light | `textPrimary` | `surface` | `#242321` / `#FFFCF7` | 15.34:1 | AAA |
| Light | `textPrimary` | `elevated` | `#242321` / `#FFFFFF` | 15.70:1 | AAA |
| Light | `textSecondary` | `canvas` | `#56524C` / `#F8F4EC` | 7.07:1 | AAA |
| Light | `textSecondary` | `surface` | `#56524C` / `#FFFCF7` | 7.58:1 | AAA |
| Light | `textSecondary` | `elevated` | `#56524C` / `#FFFFFF` | 7.76:1 | AAA |
| Light | `textTertiary` | `canvas` | `#6D6962` / `#F8F4EC` | 4.98:1 | AA |
| Light | `textTertiary` | `surface` | `#6D6962` / `#FFFCF7` | 5.33:1 | AA |
| Light | `textTertiary` | `elevated` | `#6D6962` / `#FFFFFF` | 5.46:1 | AA |
| Light | `brandText` | `canvas` | `#913222` / `#F8F4EC` | 7.13:1 | AAA |
| Light | `brandText` | `surface` | `#913222` / `#FFFCF7` | 7.65:1 | AAA |
| Light | `textInverse` | `inverse` | `#F8F4EC` / `#242321` | 14.31:1 | AAA |
| Light | `onBrand` | `brand` | `#242321` / `#E96F51` | 5.13:1 | AA |
| Light | `onBrand` | `brandPressed` | `#242321` / `#DC6B4E` | 4.68:1 | AA |
| Light | `disabled.foreground` | `disabled.background` | `#56524C` / `#EEE8DE` | 6.37:1 | AA |
| Light | `successFg` | `successBg` | `#1E534E` / `#E1F0ED` | 7.45:1 | AAA |
| Light | `warningFg` | `warningBg` | `#604308` / `#F4E8C8` | 7.48:1 | AAA |
| Light | `errorFg` | `errorBg` | `#7D342D` / `#F7E2DF` | 7.04:1 | AAA |
| Light | `infoFg` | `infoBg` | `#1F5060` / `#DFEDF1` | 7.38:1 | AAA |
| Dark | `textPrimary` | `canvas` | `#F5F1E8` / `#171716` | 15.92:1 | AAA |
| Dark | `textPrimary` | `surface` | `#F5F1E8` / `#201F1D` | 14.61:1 | AAA |
| Dark | `textPrimary` | `elevated` | `#F5F1E8` / `#292724` | 13.21:1 | AAA |
| Dark | `textSecondary` | `canvas` | `#B8B1A6` / `#171716` | 8.44:1 | AAA |
| Dark | `textSecondary` | `surface` | `#B8B1A6` / `#201F1D` | 7.75:1 | AAA |
| Dark | `textSecondary` | `elevated` | `#B8B1A6` / `#292724` | 7.01:1 | AAA |
| Dark | `textTertiary` | `canvas` | `#AAA398` / `#171716` | 7.18:1 | AAA |
| Dark | `textTertiary` | `surface` | `#AAA398` / `#201F1D` | 6.59:1 | AA |
| Dark | `textTertiary` | `elevated` | `#AAA398` / `#292724` | 5.96:1 | AA |
| Dark | `brandText` | `canvas` | `#FF967A` / `#171716` | 8.45:1 | AAA |
| Dark | `brandText` | `surface` | `#FF967A` / `#201F1D` | 7.76:1 | AAA |
| Dark | `textInverse` | `inverse` | `#171716` / `#F8F4EC` | 16.35:1 | AAA |
| Dark | `onBrand` | `brand` | `#171716` / `#F07D5E` | 6.66:1 | AA |
| Dark | `onBrand` | `brandPressed` | `#171716` / `#E96F51` | 5.86:1 | AA |
| Dark | `disabled.foreground` | `disabled.background` | `#AAA398` / `#292724` | 5.96:1 | AA |
| Dark | `successFg` | `successBg` | `#9AD3CB` / `#1A3431` | 7.95:1 | AAA |
| Dark | `warningFg` | `warningBg` | `#F1CE78` / `#3A311C` | 8.46:1 | AAA |
| Dark | `errorFg` | `errorBg` | `#F2A29A` / `#3A2522` | 7.09:1 | AAA |
| Dark | `infoFg` | `infoBg` | `#8EC5D4` / `#1B3037` | 7.27:1 | AAA |

### Outdoor-readability contract

For active-trip use:
- Essential text must use `text.primary` or `text.secondary`, never `text.tertiary`.
- Light primary text on canvas is `14.31:1`; Light secondary is `7.07:1`.
- Dark primary text on canvas is `15.92:1`; Dark secondary is `8.44:1`.
- Text placed over photography must sit inside the `hero.scrim` region.
- `hero.scrim = rgba(17,17,16,0.82)`. Over the brightest possible underlying pixel (`#FFFFFF`), the composited background is approximately `#3C3C3B`; white hero text is therefore at least `11.04:1`. Darker image pixels only increase contrast.
- Interactive control boundaries that need a visible outline use `border.interactive`: `#8B857C` on Light paper and `#777064` on Dark surfaces. Subtle dividers are not used as the sole boundary of a control.

Disabled controls still use readable foreground/background pairs (`6.37:1` Light, `5.96:1` Dark). Do not apply whole-component opacity; use the dedicated disabled tokens directly so text remains legible.

**Psychological rationale:** warm colors preserve the travel-journal personality while verified luminance keeps essential information readable under stress and outdoor glare.

---

# 3. Typography

## 3.1 Font families

Use only these free Google Fonts through Expo:

- **UI / data / body:** DM Sans
- **Editorial / destination display:** Fraunces

Required font faces:

```ts
DMSans_400Regular
DMSans_500Medium
DMSans_600SemiBold
DMSans_700Bold
Fraunces_500Medium
Fraunces_600SemiBold
```

Do not use synthetic bold/italic. Load the exact face required by the token.

## 3.2 Type scale

| Token | Family | Size | Line height | Weight | Letter spacing | Usage |
|---|---|---:|---:|---:|---:|---|
| `displayXL` | Fraunces | 40 | 44 | 600 | -0.6 | Trip hero / share-summary headline only |
| `displayLG` | Fraunces | 34 | 40 | 600 | -0.4 | Major destination/title |
| `headingXL` | Fraunces | 28 | 34 | 600 | -0.2 | Screen title with editorial value |
| `headingLG` | DM Sans | 24 | 30 | 700 | -0.2 | Functional screen title |
| `headingMD` | DM Sans | 20 | 26 | 700 | -0.1 | Section title |
| `headingSM` | DM Sans | 18 | 24 | 600 | 0 | Card title |
| `bodyLG` | DM Sans | 17 | 26 | 400 | 0 | Lead body / readable explanation |
| `bodyMD` | DM Sans | 15 | 22 | 400 | 0 | Default body |
| `bodySM` | DM Sans | 13 | 18 | 400 | 0.1 | Supporting body |
| `labelLG` | DM Sans | 16 | 20 | 600 | 0 | Primary control |
| `labelMD` | DM Sans | 14 | 18 | 600 | 0.1 | Secondary control / row metadata |
| `labelSM` | DM Sans | 12 | 16 | 600 | 0.3 | Chips / compact status |
| `caption` | DM Sans | 12 | 16 | 500 | 0.2 | Time, metadata, secondary helper |
| `eyebrow` | DM Sans | 11 | 14 | 700 | 1.4 | Short uppercase section locator only |
| `moneyXL` | DM Sans | 32 | 38 | 700 | -0.4 | Daily budget / summary total |
| `moneyLG` | DM Sans | 24 | 30 | 700 | -0.2 | Major amount |
| `moneyMD` | DM Sans | 18 | 24 | 600 | 0 | Row/card amount |
| `numeric` | DM Sans | 15 | 22 | 600 | 0 | Timer, flight time, aligned numbers |

`moneyXL`, `moneyLG`, `moneyMD` and `numeric` set `fontVariant: ['tabular-nums']`.

## 3.3 Usage rules

1. Fraunces is limited to one dominant editorial region per screen.
2. Never use Fraunces inside inputs, buttons, chips, tabs, finance tables or status UI.
3. Money always uses a money token and includes the ISO-aware display currency.
4. Timers, flight times and horizontally compared numbers use `numeric`.
5. `eyebrow` may be uppercase but must remain ≤24 visible characters.
6. No text style may be created ad hoc in a component. If the scale cannot express a real need, add a token first.

## 3.4 Dynamic Type / font scaling

- React Native `Text` must keep `allowFontScaling={true}` or omit the prop.
- Do not set a global `maxFontSizeMultiplier`.
- Text containers must grow vertically; never clip by fixed text height.
- Buttons use `minHeight`, not fixed height, once text scaling increases.
- At large font sizes, horizontal button groups stack vertically.
- The floating pill navigation may switch to icon + two-line label or a vertically larger container; it must not disable font scaling.
- Truncation is allowed only for user-generated trip/member names where the surrounding layout cannot expand; provide the full value to accessibility APIs.
- Money values may wrap as amount + currency on two lines rather than shrink text.

**Psychological rationale:** Fraunces creates memorable travel moments while DM Sans and tabular figures keep operational information stable, scannable and predictable.

---

# 4. Spacing, Layout & Shape

## 4.1 Spacing scale

The system uses a 4-point micro-grid with 8-point major rhythm. Only values below are allowed.

| Token | Value |
|---|---:|
| `spacing.0` | 0 |
| `spacing.1` | 4 |
| `spacing.2` | 8 |
| `spacing.3` | 12 |
| `spacing.4` | 16 |
| `spacing.5` | 20 |
| `spacing.6` | 24 |
| `spacing.8` | 32 |
| `spacing.10` | 40 |
| `spacing.12` | 48 |
| `spacing.16` | 64 |
| `spacing.20` | 80 |
| `spacing.24` | 96 |

Preferred cadence:
- Icon ↔ label: `8`
- Inline metadata: `8`
- Card internal gap: `12`
- Card padding: `16` or `20`
- Section internal gap: `16` or `20`
- Major section gap: `32`
- Major editorial break: `48`

## 4.2 Screen grid

| Rule | Exact value |
|---|---:|
| Screen gutter, width <390 | 16 |
| Screen gutter, width ≥390 and <768 | 20 |
| Screen gutter, width ≥768 | 32 |
| Max centered content width | 720 |
| Default section gap | 32 |
| Default card gap | 12 |
| Minimum touch target | 44 × 44 |
| Standard primary control min-height | 52 |
| Compact control min-height | 44 |
| FAB | 56 × 56 |
| Floating nav pill base min-height | 64 |

Implementation:
- Width <390: `screenGutterCompact`.
- Width 390–767: `screenGutter`.
- Width ≥768: `screenGutterTablet` and center content with `maxWidth: 720`.
- Full-bleed photography may ignore horizontal gutter; text never does unless it is intentionally over the hero with its own 20 dp inset.
- Lists use one vertical column on phones. Do not introduce two-column cards below 768 dp.
- Cards align to the same screen grid; do not independently indent nested cards.

## 4.3 Corner radii

| Token | Value | Usage |
|---|---:|---|
| `none` | 0 | Full-bleed media |
| `xs` | 8 | Small tags, small image corners |
| `sm` | 12 | Compact controls |
| `md` | 16 | Buttons, inputs, chips with non-pill shape |
| `lg` | 20 | Standard cards |
| `xl` | 24 | Large content card |
| `hero` | 28 | Hero/media card |
| `sheet` | 28 | Bottom-sheet top corners |
| `pill` | 999 | Pills, avatar status, floating nav |

Rules:
- Primary button: `radius.md = 16`.
- Text input: `radius.md = 16`.
- Standard card: `radius.lg = 20`.
- Hero card: `radius.hero = 28`.
- Bottom sheet: top-left/top-right `28`, bottom corners `0`.
- Do not nest two rounded surfaces with the same radius and <8 dp separation.

## 4.4 Thumb-zone rules

Define the thumb-priority zone as the lower **40%** of the usable screen (`thumbZoneStartRatio = 0.60`).

- Primary actions in task flows must be sticky near the bottom safe area or naturally appear in this zone.
- The FAB center must remain ≥12 dp above the floating navigation/safe-area obstruction.
- Top bars contain navigation, overflow and low-frequency actions only.
- Destructive actions never occupy the FAB.
- If a keyboard is visible, the primary action moves above the keyboard or remains available through the keyboard action key.
- A critical flow must not require a top-corner tap followed immediately by a bottom-corner tap.

**Psychological rationale:** a constrained rhythm and lower-screen action placement reduce motor effort and make the app feel predictable when used one-handed.

---

# 5. Elevation & Surfaces

## 5.1 Surface hierarchy

### Light Mode

| Level | Surface | Typical role |
|---|---|---|
| Base | `background.canvas #F8F4EC` | Screen |
| Sunken | `background.sunken #EEE8DE` | Input-group wells / disabled region |
| Surface | `surface.primary #FFFCF7` | Standard card |
| Elevated | `surface.elevated #FFFFFF` | Floating card, sheet content |
| Overlay | `surface.overlay #FFFFFF` | Dialog / temporary overlay surface |

### Dark Mode

| Level | Surface | Typical role |
|---|---|---|
| Base | `background.canvas #171716` | Screen |
| Sunken | `background.sunken #111110` | Inset region |
| Surface | `surface.primary #201F1D` | Standard card |
| Elevated | `surface.elevated #292724` | Sheet / floating component |
| Overlay | `surface.overlay #302E2B` | Dialog |

Dark Mode depth is communicated by luminance and border strength, **not black drop shadows**.

## 5.2 Elevation tokens

### Light

| Level | iOS `shadowColor` | `shadowOffset` | `shadowOpacity` | `shadowRadius` | Android `elevation` | Use |
|---|---|---|---:|---:|---:|---|
| 0 | `#171716` | `{0,0}` | 0 | 0 | 0 | Flat |
| 1 | `#171716` | `{0,2}` | 0.08 | 6 | 2 | Standard floating card |
| 2 | `#171716` | `{0,6}` | 0.12 | 16 | 5 | FAB / nav pill / sheet |
| 3 | `#171716` | `{0,12}` | 0.16 | 28 | 9 | Modal/dialog only |

### Dark

| Level | Shadow | Android elevation | Border |
|---|---|---:|---|
| 0 | none | 0 | none |
| 1 | none | 0 | `1 × #3A3733` |
| 2 | none | 0 | `1 × #4D4943` |
| 3 | none | 0 | `1 × #777064` |

Rules:
- A standard card is usually Level 0 in Light if separation is already clear through background; do not shadow every card.
- Level 1 is for genuinely raised interactive surfaces.
- Level 2 is reserved for floating navigation, FAB and bottom sheets.
- Level 3 is reserved for blocking dialogs.
- Never stack Level 2 inside Level 2.
- Dark Mode does not simulate depth with black shadow; it uses `surface.elevated` / `surface.overlay` + border token.

**Psychological rationale:** restrained elevation clarifies interaction layers without making the travel content feel like a pile of template cards.

---

# 6. Iconography

## 6.1 Library

Use **`lucide-react-native` only** for product icons.

| Token | Value |
|---|---:|
| `strokeWidth` | 1.75 |
| `size.xs` | 16 |
| `size.sm` | 20 |
| `size.md` | 24 |
| `size.lg` | 28 |
| `size.xl` | 32 |
| Icon-button touch target | 44 |

Rules:
1. Default UI icon is `20` or `24` with `strokeWidth={1.75}`.
2. Do not use emoji as UI icons.
3. Do not mix Lucide with Material/SF Symbols inside the product UI.
4. Active state changes color/background/label; do not change stroke width.
5. Icon-only controls require an accessibility label.
6. Decorative icons must be hidden from the accessibility tree.
7. Icons inside 52 dp buttons are normally 20 dp.
8. Hero overlay controls use 24 dp icons in a 44 dp minimum target.
9. Category/status meaning always includes text or an additional non-color cue.

## 6.2 Illustration style

Empty-state illustrations must be implementable without an external asset pipeline.

Specification:
- Canvas: `160 × 120`.
- Maximum visual bounds: `144 × 104`.
- Build from Lucide icons + simple React Native / SVG geometric shapes.
- Stroke: `1.75`.
- Maximum colors per illustration: one brand/semantic color + one secondary thematic color + neutrals.
- No gradients inside empty-state illustration artwork.
- No 3D, characters, emoji, photorealistic stock art or glassmorphism.
- Corner radius for geometric blocks: `12`.
- Illustrations are decorative; the title and action contain the actual meaning.

Example: empty trips = `MapPinned` + small route line + one coral locator, not an airplane emoji.

**Psychological rationale:** one consistent outline language improves recognition speed and prevents decorative icon noise from competing with travel photography.

---

# 7. Motion

## 7.1 Timing tokens

| Token | Duration | Use |
|---|---:|---|
| `instant` | 0 ms | State that must update immediately |
| `pressIn` | 90 ms | Press feedback |
| `fast` | 120 ms | Small visibility change |
| `standard` | 180 ms | Standard control transition |
| `emphasis` | 260 ms | Structural reveal |
| `slow` | 360 ms | Rare large transition |
| `reduced` | 80 ms | Reduced-motion opacity-only fallback |

## 7.2 Easing

Use with Reanimated `Easing.bezier(...)`.

| Token | Curve |
|---|---|
| `standard` | `(0.20, 0.00, 0.00, 1.00)` |
| `enter` | `(0.16, 1.00, 0.30, 1.00)` |
| `exit` | `(0.40, 0.00, 1.00, 1.00)` |
| `linear` | `(0.00, 0.00, 1.00, 1.00)` |

Do not invent component-specific curves.

## 7.3 What animates

Allowed:
- press state,
- sheet/dialog entry and exit,
- selected-tab/chip indicator,
- expandable detail region,
- sync/confirmation state change,
- timeline structural reveal,
- skeleton shimmer only while actively loading.

Not allowed:
- looping decorative motion,
- parallax tied to travel photography,
- count-up animations for money,
- bouncing budget meter,
- auto-playing carousel,
- animation merely because a screen opened,
- animated color-only warning with no persistent label.

## 7.4 Reduced motion

Respect the OS reduced-motion setting.

When enabled:
- Remove translation, scale, parallax, lane separation and stagger.
- Replace structural animations with an `80 ms` opacity crossfade.
- Do not run shimmer; show static skeleton blocks.
- Do not animate numbers.
- Bottom sheet may appear/disappear with an 80 ms opacity transition while preserving normal interaction semantics.
- State changes remain immediate and are announced to assistive technology where appropriate.

## 7.5 Required microinteractions

### Expense saved

Normal motion:
1. Save button press: scale to `0.98` in `90 ms`, `standard` easing.
2. On successful local save, replace action icon/label with confirmation state using `160 ms` opacity transition.
3. Do **not** wait for remote sync.
4. Snackbar enters in `220 ms`; later sync status changes independently.
5. Amount total updates immediately; no count-up animation.

Reduced motion: no scale; confirmation crossfades in `80 ms`.

### Plan generated

Normal motion:
1. Generation placeholder changes to completed plan.
2. Cards enter with `220 ms` opacity + 8 dp upward-to-zero translation.
3. Stagger = `45 ms`.
4. Animate at most first `6` cards; remaining cards appear together with card 6.
5. Never animate map pins continuously.

Reduced motion: all cards appear together with an `80 ms` opacity crossfade.

### Activity locked

Normal motion:
1. Lock affordance changes state in `180 ms`.
2. Lock icon scales `0.92 → 1.00`.
3. Card content does not move.
4. Persistent “locked” icon/text remains after animation.

Reduced motion: icon/state swaps instantly with an `80 ms` opacity crossfade.

### Group split revealed

Normal motion:
1. Shared timeline becomes parallel lanes.
2. Each lane translates `16 dp` away from the shared centerline over `260 ms` with `enter` easing.
3. Lane labels/avatar group fade in over `180 ms`.
4. The time axis stays fixed; users must not lose temporal orientation.

Reduced motion: lanes render in final position with one `80 ms` opacity crossfade; no translation.

## 7.6 Reanimated implementation rule

Use tokenized timing only:

```ts
withTiming(value, {
  duration: tokens.motion.duration.standard,
  easing: Easing.bezier(...tokens.motion.easing.standard),
});
```

Do not use arbitrary springs in product UI. If a future interaction genuinely needs spring physics, define one shared spring token in `tokens.ts` before implementation.

**Psychological rationale:** short, purposeful motion explains state change and spatial relationships without delaying the organizer or turning routine actions into spectacle.

---

## Phase 2 implementation summary

Sections 1–7 above remain the canonical foundation layer. `src/theme/tokens.ts` remains the machine-readable source of exact design values. Phase 3 extends that token file only with component and screen metrics needed to avoid magic numbers; no Phase 2 visual decision is replaced.

---

# 8. Components

## 8.0 Component contract

All components in this section are React Native / Expo components. They must consume semantic values from `tokens.ts`; component dimensions that are not general foundation values live under `tokens.components` and screen-specific dimensions live under `tokens.screenMetrics`.

Every interactive component implements these states even when a particular screen normally uses only a subset:

| State | Required behavior |
|---|---|
| `default` | Full contrast, normal affordance, enabled hit target. |
| `pressed` | Immediate visual acknowledgement; never move layout. |
| `focused` | Visible 2 dp focus ring / border using `border.focus`; used for keyboard, switch-control and text focus. |
| `disabled` | Non-interactive, uses `disabled.background` + `disabled.foreground`; never opacity-only. |
| `loading` | Keeps original footprint; blocks duplicate action; label remains understandable or is paired with progress state. |
| `error` | Persistent icon + text where error is meaningful; never color-only. |

**Psychological rationale:** consistent state grammar makes controls predictable even when the organizer is moving, distracted or offline.

## 8.1 Button

### API

```ts
type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "compact";

type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
  onPress: () => void;
};
```

### Anatomy

1. Pressable container.
2. Optional leading icon.
3. Label.
4. Optional trailing icon.
5. Optional inline loading indicator replacing only the icon region; do not change width.

### Geometry

| Property | Value |
|---|---|
| Default height | `components.button.height = 52` |
| Compact height | `components.button.compactHeight = 44` |
| Horizontal padding | `components.button.horizontalPadding = 20` |
| Icon gap | `components.button.iconGap = 8` |
| Radius | `components.button.radius = radii.md = 16` |
| Label | `typography.styles.labelLG` default, `labelMD` compact |
| Icon | `iconography.size.sm = 20`, stroke `1.75` |

### Variants

| Variant | Default | Pressed | Focused |
|---|---|---|---|
| Primary | bg `brand.primary`, text/icon `brand.onBrand` | bg `brand.pressed` | 2 dp outer ring `brand.focus` with 2 dp visual separation from button edge |
| Secondary | bg `surface.primary`, text/icon `text.primary`, 1 dp `border.default` | bg `background.sunken` | 2 dp `border.focus` |
| Ghost | transparent, text/icon `text.brand` | bg `brand.tint` | 2 dp `border.focus` |
| Destructive | bg `semantic.error.background`, text/icon `semantic.error.foreground` | use same bg plus 1 dp `semantic.error.foreground` border | 2 dp `semantic.error.foreground` |

### Shared states

- **Disabled:** `disabled.background`, `disabled.foreground`; remove decorative shadow; accessibility state `disabled: true`.
- **Loading:** keep exact button width and height. Replace leading icon with a 20 dp ActivityIndicator. Primary spinner = `brand.onBrand`; others = current foreground. Set accessibility label to action + loading state.
- **Error:** only for an action whose last attempt failed. Preserve variant styling and place `CircleAlert` 20 dp before label. Do not pulse. Error explanation appears adjacent to the relevant area or in a Snackbar.
- **Pressed motion:** scale `1 → 0.98` over `motion.duration.pressIn = 90`; reduced motion = no scale.

### Usage rules

- Exactly one Primary Button may be visually dominant within one decision region.
- A destructive action is never the default focused action in a dialog.
- Full-width primary actions use available content width inside screen gutter.
- Buttons never contain multi-line labels.

**Psychological rationale:** one dominant coral action shortens decision time; restrained destructive styling prevents accidental fear cues.

## 8.2 Icon Button

### API

```ts
type IconButtonProps = {
  icon: LucideIcon;
  accessibilityLabel: string;
  size?: "default" | "large";
  tone?: "default" | "hero" | "destructive";
  selected?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};
```

### Geometry

- Default: `components.iconButton.size = 44` square.
- Large: `components.iconButton.largeSize = 52` square.
- Radius: `components.iconButton.radius = radii.pill`.
- Icon: 20 dp default, 24 dp large.

### States

- **Default:** surface button uses `surface.primary` + `icon.primary`; hero uses `hero.controlBackground` + `hero.text` + 1 dp `hero.controlBorder`.
- **Pressed:** surface → `background.sunken`; hero stays dark but gains 1 dp `hero.text` border.
- **Focused:** 2 dp `border.focus` ring.
- **Selected:** `brand.tint` + `text.brand`; use only where selection persists (favorite, filter).
- **Disabled:** `disabled.background` + `disabled.foreground`.
- **Loading:** centered ActivityIndicator, icon hidden, footprint unchanged.
- **Error:** destructive icon becomes `semantic.error.foreground`; tooltip/error copy must exist elsewhere if the meaning is not obvious.

**Psychological rationale:** a fixed 44 dp target makes compact controls safe without visually inflating the interface.

## 8.3 Floating Quick-Add Button (FAB)

### Purpose

The FAB is reserved for the fastest high-frequency creation action on the current tab. In Expenses it means **Add expense**.

### Geometry and placement

- Size: `components.fab.size = 56`.
- Icon: `Plus`, `components.fab.iconSize = 24`.
- Radius: `radii.pill`.
- Background: `brand.primary`; icon: `brand.onBrand`.
- Elevation: `elevation[mode].level3`.
- Right inset: `spacing.5 = 20`.
- Bottom clearance above floating pill nav: `components.fab.bottomClearance = 84`.
- Never place two FABs on the same screen.

### States

- Default = primary button colors.
- Pressed = `brand.pressed`, scale `0.98 / 90 ms`.
- Focused = 2 dp `brand.focus` ring.
- Disabled = hidden if the action is structurally unavailable; use disabled styling only when explaining why matters (for example sign-in/offline gated server-first action).
- Loading = spinner centered; do not close the originating sheet until local save resolves.
- Error = FAB itself does not become a persistent error badge; show Snackbar and leave action available.

**Psychological rationale:** a single lower-right quick action builds muscle memory for the most repeated travel task.

## 8.4 Text Input

### API

```ts
type TextInputFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: LucideIcon;
  trailingAction?: { icon: LucideIcon; label: string; onPress: () => void };
  disabled?: boolean;
  loading?: boolean;
};
```

### Anatomy

1. External label.
2. Input container.
3. Optional leading icon.
4. Native `TextInput`.
5. Optional trailing action.
6. Helper or error line.

### Geometry

- Input height: `components.input.height = 52`.
- Horizontal padding: `16`.
- Radius: `16`.
- Default border: `1` dp `border.default`.
- Focus border: `2` dp `border.focus`; use internal padding compensation so total size does not change.
- Label gap: `8`.
- Helper gap: `6`.
- Label: `labelMD`; value: `bodyLG`; helper: `caption`.

### States

- **Default:** `surface.primary`, `border.default`, `text.primary`.
- **Pressed:** native focus begins; no extra press animation.
- **Focused:** 2 dp `border.focus`; cursor uses `brand.primary`.
- **Disabled:** `disabled.background`, `disabled.foreground`, non-editable.
- **Loading:** input remains readable; trailing region shows spinner. Do not clear user text.
- **Error:** 2 dp `semantic.error.foreground` border, `CircleAlert` 16 dp, error copy below in `semantic.error.foreground`.

### Behavior

- Never use placeholder as the only label.
- Validation triggered on submit; field may also revalidate after correction.
- Keyboard type must match data type.
- `returnKeyType` follows actual next action.

**Psychological rationale:** persistent labels reduce recall load and prevent users from losing context after entering values.

## 8.5 Amount Input

### Purpose

Optimized for one-handed expense entry and budget changes.

### Geometry

- Container height: `components.input.amountHeight = 72`.
- Amount text: `typography.styles.moneyXL`.
- Currency control: 44 dp minimum target at trailing edge.
- Container, border and focus rules match Text Input.

### Formatting rules

- Store integer minor units only.
- Format live using the selected ISO 4217 currency digit count.
- Locale formatting follows app locale (`pl` / `en`), not trip destination.
- Currency is always visible.
- While typing, preserve user intent: typing `12,5` in Polish may display `12,5` until blur; persist as minor units only after parse succeeds.
- Never use a floating point money state as the source of truth.

### States

- Default / pressed / focused / disabled / loading follow Text Input.
- Error example: invalid amount or amount = 0 when >0 required. Keep entered text and show exact validation below.
- Currency loading may show a trailing spinner without blocking numeric editing if cached currency is already known.

**Psychological rationale:** oversized tabular numerals make the most error-prone field easy to verify before saving.

## 8.6 Chips

### Variants

- `interest`
- `category`
- `filter`
- `status` (non-interactive)

### Geometry

- Visual height: `components.chip.visualHeight = 36`.
- Touchable wrapper: `components.chip.touchHeight = 44`.
- Horizontal padding: `14`.
- Icon gap: `6`.
- Radius: pill.
- Text: `labelMD`.

### Interactive states

- **Default:** `surface.primary`, `border.default`, `text.secondary`.
- **Pressed:** `background.sunken`.
- **Focused:** 2 dp `border.focus`.
- **Selected:** `brand.tint`, `text.brand`, 1 dp `brand.focus`; include Check icon where selection is not otherwise obvious.
- **Disabled:** disabled tokens.
- **Loading:** keep chip width; replace optional icon with 16 dp spinner.
- **Error:** use `semantic.error.background` + foreground and `CircleAlert`; only for validation such as “pick at least one interest.”

### Expense categories

Use category color only for the leading marker/icon, never the full chip background. Marker mapping:

- Food → `expenseCategory.food` + `Utensils`.
- Transport → `expenseCategory.transport` + `BusFront`.
- Stay → `expenseCategory.stay` + `BedDouble`.
- Activities → `expenseCategory.activities` + `Ticket`.
- Other → `expenseCategory.other` + `Shapes`.

**Psychological rationale:** restrained category color aids recognition without turning the input row into five competing CTAs.

## 8.7 Avatar and Avatar Group

### Avatar sizes

`xs 24`, `sm 32`, `md 40`, `lg 48`, `xl 64` from `components.avatar`.

Fallback:
- surface: `background.sunken`.
- initials: `labelMD` / `labelLG` depending on size.
- single initial for a one-word display name; first + last initial for multi-word names; maximum 2 glyphs.

### Avatar Group

- Default visible count: `components.avatar.groupMaxVisible = 4`.
- Overlap: `components.avatar.groupOverlap = 10` dp.
- Border: `components.avatar.borderWidth = 2`, matching current surface color.
- Additional members use `+N` circle, not a tiny fifth image.

### States

- Default = image or initials.
- Pressed = only if avatar is actionable; use surrounding 44 dp Pressable and `background.sunken` press feedback outside the avatar.
- Focused = 2 dp `border.focus` ring.
- Disabled = no interactive styling; do not dim identity imagery unless action itself is disabled.
- Loading = skeleton circle.
- Error = failed image falls back to initials; never show a broken-image icon.

**Psychological rationale:** faces identify sub-groups faster than names while initials provide a stable privacy-safe fallback.

## 8.8 List Row

### Anatomy

`Leading → Primary/secondary text stack → flexible spacer → Trailing value/action`.

### Geometry

- Minimum height `56`.
- Vertical padding `12`; horizontal `16`.
- Leading slot `40`.
- Trailing touch region minimum `44`.
- Divider starts aligned to text column, not full bleed, unless grouping semantics require full width.

### States

- Default: `surface.primary`.
- Pressed: `background.sunken`.
- Focused: 2 dp inset `border.focus`.
- Disabled: disabled foreground; no navigation chevron.
- Loading: leading + two line skeletons; preserve row height.
- Error: inline error icon + concise secondary line and optional Retry trailing action.

**Psychological rationale:** consistent alignment lets users scan flights, people and expenses without rereading row structure.

## 8.9 Card container

### Base Card

- Radius `components.card.radius = 20`.
- Padding `16`; compact padding `12`.
- Light: `surface.primary`, 1 dp `border.subtle`, `elevation.light.level1` only when the card must separate from the canvas.
- Dark: `surface.primary`, `elevation.dark.level1`; hierarchy is border/luminance-first.

### States

- Default = base surface.
- Pressed = only for actionable cards; background changes to `background.sunken` or border to `border.interactive`; never lift upward.
- Focused = 2 dp `border.focus`.
- Disabled = surface remains but controls use disabled tokens; avoid fading whole content that still communicates information.
- Loading = card-shaped skeleton matching eventual dimensions.
- Error = retain card shell; replace failed sub-content with inline error block and retry if recoverable.

**Psychological rationale:** stable card geometry protects spatial memory as data loads, syncs or fails.

## 8.10 Trip Card

### Anatomy

1. Destination image, height `components.card.tripImageHeight = 156`.
2. Optional current/upcoming eyebrow.
3. Trip name, maximum 2 lines.
4. Date range.
5. Optional compact status: offline copy / sync problem.

### Rules

- Entire card is the tap target.
- Do not overlay dense budget or flight information on the image.
- Current trip indicator = `brand.primary` 8 dp dot + text label; never coral border around the full card.
- Loading = fixed image rectangle + text skeletons.
- Error = use fallback cover color/symbol only if image fails; trip metadata remains usable.

**Psychological rationale:** photography creates destination recognition while metadata stays on a predictable reading surface.

## 8.11 Activity Card

### Anatomy

1. Time or sequence label.
2. Activity title.
3. Place / neighborhood line.
4. Duration + estimated cost range.
5. Avatar Group when activity applies to a subgroup.
6. Lock state.
7. Optional image, height `128`, only when it adds place recognition.

### Lock treatment

- Locked = `Lock` 16 dp + localized “Locked” label; icon alone is insufficient.
- Lock action uses Icon Button with explicit accessibility label.
- Locked activities survive future “rebuild today” behavior.

### States

- Default / pressed / focus follow Card.
- Disabled = only individual unavailable actions become disabled; activity stays readable.
- Loading = structured card skeleton.
- Error = rejected/stale place gets `semantic.error.background` inline region and “Replace activity” action.

**Psychological rationale:** a visible lock turns user intent into a persistent commitment signal before AI regeneration exists.

## 8.12 Flight Card with layover indicator

### Anatomy

```text
[departure] ───── connector ───── [arrival]
   WAW  08:20                       FCO  10:35
   Warsaw                           Rome

   LO301 · 2h 15m
```

For consecutive segments:

```text
Segment card
   │
   ├─ [Clock] 1h 40m layover · MUC
   │
Segment card
```

### Geometry

- Connector column width: `components.card.flightConnectorWidth = 24`.
- Airport codes: `headingMD`.
- Times: `numeric`.
- Layover block: warning palette only if operationally short/problematic once product logic defines a threshold. Until then use neutral `info` palette.
- Layover always has Clock icon + text; never color-only.

### States

- Loading = airport-code and time skeletons.
- Error = segment remains visible with `CircleAlert` and exact failing field; edit action available.
- Offline = cached data looks normal; global/section offline indicator communicates freshness.

**Psychological rationale:** spatial departure→arrival structure is faster to parse than sentence-based flight descriptions.

## 8.13 Bottom Sheet

### Geometry

- Top radii `28`.
- Max height `92%` of usable viewport.
- Horizontal padding `20`.
- Handle `36 × 4`, top margin `10`.
- Content top padding `20`.
- Footer bottom padding `16 + safe-area inset`.
- Background `surface.overlay`.
- Modal backdrop opacity uses `components.bottomSheet.backdropOpacity = 0.48`; backdrop color is black supplied through the modal layer.

### Structure

```text
Handle
Title + optional close Icon Button
Optional description
Scrollable content
Sticky footer action region
```

### Interaction

- Swipe down closes unless an irreversible operation is actively committing.
- Android Back closes.
- Keyboard opening keeps active field and primary button reachable.
- Destructive confirmation must use Dialog/Modal rather than a swipe-dismissible destructive sheet.

### States

- Loading: title stays visible; content skeleton below.
- Error: error region appears above footer action without collapsing entered form values.
- Offline: show OfflineBanner inside the sheet only when offline changes what the user can do there.

**Psychological rationale:** a bottom sheet keeps users anchored in the current trip while exposing short, focused tasks in the thumb zone.

## 8.14 Floating Pill Tabs

### Geometry

- Container height `64`.
- Radius pill.
- Horizontal padding `8`.
- 5 equal flex items, each minimum interactive width `56`.
- Icon 22 dp.
- Label gap 3 dp; label uses `labelSM`.
- Position: 12 dp above bottom safe-area inset; screen content reserves at least `tripOverview.bottomContentInset = 92`.

### States

- Default: `icon.secondary`, `text.tertiary`.
- Selected: `brand.tint` capsule inside item + `text.brand` + icon; selection includes both color and container shape.
- Pressed: selected or default item gains `background.sunken` underlay.
- Focused: 2 dp `border.focus`.
- Disabled: only permitted for a genuinely inaccessible route; do not disable placeholder tabs—open their placeholder state as current product specifies.
- Loading/error are screen states, never represented by spinning/erroring tab icons.

**Psychological rationale:** a floating pill preserves persistent orientation while its compact selected capsule prevents the navigation from competing with trip photography.

## 8.15 Segmented Control

### Geometry

- Height `44`.
- Internal padding `4`.
- Segment radius `12`.
- Container: `background.sunken`.
- Selected segment: `surface.elevated`, `elevation.level1` in Light; 1 dp border hierarchy in Dark.
- Text `labelMD`.

### States

- Pressed: immediate underlay.
- Focused: selected segment gets `border.focus`.
- Disabled: disabled tokens for segment; other segments may remain interactive.
- Loading: preserve labels; small spinner only in affected segment if asynchronous selection is unavoidable.
- Error: selection reverts to last valid segment and error appears outside the control; never leave an “error segment.”

**Psychological rationale:** a two-to-four-way segmented control exposes mutually exclusive modes without the cost of opening another screen.

## 8.16 Progress / Daily-Budget Meter

### API

```ts
type BudgetMeterState = "under" | "near" | "over";

type DailyBudgetMeterProps = {
  spentMinor: number;
  targetMinor: number;
  currency: string;
  state: BudgetMeterState;
  label: string;
  supportingText: string;
};
```

### Geometry

- Track height: `components.progress.largeTrackHeight = 12` for daily budget; `trackHeight = 8` elsewhere.
- Radius pill.
- Track background: `background.sunken`.
- Fill: `budget[state].meter`.
- State icon + textual status always displayed near the meter.

### Fill logic

- `ratio = spent / target`.
- Under and near states clamp visual fill to `[0, 1]`.
- Over state shows full track plus a persistent `TrendingUp` icon and “over by …” copy; do **not** extend the meter beyond its container or flash red.
- Budget threshold logic belongs to product/domain logic, not the component. Component only receives state.

### States

- Loading: static skeleton track and two text lines.
- Error: meter hidden; show “Budget unavailable” + Retry, keeping last known value only if repository explicitly marks it stale.
- Offline: cached/current local expenses render normally; sync state appears separately.

**Psychological rationale:** a calm continuous meter communicates pace at a glance without turning overspend into a punishment signal.

## 8.17 Snackbar / Toast

### Snackbar is the default

Use Snackbar for actionable confirmations/errors. Toast without action is permitted only for low-risk transient confirmations.

### Geometry

- Min height `48`.
- Padding `16 × 12`.
- Radius `16`.
- Max width `520` on tablet.
- Mobile inset: screen gutter `20`.
- Position above pill nav / FAB collision zone.

### Types

- Neutral: `surface.inverse` + `text.inverse`.
- Success: semantic success background/foreground, Check icon.
- Error: semantic error background/foreground, CircleAlert icon.
- Offline/pending: warning or info semantic treatment with label.

### Behavior

- Confirmation without action: `components.snackbar.durationShort = 3500 ms`.
- Snackbar with action: `components.snackbar.durationWithAction = 6000 ms`.
- Error with Retry: persistent until action, dismissal or navigation.
- Only one Snackbar at once; newer high-priority error replaces low-priority confirmation.

**Psychological rationale:** bottom-positioned transient feedback confirms local actions without dragging attention away from the task.

## 8.18 Dialog / Modal

### Geometry

- Width: viewport minus `2 × 20`, capped at `360`.
- Padding `20`.
- Radius `24`.
- Surface `surface.overlay`.
- Buttons stack vertically when localized labels cannot fit with at least 12 dp between actions.

### Rules

- Use for destructive confirmation, blocking consent or a decision that must not be dismissed accidentally.
- Primary safe action appears first visually; destructive action uses destructive button styling.
- Backdrop tap may dismiss only non-destructive informational dialogs.

### States

- Loading during commit: controls disabled, committing action shows spinner, dialog cannot be dismissed if dismissing would make outcome ambiguous.
- Error: keep dialog open; error copy appears above actions; allow retry/cancel.

**Psychological rationale:** modal friction is reserved for decisions where an accidental tap costs more than an interruption.

## 8.19 Skeleton Loaders

### Visual rules

- Base `skeleton.base`, highlight `skeleton.highlight`.
- Line height `14`; title height `22`; radius `12`.
- Skeleton must approximate final geometry, not generic grey bars.
- Shimmer duration uses `motion.duration.slow = 360` as one directional pass segment and repeats without bounce; reduced motion disables shimmer completely.
- Do not skeletonize content already present from SQLite; show cached content plus freshness/sync state instead.

### Required skeleton templates

- Trip hero.
- Trip card.
- Flight card.
- Activity card.
- List row.
- Budget meter.

**Psychological rationale:** matching final geometry reduces perceived layout instability and prevents false “blank screen” interpretation.

## 8.20 Empty State

### Anatomy

1. Simple line illustration or icon composition.
2. Heading.
3. One short explanatory sentence.
4. Primary or secondary action if the user can resolve the state.

### Geometry

- Max text width 320 dp.
- Center within available content region, not under navigation chrome.
- Illustration target 96 × 96; line art uses Lucide-like `1.75` stroke and no unmotivated emoji.

### State distinctions

- True empty = no data exists yet.
- Filter empty = data exists but current filter returns none; action clears filter.
- Permission/offline absence = not an empty state; use error/offline patterns.

**Psychological rationale:** specific empty states convert “nothing here” into an obvious first action instead of making the product feel unfinished.

---

# 9. Patterns & Key Screens

## 9.0 Screen composition rules

- Screen background uses `background.canvas` in the current theme, Home/“Podróż” included (see Project notes).
- Root horizontal gutter: `layout.screenGutter = 20`; compact fallback 16 only where device width requires it.
- Sections separated by `layout.sectionGap = 32`.
- Cards within a section separated by `layout.cardGap = 12`.
- Persistent lower actions respect safe area and floating pill nav.
- Editorial display type appears once per screen maximum unless content itself is a share/export composition.

**Psychological rationale:** a repeated vertical rhythm helps the organizer predict where information and actions will appear across features.

## 9.1 Trip Overview / Dashboard

### Goal

Answer three questions within the first screenful:

1. Where / when is this trip?
2. What happens next?
3. How is today’s spend pacing against today’s available budget?

### Layout

```text
┌──────────────────────────────────┐
│ HERO PHOTO                       │
│ [menu]                    [more] │
│                                  │
│  12–18 AUG · 7 DAYS              │
│  Mediterranean Escape            │
│  Rome, Italy                     │
│                                  │
╰──────── photo → ink fade ─────────╯

[ + ] [photo] [photo] [photo] →

TODAY · DAY 3
120 PLN left today
██████████████░░░░
~40 PLN / person available
[Under / Near / Over label + icon]

NEXT
09:30  ┌ Activity Card ───────────┐
       │ Colosseum               │
       │ ~40–60 PLN · 1h 30m     │
       └──────────────────────────┘

FLIGHTS
┌ Flight Card ────────────────────┐
└─────────────────────────────────┘

TRAVELLERS · 4
[avatars]  You, Ola, Kuba, Maja

TRIP BUDGET
2,400 PLN / person
9,600 PLN group total
~343 PLN / person / day
[Change]

        floating pill navigation
```

### Hero

- Minimum hero height `screenMetrics.tripOverview.heroMinHeight = 360`.
- Preferred height `52%` of usable viewport using `heroHeightRatio = 0.52`; clamp to avoid hiding all operational content on very short devices.
- Photo uses `cover` resize mode.
- Bottom gradient must resolve to the current theme's `background.canvas`; use a native Expo-compatible gradient implementation, no CSS filter.
- Trip name and dates sit below the photo on the canvas in `text.primary` / `text.secondary` (Project notes, D6); `hero.text` over scrim is used only for text placed on the photo itself.
- Title: `displayLG`; metadata: `labelMD` / `bodyMD`.

### Daily budget module

Use a dedicated surface card directly after the photo strip once Expenses exist.

Content order:
1. Eyebrow `TODAY · DAY N`.
2. `moneyXL`: remaining amount + currency.
3. `bodyMD`: localized “left today”.
4. Large budget meter.
5. Supporting per-person amount.
6. Status icon + supportive text.

Budget state must not reorder content. Over-budget example keeps the same hierarchy: amount can become “45 PLN over today” rather than converting the whole card into an error surface.

### Next activity

Show exactly one upcoming activity in the dashboard. “View day plan” is a text/ghost action. Do not duplicate the entire day timeline here.

### FAB

When current tab is Expenses, use expense FAB. Home does not gain a second FAB if its main purpose remains trip overview; expense quick-add may be reachable from budget module only if analytics show it is needed. Never show two equal quick-add affordances.

### Loading / offline

- If no cached trip: skeleton hero + sections.
- If cached trip: render cached data immediately, no skeleton replacement; OfflineBanner sits above floating pill navigation.
- Pending budget/expense sync appears near the affected values via SyncIndicator.

**Psychological rationale:** the dashboard starts with emotional context but transitions immediately to today’s next decision and budget pace.

## 9.2 Parallel-lane timeline for split groups

### Goal

Preserve time orientation while showing when the group is together, splits, and reunites.

### Structural model

Timeline events are either:
- `shared` — everyone participates;
- `splitStart` — introduces 2–3 parallel subgroup lanes;
- `laneActivity` — activity tied to one subgroup;
- `join` — lanes reunite;
- `gap/travel` — transport/wait interval.

### Mobile layout

Time remains in a fixed left column. The rail is fixed next to it. Parallel lanes scroll horizontally **only inside the split region** if the combined minimum lane widths exceed available width.

```text
DAY 2 · ROME

09:00  ●  Breakfast together
       │  [All avatars]
       │
10:30  ◆  GROUP SPLITS
       │  ┌──────────────┬──────────────┐
       │  │ OLA + MAJA   │ YOU + KUBA   │
11:00  │  │ Vatican      │ Testaccio    │
       │  │ ~20–30 PLN   │ ~0–15 PLN    │
       │  │              │              │
13:00  │  │ Lunch        │ Food market  │
       │  └──────────────┴──────────────┘
       │
14:30  ◆  TOGETHER AGAIN
15:00  ●  Villa Borghese
```

### Geometry

- Time column `56`.
- Rail column `24`.
- Rail 2 dp.
- Node 12 dp.
- Lane minimum width `132`.
- Lane gap `8`.
- Split header height `44`.
- Shared activity minimum height `88`.

### Lane identity

- Each lane header contains Avatar Group + member names; color is secondary only.
- Do not assign a permanent “red team / blue team” identity based only on color.
- Lane cards share the same neutral surface; a small 3 dp top marker may use expense/category/accent colors only if paired with text/icon meaning.

### Interaction

- Tapping split header expands/collapses details only if the full day plan is already understood; default state is expanded on the actual day.
- A “Show together” action may collapse future split details but must not hide the fact that a split exists.
- Locked activity indicator remains within its lane.
- Group split reveal uses the Phase 2 motion spec: lane separation 16 dp over 260 ms; reduced motion = 80 ms opacity-only.

### Error / stale places

One failed place does not collapse a whole lane. Replace that activity card body with recovery UI while keeping start/end times and lane identity.

**Psychological rationale:** the fixed time axis prevents users from losing temporal orientation when social structure becomes more complex.

## 9.3 Quick-add expense flow — target under 5 seconds

### Success definition

A repeat user who knows the amount and category can save an expense in **3 taps + typing**:

1. Open FAB.
2. Type amount.
3. Tap category.
4. Tap Save.

Currency is preselected. Payer defaults to organizer. Date/time defaults to now. These defaults are visible but do not block save.

### Entry surface

Use Bottom Sheet, not a full-screen route.

```text
            ────
Add expense

┌────────────────────────────┐
│  0.00                 PLN │  ← autofocus
└────────────────────────────┘

[Food] [Transport] [Stay]
[Activities] [Other]

Description (optional)
[ e.g. Dinner ]

Paid by
[You ▾]

Date
[Today · 19:42]              ← collapsed advanced row

[ Save expense ]
```

### Defaulting rules

- Currency = last used expense currency in this trip; fallback trip base currency.
- Category = no default on first expense. After at least one expense in current trip, the last-used category may be visually preselected only if user can see it before Save. Never silently infer category.
- Payer = organizer.
- Date/time = current device time stored according to Expense schema decision when implemented.
- Split details are **not** required for MVP because settlements are post-MVP.
- Description optional.

### Keyboard behavior

- Sheet opens with Amount Input focused and numeric keyboard visible.
- Category chips remain above the keyboard without requiring scroll on target phone sizes.
- Save button sticks above keyboard/safe area.
- Pressing keyboard “Done” does not save unless amount is valid and category already selected; if both are valid, Done may submit.

### Validation

Blocking requirements:
- amount valid and > 0;
- currency known;
- category selected.

Inline validation only after save attempt or invalid parse. Do not show red errors while the user is still typing the first digits.

### Save sequence

1. User taps Save.
2. Validate synchronously.
3. Write local expense + outbox entry to SQLite transaction.
4. Close sheet immediately after successful local transaction.
5. Update daily budget immediately.
6. Snackbar: “Expense saved” + optional sync state.
7. Network sync runs independently.

Do **not** wait for Supabase.

### Failed local save

Keep sheet open and preserve all values. Show error region above Save. This is a real save error, not a sync error.

### Pending / failed remote sync

Expense remains visible with `pending` / `failed` SyncIndicator. Failed sync exposes Retry without asking the user to re-enter the expense.

### Tap/time budget

| Step | Target |
|---|---:|
| FAB → sheet visible | ≤ 260 ms structural animation |
| Keyboard ready | platform native; no blocking network |
| Amount parse | synchronous |
| Local SQLite save | target ≤ 150 ms on supported device |
| Full repeat flow | `screenMetrics.quickExpense.targetCompletionMs = 5000` |

**Psychological rationale:** defaults remove low-value choices while visible category selection prevents accidental “smart” automation from reducing trust.

## 9.4 Group Split & Balances — POST-MVP ONLY

> **Scope guard:** this pattern is intentionally documented for future compatibility. It must **not** be implemented as part of the current MVP. Current APP CONTEXT explicitly keeps settlements / “who owes whom” out of MVP.

### Future goal

Show a simplified debt graph after expenses have enough payer/participant information to support it.

### Future hierarchy

```text
BALANCES

You are settled with the group        ← if zero
or
You should receive 184 PLN            ← aggregate orientation

SIMPLIFIED SETTLEMENTS
┌──────────────────────────────────┐
│ Kuba pays You             120 PLN│
│ [Kuba]  ───────────────▶  [You] │
│                          [Settle] │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ Maja pays Ola              64 PLN│
└──────────────────────────────────┘

How this was simplified  [Info]
```

### Future rules

- Debt simplification minimizes transfers but does not rewrite historical expenses.
- Show `X pays Y amount currency` in text; arrow and color are supplementary.
- Mixed currencies require a documented FX rule before this screen can ship.
- No celebratory/shaming language based on who owes money.
- “Settled” is a state with Check icon + text, not green alone.
- Partial settlement, payment confirmation and audit history require separate product decisions.

### Explicit coding-agent instruction

Until product scope changes, code may define reusable visual primitives used elsewhere, but must not add routes, repositories, schemas, database tables or UI entry points for settlement functionality.

**Psychological rationale:** documenting the future visual grammar avoids redesign later without silently expanding MVP scope today.

## 9.5 Shareable trip summary card

### Goal

Create a visually distinctive artifact that feels like the emotional payoff of the trip rather than a finance report.

### Export format

- Export canvas: `1080 × 1350` image pixels (`4:5`).
- React Native on-screen preview uses `previewAspectRatio = 0.8` and scales proportionally.
- Export safe inset: `screenMetrics.shareSummary.safeInset = 72` image pixels.
- Use app-bundled/loadable fonts already in memory; wait for image assets before export.
- Export contains no tappable UI chrome.

### Composition

```text
┌──────────────────────────────────┐
│ TRAVELO                          │
│ ROM · 05 / 2027                  │  ← trip stamp
│                                  │
│ [ destination photo, 16:10 ]     │
│                                  │
│ Mediterranean                    │
│ Escape                           │  ← Fraunces display
│ Rome · 6 days · 4 travellers     │
│                                  │
│  42 km      18 places            │
│  explored   saved                │
│                                  │
│ SPEND                            │
│ 2,140 PLN / person               │
│ plan 2,400 PLN                   │
│                                  │
│ [food] [transport] [stay] ...    │
│ simple category strip/chart      │
│                                  │
│  “Brighter days ahead.”          │
└──────────────────────────────────┘
```

### Visual rules

- Background = `#F8F4EC` Light Sunline paper for the exported social card regardless of app theme, unless a future explicit dark export variant is added. This value must be read from `primitives.neutral[100]`, not hardcoded in component code.
- Primary text = `primitives.ink`.
- Brand accent = `primitives.coral[500]` for small rules, trip stamp or one highlight only.
- Display title = Fraunces 600.
- Statistics = DM Sans tabular numerals.
- Photography occupies exactly `screenMetrics.shareSummary.photoHeightRatio = 0.40` of the export card height.
- Category chart uses all five category tokens plus icon/label legend; color is not sufficient alone.
- Never include private friend codes, exact payment debts, flight booking references or hidden metadata.

### Plan vs reality block

Only show when both values exist. Use neutral language:
- planned amount;
- actual amount;
- difference in amount and percentage.

Do not use “good/bad spender” language.

### Missing data behavior

- Missing photos → use trip cover.
- Missing expense data → remove spend block and let photo/title expand; do not render `0` as if it means measured zero.
- Missing plan → show actual total only.
- Failed export → keep preview visible, show Snackbar with Retry.

### Share action

Primary action below preview = “Share summary”. Secondary = “Save image” if platform capability is supported and permission flow is defined.

**Psychological rationale:** an editorial recap converts operational trip data into a memory worth sharing, increasing emotional attachment without contaminating utility screens with decoration.

---

# 10. Four Screen States

## 10.0 Global state precedence

Render states in this order:

1. If usable cached/local content exists, show it immediately.
2. Overlay/append offline or sync status if connectivity changes what is fresh or actionable.
3. Use loading skeleton only when there is no usable content yet.
4. Use full error state only when the primary content cannot be rendered.
5. Use empty only when the data source loaded successfully and contains no domain items.

Never replace valid cached content with a full-screen spinner just because background refresh is running.

**Psychological rationale:** preserving known content maintains continuity and trust under the unreliable connectivity common during travel.

## 10.1 Loading

### Full screen

```text
Header / hero skeleton
Section skeleton
Card skeleton
Card skeleton
```

Rules:
- Match final geometry.
- No blocking spinner in the center of a content-heavy screen.
- Keep navigation usable unless route resolution itself is unknown.
- After cached content appears, stop showing skeleton for those regions.
- Reduced motion = static skeleton, no shimmer.

### Inline loading

Use spinner only for small, bounded operations: button commit, input lookup, explicit refresh action.

### Timeout

Repository/network timeout policy remains product/data-layer controlled. UI does not invent a new timeout.

**Psychological rationale:** geometry-preserving loading communicates progress without making the app feel like it discarded the user’s trip.

## 10.2 Empty

### Pattern

```text
[96 × 96 line illustration]
Heading
One sentence
[Primary/Secondary action]
```

Examples of structural intent:
- No trips → create trip.
- No expenses → add first expense.
- No day plan → generate/build plan.
- Filter empty → clear filter, not create duplicate content.

Rules:
- Empty state requires a successful fetch/local read.
- It never uses error colors.
- Avoid generic suitcase emoji or confetti.
- The action must resolve the emptiness directly.

**Psychological rationale:** a resolvable empty state turns absence into forward momentum instead of uncertainty.

## 10.3 Error

### Full-screen error

Use only when the user cannot access the screen’s primary value and there is no usable cached fallback.

```text
[CircleAlert / line illustration]
Couldn’t load this trip
Your saved copy isn’t available on this device.
[Retry]
[Go back]  ← only if useful
```

### Inline error

Use when one module fails independently, for example photo upload, place candidate, sync or budget fetch.

Rules:
- Preserve successful sibling content.
- Explain what failed in user terms, not HTTP/database terms.
- Retry is adjacent to the failed scope.
- Error color + icon + text.
- Validation errors attach to the field/control that can fix them.

### Error recovery

A successful retry removes the error region in `motion.duration.standard`; reduced motion uses 80 ms crossfade.

**Psychological rationale:** scoped errors keep one failure from making the whole trip feel broken.

## 10.4 Offline

### Global OfflineBanner

- Minimum height `components.offlineBanner.minHeight = 44`.
- Padding `16 × 10`.
- Use `semantic.info.background` / foreground for read-only cached mode; use warning treatment only when an attempted action is pending/blocked.
- `WifiOff` 20 dp + explicit text.
- Position above floating pill navigation at bottom for regular screens; avoid covering FAB.

### Three offline cases

#### A. Cached content + no blocked action

Show content normally plus compact banner: offline/cached status. Do not dim screen.

#### B. Local-first action

Allow action. After save, show SyncIndicator `pending`. Do not label it as an error merely because there is no connection.

Applies to MVP expense save and budget change according to product rules.

#### C. Server-first action

Disable action and show why in nearby helper copy/banner. Examples currently include creating a trip, changing trip cover/name and deleting server data.

### Reconnect

- Banner disappears only after connectivity is restored; pending sync may remain visible until sync succeeds.
- Do not show a “Back online!” celebration. A short neutral Snackbar is allowed only if it explains that pending changes are syncing.

**Psychological rationale:** offline UI distinguishes “saved locally”, “not available”, and “failed” so the organizer never has to guess whether work was lost.

---

## Phase 3 implementation summary

Phase 3 adds the canonical specifications for:

1. **Section 8 — Components:** exact anatomy, dimensions, variants and interaction states.
2. **Section 9 — Patterns & Key Screens:** Trip Overview, parallel-lane timeline, <5 s expense flow, post-MVP balances guard, shareable trip recap.
3. **Section 10 — Global states:** loading, empty, error and offline precedence and treatment.
4. **`tokens.ts` additions:** component metrics and screen metrics required to implement Sections 8–10 without magic numbers.

Sections 11–14 are completed below. This file is now the canonical complete design specification.

---

# 11. Voice & Microcopy

## 11.1 Voice principles

Travelo speaks like a capable travel companion helping one organizer make decisions quickly. The voice is direct, calm and specific. It never performs enthusiasm for routine actions and never shames the user for money, planning changes or connectivity problems.

| Principle | Do | Don't |
|---|---|---|
| **Lead with the useful fact.** | “120 PLN left today.” | “Great job! You still have some budget remaining!” |
| **Use plain verbs.** | “Add expense”, “Edit plan”, “Try again”. | “Proceed”, “Manage”, “Execute”. |
| **Name the affected thing.** | “Couldn’t upload this photo.” | “Something went wrong.” |
| **Separate uncertainty from fact.** | “~40–60 PLN · estimate”. | “Cost: 50 PLN” when the value is generated or estimated. |
| **Support, never scold.** | “You’re 35 PLN over today’s plan.” | “You overspent by 35 PLN.” |
| **Keep confirmations short.** | “Expense saved.” | “Your expense has been successfully saved.” |
| **Avoid fake personality.** | “Plan ready.” | “Woohoo! Your magical adventure is ready ✨”. |

**Psychological rationale:** factual language lowers cognitive load and preserves the organizer’s sense of control during time-sensitive travel decisions.

## 11.2 Grammar and localization rules

1. Polish copy uses informal second person where a direct instruction is necessary, but prefers neutral labels when possible: `Zapisz`, `Dodaj wydatek`, `Spróbuj ponownie`.
2. English copy uses sentence case: `Add expense`, never `Add Expense` except proper names.
3. Button labels contain **1–3 words** whenever possible.
4. Do not end button labels, tabs, chips or field labels with punctuation.
5. Full explanatory sentences end with punctuation.
6. Currency values always include ISO-compatible localized currency display: `120 PLN`, `€42.50`, `$18.00`; formatting comes from the money formatter, never hand-built strings.
7. Estimated money always begins with `~` and a range when a range exists: `~40–60 PLN`.
8. Times use the trip/place locale conventions selected by the formatter; never concatenate `"09" + ":" + "30"` manually.
9. AI-generated text is never labeled simply `Suggested`; the label must explicitly contain `AI` / `AI` in both languages.
10. Ellipsis `…` is reserved for in-progress labels: `Zapisywanie…`, `Generating…`; never use three periods `...`.

**Psychological rationale:** predictable grammar and formatting make repeated trip-management actions faster to scan across two languages.

## 11.3 Canonical i18n strings

All UI strings must be represented by i18n keys. The strings below are canonical defaults; product copy changes require changing both locales in the same pull request.

### 11.3.1 Empty states

| i18n key | Polish (`pl`) | English (`en`) | Use |
|---|---|---|---|
| `empty.trips.title` | `Nie masz jeszcze podróży` | `No trips yet` | Trip list with zero trips |
| `empty.trips.body` | `Utwórz pierwszą podróż, żeby zebrać loty, plan i budżet w jednym miejscu.` | `Create your first trip to keep flights, plans and budget in one place.` | Trip list body |
| `empty.trips.action` | `Utwórz podróż` | `Create trip` | Primary CTA |
| `empty.expenses.title` | `Brak wydatków` | `No expenses yet` | Expenses screen |
| `empty.expenses.body` | `Dodaj pierwszy wydatek. Zapis zajmuje tylko kilka sekund.` | `Add the first expense. It only takes a few seconds.` | Expenses empty body |
| `empty.expenses.action` | `Dodaj wydatek` | `Add expense` | CTA |
| `empty.plan.title` | `Ten dzień nie ma jeszcze planu` | `No plan for this day yet` | Day plan empty state |
| `empty.plan.body` | `Możesz ułożyć dzień samodzielnie albo poprosić AI o propozycję z prawdziwych miejsc.` | `Build the day yourself or ask AI for a draft using real places.` | Plan empty body |
| `empty.plan.actionAI` | `Ułóż plan z AI` | `Plan with AI` | AI CTA |
| `empty.photos.title` | `Nie ma jeszcze zdjęć` | `No photos yet` | Photo strip/viewer empty state |
| `empty.photos.body` | `Dodane zdjęcia pojawią się tutaj i będą dostępne na tej podróży.` | `Photos you add will appear here for this trip.` | Photos body |
| `empty.search.title` | `Nic nie znaleźliśmy` | `No matches found` | Search with no result |
| `empty.search.body` | `Spróbuj krótszej nazwy albo innej pisowni.` | `Try a shorter name or different spelling.` | Search recovery |

**Psychological rationale:** every empty state explains what is missing and offers exactly one concrete way forward.

### 11.3.2 Network and sync errors

| i18n key | Polish (`pl`) | English (`en`) | Use |
|---|---|---|---|
| `network.offline.banner` | `Jesteś offline. Pokazujemy zapisane dane.` | `You’re offline. Showing saved data.` | Cached read mode |
| `network.offline.required` | `Ta czynność wymaga internetu.` | `This action needs an internet connection.` | Server-first action |
| `network.retry` | `Spróbuj ponownie` | `Try again` | Generic retry action |
| `network.loadTrip.title` | `Nie udało się wczytać podróży` | `Couldn’t load this trip` | Full-screen trip error |
| `network.loadTrip.body` | `Nie ma zapisanej kopii tej podróży na tym urządzeniu.` | `There isn’t a saved copy of this trip on this device.` | Offline/unreachable no-cache case |
| `sync.pending` | `Czeka na wysłanie` | `Waiting to sync` | Local change pending |
| `sync.failed` | `Nie udało się wysłać` | `Couldn’t sync` | Refused/failed outbox item |
| `sync.retry` | `Wyślij ponownie` | `Retry sync` | Sync retry action |
| `sync.syncing` | `Synchronizowanie…` | `Syncing…` | Reconnect/pending activity |
| `photo.upload.failed` | `Nie udało się wysłać tego zdjęcia.` | `Couldn’t upload this photo.` | Scoped photo failure |
| `photo.delete.offline` | `Usuwanie zdjęć wymaga internetu.` | `Deleting photos requires an internet connection.` | Offline delete |

**Psychological rationale:** network copy distinguishes local success, pending sync and true failure so users never have to infer whether data was lost.

### 11.3.3 Validation errors

| i18n key | Polish (`pl`) | English (`en`) | Use |
|---|---|---|---|
| `validation.required` | `Uzupełnij to pole.` | `Complete this field.` | Generic required field |
| `validation.amount.required` | `Wpisz kwotę.` | `Enter an amount.` | Empty amount |
| `validation.amount.invalid` | `Wpisz prawidłową kwotę.` | `Enter a valid amount.` | Invalid money |
| `validation.amount.positive` | `Kwota musi być większa od 0.` | `Amount must be greater than 0.` | Non-positive expense |
| `validation.tripName.required` | `Wpisz nazwę podróży.` | `Enter a trip name.` | Trip name |
| `validation.tripName.max` | `Nazwa może mieć maksymalnie 60 znaków.` | `Trip name can be up to 60 characters.` | Trip name limit |
| `validation.friendName.required` | `Wpisz imię.` | `Enter a name.` | Friend name |
| `validation.username.format` | `Użyj 3–20 znaków: a–z, 0–9, _ lub . Zacznij od litery.` | `Use 3–20 characters: a–z, 0–9, _ or . Start with a letter.` | Profile username |
| `validation.username.taken` | `Ten nick jest zajęty.` | `That username is taken.` | Username uniqueness |
| `validation.interest.required` | `Wybierz co najmniej jedno zainteresowanie.` | `Choose at least one interest.` | Profile interests |
| `validation.code.invalid` | `Kod jest nieprawidłowy. Sprawdź cyfry i spróbuj ponownie.` | `That code is incorrect. Check the digits and try again.` | Auth OTP |

**Psychological rationale:** validation messages say exactly what the user can change instead of describing an abstract invalid state.

### 11.3.4 Budget status and warnings

The wording changes by state, but tone remains descriptive rather than moral.

| i18n key | Polish (`pl`) | English (`en`) | Visual state |
|---|---|---|---|
| `budget.today.left` | `Zostało dziś {{amount}}` | `{{amount}} left today` | `budget.under` |
| `budget.today.near` | `Zostało dziś {{amount}}` | `{{amount}} left today` | `budget.near` |
| `budget.today.atLimit` | `Dzisiejszy plan budżetu jest wykorzystany` | `Today’s planned budget is used` | `budget.near` |
| `budget.today.over` | `Dziś {{amount}} ponad plan` | `{{amount}} over today’s plan` | `budget.over` |
| `budget.trip.left` | `Zostało {{amount}} na podróż` | `{{amount}} left for the trip` | Trip-level under budget |
| `budget.estimate.note` | `Budżet dzienny jest wyliczany z pozostałych dni.` | `Daily budget is calculated from the remaining days.` | Helper text |
| `budget.over.support` | `Możesz zostawić plan bez zmian albo ograniczyć kolejne wydatki.` | `You can keep the plan as it is or reduce later spending.` | Optional explanatory copy |

Never use `success` copy such as `Świetnie oszczędzasz!`, and never use blame copy such as `Przekroczyłeś budżet!`.

**Psychological rationale:** supportive budget wording keeps users recording reality instead of avoiding the app after going over plan.

### 11.3.5 AI labels and uncertainty

| i18n key | Polish (`pl`) | English (`en`) | Use |
|---|---|---|---|
| `ai.label` | `Wygenerowane przez AI` | `Generated by AI` | Full AI provenance label |
| `ai.badge` | `AI` | `AI` | Compact badge; must have accessible expanded label |
| `ai.plan.action` | `Ułóż plan z AI` | `Plan with AI` | Generate CTA |
| `ai.plan.regenerate` | `Ułóż ponownie` | `Generate again` | Regeneration action |
| `ai.plan.edit` | `Edytuj` | `Edit` | Edit suggestion |
| `ai.plan.lock` | `Zablokuj` | `Lock` | Lock activity |
| `ai.plan.unlock` | `Odblokuj` | `Unlock` | Unlock activity |
| `ai.plan.locked` | `AI nie zmieni tej aktywności` | `AI won’t change this activity` | Locked helper/status |
| `ai.cost.estimate` | `~{{min}}–{{max}} · szacunek` | `~{{min}}–{{max}} · estimate` | Estimated cost range |
| `ai.time.estimate` | `~{{duration}} · szacunek` | `~{{duration}} · estimate` | Estimated duration |
| `ai.disclaimer` | `Sprawdź godziny otwarcia, ceny i dojazd przed wyjściem.` | `Check opening hours, prices and travel details before you go.` | Plan footer |
| `ai.changed.label` | `Edytowane przez Ciebie` | `Edited by you` | User-modified AI item |

**Psychological rationale:** explicit provenance and uncertainty prevent generated content from borrowing the visual authority of confirmed trip facts.

### 11.3.6 Generating state

Only show a pipeline message when that stage is genuinely known by the client/backend. Never fake model progress or percentages.

| i18n key | Polish (`pl`) | English (`en`) | Actual stage |
|---|---|---|---|
| `ai.generating.default` | `Układam plan dnia…` | `Building your day plan…` | Backend exposes no stage |
| `ai.generating.places` | `Sprawdzam miejsca…` | `Checking places…` | Real candidate lookup |
| `ai.generating.routes` | `Sprawdzam czasy dojazdu…` | `Checking travel times…` | Real route lookup |
| `ai.generating.plan` | `Układam kolejność dnia…` | `Arranging the day…` | Model/order stage |
| `ai.generating.validate` | `Sprawdzam gotowy plan…` | `Checking the plan…` | Zod/candidate validation stage |

Forbidden copy:
- `73% gotowe`
- `Jeszcze 8 sekund`
- `AI analizuje miliony możliwości`

unless the value is measured and actually available from the system.

**Psychological rationale:** honest progress maintains trust; fake precision makes a temporary wait feel deceptive when timing changes.

### 11.3.7 AI failure and recovery

| i18n key | Polish (`pl`) | English (`en`) |
|---|---|---|
| `ai.error.title` | `Nie udało się ułożyć planu` | `Couldn’t build the plan` |
| `ai.error.body` | `Twoje ustawienia i zablokowane aktywności zostały zachowane.` | `Your settings and locked activities are still here.` |
| `ai.error.retry` | `Spróbuj ponownie` | `Try again` |
| `ai.error.manual` | `Ułóż ręcznie` | `Build manually` |
| `ai.error.noPlaces` | `Nie znaleźliśmy wystarczającej liczby pasujących miejsc. Zmień zainteresowania albo zakres dnia.` | `We couldn’t find enough matching places. Change the interests or the day range.` |
| `ai.error.offline` | `Generowanie planu wymaga internetu.` | `Generating a plan requires an internet connection.` |

**Psychological rationale:** recovery copy explicitly confirms preserved work before asking the user to try again.

### 11.3.8 Action confirmations

| i18n key | Polish (`pl`) | English (`en`) | Presentation |
|---|---|---|---|
| `confirm.expenseSaved` | `Wydatek zapisany` | `Expense saved` | Snackbar |
| `confirm.expenseSavedPending` | `Wydatek zapisany. Czeka na wysłanie.` | `Expense saved. Waiting to sync.` | Offline Snackbar |
| `confirm.planReady` | `Plan gotowy` | `Plan ready` | Snackbar + visible plan |
| `confirm.activityLocked` | `Aktywność zablokowana` | `Activity locked` | Snackbar only when needed; lock icon persists |
| `confirm.activityUnlocked` | `Aktywność odblokowana` | `Activity unlocked` | Snackbar |
| `confirm.tripCreated` | `Podróż utworzona` | `Trip created` | Snackbar |
| `confirm.tripDeleted` | `Podróż usunięta` | `Trip deleted` | Snackbar |
| `confirm.budgetSaved` | `Budżet zapisany` | `Budget saved` | Snackbar or inline sync state |
| `confirm.photoAdded` | `Zdjęcie dodane` | `Photo added` | Use only when upload completed and visual insertion is insufficient |

**Psychological rationale:** confirmations are brief because persistent visual state should carry most of the proof that an action succeeded.

## 11.4 Destructive copy pattern

Destructive dialogs must name both the object and consequence.

**Delete trip**

| | Polish | English |
|---|---|---|
| Title | `Usunąć podróż „{{tripName}}”?` | `Delete “{{tripName}}”?` |
| Body | `Usuniesz plan, członków, loty i zdjęcia tej podróży. Tej czynności nie można cofnąć.` | `This removes the trip’s plan, members, flights and photos. This can’t be undone.` |
| Cancel | `Anuluj` | `Cancel` |
| Destructive | `Usuń podróż` | `Delete trip` |

The destructive button uses the destructive component variant, never `brand.primary`.

**Psychological rationale:** naming the object and irreversible consequence prevents accidental confirmation caused by generic yes/no dialogs.

---

# 12. AI-Specific UX

## 12.1 Core contract: AI proposes, structured data verifies

The visible AI layer follows the product architecture:

```text
Real place candidates
        ↓
Travel-time candidates
        ↓
AI selects / orders IDs
        ↓
Schema validation
        ↓
Candidate-set validation
        ↓
USER SEES DRAFT
```

AI-generated content is a **draft**, never a source of record by itself. Any generated `placeId` outside the supplied candidate set must be rejected before render. Cost is a `CostEstimate` range, never an invented exact amount.

**Psychological rationale:** generated suggestions can feel fluent enough to seem factual; validation and explicit draft status keep authority proportional to evidence.

## 12.2 AI provenance treatment

### Full provenance row

Use on generated day drafts and regenerated sections:

```text
[Sparkles 16] Generated by AI
               Check details before you go
```

Tokens:
- icon: `iconography.size.xs = 16`
- icon stroke: `iconography.strokeWidth = 1.75`
- primary line: `typography.styles.labelSM`
- helper: `typography.styles.caption`
- foreground: `text.secondary`
- container: no decorative gradient; use normal surface hierarchy
- minimum touch target when interactive: `layout.touchTarget = 44`

### Compact AI badge

Use only inside an Activity Card or summary header when space is constrained:

```text
[✦ AI]
```

Implementation:
- visible text: `AI`
- icon: `Sparkles`, 16 dp
- accessible label: localized `Generated by AI`
- background: `brand.tint`
- foreground: `brand.text`
- radius: `radii.pill`
- must not be the only indication if the whole screen is an editable AI draft; include full provenance row once near the section header.

Do not use purple/blue AI gradients, glowing borders, animated sparkles or a robot mascot.

**Psychological rationale:** a consistent low-drama provenance marker informs without turning AI into a visual product category that overwhelms travel content.

## 12.3 Cost uncertainty

AI/place-derived costs use only these formats:

```text
~40–60 PLN · estimate
~€12–18 / person · estimate
Free · verify on site
Price unavailable
```

Rules:
1. Never collapse a known range to its midpoint.
2. Never remove the `~` prefix from estimated paid costs.
3. Never style an estimate like a confirmed expense.
4. `perPerson: true` must show `/ person` / `/ os.` in the localized UI.
5. If currencies differ, do not silently convert unless an FX rate is available through the product’s money service; converted estimates remain approximate.
6. Confirmed recorded expenses use `money*` typography and do **not** show `estimate`.

**Psychological rationale:** a range communicates planning usefulness without creating false precision that users may anchor their budget to.

## 12.4 Time uncertainty

Estimated travel or activity durations use:

```text
~25 min · estimate
~1 h 30 min · estimate
```

Confirmed transport schedule uses exact wall-clock times:

```text
09:40 → 11:05
```

Never show an exact generated arrival time unless it comes from a real route/schedule result appropriate for that context.

**Psychological rationale:** visually separating estimates from confirmed times prevents itinerary confidence from exceeding the quality of the underlying data.

## 12.5 Generating state — no generic spinner

### Default layout

Replace the plan body with a **route-build skeleton** rather than a blocking centered spinner:

```text
Day 3 · Lisbon

[Sparkles] Building your day plan…
            You can leave this screen

09:00   ○ ───────── [skeleton activity]
        │
11:30   ○ ───────── [skeleton activity]
        │
14:00   ○ ───────── [skeleton activity]

[Cancel generation]  ← only when cancellation is supported
```

Visual rules:
- skeleton colors: `skeleton.base` + `skeleton.highlight`
- route rail dimensions: `components.timeline.*`
- message: `headingSM` + `bodySM`
- no indefinite rotating AI icon
- no fake percentage
- no blocking modal when the user can safely leave the screen

### Motion

Normal motion:
- skeleton shimmer may use a linear translation lasting `motion.duration.slow = 360` per pass only if the existing Skeleton component already supports it; continuous shimmer must pause when app is backgrounded.
- pipeline message crossfade: `motion.duration.standard = 180`.
- do not animate every timeline node independently while generating.

Reduced motion:
- no shimmer translation.
- skeleton is static.
- pipeline copy updates with `motion.duration.reduced = 80` opacity crossfade or instantly.

### Navigation behavior

Generation must survive screen navigation if the backend job/request architecture supports it. Returning to the day shows the same generating state. Do not require the user to stare at the screen.

**Psychological rationale:** an in-context skeleton shows what is being prepared while preserving freedom to continue using the app.

## 12.6 Real pipeline state mapping

Use the detailed generating strings only if the system actually exposes the relevant stage.

| Real stage | UI | Allowed |
|---|---|---:|
| Candidate lookup | `ai.generating.places` | Yes |
| Routes lookup | `ai.generating.routes` | Yes |
| AI arrangement | `ai.generating.plan` | Yes |
| Schema/candidate validation | `ai.generating.validate` | Yes |
| Unknown monolithic request | `ai.generating.default` | Yes |
| Estimated percentage invented on client | `73%` | **Never** |
| Estimated seconds invented on client | `8 s left` | **Never** |

**Psychological rationale:** status messages are useful only when they reflect real system state rather than decorative storytelling.

## 12.7 Generated Activity Card states

An AI-generated Activity Card extends the standard Activity Card with exactly one provenance state and one edit state.

### Draft

```text
[AI]  10:30–12:00
Belém Tower
~15–20 EUR · estimate
[Edit]                        [Lock]
```

### User edited

```text
[Edited by you]
10:45–12:00
Belém Tower
~15–20 EUR · estimate
[Edit]                        [Lock]
```

Once the user materially edits title/place/time/cost selection, replace the compact AI badge with `Edited by you`. AI provenance may remain available in detail metadata/history, but the visible card must not imply that the current values are untouched AI output.

### Locked

- icon: `Lock`, 16 or 20 dp according to density
- visible helper when space allows: `AI won’t change this activity`
- card remains fully readable and editable manually
- future `Generate again` / `Rebuild today` must preserve it
- user can unlock through explicit `Unlock`

### Lock microinteraction

Normal motion uses `motion.microinteraction.activityLocked`.
Reduced motion switches immediately between `LockOpen` and `Lock` with at most `motion.duration.reduced` opacity change.

**Psychological rationale:** lock state turns AI regeneration from a destructive gamble into a reversible, user-controlled edit loop.

## 12.8 Editing an AI suggestion

Tapping `Edit` opens the same component/form used for a manually created activity. Never create a second “AI editor” UI.

Rules:
1. Prefill current values.
2. Preserve `placeId` while editing non-place fields.
3. If the place itself changes, use the real place picker and store the selected real candidate ID.
4. Saving marks the visible card `Edited by you`.
5. Cancel returns to the unchanged draft.
6. No confirmation dialog for cancel unless the editor contains unsaved changes.

**Psychological rationale:** one editing model lowers learning cost and prevents AI content from feeling like a separate, less controllable object type.

## 12.9 Regeneration

Before regeneration, the screen makes preservation rules visible:

```text
Generate the day again?
Locked activities stay where they are. Other AI suggestions may change.

[Cancel] [Generate again]
```

Do **not** show this confirmation when no existing user edits/locks would be replaced. In that case `Generate again` may start immediately.

Regeneration input includes:
- existing locked activity IDs,
- day time bounds,
- member/group assignment,
- relevant interests/preferences,
- budget constraints if the feature uses them,
- existing manual activities that product rules say must survive.

**Psychological rationale:** users tolerate generative variability when the boundary between preserved and replaceable work is explicit before the action.

## 12.10 Group split generated by AI

When AI proposes parallel lanes:

1. The split header includes the standard AI provenance treatment.
2. Each lane names its members with Avatar Group + readable names in detail.
3. The split is never communicated by color alone; each lane has a text label such as `Group A`, member names or activity title.
4. `groupSplitRevealed` motion may reveal lanes only after the validated plan exists.
5. The organizer can edit member assignment before accepting/locking the split.

**Psychological rationale:** explicit membership prevents a visually clever split timeline from creating the real-world failure of someone not knowing where they belong.

## 12.11 Failed generation

### Inline failure is preferred

If the rest of the day/screen still works, replace only the generation region:

```text
[CircleAlert]
Couldn’t build the plan
Your settings and locked activities are still here.

[Try again]   [Build manually]
```

Rules:
- Preserve all locked/manual content.
- Preserve generation settings and filters.
- Do not wipe the previous accepted plan until a replacement succeeds.
- If regeneration fails, keep the current plan visible and show a scoped Snackbar or inline banner.
- Validation rejection is presented as generation failure, never render partially untrusted model output.
- Offline generation uses `ai.error.offline`; do not queue an AI request silently unless the architecture explicitly adds that behavior later.

**Psychological rationale:** failure feels recoverable when existing work remains visible and the retry does not threaten it.

## 12.12 AI acceptance model

Generated day content can exist in two product states:

```text
DRAFT → ACCEPTED
```

If the implementation does not need explicit persistence states, the visual model still applies:
- while newly generated, the plan has the full provenance row and clear edit/lock controls;
- normal navigation away does not imply rejection;
- user edits/locks are persisted as normal product data;
- no celebratory “Accept AI” button is required unless backend semantics specifically require acceptance.

**Psychological rationale:** avoiding unnecessary acceptance ceremony keeps the plan editable and treats AI as a tool, not an event the user must endorse.

---

# 13. Accessibility (a11y)

## 13.1 Accessibility baseline

The release baseline is:

- WCAG 2.2 AA minimum for relevant visual contrast and interaction principles.
- Body text targets AAA contrast where Phase 2 token pairs already support it.
- Minimum interactive target: `layout.touchTarget = 44` dp in both dimensions.
- Screen reader support: VoiceOver on iOS and TalkBack on Android.
- Dynamic Type / system font scaling enabled.
- Reduced Motion respected.
- Meaning never conveyed by color alone.
- Core flows must remain usable in portrait at large text sizes without requiring precise gestures.

**Psychological rationale:** accessibility is treated as a property of the interaction model, not a final visual QA pass.

## 13.2 React Native text scaling rules

### Default

Every user-facing `Text` and `TextInput`:

```tsx
allowFontScaling={true}
```

Do not use `adjustsFontSizeToFit` for body copy, values, labels or buttons because shrinking text defeats the user’s chosen text size.

### Maximum multipliers

| Content | `maxFontSizeMultiplier` | Rule |
|---|---:|---|
| Body, descriptions, errors, helper text | `0` | No maximum; layout must reflow |
| Screen titles / section headings | `0` | No maximum; wrap naturally |
| Money values in content cards | `2.0` | May wrap/recompose; currency must remain visible |
| Primary / secondary button labels | `2.0` | Button height becomes min-height, never fixed clipping |
| Chips | `1.8` | Chip can grow vertically and wrap label |
| Floating pill tab labels | `1.6` | Icon remains; label must not truncate ordinary PL/EN strings at this cap |
| Dense timeline time labels | `1.8` | Time column may widen when accessibility layout activates |
| OTP digits | `2.0` | Each cell maintains touch/focus target |

`0` means no maximum multiplier in React Native.

At `fontScale >= 1.5` use **accessibility layout mode**:
- cards prefer vertical metadata stacks over side-by-side rows;
- button groups stack vertically if two labels no longer fit;
- timeline cards use full remaining width and allow the time column to widen;
- Quick Expense category chips become horizontally scrollable or wrap according to the existing component contract; never shrink text;
- avoid fixed text container heights.

**Psychological rationale:** scaling the layout with the type preserves reading comfort without turning larger text into clipped or hidden information.

## 13.3 Screen reader label pattern

Every interactive component must have one accessible name. Visible text is preferred as the source; provide `accessibilityLabel` when icon-only controls or composite widgets would otherwise be ambiguous.

### Pattern

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={t("a11y.tripMenu", { tripName })}
  accessibilityHint={t("a11y.tripMenu.hint")}
/>
```

Use `accessibilityHint` only when the result is not obvious from the label.

### Canonical accessibility strings

| i18n key | Polish | English |
|---|---|---|
| `a11y.tripMenu` | `Menu podróży {{tripName}}` | `Trip menu for {{tripName}}` |
| `a11y.tripMenu.hint` | `Otwiera opcje nazwy, zdjęcia, budżetu i usunięcia podróży.` | `Opens options for the trip name, cover, budget and deletion.` |
| `a11y.openDrawer` | `Otwórz listę podróży` | `Open trip list` |
| `a11y.addExpense` | `Dodaj wydatek` | `Add expense` |
| `a11y.budgetMeter` | `Budżet na dziś: {{status}}, {{amount}}.` | `Today’s budget: {{status}}, {{amount}}.` |
| `a11y.syncStatus` | `Status synchronizacji: {{status}}` | `Sync status: {{status}}` |
| `a11y.aiGenerated` | `Wygenerowane przez AI` | `Generated by AI` |
| `a11y.lockActivity` | `Zablokuj aktywność {{activityName}}` | `Lock activity {{activityName}}` |
| `a11y.unlockActivity` | `Odblokuj aktywność {{activityName}}` | `Unlock activity {{activityName}}` |
| `a11y.avatar` | `{{name}}` | `{{name}}` |
| `a11y.avatarGroup` | `Uczestnicy: {{names}}` | `Travelers: {{names}}` |
| `a11y.flightSegment` | `Lot z {{from}} do {{to}}, odlot {{departure}}, przylot {{arrival}}` | `Flight from {{from}} to {{to}}, departs {{departure}}, arrives {{arrival}}` |
| `a11y.photo` | `Zdjęcie {{index}} z {{count}}` | `Photo {{index}} of {{count}}` |
| `a11y.removePhoto` | `Usuń zdjęcie {{index}}` | `Delete photo {{index}}` |

Do not include decorative icon names such as “sparkles icon” or “wallet icon” in labels.

**Psychological rationale:** labels describe intent and result rather than implementation details, producing shorter and more predictable screen-reader navigation.

## 13.4 Accessibility roles

Use React Native roles consistently:

| UI object | `accessibilityRole` |
|---|---|
| Primary / secondary / ghost / destructive button | `button` |
| IconButton / FAB | `button` |
| Text navigation link | `link` only if semantically navigation; otherwise `button` |
| Search input | `search` where supported by the component; otherwise standard text input with label |
| Screen / section heading | `header` on the heading `Text` where appropriate |
| Image with meaningful content | `image` |
| Decorative image | excluded from accessibility tree |
| Budget slider/adjuster if introduced | `adjustable` |
| Tabs | use the platform-supported tab semantics in the navigation implementation; selected state must be exposed |

For toggleable controls expose state:

```tsx
accessibilityState={{ selected, disabled, checked, busy }}
```

Use only keys that match the component semantics.

**Psychological rationale:** correct roles let assistive technology reuse interaction models users already know from the rest of the OS.

## 13.5 Focus order

Focus order follows the visual reading order unless a modal/sheet temporarily owns focus.

### Standard screen

```text
1. Screen title / current trip context
2. Top-level navigation controls
3. Primary summary content
4. Section controls
5. Section content top → bottom
6. Primary bottom action / FAB
7. Floating tab navigation
```

### Bottom Sheet / Dialog

When opened:
1. Move accessibility focus to the sheet/dialog heading when technically supported by the current RN stack.
2. Keep screen-reader navigation inside the modal content while it is modal.
3. First actionable control follows the heading/body.
4. Destructive action comes after cancel/secondary action in reading order unless platform conventions require another order.
5. On close, restore logical focus to the element that opened it when possible.

Do not use positive custom focus indices to force an order that disagrees with the React tree. Structure the tree correctly instead.

**Psychological rationale:** predictable order lets users form a spatial model of the screen even when they are not using vision to scan it.

## 13.6 Live announcements

Use live announcements sparingly for state changes that are not otherwise obvious to a screen-reader user.

Announce:
- expense successfully saved when the sheet closes;
- offline save is pending sync;
- AI generation completed if the user is still on the screen;
- validation summary after submitting a form with multiple errors;
- sync failure affecting a locally saved change.

Do not repeatedly announce:
- every skeleton stage change;
- every budget meter animation frame;
- continuous upload percentage unless the user explicitly focuses the progress UI;
- decorative motion.

When a visible status changes, prefer a semantic live region/status implementation available in the current RN version over manually firing duplicate announcements. If manual announcement is needed, ensure one event produces one spoken message.

**Psychological rationale:** high-signal announcements keep assistive feedback useful instead of turning routine state updates into interruption noise.

## 13.7 Touch targets and hitSlop

Rules:
- interactive layout box target is at least `44 × 44` dp;
- IconButton already uses `components.iconButton.size = 44`;
- chip visible height may be `components.chip.visualHeight = 36`, but its interactive wrapper must be `components.chip.touchHeight = 44`;
- tiny timeline nodes, sync dots and category markers are **not** standalone touch targets;
- if an icon visually occupies less than 44 dp, enlarge the Pressable wrapper before using `hitSlop`;
- `hitSlop` may improve edge forgiveness but cannot create overlapping ambiguous targets;
- adjacent primary controls should retain at least `spacing.2 = 8` dp visual gap where layout permits.

**Psychological rationale:** forgiving targets reduce accidental actions while walking, holding luggage or using one hand.

## 13.8 Contrast and outdoor readability

Phase 2 contrast tables remain canonical. Phase 4 adds these usage constraints:

1. Never place normal text directly on photography without `hero.scrim` or a tested opaque surface.
2. Hero text uses `hero.text` over the defined 82% ink scrim.
3. Active Trip Mode prioritizes `text.primary`, `text.inverse`, strong surface separation and 15 dp+ body text.
4. Do not use `text.tertiary` for required instructions, error recovery or monetary values.
5. Disabled controls still need readable labels, but disabled state is additionally conveyed by disabled semantics and absence of action.
6. Focus indicators use `border.focus` at the defined focus width; do not remove native accessibility focus behavior.

**Psychological rationale:** travel frequently happens in glare and motion, so high-importance information receives stronger contrast than decorative hierarchy alone would require.

## 13.9 Color-blind safety

Every semantic color is paired with at least one non-color cue.

| Meaning | Color token | Required secondary cue |
|---|---|---|
| Under budget | `budget.under` | label/value + meter state |
| Near limit | `budget.near` | label/value + `AlertTriangle` when warning is emphasized |
| Over budget | `budget.over` | label/value + `CircleAlert` when emphasized |
| Sync pending | `sync.pending` | `Clock3` + text |
| Sync failed | `sync.failed` | `CircleAlert` + text/action |
| Success | `semantic.success` | `Check` / confirmation text |
| Error | `semantic.error` | `CircleAlert` + error copy |
| Food | expense category color | `Utensils` |
| Transport | expense category color | `BusFront` or product-selected transport icon |
| Stay | expense category color | `BedDouble` |
| Activities | expense category color | `Ticket` |
| Other | expense category color | `Shapes` |
| Timeline split lanes | lane marker/accent | member names + Avatar Group + lane label |

Charts must include category labels in legend/detail and may use marker shape/icon in addition to color. Never ask the user to “tap the green section”.

**Psychological rationale:** redundant encoding makes state recognition resilient to color-vision differences, sunlight and low-quality displays.

## 13.10 Reduced motion

Read system preference using the React Native accessibility API and/or the project’s Reanimated accessibility support. The app must respond when the preference changes while running.

### Normal → reduced mapping

| Interaction | Normal | Reduced motion |
|---|---|---|
| Screen/sheet transition | configured standard native/reanimated transition | shortest non-spatial transition allowed by navigation stack; opacity <= `motion.duration.reduced` where customizable |
| Button press | scale to `0.98` | no scale; immediate/80 ms opacity/state change |
| Expense saved | press scale + check fade + Snackbar entrance | no scale; check appears; Snackbar opacity <= 80 ms |
| Plan generated | cards enter with stagger | all cards appear together with <= 80 ms fade or instantly |
| Activity locked | lock scale `0.92 → 1` | icon/state swap; <= 80 ms opacity |
| Group split revealed | lanes offset by 16 dp | lanes render in final position; <= 80 ms fade |
| Skeleton | shimmer allowed | static skeleton |
| Share card preview | no auto-parallax | static |

Never disable functional progress indication; replace motion with static state changes.

**Psychological rationale:** reduced motion removes spatial/continuous movement without removing the feedback users need to understand what changed.

## 13.11 Images and illustrations

### Meaningful photos

Trip photos and covers need a useful accessibility label only when the image itself carries information not already stated next to it.

Examples:
- cover already accompanied by `Lisbon · 12–18 Aug`: image may be decorative for screen reader if no meaningful caption exists;
- photo viewer: label `Photo 3 of 12`; if user-authored alt descriptions do not exist, do not invent scene descriptions.

### Empty-state illustrations

Empty-state illustrations are decorative. Exclude them from the accessibility tree because the adjacent title/body carries the meaning.

**Psychological rationale:** avoiding redundant or invented image descriptions keeps screen-reader output concise and trustworthy.

## 13.12 Forms and errors

Every field has a persistent accessible name independent of placeholder text.

Rules:
1. Placeholder is an example, never the only label.
2. Error text is visually adjacent and connected to the field’s accessible description/state using the current RN-supported props.
3. Invalid state is exposed programmatically in addition to border/icon treatment.
4. Form submission moves visual attention to the first error and announces a concise validation summary when needed.
5. Do not clear user-entered values after failed validation or network save.
6. Amount Input announces formatted value with currency, not only raw minor units.
7. The six-digit code flow must expose six logical positions or one correctly labeled OTP field according to the implementation, never six unlabeled text boxes.

**Psychological rationale:** persistent labels and preserved input reduce the cost of correcting mistakes, especially when navigating sequentially with assistive technology.

## 13.13 Timeline accessibility

The parallel-lane timeline must not require understanding its 2D layout.

### Visual

```text
09:00 Shared · Breakfast · Everyone
11:00 Split
      Lane A · Kacper, Ola · Museum
      Lane B · Michał, Ania · Beach
14:00 Shared · Lunch · Everyone
```

### Accessibility reading model

Expose the same information linearly:

```text
09:00. Together. Breakfast. Everyone.
11:00. Group splits.
Group A: Kacper, Ola. Museum.
Group B: Michał, Ania. Beach.
14:00. Together. Lunch. Everyone.
```

Do not expose decorative rails/nodes as accessibility elements.

**Psychological rationale:** linear semantics preserve the plan’s social meaning even when parallel visual geometry is unavailable.

## 13.14 Budget meter accessibility

The Daily Budget Meter is one accessible group/value, not a collection of individually focusable decorative pieces.

Example label:

```text
Today’s budget. 120 PLN left. 280 PLN spent of 400 PLN planned. Under budget.
```

Polish:

```text
Budżet na dziś. Zostało 120 PLN. Wydano 280 PLN z planowanych 400 PLN. W planie.
```

If the meter is read-only, do not give it `adjustable` role. The visual fill is decorative relative to the spoken value.

**Psychological rationale:** one complete spoken summary is faster to understand than forcing users through meter fragments.

## 13.15 Accessibility QA release checklist

A feature is not complete until all relevant checks pass:

- [ ] VoiceOver: all controls have useful names and correct roles.
- [ ] TalkBack: same primary flow completes without inaccessible gestures.
- [ ] Focus order follows visual/task order.
- [ ] No important status relies on color alone.
- [ ] All actionable targets are >= 44 dp.
- [ ] Text scaling at 1.0, 1.5 and 2.0 is tested on key flows.
- [ ] Body text with no cap does not become clipped by fixed-height containers.
- [ ] Reduced Motion produces no spatial/stagger animation specified as removable above.
- [ ] Light and Dark modes preserve contrast.
- [ ] Active Trip screens remain readable over photos and in high-glare conditions.
- [ ] Bottom Sheets and Dialogs expose modal semantics and logical focus.
- [ ] Error state is announced and recovery action is reachable.
- [ ] Offline/local-save state is readable without color.
- [ ] AI provenance and cost/time uncertainty are read by screen readers.
- [ ] Parallel timeline is understandable in linear reading order.

**Psychological rationale:** testing concrete user tasks catches accessibility failures that cannot be detected by token inspection alone.

---

# 14. Rules for the Implementing Coding Agent

## 14.1 Authority order

When implementing Travelo UI, use this priority order:

```text
1. Current application code for facts about what already exists
2. Current product/domain source of truth (schemas / architecture / product rules)
3. DESIGN.md for visual and interaction behavior
4. tokens.ts for all design values
5. User decision when the sources above do not answer the question
```

If a lower source conflicts with a higher source, do not silently reconcile it. Flag the conflict and ask the user when a product decision is required.

**Psychological rationale:** a fixed authority order prevents an agent from “improving” one document by accidentally contradicting real product behavior.

## 14.2 Non-negotiable token rule

**Zero hardcoded design values in components.**

Forbidden:

```tsx
backgroundColor: "#E96F51"
paddingHorizontal: 20
borderRadius: 16
fontSize: 15
height: 52
animationDuration: 180
```

Required:

```tsx
backgroundColor: theme.brand.primary,
paddingHorizontal: tokens.components.button.horizontalPadding,
borderRadius: tokens.components.button.radius,
...tokens.typography.styles.bodyMD,
minHeight: tokens.components.button.height,
```

Scope covered by this rule:
- hex / rgb / rgba values;
- spacing;
- margins/padding/gaps;
- radii;
- control sizes;
- typography size/line-height/weight/family/letter spacing;
- border widths when specified by system tokens;
- icon sizes/stroke width;
- elevation/shadows;
- animation durations/easing/offset/scale values;
- screen metrics and export dimensions.

A `0` required by React Native mechanics may be written directly only when it represents the mathematical absence of a value rather than a design choice. Otherwise use the appropriate token.

**Psychological rationale:** centralized values make the product visually coherent and prevent tiny local deviations from accumulating into an inconsistent interface.

## 14.3 Semantic colors only in feature UI

Feature components consume semantic theme colors:

```tsx
theme.text.primary
theme.surface.primary
theme.brand.primary
theme.semantic.error.foreground
theme.budget.near.meter
```

Do not consume `primitives.coral[500]` directly in normal feature code. Primitive colors are reserved for:
- theme construction;
- category/chart token construction;
- documented exceptional brand integrations.

Never derive a new UI color at runtime using opacity or color math unless DESIGN.md explicitly specifies that pattern and the result is tokenized.

**Psychological rationale:** semantic names preserve intended meaning when Light/Dark values differ.

## 14.4 Theme consumption

Every reusable component receives theme values through the project’s theme provider/hook rather than importing `colors.light` directly.

Correct conceptual pattern:

```tsx
const theme = useTheme();

return <View style={{ backgroundColor: theme.surface.primary }} />;
```

Dark mode components must not branch on arbitrary local colors:

```tsx
// forbidden
isDark ? "#292724" : "#FFFFFF"
```

Screens that are drawn dark in both themes (welcome, photo viewer) wrap their content in `DarkThemeScope`, which supplies the same dark theme object; never create route-specific dark hex values.

**Psychological rationale:** one theme path keeps visual behavior predictable and avoids a second undocumented design system inside always-dark screens.

## 14.5 NativeWind compatibility

NativeWind is an implementation surface, not a second token source.

Map tokens into `tailwind.config.js` / NativeWind theme names from `tokens.ts` where the build setup supports it.

Example naming convention:

```text
bg-surface-primary
text-text-primary
border-border-subtle
bg-brand-primary
rounded-card
```

Rules:
1. Tailwind config values must reference/copy canonical token exports through the project’s supported configuration mechanism.
2. Do not invent a Tailwind-only color or spacing step.
3. Arbitrary values such as `mt-[18px]`, `bg-[#E96F51]`, `rounded-[15px]` are forbidden in production feature UI.
4. Platform-specific native behavior that is clearer in `StyleSheet` may use `StyleSheet`; it still consumes the same tokens.
5. Do not force NativeWind onto APIs that require object values, such as shadowOffset or Reanimated shared styles, when `StyleSheet`/JS objects are clearer.

**Psychological rationale:** allowing both styling surfaces without allowing two sources of truth keeps implementation practical for a solo developer.

## 14.6 StyleSheet compatibility

`StyleSheet.create` is allowed and preferred for stable native style objects.

```tsx
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.layout.screenGutter,
    gap: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
  },
});
```

Theme-dependent colors may be composed from a themed style factory/hook, but all values still come from `theme` or `tokens`.

Do not duplicate complete light/dark StyleSheets when a semantic theme object solves the same problem.

**Psychological rationale:** stable style objects improve maintainability without sacrificing theme consistency.

## 14.7 Typography implementation

Only font family names present in `typography.family` and complete styles present in `typography.styles` may be used.

Rules:
- no system font fallback as intentional visual styling after fonts load;
- do not synthesize bold/italic variants that are not part of the loaded set;
- money and timers use the tokenized `fontVariant: ["tabular-nums"]` styles;
- `allowFontScaling` remains enabled;
- implement the Section 13 multipliers and accessibility layout behavior;
- no local `fontWeight` override on a token style unless a new canonical type style is added.

**Psychological rationale:** stable typography hierarchy makes dense logistical and financial information faster to scan.

## 14.8 Icon rule

Use only `lucide-react-native` for product UI unless DESIGN.md explicitly documents a brand-logo exception.

Canonical:

```tsx
<Plus
  size={tokens.iconography.size.md}
  strokeWidth={tokens.iconography.strokeWidth}
  color={theme.icon.primary}
/>
```

Rules:
- do not mix Lucide with Ionicons/Material icons for convenience;
- Google/Discord sign-in logos are brand exceptions and use official assets/colors per product rules;
- emoji are not product icons;
- decorative icons are hidden from the accessibility tree;
- icon-only actions require localized `accessibilityLabel`.

**Psychological rationale:** a single icon grammar makes action recognition consistent across planning, travel and finance contexts.

## 14.9 Every text string comes from i18n

Forbidden:

```tsx
<Text>Dodaj wydatek</Text>
showSnackbar("Expense saved")
```

Required:

```tsx
<Text>{t("expense.add.action")}</Text>
showSnackbar(t("confirm.expenseSaved"))
```

This includes:
- labels;
- errors;
- accessibility labels/hints;
- snackbars;
- AI status text;
- empty states;
- modal copy;
- helper text;
- dynamically formatted strings.

Exceptions:
- user-entered content;
- third-party proper names;
- IATA/ISO codes;
- server-provided place names;
- data values formatted by locale-aware formatters.

When adding a key, add both `pl` and `en` in the same change. English remains fallback.

**Psychological rationale:** complete localization prevents mixed-language error and accessibility states, which feel especially broken during stressful travel tasks.

## 14.10 Money implementation

Money is never represented as a floating-point UI/domain shortcut.

Rules:
1. Domain amount = integer minor units + ISO 4217 currency.
2. Formatting uses the canonical money formatter.
3. Parsing Amount Input converts the localized entry into minor units at the form boundary.
4. Do not calculate money with JS floating-point decimal arithmetic.
5. Every displayed monetary amount includes currency/context.
6. AI cost range remains a `CostEstimate` range.
7. Converted values require an explicit FX source and remain distinguishable from original values where product logic requires it.

Forbidden:

```ts
const total = 12.99 + 8.5;
```

Required conceptual model:

```ts
const totalMinor = 1299 + 850;
```

**Psychological rationale:** exact minor-unit arithmetic protects financial trust by preventing rounding drift that users can notice immediately.

## 14.11 Component state completeness

Every reusable component introduced in Section 8 must implement all relevant states **before** it is considered complete.

Minimum matrix:

| Component | Required states |
|---|---|
| Button | default, pressed, focused/accessibility focus, disabled, loading; destructive variant where applicable |
| IconButton / FAB | default, pressed, focused, disabled; loading only if action can wait visibly |
| Text Input | default, focused, filled, disabled, error |
| Amount Input | default, focused, filled, disabled, error, formatted |
| Chip | default, pressed, selected, disabled, focus |
| Card action | default, pressed, focus, disabled where actionable |
| Bottom Sheet | closed, opening, open, closing; keyboard-aware state where forms exist |
| Snackbar | entering, visible, exiting; action/no-action |
| Skeleton | light/dark + reduced motion |
| SyncIndicator | synced, pending, failed |
| AI Activity | draft, user-edited, locked, generation/replacement-safe |

Do not ship a default state and defer disabled/error/loading to future feature work when the component contract already requires them.

**Psychological rationale:** edge states are the moments when user confidence is most vulnerable, so visual completeness matters more there than in the happy path.

## 14.12 Screen state completeness

Every new screen must explicitly handle the Section 10 precedence model:

```text
loading
empty
error
offline
content
```

The implementation must answer:
- Is there cached content?
- Can this action work locally?
- Is the failure scoped or full-screen?
- Does offline replace content or decorate cached content?
- What is the retry path?

Do not display a full-screen error when usable cached content exists.

**Psychological rationale:** predictable state handling prevents intermittent travel connectivity from making screens feel randomly unavailable.

## 14.13 Loading and skeleton rule

Skeleton geometry matches final content geometry. Do not create generic grey rectangles unrelated to the destination layout.

Rules:
- no full-screen spinner for content-heavy screens when the layout can be skeletonized;
- button loading preserves button width/height and label semantics;
- do not clear already loaded content for background refresh;
- reduced motion uses static skeletons;
- AI generating uses Section 12 route-build state, not the normal generic loading skeleton.

**Psychological rationale:** stable geometry reduces perceived wait and prevents layout jumps from stealing attention.

## 14.14 Motion rule

All timing/easing values come from `motion`.

Forbidden:

```ts
withTiming(value, { duration: 250 })
```

Required:

```ts
withTiming(value, {
  duration: tokens.motion.duration.emphasis,
  easing: /* mapped canonical easing */,
});
```

The coding agent must implement a single reduced-motion utility/hook used by all animated components. Do not let each feature invent its own reduced-motion behavior.

**Psychological rationale:** consistent timing makes the interface feel responsive while a centralized motion preference keeps accessibility behavior reliable.

## 14.15 Offline and sync rule

Respect the product’s offline boundary. Do not extend offline write capability because it is technically convenient.

Current MVP:
- expenses: local-first when implemented;
- trip budget change: local-first;
- cached reading: supported for previously opened data as documented;
- create trip / rename / cover / delete / photo add-delete / sign-in / profile creation: server-first as currently specified.

A server-first button while offline:
- becomes disabled when appropriate;
- provides nearby explanation `network.offline.required`;
- does not pretend to queue the operation.

A local-first save while offline:
- completes immediately locally;
- shows `pending` sync status;
- never says `failed` merely because the network is absent.

**Psychological rationale:** honest offline boundaries prevent users from believing an irreversible server action has been saved when it has not.

## 14.16 AI implementation rule

The coding agent must not:
- invent places;
- render unvalidated model output;
- create exact generated prices from estimates;
- invent progress percentages/times;
- remove AI provenance;
- regenerate locked items;
- discard the current accepted plan before a replacement succeeds;
- call Gemini directly from the mobile client;
- ship provider/API secrets in the app.

The coding agent must:
- use real candidate IDs;
- parse AI output through the canonical schema;
- reject candidate IDs outside the supplied set;
- show range uncertainty;
- preserve lock/edit semantics;
- use the backend/Edge Function architecture defined by product rules;
- rate-limit/cache according to backend implementation decisions.

**Psychological rationale:** AI is trustworthy when its freedom is constrained exactly where fluent output could otherwise masquerade as real travel data.

## 14.17 Accessibility implementation rule

Every PR that adds or changes an interactive component must include:
- role;
- accessible name;
- state when applicable;
- >= 44 dp target;
- large-text behavior;
- reduced-motion behavior if animated;
- non-color cue for semantic state;
- test/check on both iOS and Android when platform behavior differs.

Do not postpone accessibility props as cleanup.

**Psychological rationale:** adding semantics with the component is cheaper and more accurate than reconstructing intent after the UI architecture has hardened.

## 14.18 How to add a new token

A new token is allowed only when an existing token cannot express a reusable design decision.

Procedure:

```text
1. Search tokens.ts for an existing semantic/value match.
2. Check DESIGN.md for a documented component rule.
3. If an existing token works, reuse it.
4. If not, identify whether the value is reusable or one-off.
5. If it is a new design decision not covered by the system → ASK THE USER.
6. After approval, add the token to the correct semantic group.
7. Add/update DESIGN.md documentation in the same change.
8. Add both Light/Dark values when the token is theme-dependent.
9. Verify contrast when the token affects text, icons, borders or status meaning.
10. Replace all local copies with the new token.
```

Do not create tokens named after a single screen position such as:

```ts
lisbonCardPadding: 18
```

Prefer semantic reusable ownership:

```ts
components.activityCard.padding
```

if such a distinct value is truly approved and necessary.

**Psychological rationale:** requiring a reason for every new value keeps the token system useful instead of turning it into a graveyard of magic numbers with names.

## 14.19 What to do when the design system has no answer

**Never invent. Ask the user.**

The coding agent must stop and ask when implementation requires a visual/product decision not answered by:
- existing code/product rules;
- `DESIGN.md`;
- `tokens.ts`;
- established component composition.

Use this exact question structure:

```text
DESIGN DECISION NEEDED

Context: <where this appears>
Missing rule: <what the design system does not define>
Why it matters: <behavior/visual/product consequence>
Recommended decision: <one concrete recommendation>
Affected files: <likely files>
```

Do not provide three equally weighted visual options unless the user explicitly asks for options. Give one recommendation.

**Psychological rationale:** a visible decision boundary prevents autonomous “reasonable guesses” from slowly changing the product’s identity.

## 14.20 New component decision tree

Before creating a component:

```text
Does a shared component already cover the anatomy?
 ├─ YES → compose/configure it
 └─ NO
    ↓
Is the pattern repeated or expected to repeat?
 ├─ YES → create shared component using existing tokens
 └─ NO
    ↓
Can existing primitives compose it without a new design decision?
 ├─ YES → compose locally
 └─ NO → ask user before inventing component/token behavior
```

Do not create `SpecialButton`, `PrettyCard`, `AIGradientCard` or screen-specific clones of existing primitives.

**Psychological rationale:** composition preserves familiarity; unnecessary component variants force users to relearn identical actions with different appearances.

## 14.21 Layout rule

Use:
- screen gutters from `layout`;
- vertical rhythm from `spacing`;
- component dimensions from `components`;
- screen-specific dimensions only from `screenMetrics`.

Do not use absolute positioning for normal document flow. Absolute positioning is allowed for:
- overlays explicitly specified by DESIGN.md;
- hero controls;
- floating navigation/FAB placement;
- controlled timeline visual rails;
- export composition where dimensions are canonical.

Respect safe-area insets. Safe-area values come from runtime, not tokens.

**Psychological rationale:** flow-based layout survives different phones, font scales and translations better than pixel-positioned compositions.

## 14.22 One-hand rule

Primary actions for routine trip use live in the lower thumb zone whenever the screen structure allows it.

Do not relocate destructive or rare settings actions into the thumb zone merely for reachability. They belong in menus/sheets where accidental activation is less likely.

Quick Add Expense must preserve the Phase 3 completion target and ordering:

```text
Amount → category → optional details → Save
```

Do not insert required memo, payer confirmation or extra navigation into the default fast path unless product scope changes.

**Psychological rationale:** high-frequency actions optimize for reach and speed; high-risk actions optimize for deliberation.

## 14.23 POST-MVP guard — balances / settlements

The Group Split & Balances specification in Section 9 is a **future design pattern only**.

The coding agent must not implement:
- who owes whom calculations;
- debt simplification;
- settlement records;
- payment/settle actions;
- balances navigation;

as part of the current MVP unless the user explicitly changes product scope.

It is allowed to keep the design specification and reusable visual primitives ready for future work.

**Psychological rationale:** explicit scope guards stop a visually documented future feature from silently becoming engineering scope.

## 14.24 Testing obligations

At minimum, changed UI must cover:

### Unit/component
- variant/state rendering;
- disabled behavior;
- formatting logic where applicable;
- i18n key usage;
- accessibility role/name/state where test tooling supports it.

### Integration/flow
- success path;
- validation path;
- server/network error;
- offline behavior according to scope;
- loading/empty/error/content transition;
- Light + Dark (welcome and photo viewer: dark in both);
- PL + EN strings;
- large text;
- reduced motion for animated behavior.

### Financial
- minor-unit calculations;
- currency digits;
- category totals;
- no float drift.

### AI
- invalid schema rejected;
- unknown place ID rejected;
- locked item preserved across regeneration;
- failed regeneration preserves existing plan;
- estimates render as ranges.

**Psychological rationale:** state-based tests protect the moments that most strongly determine whether users trust travel and money data.

## 14.25 Definition of Done for UI work

A UI task is done only when all applicable items are true:

- [ ] Uses existing shared component where appropriate.
- [ ] Uses only canonical tokens; no hardcoded design values.
- [ ] Works in required Light/Dark modes.
- [ ] All user-visible text uses i18n keys in PL + EN.
- [ ] Implements all relevant component states.
- [ ] Implements loading/empty/error/offline screen states where relevant.
- [ ] Touch targets are >= 44 dp.
- [ ] Screen reader labels/roles/states are correct.
- [ ] Dynamic Type does not clip required information.
- [ ] Reduced Motion fallback exists for animation.
- [ ] Semantic state is not color-only.
- [ ] Money uses minor units and tabular number styling.
- [ ] AI content follows provenance, validation, uncertainty and lock rules.
- [ ] Offline behavior matches documented product scope.
- [ ] No POST-MVP feature has been implemented accidentally.
- [ ] Tests cover changed high-risk states.
- [ ] `DESIGN.md` and `tokens.ts` remain synchronized if the system changed.

**Psychological rationale:** a shared finish line prevents “looks right on my phone” from becoming the quality standard for a travel app used under unpredictable conditions.

## 14.26 Absolute prohibitions

The coding agent must **never** introduce any of the following without a new explicit user decision:

```text
NO hardcoded hex colors
NO arbitrary spacing/radius/type values
NO default purple-blue AI gradient
NO glassmorphism/backdrop-filter imitation
NO emoji used as product icons
NO second icon library for convenience
NO unlocalized user-visible text
NO color-only status
NO tap target under 44 dp
NO disabled font scaling globally
NO fake AI percentage/time remaining
NO exact AI-estimated price presented as fact
NO unvalidated AI place
NO client-side secret/API key
NO float arithmetic for money
NO silent offline queuing of server-first actions
NO balances/settlement implementation in MVP
NO new design choice invented because “it looks better”
```

When uncertain: **ask the user; do not invent.**

**Psychological rationale:** explicit prohibitions protect the recognizable Sunline Editorial identity and the trust-critical behaviors that ordinary code review can miss.

---

# Final implementation contract

Travelo’s UI is complete when the implementation can be traced through this chain without undocumented decisions:

```text
PRODUCT RULE
    ↓
DESIGN.md pattern
    ↓
tokens.ts value
    ↓
shared React Native component
    ↓
feature composition
    ↓
PL / EN i18n
    ↓
loading · empty · error · offline · content
    ↓
a11y + reduced motion
```

If any link in that chain is missing, the coding agent must not invent the missing design/product decision.

**Sunline Editorial visual DNA:** warm ivory × ink × sun coral × Mediterranean blue × travel photography × Fraunces editorial moments × DM Sans utility UI.

**Final psychological rationale:** Travelo should feel emotional when users remember the trip, decisive when they organize it, and trustworthy when money, connectivity or AI becomes uncertain.
