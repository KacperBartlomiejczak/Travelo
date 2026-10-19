import { Redirect } from 'expo-router';

import { useGateView } from '@/features/auth/useGateView';

/**
 * Landing point of the OAuth redirect (`traveling://auth/callback?code=...`), which can open the app at this path.
 * The code is exchanged in `signInWithProvider`, not here; this route only keeps expo-router from showing "Unmatched route"
 * and sends the user to the screen that exists for their state: `/` is not reachable while signed out or without a profile
 * (the gate removes it), so a plain redirect to `/` would leave a blank screen.
 */
export default function AuthCallback() {
  const { view } = useGateView();
  if (view === 'signedOut') return <Redirect href="/welcome" />;
  if (view === 'onboarding') return <Redirect href="/onboarding" />;
  return <Redirect href="/" />;
}
