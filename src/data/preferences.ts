import { Storage } from 'expo-sqlite/kv-store';
import {
  LanguagePreferenceSchema,
  ThemePreferenceSchema,
  type LanguagePreference,
  type ThemePreference,
} from '@/schemas/preferences';

// Device-only appearance and language (profile-settings D8). Synchronous, because i18n and the theme start before the first render.
// Lives in expo-sqlite's own kv database, so clearUserData (travelo.db) never touches it.
const THEME_KEY = 'preference.theme';
const LANGUAGE_KEY = 'preference.language';

// Unknown, missing or unreadable → 'system'.
function read<T>(key: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, fallback: T): T {
  try {
    const parsed = schema.safeParse(Storage.getItemSync(key));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export const readThemePreference = (): ThemePreference => read(THEME_KEY, ThemePreferenceSchema, 'system');
export const readLanguagePreference = (): LanguagePreference => read(LANGUAGE_KEY, LanguagePreferenceSchema, 'system');
export const writeThemePreference = (value: ThemePreference): void => Storage.setItemSync(THEME_KEY, value);
export const writeLanguagePreference = (value: LanguagePreference): void => Storage.setItemSync(LANGUAGE_KEY, value);
