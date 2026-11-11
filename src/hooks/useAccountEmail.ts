import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/providers/Session';

/**
 * The signed-in account's e-mail, read from the stored session (so it works offline); null while it is read and when it
 * cannot be (no session on the phone, an unreadable token, a bad address). Not read for a user who is signed out.
 */
export function useAccountEmail(): string | null {
  const { state, email } = useSession();
  const query = useQuery({
    queryKey: ['account', 'email'],
    queryFn: email,
    enabled: state.status === 'signedIn',
    networkMode: 'always',
    retry: false,
  });
  return query.data ?? null;
}
