import { useCallback, useRef, useState } from 'react';

import { useSession } from '@/providers/Session';

/**
 * Signs out on this phone (profile-screen D16). `signOut` runs the sign-out once at a time, never rejects and shows no error:
 * the phone is already signed out when the request fails, and the gate moves to the welcome screen as on success. `pending` stays
 * true after a success (the gate takes the screen away a moment later, so the button must not flash enabled) and goes back to
 * false after a rejection, so a user who is still signed in can try again.
 */
export function useSignOut() {
  const { signOut } = useSession();
  const [pending, setPending] = useState(false);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await signOut();
    } catch {
      running.current = false;
      setPending(false);
    }
  }, [signOut]);

  return { signOut: run, pending };
}
