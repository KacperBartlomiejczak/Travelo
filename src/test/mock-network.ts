import { useSyncExternalStore } from 'react';

type NetworkState = { isConnected?: boolean; isInternetReachable?: boolean };

let state: NetworkState = { isConnected: true, isInternetReachable: true };
const listeners = new Set<() => void>();

/** Stand-in for expo-network in tests: the network state is set by the test and read with the same hook. */
export const expoNetworkMock = {
  useNetworkState: () =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => state,
    ),
};

export function setNetwork(next: NetworkState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function resetNetwork() {
  state = { isConnected: true, isInternetReachable: true };
}
