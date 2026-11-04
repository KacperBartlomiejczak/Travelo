import { z } from 'zod';

// Account deletion (profile-settings). Imported by the Deno Edge Function too, so this file imports only `zod`.

export const DeleteAccountInputSchema = z.object({ confirmUsername: z.string().min(1).max(64) });
export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;

export const DeleteAccountResultSchema = z.object({ deleted: z.literal(true) });
export type DeleteAccountResult = z.infer<typeof DeleteAccountResultSchema>;

export const DeleteAccountErrorSchema = z.object({
  error: z.enum(['invalid_input', 'unauthorized', 'username_mismatch', 'storage_failed', 'auth_failed']),
});
export type DeleteAccountError = z.infer<typeof DeleteAccountErrorSchema>;
