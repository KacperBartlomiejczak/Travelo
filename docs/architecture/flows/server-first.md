# Server-first data flow

- Server-first: screens use `useTripList` / `useCurrentTrip` / `useSelectTrip` / `useCreateTrip` / `useSetTripBudget` → `TripRepository` from `AppProviders` (the app's is `createSupabaseTripRepository` with the shared client and `openLocalDb().then(createLocalStore)`; tests use the in-memory one).
