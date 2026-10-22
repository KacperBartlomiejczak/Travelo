import { useEffect, useState } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { heroHeight } from './TripHero';

const { duration, minOpacity } = tokens.motion.microinteraction.skeletonPulse;

// Placeholder with the full-bleed hero's geometry while the current trip loads (design-context §8.19, §10.1). It pulses
// its opacity 1 → minOpacity → 1 over `duration` (sunline-redesign D5, instead of the §8.19 shimmer) and is static under reduce motion.
export function TripHeroSkeleton() {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  // Pulses only once the system has said no: static under reduce motion and while the answer is still unknown.
  const pulses = useReduceMotion() === false;
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!pulses) {
      opacity.setValue(1);
      return;
    }
    // JS driver: the native driver does not update the rendered style under Jest.
    const step = (toValue: number) =>
      Animated.timing(opacity, { toValue, duration: duration / 2, easing: Easing.bezier(...tokens.motion.easing.linear), useNativeDriver: false });
    const pulse = Animated.loop(Animated.sequence([step(minOpacity), step(1)]));
    pulse.start();
    return () => pulse.stop();
  }, [pulses, opacity]);

  return (
    <Animated.View
      testID="trip-hero-skeleton"
      aria-hidden
      style={{ height: heroHeight(height), borderRadius: tokens.radii.none, backgroundColor: theme.skeleton.base, opacity }}
    />
  );
}
