import { router, Stack, useNavigation } from 'expo-router';
import { HeaderBackButton, usePreventRemove } from 'expo-router/react-navigation';
import type { NavigationAction } from 'expo-router/react-navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TripDraftProvider, useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useTheme } from '@/theme/useTheme';

// Asks before leaving the wizard with entered data (D19). Rendered in the layout, so it guards the
// whole wizard route in the root stack, not a single step. The blocked navigation is kept until the
// organizer answers: "Odrzuć" dispatches it (the action remembers the routes it already passed, so the
// guard does not block it a second time), "Zostań", a tap outside and Android back drop it. Another
// attempt to leave while the dialog is open keeps the first action, so dialogs never stack.
function LeaveGuard() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isDirty, isComplete } = useTripDraft();
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
  usePreventRemove(isDirty && !isComplete, ({ data }) => setPendingAction((current) => current ?? data.action));

  const leave = () => {
    if (!pendingAction) return;
    setPendingAction(null);
    navigation.dispatch(pendingAction);
  };

  return (
    <ConfirmDialog
      visible={pendingAction !== null}
      destructive
      title={t('newTrip.discard.title')}
      message={t('newTrip.discard.message')}
      confirmLabel={t('newTrip.discard.confirm')}
      cancelLabel={t('newTrip.discard.cancel')}
      onConfirm={leave}
      onCancel={() => setPendingAction(null)}
    />
  );
}

export default function NewTripLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <TripDraftProvider>
      <LeaveGuard />
      <Stack
        screenOptions={{
          title: t('newTrip.title'),
          headerBackTitle: t('newTrip.back'),
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: theme.typography.heading3,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            // First screen of a nested stack has no native back button; this one leaves the wizard,
            // labelled with the trips list title (trips-empty-state plan, D7).
            headerLeft: ({ tintColor }) => (
              <HeaderBackButton
                label={t('trips.title')}
                accessibilityLabel={t('trips.title')}
                tintColor={tintColor}
                onPress={() => router.back()}
              />
            ),
          }}
        />
      </Stack>
    </TripDraftProvider>
  );
}
