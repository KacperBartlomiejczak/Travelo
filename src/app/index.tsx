import { useRouter } from 'expo-router';
import { CircleX, Plus } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { TripCard } from '@/components/TripCard';
import { TripCardSkeleton } from '@/components/TripCardSkeleton';
import { TripsEmptyIllustration } from '@/components/TripsEmptyIllustration';
import { useTrips } from '@/hooks/useTrips';
import { useTheme } from '@/theme/useTheme';

// Trips screen: loading, error, empty, or the trips with the soonest one first (D6, D39).
export default function TripsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { spacing, colors, typography } = theme;
  const isCompact = width < theme.breakpoints.compact;
  const trips = useTrips();

  // The error replaces the skeleton without focus moving; VoiceOver needs it announced.
  useEffect(() => {
    if (trips.isError) AccessibilityInfo.announceForAccessibility(t('trips.loadError'));
  }, [trips.isError, t]);
  const sectionTitle = [typography.heading3, { color: colors.text.primary }];

  let body: ReactNode;
  if (trips.isPending) {
    body = (
      <View
        testID="trips-loading"
        accessible
        accessibilityLabel={t('trips.loading')}
        accessibilityState={{ busy: true }}
        style={[styles.fill, { gap: spacing[3], paddingTop: spacing[6] }]}
      >
        <TripCardSkeleton />
        <TripCardSkeleton />
      </View>
    );
  } else if (trips.isError) {
    body = (
      <View style={[styles.centered, { gap: spacing[3] }]}>
        <CircleX size={theme.size.iconFeature} strokeWidth={theme.size.iconStroke} color={colors.status.error} aria-hidden />
        <Text style={[typography.bodyM, styles.textCentered, { color: colors.text.primary }]}>{t('trips.loadError')}</Text>
        <TextButton variant="secondary" label={t('trips.retry')} onPress={() => trips.refetch()} />
      </View>
    );
  } else if (trips.data.length === 0) {
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
  } else {
    const [next, ...later] = trips.data;
    body = (
      <ScrollView style={styles.fill} contentContainerStyle={{ gap: spacing[6], paddingVertical: spacing[6] }}>
        <View testID="trips-next" style={{ gap: spacing[3] }}>
          <Text accessibilityRole="header" style={sectionTitle}>
            {t('trips.next')}
          </Text>
          <TripCard trip={next} />
        </View>
        {later.length > 0 && (
          <View testID="trips-later" style={{ gap: spacing[3] }}>
            <Text accessibilityRole="header" style={sectionTitle}>
              {t('trips.later')}
            </Text>
            {later.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </View>
        )}
      </ScrollView>
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

        <PrimaryButton label={t('trips.create')} icon={Plus} onPress={() => router.push('/trips/new')} />
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
