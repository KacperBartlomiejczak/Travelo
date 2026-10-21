import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Pressable, StyleSheet, Text, View, type PanResponderGestureState, type PanResponderInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  children: ReactNode;
};

const HANDLE = { width: 36, height: 4 }; // §10.12
const SWIPE_TO_CLOSE = 60; // dp pulled down on the header (handle and title) before the sheet closes

// How far a drag pulls the sheet down: only a downward drag that is mostly vertical counts.
const pulled = (gesture: PanResponderGestureState) => (gesture.dy > 0 && gesture.dy > Math.abs(gesture.dx) ? gesture.dy : 0);

// Bottom sheet (design-context §10.12): 24dp top corners, at most 90 % of the screen, a handle,
// closed by a swipe down, a backdrop tap or the system back button. The sheet follows a finger dragged down from its
// header (trip-edit-menu D18) and springs back when released before SWIPE_TO_CLOSE. With `dismissible={false}` (a delete
// is in flight) none of the three closes it: the backdrop and back button do nothing and a swipe always springs back.
export function BottomSheet({ visible, title, onClose, dismissible = true, children }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // §9.4: no slide when the system asks to reduce motion.
  const reduceMotion = useReduceMotion() === true;
  const [offset] = useState(() => new Animated.Value(0)); // how far the sheet is pulled down
  // The gesture lives as long as the sheet: callers pass new inline lambdas, and a PanResponder rebuilt on every render
  // would lose its state in the middle of a drag. So it is created once, after the first render (the handlers read the
  // latest values from a ref when they run, which React only allows outside of render).
  const latest = useRef({ onClose, dismissible, reduceMotion, duration: theme.duration.small });
  useEffect(() => {
    latest.current = { onClose, dismissible, reduceMotion, duration: theme.duration.small };
  }, [onClose, dismissible, reduceMotion, theme.duration.small]);
  const dismiss = () => {
    if (dismissible) onClose();
  };
  useEffect(() => {
    if (visible) offset.setValue(0); // a sheet that was swiped closed opens at its resting place
  }, [visible, offset]);
  const [swipe, setSwipe] = useState<PanResponderInstance | null>(null);
  useEffect(() => {
    // JS driver: the offset follows the finger on every move, and the native driver does not update the rendered style under Jest.
    const settle = () => {
      if (latest.current.reduceMotion) offset.setValue(0);
      else Animated.timing(offset, { toValue: 0, duration: latest.current.duration, useNativeDriver: false }).start();
    };
    setSwipe(
      PanResponder.create({
        // The touch must be claimed at its start: RN's Modal host view claims every touch that nothing below it claims,
        // and once it is the responder, the responder system never asks its descendants about a move.
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => offset.setValue(pulled(gesture)),
        onPanResponderRelease: (_, gesture) => (latest.current.dismissible && pulled(gesture) > SWIPE_TO_CLOSE ? latest.current.onClose() : settle()),
        onPanResponderTerminate: settle,
      }),
    );
  }, [offset]);

  return (
    <Modal testID="bottom-sheet-modal" visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={dismiss} statusBarTranslucent>
      {/* wizard-keyboard D5: `padding` on both platforms. Android's window resize does not reach an edge-to-edge dialog, and
          the translucent modal starts at the top of the window like the keyboard's coordinates, so no offset is needed.
          theme-split D14: the scrim is absolutely positioned, so it fills the whole window (keyboard padding included) and lies
          under the sheet, which is pushed to the bottom; dimming also covers the gaps beside the rounded top corners. */}
      <KeyboardAvoidingView testID="bottom-sheet-keyboard" behavior="padding" style={styles.frame}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={dismiss}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay.scrim }]}
        />
        <Animated.View
          testID="bottom-sheet"
          style={{
            transform: [{ translateY: offset }],
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
          {/* The drag area is the whole header: a View with only layout styles is flattened away (ViewShadowNode.cpp), and then
              only its children that are native views, here the 36 × 4 handle, would receive touches. `collapsable={false}`
              (and the testID, which also makes it a native view) keeps the header one, so a touch anywhere on it reaches its
              handlers. It claims the touch at its start (`onStartShouldSetPanResponder`) because RN's Modal host claims every
              touch that nothing below it claims. */}
          <View testID="bottom-sheet-header" collapsable={false} {...swipe?.panHandlers} style={{ gap: theme.spacing[4] }}>
            <View style={{ alignItems: 'center', paddingTop: theme.spacing[3], paddingBottom: theme.spacing[1] }}>
              <View
                testID="bottom-sheet-handle"
                aria-hidden
                style={{ ...HANDLE, borderRadius: theme.radius.full, backgroundColor: theme.colors.border }}
              />
            </View>
            <Text accessibilityRole="header" style={[theme.typography.heading3, { color: theme.colors.text.primary }]}>
              {title}
            </Text>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
});
