import { useMutation, useQueryClient } from '@tanstack/react-query';

import { generateAppTripPlan } from '@/data/app-trip-plan';
import { placeDetailsKey, planPlaceIds } from '@/hooks/usePlaceDetails';
import { tripPlanKey } from '@/hooks/useTripPlan';
import type { GenerateTripPlanRequest, PlaceDetails } from '@/schemas';

/** Generates a plan (one daily request). On success the plan and its place details go straight into the caches, so no second call. */
export function useGenerateTripPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: GenerateTripPlanRequest) => generateAppTripPlan(request),
    onSuccess: ({ plan, places }, request) => {
      queryClient.setQueryData(tripPlanKey(plan.tripId), plan);
      queryClient.setQueryData<Record<string, PlaceDetails>>(
        placeDetailsKey(planPlaceIds(plan), request.locale),
        Object.fromEntries(places.map((place) => [place.placeId, place])),
      );
    },
  });
}
