import { AppState, Platform } from 'react-native';

import { keepSessionFresh } from './auth';
import { openLocalDb } from './local-db';
import { createLocalStore } from './local-store';
import { supabase } from './supabase';
import { createSupabaseTripRepository } from './supabase-trip-repository';
import type { TripRepository } from './trip-repository';

/** The app's trips: Supabase, with budget changes, trip copies and the chosen trip in SQLite on the device (trips-supabase, trips-drawer). */
export function createAppTripRepository(): TripRepository {
  // Supabase React Native guidance: refresh the token only in the foreground; the browser handles it on web.
  if (Platform.OS !== 'web') keepSessionFresh(supabase.auth, AppState);
  return createSupabaseTripRepository({ supabase, local: openLocalDb().then(createLocalStore) });
}
