import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

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
  /** Calls the listener, outside of Supabase's own callback, whenever someone signs in or out. Returns the function that stops it. */
  onChange(listener: (change: SessionChange) => void): () => void;
  /** Forgets everything of the previous user on the phone (trip copies, chosen trip, budget changes, profile copy; D14). */
  clearUserData(): Promise<void>;
}

type Deps = {
  auth: SessionAuth & Pick<SupabaseClient['auth'], 'onAuthStateChange'>;
  clearUserData: () => Promise<void>;
};

/** The session on the app's Supabase client. */
export function createSupabaseSessionSource({ auth, clearUserData }: Deps): SessionSource {
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
  };
}
