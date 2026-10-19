import { renderRouter, act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { AccessibilityInfo, Text } from 'react-native';

import { OAuthSignInError, type OAuthProvider } from '@/data/auth';
import { ServerUnreachableError } from '@/data/errors';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/theme';

import { SignInSheet } from '../SignInSheet';

// The sign-in goes through the app's auth (Supabase + the system browser), which tests never reach.
const mockSignIn = jest.fn<Promise<'signed-in' | 'cancelled'>, [OAuthProvider]>();
jest.mock('@/data/app-auth', () => ({
  appAuth: { signInWithProvider: (provider: OAuthProvider) => mockSignIn(provider) },
}));

const GOOGLE = 'Kontynuuj z Google';
const DISCORD = 'Kontynuuj z Discordem';
const EMAIL = 'Kontynuuj z e-mailem';
const GOOGLE_ERROR = 'Nie udało się zalogować przez Google. Spróbuj ponownie.';
const DISCORD_ERROR = 'Nie udało się zalogować przez Discorda. Spróbuj ponownie.';
const ATTACKER_TEXT = 'Click here: evil.example/steal';

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

async function setup() {
  const onClose = jest.fn();
  const rendered = renderRouter({
    _layout: Layout,
    index: () => <SignInSheet onClose={onClose} />,
    email: () => <Text>email screen</Text>,
  });
  await rendered;
  return { onClose, getPathname: () => rendered.getPathname() };
}

const google = () => screen.getByRole('button', { name: GOOGLE });
const discord = () => screen.getByRole('button', { name: DISCORD });
const email = () => screen.getByRole('button', { name: EMAIL });

/** A sign-in that stays open until the test finishes it. */
function holdSignIn() {
  let finish: (result: 'signed-in' | 'cancelled') => void = () => {};
  let fail: (error: Error) => void = () => {};
  mockSignIn.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        finish = resolve;
        fail = reject;
      }),
  );
  return { finish: (result: 'signed-in' | 'cancelled') => finish(result), fail: (error: Error) => fail(error) };
}

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue('cancelled');
});

afterEach(() => jest.restoreAllMocks());

describe('SignInSheet (auth-onboarding D6, D10, D13, P5)', () => {
  it('is a sheet titled "Zaloguj się" with Google, Discord and e-mail, in that order, 12dp apart', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Zaloguj się' })).toBeTruthy();
    const options = screen.getByTestId('sign-in-options');
    expect(within(options).getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([GOOGLE, DISCORD, EMAIL]);
    expect(options).toHaveStyle({ gap: lightTheme.spacing[3] });
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByRole('header', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Discord' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with e-mail' })).toBeTruthy();
  });

  it('labels each brand button with its text and hides its logo from screen readers', async () => {
    await setup();
    expect(google().props.accessibilityLabel).toBe(GOOGLE);
    expect(discord().props.accessibilityLabel).toBe(DISCORD);
    for (const logo of ['google-logo', 'discord-logo']) {
      expect(isHiddenFromAccessibility(screen.getByTestId(logo, { includeHiddenElements: true }))).toBe(true);
    }
  });

  it.each([
    ['Google', 'google', google],
    ['Discord', 'discord', discord],
  ] as const)('%s: tapping the button signs in with that provider', async (_name, provider, button) => {
    await setup();
    await fireEvent.press(button());
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith(provider));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  describe('while a sign-in runs', () => {
    it.each([
      ['Google', google, 'google'],
      ['Discord', discord, 'discord'],
    ] as const)('%s: that button is loading and all three are disabled', async (_name, button, provider) => {
      holdSignIn();
      await setup();
      await fireEvent.press(button());

      await waitFor(() => expect(button()).toBeBusy());
      expect(screen.getByTestId(`${provider}-button-spinner`)).toBeTruthy();
      for (const option of [google(), discord(), email()]) {
        await fireEvent.press(option);
      }
      expect(mockSignIn).toHaveBeenCalledTimes(1); // no second sign-in, and the e-mail option did not navigate either
      expect(email()).toBeDisabled();
      const other = button() === google() ? discord() : google();
      expect(other).toBeDisabled();
      expect(other).not.toBeBusy();
    });

    it('cannot be dismissed: the system back button, the backdrop and a swipe do nothing', async () => {
      holdSignIn();
      const { onClose } = await setup();
      await fireEvent.press(google());
      await waitFor(() => expect(google()).toBeBusy());

      await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
      await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('is dismissible again after it failed', async () => {
      mockSignIn.mockRejectedValue(new Error('boom'));
      const { onClose } = await setup();
      await fireEvent.press(google());
      await waitFor(() => expect(screen.getByText(GOOGLE_ERROR)).toBeTruthy());

      await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('cancelled: nothing happens, the sheet stays, no error, the buttons are usable again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    // jest-expo already mocks it, so calls of earlier tests would still be counted.
    announce.mockClear();
    const { onClose, getPathname } = await setup();
    await fireEvent.press(google());
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    await act(async () => {});

    expect(screen.queryByText(GOOGLE_ERROR)).toBeNull();
    expect(screen.queryByTestId('sign-in-error')).toBeNull();
    expect(announce).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(getPathname()).toBe('/');
    expect(google()).toBeEnabled();
    expect(discord()).toBeEnabled();
    expect(email()).toBeEnabled();
  });

  it('signed in: nothing more happens here, the gate moves the app on', async () => {
    mockSignIn.mockResolvedValue('signed-in');
    const { onClose, getPathname } = await setup();
    await fireEvent.press(discord());
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    await act(async () => {});

    expect(onClose).not.toHaveBeenCalled();
    expect(getPathname()).toBe('/');
    expect(screen.queryByTestId('sign-in-error')).toBeNull();
  });

  describe('failure: fixed copy for the provider, never the error text', () => {
    it.each([
      ['Google', 'google', google, GOOGLE_ERROR, 'Couldn\'t sign in with Google. Try again.'],
      ['Discord', 'discord', discord, DISCORD_ERROR, 'Couldn\'t sign in with Discord. Try again.'],
    ] as const)('%s: an OAuthSignInError carrying attacker text', async (_name, provider, button, copy, englishCopy) => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    // jest-expo already mocks it, so calls of earlier tests would still be counted.
    announce.mockClear();
      mockSignIn.mockRejectedValue(new OAuthSignInError(provider, ATTACKER_TEXT));
      await setup();

      await fireEvent.press(button());

      await waitFor(() => expect(screen.getByText(copy)).toBeTruthy());
      expect(announce).toHaveBeenCalledWith(copy);
      expect(screen.queryByText(new RegExp(ATTACKER_TEXT))).toBeNull();
      expect(JSON.stringify(screen.toJSON())).not.toContain('evil.example');
      expect(screen.getByTestId('sign-in-error')).toBeTruthy();
      // All three are usable again for another try, and the sheet is still open.
      expect(google()).toBeEnabled();
      expect(discord()).toBeEnabled();
      expect(email()).toBeEnabled();

      await act(async () => {
        await i18n.changeLanguage('en');
      });
      expect(await screen.findByText(englishCopy)).toBeTruthy();
    });

    it('a ServerUnreachableError gets the same fixed copy', async () => {
      mockSignIn.mockRejectedValue(new ServerUnreachableError('socket closed: attacker.example'));
      await setup();
      await fireEvent.press(google());
      await waitFor(() => expect(screen.getByText(GOOGLE_ERROR)).toBeTruthy());
      expect(JSON.stringify(screen.toJSON())).not.toContain('attacker.example');
    });

    it('any other error gets the fixed copy of the tapped provider', async () => {
      mockSignIn.mockRejectedValue(new TypeError(ATTACKER_TEXT));
      await setup();
      await fireEvent.press(discord());
      await waitFor(() => expect(screen.getByText(DISCORD_ERROR)).toBeTruthy());
      expect(screen.queryByText(new RegExp(ATTACKER_TEXT))).toBeNull();
    });

    it('is shown with an icon, not by colour alone, below the buttons', async () => {
      mockSignIn.mockRejectedValue(new Error('x'));
      await setup();
      await fireEvent.press(google());
      const error = await screen.findByTestId('sign-in-error');
      expect(within(error).getByTestId('sign-in-error-icon', { includeHiddenElements: true })).toBeTruthy();
      expect(within(error).getByText(GOOGLE_ERROR)).toHaveStyle({ color: lightTheme.colors.status.error });
      const everything = JSON.stringify(screen.toJSON());
      expect(everything.indexOf(EMAIL)).toBeLessThan(everything.indexOf(GOOGLE_ERROR));
    });

    it('goes away when the user tries again', async () => {
      mockSignIn.mockRejectedValueOnce(new Error('x'));
      await setup();
      await fireEvent.press(google());
      await waitFor(() => expect(screen.getByText(GOOGLE_ERROR)).toBeTruthy());

      holdSignIn();
      await fireEvent.press(discord());

      await waitFor(() => expect(screen.queryByText(GOOGLE_ERROR)).toBeNull());
    });
  });

  it('e-mail: closes the sheet and opens the e-mail screen', async () => {
    const { onClose, getPathname } = await setup();

    await fireEvent.press(email());

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(getPathname()).toBe('/email'));
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  describe('offline (P4)', () => {
    it('shows the offline banner and disables all three options', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      await setup();

      expect(screen.getByTestId('offline-banner')).toBeTruthy();
      for (const option of [google(), discord(), email()]) {
        expect(option).toBeDisabled();
        await fireEvent.press(option);
      }
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('shows no banner while online', async () => {
      await setup();
      expect(screen.queryByTestId('offline-banner')).toBeNull();
    });

    it('enables the options again when the connection returns', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      await setup();
      await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
      expect(google()).toBeEnabled();
      expect(screen.queryByTestId('offline-banner')).toBeNull();
    });
  });
});
