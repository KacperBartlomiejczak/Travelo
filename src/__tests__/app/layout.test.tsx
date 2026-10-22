import { useFonts } from 'expo-font';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import { useCurrentTrip } from '@/hooks/useTrips';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { drawerStatus } from '@/test/drawer-status';
import { useFakeAppSession } from '@/test/fake-session-source';
import { SIGNED_IN_USER_ID } from '@/test/fake-supabase';
import { allowGateToStayLoading } from '@/test/settle-gate';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

const mockedUseFonts = jest.mocked(useFonts);

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

function renderApp() {
  return renderRouter({
    _layout: RootLayout,
    '(drawer)/_layout': DrawerLayout,
    '(drawer)/(tabs)/_layout': TabsLayout,
    '(drawer)/(tabs)/index': () => <Text>home screen</Text>,
    'trips/new/index': () => null,
  });
}

beforeEach(() => {
  mockScheme = 'light';
});

afterEach(() => jest.clearAllMocks());

describe('RootLayout', () => {
  it('renders nothing and keeps the splash screen while fonts are loading', async () => {
    mockedUseFonts.mockReturnValue([false, null]);
    await renderApp();
    expect(screen.queryByText('home screen')).toBeNull();
    expect(screen.queryByTestId('splash-overlay')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('renders the navigator and hides the splash screen once fonts are loaded', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    await renderApp();
    expect(screen.getByText('home screen')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  // splash-animation step 5: the native splash hands over to the animated one as soon as the fonts are loaded.
  it('hides the native splash once fonts are loaded, without waiting for the gate', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    const session = useFakeAppSession({ status: 'signedIn', userId: SIGNED_IN_USER_ID });
    const release = session.holdCurrent();
    allowGateToStayLoading();
    await renderApp();
    expect(screen.getByTestId('app-loading')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await screen.findByText('home screen');
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('shows the animated splash above the gate while the gate is loading', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    const session = useFakeAppSession({ status: 'signedIn', userId: SIGNED_IN_USER_ID });
    session.holdCurrent();
    allowGateToStayLoading();
    await renderApp();
    expect(screen.getByTestId('splash-overlay')).toBeTruthy();
    expect(screen.getByTestId('splash-lottie')).toBeTruthy();
    expect(screen.getByTestId('app-loading')).toBeTruthy();
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('draws the loading screen in the %s canvas colour (design-context §9.0)', async (scheme, theme) => {
    mockScheme = scheme;
    mockedUseFonts.mockReturnValue([true, null]);
    const session = useFakeAppSession({ status: 'signedIn', userId: SIGNED_IN_USER_ID });
    const release = session.holdCurrent();
    allowGateToStayLoading();
    await renderApp();
    expect(screen.getByTestId('app-loading')).toHaveStyle({ flex: 1, backgroundColor: theme.background.canvas });
    await act(async () => release());
    await screen.findByText('home screen');
  });

  it('removes the animated splash after it has finished and the gate is ready, and the navigator stays', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    await renderApp();
    expect(screen.getByTestId('splash-overlay')).toBeTruthy();
    expect(screen.getByText('home screen')).toBeTruthy();

    await act(async () => screen.getByTestId('splash-lottie').props.onAnimationFinish(false));
    await waitFor(() => expect(screen.queryByTestId('splash-overlay')).toBeNull(), { timeout: tokens.motion.duration.standard * 5 });
    expect(screen.getByText('home screen')).toBeTruthy();
  });

  it('keeps the animated splash while the gate is still loading after the animation has finished', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    const session = useFakeAppSession({ status: 'signedIn', userId: SIGNED_IN_USER_ID });
    const release = session.holdCurrent();
    allowGateToStayLoading();
    await renderApp();
    await act(async () => screen.getByTestId('splash-lottie').props.onAnimationFinish(false));
    expect(screen.getByTestId('splash-spinner')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(tokens.motion.duration.standard * 2));
    expect(screen.getByTestId('splash-overlay')).toBeTruthy();

    await act(async () => release());
    await waitFor(() => expect(screen.queryByTestId('splash-overlay')).toBeNull(), { timeout: tokens.motion.duration.standard * 5 });
  });

  it('never shows the animated splash again during the session, even when the gate goes back to loading', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    const session = useFakeAppSession({ status: 'signedIn', userId: SIGNED_IN_USER_ID });
    await renderApp();
    await act(async () => screen.getByTestId('splash-lottie').props.onAnimationFinish(false));
    await waitFor(() => expect(screen.queryByTestId('splash-overlay')).toBeNull(), { timeout: tokens.motion.duration.standard * 5 });

    session.holdClear();
    allowGateToStayLoading();
    await act(async () => session.emit({ type: 'signedOut' }));
    expect(screen.getByTestId('app-loading')).toBeTruthy();
    expect(screen.queryByTestId('splash-overlay')).toBeNull();
  });

  it('shows the home screen at / inside the side panel navigator, closed at start (trips-drawer)', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    const rendered = renderApp();
    await rendered;
    expect(rendered.getPathname()).toBe('/');
    expect(rendered.getSegments()).toEqual(['(drawer)', '(tabs)']);
    expect(screen.getByText('home screen')).toBeTruthy();
    expect(drawerStatus(rendered)).toBe('closed');
  });

  it('still renders the app with system fonts when font loading fails', async () => {
    mockedUseFonts.mockReturnValue([false, new Error('font failed')]);
    await renderApp();
    expect(screen.getByText('home screen')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('gives screens the trips data layer (query client + trip repository)', async () => {
    mockedUseFonts.mockReturnValue([true, null]);
    function TripsProbe() {
      const current = useCurrentTrip();
      return <Text>{current.isSuccess ? `current: ${current.data?.overview.trip.name ?? 'none'}` : 'loading'}</Text>;
    }
    await renderRouter({ _layout: RootLayout, '(drawer)/_layout': DrawerLayout, '(drawer)/(tabs)/_layout': TabsLayout, '(drawer)/(tabs)/index': TripsProbe, 'trips/new/index': () => null });
    // Example trips are gone (trips-supabase D8); under Jest the app repository is in memory (jest.setup.ts).
    expect(await screen.findByText('current: none')).toBeTruthy();
  });
});
