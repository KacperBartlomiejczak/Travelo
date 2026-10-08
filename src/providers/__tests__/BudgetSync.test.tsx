import { QueryClient } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { useCurrentTrip } from '@/hooks/useTrips';
import { AppProviders } from '@/providers/AppProviders';
import { useIsOffline } from '@/providers/BudgetSync';
import { setNetwork } from '@/test/mock-network';

const NOW = new Date('2026-10-06T09:30:00.000Z');

function repositoryWithSync(results: { nextAttemptAt: Date | null }[] = []) {
  const repository = createInMemoryTripRepository();
  const syncBudgets = jest.fn(async () => results.shift() ?? { nextAttemptAt: null });
  const current = jest.fn(() => repository.current());
  return { repository: { ...repository, current, syncBudgets } satisfies TripRepository, syncBudgets, current };
}

function wrapper(repository: TripRepository) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProviders queryClient={queryClient} tripRepository={repository}>
        {children}
      </AppProviders>
    );
  };
}

let appStateListener: (state: AppStateStatus) => void = () => {};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appStateListener = listener;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('budget sync triggers', () => {
  it('sends waiting changes when the app starts online', async () => {
    const { repository, syncBudgets } = repositoryWithSync();
    await render(<Text>app</Text>, { wrapper: wrapper(repository) });
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(1));
  });

  it('waits while offline and sends as soon as the connection is back', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    const { repository, syncBudgets } = repositoryWithSync();
    await render(<Text>app</Text>, { wrapper: wrapper(repository) });
    expect(syncBudgets).not.toHaveBeenCalled();

    await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(1));
  });

  it('sends when the app comes back to the foreground', async () => {
    const { repository, syncBudgets } = repositoryWithSync();
    await render(<Text>app</Text>, { wrapper: wrapper(repository) });
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(1));

    await act(async () => appStateListener('active'));
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(2));
  });

  it('retries when the backoff delay is over', async () => {
    const { repository, syncBudgets } = repositoryWithSync([{ nextAttemptAt: new Date(NOW.getTime() + 4000) }]);
    await render(<Text>app</Text>, { wrapper: wrapper(repository) });
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(1));

    await act(async () => jest.advanceTimersByTime(3000));
    expect(syncBudgets).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(1500));
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(2));
  });

  it('refreshes the trip after a sync so the indicator follows', async () => {
    const { repository, current } = repositoryWithSync();
    function Probe() {
      useCurrentTrip();
      return null;
    }
    await render(<Probe />, { wrapper: wrapper(repository) });
    await waitFor(() => expect(current.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('a failing sync leaves the change on the device and does not crash', async () => {
    const { repository, syncBudgets } = repositoryWithSync();
    syncBudgets.mockRejectedValueOnce(new Error('SQLite busy'));
    await render(<Text>app</Text>, { wrapper: wrapper(repository) });
    await waitFor(() => expect(syncBudgets).toHaveBeenCalledTimes(1));
    expect(screen.getByText('app')).toBeTruthy();
  });
});

describe('useIsOffline', () => {
  it.each([
    [{ isConnected: true, isInternetReachable: true }, false],
    [{}, false],
    [{ isConnected: false, isInternetReachable: false }, true],
    [{ isConnected: true, isInternetReachable: false }, true],
  ])('network %j → offline %s', async (network, offline) => {
    setNetwork(network);
    const { result } = await renderHook(() => useIsOffline(), { wrapper: wrapper(repositoryWithSync().repository) });
    expect(result.current).toBe(offline);
  });
});
