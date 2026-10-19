import { appLocalStore } from './app-local-store';
import type { ProfileRepository } from './profile-repository';
import { supabase } from './supabase';
import { createSupabaseProfileRepository } from './supabase-profile-repository';

/** The app's own profile: Supabase, with a copy on the device in SQLite (auth-onboarding D9). */
export function createAppProfileRepository(): ProfileRepository {
  return createSupabaseProfileRepository({ supabase, local: appLocalStore() });
}
