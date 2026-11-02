import { useLocalSearchParams, useRouter } from 'expo-router';

import { AvatarViewer } from '@/features/profile/AvatarViewer';
import { DarkThemeScope } from '@/theme/legacy/useTheme';

// The profile photo full screen (profile-settings D13): a route over the profile screen, always ink like the photo viewer. The
// `uri` param is the signed address the profile screen was showing and `avatarId` the photo it belongs to; it is temporary and never logged.
export default function AvatarScreen() {
  const { uri, avatarId } = useLocalSearchParams<{ uri?: string; avatarId?: string }>();
  const router = useRouter();
  // Opened by a link there is nothing to go back to: the home screen is the way out.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <DarkThemeScope>
      <AvatarViewer fallbackUri={uri} fallbackAvatarId={avatarId} onClose={close} />
    </DarkThemeScope>
  );
}
