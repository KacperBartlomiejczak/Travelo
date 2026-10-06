import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme';

// Set by DarkThemeScope; null = follow the device.
const ForcedTheme = createContext<Theme | null>(null);

/** Everything inside uses the dark theme, on light devices too (home screen with a trip, plan A4). */
export function DarkThemeScope({ children }: { children: ReactNode }) {
  return createElement(ForcedTheme.Provider, { value: darkTheme }, children);
}

export function useTheme(): Theme {
  const forced = useContext(ForcedTheme);
  const scheme = useColorScheme();
  return forced ?? (scheme === 'dark' ? darkTheme : lightTheme);
}
