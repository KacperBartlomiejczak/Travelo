import { act, renderHook } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import { writeChartStylePreference, writeLanguagePreference, writeThemePreference } from '@/data/preferences';
import i18n from '@/i18n';
import { darkTheme as legacyDark, lightTheme as legacyLight } from '@/theme/legacy/theme';
import { darkTheme, lightTheme } from '@/theme/theme';
import { DarkThemeScope, useTheme } from '@/theme/useTheme';
import { useTheme as useLegacyTheme, DarkThemeScope as LegacyDarkThemeScope } from '@/theme/legacy/useTheme';
import { setThemePreference } from '@/theme/themePreference';
import { applyThemePreference, usePreferences } from '../usePreferences';

let mockSavedTheme = 'light';
jest.mock('@/data/preferences', () => ({
  readThemePreference: jest.fn(() => mockSavedTheme),
  readLanguagePreference: jest.fn(() => 'pl'),
  readChartStylePreference: jest.fn(() => 'line'),
  writeChartStylePreference: jest.fn(),
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
  mockSavedTheme = 'light';
  setThemePreference('light');
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

  it('starts with the line chart style and setChartStyle saves and updates it', async () => {
    const { result } = await renderHook(() => usePreferences());
    expect(result.current.chartStyle).toBe('line');
    await act(async () => result.current.setChartStyle('bar'));
    expect(writeChartStylePreference).toHaveBeenCalledWith('bar');
    expect(result.current.chartStyle).toBe('bar');
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

describe('the theme store with nothing set yet', () => {
  it('reads the saved dark choice although the device reports light', async () => {
    mockScheme = 'light';
    mockSavedTheme = 'dark';
    // Fresh registry: the file-level setThemePreference('light') seed does not reach this store.
    // React stays shared so the isolated hooks run inside the outer renderer.
    const React = jest.requireActual('react');
    let loaded!: {
      usePreferences: typeof usePreferences;
      useTheme: typeof useTheme;
      useLegacyTheme: typeof useLegacyTheme;
    };
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      jest.doMock('react', () => React);
      loaded = {
        usePreferences: require('../usePreferences').usePreferences,
        useTheme: require('@/theme/useTheme').useTheme,
        useLegacyTheme: require('@/theme/legacy/useTheme').useTheme,
      };
      /* eslint-enable @typescript-eslint/no-require-imports */
    });
    jest.dontMock('react');

    expect((await renderHook(() => loaded.usePreferences())).result.current.theme).toBe('dark');
    expect((await renderHook(() => loaded.useTheme())).result.current).toEqual(darkTheme);
    expect((await renderHook(() => loaded.useLegacyTheme())).result.current).toEqual(legacyDark);
  });
});

describe('useTheme follows the chosen preference', () => {
  it('setTheme(dark) turns an unrelated useTheme dark although the device reports light', async () => {
    const prefs = await renderHook(() => usePreferences());
    const other = await renderHook(() => useTheme());
    mockScheme = 'light';
    setColorScheme.mockImplementationOnce(() => {}); // the activity-recreate case: the native scheme stays light
    await act(async () => prefs.result.current.setTheme('dark'));
    expect(other.result.current).toBe(darkTheme);
  });

  it.each([
    ['dark', darkTheme, legacyDark],
    ['light', lightTheme, legacyLight],
  ] as const)('both hooks return the %s theme', async (scheme, expected, legacyExpected) => {
    setThemePreference('system');
    Appearance.setColorScheme(scheme);
    expect((await renderHook(() => useTheme())).result.current).toBe(expected);
    expect((await renderHook(() => useLegacyTheme())).result.current).toBe(legacyExpected);
  });

  it('DarkThemeScope still forces dark on a light choice', async () => {
    setThemePreference('system');
    Appearance.setColorScheme('light');
    expect((await renderHook(() => useTheme(), { wrapper: DarkThemeScope })).result.current).toBe(darkTheme);
    expect((await renderHook(() => useTheme(), { wrapper: LegacyDarkThemeScope })).result.current).toBe(darkTheme);
  });
});
