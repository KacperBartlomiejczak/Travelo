import { useState } from 'react';
import { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tokens } from '@/theme/tokens';

const { duration, easing, press } = tokens.motion;

/**
 * Pressed motion of every button (design-context §8.1, sunline-redesign D10): scale 1 → `motion.press.scale` over
 * `duration.pressIn`, none when the system asks to reduce motion. Put `style` on an `Animated.View` around the Pressable
 * and the two handlers on the Pressable.
 */
export function usePressScale() {
  const [held, setHeld] = useState(false);
  const reduceMotion = useReduceMotion() === true;
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(held && !reduceMotion ? press.scale : 1, {
          duration: duration.pressIn,
          easing: Easing.bezier(...easing.standard),
        }),
      },
    ],
  }));
  return { style, onPressIn: () => setHeld(true), onPressOut: () => setHeld(false) };
}
