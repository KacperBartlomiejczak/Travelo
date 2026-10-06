import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const HANDLE = { width: 36, height: 4 }; // §10.12
const SWIPE_TO_CLOSE = 60; // dp pulled down on the handle area before the sheet closes
const SWIPE_START = 8; // dp of vertical movement before the handle area takes the gesture (taps stay taps)

// Bottom sheet (design-context §10.12): 24dp top corners, at most 90 % of the screen, a handle,
// closed by a swipe down, a backdrop tap or the system back button.
export function BottomSheet({ visible, title, onClose, children }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // §9.4: no slide when the system asks to reduce motion.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => active && setReduceMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > SWIPE_START && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > SWIPE_TO_CLOSE) onClose();
        },
      }),
    [onClose],
  );

  return (
    <Modal testID="bottom-sheet-modal" visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={[styles.fill, { backgroundColor: theme.colors.overlay.scrim }]}
        />
        <View
          testID="bottom-sheet"
          style={{
            maxHeight: '90%',
            width: '100%',
            maxWidth: theme.size.maxContentWidth,
            alignSelf: 'center',
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            backgroundColor: theme.colors.surface.elevated,
            paddingHorizontal: theme.spacing[5],
            paddingBottom: insets.bottom + theme.spacing[4],
            gap: theme.spacing[4],
          }}
        >
          <View {...swipe.panHandlers} style={{ alignItems: 'center', paddingTop: theme.spacing[3], paddingBottom: theme.spacing[1] }}>
            <View
              testID="bottom-sheet-handle"
              aria-hidden
              style={{ ...HANDLE, borderRadius: theme.radius.full, backgroundColor: theme.colors.border }}
            />
          </View>
          <Text accessibilityRole="header" style={[theme.typography.heading3, { color: theme.colors.text.primary }]}>
            {title}
          </Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
