import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const MESSAGES = ['plan.generating.finding', 'plan.generating.arranging', 'plan.generating.almost'] as const;
// Copy pacing (how long a line is readable), not motion, so it is not a token. The backend exposes no stage, so the
// messages only change on a timer (§11.3.6: no fake percentages).
const MESSAGE_MS = 4000;
const SEGMENT_SHARE = 0.4;

const { spacing, typography, motion, components, iconography } = tokens;
// One pass of the segment across the track.
const SWEEP_MS = motion.microinteraction.skeletonPulse.duration;
const { progress } = components;

// Generating state of the plan screen (ai-trip-plan D1): an indeterminate bar, no percentages.
export function PlanGenerating({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion() === true;
  const [step, setStep] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);
  const segmentWidth = trackWidth * SEGMENT_SHARE;
  const animate = !reduceMotion;

  useEffect(() => {
    if (step >= MESSAGES.length - 1) return;
    const timer = setTimeout(() => setStep(step + 1), MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (!animate || trackWidth === 0) return;
    offset.value = -segmentWidth;
    offset.value = withRepeat(
      withTiming(trackWidth, { duration: SWEEP_MS, easing: Easing.bezier(...motion.easing.linear) }),
      -1,
    );
    return () => cancelAnimation(offset);
  }, [animate, trackWidth, segmentWidth, offset]);

  const segmentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const message = t(MESSAGES[step]);

  return (
    <View testID={testID} style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <Sparkles size={iconography.size.sm} color={theme.text.brand} />
        <Text
          accessibilityRole="header"
          style={[typography.styles.headingSM, { color: theme.text.primary }]}
        >
          {t('plan.generating.title')}
        </Text>
      </View>
      <Animated.Text
        key={step}
        testID="plan-generating-message"
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.standard)}
        accessibilityLiveRegion="polite"
        style={[typography.styles.bodyMD, { color: theme.text.secondary }]}
      >
        {message}
      </Animated.Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={message}
        accessibilityState={{ busy: true }}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          height: progress.trackHeight,
          borderRadius: progress.radius,
          backgroundColor: theme.background.sunken,
          overflow: 'hidden',
        }}
      >
        {animate ? (
          <Animated.View
            testID="plan-generating-segment"
            style={[
              { width: segmentWidth, height: '100%', borderRadius: progress.radius, backgroundColor: theme.brand.primary },
              segmentStyle,
            ]}
          />
        ) : (
          <View testID="plan-generating-static" style={{ flex: 1, backgroundColor: theme.brand.primary }} />
        )}
      </View>
    </View>
  );
}
