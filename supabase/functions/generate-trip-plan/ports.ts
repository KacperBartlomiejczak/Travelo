// The real ports of the trip plan handler. No Deno globals: the Supabase client, `fetch`, the secrets and the airport
// list are injected, so Jest tests it with fakes. Never log keys, tokens, prompts or request bodies.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { NEARBY_FIELD_MASK } from '../../../src/lib/place-types.ts';
import type { Airport } from '../../../src/schemas/airport.ts';
import { InterestTagSchema } from '../../../src/schemas/interests.ts';
import { GeneratedPlanSchema } from '../../../src/schemas/trip-plan.ts';
import type { GeneratePlanPorts, PlanTrip } from './handler.ts';

const PLACES_TIMEOUT_MS = 10_000;
// The app waits 60 s: Places (10 s) + Gemini (40 s) + DB stay under it, so the refund and the error reach the app.
export const GEMINI_TIMEOUT_MS = 40_000;
const QUOTA_KIND = 'trip_plan';

export interface PortsConfig {
  admin: SupabaseClient;
  fetch: typeof fetch;
  env: { placesApiKey: string; geminiApiKey: string; geminiModel: string };
  airports: readonly Airport[];
}

// Gemini's responseJsonSchema takes the plain schema without the `$schema` marker.
const { $schema: _marker, ...planJsonSchema } = z.toJSONSchema(GeneratedPlanSchema);

const interests = z.array(InterestTagSchema);
const TripRowSchema = z.object({
  owner_id: z.string(),
  destination: z.string(),
  start_date: z.string(),
  end_date: z.string(),
});
const MemberRowsSchema = z.array(z.object({ id: z.string(), role: z.string(), interests }));
const SegmentRowsSchema = z.array(
  z.object({
    direction: z.enum(['outbound', 'return', 'internal']),
    position: z.number(),
    from_iata: z.string(),
    to_iata: z.string(),
    depart_at: z.string(),
    depart_tz: z.string(),
    arrive_at: z.string(),
    arrive_tz: z.string(),
  }),
);
const ProfileRowSchema = z.object({ interests });

export function createPorts({ admin, fetch, env, airports }: PortsConfig): GeneratePlanPorts {
  return {
    model: env.geminiModel,
    airports,
    async authenticate(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (data.user) return { kind: 'user', id: data.user.id };
      // Only a rejected token is invalid; rate limits, 5xx and network errors are failures.
      if (error?.status === 401 || error?.status === 403) return { kind: 'invalid' };
      throw error ?? new Error('getUser returned no user');
    },
    async loadTrip(tripId): Promise<PlanTrip | null> {
      const trip = await admin
        .from('trips')
        .select('owner_id,destination,start_date,end_date')
        .eq('id', tripId)
        .maybeSingle();
      if (trip.error) throw trip.error;
      if (!trip.data) return null;
      const row = TripRowSchema.parse(trip.data);
      const [members, segments, profile] = await Promise.all([
        admin.from('trip_members').select('id,role,interests').eq('trip_id', tripId),
        admin
          .from('flight_segments')
          .select('direction,position,from_iata,to_iata,depart_at,depart_tz,arrive_at,arrive_tz')
          .eq('trip_id', tripId),
        admin.from('profiles').select('interests').eq('id', row.owner_id).maybeSingle(),
      ]);
      for (const result of [members, segments, profile]) if (result.error) throw result.error;
      return {
        ownerId: row.owner_id,
        destination: row.destination,
        startDate: row.start_date,
        endDate: row.end_date,
        ownerInterests: ProfileRowSchema.parse(profile.data).interests,
        members: MemberRowsSchema.parse(members.data)
          .filter((m) => m.role !== 'owner')
          .map((m) => ({ id: m.id, interests: m.interests })),
        segments: SegmentRowsSchema.parse(segments.data).map((s) => ({
          direction: s.direction,
          order: s.position,
          fromIata: s.from_iata,
          toIata: s.to_iata,
          departAt: s.depart_at,
          departTz: s.depart_tz,
          arriveAt: s.arrive_at,
          arriveTz: s.arrive_tz,
        })),
      };
    },
    async consumeQuota(userId, limit) {
      const { data, error } = await admin.rpc('consume_ai_quota', {
        p_user_id: userId,
        p_limit: limit,
        p_kind: QUOTA_KIND,
      });
      if (error) throw error;
      return z.number().int().nonnegative().nullable().parse(data); // invalid result throws -> upstream failure
    },
    async refundQuota(userId) {
      const { error } = await admin.rpc('refund_ai_quota', { p_user_id: userId, p_kind: QUOTA_KIND });
      if (error) throw error;
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
        signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Nearby Search failed: ${res.status}`);
      return res.json();
    },
    async generateWithGemini({ systemInstruction, data }) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: data }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: planJsonSchema,
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
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') throw new Error('Gemini returned no text');
      return text;
    },
    async savePlan(plan) {
      const { error } = await admin
        .from('trip_plans')
        .upsert(
          { trip_id: plan.tripId, days: plan.days, model: plan.model, created_at: plan.createdAt },
          { onConflict: 'trip_id' },
        );
      if (error) throw error;
    },
  };
}
