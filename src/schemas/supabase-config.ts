import { z } from 'zod';

/** Hosts that reach the developer's machine; the only ones allowed to use http. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '10.0.2.2']);

/**
 * Client config from `EXPO_PUBLIC_*` env. Only a publishable key may ship in the app.
 * D36: the URL is https-only, except http to local Supabase (`10.0.2.2` is the Android emulator's host loopback).
 * `z.url` cannot express "https, or http for these hosts" (protocol and hostname are ANDed), hence the pipe:
 * the refine only runs on a string `z.url` already accepted, so `new URL` cannot throw.
 */
export const SupabaseConfigSchema = z.object({
  url: z.url({ protocol: /^https?$/ }).pipe(
    z.string().refine((url) => {
      const { protocol, hostname } = new URL(url);
      return protocol === 'https:' || LOCAL_HOSTS.has(hostname);
    }),
  ),
  key: z.string().startsWith('sb_publishable_'),
});
export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;
