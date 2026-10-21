import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** The confirm action is destructive: it uses the error colour (its label still says what it does). */
  destructive?: boolean;
  onConfirm: () => void;
  /** Cancel button, scrim tap and Android back button: the safe choice. Never calls `onConfirm`. */
  onCancel: () => void;
};

// Confirm dialog (design-context §10.17, pill-nav-and-dialog A1, A4): centred on a scrim, width viewport − 40dp,
// confirm on top and cancel below, full width and 16dp apart (like DeleteTripSheet, so they are never adjacent). The
// caller passes translated strings. Dismissing (scrim, back button) means cancel. It fades over 220 ms (§9.1), or
// appears at once with reduce motion (§9.4). Screen readers: the Android Modal is its own window that TalkBack
// announces and traps focus in; on iOS `accessibilityViewIsModal` keeps VoiceOver inside the dialog.
export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0));
  // §9.4: no fade when the system asks to reduce motion.
  const reduceMotion = useReduceMotion() === true;

  // The Modal stays mounted after `visible` turns false until the fade-out has finished.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  if (!visible && mounted && reduceMotion) setMounted(false); // with reduce motion there is no fade-out to wait for
  const open = visible || mounted;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(visible ? 1 : 0);
      return;
    }
    // JS driver: only opacity moves, and the native driver does not update the rendered style under Jest.
    const fade = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: theme.duration.dialog, useNativeDriver: false });
    fade.start(({ finished }) => finished && !visible && setMounted(false));
    return () => fade.stop();
  }, [visible, reduceMotion, opacity, theme.duration.dialog]);

  return (
    <Modal testID="confirm-dialog-modal" visible={open} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View
        testID="confirm-dialog-container"
        style={{ flex: 1, opacity, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing[5] }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay.scrim }]}
        />
        <View
          testID="confirm-dialog"
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: theme.size.maxContentWidth,
            borderRadius: theme.radius.lg,
            padding: theme.spacing[6],
            gap: theme.spacing[6],
            backgroundColor: theme.colors.surface.elevated,
            ...theme.elevation.dialog,
          }}
        >
          <View style={{ gap: theme.spacing[2] }}>
            <Text accessibilityRole="header" style={[theme.typography.heading3, { color: theme.colors.text.primary }]}>
              {title}
            </Text>
            <Text style={[theme.typography.bodyM, { color: theme.colors.text.secondary }]}>{message}</Text>
          </View>
          <View testID="confirm-dialog-actions" style={{ gap: theme.spacing[4] }}>
            {destructive ? (
              <TextButton variant="destructive" label={confirmLabel} onPress={onConfirm} />
            ) : (
              <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            )}
            <TextButton variant="secondary" label={cancelLabel} onPress={onCancel} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
