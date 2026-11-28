import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/data/supabase';
import { extractTicket } from '@/data/ticket-import';
import type { ExtractTicketRequest } from '@/schemas';

/** Reads one ticket through the Edge Function. Not cached and never retried: a call waits up to 45 s and spends a daily quota. */
export function useExtractTicket() {
  return useMutation({
    retry: false,
    mutationFn: (request: ExtractTicketRequest) => extractTicket(request, { supabase }),
  });
}
