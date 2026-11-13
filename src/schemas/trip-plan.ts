import { z } from 'zod';

// Deno resolves relative imports only with an explicit extension (allowImportingTsExtensions is on).
import { IataCodeSchema, IsoDateSchema, IsoDateTimeSchema } from './common.ts';

// AI trip plan (ai-trip-plan plan, step 1). Imported by the Deno Edge Functions too.

export const PLAN_RADII_KM = [50, 100, 200, 300] as const;
// Used by the generate Edge Function (step 2) to cap the cities in a plan.
export const MAX_PLAN_CITIES = 3;
// Used by the rate limit in step 2 and the remaining-count UI in step 5.
export const PLANS_PER_DAY = 3;
// Destination + 2 extra cities = MAX_PLAN_CITIES.
export const MAX_EXTRA_CITIES = 2;

const isUnique = (items: readonly unknown[]) => new Set(items).size === items.length;
const LocaleSchema = z.enum(['pl', 'en']);

export const PlanScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('city_only') }),
  z.object({ kind: z.literal('nearby'), radiusKm: z.union(PLAN_RADII_KM.map((km) => z.literal(km))) }),
]);
export type PlanScope = z.infer<typeof PlanScopeSchema>;

export const PlanPreferenceSchema = z.enum(['pace_relaxed', 'pace_intense', 'more_food', 'no_museums']);
export type PlanPreference = z.infer<typeof PlanPreferenceSchema>;

export const GenerateTripPlanRequestSchema = z.object({
  tripId: z.uuid(),
  scope: PlanScopeSchema,
  // IATA codes only: free text would reach the prompt (prompt-injection defence).
  extraCities: z.array(IataCodeSchema).max(MAX_EXTRA_CITIES).refine(isUnique, 'duplicate cities'),
  preferences: z
    .array(PlanPreferenceSchema)
    .max(4)
    .refine(isUnique, 'duplicate preferences')
    .refine((p) => !(p.includes('pace_relaxed') && p.includes('pace_intense')), 'conflicting pace'),
  locale: LocaleSchema,
});
export type GenerateTripPlanRequest = z.infer<typeof GenerateTripPlanRequestSchema>;

export const PlanSlotSchema = z.enum(['morning', 'afternoon', 'evening']);
export type PlanSlot = z.infer<typeof PlanSlotSchema>;

export const PlaceCategorySchema = z.enum(['food', 'nightlife', 'museum', 'outdoor', 'other']);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

export const PlanPersonIdSchema = z.string().regex(/^P[1-9]\d?$/);
export type PlanPersonId = z.infer<typeof PlanPersonIdSchema>;

// Model output (Gemini structured output).
export const GeneratedPlanItemSchema = z.object({
  placeId: z.string().min(1),
  slot: PlanSlotSchema,
  reason: z.string().max(200),
  forPeople: z.array(PlanPersonIdSchema).min(1),
});
export type GeneratedPlanItem = z.infer<typeof GeneratedPlanItemSchema>;

export const GeneratedPlanDaySchema = z.object({
  date: IsoDateSchema,
  cityId: IataCodeSchema,
  items: z.array(GeneratedPlanItemSchema).max(6),
});
export type GeneratedPlanDay = z.infer<typeof GeneratedPlanDaySchema>;

export const GeneratedPlanSchema = z.object({ days: z.array(GeneratedPlanDaySchema).min(1) });
export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

// Stored plan: only placeId is kept long-term (Google ToS); people are 'owner' or a member uuid.
export const PlanPersonRefSchema = z.union([z.literal('owner'), z.uuid()]);
export type PlanPersonRef = z.infer<typeof PlanPersonRefSchema>;

export const StoredPlanItemSchema = z.object({
  placeId: z.string().min(1),
  slot: PlanSlotSchema,
  reason: z.string().max(200),
  forPeople: z.array(PlanPersonRefSchema).min(1),
});
export type StoredPlanItem = z.infer<typeof StoredPlanItemSchema>;

export const StoredPlanDaySchema = z.object({
  date: IsoDateSchema,
  cityIata: IataCodeSchema,
  items: z.array(StoredPlanItemSchema).max(6),
});
export type StoredPlanDay = z.infer<typeof StoredPlanDaySchema>;

export const TripPlanSchema = z.object({
  tripId: z.uuid(),
  days: z.array(StoredPlanDaySchema).min(1),
  model: z.string().min(1),
  createdAt: IsoDateTimeSchema,
});
export type TripPlan = z.infer<typeof TripPlanSchema>;

export const PlaceDetailsRequestSchema = z.object({
  placeIds: z.array(z.string().min(1)).min(1).max(40).refine(isUnique, 'duplicate placeIds'),
  locale: LocaleSchema,
});
export type PlaceDetailsRequest = z.infer<typeof PlaceDetailsRequestSchema>;

export const PlaceDetailsSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable(),
  googleMapsUri: z.url(),
});
export type PlaceDetails = z.infer<typeof PlaceDetailsSchema>;

export const PlaceDetailsResponseSchema = z.object({ places: z.array(PlaceDetailsSchema) });
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;

export const GenerateTripPlanResponseSchema = z.object({
  plan: TripPlanSchema,
  places: z.array(PlaceDetailsSchema),
  remainingToday: z.int().nonnegative(),
});
export type GenerateTripPlanResponse = z.infer<typeof GenerateTripPlanResponseSchema>;

export const TripPlanErrorSchema = z.object({
  error: z.enum(['invalid_input', 'unauthorized', 'forbidden', 'limit_reached', 'no_places', 'upstream_failed']),
});
export type TripPlanError = z.infer<typeof TripPlanErrorSchema>;
