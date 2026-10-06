import { z } from 'zod';

/** Client config from `EXPO_PUBLIC_*` env. Only a publishable key may ship in the app. */
export const SupabaseConfigSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  key: z.string().startsWith('sb_publishable_'),
});
export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;
