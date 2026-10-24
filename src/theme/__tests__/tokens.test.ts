import { readFileSync } from 'fs';
import { join } from 'path';

import { partnerBrand as legacyPartnerBrand } from '../legacy/tokens';
import { colors, partnerBrand, tokens, typography } from '../tokens';

type Tree = { [key: string]: string | Tree };

const keyPaths = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keyPaths(value, `${prefix}${key}.`),
  );

const lookup = (tree: Tree, path: string): string =>
  path.split('.').reduce<string | Tree>((node, key) => (node as Tree)[key], tree) as string;

const channel = (hex: string, start: number) => {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('colors', () => {
  it('light and dark have identical key paths', () => {
    expect(keyPaths(colors.dark as unknown as Tree)).toEqual(keyPaths(colors.light as unknown as Tree));
  });

  it('matches design-context §2.3 (light) and §2.4 (dark) spot values', () => {
    expect(colors.light.background.canvas).toBe('#F8F4EC');
    expect(colors.light.surface.primary).toBe('#FFFCF7');
    expect(colors.light.text.primary).toBe('#242321');
    expect(colors.light.brand.primary).toBe('#E96F51');
    expect(colors.light.brand.text).toBe('#913222');
    expect(colors.light.border.focus).toBe('#B54A33');
    expect(colors.dark.background.canvas).toBe('#171716');
    expect(colors.dark.surface.primary).toBe('#201F1D');
    expect(colors.dark.text.primary).toBe('#F5F1E8');
    expect(colors.dark.brand.primary).toBe('#F07D5E');
    expect(colors.dark.brand.text).toBe('#FF967A');
    expect(colors.dark.border.focus).toBe('#FF967A');
  });
});

// design-context §2.9: [foreground path, background path, minimum ratio], AA = 4.5, AAA = 7 (the table's WCAG column).
const AA = 4.5;
const AAA = 7;
const rows = (mode: 'light' | 'dark'): [string, string, number][] => [
  ['text.primary', 'background.canvas', AAA],
  ['text.primary', 'surface.primary', AAA],
  ['text.primary', 'surface.elevated', AAA],
  ['text.secondary', 'background.canvas', AAA],
  ['text.secondary', 'surface.primary', AAA],
  ['text.secondary', 'surface.elevated', AAA],
  ['text.tertiary', 'background.canvas', mode === 'light' ? AA : AAA],
  ['text.tertiary', 'surface.primary', AA],
  ['text.tertiary', 'surface.elevated', AA],
  ['brand.text', 'background.canvas', AAA],
  ['brand.text', 'surface.primary', AAA],
  ['text.inverse', 'surface.inverse', AAA],
  ['brand.onBrand', 'brand.primary', AA],
  ['brand.onBrand', 'brand.pressed', AA],
  ['disabled.foreground', 'disabled.background', AA],
  ['semantic.success.foreground', 'semantic.success.background', AAA],
  ['semantic.warning.foreground', 'semantic.warning.background', AAA],
  ['semantic.error.foreground', 'semantic.error.background', AAA],
  ['semantic.info.foreground', 'semantic.info.background', AAA],
];

describe.each(['light', 'dark'] as const)('§2.9 text contrast, %s', (mode) => {
  it.each(rows(mode))('%s on %s is at least %d:1', (fg, bg, min) => {
    const tree = colors[mode] as unknown as Tree;
    expect(contrast(lookup(tree, fg), lookup(tree, bg))).toBeGreaterThanOrEqual(min);
  });
});

describe('typography', () => {
  const layout = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');

  it('every font family in the scale is loaded by the root layout', () => {
    const families = new Set([
      ...Object.values(typography.family),
      ...Object.values(typography.styles).map((style) => style.fontFamily),
    ]);
    expect(families.size).toBeGreaterThan(0);
    for (const family of families) {
      expect(layout).toContain(family);
    }
  });
});

describe('spacing', () => {
  it('has exactly the §4.1 steps', () => {
    expect(tokens.spacing).toEqual({
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      8: 32,
      10: 40,
      12: 48,
      16: 64,
      20: 80,
      24: 96,
    });
  });
});

describe('project additions', () => {
  it('partnerBrand is exported, in tokens, and equals the legacy one', () => {
    expect(partnerBrand).toEqual(legacyPartnerBrand);
    expect(tokens.partnerBrand).toBe(partnerBrand);
  });

  it('has the app-specific sizes', () => {
    expect(tokens.layout.compactBreakpoint).toBe(390);
    expect(tokens.components.drawer).toEqual({ maxWidth: 360, thumbnailSize: 48 });
    expect(tokens.components.coverPicker).toEqual({ tileWidth: 112 });
    expect(tokens.components.avatar.xxl).toBe(96);
    expect(tokens.components.emptyState).toEqual({ illustrationSize: 96 }); // sunline-redesign D22
    expect(tokens.screenMetrics.tripOverview.heroFadeStart).toBe(0.35);
    expect(tokens.motion.microinteraction.welcomeRevealed).toEqual({ itemDuration: 500 });
    expect(tokens.motion.microinteraction.skeletonPulse).toEqual({ duration: 1200, minOpacity: 0.5 });
  });

  it('has the shared control tokens (sunline-redesign D10)', () => {
    expect(tokens.components.button.borderWidth).toBe(1);
    expect(tokens.components.focusRing).toEqual({ width: 2, offset: 2 });
    expect(tokens.motion.press).toEqual({ scale: 0.98 });
  });
});
