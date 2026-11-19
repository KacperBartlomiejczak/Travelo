import { z } from 'zod';

// Device-only appearance and language choices (profile-settings). 'system' follows the phone.

export const ThemePreferenceSchema = z.enum(['system', 'light', 'dark']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const LanguagePreferenceSchema = z.enum(['system', 'pl', 'en']);
export type LanguagePreference = z.infer<typeof LanguagePreferenceSchema>;

// Device-only budget chart choice (trip-spend-chart A1/A5); 'line' is the default.
export const ChartStylePreferenceSchema = z.enum(['line', 'bar', 'donut']);
export type ChartStylePreference = z.infer<typeof ChartStylePreferenceSchema>;
