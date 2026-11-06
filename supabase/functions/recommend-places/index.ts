// Thin Deno wiring for place recommendations (places-legal-navbar plan, step C3).
// SUPABASE_URL and the service role key are injected; GOOGLE_PLACES_API_KEY, GEMINI_API_KEY and GEMINI_MODEL are
// function secrets. A missing one fails at startup, not on the first request.
import { createClient } from '@supabase/supabase-js';
import { handleRecommendPlaces } from './handler.ts';
import { createPorts } from './ports.ts';

const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ports = createPorts({
  admin,
  fetch,
  env: {
    placesApiKey: required('GOOGLE_PLACES_API_KEY'),
    geminiApiKey: required('GEMINI_API_KEY'),
    geminiModel: required('GEMINI_MODEL'),
  },
});

Deno.serve(async (req) => {
  const body = await req.json().catch(() => undefined);
  const { status, body: out } = await handleRecommendPlaces(
    { method: req.method, authorization: req.headers.get('Authorization'), body },
    ports,
  );
  return Response.json(out, { status });
});
