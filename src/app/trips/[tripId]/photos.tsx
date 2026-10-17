import { useLocalSearchParams, useRouter } from 'expo-router';

import { PhotoViewer } from '@/features/trip-photos/PhotoViewer';
import { DarkThemeScope } from '@/theme/useTheme';

// The trip's photos full screen (trip-photos D6, P4): a route over the home screen, which stays mounted underneath because
// the uploads live in its photo strip. Always ink, like the trip view; the delete sheet is a Modal of this screen, so it
// never opens on top of another Modal (trip-edit-menu A6).
export default function PhotosScreen() {
  const { tripId, photoId } = useLocalSearchParams<{ tripId: string; photoId?: string }>();
  const router = useRouter();
  // Opened by a link there is nothing to go back to: the home screen is the way out.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <DarkThemeScope>
      <PhotoViewer tripId={tripId} photoId={photoId} onClose={close} />
    </DarkThemeScope>
  );
}
