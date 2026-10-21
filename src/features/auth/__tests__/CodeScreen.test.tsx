import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo, TextInput } from 'react-native';

import { appAuth } from '@/data/app-auth';
import { InvalidCodeError } from '@/data/auth';
import { ServerUnreachableError } from '@/data/errors';
import i18n from '@/i18n';
import { headerConfigs, openCodeScreen, renderEmailFlow } from '@/test/auth-email-flow';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/legacy/theme';

// The real sign-in (Supabase) is mocked for every test by jest.setup.ts.
const sendEmailCode = jest.mocked(appAuth.sendEmailCode);
const verifyEmailCode = jest.mocked(appAuth.verifyEmailCode);

const EMAIL = 'kacper@example.com';
const CODE_LABEL = 'Kod z e-maila';
const SIGN_IN = 'Zaloguj się';
const WRONG_CODE = 'Kod jest nieprawidłowy albo wygasł.';
const SIGN_IN_ERROR = 'Nie udało się zalogować. Spróbuj ponownie.';
const SEND_ERROR = 'Nie udało się wysłać kodu. Spróbuj ponownie.';
const FORMAT_ERROR = 'Kod ma 6 cyfr.';
const ATTACKER_TEXT = 'Click here: evil.example/steal';

const field = () => screen.getByLabelText(CODE_LABEL);
const signInButton = () => screen.getByRole('button', { name: SIGN_IN });
const resendButton = () => screen.getByRole('button', { name: /^Wyślij kod ponownie/ });

/** A verification that stays open until the test finishes it. */
function holdVerify() {
  let finish: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  verifyEmailCode.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      }),
  );
  return { finish: () => finish(), fail: (error: Error) => fail(error) };
}

/** The `onPress` of a button, found the way `fireEvent.press` finds it: on the host element or on the component above it. */
function pressHandler(button: ReturnType<typeof signInButton>): () => void {
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
  verifyEmailCode.mockReset();
  verifyEmailCode.mockResolvedValue(undefined);
  // jest-expo already mocks it, so calls of earlier tests would still be counted.
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announce.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('CodeScreen (auth-onboarding D6, P3, P5, D17)', () => {
  it('shows the heading and the address the code was sent to', async () => {
    await openCodeScreen(' Kacper@Example.com ');
    expect(screen.getByRole('header', { name: 'Wpisz kod' })).toBeTruthy();
    expect(screen.getByText(`Wysłaliśmy go na ${EMAIL}.`)).toBeTruthy();
    expect(screen.queryByLabelText('Wpisz kod')).toBeNull(); // the field has its own, shorter label (D18)
    expect(signInButton()).toBeEnabled();
  });

  it('has no fixed status-bar view: it sits under a header (D24)', async () => {
    await openCodeScreen();
    expect(screen.queryByTestId('code-screen-top-inset', { includeHiddenElements: true })).toBeNull();
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await openCodeScreen();
    // The e-mail screen was opened in Polish above; the field label differs by language.
    expect(screen.getByRole('header', { name: 'Enter the code' })).toBeTruthy();
    expect(screen.getByText(`We sent it to ${EMAIL}.`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Send the code again/ })).toBeTruthy();
  });

  it('is one 6-digit field with the number keyboard and the one-time-code autofill, focused when the screen opens', async () => {
    await openCodeScreen();
    // The e-mail screen stays mounted under this one in the stack, so only this screen's inputs are counted.
    expect(screen.getByTestId('code-screen').queryAll((node) => node.type === 'TextInput')).toHaveLength(1); // one plain field, not 6 boxes
    expect(field().props.keyboardType).toBe('number-pad');
    expect(field().props.textContentType).toBe('oneTimeCode');
    expect(field().props.autoComplete).toBe('one-time-code');
    expect(field().props.maxLength).toBe(6);
    expect(field().props.autoFocus).toBe(true);
  });

  describe('back', () => {
    it('has a native header with a "Wstecz" back button, and goes back to the e-mail screen', async () => {
      const { container, getPathname } = await openCodeScreen();
      const visible = headerConfigs(container).filter((node) => !node.props.hidden);
      expect(visible.at(-1)?.props.backTitle).toBe('Wstecz');

      // Pressing native header items does not reach the router in Jest: leaving is driven with router.back().
      await act(async () => router.back());

      await waitFor(() => expect(getPathname()).toBe('/email'));
    });
  });

  describe('typing', () => {
    it('ignores everything that is not a digit as it is typed', async () => {
      await openCodeScreen();
      await fireEvent.changeText(field(), 'ab1c2-3 ');
      expect(field().props.value).toBe('123');
      expect(verifyEmailCode).not.toHaveBeenCalled();
    });

    it('does not verify before the 6th digit', async () => {
      await openCodeScreen();
      await fireEvent.changeText(field(), '12345');
      expect(verifyEmailCode).not.toHaveBeenCalled();
    });

    it('verifies once, as soon as the 6th digit is typed, with the address and the code', async () => {
      await openCodeScreen();
      await fireEvent.changeText(field(), '12345');
      await fireEvent.changeText(field(), '123456');

      await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledTimes(1));
      expect(verifyEmailCode).toHaveBeenCalledWith({ email: EMAIL, code: '123456' });
    });

    it('verifies a code pasted or autofilled in one go, spaces and all', async () => {
      await openCodeScreen();
      await fireEvent.changeText(field(), '123 456');
      await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledWith({ email: EMAIL, code: '123456' }));
    });
  });

  describe('"Zaloguj się" (a retry, and for a code that is not complete yet)', () => {
    it('with fewer than 6 digits: the format error on the field, announced, no request', async () => {
      await openCodeScreen();
      await fireEvent.changeText(field(), '123');

      await fireEvent.press(signInButton());

      expect(screen.getByText(FORMAT_ERROR)).toBeTruthy();
      expect(field().props.accessibilityHint).toBe(FORMAT_ERROR);
      expect(field()).toHaveStyle({ borderWidth: 2, borderColor: lightTheme.colors.status.error });
      expect(announce).toHaveBeenCalledWith(FORMAT_ERROR);
      expect(verifyEmailCode).not.toHaveBeenCalled();
    });

    it('the format error goes away when the user types again', async () => {
      await openCodeScreen();
      await fireEvent.changeText(field(), '123');
      await fireEvent.press(signInButton());
      expect(screen.getByText(FORMAT_ERROR)).toBeTruthy();

      await fireEvent.changeText(field(), '1234');

      expect(screen.queryByText(FORMAT_ERROR)).toBeNull();
    });

    it('with an empty field gives the format error too', async () => {
      await openCodeScreen();
      await fireEvent.press(signInButton());
      expect(screen.getByText(FORMAT_ERROR)).toBeTruthy();
      expect(verifyEmailCode).not.toHaveBeenCalled();
    });

    it('is in English on an English phone', async () => {
      await i18n.changeLanguage('en');
      await openCodeScreen();
      await fireEvent.changeText(screen.getByLabelText('Code from the e-mail'), '123');
      await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
      expect(screen.getByText('The code has 6 digits.')).toBeTruthy();
    });
  });

  describe('while verifying', () => {
    it('shows loading, disables the field and both buttons, and ignores a second submit', async () => {
      holdVerify();
      await openCodeScreen();
      await fireEvent.changeText(field(), '123456');

      await waitFor(() => expect(signInButton()).toBeBusy());
      expect(screen.getByTestId('primary-button-spinner')).toBeTruthy();
      expect(field().props.editable).toBe(false);
      expect(resendButton()).toBeDisabled();

      await fireEvent.press(signInButton());
      await fireEvent.press(resendButton());
      await fireEvent.changeText(field(), '654321');
      await fireEvent(field(), 'submitEditing');
      expect(verifyEmailCode).toHaveBeenCalledTimes(1);
      expect(sendEmailCode).toHaveBeenCalledTimes(1); // only the first send, from the e-mail screen
    });

    it('two taps on "Zaloguj się" in the same moment verify only once', async () => {
      verifyEmailCode.mockRejectedValueOnce(new InvalidCodeError('x'));
      await openCodeScreen();
      await fireEvent.changeText(field(), '123456');
      await waitFor(() => expect(screen.getByText(WRONG_CODE)).toBeTruthy());
      holdVerify();

      // Both taps run before React renders the loading state, so the press handler itself is called twice inside one act
      // (two awaited fireEvent.press calls would render in between, and overlapping them is not supported).
      const onPress = pressHandler(signInButton());
      await act(async () => {
        onPress();
        onPress();
      });

      expect(verifyEmailCode).toHaveBeenCalledTimes(2); // the wrong code, then one retry
    });
  });

  describe('a wrong or expired code', () => {
    it('shows the error on the field and announces it, keeps the digits and focuses the field to correct them', async () => {
      verifyEmailCode.mockRejectedValue(new InvalidCodeError(ATTACKER_TEXT));
      await openCodeScreen();
      const focus = jest.spyOn(TextInput.prototype, 'focus');
      focus.mockClear();

      await fireEvent.changeText(field(), '123456');

      await waitFor(() => expect(screen.getByText(WRONG_CODE)).toBeTruthy());
      expect(field().props.accessibilityHint).toBe(WRONG_CODE);
      expect(field()).toHaveStyle({ borderWidth: 2, borderColor: lightTheme.colors.status.error });
      expect(screen.getByText(WRONG_CODE)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(announce).toHaveBeenCalledWith(WRONG_CODE);
      expect(field().props.value).toBe('123456');
      expect(field().props.editable).not.toBe(false);
      expect(focus).toHaveBeenCalled();
      expect(JSON.stringify(screen.toJSON())).not.toContain('evil.example');
      expect(signInButton()).toBeEnabled();
      expect(signInButton()).not.toBeBusy();
    });

    it('allows a retry with "Zaloguj się" and shows no error while it runs', async () => {
      verifyEmailCode.mockRejectedValueOnce(new InvalidCodeError('x'));
      await openCodeScreen();
      await fireEvent.changeText(field(), '123456');
      await waitFor(() => expect(screen.getByText(WRONG_CODE)).toBeTruthy());

      holdVerify();
      await fireEvent.press(signInButton());

      await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledTimes(2));
      expect(verifyEmailCode).toHaveBeenLastCalledWith({ email: EMAIL, code: '123456' });
      await waitFor(() => expect(screen.queryByText(WRONG_CODE)).toBeNull());
      expect(signInButton()).toBeBusy();
    });

    it('the error goes away when the user edits the digits, and the 6th digit then verifies again', async () => {
      verifyEmailCode.mockRejectedValueOnce(new InvalidCodeError('x'));
      await openCodeScreen();
      await fireEvent.changeText(field(), '123456');
      await waitFor(() => expect(screen.getByText(WRONG_CODE)).toBeTruthy());

      await fireEvent.changeText(field(), '12345');
      expect(screen.queryByText(WRONG_CODE)).toBeNull();
      await fireEvent.changeText(field(), '123450');

      await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledTimes(2));
      expect(verifyEmailCode).toHaveBeenLastCalledWith({ email: EMAIL, code: '123450' });
    });

    it('is in English on an English phone', async () => {
      await i18n.changeLanguage('en');
      verifyEmailCode.mockRejectedValue(new InvalidCodeError('x'));
      await openCodeScreen();
      await fireEvent.changeText(screen.getByLabelText('Code from the e-mail'), '123456');
      await waitFor(() => expect(screen.getByText('The code is wrong or has expired.')).toBeTruthy());
    });
  });

  describe('any other verify error: fixed copy, never the error text', () => {
    it.each([
      ['an unreachable server', () => new ServerUnreachableError(ATTACKER_TEXT)],
      ['an error carrying attacker text', () => new Error(ATTACKER_TEXT)],
      ['a rate limit', () => Object.assign(new Error(ATTACKER_TEXT), { code: 'over_request_rate_limit' })],
    ])('%s', async (_name, makeError) => {
      verifyEmailCode.mockRejectedValue(makeError());
      await openCodeScreen();

      await fireEvent.changeText(field(), '123456');

      await waitFor(() => expect(screen.getByText(SIGN_IN_ERROR)).toBeTruthy());
      expect(announce).toHaveBeenCalledWith(SIGN_IN_ERROR);
      expect(screen.getByText(SIGN_IN_ERROR)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(screen.queryByText(WRONG_CODE)).toBeNull();
      expect(JSON.stringify(screen.toJSON())).not.toContain('evil.example');
      expect(JSON.stringify(screen.toJSON())).not.toContain(ATTACKER_TEXT);
      expect(field().props.value).toBe('123456');
      expect(signInButton()).toBeEnabled();
      expect(signInButton()).not.toBeBusy();
      expect(screen.getByTestId('code-error-icon', { includeHiddenElements: true })).toBeTruthy();
    });

    it('is in English on an English phone', async () => {
      await i18n.changeLanguage('en');
      verifyEmailCode.mockRejectedValue(new Error('x'));
      await openCodeScreen();
      await fireEvent.changeText(screen.getByLabelText('Code from the e-mail'), '123456');
      await waitFor(() => expect(screen.getByText("Couldn't sign in. Try again.")).toBeTruthy());
    });
  });

  describe('success', () => {
    it('does not navigate by itself (the gate moves the app on) and stays busy, so nothing can be sent twice', async () => {
      const { getPathname } = await openCodeScreen();

      await fireEvent.changeText(field(), '123456');
      await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledTimes(1));
      await act(async () => {});

      expect(getPathname()).toBe('/code');
      expect(screen.getByTestId('code-screen')).toBeTruthy();
      expect(screen.queryByText(WRONG_CODE)).toBeNull();
      expect(screen.queryByText(SIGN_IN_ERROR)).toBeNull();
      expect(signInButton()).toBeBusy();
      await fireEvent.press(signInButton());
      expect(verifyEmailCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('resend (P3)', () => {
    beforeEach(() => jest.useFakeTimers());

    it('is disabled for 60 s with a m:ss countdown, then enabled', async () => {
      await openCodeScreen();
      expect(resendButton()).toBeDisabled();
      expect(screen.getByText('Wyślij kod ponownie (1:00)')).toBeTruthy();

      await act(async () => jest.advanceTimersByTime(18_000));
      expect(screen.getByText('Wyślij kod ponownie (0:42)')).toBeTruthy();
      expect(resendButton()).toBeDisabled();
      await fireEvent.press(resendButton());
      expect(sendEmailCode).toHaveBeenCalledTimes(1);

      await act(async () => jest.advanceTimersByTime(41_000));
      expect(screen.getByText('Wyślij kod ponownie (0:01)')).toBeTruthy();
      expect(resendButton()).toBeDisabled();

      await act(async () => jest.advanceTimersByTime(1_000));
      expect(screen.getByText('Wyślij kod ponownie')).toBeTruthy();
      expect(resendButton()).toBeEnabled();
    });

    it('sends the same address again, then starts the countdown again', async () => {
      await openCodeScreen();
      await act(async () => jest.advanceTimersByTime(60_000));

      await fireEvent.press(resendButton());

      expect(sendEmailCode).toHaveBeenCalledTimes(2);
      expect(sendEmailCode).toHaveBeenLastCalledWith({ email: EMAIL });
      await waitFor(() => expect(screen.getByText('Wyślij kod ponownie (1:00)')).toBeTruthy());
      expect(resendButton()).toBeDisabled();
      await act(async () => jest.advanceTimersByTime(60_000));
      expect(resendButton()).toBeEnabled();
    });

    it('is not pressable twice while the code is being sent', async () => {
      await openCodeScreen();
      await act(async () => jest.advanceTimersByTime(60_000));
      let finish: () => void = () => {};
      sendEmailCode.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));

      await fireEvent.press(resendButton());
      // The query client hands its state to React on a timer, which fake timers hold back.
      await act(async () => jest.advanceTimersByTime(1));
      await fireEvent.press(resendButton());

      expect(sendEmailCode).toHaveBeenCalledTimes(2); // the e-mail screen's send and one resend
      expect(resendButton()).toBeDisabled();
      await act(async () => finish());
    });

    it('a failed resend shows the send error (announced), and the button stays usable', async () => {
      await openCodeScreen();
      await act(async () => jest.advanceTimersByTime(60_000));
      sendEmailCode.mockRejectedValue(new ServerUnreachableError(ATTACKER_TEXT));

      await fireEvent.press(resendButton());

      await waitFor(() => expect(screen.getByText(SEND_ERROR)).toBeTruthy());
      expect(announce).toHaveBeenCalledWith(SEND_ERROR);
      expect(JSON.stringify(screen.toJSON())).not.toContain('evil.example');
      expect(resendButton()).toBeEnabled(); // no new code went out, so no new wait
      expect(screen.getByText('Wyślij kod ponownie')).toBeTruthy();
    });

    it('a successful resend clears the typed digits and the wrong-code error', async () => {
      verifyEmailCode.mockRejectedValueOnce(new InvalidCodeError('x'));
      await openCodeScreen();
      await fireEvent.changeText(field(), '123456');
      await waitFor(() => expect(screen.getByText(WRONG_CODE)).toBeTruthy());
      await act(async () => jest.advanceTimersByTime(60_000));

      await fireEvent.press(resendButton());

      await waitFor(() => expect(sendEmailCode).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText(WRONG_CODE)).toBeNull());
      expect(field().props.value).toBe('');
      expect(field().props.accessibilityHint).not.toBe(WRONG_CODE);
    });

    it('a failed resend keeps what was typed', async () => {
      verifyEmailCode.mockRejectedValueOnce(new InvalidCodeError('x'));
      await openCodeScreen();
      await fireEvent.changeText(field(), '123456');
      await waitFor(() => expect(screen.getByText(WRONG_CODE)).toBeTruthy());
      await act(async () => jest.advanceTimersByTime(60_000));
      sendEmailCode.mockRejectedValue(new Error('x'));

      await fireEvent.press(resendButton());

      await waitFor(() => expect(screen.getByText(SEND_ERROR)).toBeTruthy());
      expect(field().props.value).toBe('123456');
    });

    it('the send error goes away when the resend works', async () => {
      await openCodeScreen();
      await act(async () => jest.advanceTimersByTime(60_000));
      sendEmailCode.mockRejectedValueOnce(new Error('x'));
      await fireEvent.press(resendButton());
      await waitFor(() => expect(screen.getByText(SEND_ERROR)).toBeTruthy());

      await fireEvent.press(resendButton());

      await waitFor(() => expect(screen.queryByText(SEND_ERROR)).toBeNull());
    });

    it('does not read the seconds out every second: the accessible name changes at most every 10 s', async () => {
      await openCodeScreen();
      const names = new Set<string>();
      for (let second = 0; second < 60; second += 1) {
        names.add(String(resendButton().props.accessibilityLabel));
        await act(async () => jest.advanceTimersByTime(1_000));
      }
      expect(names.size).toBeLessThanOrEqual(6);
      expect(resendButton().props.accessibilityLabel).toBe('Wyślij kod ponownie');
      expect([...names]).toContain('Wyślij kod ponownie, za 60 sekund');
      expect([...names]).toContain('Wyślij kod ponownie, za 10 sekund');
    });

    it('counts in English too', async () => {
      await i18n.changeLanguage('en');
      await openCodeScreen();
      expect(screen.getByText('Send the code again (1:00)')).toBeTruthy();
      await act(async () => jest.advanceTimersByTime(60_000));
      expect(screen.getByText('Send the code again')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Send the code again' })).toBeEnabled();
    });
  });

  describe('offline (P4)', () => {
    it('shows the offline banner and disables everything: the field and both buttons', async () => {
      await openCodeScreen();
      await act(async () => setNetwork({ isConnected: false, isInternetReachable: false }));

      expect(screen.getByTestId('offline-banner')).toBeTruthy();
      expect(field().props.editable).toBe(false);
      expect(signInButton()).toBeDisabled();
      expect(resendButton()).toBeDisabled();
      await fireEvent.press(signInButton());
      expect(verifyEmailCode).not.toHaveBeenCalled();
    });

    it('enables them again when the connection returns', async () => {
      jest.useFakeTimers();
      await openCodeScreen();
      await act(async () => jest.advanceTimersByTime(60_000));
      await act(async () => setNetwork({ isConnected: false, isInternetReachable: false }));
      expect(resendButton()).toBeDisabled();

      await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));

      expect(screen.queryByTestId('offline-banner')).toBeNull();
      expect(field().props.editable).not.toBe(false);
      expect(signInButton()).toBeEnabled();
      expect(resendButton()).toBeEnabled();
    });
  });

  describe('no address (D17)', () => {
    it('opened directly, e.g. by a deep link: redirects to the e-mail screen', async () => {
      const rendered = renderEmailFlow('/code');
      await rendered;

      await waitFor(() => expect(rendered.getPathname()).toBe('/email'));
      expect(screen.getByTestId('email-screen')).toBeTruthy();
      expect(screen.queryByTestId('code-screen')).toBeNull();
    });
  });

  describe('layout and keyboard', () => {
    // How the frame moves with the keyboard (KeyboardAvoidingView) is checked on a device: Jest has no keyboard.
    it('pins both buttons below the scrolling content, which keeps taps working while the keyboard is open', async () => {
      await openCodeScreen();
      expect(screen.getByTestId('code-screen-scroll').props.keyboardShouldPersistTaps).toBe('handled');
      expect(within(screen.getByTestId('code-screen-scroll')).getByLabelText(CODE_LABEL)).toBeTruthy();
      expect(within(screen.getByTestId('code-screen-scroll')).queryByRole('button', { name: SIGN_IN })).toBeNull();
      expect(within(screen.getByTestId('code-screen-scroll')).queryByRole('button', { name: /^Wyślij kod ponownie/ })).toBeNull();
    });
  });
});
