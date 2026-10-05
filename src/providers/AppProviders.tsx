import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';

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
  const [repository] = useState(() => tripRepository ?? createInMemoryTripRepository());
  return (
    <QueryClientProvider client={client}>
      <TripRepositoryContext.Provider value={repository}>{children}</TripRepositoryContext.Provider>
    </QueryClientProvider>
  );
}
