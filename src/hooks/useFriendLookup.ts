import { useQuery } from '@tanstack/react-query';

import { useProfileRepository } from '@/providers/AppProviders';

/**
 * Looks up the account that has this friend code (friend-invite D5). Pass a code already normalised by `FriendCodeInputSchema`,
 * or null while there is nothing to check (incomplete, own, duplicate, offline): then no request is made.
 * `data` is the nick and interests, or null when nobody has the code. A request is made once per code: a failure is not
 * retried by itself and nothing is kept after the code stops being asked about, so typing the code again checks again.
 */
export function useFriendLookup(code: string | null) {
  const repository = useProfileRepository();
  return useQuery({
    queryKey: ['friend-lookup', code],
    queryFn: () => repository.findByFriendCode(code ?? ''),
    enabled: code !== null,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // The repository answers a lost connection with ServerUnreachableError; the card shows it.
    networkMode: 'always',
  });
}
