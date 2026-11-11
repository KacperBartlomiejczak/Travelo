// Thin Deno wiring for the account deletion handler (prompts/profile-settings/plan.md, step 3).
// Runs only on Supabase: SUPABASE_URL and the service role key are injected into the function's environment.
import { createClient } from '@supabase/supabase-js';
import { handleDeleteAccount } from './handler.ts';
import { createPorts } from './ports.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ports = createPorts(admin);

Deno.serve(async (req) => {
  const body = await req.json().catch(() => undefined);
  const { status, body: out } = await handleDeleteAccount(
    { method: req.method, authorization: req.headers.get('Authorization'), body },
    ports,
  );
  return Response.json(out, { status });
});
