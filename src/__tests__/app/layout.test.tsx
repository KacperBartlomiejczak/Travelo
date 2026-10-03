import { useFonts } from 'expo-font';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

const mockedUseFonts = jest.mocked(useFonts);

function renderApp() {
  return renderRouter({
    _layout: RootLayout,
    index: () => <Text>home screen</Text>,
  });
}

afterEach(() => jest.clearAllMocks());

describe('RootLayout', () => {
  it('renders nothing and keeps the splash screen while fonts are loading', async () => {
    mockedUseFonts.mockReturnValue([false, null]);
    await renderApp();
    expect(screen.queryByText('home screen')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('renders the navigator and hides the splash screen once fonts are loaded', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    await renderApp();
    expect(screen.getByText('home screen')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('still renders the app with system fonts when font loading fails', async () => {
    mockedUseFonts.mockReturnValue([false, new Error('font failed')]);
    await renderApp();
    expect(screen.getByText('home screen')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });
});
