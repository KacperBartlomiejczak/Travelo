import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TripRepository } from '@/data/trip-repository';
import { useTripRepository } from '@/providers/AppProviders';
import { useRequestBudgetSync } from '@/providers/BudgetSync';

const TRIPS_KEY = ['trips'] as const;
const CURRENT_KEY = [...TRIPS_KEY, 'current'] as const;

/** Every trip of the organizer, for the side panel (trips-drawer D4). */
export function useTripList() {
  const repository = useTripRepository();
  // 'always': offline the repository answers from the copy on the device (trips-drawer D3).
  return useQuery({ queryKey: [...TRIPS_KEY, 'list'], queryFn: () => repository.list(), networkMode: 'always' });
}

/** The chosen trip, else the default trip, with its members and flights; null when there are none (trips-drawer). */
export function useCurrentTrip() {
  const repository = useTripRepository();
  // 'always': offline the repository answers from the copy on the device (trips-supabase D6).
  return useQuery({ queryKey: CURRENT_KEY, queryFn: () => repository.current(), networkMode: 'always' });
}

/** Makes a trip the current one; the choice is stored on the phone, so it works offline (trips-drawer D2). */
export function useSelectTrip() {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => repository.select(tripId),
    networkMode: 'always',
    // Reset, not invalidate: the home screen shows its skeleton, never the previous trip under the new choice.
    // Not awaited, so the panel can close at once.
    onSuccess: () => {
      void queryClient.resetQueries({ queryKey: CURRENT_KEY });
    },
  });
}

export function useCreateTrip() {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<TripRepository['create']>[0]) => repository.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIPS_KEY }),
  });
}

type UpdateTripDetails = { tripId: string; input: Parameters<TripRepository['updateDetails']>[1] };

/** Changes the trip's name and cover on the server; online only, the UI disables it offline (trip-edit-menu D5). */
export function useUpdateTripDetails() {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, input }: UpdateTripDetails) => repository.updateDetails(tripId, input),
    // Awaited, so a caller that continues after the save already sees the new name.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIPS_KEY }),
  });
}

/** Deletes a trip on the server; online only, the UI disables it offline (trip-edit-menu D8). */
export function useDeleteTrip() {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => repository.delete(tripId),
    // Drops the result of a trips fetch that is already running, so it does not reach the query cache after the delete.
    // It does not abort the repository call: that keeps running and may still write the copies on the phone.
    onMutate: () => queryClient.cancelQueries({ queryKey: TRIPS_KEY }),
    // Reset, not invalidate: the home screen never shows the deleted trip, `current()` answers with the default trip
    // or null (trip-edit-menu D9). Awaited, so the caller sees the result.
    onSuccess: () =>
      Promise.all([
        queryClient.resetQueries({ queryKey: CURRENT_KEY }),
        queryClient.invalidateQueries({ queryKey: [...TRIPS_KEY, 'list'] }),
      ]),
  });
}

type SetBudget = { trip: Parameters<TripRepository['setBudget']>[0]; amountMinor: number };

/** Saves a new budget per person on the device, then sends it when possible (trips-supabase D1). */
export function useSetTripBudget() {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  const requestSync = useRequestBudgetSync();
  return useMutation({
    mutationFn: ({ trip, amountMinor }: SetBudget) => repository.setBudget(trip, amountMinor),
    // Saving never waits for the network.
    networkMode: 'always',
    // Not awaited: the trip is re-read from Supabase first, which must not hold the save up (weak connection).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
      requestSync();
    },
  });
}
