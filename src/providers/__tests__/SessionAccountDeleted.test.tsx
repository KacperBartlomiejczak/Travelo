import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { createInMemoryProfileRepository } from '@/data/profile-repository';
import { createInMemoryTripRepository } from '@/data/trip-repository';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/providers/Session';
import { createFakeSessionSource, type FakeSession } from '@/test/fake-session-source';
import { SIGNED_IN_USER_ID } from '@/test/fake-supabase';

const signedIn = { status: 'signedIn', userId: SIGNED_IN_USER_ID } as const;
const signedOut = { status: 'signedOut' } as const;

// The latest session value, read by the tests (set in an effect, not while rendering).
let session: ReturnType<typeof useSession>;

function Probe() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return (
    <>
      <Text testID="status">{value.state.status}</Text>
      <Text testID="deleted">{String(value.accountDeleted)}</Text>
    </>
  );
}

async function setup(fake: FakeSession = createFakeSessionSource(signedIn)) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = await render(
    <AppProviders
      queryClient={queryClient}
      sessionSource={fake.source}
      tripRepository={createInMemoryTripRepository()}
      profileRepository={createInMemoryProfileRepository()}
    >
      <Probe />
    </AppProviders>,
  );
  await waitFor(() => expect(screen.getByTestId('status')).not.toHaveTextContent('loading'));
  return { fake, ...rendered };
}

const expectStatus = (expected: string) => waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(expected));
const deleted = () => screen.getByTestId('deleted');

describe('SessionProvider — account deleted (profile-settings D12)', () => {
  it('is not set at the start, nor by a plain sign-out', async () => {
    const { fake } = await setup();
    expect(deleted()).toHaveTextContent('false');
    await act(async () => session.signOut());
    await expectStatus('signedOut');
    expect(fake.signOut).toHaveBeenCalledTimes(1);
    expect(deleted()).toHaveTextContent('false');
  });

  it('signOutAfterDelete signs out through the same local path and leaves the notice set on the signed-out state', async () => {
    const { fake } = await setup();
    await act(async () => session.signOutAfterDelete());
    await expectStatus('signedOut');
    expect(fake.signOut).toHaveBeenCalledTimes(1);
    expect(fake.clearUserData).toHaveBeenCalledTimes(1);
    expect(deleted()).toHaveTextContent('true');
  });

  it('the notice is reset by the next sign-in, and a later plain sign-out does not bring it back', async () => {
    const { fake } = await setup();
    await act(async () => session.signOutAfterDelete());
    await expectStatus('signedOut');

    await act(async () => fake.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID }));
    await expectStatus('signedIn');
    expect(deleted()).toHaveTextContent('false');

    await act(async () => session.signOut());
    await expectStatus('signedOut');
    expect(deleted()).toHaveTextContent('false');
  });

  it('the notice lives in memory only: a new start of the app (a new provider) does not have it', async () => {
    const first = await setup();
    await act(async () => session.signOutAfterDelete());
    await expectStatus('signedOut');
    expect(deleted()).toHaveTextContent('true');
    await first.unmount();

    await setup(createFakeSessionSource(signedOut));
    await expectStatus('signedOut');
    expect(deleted()).toHaveTextContent('false');
  });

  it('a sign-out that rejects after the account is gone still ends on signed out with the notice, and the phone data is cleared', async () => {
    const fake = createFakeSessionSource(signedIn);
    fake.signOut.mockRejectedValueOnce(new Error('network request failed'));
    await setup(fake);
    await act(async () => {
      await expect(session.signOutAfterDelete()).resolves.toBeUndefined();
    });
    await expectStatus('signedOut');
    expect(fake.clearUserData).toHaveBeenCalled();
    expect(deleted()).toHaveTextContent('true');
  });

  it('the phone cannot be cleared after the deletion: error state keeps the notice, and the retry ends on signed out with it', async () => {
    const fake = createFakeSessionSource(signedIn);
    fake.failClear(new Error('disk full'));
    await setup(fake);
    await act(async () => session.signOutAfterDelete());
    await expectStatus('error');
    expect(deleted()).toHaveTextContent('true');

    fake.failClear(null);
    fake.answerWith(signedOut);
    await act(async () => session.retry());
    await expectStatus('signedOut');
    expect(deleted()).toHaveTextContent('true');
  });

  it('a sign-out that rejects AND a clear that fails: still the error state with the notice, then the retry recovers', async () => {
    const fake = createFakeSessionSource(signedIn);
    fake.signOut.mockRejectedValueOnce(new Error('network request failed'));
    fake.failClear(new Error('disk full'));
    await setup(fake);
    await act(async () => session.signOutAfterDelete());
    await expectStatus('error');
    expect(deleted()).toHaveTextContent('true');

    fake.failClear(null);
    fake.answerWith(signedOut);
    await act(async () => session.retry());
    await expectStatus('signedOut');
    expect(deleted()).toHaveTextContent('true');
  });
});
