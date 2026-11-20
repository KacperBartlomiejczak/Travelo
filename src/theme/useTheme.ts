import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme';
import { useThemePreference } from './themePreference';

// Set by DarkThemeScope; null = follow the device.
const ForcedTheme = createContext<Theme | null>(null);

/** Everything inside uses the dark theme, on light devices too (the welcome screen and the photo viewer). */
export function DarkThemeScope({ children }: { children: ReactNode }) {
  return createElement(ForcedTheme.Provider, { value: darkTheme }, children);
}

export function useTheme(): Theme {
  const forced = useContext(ForcedTheme);
  const scheme = useColorScheme();
  const preference = useThemePreference();
  // An explicit choice wins; only 'system' follows the device.
  const dark = preference === 'system' ? scheme === 'dark' : preference === 'dark';
  return forced ?? (dark ? darkTheme : lightTheme);
}
