import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import {
  GenerateTripPlanRequestSchema,
  GenerateTripPlanResponseSchema,
  PlaceDetailsRequestSchema,
  PlaceDetailsResponseSchema,
  TripPlanErrorSchema,
  TripPlanSchema,
  type GenerateTripPlanRequest,
  type GenerateTripPlanResponse,
  type PlaceDetailsRequest,
  type PlaceDetails,
  type TripPlan,
} from '@/schemas';

import type { Database } from './database.types';

/** What the screen switches on; `failed` also covers an invalid answer. */
export type TripPlanErrorKind = 'offline' | 'limit_reached' | 'no_places' | 'forbidden' | 'unauthorized' | 'failed';

export class TripPlanCallError extends Error {
  constructor(
    readonly kind: TripPlanErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const PLACE_DETAILS_CHUNK = 40;

/** The error code the Edge Function put in its body, or null when there is none or it is unreadable. */
async function serverCode(response: Response): Promise<string | null> {
  try {
    const body = TripPlanErrorSchema.safeParse(await response.json());
    return body.success ? body.data.error : null;
  } catch {
    return null;
  }
}

async function invoke(supabase: SupabaseClient<Database>, name: string, body: object): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data;
  // `FunctionsFetchError` wraps the original fetch error: an AbortError is the withTimeout limit (server reachable but slow), not offline.
  if (error instanceof FunctionsFetchError) {
    const aborted = (error.context as { name?: string } | null)?.name === 'AbortError';
    throw new TripPlanCallError(aborted ? 'failed' : 'offline', error.message);
  }
  if (error instanceof FunctionsHttpError) {
    const code = await serverCode(error.context);
    const status = error.context.status;
    if (status === 429 && code === 'limit_reached') throw new TripPlanCallError('limit_reached', error.message);
    if (status === 422 && code === 'no_places') throw new TripPlanCallError('no_places', error.message);
    if (status === 403 && code === 'forbidden') throw new TripPlanCallError('forbidden', error.message);
    if (status === 401 || code === 'unauthorized') throw new TripPlanCallError('unauthorized', error.message);
  }
  throw new TripPlanCallError('failed', error.message);
}

/** Asks the `generate-trip-plan` Edge Function (waits up to 60 s, see `GENERATE_TRIP_PLAN_TIMEOUT_MS`). Costs one daily request. */
export async function generateTripPlan(supabase: SupabaseClient<Database>, request: GenerateTripPlanRequest): Promise<GenerateTripPlanResponse> {
  const body = GenerateTripPlanRequestSchema.safeParse(request);
  if (!body.success) throw new TripPlanCallError('failed', body.error.message);
  const response = GenerateTripPlanResponseSchema.safeParse(await invoke(supabase, 'generate-trip-plan', body.data));
  if (!response.success) throw new TripPlanCallError('failed', response.error.message);
  return response.data;
}

/** The saved plan of a trip, or null when none was generated yet. */
export async function fetchTripPlan(supabase: SupabaseClient<Database>, tripId: string): Promise<TripPlan | null> {
  const { data, error, status } = await supabase.from('trip_plans').select('trip_id, days, model, created_at').eq('trip_id', tripId).maybeSingle();
  if (error) throw new TripPlanCallError(status === 0 ? 'offline' : 'failed', error.message);
  if (!data) return null;
  const plan = TripPlanSchema.safeParse({ tripId: data.trip_id, days: data.days, model: data.model, createdAt: data.created_at });
  if (!plan.success) throw new TripPlanCallError('failed', plan.error.message);
  return plan.data;
}

/** Names and Maps links for stored place ids. Kept in memory only (Google ToS): no caching or persistence here. */
export async function fetchPlaceDetails(supabase: SupabaseClient<Database>, placeIds: string[], locale: PlaceDetailsRequest['locale']): Promise<Record<string, PlaceDetails>> {
  const unique = [...new Set(placeIds)];
  const result: Record<string, PlaceDetails> = {};
  for (let i = 0; i < unique.length; i += PLACE_DETAILS_CHUNK) {
    const body = PlaceDetailsRequestSchema.safeParse({ placeIds: unique.slice(i, i + PLACE_DETAILS_CHUNK), locale });
    if (!body.success) throw new TripPlanCallError('failed', body.error.message);
    const response = PlaceDetailsResponseSchema.safeParse(await invoke(supabase, 'place-details', body.data));
    if (!response.success) throw new TripPlanCallError('failed', response.error.message);
    for (const place of response.data.places) result[place.placeId] = place;
  }
  return result;
}
