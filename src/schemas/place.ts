import { z } from 'zod';

// Deno resolves relative imports only with an explicit extension (allowImportingTsExtensions is on).
import { InterestTagSchema } from './interests.ts';

// Google Places + Gemini recommendations (places-legal-navbar plan, step C1). Imported by the Deno Edge Function too.
// `rating` / `userRatingCount` make the request Nearby Search Enterprise SKU (photos carousel plan, D7, verified
// 2026-11-07); everything else here is Pro, `places.photos` included (D1).

const LatitudeSchema = z.number().min(-90).max(90);
const LongitudeSchema = z.number().min(-180).max(180);
const LocationSchema = z.object({ latitude: LatitudeSchema, longitude: LongitudeSchema });
const LocalizedTextSchema = z.object({ text: z.string().min(1), languageCode: z.string().optional() });

const RatingSchema = z.number().min(1).max(5);
const RatingCountSchema = z.int().nonnegative();

// D2: photos per place shown in the carousel.
export const MAX_PLACE_PHOTOS = 3;

const PhotoAuthorSchema = z.object({ name: z.string().min(1), uri: z.url().optional() });

// Photo names must not be stored and can expire: resolve them to a photoUri in the same request.
export const GooglePlacePhotoSchema = z.object({
  // Interpolated into a URL that carries the API key: a single safe path shape only.
  name: z.string().regex(/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/),
  widthPx: z.int().positive(),
  heightPx: z.int().positive(),
  authorAttributions: z.array(z.object({ displayName: z.string().min(1), uri: z.url().optional() })).default([]),
});
export type GooglePlacePhoto = z.infer<typeof GooglePlacePhotoSchema>;

// What the app receives: a Google-hosted photoUri (no API key).
export const PlacePhotoSchema = z.object({
  uri: z.url(),
  width: z.int().positive(),
  height: z.int().positive(),
  authors: z.array(PhotoAuthorSchema),
});
export type PlacePhoto = z.infer<typeof PlacePhotoSchema>;

// Place Photos (New) with skipHttpRedirect=true: only the Google-hosted photoUri is used.
export const GooglePhotoMediaSchema = z.object({ photoUri: z.url() });

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
  // An out-of-range value from Google drops only that field, never the place.
  rating: RatingSchema.optional().catch(undefined),
  userRatingCount: RatingCountSchema.optional().catch(undefined),
  // One malformed photo is dropped, never the place.
  photos: z
    .array(z.unknown())
    .default([])
    .transform((items) => {
      const photos = items.flatMap((item) => {
        const photo = GooglePlacePhotoSchema.safeParse(item);
        return photo.success ? [photo.data] : [];
      });
      // Count only, never names: they end up in a URL with the API key.
      if (photos.length < items.length) console.warn('photo_invalid', { count: items.length - photos.length });
      return photos;
    }),
});
export type GooglePlace = z.infer<typeof GooglePlaceSchema>;

// Google returns `{}` when nothing matches.
export const GoogleNearbySearchResponseSchema = z.object({ places: z.array(GooglePlaceSchema).default([]) });
export type GoogleNearbySearchResponse = z.infer<typeof GoogleNearbySearchResponseSchema>;

const PlacePhotoRefSchema = z.object({
  name: z.string().min(1),
  width: z.int().positive(),
  height: z.int().positive(),
  authors: z.array(PhotoAuthorSchema),
});

export const PlaceSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  typeLabel: z.string().optional(),
  address: z.string().optional(),
  types: z.array(z.string()),
  location: LocationSchema,
  googleMapsUri: z.url(),
  rating: RatingSchema.optional(),
  ratingCount: RatingCountSchema.optional(),
  // Internal: never sent to Gemini or the app; resolved to `photos` by the Edge Function.
  photoRefs: z.array(PlacePhotoRefSchema),
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
export const PlaceRecommendationSchema = PlaceSchema.omit({ photoRefs: true }).extend({
  reason: z.string().max(200).nullable(),
  photos: z.array(PlacePhotoSchema).max(MAX_PLACE_PHOTOS),
});
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

// Place recommendation requests per user per UTC day (D17); the limit is passed to the database, not stored in SQL.
export const PLACE_REQUESTS_PER_DAY = 5;
