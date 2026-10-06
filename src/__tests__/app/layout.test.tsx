import { useFonts } from 'expo-font';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { useNearestTrip } from '@/hooks/useTrips';

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
    'trips/new/index': () => null,
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

  it('gives screens the trips data layer (query client + trip repository)', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    function TripsProbe() {
      const nearest = useNearestTrip();
      return <Text>{nearest.isSuccess ? `nearest: ${nearest.data?.trip.name ?? 'none'}` : 'loading'}</Text>;
    }
    await renderRouter({ _layout: RootLayout, index: TripsProbe, 'trips/new/index': () => null });
    // No example trips under Jest (D8).
    expect(await screen.findByText('nearest: none')).toBeTruthy();
  });
});
