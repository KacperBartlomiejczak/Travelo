import { useFonts } from 'expo-font';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import { useCurrentTrip } from '@/hooks/useTrips';
import { drawerStatus } from '@/test/drawer-status';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

const mockedUseFonts = jest.mocked(useFonts);

function renderApp() {
  return renderRouter({
    _layout: RootLayout,
    '(drawer)/_layout': DrawerLayout,
    '(drawer)/index': () => <Text>home screen</Text>,
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

  it('shows the home screen at / inside the side panel navigator, closed at start (trips-drawer)', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    const rendered = renderApp();
    await rendered;
    expect(rendered.getPathname()).toBe('/');
    expect(rendered.getSegments()).toEqual(['(drawer)']);
    expect(screen.getByText('home screen')).toBeTruthy();
    expect(drawerStatus(rendered)).toBe('closed');
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
      const current = useCurrentTrip();
      return <Text>{current.isSuccess ? `current: ${current.data?.overview.trip.name ?? 'none'}` : 'loading'}</Text>;
    }
    await renderRouter({ _layout: RootLayout, '(drawer)/_layout': DrawerLayout, '(drawer)/index': TripsProbe, 'trips/new/index': () => null });
    // Example trips are gone (trips-supabase D8); under Jest the app repository is in memory (jest.setup.ts).
    expect(await screen.findByText('current: none')).toBeTruthy();
  });
});
