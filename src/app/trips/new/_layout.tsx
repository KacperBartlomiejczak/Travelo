import { router, Stack, useNavigation } from 'expo-router';
import { HeaderBackButton, usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';

import { confirmDiscard } from '@/features/trip-create/confirm-discard';
import { TripDraftProvider, useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useTheme } from '@/theme/useTheme';

// Asks before leaving the wizard with entered data (D19). Rendered in the layout, so it guards the
// whole wizard route in the root stack, not a single step.
function LeaveGuard() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isDirty, isComplete } = useTripDraft();
  usePreventRemove(isDirty && !isComplete, ({ data }) => confirmDiscard(t, () => navigation.dispatch(data.action)));
  return null;
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
