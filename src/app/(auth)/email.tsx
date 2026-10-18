import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

// Placeholder until the e-mail screen is built (auth-onboarding step 7): the sign-in sheet needs somewhere to push to.
export default function EmailScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="email-screen"
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing[4], paddingHorizontal: spacing[5] }]}
    >
      <Text accessibilityRole="header" style={[typography.heading1, { color: colors.text.primary }]}>
        {t('auth.email.title')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
