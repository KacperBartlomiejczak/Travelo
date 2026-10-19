import { appLocalStore } from './app-local-store';
import { supabase } from './supabase';
import { createSupabaseTripRepository } from './supabase-trip-repository';
import type { TripRepository } from './trip-repository';

/** The app's trips: Supabase, with budget changes, trip copies and the chosen trip in SQLite on the device (trips-supabase, trips-drawer). */
export function createAppTripRepository(): TripRepository {
  return createSupabaseTripRepository({ supabase, local: appLocalStore() });
}
