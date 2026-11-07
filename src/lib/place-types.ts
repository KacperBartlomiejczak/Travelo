// Shared with the Deno Edge Function: import only zod and schema files with explicit .ts extensions.
import type { InterestTag } from '../schemas/interests.ts';
import { GoogleNearbySearchResponseSchema, MAX_PLACE_PHOTOS, type Place } from '../schemas/place.ts';

// Google Places (New) Table A types, verified 2026-11-06.
export const INTEREST_PLACE_TYPES: Record<InterestTag, readonly string[]> = {
  nightlife: ['bar', 'night_club', 'pub'],
  theme_parks: ['amusement_park', 'water_park'],
  concerts_festivals: ['concert_hall', 'live_music_venue', 'amphitheatre', 'performing_arts_theater'],
  mountains_hiking: ['hiking_area', 'mountain_peak', 'national_park'],
  beaches: ['beach'],
  nature_parks: ['park', 'national_park', 'botanical_garden', 'nature_preserve'],
  museums: ['museum', 'art_museum', 'history_museum'],
  landmarks: ['tourist_attraction', 'historical_landmark', 'monument', 'castle'],
  art_galleries: ['art_gallery', 'art_museum'],
  local_cuisine: ['restaurant'],
  cafes_desserts: ['cafe', 'bakery', 'dessert_shop', 'ice_cream_shop'],
  street_food: ['food_court', 'snack_bar', 'kebab_shop', 'hot_dog_stand'],
  water_sports: ['marina', 'beach'],
  cycling: ['cycling_park', 'park'],
  spa_wellness: ['spa', 'sauna', 'wellness_center'],
  shopping: ['shopping_mall', 'market'],
  photography: ['observation_deck', 'scenic_spot', 'tourist_attraction'],
};

// City coordinates come from the city's airport, which can be far from the centre.
export const SEARCH_RADIUS_METERS = 20000;

// Nearby Search Pro SKU only (places.photos is Pro too): no rating / opening hours (Enterprise).
export const NEARBY_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri,places.primaryType,places.primaryTypeDisplayName,places.photos';

// Google caps includedTypes at 50.
export const placeTypesFor = (interests: InterestTag[]): string[] =>
  [...new Set(interests.flatMap((tag) => INTEREST_PLACE_TYPES[tag]))].slice(0, 50);

export const buildNearbySearchBody = (input: {
  latitude: number;
  longitude: number;
  interests: InterestTag[];
  locale: 'pl' | 'en';
}) => ({
  includedTypes: placeTypesFor(input.interests),
  maxResultCount: 20,
  languageCode: input.locale,
  locationRestriction: {
    circle: { center: { latitude: input.latitude, longitude: input.longitude }, radius: SEARCH_RADIUS_METERS },
  },
});

export const parseNearbySearch = (raw: unknown): Place[] => {
  const parsed = GoogleNearbySearchResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid Nearby Search response: ${parsed.error.message}`);
  const byId = new Map<string, Place>();
  for (const g of parsed.data.places) {
    if (byId.has(g.id)) continue;
    byId.set(g.id, {
      placeId: g.id,
      name: g.displayName.text,
      typeLabel: g.primaryTypeDisplayName?.text,
      address: g.formattedAddress,
      types: g.types,
      location: g.location,
      googleMapsUri: g.googleMapsUri,
      photoRefs: g.photos.slice(0, MAX_PLACE_PHOTOS).map((photo) => ({
        name: photo.name,
        width: photo.widthPx,
        height: photo.heightPx,
        authors: photo.authorAttributions.map((a) => ({ name: a.displayName, uri: a.uri })),
      })),
    });
  }
  return [...byId.values()];
};
