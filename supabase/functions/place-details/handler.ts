// Place details for saved trip plans (ai-trip-plan plan, step 6). Google ToS lets us store only placeId, so names,
// addresses and maps links are resolved at view time. No Deno globals: everything outside goes through
// `PlaceDetailsPorts`, so Jest tests it with fakes. index.ts wires the real ones.
import { PlaceDetailsRequestSchema, PlaceDetailsResponseSchema, PlaceDetailsSchema } from '../../../src/schemas/trip-plan.ts';
import type { PlaceDetails, PlaceDetailsResponse, TripPlanError } from '../../../src/schemas/trip-plan.ts';

export type AuthResult = { kind: 'user'; id: string } | { kind: 'invalid' };

/** Every port throws on an unexpected failure. */
export interface PlaceDetailsPorts {
  authenticate(jwt: string): Promise<AuthResult>;
  placeDetails(placeId: string, locale: 'pl' | 'en'): Promise<PlaceDetails>;
}

export interface PlaceDetailsHttpRequest {
  method: string;
  authorization: string | null;
  body: unknown;
}

export interface HandlerResponse {
  status: number;
  body: PlaceDetailsResponse | TripPlanError;
}

const fail = (status: number, error: TripPlanError['error']): HandlerResponse => ({ status, body: { error } });

export async function handlePlaceDetails(
  { method, authorization, body }: PlaceDetailsHttpRequest,
  ports: PlaceDetailsPorts,
): Promise<HandlerResponse> {
  if (method !== 'POST') return fail(405, 'invalid_input');
  const jwt = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
  if (!jwt) return fail(401, 'unauthorized');
  let auth: AuthResult;
  try {
    auth = await ports.authenticate(jwt);
  } catch {
    return fail(500, 'upstream_failed');
  }
  if (auth.kind === 'invalid') return fail(401, 'unauthorized');

  const input = PlaceDetailsRequestSchema.safeParse(body);
  if (!input.success) return fail(400, 'invalid_input');

  // A failed or malformed lookup is dropped; one aggregated warning, no ids or names.
  const settled = await Promise.allSettled(
    input.data.placeIds.map(async (id) => PlaceDetailsSchema.parse(await ports.placeDetails(id, input.data.locale))),
  );
  const places = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = settled.length - places.length;
  if (failed > 0) console.warn('details_failed', { count: failed });
  if (places.length === 0) return fail(502, 'upstream_failed');
  const response = PlaceDetailsResponseSchema.safeParse({ places });
  return response.success ? { status: 200, body: response.data } : fail(502, 'upstream_failed');
}
