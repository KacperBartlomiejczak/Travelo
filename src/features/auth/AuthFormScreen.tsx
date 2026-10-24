import { useHeaderHeight } from 'expo-router/react-navigation';
import { CircleAlert } from 'lucide-react-native';
import type { ReactNode, Ref } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { useIsOffline } from '@/providers/BudgetSync';
import { tokens } from '@/theme/tokens';
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
  /** For a screen without a header (profile setup): the content starts below the status bar. */
  topInset?: boolean;
  /** Lets a screen scroll the fields, e.g. to the first one with an error. */
  scrollRef?: Ref<ScrollView>;
};

/**
 * Frame of the e-mail and code screens (auth-onboarding step 7): heading and hint, the offline banner (P4), the fields in a
 * scroll view, and the actions pinned at the bottom. Like the wizard, the frame is padded by the keyboard's height on both
 * platforms (with edge-to-edge Android does not resize the window), so the action stays above the keyboard.
 */
export function AuthFormScreen({ testID, title, hint, children, footer, topInset = false, scrollRef }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The frame sits under the stack header; the keyboard's position is measured from the top of the window.
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const offline = useIsOffline();
  const { spacing, typography } = tokens;
  const side = width < tokens.layout.compactBreakpoint ? spacing[4] : spacing[5];

  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={[styles.screen, { backgroundColor: theme.background.canvas }]}
    >
      {/* Without a header the status bar area is a solid, fixed strip, so what scrolls up is hidden behind it and never drawn under the clock (D24). */}
      {topInset && <View testID={`${testID}-top-inset`} style={{ height: insets.top, backgroundColor: theme.background.canvas }} />}
      <ScrollView
        ref={scrollRef}
        testID={`${testID}-scroll`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.column,
          { maxWidth: tokens.layout.maxContentWidth, paddingHorizontal: side, paddingTop: spacing[4], gap: spacing[6] },
        ]}
      >
        <View style={{ gap: spacing[2] }}>
          <Text accessibilityRole="header" style={[typography.styles.headingLG, { color: theme.text.primary }]}>
            {title}
          </Text>
          {hint && <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{hint}</Text>}
        </View>
        {offline && <OfflineBanner />}
        {children}
      </ScrollView>
      <View
        style={[
          styles.column,
          { maxWidth: tokens.layout.maxContentWidth, paddingHorizontal: side, paddingTop: spacing[3], paddingBottom: insets.bottom + spacing[4], gap: spacing[3] },
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
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1] }}>
      <CircleAlert
        testID={`${testID}-icon`}
        size={tokens.iconography.size.xs}
        strokeWidth={tokens.iconography.strokeWidth}
        color={theme.semantic.error.foreground}
        aria-hidden
      />
      <Text style={[tokens.typography.styles.bodySM, { color: theme.semantic.error.foreground, flexShrink: 1 }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { width: '100%', alignSelf: 'center' },
});
