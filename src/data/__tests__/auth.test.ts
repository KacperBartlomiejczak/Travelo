import type { AppStateStatus } from 'react-native';

import { ensureSession, keepSessionFresh, type SessionAuth } from '@/data/auth';

const USER_ID = '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d';
const session = { user: { id: USER_ID } };

function fakeAuth(stored: typeof session | null = null) {
  return {
    getSession: jest.fn(async () => ({ data: { session: stored }, error: null })),
    signInAnonymously: jest.fn(async () => ({ data: { session, user: session.user }, error: null })),
    startAutoRefresh: jest.fn(async () => {}),
    stopAutoRefresh: jest.fn(async () => {}),
  };
}

const asAuth = (auth: ReturnType<typeof fakeAuth>) => auth as unknown as SessionAuth;

describe('ensureSession', () => {
  it('uses the stored session without signing in again', async () => {
    const auth = fakeAuth(session);
    await expect(ensureSession(asAuth(auth))).resolves.toBe(USER_ID);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously when there is no session (first launch, D2)', async () => {
    const auth = fakeAuth(null);
    await expect(ensureSession(asAuth(auth))).resolves.toBe(USER_ID);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('signs in only once when several requests start at the same time', async () => {
    const auth = fakeAuth(null);
    await Promise.all([ensureSession(asAuth(auth)), ensureSession(asAuth(auth)), ensureSession(asAuth(auth))]);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('rejects with the sign-in error, and tries again next time', async () => {
    const auth = fakeAuth(null);
    const error = new Error('Anonymous sign-ins are disabled');
    auth.signInAnonymously.mockResolvedValueOnce({ data: { session: null, user: null }, error } as never);
    await expect(ensureSession(asAuth(auth))).rejects.toBe(error);
    await expect(ensureSession(asAuth(auth))).resolves.toBe(USER_ID);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('rejects when reading the stored session fails', async () => {
    const auth = fakeAuth(null);
    const error = new Error('storage broken');
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error } as never);
    await expect(ensureSession(asAuth(auth))).rejects.toBe(error);
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
    const auth = fakeAuth(session);
    const appState = fakeAppState();
    keepSessionFresh(asAuth(auth), appState);

    appState.emit('active');
    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    appState.emit('background');
    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it('stops listening when disposed', () => {
    const appState = fakeAppState();
    const dispose = keepSessionFresh(asAuth(fakeAuth(session)), appState);
    dispose();
    expect(appState.remove).toHaveBeenCalled();
  });
});
