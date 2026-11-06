import { z } from 'zod';

// Deno resolves relative imports only with an explicit extension (allowImportingTsExtensions is on).
import { InterestTagSchema } from './interests.ts';

// Google Places + Gemini recommendations (places-legal-navbar plan, step C1). Imported by the Deno Edge Function too.
// Only Nearby Search Pro SKU fields: no rating, no photos (D15).

const LatitudeSchema = z.number().min(-90).max(90);
const LongitudeSchema = z.number().min(-180).max(180);
const LocationSchema = z.object({ latitude: LatitudeSchema, longitude: LongitudeSchema });
const LocalizedTextSchema = z.object({ text: z.string().min(1), languageCode: z.string().optional() });

// Raw Nearby Search (New) place; unknown keys are stripped.
export const GooglePlaceSchema = z.object({
  id: z.string().min(1),
  displayName: LocalizedTextSchema,
  formattedAddress: z.string().optional(),
  location: LocationSchema,
  types: z.array(z.string()).default([]),
  googleMapsUri: z.url(),
  primaryType: z.string().optional(),
  primaryTypeDisplayName: LocalizedTextSchema.optional(),
});
export type GooglePlace = z.infer<typeof GooglePlaceSchema>;

// Google returns `{}` when nothing matches.
export const GoogleNearbySearchResponseSchema = z.object({ places: z.array(GooglePlaceSchema).default([]) });
export type GoogleNearbySearchResponse = z.infer<typeof GoogleNearbySearchResponseSchema>;

export const PlaceSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  typeLabel: z.string().optional(),
  address: z.string().optional(),
  types: z.array(z.string()),
  location: LocationSchema,
  googleMapsUri: z.url(),
});
export type Place = z.infer<typeof PlaceSchema>;

export const RecommendPlacesRequestSchema = z.object({
  city: z.string().trim().min(1).max(100),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  interests: z.array(InterestTagSchema).min(1),
  locale: z.enum(['pl', 'en']),
});
export type RecommendPlacesRequest = z.infer<typeof RecommendPlacesRequestSchema>;

// `reason` is null when Gemini failed.
export const PlaceRecommendationSchema = PlaceSchema.extend({ reason: z.string().max(200).nullable() });
export type PlaceRecommendation = z.infer<typeof PlaceRecommendationSchema>;

export const RecommendPlacesResponseSchema = z.object({
  places: z.array(PlaceRecommendationSchema).max(10),
  remainingToday: z.int().nonnegative(),
});
export type RecommendPlacesResponse = z.infer<typeof RecommendPlacesResponseSchema>;

// Gemini structured output: the model only picks candidates by placeId.
export const GeminiPlacePicksSchema = z.object({
  picks: z.array(z.object({ placeId: z.string().min(1), reason: z.string().min(1).max(200) })).max(10),
});
export type GeminiPlacePicks = z.infer<typeof GeminiPlacePicksSchema>;

export const RecommendPlacesErrorSchema = z.object({
  error: z.enum(['invalid_input', 'unauthorized', 'limit_reached', 'upstream_failed']),
});
export type RecommendPlacesError = z.infer<typeof RecommendPlacesErrorSchema>;
