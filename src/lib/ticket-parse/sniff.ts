import { TICKET_MAX_BYTES, type ExtractTicketError, type ExtractTicketRequest } from '../../schemas/ticket.ts';

type SniffError = Extract<ExtractTicketError['error'], 'unsupported_file' | 'file_too_large'>;

const MAGIC: Record<ExtractTicketRequest['mimeType'], number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  'image/jpeg': [0xff, 0xd8, 0xff],
};

// Pure: checks mime vs magic bytes and size before any parsing. atob exists in Node, Deno and Hermes.
export function sniffTicketFile({
  mimeType,
  dataBase64,
}: ExtractTicketRequest): { ok: true; bytes: Uint8Array } | { ok: false; error: SniffError } {
  // Length check first so huge input is never decoded.
  if (dataBase64.length > Math.ceil(TICKET_MAX_BYTES / 3) * 4) return { ok: false, error: 'file_too_large' };
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, error: 'unsupported_file' };
  }
  if (bytes.length === 0) return { ok: false, error: 'unsupported_file' };
  if (bytes.length > TICKET_MAX_BYTES) return { ok: false, error: 'file_too_large' };
  if (!MAGIC[mimeType].every((b, i) => bytes[i] === b)) return { ok: false, error: 'unsupported_file' };
  return { ok: true, bytes };
}
