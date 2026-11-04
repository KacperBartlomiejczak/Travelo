import { useLocalSearchParams, useRouter } from 'expo-router';

import { HttpUrlSchema } from '@/schemas';
import { AvatarViewer } from '@/features/profile/AvatarViewer';
import { DarkThemeScope } from '@/theme/legacy/useTheme';

// The profile photo full screen (profile-settings D13): a route over the profile screen, always ink like the photo viewer. The
// `uri` param is the signed address the profile screen was showing and `avatarId` the photo it belongs to; it is temporary and never logged.
// A deep link can carry any `uri`: only an address on our own Supabase origin may be loaded.
function trustedUri(uri?: string) {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!uri || !base || !HttpUrlSchema.safeParse(uri).success) return undefined;
  const url = new URL(uri);
  return url.origin === new URL(base).origin ? uri : undefined;
}

export default function AvatarScreen() {
  const { uri, avatarId } = useLocalSearchParams<{ uri?: string; avatarId?: string }>();
  const router = useRouter();
  // Opened by a link there is nothing to go back to: the home screen is the way out.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <DarkThemeScope>
      <AvatarViewer fallbackUri={trustedUri(uri)} fallbackAvatarId={avatarId} onClose={close} />
    </DarkThemeScope>
  );
}
