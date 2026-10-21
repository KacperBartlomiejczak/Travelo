import { useLocalSearchParams, useRouter } from 'expo-router';

import { PhotoViewer } from '@/features/trip-photos/PhotoViewer';
import { useMyProfileId } from '@/hooks/useProfile';
import { useCurrentTrip } from '@/hooks/useTrips';
import { DarkThemeScope } from '@/theme/legacy/useTheme';

// The trip's photos full screen (trip-photos D6, P4): a route over the home screen, which stays mounted underneath because
// the uploads live in its photo strip. Always ink, like the trip view; the delete sheet is a Modal of this screen, so it
// never opens on top of another Modal (trip-edit-menu A6). Only the organizer can delete (friend-invite A3): the current
// trip says who owns it; until that is known (or when the current trip is another one) the viewer gets no delete.
export default function PhotosScreen() {
  const { tripId, photoId } = useLocalSearchParams<{ tripId: string; photoId?: string }>();
  const router = useRouter();
  const current = useCurrentTrip().data?.overview.trip;
  const myId = useMyProfileId();
  const isOwner = current?.id === tripId && myId !== undefined ? current.ownerId === myId : undefined;
  // Opened by a link there is nothing to go back to: the home screen is the way out.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <DarkThemeScope>
      <PhotoViewer tripId={tripId} photoId={photoId} isOwner={isOwner} onClose={close} />
    </DarkThemeScope>
  );
}
