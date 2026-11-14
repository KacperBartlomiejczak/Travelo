import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';

import { generateAppTripPlan } from '@/data/app-trip-plan';
import { placeDetailsKey, planPlaceIds } from '@/hooks/usePlaceDetails';
import { tripPlanKey } from '@/hooks/useTripPlan';
import type { GenerateTripPlanRequest, PlaceDetails } from '@/schemas';

const generateTripPlanKey = (tripId: string) => ['generate-trip-plan', tripId] as const;

/** Generates a plan (one daily request). On success the plan and its place details go straight into the caches, so no second call. */
export function useGenerateTripPlan(tripId: string) {
  const queryClient = useQueryClient();
  const mutationKey = generateTripPlanKey(tripId);
  // Counts across observers, so a remounted screen still knows a generation for this trip is running.
  const inFlight = useIsMutating({ mutationKey }) > 0;
  const mutation = useMutation({
    mutationKey,
    mutationFn: (request: GenerateTripPlanRequest) => generateAppTripPlan(request),
    onSuccess: async ({ plan, places }, request) => {
      // A read started before the generation must not land on top of the fresh plan.
      await queryClient.cancelQueries({ queryKey: tripPlanKey(plan.tripId) });
      queryClient.setQueryData(tripPlanKey(plan.tripId), plan);
      queryClient.setQueryData<Record<string, PlaceDetails>>(
        placeDetailsKey(planPlaceIds(plan), request.locale),
        Object.fromEntries(places.map((place) => [place.placeId, place])),
      );
    },
  });
  return { ...mutation, isPending: mutation.isPending || inFlight };
}
