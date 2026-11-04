// The saved theme is applied when the root layout module loads, before the first render (profile-settings D8).
jest.mock('@/data/preferences', () => ({
  readThemePreference: jest.fn(() => 'dark'),
  readLanguagePreference: jest.fn(() => 'system'),
}));

describe('root layout start', () => {
  it('applies the saved theme at module load', () => {
    const setColorScheme = jest.fn();
    jest.isolateModules(() => {
      // Required inside the isolated registry so the layout sees the same Appearance object.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Appearance } = require('react-native');
      Appearance.setColorScheme = setColorScheme;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/app/_layout');
    });
    expect(setColorScheme).toHaveBeenCalledWith('dark');
  });
});
