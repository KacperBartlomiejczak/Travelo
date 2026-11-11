import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/providers/Session';
import { useFakeAppSession } from '@/test/fake-session-source';

import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/data/app-auth', () => ({ appAuth: { signInWithProvider: jest.fn(async () => 'cancelled') } }));

function Triggers() {
  const { signOut, signOutAfterDelete } = useSession();
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="plain" onPress={() => void signOut()}>
        <Text>plain</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="deleted" onPress={() => void signOutAfterDelete()}>
        <Text>deleted</Text>
      </Pressable>
    </>
  );
}

function Layout() {
  return (
    <AppProviders>
      <Triggers />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

const MESSAGE = 'Konto usunięte.';

async function setup() {
  await renderRouter({ _layout: Layout, index: WelcomeScreen });
  await waitFor(() => expect(screen.getByTestId('welcome-screen')).toBeTruthy());
}

beforeEach(async () => {
  useFakeAppSession();
  await i18n.changeLanguage('pl');
});

describe('WelcomeScreen — "Konto usunięte." (profile-settings D12)', () => {
  it('shows no message at the start', async () => {
    await setup();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('shows the message, announced politely, after the account was deleted', async () => {
    await setup();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'deleted' })));
    expect(await screen.findByText(MESSAGE)).toBeTruthy();
    expect(screen.getByTestId('welcome-deleted').props.accessibilityLiveRegion).toBe('polite');
  });

  it('shows no message after a plain sign-out', async () => {
    await setup();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'plain' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeTruthy());
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('is translated to English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'deleted' })));
    expect(await screen.findByText('Account deleted.')).toBeTruthy();
  });
});
