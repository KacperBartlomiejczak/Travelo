import { getLocales } from 'expo-localization';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));
jest.mock('expo-sqlite/kv-store', () => ({
  Storage: {
    getItemSync: () => {
      throw new Error('storage down');
    },
  },
}));

describe('i18n when the saved language cannot be read', () => {
  it('starts in the device language', () => {
    jest.mocked(getLocales).mockReturnValue([{ languageTag: 'pl-PL', languageCode: 'pl' } as ReturnType<typeof getLocales>[number]]);
    let language: string | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      language = require('../index').default.language;
    });
    expect(language).toBe('pl');
  });
});
