# Travelo — Logo Guidelines

Last updated: 2026-10-22 · direction B "t-podróżnik", approved by Kacper.

## 1. The logo
- **Idea:** a lowercase **t** whose crossbar is the horizon and whose dot is the sun. Together they also read as a traveller with open arms: one organizer welcoming the group.
- **Versions:** horizontal (primary) · stacked · symbol only · wordmark only.
- **Wordmark:** "travelo" set in Fraunces SemiBold, converted to outlines. Do not retype it.

| File | Use |
|---|---|
| `lockups/travelo-horizontal.svg` | Default: headers, website, documents |
| `lockups/travelo-horizontal-reversed.svg` | On dark backgrounds (dark mode, `neutral.900`, ink) |
| `lockups/travelo-stacked.svg` | Square spaces: splash, posters, merch |
| `lockups/travelo-wordmark.svg` | When the symbol is already on screen |
| `symbol/travelo-symbol.svg` | Symbol from 24 px up |
| `master/travelo-symbol-small.svg` | Symbol at 16–24 px (heavier strokes, wider gap) |
| `master/travelo-symbol-reversed.svg` | Symbol on dark, ~5 % thinner to counter irradiation |
| `*-black / *-white / *-mono-242321` | One-colour versions (stamps, embossing, partner listings) |

## 2. Clear space
Keep a clear zone of **1 × the sun's diameter** around the logo on all sides. The zone scales with the logo.

## 3. Minimum size
| Version | Screen | Print |
|---|---|---|
| Horizontal | 96 px wide | 25 mm wide |
| Stacked | 64 px wide | 18 mm wide |
| Symbol | 24 px (16–24 px: use the small cut) | 6 mm |

## 4. Colour
All values are Sunline tokens from `src/theme/tokens.ts`; the logo adds no new colours.

| Name | Token | HEX | RGB | CMYK (approx.) |
|---|---|---|---|---|
| Ink (t, wordmark) | `ink` | #242321 | 36 35 33 | 0 3 8 86 |
| Coral (sun) | `brand.primary` (light) | #E96F51 | 233 111 81 | 0 52 65 9 |
| Paper (light ground) | `neutral.100` | #F8F4EC | 248 244 236 | 0 2 5 3 |
| Coral, dark mode | `brand.primary` (dark) | #F07D5E | 240 125 94 | 0 48 61 6 |
| Dark ground | `neutral.900` | #171716 | 23 23 22 | 0 0 4 91 |

CMYK values are simple conversions. For print, ask the printer to match a Pantone to the HEX before a run.

**Approved logo / background pairs:**
- full colour on white or paper;
- reversed (paper + dark coral) on `neutral.900` or ink;
- one-colour white on coral or on a calm area of a photo;
- one-colour ink or black on white.

Never put the full-colour logo on coral (the sun disappears) or on dark grounds (the ink t disappears).

## 5. App icons
| File | Use |
|---|---|
| `expo/icon.png` | 1024 px, paper ground, full bleed (the OS rounds the corners) |
| `expo/icon-dark.png` | Dark variant for the iOS dark icon |
| `expo/android-icon-foreground.png`, `-background.png`, `-monochrome.png` | Android adaptive icon (mark inside the 66 % safe zone); adaptive `backgroundColor` = #F8F4EC |
| `expo/splash-icon.png` | Splash image; splash `backgroundColor` = #F8F4EC |
| `expo/favicon.png` | 48 px web favicon, from the small cut |
| `expo/travelo.icon/` | iOS 26 Icon Composer bundle (two layers: body and sun). **Not checked in Icon Composer yet.** |
| `symbol/favicon.ico`, `favicon.svg`, `icon-*.png`, `site.webmanifest`, `head-snippet.html` | Full web/PWA icon set |

## 6. Typography
- Wordmark and display: **Fraunces** (SemiBold in the wordmark). Body text: **DM Sans**.
- Both are under the SIL Open Font License, which allows logo use.

## 7. Don'ts
- Don't stretch, squash or rotate the logo.
- Don't recolour it outside the palette above, and don't make the t coral.
- Don't add shadows, outlines, gradients or effects.
- Don't change the size or spacing between the symbol and the wordmark.
- Don't retype "travelo" in a font. Use the files.
- Don't place the logo on busy photos without a calm area or a container.

## 8. Test results (2026-10-22)
- 16 px: the t and the sun stay separate with the small cut. The regular cut fills in at 16 px.
- One-colour, greyscale and squint (blur) tests: pass.
- Mirrored, it reads as a "j" with a dot. Rotated 180°, nothing unwanted shows up.
- Coral on paper is 2.8 : 1, just under the 3 : 1 guideline for graphics. Recognition is carried by the ink t (≈ 15 : 1), so the sun is an accent, not the only cue.
- Not done: trademark search, Icon Composer check, device check of the icons.

## 9. Sources
- `source/build_logo.py` builds every master from parameters and outlines the wordmark from Fraunces.
- `source/build_icons.py` builds the Expo icon sources.
- PNGs are rendered with the `logo-design` skill's `render_png.py`.
- Presentation: `presentation/travelo-board.html` (slides in `presentation/slides/`). Test sheet: `presentation/test-sheet.html`.
