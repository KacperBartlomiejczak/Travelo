import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

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

const { dialog } = tokens.components;

// Confirm dialog (design-context §8.18, pill-nav-and-dialog A1, A4): centred on a backdrop, width viewport − 40dp, at most 360dp,
// confirm on top and cancel below, full width and 16dp apart (like DeleteTripSheet, so they are never adjacent). The
// caller passes translated strings. Dismissing (scrim, back button) means cancel. It fades over 180 ms (`duration.standard`), or
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
    const fade = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: tokens.motion.duration.standard, useNativeDriver: false });
    fade.start(({ finished }) => finished && !visible && setMounted(false));
    return () => fade.stop();
  }, [visible, reduceMotion, opacity]);

  return (
    <Modal testID="confirm-dialog-modal" visible={open} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View
        testID="confirm-dialog-container"
        style={{ flex: 1, opacity, justifyContent: 'center', alignItems: 'center', paddingHorizontal: dialog.horizontalMargin }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onCancel}
          // §8.18: the backdrop is black at the token opacity.
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.primitives.pure.black, opacity: dialog.backdropOpacity }]}
        />
        <View
          testID="confirm-dialog"
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: dialog.maxWidth,
            borderRadius: dialog.radius,
            padding: dialog.padding,
            gap: tokens.spacing[6],
            backgroundColor: theme.surface.overlay,
            ...theme.elevation.level3, // §5.2: level 3 is for blocking dialogs (a border in dark mode)
          }}
        >
          <View style={{ gap: tokens.spacing[2] }}>
            <Text accessibilityRole="header" style={[tokens.typography.styles.headingSM, { color: theme.text.primary }]}>
              {title}
            </Text>
            <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>{message}</Text>
          </View>
          <View testID="confirm-dialog-actions" style={{ gap: tokens.spacing[4] }}>
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
