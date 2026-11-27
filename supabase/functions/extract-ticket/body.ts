import { TICKET_MAX_BYTES } from '../../../src/schemas/ticket.ts';

// base64 of the largest file plus 64 KiB for the JSON envelope.
export const MAX_BODY_BYTES = Math.ceil(TICKET_MAX_BYTES / 3) * 4 + 64 * 1024;

export type BodyResult = { ok: true; body: unknown } | { ok: false; error: 'too_large' };

// Reads the body as a stream and stops at the cap instead of buffering it all; invalid JSON or no body gives undefined.
export async function readJsonBody(req: Request): Promise<BodyResult> {
  const declared = Number(req.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) return { ok: false, error: 'too_large' };
  if (!req.body) return { ok: true, body: undefined };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, error: 'too_large' };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: true, body: undefined };
  }
}
