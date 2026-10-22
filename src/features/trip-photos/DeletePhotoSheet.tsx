import { CircleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { TextButton } from '@/components/TextButton';
import { useDeleteTripPhoto } from '@/hooks/useTripPhotos';
import { useIsOffline } from '@/providers/BudgetSync';
import type { ShownTripPhoto } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { photo: ShownTripPhoto; onClose: () => void; onDeleted: () => void };

// Confirmation before deleting a photo (trip-photos P5), built like DeleteTripSheet: what goes away, then the
// destructive button above "Anuluj", full width and 16dp apart so they are never adjacent (trip-edit-menu D19).
// Server-first, so offline the delete is disabled with the hint (trip-photos D8). Mounting opens the sheet.
export function DeletePhotoSheet({ photo, onClose, onDeleted }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const remove = useDeleteTripPhoto(photo.tripId);
  const offline = useIsOffline();
  const pending = remove.isPending;

  function confirm() {
    // Deleting the last photo closes the viewer, which unmounts this sheet before the mutation settles, and TanStack
    // Query v5 drops the per-call `mutate(vars, { onSuccess })` callbacks of an unmounted component. The promise of
    // `mutateAsync` settles either way (same as DeleteTripSheet). The error text comes from the hook.
    remove.mutateAsync(photo).then(onDeleted, () => AccessibilityInfo.announceForAccessibility(t('deletePhoto.error')));
  }

  return (
    <BottomSheet visible title={t('deletePhoto.title')} onClose={onClose} dismissible={!pending}>
      <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>{t('deletePhoto.body')}</Text>
      {remove.isError && (
        // Announced by the call in `confirm`; a live region as well would read it twice.
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1] }}>
          <CircleAlert
            testID="delete-photo-error-icon"
            size={tokens.iconography.size.xs}
            strokeWidth={tokens.iconography.strokeWidth}
            color={theme.semantic.error.foreground}
            aria-hidden
          />
          <Text style={[tokens.typography.styles.bodySM, { color: theme.semantic.error.foreground, flexShrink: 1 }]}>
            {t('deletePhoto.error')}
          </Text>
        </View>
      )}
      {offline && <Text style={[tokens.typography.styles.bodySM, { color: theme.text.secondary }]}>{t('tripPhotos.offlineHint')}</Text>}
      {/* TextButton has no loading state, so while deleting both buttons are disabled (greyed, not pressable). */}
      <View testID="delete-photo-actions" style={{ gap: tokens.spacing[4] }}>
        <TextButton variant="destructive" label={t('deletePhoto.confirm')} onPress={confirm} disabled={offline || pending} />
        <TextButton variant="secondary" label={t('deletePhoto.cancel')} onPress={onClose} disabled={pending} />
      </View>
    </BottomSheet>
  );
}
