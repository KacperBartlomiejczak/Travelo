import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Image } from 'react-native';

import { startingTrips, type ExampleCovers } from '@/data/example-trips';
import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { todayIn } from '@/lib/time';

// Bundled example photos (D9), as URIs like a photo picked from the gallery.
const exampleCovers = (): ExampleCovers => ({
  lisbon: Image.resolveAssetSource(require('@/assets/images/examples/lisbon.jpg')).uri,
  beijing: Image.resolveAssetSource(require('@/assets/images/examples/beijing.jpg')).uri,
});

const TripRepositoryContext = createContext<TripRepository | null>(null);

export function useTripRepository(): TripRepository {
  const repository = useContext(TripRepositoryContext);
  if (!repository) throw new Error('useTripRepository must be used inside AppProviders');
  return repository;
}

type Props = {
  children: ReactNode;
  /** Tests pass their own; the app creates one per launch. */
  queryClient?: QueryClient;
  tripRepository?: TripRepository;
};

export function AppProviders({ children, queryClient, tripRepository }: Props) {
  const [client] = useState(() => queryClient ?? new QueryClient());
  const [repository] = useState(
    () =>
      tripRepository ??
      createInMemoryTripRepository(
        undefined,
        // The example trips fly from Poland, so "today" is Warsaw's.
        startingTrips({ isDev: __DEV__, isTest: process.env.NODE_ENV === 'test' }, todayIn('Europe/Warsaw'), exampleCovers),
      ),
  );
  return (
    <QueryClientProvider client={client}>
      <TripRepositoryContext.Provider value={repository}>{children}</TripRepositoryContext.Provider>
    </QueryClientProvider>
  );
}
