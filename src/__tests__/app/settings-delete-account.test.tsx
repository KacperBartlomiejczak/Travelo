import { useFonts } from 'expo-font';
import { render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { StyleSheet, Text } from 'react-native';

import AuthLayout from '@/app/(auth)/_layout';
import WelcomeScreen from '@/app/(auth)/welcome';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import SettingsRoute from '@/app/settings';
import { createInMemoryProfileRepository } from '@/data/profile-repository';
import { SettingsScreen } from '@/features/profile/SettingsScreen';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { repositoryWithProfile, setAppProfileRepository, withMyProfile } from '@/test/fake-profile-repository';
import { useFakeAppSession, type FakeSession } from '@/test/fake-session-source';
import { setNetwork } from '@/test/mock-network';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/data/preferences', () => ({
  readThemePreference: jest.fn(() => 'system'),
  readLanguagePreference: jest.fn(() => 'system'),
  writeThemePreference: jest.fn(),
  writeLanguagePreference: jest.fn(),
}));

const ROUTES = {
  _layout: RootLayout,
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': WelcomeScreen,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': () => <Text>home</Text>,
  '(drawer)/(tabs)/expenses': () => <Text>expenses</Text>,
  '(drawer)/(tabs)/plan': () => <Text>plan</Text>,
  '(drawer)/(tabs)/profile': () => <Text>profile</Text>,
  'edit-profile': () => <Text>edit-profile-screen</Text>,
  settings: SettingsRoute,
};

const DELETED = 'Konto usunięte.';
const OFFLINE_REASON = 'Połącz się z internetem, żeby usunąć konto.';

let fake: FakeSession;

async function openSettings() {
  await renderRouter(ROUTES, { initialUrl: '/settings' });
  await screen.findByTestId('settings-screen');
}

const deleteButton = () => screen.getByRole('button', { name: 'Usuń konto' });
const background = (element: ReturnType<typeof screen.getByRole>) => StyleSheet.flatten(element.props.style)?.backgroundColor;

beforeEach(async () => {
  fake = useFakeAppSession();
  await i18n.changeLanguage('pl');
});

describe('Settings — delete account entry (profile-settings step 11)', () => {
  it('"Usuń konto" is a destructive button like "Wyloguj się", enabled online with a loaded profile and no reason shown', async () => {
    await setAppProfileRepository(await repositoryWithProfile());
    await openSettings();
    await waitFor(() => expect(deleteButton()).toBeEnabled());
    expect(background(deleteButton())).toBeTruthy();
    expect(background(deleteButton())).toBe(background(screen.getByRole('button', { name: 'Wyloguj się' })));
    expect(screen.queryByText(OFFLINE_REASON)).toBeNull();
  });

  it('is disabled offline, with the reason, and opens nothing', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    await openSettings();
    await waitFor(() => expect(deleteButton()).toBeDisabled());
    expect(screen.getByText(OFFLINE_REASON)).toBeTruthy();
    await fireEvent.press(deleteButton());
    expect(screen.queryByText('Usunąć konto?')).toBeNull();
  });

  // The root gate never lets these states reach the screen, so it is rendered on its own.
  async function renderScreenOnly() {
    await render(
      <AppProviders>
        <SettingsScreen />
      </AppProviders>,
    );
  }

  it('is disabled while the profile is still loading, and opens nothing', async () => {
    const base = await repositoryWithProfile();
    setAppProfileRepository(withMyProfile(base, () => new Promise(() => {})));
    await renderScreenOnly();
    expect(deleteButton()).toBeDisabled();
    await fireEvent.press(deleteButton());
    expect(screen.queryByText('Usunąć konto?')).toBeNull();
  });

  it('is disabled when there is no profile', async () => {
    setAppProfileRepository(createInMemoryProfileRepository());
    await renderScreenOnly();
    await waitFor(() => expect(deleteButton()).toBeDisabled());
    await fireEvent.press(deleteButton());
    expect(screen.queryByText('Usunąć konto?')).toBeNull();
  });

  it('is disabled when the profile could not be read', async () => {
    const base = await repositoryWithProfile();
    setAppProfileRepository(withMyProfile(base, async () => Promise.reject(new Error('read failed'))));
    await renderScreenOnly();
    await waitFor(() => expect(deleteButton()).toBeDisabled());
    await fireEvent.press(deleteButton());
    expect(screen.queryByText('Usunąć konto?')).toBeNull();
  });

  it('opens the dialog, and a typed nick deletes the account: signed out on the phone, and the welcome screen says "Konto usunięte."', async () => {
    await setAppProfileRepository(await repositoryWithProfile());
    await openSettings();
    await waitFor(() => expect(deleteButton()).toBeEnabled());
    await fireEvent.press(deleteButton());

    expect(await screen.findByText('Usunąć konto?')).toBeTruthy();
    await fireEvent.changeText(await screen.findByLabelText('Wpisz swój nick: kacper'), 'kacper');
    await fireEvent.press(within(screen.getByTestId('confirm-dialog-actions')).getByRole('button', { name: 'Usuń konto' }));

    expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
    expect(fake.signOut).toHaveBeenCalledTimes(1);
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);
    expect(screen.getByText(DELETED)).toBeTruthy();
  });

  it('a plain sign-out ends on the welcome screen without that message', async () => {
    await setAppProfileRepository(await repositoryWithProfile());
    await openSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Wyloguj się' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Wyloguj' }));

    expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
    expect(screen.queryByText(DELETED)).toBeNull();
  });
});
