import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme } from '@/theme/useTheme';

type Props = { width: DimensionValue; height: number; radius?: number; color?: string; testID?: string };

// A placeholder block with the geometry of the content it stands for (§10.18, profile-screen D9). Colour `colors.skeleton`
// (light neutral.200 = the border colour, D27; dark `dark.border`, so the pulse shows on the background, D24) that pulses in opacity
// 1 -> skeletonPulseMin -> 1, one cycle per `duration.skeletonPulse`, ease in-out, repeating. It never scales (§9.4).
// It stays still with reduce motion on, and until the system has said whether it is on. Hidden from screen readers:
// the parent says "loading".
// `color` is for a block on a surface that is itself `surface.secondary` (dark card, app-loading-skeleton D5).
export function SkeletonBlock({ width, height, radius, color, testID }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  const { skeletonPulse } = theme.duration;
  const { skeletonPulseMin } = theme.opacity;

  useEffect(() => {
    if (reduceMotion !== false) return;
    const leg = { duration: skeletonPulse / 2, easing: Easing.inOut(Easing.ease) };
    opacity.value = withRepeat(withSequence(withTiming(skeletonPulseMin, leg), withTiming(1, leg)), -1);
    return () => {
      cancelAnimation(opacity);
      opacity.value = 1;
    };
  }, [reduceMotion, opacity, skeletonPulse, skeletonPulseMin]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      aria-hidden
      style={[
        { width, height, borderRadius: radius ?? theme.radius.sm, backgroundColor: color ?? theme.colors.skeleton },
        animatedStyle,
      ]}
    />
  );
}
