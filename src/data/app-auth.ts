import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { EmailCodeInput, EmailSignInInput } from '@/schemas';

import { sendEmailCode, signInWithProvider, verifyEmailCode, type OAuthProvider } from './auth';
import { supabase } from './supabase';

/** Where the provider sends the user back: `traveling://auth/callback` in a dev build, `exp://.../--/auth/callback` in Expo Go. */
const redirectTo = Linking.createURL('auth/callback');

/** The app's sign-in: Google or Discord in the system browser, or an e-mail code, on the app's Supabase client. */
export const appAuth = {
  signInWithProvider: (provider: OAuthProvider) =>
    signInWithProvider(provider, { auth: supabase.auth, openAuthSession: WebBrowser.openAuthSessionAsync, redirectTo }),
  sendEmailCode: (input: EmailSignInInput) => sendEmailCode(supabase.auth, input),
  verifyEmailCode: (input: EmailCodeInput) => verifyEmailCode(supabase.auth, input),
};
