import { renderHook } from '@testing-library/react-native';

import { darkTheme, lightTheme } from '../theme';
import { useTheme } from '../useTheme';

let mockScheme: 'light' | 'dark' | null = null;

// useColorScheme reads Appearance through an internal import, so it is mocked at its module path.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme,
}));

const mockColorScheme = (scheme: 'light' | 'dark' | null) => {
  mockScheme = scheme;
};

describe('lightTheme', () => {
  it('maps color roles to design-context §3.1', () => {
    expect(lightTheme.colors.background).toBe('#F7F3EA');
    expect(lightTheme.colors.surface.default).toBe('#FFFFFF');
    expect(lightTheme.colors.surface.secondary).toBe('#EEE8DD');
    expect(lightTheme.colors.surface.elevated).toBe('#FFFFFF');
    expect(lightTheme.colors.text.primary).toBe('#17211B');
    expect(lightTheme.colors.text.secondary).toBe('#665D51');
    expect(lightTheme.colors.text.tertiary).toBe('#877C6D');
    expect(lightTheme.colors.border).toBe('#DDD5C7');
    expect(lightTheme.colors.divider).toBe('#EEE8DD');
    expect(lightTheme.colors.action.primary).toBe('#D85C3A');
    expect(lightTheme.colors.action.primaryPressed).toBe('#BD472A');
    expect(lightTheme.colors.action.onPrimary).toBe('#FFFFFF');
  });

  it('has the segmented control radius (§10.14)', () => {
    expect(lightTheme.radius.segmented).toBe(10);
  });

  it('has a link role for ghost buttons (D28: §10.1 brand.600)', () => {
    expect(lightTheme.colors.action.link).toBe('#BD472A');
  });

  it('has an input border role (D26: §10.4 neutral.300)', () => {
    expect(lightTheme.colors.input.border).toBe('#C5BBAA');
  });

  it('gives cards elevation level 1 (§6.1)', () => {
    expect(lightTheme.elevation.card).toEqual({
      shadowColor: '#17211B',
      shadowOpacity: 0.08,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    });
  });

  it('uses light semantic, budget and category colors', () => {
    expect(lightTheme.colors.status.error).toBe('#B13B32');
    expect(lightTheme.colors.budget.over).toBe('#B45F42');
    expect(lightTheme.colors.category.food).toBe('#D85C3A');
  });
});

describe('darkTheme', () => {
  it('maps color roles to design-context §3.2', () => {
    expect(darkTheme.colors.background).toBe('#111712');
    expect(darkTheme.colors.surface.default).toBe('#17211B');
    expect(darkTheme.colors.surface.secondary).toBe('#202A23');
    expect(darkTheme.colors.surface.elevated).toBe('#263229');
    expect(darkTheme.colors.text.primary).toBe('#F7F3EA');
    expect(darkTheme.colors.text.secondary).toBe('#C9C2B6');
    expect(darkTheme.colors.text.tertiary).toBe('#9E978B');
    expect(darkTheme.colors.border).toBe('#39443B');
    expect(darkTheme.colors.divider).toBe('#2A342D');
    expect(darkTheme.colors.action.primary).toBe('#F08A6C');
    expect(darkTheme.colors.action.primaryPressed).toBe('#F59A82');
    expect(darkTheme.colors.action.onPrimary).toBe('#17211B');
  });

  it('has a dark link role for ghost buttons (D28)', () => {
    expect(darkTheme.colors.action.link).toBe('#F08A6C');
  });

  it('has a dark input border role (D26)', () => {
    expect(darkTheme.colors.input.border).toBe('#4A564C');
  });

  it('uses surface contrast instead of shadows for cards in dark mode (§6.1)', () => {
    expect(darkTheme.elevation.card).toEqual({});
  });

  it('uses dark semantic, budget and category colors', () => {
    expect(darkTheme.colors.status.error).toBe('#F28B82');
    expect(darkTheme.colors.budget.over).toBe('#E89A7A');
    expect(darkTheme.colors.category.food).toBe('#F08A6C');
  });
});

describe('hero roles (trip-flight-tabs-name-cover D4, D7)', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('are the same ink background and light text in %s mode', (_, theme) => {
    expect(theme.colors.hero).toEqual({ background: '#17211B', text: '#F7F3EA', textSecondary: '#C9C2B6' });
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('define the hero fade as a gradient token in %s mode (§20 rule 20)', (_, theme) => {
    expect(theme.gradient.heroFade).toEqual({ start: 0.35 });
  });
});

describe('primary action states (D9)', () => {
  it('uses the border and tertiary text roles for a disabled primary action', () => {
    expect(lightTheme.colors.action.disabled).toBe('#DDD5C7');
    expect(lightTheme.colors.action.onDisabled).toBe('#877C6D');
    expect(darkTheme.colors.action.disabled).toBe('#39443B');
    expect(darkTheme.colors.action.onDisabled).toBe('#9E978B');
  });
});

describe('shared tokens', () => {
  it('keeps every spacing token on the 4dp grid', () => {
    for (const value of Object.values(lightTheme.spacing)) {
      expect(value % 4).toBe(0);
    }
  });

  it('uses tabular figures for every money style', () => {
    for (const style of [
      lightTheme.typography.numericXL,
      lightTheme.typography.numericL,
      lightTheme.typography.numericM,
    ]) {
      expect(style.fontVariant).toEqual(['tabular-nums']);
    }
  });

  it('meets the 44dp minimum touch target', () => {
    expect(lightTheme.size.touchTarget).toBeGreaterThanOrEqual(44);
    expect(lightTheme.size.buttonPrimary).toBe(52);
  });

  it('defines the compact breakpoint from design-context §18', () => {
    expect(lightTheme.breakpoints.compact).toBe(360);
  });

  it('defines a 2dp focus ring (D10)', () => {
    expect(lightTheme.size.focusRing).toBe(2);
  });

  it('shares non-color tokens between light and dark', () => {
    expect(darkTheme.spacing).toBe(lightTheme.spacing);
    expect(darkTheme.radius).toBe(lightTheme.radius);
    expect(darkTheme.typography).toBe(lightTheme.typography);
    expect(darkTheme.size).toBe(lightTheme.size);
  });
});

describe('useTheme', () => {
  it('returns the dark theme for the dark color scheme', async () => {
    mockColorScheme('dark');
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(darkTheme);
  });

  it('returns the light theme for the light color scheme', async () => {
    mockColorScheme('light');
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(lightTheme);
  });

  it('falls back to the light theme when the scheme is unknown', async () => {
    mockColorScheme(null);
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(lightTheme);
  });
});
