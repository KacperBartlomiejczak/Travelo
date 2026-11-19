import { useSyncExternalStore } from 'react';

import { readThemePreference } from '@/data/preferences';
import type { ThemePreference } from '@/schemas/preferences';

// The user's explicit theme choice, shared by Settings and both useTheme hooks so they never disagree
// (Android reports "light" after the activity is recreated, whatever Appearance.setColorScheme was given).
// Lives in theme/, not hooks/, so the theme does not pull i18n in.
let current: ThemePreference | null = null;
const listeners = new Set<() => void>();

const getThemePreference = (): ThemePreference => (current ??= readThemePreference());

export function setThemePreference(next: ThemePreference): void {
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Static web export renders on the server, where there is no storage: default to "system".
const getServerThemePreference = (): ThemePreference => 'system';

export const useThemePreference = (): ThemePreference =>
  useSyncExternalStore(subscribe, getThemePreference, getServerThemePreference);
