import { useQueryClient } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { TripRepository } from '@/data/trip-repository';

const RequestSyncContext = createContext<() => void>(() => {});

/** Unknown counts as online: only a reported loss of connection is offline. */
export function useIsOffline(): boolean {
  const network = useNetworkState();
  return network.isConnected === false || network.isInternetReachable === false;
}

/** Starts sending budget changes now (e.g. right after one was saved). */
export function useRequestBudgetSync(): () => void {
  return useContext(RequestSyncContext);
}

type Props = { repository: TripRepository; children: ReactNode };

/**
 * Sends budget changes waiting on the device: on start and whenever the connection comes back, when the app
 * returns to the foreground, after a save, and again when a failed change's backoff delay is over.
 */
export function BudgetSyncProvider({ repository, children }: Props) {
  const queryClient = useQueryClient();
  const offline = useIsOffline();
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The retry timer calls the latest `sync` through this ref (a callback cannot refer to itself).
  const latestSync = useRef<() => Promise<void>>(async () => {});

  const sync = useCallback(async () => {
    clearTimeout(retryTimer.current);
    try {
      const { nextAttemptAt } = await repository.syncBudgets();
      if (nextAttemptAt) {
        retryTimer.current = setTimeout(() => void latestSync.current(), Math.max(0, nextAttemptAt.getTime() - Date.now()));
      }
    } catch {
      // The change stays on the device; the next trigger sends it.
    }
    // A read still in flight may have seen the change before it was synced: drop it and read again.
    await queryClient.cancelQueries({ queryKey: ['trips'] });
    await queryClient.invalidateQueries({ queryKey: ['trips'] });
  }, [repository, queryClient]);

  useEffect(() => {
    if (!offline) void sync();
  }, [offline, sync]);

  useEffect(() => {
    latestSync.current = sync;
  }, [sync]);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  const requestSync = useCallback(() => void sync(), [sync]);
  return <RequestSyncContext.Provider value={requestSync}>{children}</RequestSyncContext.Provider>;
}
