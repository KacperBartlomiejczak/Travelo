import { useMutation } from '@tanstack/react-query';

import { appAuth } from '@/data/app-auth';
import type { OAuthProvider } from '@/data/auth';
import type { EmailCodeInput, EmailSignInInput } from '@/schemas';

/**
 * Signs in with Google or Discord in the system browser (auth-onboarding D1, D13). The mutation resolves `'signed-in'`
 * (Supabase's SIGNED_IN has moved the gate on by then) or `'cancelled'` (the user closed the browser: not an error), and
 * rejects on any failure. Callers show fixed copy for a rejection and never its message, which can carry text from a deep link.
 * `variables` is the provider that was tapped.
 */
export function useSignIn() {
  return useMutation({ mutationFn: (provider: OAuthProvider) => appAuth.signInWithProvider(provider) });
}

/**
 * Sends the sign-in code to an e-mail address (auth-onboarding P3). Rejects with `ZodError`, `ServerUnreachableError` or an auth
 * error (which may carry a `code` such as `over_email_send_rate_limit`); callers show fixed copy and never the message.
 */
export function useSendEmailCode() {
  return useMutation({ mutationFn: (input: EmailSignInInput) => appAuth.sendEmailCode(input) });
}

/**
 * Signs in with the code from the e-mail. It resolves once Supabase's SIGNED_IN has fired and the gate moves on, so callers do not
 * navigate. Rejects with `InvalidCodeError` for a wrong or expired code, and with any other error otherwise.
 */
export function useVerifyEmailCode() {
  return useMutation({ mutationFn: (input: EmailCodeInput) => appAuth.verifyEmailCode(input) });
}
