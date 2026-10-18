import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { Text } from 'react-native';

import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { currentUserEpoch, isEpochCurrent } from '@/data/local-store';
import { useMyProfile } from '@/hooks/useProfile';
import { useTripList } from '@/hooks/useTrips';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/providers/Session';
import { createFakeSessionSource, type FakeSession } from '@/test/fake-session-source';
import { SIGNED_IN_USER_ID } from '@/test/fake-supabase';
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
