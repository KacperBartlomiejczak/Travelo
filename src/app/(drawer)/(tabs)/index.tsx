import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import { CircleX, Menu, Plus } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Snackbar } from '@/components/Snackbar';
import { TextButton } from '@/components/TextButton';
import { TripsEmptyIllustration } from '@/components/TripsEmptyIllustration';
import { CurrentTrip } from '@/features/home/CurrentTrip';
import { HeroMenuButton } from '@/features/home/HeroMenuButton';
import { HomeSkeleton } from '@/features/home/HomeSkeleton';
import { useCurrentTrip } from '@/hooks/useTrips';
import { usePillClearance } from '@/features/nav/usePillClearance';
import { useIsOffline } from '@/providers/BudgetSync';
import { useTheme } from '@/theme/useTheme';

// Home screen: loading, error, empty, or the current trip (trip-flight-tabs-name-cover D4, trips-drawer).
// Every state has the menu button that opens the side panel with all trips (trips-drawer P5).
// The "trip deleted" message lives here, not in CurrentTrip: that unmounts when the last trip is gone and while the next
// one loads, and the message has to survive both (trip-edit-menu D9). The snackbar is drawn in every state, in the theme
// of the screen behind it (D11).
export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, object | undefined>>>();
  const insets = useSafeAreaInsets();
  const clearance = usePillClearance();
  const { width } = useWindowDimensions();
  const { spacing, colors, typography } = theme;
  const isCompact = width < theme.breakpoints.compact;
  const trips = useCurrentTrip();
  const offline = useIsOffline();
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const { coverUploadFailed } = useLocalSearchParams<{ coverUploadFailed?: string }>();
  const create = () => router.push('/trips/new');
  const openMenu = () => navigation.openDrawer();

  // The wizard closes with this flag when the gallery cover could not be sent (trip-covers Q1). The message is taken
  // once and the flag cleared on this screen's own route (`router.setParams` does not reach it from here), so a re-render
  // or coming back to this screen does not show it again.
  const coverFailedPending = coverUploadFailed === '1';
  if (coverFailedPending && snackbar === null) setSnackbar(t('newTrip.summary.coverUploadFailed'));
  useEffect(() => {
    if (coverFailedPending) navigation.setParams({ coverUploadFailed: undefined });
  }, [coverFailedPending, navigation]);

  // The error replaces the skeleton without focus moving; VoiceOver needs it announced.
  useEffect(() => {
    if (trips.isError) AccessibilityInfo.announceForAccessibility(t('trips.loadError'));
  }, [trips.isError, t]);

  // The owner clears the message in `onHide`, so the same text can show again after a later delete.
  // `aboveButton`: the empty and error states pin "Utwórz podróż" at the bottom; the snackbar sits above it, not over it
  // (§10.16 "above bottom navigation if present", D21): the button's height and a spacing[3] gap.
  // The floating pill sits at the bottom of every state. The snackbar adds the inset and spacing[4] itself, so its offset
  // starts with the pill's height: the usual place is spacing[4] above the pill, level with the pinned button's bottom edge.
  const toast = (aboveButton = false) => (
    <Snackbar
      message={snackbar}
      onHide={() => setSnackbar(null)}
      bottomOffset={theme.size.navPill + spacing[4] + (aboveButton ? theme.size.buttonPrimary + spacing[3] : 0)}
    />
  );

  if (trips.data) {
    // The trip view follows the phone's theme (theme-split D1), so its snackbar is the inverse of the same theme.
    return (
      <>
        <CurrentTrip
          overview={trips.data.overview}
          budgetSyncStatus={trips.data.budgetSyncStatus}
          onOpenMenu={openMenu}
          onDeleted={() => setSnackbar(t('deleteTrip.deleted'))}
        />
        {toast()}
      </>
    );
  }

  if (trips.isPending) {
    // Same geometry as the trip view: the hero and the three cards as placeholders, the menu button in its place (§10.18).
    return (
      <View testID="trips-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
        <HeroMenuButton onPress={openMenu} />
        <View
          testID="trips-loading"
          accessible
          accessibilityLabel={t('trips.loading')}
          accessibilityState={{ busy: true }}
          style={styles.fill}
        >
          <HomeSkeleton />
        </View>
        {toast()}
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
          // The pinned button, and the banner above it, clear the floating pill.
          paddingBottom: clearance + spacing[4],
          paddingHorizontal: isCompact ? spacing[4] : spacing[5],
        },
      ]}
    >
      <View style={[styles.content, { maxWidth: theme.size.maxContentWidth }]}>
        <View style={[styles.titleRow, { gap: spacing[2] }]}>
          <IconButton icon={Menu} label={t('trips.openList')} onPress={openMenu} />
          <Text accessibilityRole="header" style={[typography.heading1, styles.title, { color: colors.text.primary }]}>
            {t('trips.title')}
          </Text>
        </View>

        {body}

        {offline && (
          <View style={{ marginBottom: spacing[3] }}>
            <OfflineBanner />
          </View>
        )}
        <PrimaryButton label={t('trips.create')} icon={Plus} onPress={create} />
      </View>
      {toast(true)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Full width on phones, centred column on tablets (design-context §18).
  content: { flex: 1, width: '100%', alignSelf: 'center' },
  fill: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flexShrink: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textCentered: { textAlign: 'center' },
});
