import { useCallback, useState } from 'react';
import { Appearance } from 'react-native';

import {
  readLanguagePreference,
  readThemePreference,
  writeLanguagePreference,
  writeThemePreference,
} from '@/data/preferences';
import i18n, { resolveLanguage } from '@/i18n';
import type { LanguagePreference, ThemePreference } from '@/schemas/preferences';

/** Sets the app's color scheme; 'system' hands control back to the phone. Native pickers and the keyboard follow it too. */
export function applyThemePreference(theme: ThemePreference): void {
  // shortcut: react-native-web has no setColorScheme and always follows the browser; the app targets iOS and Android.
  if (typeof Appearance.setColorScheme !== 'function') return;
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

// A failed save must not undo the choice for this session; it is just not remembered.
function saveQuietly(save: () => void): void {
  try {
    save();
  } catch {
    // shortcut: no user-visible signal for a failed save, add one if the settings screen needs it.
  }
}

/** The device-only theme and language choices (profile-settings D8): setters save and apply at once. */
export function usePreferences() {
  const [theme, setThemeState] = useState(readThemePreference);
  const [language, setLanguageState] = useState(readLanguagePreference);

  const setTheme = useCallback((next: ThemePreference) => {
    saveQuietly(() => writeThemePreference(next));
    applyThemePreference(next);
    setThemeState(next);
  }, []);

  const setLanguage = useCallback((next: LanguagePreference) => {
    saveQuietly(() => writeLanguagePreference(next));
    void i18n.changeLanguage(resolveLanguage(next));
    setLanguageState(next);
  }, []);

  return { theme, language, setTheme, setLanguage };
}
