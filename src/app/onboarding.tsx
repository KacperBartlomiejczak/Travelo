import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

// Placeholder until profile setup is built (auth-onboarding step 8).
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="onboarding-screen"
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing[4], paddingHorizontal: spacing[5] }]}
    >
      <Text accessibilityRole="header" style={[typography.heading1, { color: colors.text.primary }]}>
        {t('auth.profile.title')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
