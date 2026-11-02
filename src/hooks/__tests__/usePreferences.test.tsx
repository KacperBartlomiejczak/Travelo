import { act, renderHook } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import { writeLanguagePreference, writeThemePreference } from '@/data/preferences';
import i18n from '@/i18n';
import { darkTheme as legacyDark, lightTheme as legacyLight } from '@/theme/legacy/theme';
import { darkTheme, lightTheme } from '@/theme/theme';
import { DarkThemeScope, useTheme } from '@/theme/useTheme';
import { useTheme as useLegacyTheme, DarkThemeScope as LegacyDarkThemeScope } from '@/theme/legacy/useTheme';
import { applyThemePreference, usePreferences } from '../usePreferences';

jest.mock('@/data/preferences', () => ({
  readThemePreference: jest.fn(() => 'light'),
  readLanguagePreference: jest.fn(() => 'pl'),
  writeThemePreference: jest.fn(),
  writeLanguagePreference: jest.fn(),
}));

// Jest has no native Appearance module, so the scheme the app sets is kept here and read back by useColorScheme.
let mockScheme: string | null = null;
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme,
}));
const setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation((scheme) => {
  mockScheme = scheme ?? null;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(writeThemePreference).mockImplementation(() => {});
  jest.mocked(writeLanguagePreference).mockImplementation(() => {});
});

describe('applyThemePreference', () => {
  it('maps system to unspecified and passes light / dark', () => {
    applyThemePreference('system');
    applyThemePreference('dark');
    applyThemePreference('light');
    expect(setColorScheme.mock.calls.map((c) => c[0])).toEqual(['unspecified', 'dark', 'light']);
  });
});

describe('applyThemePreference without Appearance.setColorScheme (react-native-web)', () => {
  it('does not throw', () => {
    const original = Appearance.setColorScheme;
    // @ts-expect-error react-native-web has no setColorScheme
    Appearance.setColorScheme = undefined;
    try {
      expect(() => applyThemePreference('dark')).not.toThrow();
    } finally {
      Appearance.setColorScheme = original;
    }
  });
});

describe('usePreferences', () => {
  it('starts with the saved values', async () => {
    const { result } = await renderHook(() => usePreferences());
    expect(result.current.theme).toBe('light');
    expect(result.current.language).toBe('pl');
  });

  it('setTheme saves, applies and updates the value', async () => {
    const { result } = await renderHook(() => usePreferences());
    await act(async () => result.current.setTheme('dark'));
    expect(writeThemePreference).toHaveBeenCalledWith('dark');
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('setLanguage saves and changes the i18n language', async () => {
    const { result } = await renderHook(() => usePreferences());
    await act(async () => result.current.setLanguage('en'));
    expect(writeLanguagePreference).toHaveBeenCalledWith('en');
    expect(i18n.language).toBe('en');
    expect(result.current.language).toBe('en');
  });

  it('a failed write still applies the choice for the session, without throwing', async () => {
    jest.mocked(writeThemePreference).mockImplementation(() => {
      throw new Error('disk full');
    });
    jest.mocked(writeLanguagePreference).mockImplementation(() => {
      throw new Error('disk full');
    });
    const { result } = await renderHook(() => usePreferences());
    await act(async () => {
      result.current.setTheme('dark');
      result.current.setLanguage('pl');
    });
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
    expect(result.current.theme).toBe('dark');
    expect(i18n.language).toBe('pl');
  });
});

describe('useTheme follows the chosen scheme', () => {
  it.each([
    ['dark', darkTheme, legacyDark],
    ['light', lightTheme, legacyLight],
  ] as const)('both hooks return the %s theme', async (scheme, expected, legacyExpected) => {
    Appearance.setColorScheme(scheme);
    expect((await renderHook(() => useTheme())).result.current).toBe(expected);
    expect((await renderHook(() => useLegacyTheme())).result.current).toBe(legacyExpected);
  });

  it('DarkThemeScope still forces dark on a light choice', async () => {
    Appearance.setColorScheme('light');
    expect((await renderHook(() => useTheme(), { wrapper: DarkThemeScope })).result.current).toBe(darkTheme);
    expect((await renderHook(() => useTheme(), { wrapper: LegacyDarkThemeScope })).result.current).toBe(darkTheme);
  });
});
