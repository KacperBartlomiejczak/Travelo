import { providerProfile, type ProviderProfile } from '@/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Only the local read of the stored session: it never calls the network. */
export type ProviderProfileAuth = Pick<SupabaseClient['auth'], 'getSession'>;

const NOTHING: ProviderProfile = { suggestedUsername: null, avatarUrl: null };

/**
 * What the Google / Discord sign-in told us about the signed-in user, for pre-filling the profile setup (theme-split-and-profile-prefill P5, P7):
 * the nick and the photo address, already checked and resized by `providerProfile`. It reads the session stored on the phone, so it
 * needs no connection. No session, no metadata, or any failure answers with nothing: the suggestion is a convenience and must never
 * block the screen, so this never rejects.
 */
export async function readProviderProfile(auth: ProviderProfileAuth): Promise<ProviderProfile> {
  try {
    const { data, error } = await auth.getSession();
    const user = error ? undefined : data.session?.user;
    if (!user) return NOTHING;
    return providerProfile(user.app_metadata?.provider, user.user_metadata);
  } catch {
    return NOTHING;
  }
}
