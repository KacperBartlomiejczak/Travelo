import type { SessionChange, SessionSnapshot, SessionSource } from '@/data/session-source';

import { SIGNED_IN_USER_ID } from './fake-supabase';

type Listener = (change: SessionChange) => void;

/**
 * A session the test drives (auth-onboarding step 5): what `current()` answers, when the clear finishes or fails, and
 * sign-ins / sign-outs that happen later. `log` records the calls in order, as `current`, `check`, `clear:start`, `clear:done`, `clear:failed`.
 */
export function createFakeSessionSource(initial: SessionSnapshot | Error = { status: 'signedIn', userId: SIGNED_IN_USER_ID }) {
  const listeners = new Set<Listener>();
  const log: string[] = [];
  let answer: SessionSnapshot | Error = initial;
  let clearFailure: Error | null = null;
  let held: Promise<void> | null = null;
  let currentHeld: Promise<void> | null = null;
  let checkHeld: Promise<void> | null = null;

  const current = jest.fn(async () => {
    log.push('current');
    await Promise.resolve();
    await currentHeld;
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const checkStoredSession = jest.fn(async () => {
    log.push('check');
    await Promise.resolve();
    await checkHeld;
  });
  const clearUserData = jest.fn(async () => {
    log.push('clear:start');
    await Promise.resolve();
    await held;
    if (clearFailure) {
      log.push('clear:failed');
      throw clearFailure;
    }
    log.push('clear:done');
  });
  const source: SessionSource = {
    current,
    checkStoredSession,
    clearUserData,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    source,
    current,
    checkStoredSession,
    clearUserData,
    log,
    /** What `current()` answers from now on; an `Error` makes it reject. */
    answerWith(next: SessionSnapshot | Error) {
      answer = next;
    },
    /** Makes `clearUserData` reject (null: succeed again). */
    failClear(error: Error | null) {
      clearFailure = error;
    },
    /** Makes `current()` wait until the returned function is called (what it answers is read then). */
    holdCurrent(): () => void {
      let release = () => {};
      currentHeld = new Promise<void>((resolve) => {
        release = () => {
          currentHeld = null;
          resolve();
        };
      });
      return release;
    },
    /** Makes `checkStoredSession()` wait until the returned function is called (the gate must not wait for it). */
    holdCheck(): () => void {
      let release = () => {};
      checkHeld = new Promise<void>((resolve) => {
        release = () => {
          checkHeld = null;
          resolve();
        };
      });
      return release;
    },
    /** Makes `clearUserData` wait until the returned function is called. */
    holdClear(): () => void {
      let release = () => {};
      held = new Promise<void>((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
      return release;
    },
    /** A sign-in or sign-out that happens while the app runs. */
    emit(change: SessionChange) {
      [...listeners].forEach((listener) => listener(change));
    },
    listenerCount: () => listeners.size,
  };
}

export type FakeSession = ReturnType<typeof createFakeSessionSource>;

let active: FakeSession = createFakeSessionSource();

/** The session the whole app sees in tests (`@/data/app-session-source` is mocked with this, see jest.setup.ts). Signed in unless a test says otherwise. */
export function useFakeAppSession(initial?: SessionSnapshot | Error): FakeSession {
  active = createFakeSessionSource(initial);
  return active;
}

export function resetFakeAppSession() {
  active = createFakeSessionSource();
}

/** What the mocked `appSessionSource` delegates to: always the current fake, so a test can replace it before rendering. */
export const delegatingSessionSource: SessionSource = {
  current: () => active.source.current(),
  checkStoredSession: () => active.source.checkStoredSession(),
  onChange: (listener) => active.source.onChange(listener),
  clearUserData: () => active.source.clearUserData(),
};
