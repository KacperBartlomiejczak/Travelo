import { useHeaderHeight } from 'expo-router/react-navigation';
import { CircleX } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { useIsOffline } from '@/providers/BudgetSync';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** `<testID>` is the frame, `<testID>-scroll` the scrolling part. */
  testID: string;
  title: string;
  hint?: string;
  /** The form fields; they scroll. */
  children: ReactNode;
  /** The buttons (and an error above them), pinned in the thumb zone above the keyboard. */
  footer: ReactNode;
};

/**
 * Frame of the e-mail and code screens (auth-onboarding step 7): heading and hint, the offline banner (P4), the fields in a
 * scroll view, and the actions pinned at the bottom. Like the wizard, the frame is padded by the keyboard's height on both
 * platforms (with edge-to-edge Android does not resize the window), so the action stays above the keyboard.
 */
export function AuthFormScreen({ testID, title, hint, children, footer }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The frame sits under the stack header; the keyboard's position is measured from the top of the window.
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const offline = useIsOffline();
  const side = width < theme.breakpoints.compact ? theme.spacing[4] : theme.spacing[5];
  const { colors, typography, spacing } = theme;

  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        testID={`${testID}-scroll`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.column,
          { maxWidth: theme.size.maxContentWidth, paddingHorizontal: side, paddingTop: spacing[4], gap: spacing[6] },
        ]}
      >
        <View style={{ gap: spacing[2] }}>
          <Text accessibilityRole="header" style={[typography.heading1, { color: colors.text.primary }]}>
            {title}
          </Text>
          {hint && <Text style={[typography.bodyM, { color: colors.text.secondary }]}>{hint}</Text>}
        </View>
        {offline && <OfflineBanner />}
        {children}
      </ScrollView>
      <View
        style={[
          styles.column,
          { maxWidth: theme.size.maxContentWidth, paddingHorizontal: side, paddingTop: spacing[3], paddingBottom: insets.bottom + spacing[4], gap: spacing[3] },
        ]}
      >
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * An error above the pinned buttons, with an icon (never colour alone). The screen announces it by itself when it appears, so
 * this is not a live region as well: that would read it twice.
 */
export function FormError({ testID, message }: { testID: string; message: string }) {
  const theme = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }}>
      <CircleX
        testID={`${testID}-icon`}
        size={theme.size.iconInline}
        strokeWidth={theme.size.iconStroke}
        color={theme.colors.status.error}
        aria-hidden
      />
      <Text style={[theme.typography.bodyS, { color: theme.colors.status.error, flexShrink: 1 }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { width: '100%', alignSelf: 'center' },
});
