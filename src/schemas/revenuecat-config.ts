import { z } from 'zod';

/** Client config from `EXPO_PUBLIC_*` env. Only a public SDK key (test_, appl_, goog_) may ship in the app. */
export const RevenueCatConfigSchema = z.object({
  apiKey: z.string().regex(/^(test|appl|goog)_\w+$/),
});
export type RevenueCatConfig = z.infer<typeof RevenueCatConfigSchema>;
