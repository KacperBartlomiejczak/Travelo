import { downloadAvatar } from './avatar-download';
import { readProviderProfile } from './provider-profile-source';
import { supabase } from './supabase';

/** What the profile setup pre-fills from the Google / Discord sign-in: the suggestion from the stored session, and the photo download. */
export const appProviderProfile = {
  read: () => readProviderProfile(supabase.auth),
  downloadAvatar: (url: string) => downloadAvatar(url),
};
