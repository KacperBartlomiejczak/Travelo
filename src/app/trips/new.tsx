import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

// Placeholder until the trip form task; only the header title is shown.
export default function NewTripScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <>
      <Stack.Screen
        options={{
          title: t('newTrip.title'),
          headerBackTitle: t('trips.title'),
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: theme.typography.heading3,
          headerShadowVisible: false,
        }}
      />
      <View style={[styles.container, { backgroundColor: theme.colors.background }]} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
