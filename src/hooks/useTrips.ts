import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TripRepository } from '@/data/trip-repository';
import { useTripRepository } from '@/providers/AppProviders';

const TRIPS_KEY = ['trips'] as const;

/** The soonest trip with its members and flights, or null when there are none (D4). */
export function useNearestTrip() {
  const repository = useTripRepository();
  return useQuery({ queryKey: [...TRIPS_KEY, 'nearest'], queryFn: () => repository.nearest() });
}

export function useCreateTrip() {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<TripRepository['create']>[0]) => repository.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIPS_KEY }),
  });
}
