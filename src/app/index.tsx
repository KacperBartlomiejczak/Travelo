import { useRouter } from 'expo-router';
import { CircleX, Plus } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { TripHeroSkeleton } from '@/components/TripHeroSkeleton';
import { TripsEmptyIllustration } from '@/components/TripsEmptyIllustration';
import { NearestTrip } from '@/features/home/NearestTrip';
import { useCurrentTrip } from '@/hooks/useTrips';
import { useIsOffline } from '@/providers/BudgetSync';
import { DarkThemeScope, useTheme } from '@/theme/useTheme';

// Home screen: loading, error, empty, or only the nearest trip (trip-flight-tabs-name-cover D4).
export default function TripsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { spacing, colors, typography } = theme;
  const isCompact = width < theme.breakpoints.compact;
  const trips = useCurrentTrip();
  const offline = useIsOffline();
  const create = () => router.push('/trips/new');

  // The error replaces the skeleton without focus moving; VoiceOver needs it announced.
  useEffect(() => {
    if (trips.isError) AccessibilityInfo.announceForAccessibility(t('trips.loadError'));
  }, [trips.isError, t]);

  if (trips.data) {
    return (
      <DarkThemeScope>
        <NearestTrip overview={trips.data.overview} budgetSyncStatus={trips.data.budgetSyncStatus} onCreate={create} />
      </DarkThemeScope>
    );
  }

  if (trips.isPending) {
    // Same geometry as the trip view: the hero placeholder edge to edge (§10.18).
    return (
      <View testID="trips-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          testID="trips-loading"
          accessible
          accessibilityLabel={t('trips.loading')}
          accessibilityState={{ busy: true }}
          style={styles.fill}
        >
          <TripHeroSkeleton />
        </View>
        <View
          testID="home-action"
          style={{
            width: '100%',
            maxWidth: theme.size.maxContentWidth,
            alignSelf: 'center',
            paddingHorizontal: isCompact ? spacing[4] : spacing[5],
            paddingTop: spacing[3],
            paddingBottom: insets.bottom + spacing[4],
          }}
        >
          <PrimaryButton label={t('trips.create')} icon={Plus} onPress={create} />
        </View>
      </View>
    );
  }

  let body: ReactNode;
  if (trips.isError) {
    body = (
      <View style={[styles.centered, { gap: spacing[3] }]}>
        <CircleX size={theme.size.iconFeature} strokeWidth={theme.size.iconStroke} color={colors.status.error} aria-hidden />
        <Text style={[typography.bodyM, styles.textCentered, { color: colors.text.primary }]}>{t('trips.loadError')}</Text>
        <TextButton variant="secondary" label={t('trips.retry')} onPress={() => trips.refetch()} />
      </View>
    );
  } else {
    body = (
      <View style={styles.centered}>
        <TripsEmptyIllustration />
        <Text style={[typography.heading2, styles.textCentered, { color: colors.text.primary, marginTop: spacing[6] }]}>
          {t('trips.empty.heading')}
        </Text>
        <Text style={[typography.bodyM, styles.textCentered, { color: colors.text.secondary, marginTop: spacing[2] }]}>
          {t('trips.empty.description')}
        </Text>
      </View>
    );
  }

  return (
    <View
      testID="trips-screen"
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + spacing[4],
          paddingHorizontal: isCompact ? spacing[4] : spacing[5],
        },
      ]}
    >
      <View style={[styles.content, { maxWidth: theme.size.maxContentWidth }]}>
        <Text accessibilityRole="header" style={[typography.heading1, { color: colors.text.primary }]}>
          {t('trips.title')}
        </Text>

        {body}

        {offline && (
          <View style={{ marginBottom: spacing[3] }}>
            <OfflineBanner />
          </View>
        )}
        <PrimaryButton label={t('trips.create')} icon={Plus} onPress={create} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Full width on phones, centred column on tablets (design-context §18).
  content: { flex: 1, width: '100%', alignSelf: 'center' },
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textCentered: { textAlign: 'center' },
});
