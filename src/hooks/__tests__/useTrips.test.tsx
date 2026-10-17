import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import {
  useCreateTrip,
  useCurrentTrip,
  useDeleteTrip,
  useSelectTrip,
  useSetTripBudget,
  useTripList,
  useUpdateTripDetails,
} from '@/hooks/useTrips';
import { AppProviders } from '@/providers/AppProviders';
import { createTripInputFixture } from '@/test/fixtures';

const NOW = new Date('2026-10-04T12:00:00Z');

function setup(
  repository: TripRepository,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) {
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

describe('useCurrentTrip', () => {
  it('returns the current trip from the repository', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    await repository.create(createTripInputFixture());
    const { result } = await renderHook(() => useCurrentTrip(), { wrapper: setup(repository) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.overview.trip.name).toBe('Warsaw → Bangkok');
    expect(result.current.data?.overview.members).toHaveLength(2);
  });

  it('returns null when there are no trips', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const { result } = await renderHook(() => useCurrentTrip(), { wrapper: setup(repository) });
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
      updateDetails: () => Promise.reject(new Error('offline')),
      delete: () => Promise.reject(new Error('offline')),
      photos: () => Promise.reject(new Error('offline')),
      addPhoto: () => Promise.reject(new Error('offline')),
      deletePhoto: () => Promise.reject(new Error('offline')),
    };
    const { result } = await renderHook(() => useCurrentTrip(), { wrapper: setup(failing) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTripList (trips-drawer D4)', () => {
  it('returns every trip for the side panel', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const trip = await repository.create(createTripInputFixture());
    const { result } = await renderHook(() => useTripList(), { wrapper: setup(repository) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: trip.id, name: 'Warsaw → Bangkok', startDate: '2026-11-03', endDate: '2026-11-15' }]);
  });

  it('still asks the repository offline, which answers from the device copy', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const list = jest.fn(repository.list);
    onlineManager.setOnline(false);
    try {
      const { result } = await renderHook(() => useTripList(), { wrapper: setup({ ...repository, list }) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(list).toHaveBeenCalled();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('useSelectTrip (trips-drawer D2)', () => {
  async function twoTrips() {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const first = await repository.create(createTripInputFixture());
    const second = createTripInputFixture();
    second.details.name = 'Second trip';
    const created = await repository.create(second);
    return { repository, first, second: created };
  }

  it('remembers the choice and drops the previous trip at once: while the chosen one loads, there is no trip yet', async () => {
    const { repository, first, second } = await twoTrips();
    let hold = false;
    let release = () => {};
    const current = jest.fn(async () => {
      if (hold) await new Promise<void>((resolve) => (release = resolve));
      return repository.current();
    });
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), select: useSelectTrip() }), {
      wrapper: setup({ ...repository, current }),
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.id).toBe(second.id));
    // The start-up budget sync re-reads the trips once; let it finish first.
    await waitFor(() => expect(current).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.current.isFetching).toBe(false));
    hold = true;

    await act(async () => {
      await result.current.select.mutateAsync(first.id);
    });

    // Query updates reach the component a tick later; wait until it saw the choice succeed.
    await waitFor(() => expect(result.current.select.isSuccess).toBe(true));
    // The home screen shows its skeleton, never the previous trip under the new choice (Approach 5).
    expect(result.current.current.isPending).toBe(true);
    expect(result.current.current.data).toBeUndefined();
    await act(async () => release());
    await waitFor(() => expect(result.current.current.data?.overview.trip.id).toBe(first.id));
  });

  it('works offline: the choice is stored on the phone', async () => {
    const { repository, first } = await twoTrips();
    const select = jest.fn(repository.select);
    const { result } = await renderHook(() => useSelectTrip(), { wrapper: setup({ ...repository, select }) });
    onlineManager.setOnline(false);
    try {
      await act(async () => {
        await result.current.mutateAsync(first.id);
      });
      expect(select).toHaveBeenCalledWith(first.id);
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('useCreateTrip', () => {
  it('saves a trip and refreshes the current trip', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const wrapper = setup(repository);
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), create: useCreateTrip() }), { wrapper });
    await waitFor(() => expect(result.current.current.data).toBeNull());

    await act(async () => {
      await result.current.create.mutateAsync(createTripInputFixture());
    });

    await waitFor(() => expect(result.current.current.data?.overview.trip.name).toBe('Warsaw → Bangkok'));
  });

  it('shows a newly created trip as the current trip, also when there already is one (A3)', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    await repository.create(createTripInputFixture());
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), list: useTripList(), create: useCreateTrip() }), {
      wrapper: setup(repository),
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.name).toBe('Warsaw → Bangkok'));
    const second = createTripInputFixture();
    second.details.name = 'Second trip';

    await act(async () => {
      await result.current.create.mutateAsync(second);
    });

    await waitFor(() => expect(result.current.current.data?.overview.trip.name).toBe('Second trip'));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
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
  it('saves the budget, refreshes the current trip and starts a sync', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const trip = await repository.create(createTripInputFixture());
    const syncBudgets = jest.fn(async () => ({ nextAttemptAt: null }));
    const wrapper = setup({ ...repository, syncBudgets });
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), setBudget: useSetTripBudget() }), { wrapper });
    await waitFor(() => expect(result.current.current.isSuccess).toBe(true));
    syncBudgets.mockClear();

    await act(async () => {
      await result.current.setBudget.mutateAsync({ trip, amountMinor: 250000 });
    });

    await waitFor(() => expect(result.current.current.data?.overview.trip.budgetPerPerson.amountMinor).toBe(250000));
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

describe('useUpdateTripDetails (trip-edit-menu step 3)', () => {
  it('saves the name and cover, then the current trip and the list show the new name', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const trip = await repository.create(createTripInputFixture());
    const updateDetails = jest.fn(repository.updateDetails);
    const { result } = await renderHook(
      () => ({ current: useCurrentTrip(), list: useTripList(), update: useUpdateTripDetails() }),
      { wrapper: setup({ ...repository, updateDetails }) },
    );
    await waitFor(() => expect(result.current.current.data?.overview.trip.name).toBe('Warsaw → Bangkok'));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.update.mutateAsync({ tripId: trip.id, input: { name: 'Thailand 2026', coverImageUri: 'file:///cover.jpg' } });
    });

    expect(updateDetails).toHaveBeenCalledWith(trip.id, { name: 'Thailand 2026', coverImageUri: 'file:///cover.jpg' });
    await waitFor(() => expect(result.current.current.data?.overview.trip.name).toBe('Thailand 2026'));
    await waitFor(() => expect(result.current.list.data?.[0]?.name).toBe('Thailand 2026'));
  });

  it('reports a failed save and keeps the trip as it was', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const trip = await repository.create(createTripInputFixture());
    const failing: TripRepository = { ...repository, updateDetails: () => Promise.reject(new Error('down')) };
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), update: useUpdateTripDetails() }), {
      wrapper: setup(failing),
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.name).toBe('Warsaw → Bangkok'));

    await act(async () => {
      await result.current.update.mutateAsync({ tripId: trip.id, input: { name: 'Thailand 2026' } }).catch(() => {});
    });

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(result.current.current.data?.overview.trip.name).toBe('Warsaw → Bangkok');
  });
});

describe('useDeleteTrip (trip-edit-menu step 3)', () => {
  async function twoTrips() {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const first = await repository.create(createTripInputFixture());
    const second = createTripInputFixture();
    second.details.name = 'Second trip';
    const created = await repository.create(second);
    return { repository, first, second: created };
  }

  it('deletes the trip; the current trip falls back to the default trip and the list loses it (D9)', async () => {
    const { repository, first, second } = await twoTrips();
    const remove = jest.fn(repository.delete);
    let hold = false;
    let release = () => {};
    const current = jest.fn(async () => {
      if (hold) await new Promise<void>((resolve) => (release = resolve));
      return repository.current();
    });
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), list: useTripList(), remove: useDeleteTrip() }), {
      wrapper: setup({ ...repository, current, delete: remove }),
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.id).toBe(second.id));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    // The start-up budget sync re-reads the trips once; let it finish first.
    await waitFor(() => expect(current).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.current.isFetching).toBe(false));
    hold = true;

    // The mutation resolves only after the refetch (it is awaited), which is held here: do not await it yet.
    let deleted: Promise<void> = Promise.resolve();
    await act(async () => {
      deleted = result.current.remove.mutateAsync(second.id);
    });

    expect(remove).toHaveBeenCalledWith(second.id);
    // Never the deleted trip while the home screen refetches: the query was reset, not just invalidated.
    await waitFor(() => expect(result.current.current.isPending).toBe(true));
    expect(result.current.current.data).toBeUndefined();
    await waitFor(() => expect(current).toHaveBeenCalledTimes(3));
    await act(async () => {
      release();
      await deleted;
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.id).toBe(first.id));
    await waitFor(() => expect(result.current.list.data?.map((item) => item.id)).toEqual([first.id]));
  });

  it('leaves no current trip after the last one is deleted', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    const trip = await repository.create(createTripInputFixture());
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), list: useTripList(), remove: useDeleteTrip() }), {
      wrapper: setup(repository),
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.id).toBe(trip.id));

    await act(async () => {
      await result.current.remove.mutateAsync(trip.id);
    });

    await waitFor(() => expect(result.current.current.data).toBeNull());
    await waitFor(() => expect(result.current.list.data).toEqual([]));
  });

  it('reports a failed delete and keeps the current trip', async () => {
    const { repository, second } = await twoTrips();
    const failing: TripRepository = { ...repository, delete: () => Promise.reject(new Error('down')) };
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), remove: useDeleteTrip() }), {
      wrapper: setup(failing),
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.id).toBe(second.id));

    await act(async () => {
      await result.current.remove.mutateAsync(second.id).catch(() => {});
    });

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(result.current.current.data?.overview.trip.id).toBe(second.id);
  });

  it('cancels in-flight trips queries before it deletes (N7)', async () => {
    const { repository, second } = await twoTrips();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const cancelQueries = jest.spyOn(queryClient, 'cancelQueries');
    const remove = jest.fn(repository.delete);
    const { result } = await renderHook(() => ({ current: useCurrentTrip(), remove: useDeleteTrip() }), {
      wrapper: setup({ ...repository, delete: remove }, queryClient),
    });
    await waitFor(() => expect(result.current.current.data?.overview.trip.id).toBe(second.id));
    cancelQueries.mockClear();

    await act(async () => {
      await result.current.remove.mutateAsync(second.id);
    });

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['trips'] });
    expect(cancelQueries.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });
});

describe('useCurrentTrip offline', () => {
  it('still asks the repository, which answers from the device copy', async () => {
    const repository = createInMemoryTripRepository({ now: () => NOW, newId });
    await repository.create(createTripInputFixture());
    onlineManager.setOnline(false);
    try {
      const { result } = await renderHook(() => useCurrentTrip(), { wrapper: setup(repository) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
