import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';
import { ZodError } from 'zod';

import { appAuth } from '@/data/app-auth';
import { ServerUnreachableError } from '@/data/errors';
import i18n from '@/i18n';
import { setNetwork } from '@/test/mock-network';
import { headerConfigs, openEmailScreen } from '@/test/auth-email-flow';
import { lightTheme } from '@/theme/legacy/theme';

// The real sign-in (Supabase) is mocked for every test by jest.setup.ts.
const sendEmailCode = jest.mocked(appAuth.sendEmailCode);

const EMAIL_LABEL = 'Adres e-mail';
const SEND = 'Wyślij kod';
const FORMAT_ERROR = 'Podaj poprawny adres e-mail.';
const SEND_ERROR = 'Nie udało się wysłać kodu. Spróbuj ponownie.';
const ATTACKER_TEXT = 'Click here: evil.example/steal';

const field = () => screen.getByLabelText(EMAIL_LABEL);
const sendButton = () => screen.getByRole('button', { name: SEND });

/** A send that stays open until the test finishes it. */
function holdSend() {
  let finish: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  sendEmailCode.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      }),
  );
  return { finish: () => finish(), fail: (error: Error) => fail(error) };
}

/** The `onPress` of a button, found the way `fireEvent.press` finds it: on the host element or on the component above it. */
function pressHandler(button: ReturnType<typeof sendButton>): () => void {
  for (let fiber = button.unstable_fiber; fiber !== null; fiber = fiber.return) {
    const handler: unknown = fiber.memoizedProps?.onPress;
    if (typeof handler === 'function') return handler as () => void;
  }
  throw new Error('The button has no onPress handler');
}

let announce: jest.SpyInstance;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  sendEmailCode.mockReset();
  sendEmailCode.mockResolvedValue(undefined);
  // jest-expo already mocks it, so calls of earlier tests would still be counted.
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announce.mockClear();
});

afterEach(() => jest.restoreAllMocks());

describe('EmailScreen (auth-onboarding D6, P3, P5, D17)', () => {
  it('has no fixed status-bar view: it sits under a header (D24)', async () => {
    await openEmailScreen();
    expect(screen.queryByTestId('email-screen-top-inset', { includeHiddenElements: true })).toBeNull();
  });

  it('shows the heading, the hint, an e-mail field and "Wyślij kod"', async () => {
    await openEmailScreen();
    expect(screen.getByRole('header', { name: 'Twój e-mail' })).toBeTruthy();
    expect(screen.getByText('Wyślemy Ci 6-cyfrowy kod.')).toBeTruthy();
    expect(field()).toBeTruthy();
    expect(screen.queryByLabelText('Twój e-mail')).toBeNull(); // the field has its own, shorter label (D18)
    expect(sendButton()).toBeEnabled();
  });

  it('is set up as an e-mail field: e-mail keyboard, no capitals, no autocorrect, e-mail autofill', async () => {
    await openEmailScreen();
    expect(field().props.keyboardType).toBe('email-address');
    expect(field().props.autoCapitalize).toBe('none');
    expect(field().props.autoCorrect).toBe(false);
    expect(field().props.autoComplete).toBe('email');
    expect(field().props.textContentType).toBe('emailAddress');
    expect(field().props.returnKeyType).toBe('send');
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await openEmailScreen();
    expect(screen.getByRole('header', { name: 'Your e-mail' })).toBeTruthy();
    expect(screen.getByText("We'll send you a 6-digit code.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeTruthy();
  });

  describe('back', () => {
    it('has a native header with a "Wstecz" back button, and goes back to the welcome screen', async () => {
      const { container, getPathname } = await openEmailScreen();
      const visible = headerConfigs(container).filter((node) => !node.props.hidden);
      expect(visible).toHaveLength(1);
      expect(visible[0].props.backTitle).toBe('Wstecz');

      // Pressing native header items does not reach the router in Jest: leaving is driven with router.back().
      await act(async () => router.back());

      await waitFor(() => expect(getPathname()).toBe('/welcome'));
    });

    it('labels the back button in English', async () => {
      await i18n.changeLanguage('en');
      const { container } = await openEmailScreen();
      const visible = headerConfigs(container).filter((node) => !node.props.hidden);
      expect(visible[0].props.backTitle).toBe('Back');
    });

    it('leaves the welcome screen without a header', async () => {
      const { container } = await openEmailScreen();
      await act(async () => router.back());
      await waitFor(() => expect(screen.getByText('welcome stand-in')).toBeTruthy());
      expect(headerConfigs(container).filter((node) => !node.props.hidden)).toHaveLength(0);
    });
  });

  describe('an invalid address', () => {
    it.each([['not-an-email'], ['kacper@'], ['   '], ['']])('"%s": the field error, no request, announced', async (typed) => {
      await openEmailScreen();
      await fireEvent.changeText(field(), typed);

      await fireEvent.press(sendButton());

      expect(screen.getByText(FORMAT_ERROR)).toBeTruthy();
      expect(screen.getByText(FORMAT_ERROR)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(field().props.accessibilityHint).toBe(FORMAT_ERROR);
      expect(field()).toHaveStyle({ borderWidth: 2, borderColor: lightTheme.colors.status.error });
      expect(announce).toHaveBeenCalledWith(FORMAT_ERROR);
      expect(sendEmailCode).not.toHaveBeenCalled();
    });

    it('goes away when the user types again', async () => {
      await openEmailScreen();
      await fireEvent.changeText(field(), 'nope');
      await fireEvent.press(sendButton());
      expect(screen.getByText(FORMAT_ERROR)).toBeTruthy();

      await fireEvent.changeText(field(), 'nope@');

      expect(screen.queryByText(FORMAT_ERROR)).toBeNull();
    });

    it('is in English on an English phone', async () => {
      await i18n.changeLanguage('en');
      await openEmailScreen();
      await fireEvent.changeText(screen.getByLabelText('E-mail address'), 'nope');
      await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
      expect(screen.getByText('Enter a valid e-mail address.')).toBeTruthy();
    });
  });

  describe('a valid address', () => {
    it('sends the normalised address (trimmed, lower case) and opens the code screen', async () => {
      const { getPathname } = await openEmailScreen();
      await fireEvent.changeText(field(), ' Kacper@Example.com ');

      await fireEvent.press(sendButton());

      await waitFor(() => expect(getPathname()).toBe('/code'));
      expect(sendEmailCode).toHaveBeenCalledTimes(1);
      expect(sendEmailCode).toHaveBeenCalledWith({ email: 'kacper@example.com' });
      expect(screen.getByTestId('code-screen')).toBeTruthy();
      // The address travels in the layout's state, never in the URL (D17).
      expect(getPathname()).not.toContain('kacper');
    });

    it('sends from the keyboard "send" key too', async () => {
      const { getPathname } = await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');

      await fireEvent(field(), 'submitEditing');

      await waitFor(() => expect(getPathname()).toBe('/code'));
      expect(sendEmailCode).toHaveBeenCalledTimes(1);
    });

    it('is loading while the code is sent: busy, a second press sends nothing, and it opens the code screen afterwards', async () => {
      const send = holdSend();
      const { getPathname } = await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');

      await fireEvent.press(sendButton());

      await waitFor(() => expect(sendButton()).toBeBusy());
      expect(screen.getByTestId('primary-button-spinner')).toBeTruthy();
      await fireEvent.press(sendButton());
      await fireEvent(field(), 'submitEditing');
      expect(sendEmailCode).toHaveBeenCalledTimes(1);
      expect(getPathname()).toBe('/email');

      await act(async () => send.finish());
      await waitFor(() => expect(getPathname()).toBe('/code'));
    });

    it('two taps on "Wyślij kod" in the same moment send only once (D19)', async () => {
      holdSend();
      await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');

      // Both taps run before React renders the loading state, so the press handler itself is called twice inside one act
      // (two awaited fireEvent.press calls would render in between, and overlapping them is not supported).
      const onPress = pressHandler(sendButton());
      await act(async () => {
        onPress();
        onPress();
      });

      expect(sendEmailCode).toHaveBeenCalledTimes(1);
    });

    it('locks the field while the code is sent, and a "send" key press on it sends nothing more (D19)', async () => {
      const send = holdSend();
      await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');
      expect(field().props.editable).not.toBe(false);

      await fireEvent.press(sendButton());

      await waitFor(() => expect(field().props.editable).toBe(false));
      expect(field().props.value).toBe('kacper@example.com');
      await fireEvent(field(), 'submitEditing');
      expect(sendEmailCode).toHaveBeenCalledTimes(1);
      await act(async () => send.finish());
    });
  });

  describe('a failed send: fixed copy, never the error text', () => {
    it.each([
      ['an error carrying attacker text', () => new Error(ATTACKER_TEXT)],
      ['an unreachable server', () => new ServerUnreachableError(ATTACKER_TEXT)],
      ['a rate limit', () => Object.assign(new Error(ATTACKER_TEXT), { code: 'over_email_send_rate_limit' })],
      ['a ZodError from the data layer', () => new ZodError([{ code: 'custom', path: ['email'], message: ATTACKER_TEXT }])],
    ])('%s', async (_name, makeError) => {
      sendEmailCode.mockRejectedValue(makeError());
      const { getPathname } = await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');

      await fireEvent.press(sendButton());

      await waitFor(() => expect(screen.getByText(SEND_ERROR)).toBeTruthy());
      expect(announce).toHaveBeenCalledWith(SEND_ERROR);
      expect(screen.getByText(SEND_ERROR)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(JSON.stringify(screen.toJSON())).not.toContain('evil.example');
      expect(JSON.stringify(screen.toJSON())).not.toContain(ATTACKER_TEXT);
      expect(getPathname()).toBe('/email');
      // Usable again: the typed address is kept and the button is not stuck loading.
      expect(field().props.value).toBe('kacper@example.com');
      expect(sendButton()).toBeEnabled();
      expect(sendButton()).not.toBeBusy();
    });

    it('unlocks the field after a failed send, and a retry sends again (D19)', async () => {
      const send = holdSend();
      await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');
      await fireEvent.press(sendButton());
      await waitFor(() => expect(field().props.editable).toBe(false));

      await act(async () => send.fail(new Error('x')));

      await waitFor(() => expect(screen.getByText(SEND_ERROR)).toBeTruthy());
      expect(field().props.editable).not.toBe(false);
      await fireEvent.press(sendButton());
      expect(sendEmailCode).toHaveBeenCalledTimes(2);
    });

    it('is shown with an icon, not by colour alone', async () => {
      sendEmailCode.mockRejectedValue(new Error('x'));
      await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');
      await fireEvent.press(sendButton());
      await waitFor(() => expect(screen.getByText(SEND_ERROR)).toBeTruthy());
      expect(screen.getByTestId('email-send-error-icon', { includeHiddenElements: true })).toBeTruthy();
    });

    it('goes away when the user tries again', async () => {
      sendEmailCode.mockRejectedValueOnce(new Error('x'));
      const { getPathname } = await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');
      await fireEvent.press(sendButton());
      await waitFor(() => expect(screen.getByText(SEND_ERROR)).toBeTruthy());

      await fireEvent.press(sendButton());

      await waitFor(() => expect(getPathname()).toBe('/code'));
    });

    it('is in English on an English phone', async () => {
      await i18n.changeLanguage('en');
      sendEmailCode.mockRejectedValue(new Error('x'));
      await openEmailScreen();
      await fireEvent.changeText(screen.getByLabelText('E-mail address'), 'kacper@example.com');
      await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
      await waitFor(() => expect(screen.getByText("Couldn't send the code. Try again.")).toBeTruthy());
    });
  });

  describe('offline (P4)', () => {
    it('shows the offline banner and disables the button: no request', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      await openEmailScreen();
      await fireEvent.changeText(field(), 'kacper@example.com');

      expect(screen.getByTestId('offline-banner')).toBeTruthy();
      expect(field().props.value).toBe('kacper@example.com');
      expect(field().props.editable).not.toBe(false); // D18: the address can still be typed offline
      expect(sendButton()).toBeDisabled();
      await fireEvent.press(sendButton());
      await fireEvent(field(), 'submitEditing');
      expect(sendEmailCode).not.toHaveBeenCalled();
    });

    it('shows no banner while online', async () => {
      await openEmailScreen();
      expect(screen.queryByTestId('offline-banner')).toBeNull();
    });

    it('enables the button again when the connection returns', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      await openEmailScreen();
      await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
      expect(sendButton()).toBeEnabled();
      expect(screen.queryByTestId('offline-banner')).toBeNull();
    });
  });

  describe('layout and keyboard', () => {
    // How the frame moves with the keyboard (KeyboardAvoidingView) is checked on a device: Jest has no keyboard.
    it('pins "Wyślij kod" below the scrolling content, which keeps taps working while the keyboard is open', async () => {
      await openEmailScreen();
      expect(screen.getByTestId('email-screen-scroll').props.keyboardShouldPersistTaps).toBe('handled');
      // The field scrolls; the button is outside the scroll view, so it stays above the keyboard.
      expect(within(screen.getByTestId('email-screen-scroll')).getByLabelText(EMAIL_LABEL)).toBeTruthy();
      expect(within(screen.getByTestId('email-screen-scroll')).queryByRole('button', { name: SEND })).toBeNull();
    });

    it('uses the theme background', async () => {
      await openEmailScreen();
      expect(screen.getByTestId('email-screen')).toHaveStyle({ backgroundColor: lightTheme.colors.background });
    });
  });
});
