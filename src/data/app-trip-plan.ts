import { supabase } from './supabase';
import { fetchPlaceDetails, fetchTripPlan, generateTripPlan } from './trip-plan';

import type { GenerateTripPlanRequest, PlaceDetailsRequest } from '@/schemas';

/** The trip-plan calls on the app's Supabase client. */
export const generateAppTripPlan = (request: GenerateTripPlanRequest) => generateTripPlan(supabase, request);
export const fetchAppTripPlan = (tripId: string) => fetchTripPlan(supabase, tripId);
export const fetchAppPlaceDetails = (placeIds: string[], locale: PlaceDetailsRequest['locale']) => fetchPlaceDetails(supabase, placeIds, locale);
