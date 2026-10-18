import { useMutation } from '@tanstack/react-query';

import { appAuth } from '@/data/app-auth';
import type { OAuthProvider } from '@/data/auth';

/**
 * Signs in with Google or Discord in the system browser (auth-onboarding D1, D13). The mutation resolves `'signed-in'`
 * (Supabase's SIGNED_IN has moved the gate on by then) or `'cancelled'` (the user closed the browser: not an error), and
 * rejects on any failure. Callers show fixed copy for a rejection and never its message, which can carry text from a deep link.
 * `variables` is the provider that was tapped.
 */
export function useSignIn() {
  return useMutation({ mutationFn: (provider: OAuthProvider) => appAuth.signInWithProvider(provider) });
}
