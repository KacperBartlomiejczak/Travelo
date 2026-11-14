import type { PlaceCategory } from '../schemas/trip-plan.ts';

// Google Places (New) Table A types; unlisted types fall through to 'other'.
const CATEGORY_BY_TYPE: Record<string, PlaceCategory> = {
  restaurant: 'food',
  cafe: 'food',
  bakery: 'food',
  dessert_shop: 'food',
  ice_cream_shop: 'food',
  food_court: 'food',
  snack_bar: 'food',
  kebab_shop: 'food',
  hot_dog_stand: 'food',
  bar: 'nightlife',
  night_club: 'nightlife',
  pub: 'nightlife',
  museum: 'museum',
  art_museum: 'museum',
  history_museum: 'museum',
  art_gallery: 'museum',
  park: 'outdoor',
  national_park: 'outdoor',
  botanical_garden: 'outdoor',
  nature_preserve: 'outdoor',
  hiking_area: 'outdoor',
  mountain_peak: 'outdoor',
  beach: 'outdoor',
  marina: 'outdoor',
  cycling_park: 'outdoor',
};

// The first type with a mapping wins (Google lists the most specific type first).
export const placeCategory = (types: readonly string[]): PlaceCategory => {
  for (const type of types) {
    const category = CATEGORY_BY_TYPE[type];
    if (category) return category;
  }
  return 'other';
};
