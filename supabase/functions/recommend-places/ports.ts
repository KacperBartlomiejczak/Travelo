// The real ports of the place recommendation handler. No Deno globals: the Supabase client, `fetch` and the secrets
// are injected, so Jest tests it with fakes. Never log keys, tokens or request bodies.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { NEARBY_FIELD_MASK } from '../../../src/lib/place-types.ts';
import { GeminiPlacePicksSchema } from '../../../src/schemas/place.ts';
import type { RecommendPorts } from './handler.ts';

const TIMEOUT_MS = 10_000;
const GEMINI_TIMEOUT_MS = 20_000; // Gemini 3 is slow even at low thinking

export interface PortsConfig {
  admin: SupabaseClient;
  fetch: typeof fetch;
  env: { placesApiKey: string; geminiApiKey: string; geminiModel: string };
}

// Gemini's responseJsonSchema takes the plain schema without the `$schema` marker.
const { $schema: _marker, ...picksJsonSchema } = z.toJSONSchema(GeminiPlacePicksSchema);

export function createPorts({ admin, fetch, env }: PortsConfig): RecommendPorts {
  return {
    async authenticate(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (data.user) return { kind: 'user', id: data.user.id };
      // Only a rejected token is invalid; rate limits, 5xx and network errors are failures.
      if (error?.status === 401 || error?.status === 403) return { kind: 'invalid' };
      throw error ?? new Error('getUser returned no user');
    },
    async consumeQuota(userId, limit) {
      const { data, error } = await admin.rpc('consume_ai_quota', { p_user_id: userId, p_limit: limit });
      if (error) throw error;
      return z.number().int().nonnegative().nullable().parse(data); // invalid result throws -> upstream failure
    },
    async nearbySearch(body) {
      const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.placesApiKey,
          'X-Goog-FieldMask': NEARBY_FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Nearby Search failed: ${res.status}`);
      return res.json();
    },
    async pickWithGemini(prompt) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: picksJsonSchema,
              thinkingConfig: { thinkingLevel: 'low' }, // Gemini 3 defaults to high, which timed out
            },
          }),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
      );
      if (!res.ok) {
        // Google's error body carries only code/status/message, no secrets.
        const detail = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string } };
        const parts = ['Gemini failed:', res.status, detail.error?.status, detail.error?.message];
        throw new Error(parts.filter(Boolean).join(' '));
      }
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') throw new Error('Gemini returned no text');
      return text;
    },
  };
}
