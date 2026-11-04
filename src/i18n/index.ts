import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { readLanguagePreference } from '@/data/preferences';
import type { LanguagePreference } from '@/schemas/preferences';
import en from './locales/en.json';
import pl from './locales/pl.json';

const resources = { pl: { translation: pl }, en: { translation: en } } as const;
const fallbackLanguage = 'en';

type Language = keyof typeof resources;

function isLanguage(code: string | null): code is Language {
  return code !== null && Object.hasOwn(resources, code);
}

// A saved choice wins; 'system' uses the device's first preferred language, and anything other than pl/en falls back to English.
export function resolveLanguage(preference: LanguagePreference): Language {
  if (preference !== 'system') return preference;
  const deviceLanguage = getLocales()[0].languageCode;
  return isLanguage(deviceLanguage) ? deviceLanguage : fallbackLanguage;
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(readLanguagePreference()),
  fallbackLng: fallbackLanguage,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
