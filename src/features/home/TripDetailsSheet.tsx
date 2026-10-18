import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, Text } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { CoverPicker } from '@/components/CoverPicker';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { useUpdateTripDetails } from '@/hooks/useTrips';
import { useIsOffline } from '@/providers/BudgetSync';
import { TRIP_NAME_MAX_LENGTH, TripDetailsInputSchema, type CoverChoice, type TripSummary } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

type Props = { trip: TripSummary; onClose: () => void };

// Changing the name and cover of an existing trip (trip-edit-menu A2, D5, D12): the same form as the wizard's summary
// card, checked with the same schema and messages. Server-first, so offline saving is disabled (D5); the cover is always
// one of the presets or a gallery photo (trip-covers D1). Mounting opens the sheet, like BudgetSheet.
export function TripDetailsSheet({ trip, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateTripDetails();
  const offline = useIsOffline();
  const [name, setName] = useState(trip.name);
  const [coverImageUri, setCoverImageUri] = useState<CoverChoice>(trip.coverImageUri);
  // The name error appears after the first "Zapisz" and then follows every change (as on the wizard's summary).
  const [submitted, setSubmitted] = useState(false);

  const result = TripDetailsInputSchema.safeParse({ name, coverImageUri });
  const nameError = submitted && !result.success ? result.error.issues[0].message : undefined;

  function save() {
    setSubmitted(true);
    if (!result.success) {
      AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
      return;
    }
    update.mutate(
      { tripId: trip.id, input: result.data },
      { onSuccess: onClose, onError: () => AccessibilityInfo.announceForAccessibility(t('tripDetails.saveError')) },
    );
  }

  return (
    <BottomSheet visible title={t('tripDetails.title')} onClose={onClose}>
      {/* Scrolls when the cover preview and the keyboard do not fit; the save button below stays in reach. */}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: theme.spacing[4] }}>
        <TextField
          label={t('newTrip.summary.name')}
          value={name}
          onChangeText={setName}
          maxLength={TRIP_NAME_MAX_LENGTH}
          error={nameError ? t(nameError, { max: TRIP_NAME_MAX_LENGTH }) : undefined}
        />
        <CoverPicker value={coverImageUri} onChange={setCoverImageUri} urls={trip.coverUrls} />
      </ScrollView>
      {update.isError && (
        <Text accessibilityLiveRegion="polite" style={[theme.typography.bodyS, { color: theme.colors.status.error }]}>
          {t('tripDetails.saveError')}
        </Text>
      )}
      {offline && <Text style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>{t('tripMenu.offlineHint')}</Text>}
      <PrimaryButton label={t('tripDetails.save')} onPress={save} loading={update.isPending} disabled={offline} />
    </BottomSheet>
  );
}
