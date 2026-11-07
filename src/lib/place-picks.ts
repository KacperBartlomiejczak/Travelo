// Shared with the Deno Edge Function: import only zod and schema files with explicit .ts extensions.
import { z } from 'zod';
import { GeminiPlacePicksSchema, type Place, type PlaceRecommendation } from '../schemas/place.ts';

export const MAX_PICKS = 10;

const PickSchema = GeminiPlacePicksSchema.shape.picks.element;

// Photos are filled in by the Edge Function after picking; photoRefs never leave it.
const recommend = ({ photoRefs, ...place }: Place, reason: string | null): PlaceRecommendation => {
  void photoRefs;
  return { ...place, reason, photos: [] };
};

const fallback = (candidates: Place[]): PlaceRecommendation[] =>
  candidates.slice(0, MAX_PICKS).map((place) => recommend(place, null));

// `geminiOutput`: parsed object, JSON text, or undefined when the call failed.
export const pickPlaces = (candidates: Place[], geminiOutput: unknown): PlaceRecommendation[] => {
  let raw = geminiOutput;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return fallback(candidates);
    }
  }
  // Gemini ignores min/maxLength, so validate each pick on its own instead of the whole output.
  const outer = z.object({ picks: z.array(z.unknown()) }).safeParse(raw);
  if (!outer.success) return fallback(candidates);
  const picks = outer.data.picks.flatMap((item) => {
    const pick = PickSchema.safeParse(item);
    return pick.success ? [pick.data] : [];
  });

  const byId = new Map(candidates.map((place) => [place.placeId, place]));
  const result: PlaceRecommendation[] = [];
  const seen = new Set<string>();
  for (const { placeId, reason } of picks) {
    const place = byId.get(placeId);
    if (!place || seen.has(placeId)) continue;
    seen.add(placeId);
    result.push(recommend(place, reason));
  }
  return result.length > 0 ? result.slice(0, MAX_PICKS) : fallback(candidates);
};
