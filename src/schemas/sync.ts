import { z } from 'zod';

/** Where a change made on the device is on its way to Supabase (CLAUDE.md, design-context §17). */
export const SyncStatusSchema = z.enum(['synced', 'pending', 'failed']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
