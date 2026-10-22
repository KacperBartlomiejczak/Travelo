import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Platform, StyleSheet, Text } from 'react-native';

import AuthLayout from '@/app/(auth)/_layout';
import WelcomeScreen from '@/app/(auth)/welcome';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import ProfileScreen from '@/app/(drawer)/(tabs)/profile';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import SettingsRoute from '@/app/settings';
import i18n from '@/i18n';
import { useFakeAppSession } from '@/test/fake-session-source';
import { setNetwork } from '@/test/mock-network';
import { darkTheme, lightTheme } from '@/theme/theme';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

let mockScheme: 'light' | 'dark' = 'light';
let mockWindowWidth = 390;
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: 1 }),
}));

// Whether the phone holds budget changes that were not sent yet: a test makes this resolve true or reject.
const mockHasUnsentChanges = jest.fn<Promise<boolean>, []>();
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => ({
    ...jest.requireActual('@/data/trip-repository').createInMemoryTripRepository(),
    hasUnsentChanges: () => mockHasUnsentChanges(),
  }),
}));

const ROUTES = {
  _layout: RootLayout,
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': WelcomeScreen,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': () => <Text>home</Text>,
  '(drawer)/(tabs)/expenses': () => <Text>expenses</Text>,
  '(drawer)/(tabs)/places': () => <Text>places</Text>,
  '(drawer)/(tabs)/plan': () => <Text>plan</Text>,
  '(drawer)/(tabs)/profile': ProfileScreen,
  settings: SettingsRoute,
};

const WELCOME = 'Witaj w Travelo';
const SHORT_MESSAGE = 'Wylogujesz się z tego telefonu.';
const WARNING_MESSAGE = 'Wylogujesz się z tego telefonu. Niewysłane zmiany budżetu przepadną.';
const OFFLINE_MESSAGE = 'Połącz się z internetem, żeby się wylogować.';

// Opens the app on the profile and takes the gear to Settings, like a user does. The gate must show the app first.
async function openSettings() {
  const rendered = renderRouter(ROUTES, { initialUrl: '/profile' });
  const { container } = await rendered;
  await fireEvent.press(await screen.findByRole('button', { name: 'Ustawienia' }));
  await screen.findByRole('button', { name: 'Wyloguj się' });
  return { container, getPathname: () => rendered.getPathname() };
}

const signOutButton = () => screen.getByRole('button', { name: 'Wyloguj się' });
// The dialog's own buttons (the settings button is "Wyloguj się", the dialog's confirm is "Wyloguj").
const confirmButton = () => within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Wyloguj' });
const cancelButton = () => within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Anuluj' });

async function openDialog() {
  await fireEvent.press(signOutButton());
  await screen.findByText('Wylogować się?');
}

function headerTitles(container: Awaited<ReturnType<typeof openSettings>>['container']) {
  return container
    .queryAll((node) => node.type === 'RNSScreenStackHeaderConfig')
    .map((node) => node.props.title)
    .filter(Boolean);
}

beforeEach(async () => {
  mockScheme = 'light';
  mockWindowWidth = 390;
  mockHasUnsentChanges.mockReset();
  mockHasUnsentChanges.mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await i18n.changeLanguage('pl');
});

describe('Settings — screen (profile-screen A4)', () => {
  it('is opened by the gear on the profile, titled "Ustawienia", and has the sign-out button', async () => {
    const app = await openSettings();
    expect(app.getPathname()).toBe('/settings');
    expect(headerTitles(app.container)).toContain('Ustawienia');
    expect(signOutButton()).toBeTruthy();
  });

  it('shows the English title and button', async () => {
    await i18n.changeLanguage('en');
    const rendered = renderRouter(ROUTES, { initialUrl: '/profile' });
    const { container } = await rendered;
    await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(
      container
        .queryAll((node) => node.type === 'RNSScreenStackHeaderConfig')
        .map((node) => node.props.title)
        .filter(Boolean),
    ).toContain('Settings');
  });

  it('has a back button labelled with the screen it returns to, and back returns to the profile', async () => {
    const app = await openSettings();
    expect(screen.getByRole('button', { name: 'Wróć, Profil' })).toBeTruthy();
    // Here leaving is driven with router.back() directly, to prove the route returns to the profile; that pressing the
    // control itself reaches router.back() is the test "the back control calls router.back()" below.
    await act(async () => router.back());
    await waitFor(() => expect(app.getPathname()).toBe('/profile'));
  });

  it('on iOS the back control gets a touch area of at least 44dp (D17, design-context §5.2), keeping its label', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      await openSettings();
      const back = screen.getByRole('button', { name: 'Wróć, Profil' });
      // iOS has no hitSlop on the header buttons (HeaderButton.js), so the control itself must be 44dp.
      expect(back.props.hitSlop).toBeUndefined();
      expect(StyleSheet.flatten(back.props.style)).toMatchObject({ minWidth: lightTheme.size.touchTarget, minHeight: lightTheme.size.touchTarget });
      expect(lightTheme.size.touchTarget).toBeGreaterThanOrEqual(44);
    } finally {
      platform.restore();
    }
  });

  it('on Android the back control is 44dp tall (the library hitSlop is clipped vertically, D26) but not wider, which would push the title', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await openSettings();
      const style = StyleSheet.flatten(screen.getByRole('button', { name: 'Wróć, Profil' }).props.style);
      expect(style.minHeight).toBe(lightTheme.size.touchTarget);
      expect(style.minWidth).not.toBe(lightTheme.size.touchTarget);
      // Not asserted here: the library's Android hitSlop of 16dp on every side (HeaderButton.js, Platform.select). Jest runs as
      // iOS, and Platform.select is bound to that, so the rendered hitSlop cannot be read as Android's; the device run checks it.
    } finally {
      platform.restore();
    }
  });

  it('the back control calls router.back()', async () => {
    const app = await openSettings();
    const back = jest.spyOn(router, 'back');
    try {
      await fireEvent.press(screen.getByRole('button', { name: 'Wróć, Profil' }));
      // HeaderBackButton calls onPress inside requestAnimationFrame.
      await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(app.getPathname()).toBe('/profile'));
    } finally {
      back.mockRestore();
    }
  });

  it('has no pill on it: it is above the drawer', async () => {
    // Opened directly, so no screen of the tabs sits below it: the pill must not be anywhere in the rendered app.
    useFakeAppSession();
    await renderRouter(ROUTES, { initialUrl: '/settings' });
    expect(await screen.findByTestId('settings-screen')).toBeTruthy();
    expect(screen.queryByTestId('pill-nav')).toBeNull();
  });

  it('control: the same query finds the pill on the profile, so the check above can fail', async () => {
    useFakeAppSession();
    await renderRouter(ROUTES, { initialUrl: '/profile' });
    expect(await screen.findByTestId('profile-screen')).toBeTruthy();
    expect(screen.queryByTestId('pill-nav')).toBeTruthy();
  });

  it('has a 20dp side gutter at 360dp and wider, and 16dp below 360dp (design-context §18)', async () => {
    mockWindowWidth = lightTheme.breakpoints.compact;
    await openSettings();
    const gutter = () => StyleSheet.flatten(screen.getByTestId('settings-scroll').props.contentContainerStyle).paddingHorizontal;
    expect(gutter()).toBe(lightTheme.spacing[5]);
    expect(lightTheme.spacing[5]).toBe(20);
    await screen.unmount();
    mockWindowWidth = lightTheme.breakpoints.compact - 1;
    await openSettings();
    expect(gutter()).toBe(lightTheme.spacing[4]);
    expect(lightTheme.spacing[4]).toBe(16);
  });

  it('puts the button in the bottom part of the screen, at least 44dp tall', async () => {
    await openSettings();
    expect(StyleSheet.flatten(screen.getByTestId('settings-scroll').props.contentContainerStyle)).toMatchObject({ justifyContent: 'flex-end' });
    expect(signOutButton()).toHaveStyle({ minHeight: lightTheme.size.buttonPrimary });
    expect(lightTheme.size.buttonPrimary).toBeGreaterThanOrEqual(44);
  });

  it('uses the light background token in light mode', async () => {
    await openSettings();
    expect(screen.getByTestId('settings-screen')).toHaveStyle({ backgroundColor: lightTheme.colors.background });
  });

  it('uses the dark background token in dark mode', async () => {
    mockScheme = 'dark';
    await openSettings();
    expect(screen.getByTestId('settings-screen')).toHaveStyle({ backgroundColor: darkTheme.colors.background });
  });

  it('has no offline banner and no offline message while online', async () => {
    await openSettings();
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    expect(signOutButton()).toBeEnabled();
  });
});

describe('Settings — the confirmation (D5)', () => {
  it('asks "Wylogować się?" with the short message when nothing is unsent', async () => {
    await openSettings();
    await openDialog();
    expect(screen.getByText(SHORT_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(WARNING_MESSAGE)).toBeNull();
    expect(mockHasUnsentChanges).toHaveBeenCalledTimes(1);
  });

  it('warns that unsent budget changes will be lost when there are some', async () => {
    mockHasUnsentChanges.mockResolvedValue(true);
    await openSettings();
    await openDialog();
    expect(screen.getByText(WARNING_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(SHORT_MESSAGE)).toBeNull();
  });

  it('warns as well when the check itself fails: unsent changes are then possible', async () => {
    mockHasUnsentChanges.mockRejectedValue(new Error('cannot read the device store'));
    await openSettings();
    await openDialog();
    expect(screen.getByText(WARNING_MESSAGE)).toBeTruthy();
  });

  it('says it in English', async () => {
    await i18n.changeLanguage('en');
    mockHasUnsentChanges.mockResolvedValue(true);
    const rendered = renderRouter(ROUTES, { initialUrl: '/profile' });
    await rendered;
    await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Sign out?')).toBeTruthy();
    expect(screen.getByText('You will be signed out on this phone. Unsent budget changes will be lost.')).toBeTruthy();
    const dialog = within(screen.getByTestId('confirm-dialog'));
    expect(dialog.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('"Anuluj" closes the dialog and signs nobody out', async () => {
    const session = useFakeAppSession();
    await openSettings();
    await openDialog();
    await fireEvent.press(cancelButton());
    await waitFor(() => expect(screen.queryByText('Wylogować się?')).toBeNull());
    expect(session.signOut).not.toHaveBeenCalled();
    expect(signOutButton()).toBeEnabled();
  });

  it('"Wyloguj" signs out once', async () => {
    const session = useFakeAppSession();
    await openSettings();
    await openDialog();
    await fireEvent.press(confirmButton());
    await waitFor(() => expect(session.signOut).toHaveBeenCalledTimes(1));
  });

  it('a double tap on "Wyloguj" signs out once, and the button stays disabled while it runs', async () => {
    const session = useFakeAppSession();
    await openSettings();
    let finish: () => void = () => {};
    session.signOut.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    await openDialog();
    const confirm = confirmButton();
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    expect(session.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(signOutButton()).toBeDisabled());
    await act(async () => finish());
  });
});

describe('Settings — offline (D8)', () => {
  beforeEach(() => setNetwork({ isConnected: false, isInternetReachable: false }));

  it('disables the button and says why, with the offline banner', async () => {
    await openSettings();
    expect(signOutButton()).toBeDisabled();
    expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });

  it('says it in English', async () => {
    await i18n.changeLanguage('en');
    const rendered = renderRouter(ROUTES, { initialUrl: '/profile' });
    await rendered;
    await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('Connect to the internet to sign out.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
  });

  it('tapping the disabled button opens no dialog and asks nothing', async () => {
    await openSettings();
    await fireEvent.press(signOutButton());
    expect(screen.queryByText('Wylogować się?')).toBeNull();
    expect(mockHasUnsentChanges).not.toHaveBeenCalled();
  });

  it('enables the button again when the connection comes back', async () => {
    await openSettings();
    await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
    expect(signOutButton()).toBeEnabled();
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
  });
});

describe('Settings — the result of signing out (D16)', () => {
  it('success: the welcome screen shows and the phone was cleared first', async () => {
    const session = useFakeAppSession();
    await openSettings();
    await openDialog();
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(WELCOME)).toBeTruthy();
    expect(session.log).toEqual(expect.arrayContaining(['signOut', 'clear:start', 'clear:done']));
    expect(screen.queryByRole('button', { name: 'Wyloguj się' })).toBeNull();
  });

  it('a rejection, with the phone signed out: no error, and the welcome screen shows as on success', async () => {
    const session = useFakeAppSession();
    await openSettings();
    session.signOut.mockImplementationOnce(async () => {
      session.emit({ type: 'signedOut' });
      throw new Error('network request failed');
    });
    await openDialog();
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(WELCOME)).toBeTruthy();
    expect(screen.queryByText(/nie udało|błąd|network request failed/i)).toBeNull();
  });

  it('a rejection, still signed in: no error, and the button is enabled again to retry', async () => {
    const session = useFakeAppSession();
    await openSettings();
    session.signOut.mockRejectedValueOnce(new Error('stored session unreadable'));
    await openDialog();
    await fireEvent.press(confirmButton());
    await waitFor(() => expect(session.signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(signOutButton()).toBeEnabled());
    expect(screen.queryByText(/nie udało|błąd|spróbuj|stored session unreadable/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(WELCOME)).toBeNull();

    // And the retry works.
    await openDialog();
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(WELCOME)).toBeTruthy();
    expect(session.signOut).toHaveBeenCalledTimes(2);
  });
});

describe('Settings — signed out', () => {
  it('"/settings" is not reachable: the welcome screen shows instead', async () => {
    useFakeAppSession({ status: 'signedOut' });
    await renderRouter(ROUTES, { initialUrl: '/settings' });
    expect(await screen.findByText(WELCOME)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Wyloguj się' })).toBeNull();
  });
});
