// AI trip plan (ai-trip-plan plan, step 5). No Deno globals: everything outside goes through `GeneratePlanPorts`, so
// Jest tests it with fakes. index.ts wires the real ones. Logs carry event names only: never prompts, names or ids.
import { placeCategory } from '../../../src/lib/plan-categories.ts';
import { planCandidateCities } from '../../../src/lib/plan-cities.ts';
import { planPeople } from '../../../src/lib/plan-people.ts';
import { buildPlanData, buildSystemInstruction, localTime, type PlanDataInput } from '../../../src/lib/plan-prompt.ts';
import { validateGeneratedPlan } from '../../../src/lib/plan-validate.ts';
import { buildNearbySearchBody, parseNearbySearch } from '../../../src/lib/place-types.ts';
import type { Airport } from '../../../src/schemas/airport.ts';
import type { InterestTag } from '../../../src/schemas/interests.ts';
import type { Place } from '../../../src/schemas/place.ts';
import {
  GenerateTripPlanRequestSchema,
  GenerateTripPlanResponseSchema,
  GeneratedPlanSchema,
  PLANS_PER_DAY,
} from '../../../src/schemas/trip-plan.ts';
import type {
  GenerateTripPlanResponse,
  PlaceDetails,
  TripPlan,
  TripPlanError,
} from '../../../src/schemas/trip-plan.ts';

export type AuthResult = { kind: 'user'; id: string } | { kind: 'invalid' };

export interface PlanTrip {
  ownerId: string;
  destination: string;
  startDate: string;
  endDate: string;
  ownerInterests: InterestTag[];
  /** Friends of the organizer (the organizer's own member row is excluded). */
  members: { id: string; interests: InterestTag[] }[];
  segments: {
    direction: 'outbound' | 'return' | 'internal';
    order: number;
    fromIata: string;
    toIata: string;
    departAt: string;
    departTz: string;
    arriveAt: string;
    arriveTz: string;
  }[];
}

/** Every port throws on an unexpected failure. */
export interface GeneratePlanPorts {
  /** The Gemini model id from env; stored with the plan. */
  model: string;
  airports: readonly Airport[];
  authenticate(jwt: string): Promise<AuthResult>;
  /** Service-role read; null when the trip does not exist. */
  loadTrip(tripId: string): Promise<PlanTrip | null>;
  /** Remaining plans today, or null when the limit was already reached. */
  consumeQuota(userId: string, limit: number): Promise<number | null>;
  refundQuota(userId: string): Promise<void>;
  nearbySearch(body: unknown): Promise<unknown>;
  /** The model's JSON text. */
  generateWithGemini(input: { systemInstruction: string; data: string }): Promise<string>;
  /** Upsert per trip. */
  savePlan(plan: TripPlan): Promise<void>;
}

export interface GenerateTripPlanRequest {
  method: string;
  authorization: string | null;
  body: unknown;
}

export interface HandlerResponse {
  status: number;
  body: GenerateTripPlanResponse | TripPlanError;
}

const fail = (status: number, error: TripPlanError['error']): HandlerResponse => ({ status, body: { error } });

// Every calendar date from start to end, inclusive (UTC arithmetic, no time zones involved).
function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export async function handleGenerateTripPlan(
  { method, authorization, body }: GenerateTripPlanRequest,
  ports: GeneratePlanPorts,
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
  const userId = auth.id;

  const input = GenerateTripPlanRequestSchema.safeParse(body);
  if (!input.success) return fail(400, 'invalid_input');
  const request = input.data;

  let trip: PlanTrip | null;
  try {
    trip = await ports.loadTrip(request.tripId);
  } catch {
    return fail(500, 'upstream_failed');
  }
  // A missing trip and someone else's trip look the same: existence is not leaked. Linked members cannot generate.
  if (!trip || trip.ownerId !== userId) return fail(403, 'forbidden');

  // The quota is spent before Google is called (cost cap); every later failure gives it back (D9).
  let remainingToday: number | null;
  try {
    remainingToday = await ports.consumeQuota(userId, PLANS_PER_DAY);
  } catch {
    return fail(500, 'upstream_failed');
  }
  if (remainingToday === null) return fail(429, 'limit_reached');

  const failRefunded = async (
    status: number,
    error: TripPlanError['error'],
    event: string,
  ): Promise<HandlerResponse> => {
    console.error(event);
    try {
      await ports.refundQuota(userId);
    } catch {
      console.error('refund_failed');
    }
    return fail(status, error);
  };

  const generate = async (): Promise<HandlerResponse> => {
    const dates = datesBetween(trip.startDate, trip.endDate);
    const bySegment = (direction: 'outbound' | 'return') =>
      trip.segments.filter((s) => s.direction === direction).sort((a, b) => a.order - b.order);
    const outbound = bySegment('outbound');
    const lastOutbound = outbound[outbound.length - 1];
    const firstReturn = bySegment('return')[0];

    const cities = planCandidateCities({
      destination: trip.destination,
      scope: request.scope,
      extraCities: request.extraCities,
      arrival: lastOutbound?.toIata,
      departure: firstReturn?.fromIata,
      dayCount: dates.length,
      airports: ports.airports,
    });
    if (cities.length === 0) return failRefunded(502, 'upstream_failed', 'cities_unknown');

    const { people, refs } = planPeople({ interests: trip.ownerInterests }, trip.members);
    const interests = [...new Set(people.flatMap((p) => p.interests))];

    const candidates: PlanDataInput['candidates'][number][] = [];
    const placesById = new Map<string, Place>();
    try {
      const found = await Promise.all(
        cities.map(async (city) =>
          parseNearbySearch(
            await ports.nearbySearch(
              buildNearbySearchBody({
                latitude: city.latitude,
                longitude: city.longitude,
                interests,
                locale: request.locale,
              }),
            ),
          ),
        ),
      );
      found.forEach((places, i) => {
        for (const place of places) {
          if (placesById.has(place.placeId)) continue; // the first city keeps a place that two searches both return
          placesById.set(place.placeId, place);
          candidates.push({
            placeId: place.placeId,
            cityId: cities[i]!.cityId,
            name: place.name,
            category: placeCategory(place.types),
            types: place.types,
          });
        }
      });
    } catch {
      return failRefunded(502, 'upstream_failed', 'places_failed');
    }
    if (candidates.length === 0) return failRefunded(422, 'no_places', 'no_candidates');

    // A trip airport the city list dropped (same city, other airport) maps to the city that is in the list.
    const cityIdFor = (iata: string | undefined) => {
      if (!iata) return undefined;
      if (cities.some((c) => c.cityId === iata)) return iata;
      const name = ports.airports.find((a) => a.iata === iata)?.city;
      return cities.find((c) => c.name === name)?.cityId;
    };

    let text: string;
    try {
      text = await ports.generateWithGemini({
        systemInstruction: buildSystemInstruction(request.locale),
        data: buildPlanData({
          dates,
          arriveLocalTime: lastOutbound && localTime(lastOutbound.arriveAt, lastOutbound.arriveTz),
          departLocalTime: firstReturn && localTime(firstReturn.departAt, firstReturn.departTz),
          destinationCityId: cities[0]!.cityId,
          arrivalCityId: cityIdFor(lastOutbound?.toIata),
          departureCityId: cityIdFor(firstReturn?.fromIata),
          cities,
          people,
          preferences: request.preferences,
          candidates,
        }),
      });
    } catch {
      return failRefunded(502, 'upstream_failed', 'gemini_failed');
    }

    let generated;
    try {
      generated = GeneratedPlanSchema.safeParse(JSON.parse(text));
    } catch {
      return failRefunded(502, 'upstream_failed', 'plan_invalid');
    }
    if (!generated.success) return failRefunded(502, 'upstream_failed', 'plan_invalid');

    const placesByCity: Record<string, Set<string>> = Object.fromEntries(
      cities.map((c) => [c.cityId, new Set<string>()]),
    );
    for (const c of candidates) placesByCity[c.cityId]!.add(c.placeId);
    const validated = validateGeneratedPlan({
      plan: generated.data,
      placesByCity,
      allowedCities: cities.map((c) => c.cityId),
      dates,
      refs,
    });
    if (!validated.ok) return failRefunded(502, 'upstream_failed', 'plan_invalid');

    const plan: TripPlan = {
      tripId: request.tripId,
      days: validated.days,
      model: ports.model,
      createdAt: new Date().toISOString(),
    };
    const places: PlaceDetails[] = [...new Set(plan.days.flatMap((d) => d.items.map((i) => i.placeId)))].flatMap(
      (id) => {
        const place = placesById.get(id);
        return place
          ? [
              {
                placeId: id,
                name: place.name,
                address: place.address ?? null,
                googleMapsUri: place.googleMapsUri,
              },
            ]
          : [];
      },
    );
    const response = GenerateTripPlanResponseSchema.safeParse({
      plan,
      places,
      remainingToday,
    });
    if (!response.success) return failRefunded(502, 'upstream_failed', 'response_invalid');

    try {
      await ports.savePlan(plan); // D15: overwrites the trip's previous plan
    } catch {
      return failRefunded(502, 'upstream_failed', 'save_failed');
    }
    return { status: 200, body: response.data };
  };

  // Any unexpected throw after the quota was spent still gives it back.
  try {
    return await generate();
  } catch {
    return failRefunded(500, 'upstream_failed', 'unexpected_failed');
  }
}
