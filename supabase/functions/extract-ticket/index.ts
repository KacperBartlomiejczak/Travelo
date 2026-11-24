// Thin Deno wiring for the ticket import (ticket-import-ai plan, step 4).
// SUPABASE_URL and the service role key are injected; GEMINI_API_KEY and GEMINI_MODEL are function secrets (no new
// ones). A missing one fails at startup, not on the first request. verify_jwt stays on (default in config.toml).
import { createClient } from '@supabase/supabase-js';
import airports from '../../../src/data/airports.json' with { type: 'json' };
import { readJsonBody } from './body.ts';
import { handleExtractTicket } from './handler.ts';
import { createPorts } from './ports.ts';
import { createStage1Ports } from './stage1.ts';

const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
// The reader wasm is a static file shipped with the function (static_files in config.toml), never fetched from a CDN.
const wasm = await Deno.readFile(new URL('./zxing_reader.wasm', import.meta.url));
const stage1 = createStage1Ports({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
const real = createPorts({
  admin,
  fetch,
  env: { geminiApiKey: required('GEMINI_API_KEY'), geminiModel: required('GEMINI_MODEL') },
});

Deno.serve(async (req) => {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return Response.json({ error: 'file_too_large' }, { status: 413 });
  const body = parsed.body;
  const { status, body: out } = await handleExtractTicket(
    { method: req.method, authorization: req.headers.get('Authorization'), body },
    {
      ...real,
      airports,
      today: () => new Date().toISOString().slice(0, 10),
      ...stage1,
      log: (event) => console.log(event),
    },
  );
  return Response.json(out, { status });
});
