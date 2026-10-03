import { getLocales } from 'expo-localization';
import type { i18n as I18n } from 'i18next';

import en from '../locales/en.json';
import pl from '../locales/pl.json';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const mockedGetLocales = jest.mocked(getLocales);

// Loads a fresh i18n instance as if the app started on a device with the given locale.
function loadI18nFor(languageTag: string, languageCode: string): I18n {
  mockedGetLocales.mockReturnValue([{ languageTag, languageCode } as ReturnType<typeof getLocales>[number]]);
  let instance: I18n | undefined;
  jest.isolateModules(() => {
    // Synchronous require is needed to re-evaluate the module per locale; Jest has no dynamic import here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    instance = require('../index').default;
  });
  if (!instance) throw new Error('i18n was not loaded');
  return instance;
}

function keysOf(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('i18n', () => {
  it('uses Polish on a Polish device', () => {
    const i18n = loadI18nFor('pl-PL', 'pl');
    expect(i18n.language).toBe('pl');
    expect(i18n.t('trips.empty.heading')).toBe('Nie masz jeszcze żadnej podróży.');
  });

  it('uses English on an English device', () => {
    const i18n = loadI18nFor('en-US', 'en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('trips.empty.heading')).toBe("You don't have any trips yet.");
  });

  it('falls back to English on an unsupported locale', () => {
    const i18n = loadI18nFor('de-DE', 'de');
    expect(i18n.language).toBe('en');
    expect(i18n.t('trips.empty.heading')).toBe("You don't have any trips yet.");
  });

  it('has the same keys in Polish and English', () => {
    expect(keysOf(pl).sort()).toEqual(keysOf(en).sort());
  });
});
