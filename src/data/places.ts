import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import {
  RecommendPlacesErrorSchema,
  RecommendPlacesRequestSchema,
  RecommendPlacesResponseSchema,
  type RecommendPlacesRequest,
  type RecommendPlacesResponse,
} from '@/schemas';

import type { Database } from './database.types';

/** What the screen switches on: the daily limit is spent, no answer, not signed in, or anything else (incl. an invalid answer). */
export type PlacesErrorKind = 'limit_reached' | 'offline' | 'unauthorized' | 'failed';

export class PlacesError extends Error {
  constructor(
    readonly kind: PlacesErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/** The error code the Edge Function put in its body, or null when there is none or it is unreadable. */
async function serverCode(response: Response): Promise<string | null> {
  try {
    const body = RecommendPlacesErrorSchema.safeParse(await response.json());
    return body.success ? body.data.error : null;
  } catch {
    return null;
  }
}

/** Asks the `recommend-places` Edge Function (places step C4). Every call costs the user one of the daily requests. */
export async function fetchPlaceRecommendations(
  request: RecommendPlacesRequest,
  { supabase }: { supabase: SupabaseClient<Database> },
): Promise<RecommendPlacesResponse> {
  const body = RecommendPlacesRequestSchema.safeParse(request);
  if (!body.success) throw new PlacesError('failed', body.error.message);
  const { data, error } = await supabase.functions.invoke('recommend-places', { body: body.data });
  if (error) {
    if (error instanceof FunctionsFetchError) throw new PlacesError('offline', error.message);
    if (error instanceof FunctionsHttpError) {
      const code = await serverCode(error.context);
      if (error.context.status === 429 && code === 'limit_reached') throw new PlacesError('limit_reached', error.message);
      if (error.context.status === 401 || code === 'unauthorized') throw new PlacesError('unauthorized', error.message);
    }
    throw new PlacesError('failed', error.message);
  }
  const response = RecommendPlacesResponseSchema.safeParse(data);
  if (!response.success) throw new PlacesError('failed', response.error.message);
  return response.data;
}
