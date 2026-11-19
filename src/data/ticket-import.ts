import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import {
  ExtractTicketErrorSchema,
  ExtractTicketRequestSchema,
  ExtractTicketResponseSchema,
  type ExtractTicketError,
  type ExtractTicketRequest,
  type ExtractTicketResponse,
} from '@/schemas';

import type { Database } from './database.types';
import { ServerUnreachableError } from './errors';

/** The file is not a flight ticket (Gemini said so, or nothing could be read). */
export class NotATicketError extends Error {}

/** The daily import limit is spent. */
export class TicketLimitError extends Error {}

/** The server refused the file itself: wrong type or over the size limit. */
export class UnsupportedTicketFileError extends Error {
  constructor(
    readonly code: 'unsupported_file' | 'file_too_large',
    message: string,
  ) {
    super(message);
  }
}

/** Not signed in, or anything else (incl. an invalid answer). */
export class TicketImportError extends Error {
  constructor(
    readonly kind: 'unauthorized' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

/** The error code the Edge Function put in its body, or null when there is none or it is unreadable. */
async function serverCode(response: Response): Promise<ExtractTicketError['error'] | null> {
  try {
    const body = ExtractTicketErrorSchema.safeParse(await response.json());
    return body.success ? body.data.error : null;
  } catch {
    return null;
  }
}

/** Asks the `extract-ticket` Edge Function (waits up to 45 s). The base64 body is never logged. */
export async function extractTicket(request: ExtractTicketRequest, { supabase }: { supabase: SupabaseClient<Database> }): Promise<ExtractTicketResponse> {
  const body = ExtractTicketRequestSchema.safeParse(request);
  if (!body.success) throw new TicketImportError('failed', 'invalid ticket request');
  const { data, error } = await supabase.functions.invoke('extract-ticket', { body: body.data });
  if (error) {
    if (error instanceof FunctionsFetchError) throw new ServerUnreachableError(error.message);
    if (error instanceof FunctionsHttpError) {
      const code = await serverCode(error.context);
      if (code === 'not_a_ticket') throw new NotATicketError(error.message);
      if (code === 'limit_reached') throw new TicketLimitError(error.message);
      if (code === 'unsupported_file' || code === 'file_too_large') throw new UnsupportedTicketFileError(code, error.message);
      if (error.context.status === 401 || code === 'unauthorized') throw new TicketImportError('unauthorized', error.message);
    }
    throw new TicketImportError('failed', error.message);
  }
  const response = ExtractTicketResponseSchema.safeParse(data);
  if (!response.success) throw new TicketImportError('failed', response.error.message);
  return response.data;
}
