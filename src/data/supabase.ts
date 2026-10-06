import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';

import { SupabaseConfigSchema, type SupabaseConfig } from '@/schemas';

const ENV_NAMES: Record<keyof SupabaseConfig, string> = {
  url: 'EXPO_PUBLIC_SUPABASE_URL',
  key: 'EXPO_PUBLIC_SUPABASE_KEY',
};

// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` access.
const config = SupabaseConfigSchema.safeParse({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_KEY,
});

if (!config.success) {
  const names = config.error.issues.map((issue) => ENV_NAMES[issue.path[0] as keyof SupabaseConfig]);
  throw new Error(`Invalid Supabase env variables: ${names.join(', ')}`);
}

/** The app's only Supabase client. The auth session is kept in SQLite-backed localStorage. */
export const supabase = createClient(config.data.url, config.data.key, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
