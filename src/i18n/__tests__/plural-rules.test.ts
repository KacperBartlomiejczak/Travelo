import type { i18n as I18n } from 'i18next';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageTag: 'pl-PL', languageCode: 'pl' }]) }));
jest.mock('@/data/preferences', () => ({ readLanguagePreference: jest.fn(() => 'pl') }));

// Simulates Hermes on Android, which ships without Intl.PluralRules (i18next resolves rules lazily, so it stays removed per test).
const nativePluralRules = Intl.PluralRules;

function loadI18n(language: 'pl' | 'en'): I18n {
  let instance: I18n | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/data/preferences').readLanguagePreference.mockReturnValue(language);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    instance = require('../index').default;
  });
  if (!instance) throw new Error('i18n was not loaded');
  return instance;
}

describe('i18n plural forms without native Intl.PluralRules', () => {
  beforeEach(() => {
    // @ts-expect-error Intl.PluralRules is non-optional in the lib typings; removing it is the point of this test.
    delete Intl.PluralRules;
  });
  afterEach(() => {
    Object.defineProperty(Intl, 'PluralRules', { value: nativePluralRules, configurable: true, writable: true });
  });

  it('picks Polish one/few/many forms', () => {
    const { t } = loadI18n('pl');
    expect(t('discover.ratingLabelCount', { rating: '4,4', count: 77034, n: '77 034' })).toBe(
      'Ocena 4,4 na 5, 77 034 opinie',
    );
    expect(t('discover.ratingLabelCount', { rating: '4,4', count: 1, n: '1' })).toBe('Ocena 4,4 na 5, 1 opinia');
    expect(t('discover.ratingLabelCount', { rating: '4,4', count: 5, n: '5' })).toBe('Ocena 4,4 na 5, 5 opinii');
  });

  it('keeps English one/other', () => {
    const { t } = loadI18n('en');
    expect(t('discover.ratingLabelCount', { rating: '4.4', count: 1, n: '1' })).toMatch(/1 review\b(?!s)/);
    expect(t('discover.ratingLabelCount', { rating: '4.4', count: 3, n: '3' })).toMatch(/3 reviews/);
  });
});
