import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type EmailSignIn = {
  /** The (normalised) address the last code was sent to, or null before any code was sent. */
  email: string | null;
  /** When that code was sent (epoch ms): the resend countdown counts from it. */
  sentAt: number | null;
  /** Remembers that a code was just sent to `email`. */
  codeSent: (email: string) => void;
};

const EmailSignInContext = createContext<EmailSignIn | null>(null);

/**
 * The address typed on the e-mail screen and when its code was sent (auth-onboarding D17). It lives in the `(auth)` layout, so
 * the code screen reads it from here: a personal address never goes into a route URL. It is gone when the group unmounts.
 */
export function EmailSignInProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ email: string; sentAt: number } | null>(null);
  const codeSent = useCallback((email: string) => setState({ email, sentAt: Date.now() }), []);
  const value = useMemo(() => ({ email: state?.email ?? null, sentAt: state?.sentAt ?? null, codeSent }), [state, codeSent]);
  return <EmailSignInContext.Provider value={value}>{children}</EmailSignInContext.Provider>;
}

export function useEmailSignIn(): EmailSignIn {
  const value = useContext(EmailSignInContext);
  if (!value) throw new Error('useEmailSignIn must be used inside EmailSignInProvider');
  return value;
}
