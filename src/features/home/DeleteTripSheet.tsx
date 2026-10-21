import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { TextButton } from '@/components/TextButton';
import { useDeleteTrip } from '@/hooks/useTrips';
import { useIsOffline } from '@/providers/BudgetSync';
import type { TripSummary } from '@/schemas';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = { trip: TripSummary; onClose: () => void; onDeleted: () => void };

// Confirmation before deleting a trip (trip-edit-menu D7): the name in the title, what goes away, then the destructive
// button (D10) and "Anuluj" below it, full width and 16dp apart so they are never adjacent (D19, §5). Server-first, so
// offline the delete is disabled with the hint (D8). Mounting opens the sheet, like BudgetSheet.
export function DeleteTripSheet({ trip, onClose, onDeleted }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const remove = useDeleteTrip();
  const offline = useIsOffline();
  const pending = remove.isPending;

  function confirm() {
    // A successful delete resets the current-trip query, so the home screen goes to its skeleton and this sheet unmounts
    // before the mutation settles. TanStack Query v5 runs the per-call `mutate(vars, { onSuccess })` callbacks only while
    // the component is still subscribed, so they would be dropped; the promise of `mutateAsync` settles either way.
    // No state is set here after that point: the error text comes from the hook, and `onDeleted` belongs to the home screen.
    remove.mutateAsync(trip.id).then(onDeleted, () => AccessibilityInfo.announceForAccessibility(t('deleteTrip.error')));
  }

  return (
    <BottomSheet visible title={t('deleteTrip.title', { name: trip.name })} onClose={onClose} dismissible={!pending}>
      <Text style={[theme.typography.bodyM, { color: theme.colors.text.secondary }]}>{t('deleteTrip.body')}</Text>
      {remove.isError && (
        // Announced by the call in `confirm`; a live region as well would read it twice.
        <Text style={[theme.typography.bodyS, { color: theme.colors.status.error }]}>{t('deleteTrip.error')}</Text>
      )}
      {offline && <Text style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>{t('tripMenu.offlineHint')}</Text>}
      {/* TextButton has no loading state, so while deleting both buttons are disabled (greyed, not pressable). */}
      <View testID="delete-trip-actions" style={{ gap: theme.spacing[4] }}>
        <TextButton variant="destructive" label={t('deleteTrip.confirm')} onPress={confirm} disabled={offline || pending} />
        <TextButton variant="secondary" label={t('deleteTrip.cancel')} onPress={onClose} disabled={pending} />
      </View>
    </BottomSheet>
  );
}
