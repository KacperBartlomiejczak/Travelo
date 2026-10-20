import { providerProfile, type ProviderProfile } from '@/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Only `getSession`: it reads the session stored on the phone, but may call the refresh endpoint when the access token has expired (auth-js `__loadSession`). */
export type ProviderProfileAuth = Pick<SupabaseClient['auth'], 'getSession'>;

const NOTHING: ProviderProfile = { suggestedUsername: null, avatarUrl: null };

/**
 * What the Google / Discord sign-in told us about the signed-in user, for pre-filling the profile setup (theme-split-and-profile-prefill P5, P7):
 * the nick and the photo address, already checked and resized by `providerProfile`. It reads the session stored on the phone; with an
 * expired access token `getSession()` may first try to refresh it, so without a connection the result is simply no suggestion. No
 * session, no metadata, or any failure answers with nothing: the suggestion is a convenience and must never block the screen, so this
 * never rejects.
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
