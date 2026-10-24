import { renderHook } from '@testing-library/react-native';

import { darkTheme, lightTheme } from '../theme';
import { colors, elevation } from '../tokens';
import { DarkThemeScope, useTheme } from '../useTheme';

let mockScheme: 'light' | 'dark' | null = null;

// useColorScheme reads Appearance through an internal import, so it is mocked at its module path.
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
