import { useQuery } from '@tanstack/react-query';

import { fetchAppTripPlan } from '@/data/app-trip-plan';

export const tripPlanKey = (tripId: string) => ['trip-plan', tripId] as const;

/** The saved plan of a trip (null = none yet). Memory only, no automatic retries: the user retries. */
export function useTripPlan(tripId: string) {
  return useQuery({ queryKey: tripPlanKey(tripId), queryFn: () => fetchAppTripPlan(tripId), retry: false });
}
