import { getLocales } from 'expo-localization';
import type { i18n as I18n } from 'i18next';

import { readLanguagePreference } from '@/data/preferences';
import en from '../locales/en.json';
import pl from '../locales/pl.json';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));
jest.mock('@/data/preferences', () => ({ readLanguagePreference: jest.fn(() => 'system') }));

const mockedRead = jest.mocked(readLanguagePreference);

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
  beforeEach(() => mockedRead.mockReturnValue('system'));

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

describe('i18n saved language (profile-settings step 7)', () => {
  it('a saved language wins over the device', () => {
    mockedRead.mockReturnValue('pl');
    expect(loadI18nFor('en-US', 'en').language).toBe('pl');
    mockedRead.mockReturnValue('en');
    expect(loadI18nFor('pl-PL', 'pl').language).toBe('en');
  });

  it('system goes back to the device language, English when unsupported', () => {
    mockedRead.mockReturnValue('system');
    expect(loadI18nFor('pl-PL', 'pl').language).toBe('pl');
    expect(loadI18nFor('de-DE', 'de').language).toBe('en');
  });
});

describe('i18n settings subscription keys (revenuecat step 4)', () => {
  const keys = ['pro.offline', 'pro.error', 'subscription.title', 'subscription.offline', 'subscription.error'];

  it.each(keys)('has settings.%s in pl and en', (key) => {
    expect(keysOf(pl.settings)).toContain(key);
    expect(keysOf(en.settings)).toContain(key);
  });

  it('no longer has settings.pro.comingSoon', () => {
    expect(keysOf(pl.settings)).not.toContain('pro.comingSoon');
    expect(keysOf(en.settings)).not.toContain('pro.comingSoon');
  });
});

describe('i18n profile upgrade keys', () => {
  const keys = [
    'pastTitle', 'pastLoading', 'pastEmpty', 'pastError', 'pastSolo', 'pastTripLabel', 'pastTripHint',
    'friendCode', 'friendCodeSpoken', 'shareCode', 'shareMessage', 'pro', 'proLabel',
  ];

  it.each(keys)('has profile.%s in pl and en', (key) => {
    expect(pl.profile).toHaveProperty(key);
    expect(en.profile).toHaveProperty(key);
  });

  it('pluralises pastFriends in Polish', () => {
    const i18n = loadI18nFor('pl-PL', 'pl');
    expect(i18n.t('profile.pastFriends', { count: 1 })).toBe('1 znajomy');
    expect(i18n.t('profile.pastFriends', { count: 2 })).toBe('2 znajomych');
    expect(i18n.t('profile.pastFriends', { count: 5 })).toBe('5 znajomych');
  });

  it('pluralises pastFriends in English', () => {
    const i18n = loadI18nFor('en-US', 'en');
    expect(i18n.t('profile.pastFriends', { count: 1 })).toBe('1 friend');
    expect(i18n.t('profile.pastFriends', { count: 2 })).toBe('2 friends');
  });

  it('interpolates the code in shareMessage', () => {
    expect(loadI18nFor('en-US', 'en').t('profile.shareMessage', { code: 'ABC123' })).toContain('ABC123');
    expect(loadI18nFor('pl-PL', 'pl').t('profile.shareMessage', { code: 'ABC123' })).toContain('ABC123');
  });
});
