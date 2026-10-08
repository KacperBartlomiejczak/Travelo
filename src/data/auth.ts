import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppStateStatus, NativeEventSubscription } from 'react-native';

export type SessionAuth = Pick<SupabaseClient['auth'], 'getSession' | 'signInAnonymously' | 'startAutoRefresh' | 'stopAutoRefresh'>;

const signingIn = new WeakMap<SessionAuth, Promise<string>>();

async function signIn(auth: SessionAuth): Promise<string> {
  const stored = await auth.getSession();
  if (stored.error) throw stored.error;
  if (stored.data.session) return stored.data.session.user.id;
  const created = await auth.signInAnonymously();
  if (created.error) throw created.error;
  if (!created.data.user) throw new Error('Anonymous sign-in returned no user');
  return created.data.user.id;
}

/**
 * The signed-in user's id. Signs in anonymously on first launch (trips-supabase D2); the session is
 * kept by the Supabase client. Requests that start together share one sign-in.
 */
export function ensureSession(auth: SessionAuth): Promise<string> {
  const pending = signingIn.get(auth);
  if (pending) return pending;
  const next = signIn(auth).finally(() => signingIn.delete(auth));
  signingIn.set(auth, next);
  return next;
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
