import { z } from 'zod';

export const InterestTagSchema = z.enum([
  'nightlife',
  'theme_parks',
  'concerts_festivals',
  'mountains_hiking',
  'beaches',
  'nature_parks',
  'museums',
  'landmarks',
  'art_galleries',
  'local_cuisine',
  'cafes_desserts',
  'street_food',
  'water_sports',
  'cycling',
  'spa_wellness',
  'shopping',
  'photography',
]);
export type InterestTag = z.infer<typeof InterestTagSchema>;

export const InterestGroupSchema = z.enum(['fun', 'nature', 'culture', 'food', 'active', 'relax']);
export type InterestGroup = z.infer<typeof InterestGroupSchema>;

/** Display grouping of interests (D11), in display order. */
export const INTEREST_GROUPS: Record<InterestGroup, readonly InterestTag[]> = {
  fun: ['nightlife', 'theme_parks', 'concerts_festivals'],
  nature: ['mountains_hiking', 'beaches', 'nature_parks'],
  culture: ['museums', 'landmarks', 'art_galleries'],
  food: ['local_cuisine', 'cafes_desserts', 'street_food'],
  active: ['water_sports', 'cycling'],
  relax: ['spa_wellness', 'shopping', 'photography'],
};
