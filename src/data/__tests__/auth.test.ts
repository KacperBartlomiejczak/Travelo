import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import type { AppStateStatus } from 'react-native';
import { ZodError } from 'zod';

import {
  dropAnonymousSession,
  ensureSession,
  InvalidCodeError,
  keepSessionFresh,
  NotSignedInError,
  OAuthSignInError,
  sendEmailCode,
  signInWithProvider,
  verifyEmailCode,
  type SessionAuth,
  type SignInAuth,
} from '@/data/auth';
import { ServerUnreachableError } from '@/data/errors';
import { fakeSupabase, SIGNED_IN_USER_ID } from '@/test/fake-supabase';

function setup() {
  const supabase = fakeSupabase();
  return { ...supabase, sessionAuth: supabase.auth as unknown as SessionAuth, signInAuth: supabase.auth as unknown as SignInAuth };
}

const offline = () => new AuthRetryableFetchError('Network request failed', 0);

describe('ensureSession', () => {
  it('returns the stored user id', async () => {
    const { sessionAuth } = setup();
    await expect(ensureSession(sessionAuth)).resolves.toBe(SIGNED_IN_USER_ID);
  });

  it('throws NotSignedInError when nobody is signed in, and never signs in by itself', async () => {
    const { auth, sessionAuth, storedSession } = setup();
    storedSession('none');
    await expect(ensureSession(sessionAuth)).rejects.toBeInstanceOf(NotSignedInError);
    expect(auth).not.toHaveProperty('signInAnonymously');
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('rethrows the error when reading the stored session fails', async () => {
    const { auth, sessionAuth } = setup();
    const error = new Error('storage broken');
    auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error });
    await expect(ensureSession(sessionAuth)).rejects.toBe(error);
  });

  it('rethrows a lack of connection as it is, for the caller to turn into "unreachable"', async () => {
    const { auth, sessionAuth } = setup();
    const error = offline();
    auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error });
    await expect(ensureSession(sessionAuth)).rejects.toBe(error);
  });
});

describe('dropAnonymousSession (auth-onboarding D2)', () => {
  it('signs an anonymous session out locally and says so', async () => {
    const { auth, sessionAuth, storedSession } = setup();
    storedSession('anonymous');
    await expect(dropAnonymousSession(sessionAuth)).resolves.toBe(true);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps a normal session', async () => {
    const { auth, sessionAuth } = setup();
    await expect(dropAnonymousSession(sessionAuth)).resolves.toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('does nothing when nobody is signed in', async () => {
    const { auth, sessionAuth, storedSession } = setup();
    storedSession('none');
    await expect(dropAnonymousSession(sessionAuth)).resolves.toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('rethrows when reading the stored session fails', async () => {
    const { auth, sessionAuth } = setup();
    const error = new Error('storage broken');
    auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error });
    await expect(dropAnonymousSession(sessionAuth)).rejects.toBe(error);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('rejects when the local sign-out fails, instead of pretending the session is gone', async () => {
    const { auth, sessionAuth, storedSession } = setup();
    storedSession('anonymous');
    const error = new Error('storage broken');
    auth.signOut.mockResolvedValueOnce({ error });
    await expect(dropAnonymousSession(sessionAuth)).rejects.toBe(error);
  });
});

describe.each(['google', 'discord'] as const)('signInWithProvider(%s)', (provider) => {
  const REDIRECT_TO = 'traveling://auth/callback';
  const AUTHORIZE_URL = `https://example.supabase.co/auth/v1/authorize?provider=${provider}`;

  function providerSetup(browser: { type: string; url?: string } = { type: 'success', url: `${REDIRECT_TO}?code=the-code` }) {
    const base = setup();
    const openAuthSession = jest.fn(async (_url: string, _redirectTo: string) => browser);
    return { ...base, openAuthSession, deps: { auth: base.signInAuth, openAuthSession, redirectTo: REDIRECT_TO } };
  }

  it('starts the flow of the provider without redirecting by itself, and opens the browser on the returned address', async () => {
    const { auth, openAuthSession, deps } = providerSetup();
    auth.signInWithOAuth.mockResolvedValueOnce({ data: { provider, url: AUTHORIZE_URL }, error: null });
    await signInWithProvider(provider, deps);

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider, options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true } });
    expect(openAuthSession).toHaveBeenCalledWith(AUTHORIZE_URL, REDIRECT_TO);
  });

  it('exchanges the one-time code from the returned address for a session', async () => {
    const { auth, deps } = providerSetup();
    await expect(signInWithProvider(provider, deps)).resolves.toBe('signed-in');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('the-code');
  });

  it('works with the Expo Go style address too', async () => {
    const { auth, deps } = providerSetup({ type: 'success', url: 'exp://192.168.0.5:8081/--/auth/callback?code=expo-code' });
    await expect(signInWithProvider(provider, deps)).resolves.toBe('signed-in');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('expo-code');
  });

  it.each(['cancel', 'dismiss'])('resolves "cancelled" when the browser result is %s, and exchanges nothing', async (type) => {
    const { auth, deps } = providerSetup({ type });
    await expect(signInWithProvider(provider, deps)).resolves.toBe('cancelled');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejects with OAuthSignInError when the address carries an error, and exchanges nothing', async () => {
    const { auth, deps } = providerSetup({ type: 'success', url: `${REDIRECT_TO}?error=access_denied&error_description=User+denied+access` });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(OAuthSignInError);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('also reads an error that arrives in the fragment', async () => {
    const { auth, deps } = providerSetup({ type: 'success', url: `${REDIRECT_TO}#error=server_error&error_description=Boom` });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(OAuthSignInError);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('does not use a code that comes together with an error', async () => {
    const { auth, deps } = providerSetup({ type: 'success', url: `${REDIRECT_TO}?code=the-code&error=access_denied` });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(OAuthSignInError);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    ['has no code', REDIRECT_TO],
    ['has an empty code', `${REDIRECT_TO}?code=`],
    ['is not an address', 'not a url'],
  ])('rejects with OAuthSignInError when the returned address %s', async (_name, url) => {
    const { auth, deps } = providerSetup({ type: 'success', url });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(OAuthSignInError);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejects with OAuthSignInError when a successful browser result has no address', async () => {
    const { auth, deps } = providerSetup({ type: 'success' });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(OAuthSignInError);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejects with OAuthSignInError for a browser result it does not know', async () => {
    const { auth, deps } = providerSetup({ type: 'locked' });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(OAuthSignInError);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    ['carries an error', `${REDIRECT_TO}?error=access_denied`],
    ['has no code', REDIRECT_TO],
  ])('names the provider in the OAuthSignInError when the address %s, so the screen can show its fixed text', async (_name, url) => {
    const { deps } = providerSetup({ type: 'success', url });
    await expect(signInWithProvider(provider, deps)).rejects.toMatchObject({ provider });
  });

  it('rejects with the Supabase error when the flow cannot be started, and opens no browser', async () => {
    const { auth, openAuthSession, deps } = providerSetup();
    const error = new AuthApiError('Unsupported provider', 400, 'oauth_provider_not_supported');
    auth.signInWithOAuth.mockResolvedValueOnce({ data: { provider, url: null as never }, error });
    await expect(signInWithProvider(provider, deps)).rejects.toBe(error);
    expect(openAuthSession).not.toHaveBeenCalled();
  });

  it('rejects as unreachable when the flow cannot be started for lack of connection', async () => {
    const { auth, openAuthSession, deps } = providerSetup();
    auth.signInWithOAuth.mockResolvedValueOnce({ data: { provider, url: null as never }, error: offline() });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(openAuthSession).not.toHaveBeenCalled();
  });

  it('rejects as unreachable when the code exchange fails for lack of connection', async () => {
    const { auth, deps } = providerSetup();
    auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error: offline() });
    await expect(signInWithProvider(provider, deps)).rejects.toBeInstanceOf(ServerUnreachableError);
  });

  it('rejects with the Supabase error when the code exchange is refused', async () => {
    const { auth, deps } = providerSetup();
    const error = new AuthApiError('invalid flow state', 400, 'flow_state_not_found');
    auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error });
    await expect(signInWithProvider(provider, deps)).rejects.toBe(error);
  });

  it('rejects when the browser itself fails', async () => {
    const { openAuthSession, deps } = providerSetup();
    const error = new Error('no browser');
    openAuthSession.mockRejectedValueOnce(error);
    await expect(signInWithProvider(provider, deps)).rejects.toBe(error);
  });
});

describe('sendEmailCode', () => {
  it('rejects an invalid e-mail with a ZodError and sends nothing', async () => {
    const { auth, signInAuth } = setup();
    await expect(sendEmailCode(signInAuth, { email: 'not-an-email' })).rejects.toBeInstanceOf(ZodError);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends the code to the trimmed, lowercased address and allows a new account', async () => {
    const { auth, signInAuth } = setup();
    await sendEmailCode(signInAuth, { email: ' Kacper@Example.com ' });
    expect(auth.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'kacper@example.com', options: { shouldCreateUser: true } });
  });

  it('rejects as unreachable for lack of connection', async () => {
    const { auth, signInAuth } = setup();
    auth.signInWithOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: offline() });
    await expect(sendEmailCode(signInAuth, { email: 'kacper@example.com' })).rejects.toBeInstanceOf(ServerUnreachableError);
  });

  it('keeps the code of a rate-limit error, so the screen can tell it apart', async () => {
    const { auth, signInAuth } = setup();
    auth.signInWithOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    });
    const rejected = sendEmailCode(signInAuth, { email: 'kacper@example.com' });
    await expect(rejected).rejects.toBeInstanceOf(Error);
    await expect(rejected).rejects.toMatchObject({ message: 'Email rate limit exceeded', code: 'over_email_send_rate_limit' });
  });
});

describe('verifyEmailCode', () => {
  const input = { email: 'kacper@example.com', code: '123456' };

  it.each(['12345', '1234567', '12a456', ''])('rejects the code "%s" with a ZodError and sends nothing', async (code) => {
    const { auth, signInAuth } = setup();
    await expect(verifyEmailCode(signInAuth, { email: 'kacper@example.com', code })).rejects.toBeInstanceOf(ZodError);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects an invalid e-mail with a ZodError and sends nothing', async () => {
    const { auth, signInAuth } = setup();
    await expect(verifyEmailCode(signInAuth, { email: 'nope', code: '123456' })).rejects.toBeInstanceOf(ZodError);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('checks the code for the normalised address', async () => {
    const { auth, signInAuth } = setup();
    await verifyEmailCode(signInAuth, { email: ' Kacper@Example.com ', code: '123456' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'kacper@example.com', token: '123456', type: 'email' });
  });

  it('rejects with InvalidCodeError when the code is expired or wrong', async () => {
    const { auth, signInAuth } = setup();
    auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null as never, user: null as never },
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    });
    await expect(verifyEmailCode(signInAuth, input)).rejects.toBeInstanceOf(InvalidCodeError);
  });

  it('rejects as unreachable for lack of connection', async () => {
    const { auth, signInAuth } = setup();
    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error: offline() });
    await expect(verifyEmailCode(signInAuth, input)).rejects.toBeInstanceOf(ServerUnreachableError);
  });

  it('rejects with the Supabase error for any other refusal (e.g. too many tries)', async () => {
    const { auth, signInAuth } = setup();
    const error = new AuthApiError('Too many requests', 429, 'over_request_rate_limit');
    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error });
    await expect(verifyEmailCode(signInAuth, input)).rejects.toBe(error);
  });

  it('rejects when the answer has no session', async () => {
    const { auth, signInAuth } = setup();
    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null as never, user: null as never }, error: null });
    const rejected = verifyEmailCode(signInAuth, input);
    await expect(rejected).rejects.toThrow('no session');
    await expect(rejected).rejects.not.toBeInstanceOf(InvalidCodeError);
  });
});

describe('keepSessionFresh', () => {
  function fakeAppState() {
    let listener: (state: AppStateStatus) => void = () => {};
    const remove = jest.fn();
    return {
      addEventListener: jest.fn((_: 'change', next: (state: AppStateStatus) => void) => {
        listener = next;
        return { remove };
      }),
      emit: (state: AppStateStatus) => listener(state),
      remove,
    };
  }

  it('refreshes the token only while the app is in the foreground', () => {
    const { auth, sessionAuth } = setup();
    const appState = fakeAppState();
    keepSessionFresh(sessionAuth, appState);

    appState.emit('active');
    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    appState.emit('background');
    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it('stops listening when disposed', () => {
    const { sessionAuth } = setup();
    const appState = fakeAppState();
    const dispose = keepSessionFresh(sessionAuth, appState);
    dispose();
    expect(appState.remove).toHaveBeenCalled();
  });
});
