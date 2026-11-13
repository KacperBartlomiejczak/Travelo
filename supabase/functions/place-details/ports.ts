// The real ports of the place details handler. No Deno globals: the Supabase client, `fetch` and the secret are
// injected, so Jest tests it with fakes. Never log keys or tokens.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { PlaceDetailsPorts } from './handler.ts';

const TIMEOUT_MS = 10_000;
const FIELD_MASK = 'id,displayName,formattedAddress,googleMapsUri';

export interface PortsConfig {
  admin: SupabaseClient;
  fetch: typeof fetch;
  env: { placesApiKey: string };
}

// Raw Place Details (New) response; unknown keys are stripped.
const GooglePlaceDetailsSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ text: z.string().min(1) }),
  formattedAddress: z.string().optional(),
  googleMapsUri: z.url(),
});

export function createPorts({ admin, fetch, env }: PortsConfig): PlaceDetailsPorts {
  return {
    async authenticate(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (data.user) return { kind: 'user', id: data.user.id };
      // Only a rejected token is invalid; rate limits, 5xx and network errors are failures.
      if (error?.status === 401 || error?.status === 403) return { kind: 'invalid' };
      throw error ?? new Error('getUser returned no user');
    },
    async placeDetails(placeId, locale) {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${locale}`,
        {
          headers: { 'X-Goog-Api-Key': env.placesApiKey, 'X-Goog-FieldMask': FIELD_MASK },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (!res.ok) throw new Error(`Place Details failed: ${res.status}`);
      const place = GooglePlaceDetailsSchema.parse(await res.json());
      return {
        placeId: place.id,
        name: place.displayName.text,
        address: place.formattedAddress ?? null,
        googleMapsUri: place.googleMapsUri,
      };
    },
  };
}
