import { isAuthRetryableFetchError, type AuthError, type SupabaseClient } from '@supabase/supabase-js';
import type { AppStateStatus, NativeEventSubscription } from 'react-native';

import { EmailCodeInputSchema, EmailSignInInputSchema, type EmailCodeInput, type EmailSignInInput } from '@/schemas';

import { ServerUnreachableError } from './errors';

type Auth = SupabaseClient['auth'];

export type SessionAuth = Pick<Auth, 'getSession' | 'signOut' | 'startAutoRefresh' | 'stopAutoRefresh'>;
export type SignInAuth = Pick<Auth, 'signInWithOAuth' | 'exchangeCodeForSession' | 'signInWithOtp' | 'verifyOtp'>;

/** Nobody is signed in on this phone (the app never signs in by itself, auth-onboarding D2). */
export class NotSignedInError extends Error {}
/** Sign-in methods that open the provider's page in the system browser (auth-onboarding D1, D13). A code constant, not stored data. */
export const OAUTH_PROVIDERS = ['google', 'discord'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * The browser sign-in came back without a usable result (an error from the provider, or no code). Cancelling is not an error.
 * The screen shows fixed text for `provider`, never `message`.
 */
export class OAuthSignInError extends Error {
  constructor(
    readonly provider: OAuthProvider,
    message: string,
  ) {
    super(message);
  }
}
/** The e-mail code is wrong or expired. */
export class InvalidCodeError extends Error {}

/** A lack of connection becomes `ServerUnreachableError`; any other Supabase error is rethrown as it is, with its `code`. */
function authFailure(error: AuthError): Error {
  return isAuthRetryableFetchError(error) ? new ServerUnreachableError(error.message) : error;
}

/** The signed-in user's id. Throws `NotSignedInError` when there is no session; it never signs in. */
export async function ensureSession(auth: SessionAuth): Promise<string> {
  const stored = await auth.getSession();
  if (stored.error) throw stored.error;
  if (!stored.data.session) throw new NotSignedInError('Not signed in');
  return stored.data.session.user.id;
}

/**
 * Signs an anonymous session left on the phone out, on this device only (auth-onboarding D2).
 * Returns true when it did, false when there was nothing to drop.
 */
export async function dropAnonymousSession(auth: SessionAuth): Promise<boolean> {
  const stored = await auth.getSession();
  if (stored.error) throw stored.error;
  if (stored.data.session?.user.is_anonymous !== true) return false;
  const { error } = await auth.signOut({ scope: 'local' });
  if (error) throw error;
  return true;
}

/** What `expo-web-browser`'s `openAuthSessionAsync` answers: `{ type: 'success', url }`, or just a `type` (cancel, dismiss, ...). */
type AuthBrowserResult = { type: string; url?: string };

export type OAuthSignInDeps = {
  auth: Pick<SignInAuth, 'signInWithOAuth' | 'exchangeCodeForSession'>;
  openAuthSession: (url: string, redirectTo: string) => Promise<AuthBrowserResult>;
  /** Where the provider sends the user back to the app, e.g. `traveling://auth/callback`; must be on Supabase's redirect allow list. */
  redirectTo: string;
};

/** The one-time code in the address the browser returned; throws `OAuthSignInError` when it carries an error or no code. */
function codeFromRedirect(provider: OAuthProvider, returned: string | undefined): string {
  if (typeof returned !== 'string') throw new OAuthSignInError(provider, 'Sign-in returned no address');
  let url: URL;
  try {
    url = new URL(returned);
  } catch {
    throw new OAuthSignInError(provider, 'Sign-in returned an invalid address');
  }
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const failure = url.searchParams.get('error') ?? fragment.get('error');
  if (failure !== null) {
    throw new OAuthSignInError(provider, url.searchParams.get('error_description') ?? fragment.get('error_description') ?? failure);
  }
  const code = url.searchParams.get('code');
  if (!code) throw new OAuthSignInError(provider, 'Sign-in returned no code');
  return code;
}

/**
 * Sign in with Google or Discord in the system browser (Supabase "native mobile deep linking", PKCE flow): Supabase gives the provider's
 * address, the browser returns to the app with a one-time `code`, and the code is exchanged for a session.
 * Resolves 'cancelled' when the user closes the browser.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
  { auth, openAuthSession, redirectTo }: OAuthSignInDeps,
): Promise<'signed-in' | 'cancelled'> {
  const started = await auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (started.error) throw authFailure(started.error);

  const result = await openAuthSession(started.data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return 'cancelled';
  if (result.type !== 'success') throw new OAuthSignInError(provider, `Sign-in ended with "${result.type}"`);

  const exchanged = await auth.exchangeCodeForSession(codeFromRedirect(provider, result.url));
  if (exchanged.error) throw authFailure(exchanged.error);
  return 'signed-in';
}

/** Sends a 6-digit sign-in code to the e-mail; the account is created on first use. Throws `ZodError` for an invalid e-mail. */
export async function sendEmailCode(auth: Pick<SignInAuth, 'signInWithOtp'>, input: EmailSignInInput): Promise<void> {
  const { email } = EmailSignInInputSchema.parse(input);
  const { error } = await auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw authFailure(error);
}

/** GoTrue answers 403 `otp_expired` ("Token has expired or is invalid") for an expired or a wrong code. */
const INVALID_CODE = 'otp_expired';

/** Signs in with the code from the e-mail. Throws `ZodError` for an invalid e-mail or code, `InvalidCodeError` for a wrong or expired code. */
export async function verifyEmailCode(auth: Pick<SignInAuth, 'verifyOtp'>, input: EmailCodeInput): Promise<void> {
  const { email, code } = EmailCodeInputSchema.parse(input);
  const { data, error } = await auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error.code === INVALID_CODE ? new InvalidCodeError(error.message) : authFailure(error);
  if (!data.session) throw new Error('Verifying the code returned no session');
}

type AppStateSource = {
  addEventListener: (type: 'change', listener: (state: AppStateStatus) => void) => Pick<NativeEventSubscription, 'remove'>;
};

/** Refreshes the token only while the app is in the foreground (Supabase React Native guidance). Returns a dispose function. */
export function keepSessionFresh(auth: SessionAuth, appState: AppStateSource): () => void {
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') void auth.startAutoRefresh();
    else void auth.stopAutoRefresh();
  });
  return () => subscription.remove();
}
