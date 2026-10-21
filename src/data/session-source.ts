import { isAuthRetryableFetchError, isAuthSessionMissingError, type SupabaseClient } from '@supabase/supabase-js';

import { dropAnonymousSession, ensureSession, NotSignedInError, type SessionAuth } from './auth';

/** Who is signed in on this phone. `userId` is null when a session is stored but cannot be read now (no connection to refresh its token). */
export type SessionSnapshot = { status: 'signedOut' } | { status: 'signedIn'; userId: string | null };

/** A sign-in or a sign-out that happened after the app started (a sign-in screen finished, or the session ended). */
export type SessionChange = { type: 'signedIn'; userId: string } | { type: 'signedOut' };

/** Where the app learns about the session: Supabase Auth in the app, a fake in tests (auth-onboarding step 5). */
export interface SessionSource {
  /**
   * Reads the stored session. A leftover anonymous session is signed out locally first (D2) and reads as signed out.
   * Rejects for any failure that is not "no connection" (the app then offers a retry).
   */
  current(): Promise<SessionSnapshot>;
  /**
   * Asks Supabase once whether the stored session is still valid (D22), on a client of its own that holds no session. Never rejects and never
   * shows anything: the user stays signed in for every answer except a session that is gone or a user that no longer exists (D23): both are
   * signed out on this phone here, `onChange` hears it, but only when the session stored by then still belongs to the user that was checked.
   */
  checkStoredSession(): Promise<void>;
  /** Calls the listener, outside of Supabase's own callback, whenever someone signs in or out. Returns the function that stops it. */
  onChange(listener: (change: SessionChange) => void): () => void;
  /** Forgets everything of the previous user on the phone (trip copies, chosen trip, budget changes, profile copy; D14). */
  clearUserData(): Promise<void>;
  /**
   * Signs the user out on this phone only (profile-screen A7). Does not clear anything itself: the sign-out reaches `onChange` as `signedOut`,
   * and the provider clears the phone's user data on that path (auth-onboarding D14). Rejects with the error Supabase returns.
   */
  signOut(): Promise<void>;
}

type Deps = {
  auth: SessionAuth & Pick<SupabaseClient['auth'], 'onAuthStateChange'>;
  /** An isolated client (no stored session) used only to ask the server about a token: auth-js removes the session its own client holds for `session_not_found`. */
  checkAuth: Pick<SupabaseClient['auth'], 'getUser'>;
  clearUserData: () => Promise<void>;
};

/** The session on the app's Supabase client. */
export function createSupabaseSessionSource({ auth, checkAuth, clearUserData }: Deps): SessionSource {
  return {
    async current() {
      try {
        if (await dropAnonymousSession(auth)) return { status: 'signedOut' };
        return { status: 'signedIn', userId: await ensureSession(auth) };
      } catch (error) {
        if (error instanceof NotSignedInError) return { status: 'signedOut' };
        // No session can be read without a connection only when one is stored: with none, nothing is refreshed and nothing fails.
        // The user stays signed in; the profile comes from the copy on the phone, which D14 guarantees is theirs.
        if (isAuthRetryableFetchError(error)) return { status: 'signedIn', userId: null };
        throw error;
      }
    },

    async checkStoredSession() {
      try {
        // The check is about the session stored now, by its token: the answer comes over the network, and by then someone else may be signed in.
        const checked = (await auth.getSession()).data.session;
        if (!checked) return;
        // Asks the server (`GET /user`) directly, not `getClaims`, whose local check of a JWT depends on `crypto.subtle`. It asks on the isolated client:
        // auth-js removes the session its client holds when the answer is `session_not_found`, and on the app's client that could be a newer account.
        // Every other answer (no connection, a timeout, a server error, an invalid token) changes nothing.
        const { error } = await checkAuth.getUser(checked.access_token);
        if (!error || (!isAuthSessionMissingError(error) && error.code !== 'user_not_found')) return;
        // The session or its user is gone on the server: sign out here, on this phone only.
        // `signOut` ends whatever is stored when it runs, so only when that is still the same user (a refresh changes the token, not the user).
        const now = (await auth.getSession()).data.session;
        if (now?.user.id === checked.user.id) await auth.signOut({ scope: 'local' });
      } catch {
        // A check that fails is never shown; the next start checks again.
      }
    },

    onChange(listener) {
      let active = true;
      const pending = new Set<ReturnType<typeof setTimeout>>();
      const { data } = auth.onAuthStateChange((event, session) => {
        let change: SessionChange | null = null;
        if (event === 'SIGNED_OUT') change = { type: 'signedOut' };
        else if (event === 'SIGNED_IN' && session && session.user.is_anonymous !== true) change = { type: 'signedIn', userId: session.user.id };
        if (!change) return;
        // Supabase warns against calling its client from inside this callback (it can deadlock): the listener runs after it returned.
        const timer = setTimeout(() => {
          pending.delete(timer);
          if (active && change) listener(change);
        }, 0);
        pending.add(timer);
      });
      return () => {
        active = false;
        pending.forEach(clearTimeout);
        pending.clear();
        data.subscription.unsubscribe();
      };
    },

    clearUserData,

    async signOut() {
      // `scope: 'local'` ends only this phone's session (A7). On success auth-js removes the stored session and fires SIGNED_OUT, which
      // `onChange` hands on; the clear of the phone's user data happens on that path, not here. On a failed request (no connection, a server
      // error) it ALSO removes the stored session before returning the error, so the app can end up signed out although this rejects.
      const { error } = await auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  };
}
