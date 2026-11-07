// Place recommendations (places-legal-navbar plan, step C3). No Deno globals: everything outside goes through
// `RecommendPorts`, so Jest tests it with fakes. index.ts wires the real ones.
import { buildNearbySearchBody, parseNearbySearch } from '../../../src/lib/place-types.ts';
import { pickPlaces } from '../../../src/lib/place-picks.ts';
import {
  PLACE_REQUESTS_PER_DAY,
  RecommendPlacesRequestSchema,
  RecommendPlacesResponseSchema,
} from '../../../src/schemas/place.ts';
import type { Place, RecommendPlacesError, RecommendPlacesResponse } from '../../../src/schemas/place.ts';

export type AuthResult = { kind: 'user'; id: string } | { kind: 'invalid' };

/** Every port throws on an unexpected failure. */
export interface RecommendPorts {
  authenticate(jwt: string): Promise<AuthResult>;
  /** Remaining requests today, or null when the limit was already reached. */
  consumeQuota(userId: string, limit: number): Promise<number | null>;
  nearbySearch(body: unknown): Promise<unknown>;
  /** The model's JSON text. */
  pickWithGemini(prompt: string): Promise<string>;
}

export interface RecommendPlacesRequest {
  method: string;
  authorization: string | null;
  body: unknown;
}

export interface HandlerResponse {
  status: number;
  body: RecommendPlacesResponse | RecommendPlacesError;
}

const fail = (status: number, error: RecommendPlacesError['error']): HandlerResponse => ({ status, body: { error } });

/** Gemini sees only id, name and types of the candidates: no addresses, no coordinates. */
export function buildPicksPrompt(candidates: Place[], interests: string[], locale: 'pl' | 'en'): string {
  const language = locale === 'pl' ? 'Polish' : 'English';
  const list = candidates.map(({ placeId, name, types }) => ({ placeId, name, types }));
  return [
    'You recommend places for a group trip.',
    `Traveller interests: ${interests.join(', ')}.`,
    'Choose up to 10 places that best fit these interests, best first.',
    'Choose only from the given placeIds. Never invent places or ids.',
    `For each pick write a "reason" (at most 150 characters) in ${language}: why it fits these interests.`,
    `Candidates (JSON): ${JSON.stringify(list)}`,
  ].join('\n');
}

export async function handleRecommendPlaces(
  { method, authorization, body }: RecommendPlacesRequest,
  ports: RecommendPorts,
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

  const input = RecommendPlacesRequestSchema.safeParse(body);
  if (!input.success) return fail(400, 'invalid_input');

  // The quota is spent before Google is called, to cap cost; a later failure is not refunded.
  let remainingToday: number | null;
  try {
    remainingToday = await ports.consumeQuota(auth.id, PLACE_REQUESTS_PER_DAY); // user id from the token only
  } catch {
    return fail(500, 'upstream_failed');
  }
  if (remainingToday === null) return fail(429, 'limit_reached');

  let candidates: Place[];
  try {
    candidates = parseNearbySearch(await ports.nearbySearch(buildNearbySearchBody(input.data)));
  } catch {
    return fail(502, 'upstream_failed');
  }
  if (candidates.length === 0) return { status: 200, body: { places: [], remainingToday } };

  let output: string | undefined;
  try {
    output = await ports.pickWithGemini(buildPicksPrompt(candidates, input.data.interests, input.data.locale));
  } catch (error) {
    console.error('gemini_fallback', error instanceof Error ? error.message : 'unknown');
    output = undefined; // pickPlaces falls back to the candidates without a reason.
  }
  const places = pickPlaces(candidates, output);
  if (output !== undefined && places.every((place) => place.reason === null)) {
    console.warn('gemini_picks_empty', { candidates: candidates.length }); // output arrived but no pick survived
  }
  const response = RecommendPlacesResponseSchema.safeParse({ places, remainingToday });
  return response.success ? { status: 200, body: response.data } : fail(502, 'upstream_failed');
}
