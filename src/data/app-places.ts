import { fetchPlaceRecommendations } from './places';
import { supabase } from './supabase';

import type { RecommendPlacesRequest } from '@/schemas';

/** `fetchPlaceRecommendations` on the app's Supabase client. */
export const fetchAppPlaceRecommendations = (request: RecommendPlacesRequest) => fetchPlaceRecommendations(request, { supabase });
