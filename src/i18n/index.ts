import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import pl from './locales/pl.json';

const resources = { pl: { translation: pl }, en: { translation: en } } as const;
const fallbackLanguage = 'en';

type Language = keyof typeof resources;

function isLanguage(code: string | null): code is Language {
  return code !== null && Object.hasOwn(resources, code);
}

// Uses the device's first preferred language; anything other than pl/en falls back to English.
const deviceLanguage = getLocales()[0].languageCode;

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: isLanguage(deviceLanguage) ? deviceLanguage : fallbackLanguage,
  fallbackLng: fallbackLanguage,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
