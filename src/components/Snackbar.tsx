import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  message: string | null;
  onHide: () => void;
  /** Extra distance above the usual place, for a screen with an action pinned at the bottom (§10.16, D21). */
  bottomOffset?: number;
};

const { snackbar } = tokens.components;

// Short confirmation at the bottom of the screen (design-context §8.17, neutral type, trip-edit-menu D11, D14). It shows while
// `message` is set and calls `onHide` after 3500 ms; the owner clears `message` in `onHide`, and the snackbar then
// fades out (or disappears at once with reduce motion), keeping the last text on screen during the fade.
export function Snackbar({ message, onHide, bottomOffset = 0 }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);
  // The text on screen: the current message, kept after it is cleared until the fade-out has finished.
  const [rendered, setRendered] = useState(message);
  if (message !== null && message !== rendered) setRendered(message);
  // §9.4: no fade when the system asks to reduce motion.
  const reduceMotion = useReduceMotion() === true;

  const visible = message !== null;
  const gone = !visible && (rendered === null || reduceMotion);
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(visible ? 1 : 0);
      return;
    }
    // JS driver: only opacity moves, for 180 ms, and the native driver does not update the rendered style under Jest.
    const fade = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: tokens.motion.duration.standard, useNativeDriver: false });
    fade.start(({ finished }) => finished && !visible && setRendered(null));
    return () => fade.stop();
  }, [visible, reduceMotion, opacity]);

  useEffect(() => {
    if (message === null) return;
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(() => onHideRef.current(), snackbar.durationShort);
    return () => clearTimeout(timer);
  }, [message]);

  if (gone) return null;
  return (
    <Animated.View
      testID="snackbar-container"
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: tokens.layout.screenGutter,
        right: tokens.layout.screenGutter,
        bottom: insets.bottom + tokens.spacing[4] + bottomOffset,
        alignItems: 'center',
        opacity,
      }}
    >
      <View
        testID="snackbar"
        accessible
        accessibilityRole="alert"
        style={{
          minHeight: snackbar.minHeight,
          maxWidth: snackbar.maxWidth,
          paddingHorizontal: snackbar.horizontalPadding,
          paddingVertical: snackbar.verticalPadding,
          borderRadius: snackbar.radius,
          justifyContent: 'center',
          backgroundColor: theme.surface.inverse,
        }}
      >
        <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.inverse }]}>{message ?? rendered}</Text>
      </View>
    </Animated.View>
  );
}
