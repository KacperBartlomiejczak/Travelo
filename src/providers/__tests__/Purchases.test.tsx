import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { StrictMode } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { Text } from 'react-native';

import * as purchasesData from '@/data/purchases';
import { createInMemoryProfileRepository } from '@/data/profile-repository';
import { createInMemoryTripRepository } from '@/data/trip-repository';
import { AppProviders } from '@/providers/AppProviders';
import { useIsPro, useIsProIdentityConfirmed } from '@/providers/Purchases';
import { createFakeSessionSource, type FakeSession } from '@/test/fake-session-source';
import { SIGNED_IN_USER_ID } from '@/test/fake-supabase';
import { customerInfoFixture, emitCustomerInfo, purchasesMock } from '@/test/mock-purchases';

process.env.EXPO_PUBLIC_REVENUECAT_API_KEY = 'test_jest';

const OTHER_USER_ID = '1b2c3d4e-0000-4000-8000-00000000abcd';
const signedIn = { status: 'signedIn', userId: SIGNED_IN_USER_ID } as const;

function Probe() {
  return (
    <>
      <Text testID="pro">{String(useIsPro())}</Text>
      <Text testID="confirmed">{String(useIsProIdentityConfirmed())}</Text>
    </>
  );
}

async function setup(fake: FakeSession = createFakeSessionSource(signedIn)) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
  return { ...rendered, fake };
}

const expectPro = (expected: boolean) => waitFor(() => expect(screen.getByTestId('pro')).toHaveTextContent(String(expected)));
const expectConfirmed = (expected: boolean) => waitFor(() => expect(screen.getByTestId('confirmed')).toHaveTextContent(String(expected)));
const proInfo = customerInfoFixture({ pro: true });

describe('PurchasesProvider identity confirmation', () => {
  it('different SDK user: false while logIn is pending, true once it resolves', async () => {
    let resolveLogIn = (_: { customerInfo: CustomerInfo; created: boolean }) => {};
    purchasesMock.getAppUserID.mockResolvedValue(OTHER_USER_ID);
    purchasesMock.logIn.mockReturnValueOnce(new Promise((resolve) => { resolveLogIn = resolve; }));
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(1));
    await expectConfirmed(false);
    await act(async () => resolveLogIn({ customerInfo: proInfo, created: false }));
    await expectConfirmed(true);
  });

  it('different SDK user: stays false when logIn rejects', async () => {
    purchasesMock.getAppUserID.mockResolvedValue(OTHER_USER_ID);
    purchasesMock.logIn.mockRejectedValueOnce(new Error('offline'));
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await act(async () => {});
    await expectConfirmed(false);
  });

  it('same SDK user: true at once, even when logIn later rejects', async () => {
    purchasesMock.getAppUserID.mockResolvedValue(SIGNED_IN_USER_ID);
    purchasesMock.logIn.mockRejectedValueOnce(new Error('offline'));
    await setup();
    await expectConfirmed(true);
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await act(async () => {});
    await expectConfirmed(true);
  });

  it('offline start (no user id): true', async () => {
    await setup(createFakeSessionSource({ status: 'signedIn', userId: null }));
    await expectConfirmed(true);
  });

  it('session change to a different user: false while its logIn is pending', async () => {
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    purchasesMock.logIn.mockReturnValueOnce(new Promise(() => {}));
    const { fake } = await setup();
    await expectConfirmed(true);
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(2));
    await expectConfirmed(false);
  });

  it('signed out: false', async () => {
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    const { fake } = await setup();
    await expectConfirmed(true);
    await act(async () => fake.emit({ type: 'signedOut' }));
    await expectConfirmed(false);
  });
});

describe('PurchasesProvider', () => {
  // The once-per-run guard and the key check are tested in src/data/__tests__/purchases.test.ts.
  it('asks for the SDK to be configured on mount', async () => {
    const configure = jest.spyOn(purchasesData, 'configurePurchases');
    await setup();
    await expectPro(false);
    expect(configure).toHaveBeenCalled();
    configure.mockRestore();
  });

  it('a late cached status that arrives after sign-out never reaches the next user', async () => {
    let resolveCached = (_: CustomerInfo) => {};
    purchasesMock.getAppUserID.mockResolvedValue(SIGNED_IN_USER_ID);
    purchasesMock.getCustomerInfo.mockReturnValueOnce(new Promise<CustomerInfo>((resolve) => { resolveCached = resolve; }));
    purchasesMock.logIn.mockReturnValue(new Promise(() => {}));
    const { fake } = await setup();
    await waitFor(() => expect(Purchases.getCustomerInfo).toHaveBeenCalledTimes(1));
    await act(async () => fake.emit({ type: 'signedOut' }));
    await waitFor(() => expect(Purchases.logOut).toHaveBeenCalledTimes(1));
    await act(async () => fake.emit({ type: 'signedIn', userId: SIGNED_IN_USER_ID }));
    await act(async () => resolveCached(proInfo));
    await expectPro(false);
  });

  it('same SDK user: the cached status shows at once, logIn only refreshes it', async () => {
    purchasesMock.getAppUserID.mockResolvedValue(SIGNED_IN_USER_ID);
    purchasesMock.getCustomerInfo.mockResolvedValueOnce(proInfo);
    purchasesMock.logIn.mockReturnValue(new Promise(() => {}));
    await setup();
    await expectPro(true);
    expect(Purchases.logIn).toHaveBeenCalledWith(SIGNED_IN_USER_ID);
  });

  it('same SDK user: a logIn failure keeps the cached status', async () => {
    purchasesMock.getAppUserID.mockResolvedValue(SIGNED_IN_USER_ID);
    purchasesMock.getCustomerInfo.mockResolvedValueOnce(proInfo);
    purchasesMock.logIn.mockRejectedValueOnce(new Error('offline'));
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await act(async () => {});
    await expectPro(true);
  });

  it('same SDK user: the logIn answer replaces the cached status', async () => {
    purchasesMock.getAppUserID.mockResolvedValue(SIGNED_IN_USER_ID);
    purchasesMock.getCustomerInfo.mockResolvedValueOnce(proInfo);
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: customerInfoFixture({ pro: false }), created: false });
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await expectPro(false);
  });

  it('different SDK user: not pro until logIn answers, never from the cache', async () => {
    let resolveLogIn = (_: { customerInfo: CustomerInfo; created: boolean }) => {};
    purchasesMock.getAppUserID.mockResolvedValue(OTHER_USER_ID);
    purchasesMock.getCustomerInfo.mockResolvedValue(proInfo);
    purchasesMock.logIn.mockReturnValueOnce(new Promise((resolve) => { resolveLogIn = resolve; }));
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(1));
    await expectPro(false);
    await act(async () => resolveLogIn({ customerInfo: proInfo, created: false }));
    await expectPro(true);
  });

  it('different SDK user: a logIn failure means not pro', async () => {
    purchasesMock.getAppUserID.mockResolvedValue(OTHER_USER_ID);
    purchasesMock.logIn.mockRejectedValueOnce(new Error('offline'));
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await expectPro(false);
  });

  it('a late logIn of the previous user does not confirm the next user identity', async () => {
    let resolveA = (_: { customerInfo: CustomerInfo; created: boolean }) => {};
    purchasesMock.logIn.mockReturnValueOnce(new Promise((resolve) => { resolveA = resolve; }));
    purchasesMock.logIn.mockReturnValueOnce(new Promise(() => {}));
    const { fake } = await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(1));
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(2));
    await act(async () => resolveA({ customerInfo: customerInfoFixture({ pro: false }), created: false }));
    await act(async () => emitCustomerInfo(proInfo));
    await expectPro(false);
  });

  it('signing out while getAppUserID is pending: no logIn for that user', async () => {
    let resolveId = (_: string) => {};
    purchasesMock.getAppUserID.mockReturnValueOnce(new Promise<string>((resolve) => { resolveId = resolve; }));
    const { fake } = await setup();
    await waitFor(() => expect(Purchases.getAppUserID).toHaveBeenCalledTimes(1));
    await act(async () => fake.emit({ type: 'signedOut' }));
    await act(async () => resolveId(SIGNED_IN_USER_ID));
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it('a cached status resolving after logIn answered does not override the logIn status', async () => {
    let resolveCached = (_: CustomerInfo) => {};
    purchasesMock.getAppUserID.mockResolvedValue(SIGNED_IN_USER_ID);
    purchasesMock.getCustomerInfo.mockReturnValueOnce(new Promise<CustomerInfo>((resolve) => { resolveCached = resolve; }));
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: customerInfoFixture({ pro: false }), created: false });
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(1));
    await act(async () => {});
    await act(async () => resolveCached(proInfo));
    await expectPro(false);
  });

  it('a cached status failing after logIn answered does not override the logIn status', async () => {
    let rejectCached = (_: Error) => {};
    purchasesMock.getAppUserID.mockResolvedValue(SIGNED_IN_USER_ID);
    purchasesMock.getCustomerInfo.mockReturnValueOnce(new Promise<CustomerInfo>((_, reject) => { rejectCached = reject; }));
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    await setup();
    await expectPro(true);
    await act(async () => rejectCached(new Error('offline')));
    await expectPro(true);
  });

  it('under StrictMode logIn is called once per session', async () => {
    const queryClient = new QueryClient();
    const fake = createFakeSessionSource(signedIn);
    await render(
      <StrictMode>
        <AppProviders queryClient={queryClient} sessionSource={fake.source} tripRepository={createInMemoryTripRepository()} profileRepository={createInMemoryProfileRepository()}>
          <Probe />
        </AppProviders>
      </StrictMode>,
    );
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await act(async () => {});
    expect(Purchases.logIn).toHaveBeenCalledTimes(1);
  });

  it('listener updates are ignored until the identity is confirmed', async () => {
    let resolveLogIn = (_: { customerInfo: CustomerInfo; created: boolean }) => {};
    purchasesMock.getAppUserID.mockResolvedValue(OTHER_USER_ID);
    purchasesMock.logIn.mockReturnValueOnce(new Promise((resolve) => { resolveLogIn = resolve; }));
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(1));
    await act(async () => emitCustomerInfo(proInfo));
    await expectPro(false);
    await act(async () => resolveLogIn({ customerInfo: customerInfoFixture({ pro: false }), created: false }));
    await act(async () => emitCustomerInfo(proInfo));
    await expectPro(true);
  });

  it('getAppUserID rejecting: treated as a different user, logIn decides', async () => {
    purchasesMock.getAppUserID.mockRejectedValueOnce(new Error('sdk'));
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    await setup();
    await expectPro(true);
  });

  it('configurePurchases throwing: not pro, no crash', async () => {
    const configure = jest.spyOn(purchasesData, 'configurePurchases').mockImplementation(() => {
      throw new Error('no key');
    });
    try {
      await setup();
      await expectPro(false);
    } finally {
      configure.mockRestore();
    }
  });

  it('switching user never renders the previous user status', async () => {
    const seen: string[] = [];
    function Recorder() {
      seen.push(String(useIsPro()));
      return null;
    }
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    purchasesMock.logIn.mockReturnValueOnce(new Promise(() => {}));
    const fake = createFakeSessionSource(signedIn);
    const queryClient = new QueryClient();
    await render(
      <AppProviders queryClient={queryClient} sessionSource={fake.source} tripRepository={createInMemoryTripRepository()} profileRepository={createInMemoryProfileRepository()}>
        <Probe />
        <Recorder />
      </AppProviders>,
    );
    await expectPro(true);
    seen.length = 0;
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(2));
    expect(seen).not.toContain('true');
  });

  it('the previous user logIn answering late with PRO does not reach the next user', async () => {
    let resolveA = (_: { customerInfo: CustomerInfo; created: boolean }) => {};
    purchasesMock.logIn.mockReturnValueOnce(new Promise((resolve) => { resolveA = resolve; }));
    purchasesMock.logIn.mockReturnValueOnce(new Promise(() => {}));
    const { fake } = await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(1));
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(2));
    await act(async () => resolveA({ customerInfo: proInfo, created: false }));
    await expectPro(false);
  });

  it('offline start (no user id): the SDK cached status is used', async () => {
    purchasesMock.getCustomerInfo.mockResolvedValueOnce(proInfo);
    await setup(createFakeSessionSource({ status: 'signedIn', userId: null }));
    await expectPro(true);
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it('signed out at launch with a stale SDK user: not pro, logOut called', async () => {
    purchasesMock.getCustomerInfo.mockResolvedValueOnce(proInfo);
    await setup(createFakeSessionSource({ status: 'signedOut' }));
    await waitFor(() => expect(Purchases.logOut).toHaveBeenCalledTimes(1));
    await act(async () => emitCustomerInfo(proInfo));
    await expectPro(false);
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it('a different user signing in after a sign-out gets their own status', async () => {
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    const { fake } = await setup();
    await expectPro(true);
    await act(async () => fake.emit({ type: 'signedOut' }));
    await expectPro(false);
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await waitFor(() => expect(Purchases.logIn).toHaveBeenLastCalledWith(OTHER_USER_ID));
    expect(Purchases.logIn).toHaveBeenCalledTimes(2);
    await expectPro(false);
  });

  it('a stale logIn rejection of the previous user does not clear the next user status', async () => {
    let rejectA = (_: Error) => {};
    purchasesMock.logIn.mockReturnValueOnce(new Promise((_, reject) => { rejectA = reject; }));
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    const { fake } = await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalledTimes(1));
    await act(async () => fake.emit({ type: 'signedOut' }));
    await act(async () => fake.emit({ type: 'signedIn', userId: OTHER_USER_ID }));
    await expectPro(true);
    await act(async () => rejectA(new Error('late')));
    await expectPro(true);
  });

  it('signed in: logs in with the user id once; an active travelo_pro means pro', async () => {
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    await setup();
    await expectPro(true);
    expect(Purchases.logIn).toHaveBeenCalledTimes(1);
    expect(Purchases.logIn).toHaveBeenCalledWith(SIGNED_IN_USER_ID);
  });

  it('is false before the status is known', async () => {
    purchasesMock.getCustomerInfo.mockReturnValueOnce(new Promise(() => {}));
    purchasesMock.logIn.mockReturnValueOnce(new Promise(() => {}));
    await setup();
    expect(screen.getByTestId('pro')).toHaveTextContent('false');
  });

  it('signed out after being signed in: logs out and is not pro', async () => {
    purchasesMock.logIn.mockResolvedValueOnce({ customerInfo: proInfo, created: false });
    const { fake } = await setup();
    await expectPro(true);
    await act(async () => fake.emit({ type: 'signedOut' }));
    await waitFor(() => expect(Purchases.logOut).toHaveBeenCalledTimes(1));
    await expectPro(false);
  });

  it('signed in without a known user id (offline start): no logIn', async () => {
    await setup(createFakeSessionSource({ status: 'signedIn', userId: null }));
    await waitFor(() => expect(Purchases.getCustomerInfo).toHaveBeenCalled());
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it('follows customer-info updates and removes its listener on unmount', async () => {
    const { unmount } = await setup();
    await expectPro(false);
    await act(async () => emitCustomerInfo(proInfo));
    await expectPro(true);
    await act(async () => emitCustomerInfo(customerInfoFixture({ pro: false })));
    await expectPro(false);

    await unmount();
    expect(purchasesMock.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(purchasesMock.addCustomerInfoUpdateListener.mock.calls[0][0]);
  });

  it('logIn and getCustomerInfo rejecting: not pro, no crash', async () => {
    purchasesMock.logIn.mockRejectedValueOnce(new Error('offline'));
    purchasesMock.getCustomerInfo.mockRejectedValueOnce(new Error('offline'));
    await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await expectPro(false);
  });

  it('logOut rejecting (anonymous SDK user): no crash', async () => {
    purchasesMock.logOut.mockRejectedValueOnce(new Error('anonymous'));
    const { fake } = await setup();
    await waitFor(() => expect(Purchases.logIn).toHaveBeenCalled());
    await act(async () => fake.emit({ type: 'signedOut' }));
    await waitFor(() => expect(Purchases.logOut).toHaveBeenCalled());
    await expectPro(false);
  });

  it('useIsPro outside the provider throws', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(render(<Probe />)).rejects.toThrow('useIsPro must be used inside AppProviders');
    } finally {
      error.mockRestore();
    }
  });
});
