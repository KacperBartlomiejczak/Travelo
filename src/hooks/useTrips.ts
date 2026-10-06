import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TripRepository } from '@/data/trip-repository';
import { useTripRepository } from '@/providers/AppProviders';
import { useRequestBudgetSync } from '@/providers/BudgetSync';

const TRIPS_KEY = ['trips'] as const;

/** The soonest trip with its members and flights, or null when there are none (D4). */
export function useNearestTrip() {
  const repository = useTripRepository();
  // 'always': offline the repository answers from the copy on the device (trips-supabase D6).
  return useQuery({ queryKey: [...TRIPS_KEY, 'nearest'], queryFn: () => repository.nearest(), networkMode: 'always' });
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
      requestSync();
    },
  });
}
