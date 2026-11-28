// The real ports of the ticket import handler. No Deno globals: the Supabase client, `fetch` and the secrets are
// injected, so Jest tests it with fakes. Never log keys, tokens, files, prompts or model output.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { GeminiTicketSchema } from '../../../src/schemas/ticket.ts';
import type { ExtractTicketPorts } from './handler.ts';

// The app waits 45 s: Gemini (30 s) + DB stay under it, so the refund and the answer reach the app.
export const GEMINI_TIMEOUT_MS = 30_000;

export interface PortsConfig {
  admin: SupabaseClient;
  fetch: typeof fetch;
  env: { geminiApiKey: string; geminiModel: string };
}

// Gemini's responseJsonSchema takes the plain schema without the `$schema` marker.
const { $schema: _marker, ...ticketJsonSchema } = z.toJSONSchema(GeminiTicketSchema);

export type RealPorts = Pick<ExtractTicketPorts, 'authenticate' | 'consumeQuota' | 'readQuota' | 'refundQuota' | 'callGemini'>;

export function createPorts({ admin, fetch, env }: PortsConfig): RealPorts {
  return {
    async authenticate(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (data.user) return { kind: 'user', id: data.user.id };
      // Only a rejected token is invalid; rate limits, 5xx and network errors are failures.
      if (error?.status === 401 || error?.status === 403) return { kind: 'invalid' };
      throw error ?? new Error('getUser returned no user');
    },
    async consumeQuota(userId, kind, limit) {
      const { data, error } = await admin.rpc('consume_ai_quota', { p_user_id: userId, p_limit: limit, p_kind: kind });
      if (error) throw error;
      return z.number().int().nonnegative().nullable().parse(data); // invalid result throws -> upstream failure
    },
    async readQuota(userId, kind, limit) {
      // service_role bypasses RLS; the same UTC day as consume_ai_quota.
      const { data, error } = await admin
        .from('ai_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('day', new Date().toISOString().slice(0, 10))
        .eq('kind', kind)
        .maybeSingle();
      if (error) throw error;
      const used = data ? z.object({ count: z.number().int().nonnegative() }).parse(data).count : 0; // bad row throws
      return Math.max(0, limit - used);
    },
    async refundQuota(userId, kind) {
      const { error } = await admin.rpc('refund_ai_quota', { p_user_id: userId, p_kind: kind });
      if (error) throw error;
    },
    async callGemini({ systemInstruction, userText, mimeType, dataBase64 }) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
          // No `tools`: the model cannot browse or run anything (untrusted document, prompt injection).
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: dataBase64 } }, { text: userText }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: ticketJsonSchema,
              thinkingConfig: { thinkingLevel: 'low' },
            },
          }),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
      );
      if (!res.ok) {
        // Google's error body carries only code/status/message, no secrets and no echo of the file.
        const detail = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string } };
        const parts = ['Gemini failed:', res.status, detail.error?.status, detail.error?.message];
        throw new Error(parts.filter(Boolean).join(' '));
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') throw new Error('Gemini returned no text');
      return text;
    },
  };
}
