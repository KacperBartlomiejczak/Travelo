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
