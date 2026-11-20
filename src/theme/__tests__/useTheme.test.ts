import { renderHook } from '@testing-library/react-native';

import { darkTheme, lightTheme } from '../theme';
import { colors, elevation } from '../tokens';
import { setThemePreference } from '../themePreference';
import { DarkThemeScope, useTheme } from '../useTheme';
import { DarkThemeScope as LegacyScope, useTheme as useLegacyTheme } from '../legacy/useTheme';
import { darkTheme as legacyDark, lightTheme as legacyLight } from '../legacy/theme';

let mockScheme: 'light' | 'dark' | null = null;

// useColorScheme reads Appearance through an internal import, so it is mocked at its module path.
jest.mock('@/data/preferences', () => ({ readThemePreference: jest.fn(() => 'system') }));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme,
}));

describe('themes', () => {
  it('spread the semantic colors and elevation of their mode (D3)', () => {
    expect(lightTheme.surface.primary).toBe(colors.light.surface.primary);
    expect(lightTheme.semantic.error.foreground).toBe(colors.light.semantic.error.foreground);
    expect(lightTheme.elevation).toEqual(elevation.light);
    expect(darkTheme.brand.primary).toBe(colors.dark.brand.primary);
    expect(darkTheme.elevation.level1).toEqual(elevation.dark.level1);
  });
});

describe('useTheme', () => {
  it('returns the light theme on a light device', async () => {
    mockScheme = 'light';
    expect((await renderHook(() => useTheme())).result.current).toBe(lightTheme);
  });

  it('returns the dark theme on a dark device', async () => {
    mockScheme = 'dark';
    expect((await renderHook(() => useTheme())).result.current).toBe(darkTheme);
  });

  it('falls back to light when there is no scheme', async () => {
    mockScheme = null;
    expect((await renderHook(() => useTheme())).result.current).toBe(lightTheme);
  });

  it('DarkThemeScope forces dark on a light device', async () => {
    mockScheme = 'light';
    const { result } = await renderHook(() => useTheme(), { wrapper: DarkThemeScope });
    expect(result.current).toBe(darkTheme);
  });
});

describe('explicit theme preference wins over the reported scheme', () => {
  beforeEach(() => setThemePreference('system'));

  it.each([
    ['dark', 'light', darkTheme, legacyDark],
    ['light', 'dark', lightTheme, legacyLight],
    ['system', 'dark', darkTheme, legacyDark],
    ['system', 'light', lightTheme, legacyLight],
  ] as const)('preference %s with scheme %s', async (pref, scheme, expected, legacyExpected) => {
    mockScheme = scheme;
    setThemePreference(pref);
    expect((await renderHook(() => useTheme())).result.current).toBe(expected);
    expect((await renderHook(() => useLegacyTheme())).result.current).toBe(legacyExpected);
  });

  it('DarkThemeScope still forces dark on a light preference', async () => {
    mockScheme = 'light';
    setThemePreference('light');
    expect((await renderHook(() => useTheme(), { wrapper: DarkThemeScope })).result.current).toBe(darkTheme);
    expect((await renderHook(() => useLegacyTheme(), { wrapper: LegacyScope })).result.current).toBe(legacyDark);
  });
});
