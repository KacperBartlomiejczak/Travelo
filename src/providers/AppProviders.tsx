import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { createAppProfileRepository } from '@/data/app-profile-repository';
import { appSessionSource } from '@/data/app-session-source';
import { createAppTripRepository } from '@/data/app-trip-repository';
import type { ProfileRepository } from '@/data/profile-repository';
import type { SessionSource } from '@/data/session-source';
import type { TripRepository } from '@/data/trip-repository';

import { BudgetSyncProvider } from './BudgetSync';
import { SessionProvider } from './Session';

const TripRepositoryContext = createContext<TripRepository | null>(null);
const ProfileRepositoryContext = createContext<ProfileRepository | null>(null);

export function useTripRepository(): TripRepository {
  const repository = useContext(TripRepositoryContext);
  if (!repository) throw new Error('useTripRepository must be used inside AppProviders');
  return repository;
}

export function useProfileRepository(): ProfileRepository {
  const repository = useContext(ProfileRepositoryContext);
  if (!repository) throw new Error('useProfileRepository must be used inside AppProviders');
  return repository;
}

type Props = {
  children: ReactNode;
  /** Tests pass their own; the app creates one per launch. */
  queryClient?: QueryClient;
  tripRepository?: TripRepository;
  profileRepository?: ProfileRepository;
  sessionSource?: SessionSource;
};

export function AppProviders({ children, queryClient, tripRepository, profileRepository, sessionSource = appSessionSource }: Props) {
  const [client] = useState(() => queryClient ?? new QueryClient());
  const [repository] = useState(() => tripRepository ?? createAppTripRepository());
  const [profiles] = useState(() => profileRepository ?? createAppProfileRepository());
  return (
    <QueryClientProvider client={client}>
      <TripRepositoryContext.Provider value={repository}>
        <ProfileRepositoryContext.Provider value={profiles}>
          <BudgetSyncProvider repository={repository}>
            <SessionProvider source={sessionSource}>{children}</SessionProvider>
          </BudgetSyncProvider>
        </ProfileRepositoryContext.Provider>
      </TripRepositoryContext.Provider>
    </QueryClientProvider>
  );
}
