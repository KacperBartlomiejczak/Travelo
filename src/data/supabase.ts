import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SupabaseConfigSchema, type SupabaseConfig } from '@/schemas';

import { keepSessionFresh } from './auth';
import { REQUEST_TIMEOUT_MS, withTimeout } from './fetch-timeout';
import { installWebCrypto } from './web-crypto';

const ENV_NAMES: Record<keyof SupabaseConfig, string> = {
  url: 'EXPO_PUBLIC_SUPABASE_URL',
  key: 'EXPO_PUBLIC_SUPABASE_KEY',
};

// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` access.
const config = SupabaseConfigSchema.safeParse({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_KEY,
});

if (!config.success) {
  const names = config.error.issues.map((issue) => ENV_NAMES[issue.path[0] as keyof SupabaseConfig]);
  throw new Error(`Invalid Supabase env variables: ${names.join(', ')}`);
}

// Same spirit as the URL polyfill above: the PKCE challenge needs SHA-256, which Hermes lacks (pkce-sha256).
installWebCrypto();

/**
 * The app's only Supabase client. The auth session is kept in SQLite-backed localStorage. Every request
 * (database, RPC, auth) gives up after 20 s, so a silent network ends as "unreachable" instead of hanging.
 */
export const supabase = createClient(config.data.url, config.data.key, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // OAuth returns a one-time code, never tokens (auth-onboarding); the PKCE verifier is kept in the same storage.
    flowType: 'pkce',
  },
  global: { fetch: withTimeout(fetch, REQUEST_TIMEOUT_MS) },
});

/**
 * A second client that only asks the server whether the stored session is still valid (coderabbit-pr21-fixes A1). `getUser(jwt)` makes
 * auth-js remove whatever session its own client holds when the answer is `session_not_found`, so this client holds none and persists none:
 * it can never remove the app client's session. The app decides about the sign-out itself (session-source). No token refresh runs on it.
 */
export const sessionCheckSupabase = createClient(config.data.url, config.data.key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    // A key of its own, so the two clients never share storage or look like one client to auth-js.
    storageKey: 'travelo-session-check',
  },
  global: { fetch: withTimeout(fetch, REQUEST_TIMEOUT_MS) },
});

// Supabase React Native guidance: refresh the token only while the app is in the foreground, with the listener registered once, here
// next to the client (auth-onboarding D22). The browser handles it on web.
if (Platform.OS !== 'web') keepSessionFresh(supabase.auth, AppState);
