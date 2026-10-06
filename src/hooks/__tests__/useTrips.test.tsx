import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { useCreateTrip, useTrips } from '@/hooks/useTrips';
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

describe('useTrips', () => {
  it('returns the trips from the repository', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    await repository.create(createTripInputFixture());
    const { result } = await renderHook(() => useTrips(), { wrapper: setup(repository) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((trip) => trip.name)).toEqual(['Warsaw → Bangkok']);
  });

  it('exposes a repository error', async () => {
    const failing: TripRepository = {
      list: () => Promise.reject(new Error('offline')),
      nearest: () => Promise.reject(new Error('offline')),
      create: () => Promise.reject(new Error('offline')),
    };
    const { result } = await renderHook(() => useTrips(), { wrapper: setup(failing) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTrip', () => {
  it('saves a trip and refreshes the trips list', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const wrapper = setup(repository);
    const { result } = await renderHook(() => ({ trips: useTrips(), create: useCreateTrip() }), { wrapper });
    await waitFor(() => expect(result.current.trips.data).toEqual([]));

    await act(async () => {
      await result.current.create.mutateAsync(createTripInputFixture());
    });

    await waitFor(() => expect(result.current.trips.data?.map((trip) => trip.name)).toEqual(['Warsaw → Bangkok']));
  });

  it('reports a failed save', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const failing: TripRepository = {
      list: () => repository.list(),
      nearest: () => repository.nearest(),
      create: () => Promise.reject(new Error('down')),
    };
    const { result } = await renderHook(() => useCreateTrip(), { wrapper: setup(failing) });
    await act(async () => {
      await result.current.mutateAsync(createTripInputFixture()).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
