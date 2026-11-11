import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { UsernameMismatchError } from '@/data/profile-repository';
import { useProfileRepository } from '@/providers/AppProviders';
import { useSession } from '@/providers/Session';

export type DeleteOutcome = 'deleted' | 'mismatch' | 'failed';

/**
 * Deletes the signed-in user's account (profile-settings step 11). `run` asks the server once at a time; after the server confirmed it
 * signs out on this phone (`signOutAfterDelete`, never rejects) and stays `pending`: the gate takes the screen away a moment later.
 * A failure leaves the account in place and can be repeated: `failed` for a real failure or no answer (A5), `mismatch` when the nick was
 * changed elsewhere (D16; nothing was deleted, so the own profile is read again for the new nick).
 */
export function useDeleteAccount() {
  const repository = useProfileRepository();
  const { signOutAfterDelete } = useSession();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'mismatch' | 'failed' | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (confirmUsername: string): Promise<DeleteOutcome | null> => {
      // A second call while one runs, or after a success, is ignored (a double press is one request).
      if (running.current) return null;
      running.current = true;
      setPending(true);
      setError(null);
      try {
        // Normalized like the server does: padding that passed the dialog's check must not break the server's length limit.
        await repository.deleteAccount(confirmUsername.trim().toLowerCase());
      } catch (failure) {
        running.current = false;
        setPending(false);
        if (failure instanceof UsernameMismatchError) {
          void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
          setError('mismatch');
          return 'mismatch';
        }
        setError('failed');
        return 'failed';
      }
      await signOutAfterDelete();
      return 'deleted';
    },
    [repository, signOutAfterDelete, queryClient],
  );

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
