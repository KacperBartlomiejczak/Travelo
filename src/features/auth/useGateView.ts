import { useMyProfile } from '@/hooks/useProfile';
import { useSession } from '@/providers/Session';

/**
 * What the app can show for who is using it (auth-onboarding step 5):
 * - `loading` — the session or the profile is still being read, or the previous user's data is being cleared;
 * - `startError` / `profileError` — one of them could not be read (full-screen error with a retry);
 * - `signedOut` — the welcome screens; `onboarding` — signed in without a profile; `app` — signed in with a profile.
 */
export type GateView = 'loading' | 'startError' | 'profileError' | 'signedOut' | 'onboarding' | 'app';

export function useGateView(): { view: GateView; retry: () => void } {
  const { state, retry: retrySession } = useSession();
  const profile = useMyProfile();

  let view: GateView = 'loading';
  if (state.status === 'error') view = 'startError';
  else if (state.status === 'signedOut') view = 'signedOut';
  else if (state.status === 'signedIn') {
    // Data first: a profile that is already known stays in use if a later read fails.
    if (profile.data === null) view = 'onboarding';
    else if (profile.data !== undefined) view = 'app';
    else if (profile.isError) view = 'profileError';
  }

  // An unknown user (offline start) is read again first: the stored session may turn out to be an old anonymous one.
  const userUnknown = state.status === 'signedIn' && state.userId === null;
  const retry = view === 'profileError' && !userUnknown ? () => void profile.refetch() : retrySession;
  return { view, retry };
}
