import { appLocalStore } from './app-local-store';
import { createSupabaseSessionSource } from './session-source';
import { supabase } from './supabase';

/** The app's session: Supabase Auth, and the one SQLite store whose user data is forgotten when nobody is signed in (auth-onboarding D14). */
export const appSessionSource = createSupabaseSessionSource({
  auth: supabase.auth,
  clearUserData: async () => (await appLocalStore()).clearUserData(),
});
