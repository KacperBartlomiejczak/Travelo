import { useQuery } from '@tanstack/react-query';

import { fetchAppPlaceDetails } from '@/data/app-trip-plan';
import type { PlaceDetails, PlaceDetailsRequest, TripPlan } from '@/schemas';

export const placeDetailsKey = (placeIds: string[], locale: PlaceDetailsRequest['locale']) => ['place-details', locale, [...placeIds].sort()] as const;

export const planPlaceIds = (plan: TripPlan) => [...new Set(plan.days.flatMap((day) => day.items.map((item) => item.placeId)))];

/**
 * Names and Maps links of stored place ids. In memory only (Google ToS allows storing just the placeId): staleTime/gcTime Infinity,
 * and the app persists no query cache.
 */
export function usePlaceDetails(placeIds: string[], locale: PlaceDetailsRequest['locale']) {
  return useQuery<Record<string, PlaceDetails>>({
    queryKey: placeDetailsKey(placeIds, locale),
    queryFn: () => fetchAppPlaceDetails(placeIds, locale),
    enabled: placeIds.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
