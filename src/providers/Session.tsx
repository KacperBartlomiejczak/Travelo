import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { startNewUserEpoch } from '@/data/local-store';
import type { SessionChange, SessionSource } from '@/data/session-source';

import { useRequestBudgetSync } from './BudgetSync';

/**
 * Who is using the app (auth-onboarding step 5):
 * - `loading` — the session is being read, or the user data of the previous user is being forgotten;
 * - `signedOut` — nobody is signed in AND the user data on the phone has been cleared (D14);
 * - `signedIn` — `userId` is null when a session is stored but cannot be read now (offline start);
 * - `error` — the session could not be read, or the clear failed. `retry` tries again. Never shown as signed out.
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string | null }
  | { status: 'error' };

type SessionContextValue = { state: SessionState; retry: () => void };

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside AppProviders');
  return value;
}

type Props = { source: SessionSource; children: ReactNode };

const LOADING: SessionState = { status: 'loading' };

/**
 * Holds the session for the whole app and keeps the phone free of other users' data: whenever the app becomes signed out
 * (at launch without a session, or when the session ends later) the local user data is cleared first, then the in-memory
 * caches are dropped, and only then does `signedOut` show (D14). A sign-in after that starts from nothing.
 * It always renders its children; the gate in the root layout decides what to show for each state.
 */
export function SessionProvider({ source, children }: Props) {
  const queryClient = useQueryClient();
  const requestBudgetSync = useRequestBudgetSync();
  const [state, setState] = useState<SessionState>(LOADING);
  // Handlers run outside of renders: they read the latest state and helpers through refs.
  const current = useRef<SessionState>(LOADING);
  const latestSync = useRef(requestBudgetSync);
  // Every start, retry or change takes a new number; an older run that finishes later is dropped.
  const run = useRef(0);
  // True from the moment the phone may hold data of a user who is gone until a clear has succeeded.
  const needsClear = useRef(false);
  const clearing = useRef<Promise<void> | null>(null);

  useEffect(() => {
    latestSync.current = requestBudgetSync;
  }, [requestBudgetSync]);

  const apply = useCallback((next: SessionState) => {
    current.current = next;
    setState(next);
  }, []);

  /** One clear at a time: a second request while one runs joins it (two SQLite transactions at once would fail). */
  const clearOnce = useCallback(() => {
    clearing.current ??= source.clearUserData().finally(() => {
      clearing.current = null;
    });
    return clearing.current;
  }, [source]);

  const signedIn = useCallback(
    (userId: string | null) => {
      // The previous queries are marked stale first, so what the new user opens is read again for them.
      void queryClient.invalidateQueries();
      apply({ status: 'signedIn', userId });
      latestSync.current();
    },
    [queryClient, apply],
  );

  /** Forgets the previous user on the phone and in memory (nothing of them stays), then becomes `next`. */
  const leave = useCallback(
    async (next: 'signedOut' | { userId: string | null }) => {
      // First of all, before anything is awaited: what the previous user's operations still want to write is refused from now on.
      startNewUserEpoch();
      const mine = ++run.current;
      needsClear.current = true;
      apply(LOADING);
      try {
        await clearOnce();
      } catch {
        if (run.current === mine) apply({ status: 'error' });
        return;
      }
      if (run.current !== mine) return;
      needsClear.current = false;
      queryClient.clear();
      if (next === 'signedOut') apply({ status: 'signedOut' });
      else signedIn(next.userId);
    },
    [apply, clearOnce, queryClient, signedIn],
  );

  const start = useCallback(async () => {
    const mine = ++run.current;
    let snapshot;
    try {
      snapshot = await source.current();
    } catch {
      if (run.current === mine) apply({ status: 'error' });
      return;
    }
    if (run.current !== mine) return;
    if (snapshot.status === 'signedOut') {
      await leave('signedOut');
      return;
    }
    // A clear that failed earlier is still owed: whoever is signed in now must not inherit what is on the phone.
    if (needsClear.current) await leave({ userId: snapshot.userId });
    else apply(snapshot);
  }, [source, apply, leave]);

  const change = useCallback(
    (event: SessionChange) => {
      const now = current.current;
      if (event.type === 'signedOut') {
        if (now.status === 'signedOut') return;
        void leave('signedOut');
        return;
      }
      if (now.status === 'signedIn') {
        if (now.userId === event.userId) return;
        // Offline start, and now the user is known: it is the same person, whose session was only unreadable.
        if (now.userId === null) {
          apply({ status: 'signedIn', userId: event.userId });
          return;
        }
        // Another user without a sign-out in between: the previous one is forgotten first.
        void leave({ userId: event.userId });
        return;
      }
      // Only from signed out is the phone known to be empty (the clear finished before that state showed). From any other state
      // (still reading the session, an error, a clear running or failed) the data on it may be someone else's: clear first.
      if (now.status !== 'signedOut') {
        void leave({ userId: event.userId });
        return;
      }
      signedIn(event.userId);
    },
    [apply, leave, signedIn],
  );

  /** Drops whatever is still running (on unmount): its result must not touch the state any more. */
  const dropRunning = useCallback(() => {
    run.current++;
  }, []);

  useEffect(() => {
    const stop = source.onChange(change);
    // Reading the session is a subscription to an external system: `start` sets state only after its first await (and the state is
    // already `loading` here), but the lint rule cannot see that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
    return () => {
      stop();
      dropRunning();
    };
  }, [source, change, start, dropRunning]);

  const retry = useCallback(() => {
    apply(LOADING);
    void start();
  }, [apply, start]);
  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
