import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { fetchAppPlaceRecommendations } from '@/data/app-places';
import { PlacesError, type PlacesErrorKind } from '@/data/places';
import type { RecommendPlacesRequest, RecommendPlacesResponse } from '@/schemas';

/** Same search = same key: interests in any order, city in any case. Locale stays, since it changes the language of the reasons. */
const keyOf = (request: RecommendPlacesRequest) =>
  ['places', request.city.trim().toLowerCase(), request.latitude, request.longitude, [...request.interests].sort(), request.locale] as const;

/**
 * Place recommendations (places step C4). Each call costs one of the user's 5 daily requests and Google money, so this is a
 * `useQuery` driven by the submitted request (`enabled` only after `search`), `staleTime`/`gcTime` Infinity (the same search in this
 * session is a cache hit, never a new call), no automatic retries or refetches (the user retries). Only in memory: Google allows
 * storing just the placeId, and the app persists no query cache.
 */
export function usePlaceRecommendations(fetcher: (request: RecommendPlacesRequest) => Promise<RecommendPlacesResponse> = fetchAppPlaceRecommendations) {
  const [submitted, setSubmitted] = useState<RecommendPlacesRequest | null>(null);
  const query = useQuery({
    queryKey: submitted ? keyOf(submitted) : ['places', 'idle'],
    queryFn: () => (submitted ? fetcher(submitted) : Promise.reject(new Error('no request'))),
    enabled: submitted !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const search = useCallback((request: RecommendPlacesRequest) => setSubmitted(request), []);
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);
  const error: PlacesErrorKind | null = query.error ? (query.error instanceof PlacesError ? query.error.kind : 'failed') : null;
  return { data: query.data, loading: query.isFetching, error, remainingToday: query.data?.remainingToday, search, retry };
}
