import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { useCreateTrip, useNearestTrip, useSetTripBudget } from '@/hooks/useTrips';
import { AppProviders } from '@/providers/AppProviders';
import { createTripInputFixture } from '@/test/fixtures';

const NOW = new Date('2026-10-04T12:00:00Z');

function setup(repository: TripRepository) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={queryClient} tripRepository={repository}>
      {children}
    </AppProviders>
  );
  return wrapper;
}

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useNearestTrip', () => {
  it('returns the nearest trip from the repository', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    await repository.create(createTripInputFixture());
    const { result } = await renderHook(() => useNearestTrip(), { wrapper: setup(repository) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.overview.trip.name).toBe('Warsaw → Bangkok');
    expect(result.current.data?.overview.members).toHaveLength(2);
  });

  it('returns null when there are no trips', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const { result } = await renderHook(() => useNearestTrip(), { wrapper: setup(repository) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('exposes a repository error', async () => {
    const failing: TripRepository = {
      list: () => Promise.reject(new Error('offline')),
      current: () => Promise.reject(new Error('offline')),
      select: () => Promise.reject(new Error('offline')),
      create: () => Promise.reject(new Error('offline')),
      setBudget: () => Promise.reject(new Error('offline')),
      syncBudgets: () => Promise.reject(new Error('offline')),
    };
    const { result } = await renderHook(() => useNearestTrip(), { wrapper: setup(failing) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTrip', () => {
  it('saves a trip and refreshes the nearest trip', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const wrapper = setup(repository);
    const { result } = await renderHook(() => ({ nearest: useNearestTrip(), create: useCreateTrip() }), { wrapper });
    await waitFor(() => expect(result.current.nearest.data).toBeNull());

    await act(async () => {
      await result.current.create.mutateAsync(createTripInputFixture());
    });

    await waitFor(() => expect(result.current.nearest.data?.overview.trip.name).toBe('Warsaw → Bangkok'));
  });

  it('reports a failed save', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const failing: TripRepository = {
      ...repository,
      create: () => Promise.reject(new Error('down')),
    };
    const { result } = await renderHook(() => useCreateTrip(), { wrapper: setup(failing) });
    await act(async () => {
      await result.current.mutateAsync(createTripInputFixture()).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSetTripBudget', () => {
  it('saves the budget, refreshes the nearest trip and starts a sync', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const trip = await repository.create(createTripInputFixture());
    const syncBudgets = jest.fn(async () => ({ nextAttemptAt: null }));
    const wrapper = setup({ ...repository, syncBudgets });
    const { result } = await renderHook(() => ({ nearest: useNearestTrip(), setBudget: useSetTripBudget() }), { wrapper });
    await waitFor(() => expect(result.current.nearest.isSuccess).toBe(true));
    syncBudgets.mockClear();

    await act(async () => {
      await result.current.setBudget.mutateAsync({ trip, amountMinor: 250000 });
    });

    await waitFor(() => expect(result.current.nearest.data?.overview.trip.budgetPerPerson.amountMinor).toBe(250000));
    expect(syncBudgets).toHaveBeenCalled();
  });

  it('saves even when the app thinks it is offline (saving never waits for the network)', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const trip = await repository.create(createTripInputFixture());
    const setBudget = jest.fn(repository.setBudget);
    const { result } = await renderHook(() => useSetTripBudget(), { wrapper: setup({ ...repository, setBudget }) });
    onlineManager.setOnline(false);
    try {
      await act(async () => {
        await result.current.mutateAsync({ trip, amountMinor: 250000 });
      });
      expect(setBudget).toHaveBeenCalledWith(trip, 250000);
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('useNearestTrip offline', () => {
  it('still asks the repository, which answers from the device copy', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    await repository.create(createTripInputFixture());
    onlineManager.setOnline(false);
    try {
      const { result } = await renderHook(() => useNearestTrip(), { wrapper: setup(repository) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
