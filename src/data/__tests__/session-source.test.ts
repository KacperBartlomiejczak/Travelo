import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

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
  const source = createSupabaseSessionSource({ auth, clearUserData });
  return { ...supabase, clearUserData, unsubscribe, source, fire: (event: string, session: Parameters<Listener>[1]) => listener(event, session) };
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
