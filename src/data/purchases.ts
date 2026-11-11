import Purchases from 'react-native-purchases';

import { RevenueCatConfigSchema } from '@/schemas';

let configured = false;

/** Configures the RevenueCat SDK once per app run; repeat calls do nothing. Throws naming the variable (never its value) if the key is invalid. */
export function configurePurchases(): void {
  if (configured) return;
  // Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` access.
  const config = RevenueCatConfigSchema.safeParse({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY });
  if (!config.success) throw new Error('Invalid RevenueCat env variable: EXPO_PUBLIC_REVENUECAT_API_KEY');
  Purchases.configure({ apiKey: config.data.apiKey });
  configured = true;
}
