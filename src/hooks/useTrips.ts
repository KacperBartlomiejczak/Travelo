import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TripRepository } from '@/data/trip-repository';
import { useTripRepository } from '@/providers/AppProviders';

const TRIPS_KEY = ['trips'] as const;

/** Saved trips, soonest first. */
export function useTrips() {
  const repository = useTripRepository();
  return useQuery({ queryKey: TRIPS_KEY, queryFn: () => repository.list() });
}

export function useCreateTrip() {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<TripRepository['create']>[0]) => repository.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIPS_KEY }),
  });
}
