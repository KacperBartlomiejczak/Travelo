import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthUnknownError, type AuthError } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { Text } from 'react-native';

import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { currentUserEpoch, isEpochCurrent } from '@/data/local-store';
import { createSupabaseSessionSource } from '@/data/session-source';
import { useMyProfile } from '@/hooks/useProfile';
import { useTripList } from '@/hooks/useTrips';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/providers/Session';
import { createFakeSessionSource, type FakeSession } from '@/test/fake-session-source';
import { fakeSupabase, SIGNED_IN_USER_ID } from '@/test/fake-supabase';
import { reopenUserEpoch } from '@/test/user-epoch';

const OTHER_USER_ID = '1b2c3d4e-0000-4000-8000-00000000abcd';
const signedIn = { status: 'signedIn', userId: SIGNED_IN_USER_ID } as const;
const signedOut = { status: 'signedOut' } as const;

function Probe({ log }: { log?: string[] }) {
  const { state, retry } = useSession();
  useEffect(() => {
    log?.push(`state:${state.status}`);
  }, [log, state.status]);
  return (
    <>
      <Text testID="status">{state.status}</Text>
      <Text testID="user">{state.status === 'signedIn' ? String(state.userId) : '-'}</Text>
      <Text testID="retry" onPress={retry}>
        retry
      </Text>
    </>
  );
}

type Setup = {
  fake?: FakeSession;
  trips?: TripRepository;
  profiles?: ProfileRepository;
  extra?: ReactNode;
};

async function setup({ fake = createFakeSessionSource(signedIn), trips, profiles, extra }: Setup = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  fake.log.length = 0;
  const rendered = await render(
    <AppProviders
      queryClient={queryClient}
      sessionSource={fake.source}
      tripRepository={trips ?? createInMemoryTripRepository()}
      profileRepository={profiles ?? createInMemoryProfileRepository()}
    >
      <Probe log={fake.log} />
      {extra}
    </AppProviders>,
  );
  return { ...rendered, fake, queryClient };
}

const status = () => screen.getByTestId('status');
const expectStatus = (expected: string) => waitFor(() => expect(status()).toHaveTextContent(expected));

describe('SessionProvider — start', () => {
  it('is loading until the session is read, then signed in with the user id; nothing is cleared', async () => {
    const fake = createFakeSessionSource(signedIn);
    const release = fake.holdCurrent();
    await setup({ fake });
    expect(status()).toHaveTextContent('loading');

    await act(async () => release());
    await expectStatus('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent(SIGNED_IN_USER_ID);
    expect(fake.clearUserData).not.toHaveBeenCalled();
  });

  it('no session (or a leftover anonymous one, which the source has already dropped): the user data is cleared BEFORE signed out shows', async () => {
    const fake = createFakeSessionSource(signedOut);
    await setup({ fake });
    await expectStatus('signedOut');
    expect(fake.log).toEqual(['state:loading', 'current', 'clear:start', 'clear:done', 'state:signedOut']);
  });

  it('stays loading (never signed out) while the clear is still running', async () => {
    const fake = createFakeSessionSource(signedOut);
    const release = fake.holdClear();
    await setup({ fake });
    await waitFor(() => expect(fake.clearUserData).toHaveBeenCalledTimes(1));
    expect(status()).toHaveTextContent('loading');

    await act(async () => release());
    await expectStatus('signedOut');
  });

  it('a stored session that cannot be read offline: signed in, user unknown, nothing cleared', async () => {
    const fake = createFakeSessionSource({ status: 'signedIn', userId: null });
    await setup({ fake });
    await expectStatus('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(fake.clearUserData).not.toHaveBeenCalled();
  });

  it('any other failure of reading the session: error, and a retry reads it again', async () => {
    const fake = createFakeSessionSource(new Error('storage broken'));
    await setup({ fake });
    await expectStatus('error');
    expect(fake.clearUserData).not.toHaveBeenCalled();

    fake.answerWith(signedIn);
    await act(async () => screen.getByTestId('retry').props.onPress());
    await expectStatus('signedIn');
  });

  it('the clear fails: error, never signed out over the old data; a retry clears again and then signs out', async () => {
    const fake = createFakeSessionSource(signedOut);
    fake.failClear(new Error('disk full'));
    await setup({ fake });
    await expectStatus('error');
    expect(fake.log).not.toContain('state:signedOut');

    fake.failClear(null);
    await act(async () => screen.getByTestId('retry').props.onPress());
    await expectStatus('signedOut');
    expect(fake.clearUserData).toHaveBeenCalledTimes(2);
  });

  it('subscribes to sign-ins and sign-outs, and stops on unmount', async () => {
    const { fake, unmount } = await setup();
    expect(fake.listenerCount()).toBe(1);
    await unmount();
    expect(fake.listenerCount()).toBe(0);
  });
});

describe('SessionProvider — a sign-out later', () => {
  function seedCaches(queryClient: QueryClient) {
    queryClient.setQueryData(['trips', 'list'], [{ id: 'old' }]);
    queryClient.setQueryData(['trips', 'current'], { overview: 'old' });
    queryClient.setQueryData(['trip-photos', 'old'], ['photo']);
    queryClient.setQueryData(['profile', 'me'], { profile: 'old', fromCache: false });
  }

  it('clears the user data on the phone, then forgets everything in memory, then shows signed out', async () => {
    const { fake, queryClient } = await setup();
    await expectStatus('signedIn');
    seedCaches(queryClient);
    fake.log.length = 0;

    await act(async () => fake.emit({ type: 'signedOut' }));
    await expectStatus('signedOut');

    // The state commits are rendered in a batch, so only the order of the clear and the final state is exact.
    expect(fake.log.filter((entry) => entry !== 'state:loading')).toEqual(['clear:start', 'clear:done', 'state:signedOut']);
    expect(queryClient.getQueryData(['trips', 'list'])).toBeUndefined();
    expect(queryClient.getQueryData(['trips', 'current'])).toBeUndefined();
    expect(queryClient.getQueryData(['trip-photos', 'old'])).toBeUndefined();
    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
  });

  it('does not show the old user while the clear is running', async () => {
    const { fake } = await setup();
    await expectStatus('signedIn');
    const release = fake.holdClear();

    await act(async () => fake.emit({ type: 'signedOut' }));
    expect(status()).toHaveTextContent('loading');
    await act(async () => release());
    await expectStatus('signedOut');
  });

  it('a failed clear shows the error, and the retry finishes the sign-out', async () => {
    const { fake } = await setup();
    await expectStatus('signedIn');
    fake.failClear(new Error('disk full'));

    await act(async () => fake.emit({ type: 'signedOut' }));
    await expectStatus('error');

    fake.failClear(null);
    fake.answerWith(signedOut);
    await act(async () => screen.getByTestId('retry').props.onPress());
    await expectStatus('signedOut');
  });

  it('a second sign-out while already signed out clears nothing again', async () => {
    const { fake } = await setup({ fake: createFakeSessionSource(signedOut) });
    await expectStatus('signedOut');
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);

    await act(async () => fake.emit({ type: 'signedOut' }));
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent('signedOut');
  });

  it('two sign-outs close together share one clear (two transactions at once would fail)', async () => {
    const { fake } = await setup();
    await expectStatus('signedIn');
    const release = fake.holdClear();

    await act(async () => {
      fake.emit({ type: 'signedOut' });
      fake.emit({ type: 'signedOut' });
    });
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await expectStatus('signedOut');
  });

  it('a sign-out that arrives while the first read is still running wins over the stale answer "signed in"', async () => {
    const fake = createFakeSessionSource(signedIn);
    const release = fake.holdCurrent();
    await setup({ fake });

    await act(async () => fake.emit({ type: 'signedOut' }));
    await act(async () => release());
    await expectStatus('signedOut');
    expect(fake.log).toContain('clear:done');
  });
});

describe('SessionProvider — the user epoch (auth-onboarding D15)', () => {
  it('moves the moment the app starts to forget the previous user, before the clear has even started', async () => {
    const { fake } = await setup();
    await expectStatus('signedIn');
    const release = fake.holdClear();
    const before = currentUserEpoch();

    await act(async () => fake.emit({ type: 'signedOut' }));

    // The fake clear does not touch the epoch itself: this is the provider's own, early closing.
    expect(isEpochCurrent(before)).toBe(false);
    expect(isEpochCurrent(currentUserEpoch())).toBe(false);
    await act(async () => release());
    await expectStatus('signedOut');
  });

  it('closes at launch without a session too, and a plain sign-in from the signed-out state does not close it again', async () => {
    const before = currentUserEpoch();
    const { fake } = await setup({ fake: createFakeSessionSource(signedOut) });
    await expectStatus('signedOut');
    expect(isEpochCurrent(before)).toBe(false);

    await reopenUserEpoch(); // the real clear that the fake stands in for has finished
    const open = currentUserEpoch();
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await expectStatus('signedIn');
    expect(isEpochCurrent(open)).toBe(true);
  });

  it('does not move for a launch with a session', async () => {
    const before = currentUserEpoch();
    await setup();
    await expectStatus('signedIn');
    expect(isEpochCurrent(before)).toBe(true);
  });
});

describe('SessionProvider — a sign-in later', () => {
  it('signs in, requests a budget sync, and refetches the trips and the profile for the new user', async () => {
    const trips = createInMemoryTripRepository();
    const list = jest.fn(() => trips.list());
    const syncBudgets = jest.fn(() => trips.syncBudgets());
    const profiles = createInMemoryProfileRepository();
    const myProfile = jest.fn(() => profiles.myProfile());
    function Consumers() {
      useTripList();
      useMyProfile();
      return null;
    }
    const { fake } = await setup({
      fake: createFakeSessionSource(signedOut),
      trips: { ...trips, list, syncBudgets },
      profiles: { ...profiles, myProfile },
      extra: <Consumers />,
    });
    await expectStatus('signedOut');
    expect(myProfile).not.toHaveBeenCalled();
    const syncsBefore = syncBudgets.mock.calls.length;
    const listsBefore = list.mock.calls.length;

    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));

    await expectStatus('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent(OTHER_USER_ID);
    await waitFor(() => expect(syncBudgets.mock.calls.length).toBeGreaterThan(syncsBefore));
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(listsBefore));
    await waitFor(() => expect(myProfile).toHaveBeenCalledTimes(1));
    // The data of the previous user was already cleared when the app became signed out: nothing is cleared again.
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);
  });

  it('the same user signing in again changes nothing and asks for no sync', async () => {
    const trips = createInMemoryTripRepository();
    const syncBudgets = jest.fn(() => trips.syncBudgets());
    const { fake } = await setup({ trips: { ...trips, syncBudgets } });
    await expectStatus('signedIn');
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(1));

    await act(async () => fake.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID }));
    expect(syncBudgets).toHaveBeenCalledTimes(1);
    expect(fake.clearUserData).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent('signedIn');
  });

  it('the user becomes known after an offline start: the id is filled in, nothing is cleared or synced again', async () => {
    const trips = createInMemoryTripRepository();
    const syncBudgets = jest.fn(() => trips.syncBudgets());
    const { fake } = await setup({ fake: createFakeSessionSource({ status: 'signedIn', userId: null }), trips: { ...trips, syncBudgets } });
    await expectStatus('signedIn');
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(1));

    await act(async () => fake.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID }));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(SIGNED_IN_USER_ID));
    expect(syncBudgets).toHaveBeenCalledTimes(1);
    expect(fake.clearUserData).not.toHaveBeenCalled();
  });

  it('a different user signing in without a sign-out first: the previous user is cleared first, then the new one is signed in', async () => {
    const { fake, queryClient } = await setup();
    await expectStatus('signedIn');
    queryClient.setQueryData(['profile', 'me'], { profile: 'old', fromCache: false });
    fake.log.length = 0;

    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(OTHER_USER_ID));

    expect(fake.log.filter((entry) => entry !== 'state:loading')).toEqual(['clear:start', 'clear:done', 'state:signedIn']);
    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
  });

  it('a sign-in while the session could not be read (error, nothing was cleared before) clears first: the user is not known to be the stored one', async () => {
    const fake = createFakeSessionSource(new Error('storage broken'));
    await setup({ fake });
    await expectStatus('error');
    expect(fake.clearUserData).not.toHaveBeenCalled();

    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));

    await expectStatus('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent(OTHER_USER_ID);
    expect(fake.log.indexOf('clear:done')).toBeGreaterThan(-1);
    expect(fake.log.indexOf('clear:done')).toBeLessThan(fake.log.lastIndexOf('state:signedIn'));
  });

  it('a sign-in while the first read is still running clears first too (whose data is on the phone is not known yet)', async () => {
    const fake = createFakeSessionSource(signedIn);
    const release = fake.holdCurrent();
    await setup({ fake });

    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await act(async () => release());

    await expectStatus('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent(OTHER_USER_ID);
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);
  });

  it('a sign-in after a failed clear still clears first (the old data may be there); if that fails too, it is an error, not signed in', async () => {
    const { fake } = await setup();
    await expectStatus('signedIn');
    fake.failClear(new Error('disk full'));
    await act(async () => fake.emit({ type: 'signedOut' }));
    await expectStatus('error');

    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await expectStatus('error');
    expect(fake.clearUserData).toHaveBeenCalledTimes(2);

    fake.failClear(null);
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await expectStatus('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent(OTHER_USER_ID);
    expect(fake.clearUserData).toHaveBeenCalledTimes(3);
  });
});

// auth-onboarding D22 / D23: after the gate has opened from the stored session, Supabase checks that session once in the background.
describe('SessionProvider — the background check of the stored session', () => {
  it('runs once after the app opened signed in, and the gate does not wait for it', async () => {
    const fake = createFakeSessionSource(signedIn);
    const release = fake.holdCheck();
    await setup({ fake });

    await expectStatus('signedIn');
    await waitFor(() => expect(fake.checkStoredSession).toHaveBeenCalledTimes(1));
    expect(status()).toHaveTextContent('signedIn');

    await act(async () => release());
    expect(status()).toHaveTextContent('signedIn');
    expect(fake.checkStoredSession).toHaveBeenCalledTimes(1);
    expect(fake.clearUserData).not.toHaveBeenCalled();
  });

  it('does not run when the app starts signed out', async () => {
    const fake = createFakeSessionSource(signedOut);
    await setup({ fake });
    await expectStatus('signedOut');
    expect(fake.checkStoredSession).not.toHaveBeenCalled();
  });

  it('does not run for an offline start where the user is not known (nothing could be asked anyway)', async () => {
    const fake = createFakeSessionSource({ status: 'signedIn', userId: null });
    await setup({ fake });
    await expectStatus('signedIn');
    expect(fake.checkStoredSession).not.toHaveBeenCalled();
  });

  it('does not run when the session could not be read (error)', async () => {
    const fake = createFakeSessionSource(new Error('storage broken'));
    await setup({ fake });
    await expectStatus('error');
    expect(fake.checkStoredSession).not.toHaveBeenCalled();
  });

  it('does not run after a fresh sign-in', async () => {
    const fake = createFakeSessionSource(signedOut);
    await setup({ fake });
    await expectStatus('signedOut');

    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await expectStatus('signedIn');
    expect(fake.checkStoredSession).not.toHaveBeenCalled();
  });

  it('does not run twice on one start (a retry that reads the session again does not check again)', async () => {
    const { fake } = await setup();
    await waitFor(() => expect(fake.checkStoredSession).toHaveBeenCalledTimes(1));

    await act(async () => screen.getByTestId('retry').props.onPress());
    await expectStatus('signedIn');
    expect(fake.current).toHaveBeenCalledTimes(2);
    expect(fake.checkStoredSession).toHaveBeenCalledTimes(1);
  });

  it('the check ends with a sign-out (the library fires SIGNED_OUT): the user data is cleared and the welcome screen shows', async () => {
    const fake = createFakeSessionSource(signedIn);
    const release = fake.holdCheck();
    await setup({ fake });
    await expectStatus('signedIn');
    await waitFor(() => expect(fake.checkStoredSession).toHaveBeenCalledTimes(1));

    await act(async () => {
      fake.emit({ type: 'signedOut' });
      release();
    });
    await expectStatus('signedOut');
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);
  });
});

// The same flow with the real session source over a fake Supabase client: what Supabase answers decides what the user sees.
describe('SessionProvider — the background check with the real session source (D23)', () => {
  type UserAnswer = Awaited<ReturnType<ReturnType<typeof fakeSupabase>['auth']['getUser']>>;
  const failed = (error: AuthError): UserAnswer => ({ data: null, error });

  async function setupReal(answer: UserAnswer | 'hang' | 'held', { signOutFails = false } = {}) {
    const supabase = fakeSupabase();
    let answerUser: (value: UserAnswer) => void = () => {};
    if (answer === 'hang') supabase.auth.getUser.mockImplementation(() => new Promise(() => {}));
    else if (answer === 'held') supabase.auth.getUser.mockImplementation(() => new Promise((resolve) => (answerUser = resolve)));
    else supabase.auth.getUser.mockResolvedValue(answer);
    let listener: ((event: string, session: unknown) => void) | null = null;
    supabase.auth.onAuthStateChange.mockImplementation((callback: unknown) => {
      listener = callback as typeof listener;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    // Like the library: a local sign-out removes the session and tells the listener.
    supabase.auth.signOut.mockImplementation(async () => {
      if (signOutFails) throw new Error('storage broken');
      listener?.('SIGNED_OUT', null);
      return { error: null };
    });
    const clearUserData = jest.fn(async () => {});
    const auth = supabase.auth as unknown as Parameters<typeof createSupabaseSessionSource>[0]['auth'];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    await render(
      <AppProviders
        queryClient={queryClient}
        sessionSource={createSupabaseSessionSource({ auth, clearUserData })}
        tripRepository={createInMemoryTripRepository()}
        profileRepository={createInMemoryProfileRepository()}
      >
        <Probe />
      </AppProviders>,
    );
    return {
      ...supabase,
      clearUserData,
      answerUser: (value: UserAnswer) => answerUser(value),
      emitLibrarySignedOut: () => listener?.('SIGNED_OUT', null),
      emitSignedIn: (session: unknown) => listener?.('SIGNED_IN', session),
    };
  }

  it('the user no longer exists: signed out locally once, the data is cleared, the welcome screen shows', async () => {
    const { auth, clearUserData } = await setupReal(failed(new AuthApiError('gone', 403, 'user_not_found')));
    await expectStatus('signedOut');
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearUserData).toHaveBeenCalledTimes(1);
  });

  it('the session is gone on the server: the library signs out by itself (SIGNED_OUT), the app does not sign out again', async () => {
    const { auth, clearUserData, emitLibrarySignedOut } = await setupReal(failed(new AuthSessionMissingError()));
    await expectStatus('signedIn');
    await waitFor(() => expect(auth.getUser).toHaveBeenCalledTimes(1));
    await act(async () => emitLibrarySignedOut());
    await expectStatus('signedOut');
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(clearUserData).toHaveBeenCalledTimes(1);
  });

  it('a check that never answers (a dead connection) does not hold the gate', async () => {
    const { auth, clearUserData } = await setupReal('hang');
    await expectStatus('signedIn');
    await waitFor(() => expect(auth.getUser).toHaveBeenCalledTimes(1));
    expect(status()).toHaveTextContent('signedIn');
    expect(clearUserData).not.toHaveBeenCalled();
  });

  it.each([
    ['an invalid token', new AuthApiError('invalid JWT', 401, 'bad_jwt')],
    ['a server error', new AuthRetryableFetchError('boom', 503)],
    ['no connection', new AuthRetryableFetchError('Network request failed', 0)],
    ['an unknown error', new AuthUnknownError('???', new Error('???'))],
  ])('%s: the user stays on the signed-in app, nothing is cleared or shown', async (_name, error) => {
    const { auth, clearUserData } = await setupReal(failed(error));
    await expectStatus('signedIn');
    await waitFor(() => expect(auth.getUser).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(status()).toHaveTextContent('signedIn');
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(clearUserData).not.toHaveBeenCalled();
  });

  it('another user signs in while the check is in flight, and the answer for the first user is "user no longer exists": the new user stays signed in', async () => {
    const { auth, clearUserData, answerUser, emitSignedIn } = await setupReal('held');
    await expectStatus('signedIn');
    await waitFor(() => expect(auth.getUser).toHaveBeenCalledTimes(1));

    const second = { access_token: 'access-b', user: { id: OTHER_USER_ID, is_anonymous: false } };
    auth.getSession.mockResolvedValue({ data: { session: second as never }, error: null });
    await act(async () => emitSignedIn(second));
    await expectStatus('signedIn');
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(OTHER_USER_ID));
    expect(clearUserData).toHaveBeenCalledTimes(1);

    await act(async () => answerUser(failed(new AuthApiError('gone', 403, 'user_not_found'))));
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent('signedIn');
    expect(screen.getByTestId('user')).toHaveTextContent(OTHER_USER_ID);
  });

  it('a failing local sign-out is swallowed: still signed in, nothing shown', async () => {
    const { auth, clearUserData } = await setupReal(failed(new AuthApiError('gone', 403, 'user_not_found')), { signOutFails: true });
    await expectStatus('signedIn');
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(status()).toHaveTextContent('signedIn');
    expect(clearUserData).not.toHaveBeenCalled();
  });
});
