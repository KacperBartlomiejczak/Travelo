import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TripsEmptyIllustration } from '@/components/TripsEmptyIllustration';
import { useTheme } from '@/theme/useTheme';

// Trips screen. There is no trip data yet (D1), so it always shows the empty state.
export default function TripsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { spacing, colors, typography } = theme;
  const isCompact = width < theme.breakpoints.compact;

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

        <View style={styles.empty}>
          <TripsEmptyIllustration />
          <Text
            style={[typography.heading2, styles.centered, { color: colors.text.primary, marginTop: spacing[6] }]}
          >
            {t('trips.empty.heading')}
          </Text>
          <Text
            style={[typography.bodyM, styles.centered, { color: colors.text.secondary, marginTop: spacing[2] }]}
          >
            {t('trips.empty.description')}
          </Text>
        </View>

        <PrimaryButton label={t('trips.create')} icon={Plus} onPress={() => router.push('/trips/new')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Full width on phones, centred column on tablets (design-context §18).
  content: { flex: 1, width: '100%', alignSelf: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
});
