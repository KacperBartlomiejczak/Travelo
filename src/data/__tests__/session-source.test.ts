import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthUnknownError, type AuthError } from '@supabase/supabase-js';

import type { SessionChange } from '@/data/session-source';
import { createSupabaseSessionSource } from '@/data/session-source';
import { fakeSupabase, SIGNED_IN_USER_ID } from '@/test/fake-supabase';

type Listener = (event: string, session: { user: { id: string; is_anonymous?: boolean } } | null) => void;

function setup() {
  const supabase = fakeSupabase();
  const clearUserData = jest.fn(async () => {});
  const unsubscribe = jest.fn();
  let listener: Listener = () => {
    throw new Error('onAuthStateChange was not subscribed to');
  };
  supabase.auth.onAuthStateChange.mockImplementation((callback: unknown) => {
    listener = callback as Listener;
    return { data: { subscription: { unsubscribe } } };
  });
  const auth = supabase.auth as unknown as Parameters<typeof createSupabaseSessionSource>[0]['auth'];
  // The isolated client that only asks the server (A1): its answers never touch the live client's stored session.
  const checkAuth = { getUser: jest.fn(async (_jwt?: string) => ({ data: { user: { id: SIGNED_IN_USER_ID } } as unknown, error: null as AuthError | null })) };
  const source = createSupabaseSessionSource({ auth, checkAuth: checkAuth as unknown as Parameters<typeof createSupabaseSessionSource>[0]['checkAuth'], clearUserData });
  return { ...supabase, checkAuth, clearUserData, unsubscribe, source, fire: (event: string, session: Parameters<Listener>[1]) => listener(event, session) };
}

const user = { id: SIGNED_IN_USER_ID, is_anonymous: false };
const offline = () => new AuthRetryableFetchError('Network request failed', 0);

describe('current()', () => {
  it('signed in: the stored user id', async () => {
    const { source } = setup();
    await expect(source.current()).resolves.toEqual({ status: 'signedIn', userId: SIGNED_IN_USER_ID });
  });

  it('no session: signed out, nothing to drop', async () => {
    const { source, auth, storedSession } = setup();
    storedSession('none');
    await expect(source.current()).resolves.toEqual({ status: 'signedOut' });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('an anonymous session left on the phone is signed out locally, and that is signed out (D2)', async () => {
    const { source, auth, storedSession } = setup();
    storedSession('anonymous');
    await expect(source.current()).resolves.toEqual({ status: 'signedOut' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('never signs in by itself', async () => {
    const { source, auth, storedSession } = setup();
    storedSession('none');
    await source.current();
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('cannot reach Supabase (a stored session whose token cannot be refreshed offline): signed in, user unknown', async () => {
    const { source, auth } = setup();
    auth.getSession.mockResolvedValue({ data: { session: null as never }, error: offline() });
    await expect(source.current()).resolves.toEqual({ status: 'signedIn', userId: null });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('any other error is not hidden', async () => {
    const { source, auth } = setup();
    const error = new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found');
    auth.getSession.mockResolvedValue({ data: { session: null as never }, error });
    await expect(source.current()).rejects.toBe(error);
  });

  it('rejects when the anonymous session cannot be signed out (it must not be treated as a user)', async () => {
    const { source, auth, storedSession } = setup();
    storedSession('anonymous');
    const error = new Error('storage broken');
    auth.signOut.mockResolvedValueOnce({ error });
    await expect(source.current()).rejects.toBe(error);
  });
});

describe('clearUserData()', () => {
  it('forgets the user data on the phone, and passes a failure on', async () => {
    const { source, clearUserData } = setup();
    await source.clearUserData();
    expect(clearUserData).toHaveBeenCalledTimes(1);

    const failure = new Error('disk full');
    clearUserData.mockRejectedValueOnce(failure);
    await expect(source.clearUserData()).rejects.toBe(failure);
  });
});

describe('onChange()', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function subscribe() {
    const base = setup();
    const changes: SessionChange[] = [];
    const off = base.source.onChange((change) => changes.push(change));
    return { ...base, changes, off };
  }

  it('SIGNED_OUT → signedOut; SIGNED_IN → signedIn with the user id', () => {
    const { fire, changes } = subscribe();
    fire('SIGNED_OUT', null);
    fire('SIGNED_IN', { user });
    jest.runAllTimers();
    expect(changes).toEqual([{ type: 'signedOut' }, { type: 'signedIn', userId: SIGNED_IN_USER_ID }]);
  });

  it('hands the change over after the callback returned, so the listener may call Supabase (the docs warn about a deadlock otherwise)', () => {
    const { fire, changes } = subscribe();
    fire('SIGNED_IN', { user });
    expect(changes).toEqual([]);
    jest.runAllTimers();
    expect(changes).toHaveLength(1);
  });

  it('ignores a session that is anonymous', () => {
    const { fire, changes } = subscribe();
    fire('SIGNED_IN', { user: { ...user, is_anonymous: true } });
    jest.runAllTimers();
    expect(changes).toEqual([]);
  });

  it.each(['INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'])('ignores %s (the app reads the session itself)', (event) => {
    const { fire, changes } = subscribe();
    fire(event, { user });
    jest.runAllTimers();
    expect(changes).toEqual([]);
  });

  it('ignores SIGNED_IN without a session', () => {
    const { fire, changes } = subscribe();
    fire('SIGNED_IN', null);
    jest.runAllTimers();
    expect(changes).toEqual([]);
  });

  it('unsubscribes, and a change still waiting is not delivered', () => {
    const { fire, changes, off, unsubscribe } = subscribe();
    fire('SIGNED_OUT', null);
    off();
    jest.runAllTimers();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(changes).toEqual([]);
  });
});

// auth-onboarding D22 / D23: the stored session is checked once in the background. `getUser(token)` asks the server (`GET /user`) directly,
// not `getClaims()`, whose local check depends on `crypto.subtle`. It runs on an isolated client, because the library removes whatever session
// it holds when the answer is `session_not_found`; the app signs out itself, for `session_not_found` and `user_not_found`, and does nothing
// for any other answer.
describe('checkStoredSession()', () => {
  it('asks Supabase to check the stored session, once per call, about the token that is stored now', async () => {
    const { source, checkAuth } = setup();
    await source.checkStoredSession();
    expect(checkAuth.getUser).toHaveBeenCalledTimes(1);
    expect(checkAuth.getUser).toHaveBeenCalledWith('access');
  });

  it('asks on the isolated client only: the live client never answers for the check', async () => {
    const { source, auth, checkAuth } = setup();
    await source.checkStoredSession();
    expect(checkAuth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it('a valid session: nothing else happens', async () => {
    const { source, auth } = setup();
    await expect(source.checkStoredSession()).resolves.toBeUndefined();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('the user no longer exists (D23): signs out on this device only, once, so the app forgets them', async () => {
    const { source, auth, checkAuth } = setup();
    checkAuth.getUser.mockResolvedValue({ data: null, error: new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found') });
    await source.checkStoredSession();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('the session is gone on the server (session_not_found): the app signs out on this device only, once, since the isolated client cannot', async () => {
    const { source, auth, checkAuth } = setup();
    checkAuth.getUser.mockResolvedValue({ data: null, error: new AuthSessionMissingError() });
    await source.checkStoredSession();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it.each([
    ['an invalid token', new AuthApiError('invalid JWT', 401, 'bad_jwt')],
    ['an API error without a code', new AuthApiError('Forbidden', 403, undefined)],
    ['a server error', new AuthRetryableFetchError('boom', 500)],
    ['no connection or a timeout', new AuthRetryableFetchError('Network request failed', 0)],
    ['an unknown error', new AuthUnknownError('???', new Error('???'))],
  ])('%s: nothing changes, the user stays signed in', async (_name, error) => {
    const { source, auth, checkAuth } = setup();
    checkAuth.getUser.mockResolvedValue({ data: null, error });
    await expect(source.checkStoredSession()).resolves.toBeUndefined();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('a check that throws is swallowed too: nothing is shown, nobody is signed out', async () => {
    const { source, auth, checkAuth } = setup();
    checkAuth.getUser.mockRejectedValue(new Error('storage broken'));
    await expect(source.checkStoredSession()).resolves.toBeUndefined();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('a failing local sign-out is swallowed: the user stays signed in, nothing is shown', async () => {
    const { source, auth, checkAuth } = setup();
    checkAuth.getUser.mockResolvedValue({ data: null, error: new AuthApiError('gone', 403, 'user_not_found') });
    auth.signOut.mockResolvedValueOnce({ error: new Error('storage broken') });
    await expect(source.checkStoredSession()).resolves.toBeUndefined();

    auth.signOut.mockRejectedValueOnce(new Error('storage broken'));
    await expect(source.checkStoredSession()).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledTimes(2);
  });
});

// The answer comes over the network, and the session can change meanwhile: `signOut` ends whatever is stored when it runs, so the app signs
// out only the user the answer was about.
describe('checkStoredSession() — the stored session changes while the check is in flight', () => {
  const OTHER_USER_ID = '1b2c3d4e-0000-4000-8000-00000000abcd';
  const stored = (userId: string, token: string) => ({ data: { session: { access_token: token, user: { id: userId, is_anonymous: false } } as never }, error: null as Error | null });
  const answers = [
    ['user_not_found', new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found')],
    ['session_not_found', new AuthSessionMissingError()],
  ] as const;

  /** The server answers with `answer` for the token that was sent, after `meanwhile` happened on the phone. */
  function checkWhile(answer: AuthError, meanwhile: (auth: ReturnType<typeof setup>['auth']) => void) {
    const base = setup();
    base.checkAuth.getUser.mockImplementation(async () => {
      meanwhile(base.auth);
      return { data: null, error: answer };
    });
    return base;
  }

  it('checks the token that is stored, and nothing when no session is stored', async () => {
    const { source, auth, checkAuth, storedSession } = setup();
    storedSession('none');
    await source.checkStoredSession();
    expect(checkAuth.getUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('a session that cannot be read is not checked and not signed out', async () => {
    const { source, auth, checkAuth } = setup();
    auth.getSession.mockResolvedValue({ data: { session: null as never }, error: offline() });
    await source.checkStoredSession();
    expect(checkAuth.getUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  describe.each(answers)('the answer is %s', (_code, answer) => {
    it('another user signs in while the check is in flight: the answer was about the first user, so the new one is NOT signed out', async () => {
      const { source, auth, checkAuth } = checkWhile(answer, (a) => a.getSession.mockResolvedValue(stored(OTHER_USER_ID, 'access-b')));
      await source.checkStoredSession();
      expect(checkAuth.getUser).toHaveBeenCalledWith('access');
      expect(auth.signOut).not.toHaveBeenCalled();
    });

    it('the token was refreshed meanwhile (same user, new token): still signed out', async () => {
      const { source, auth } = checkWhile(answer, (a) => a.getSession.mockResolvedValue(stored(SIGNED_IN_USER_ID, 'refreshed')));
      await source.checkStoredSession();
      expect(auth.signOut).toHaveBeenCalledTimes(1);
      expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('the session was gone by the time the answer came: nothing to sign out', async () => {
      const { source, auth } = checkWhile(answer, (a) => a.getSession.mockResolvedValue({ data: { session: null as never }, error: null }));
      await source.checkStoredSession();
      expect(auth.signOut).not.toHaveBeenCalled();
    });

    it('the session cannot be read when the answer comes: swallowed, nobody is signed out', async () => {
      const { source, auth } = checkWhile(answer, (a) => a.getSession.mockResolvedValue({ data: { session: null as never }, error: offline() }));
      await expect(source.checkStoredSession()).resolves.toBeUndefined();
      expect(auth.signOut).not.toHaveBeenCalled();
    });
  });
});
