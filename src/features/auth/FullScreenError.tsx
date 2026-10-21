import { CircleX } from 'lucide-react-native';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextButton } from '@/components/TextButton';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  testID?: string;
};

// A whole-screen error state (design-context §12 "Error": icon, a short explanation, a retry; it never blames the user).
// Same look as the error state of the home screen. Used by the gate when the app cannot start or the profile cannot be read.
export function FullScreenError({ message, retryLabel, onRetry, testID }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { spacing, colors, typography } = theme;
  const isCompact = width < theme.breakpoints.compact;

  // The error replaces the splash screen without focus moving; VoiceOver needs it announced.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      testID={testID}
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
      <View style={[styles.content, { maxWidth: theme.size.maxContentWidth, gap: spacing[3] }]}>
        <CircleX size={theme.size.iconFeature} strokeWidth={theme.size.iconStroke} color={colors.status.error} aria-hidden />
        <Text style={[typography.bodyM, styles.message, { color: colors.text.primary }]}>
          {message}
        </Text>
        <TextButton variant="secondary" label={retryLabel} onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, width: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  message: { textAlign: 'center' },
});
