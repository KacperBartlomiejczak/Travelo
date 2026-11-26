import { router } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { iconography, radii, spacing, tokens, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Same entrance as the welcome screen: each part fades in and rises 16dp (spacing[4]) over 500 ms, 150 ms apart, on the enter easing.
const ENTRANCE_STAGGER_MS = 150;
const ENTER_EASING = Easing.bezier(...tokens.motion.easing.enter);
const ENTRANCE_PARTS = 4;
const ART_SIZE = spacing[24] + spacing[8]; // 128dp

/** One progress value (0 → 1) per part; once on mount, or at once with reduce motion (also when the system cannot say). */
function useEntrance(): Animated.Value[] {
  const [progress] = useState(() => Array.from({ length: ENTRANCE_PARTS }, () => new Animated.Value(0)));
  const reduceMotion = useReduceMotion();
  const played = useRef(false);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      progress.forEach((value) => value.setValue(1));
      played.current = true;
      return;
    }
    if (played.current) return;
    played.current = true;
    const entrance = progress.map((value, index) =>
      Animated.timing(value, {
        toValue: 1,
        delay: index * ENTRANCE_STAGGER_MS,
        duration: tokens.motion.microinteraction.welcomeRevealed.itemDuration,
        easing: ENTER_EASING,
        useNativeDriver: false,
      }),
    );
    entrance.forEach((animation) => animation.start());
    return () => entrance.forEach((animation) => animation.stop());
  }, [reduceMotion, progress]);

  return progress;
}

/** Shown once after a subscription starts (premium-welcome-screen): a PRO crown, a thank-you and "Super!" in the thumb zone. */
export function ProWelcomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gradientId = useId();
  const [artProgress, titleProgress, bodyProgress, actionProgress] = useEntrance();
  const enter = (progress: Animated.Value) => ({
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [spacing[4], 0] }) }],
  });

  return (
    <View testID="pro-welcome-screen" style={[styles.screen, { backgroundColor: theme.background.canvas }]}>
      <ScrollView testID="pro-welcome-content" alwaysBounceVertical={false} contentContainerStyle={styles.content}>
        <View
          testID="pro-welcome-column"
          style={{
            flexGrow: 1,
            width: '100%',
            maxWidth: tokens.layout.maxContentWidth,
            alignSelf: 'center',
            paddingTop: insets.top + spacing[4],
            paddingHorizontal: width < tokens.layout.compactBreakpoint ? spacing[4] : spacing[5],
            paddingBottom: insets.bottom + spacing[4],
            gap: spacing[6],
          }}
        >
          <View style={styles.middle}>
            <Animated.View
              testID="pro-welcome-art"
              aria-hidden
              style={[
                enter(artProgress),
                { width: ART_SIZE, height: ART_SIZE, borderRadius: radii.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
              ]}
            >
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset={0} stopColor={theme.brand.primary} stopOpacity={1} />
                    <Stop offset={1} stopColor={theme.accent.sun} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
              </Svg>
              <Crown size={spacing[16]} strokeWidth={iconography.strokeWidth} color={theme.brand.onBrand} />
            </Animated.View>
            <Animated.View testID="pro-welcome-title" style={enter(titleProgress)}>
              <Text accessibilityRole="header" style={[typography.styles.displayLG, styles.centered, { color: theme.text.primary }]}>
                {t('proWelcome.title')}
              </Text>
            </Animated.View>
            <Animated.View testID="pro-welcome-body" style={enter(bodyProgress)}>
              <Text style={[typography.styles.bodyLG, styles.centered, { color: theme.text.secondary }]}>{t('proWelcome.body')}</Text>
            </Animated.View>
          </View>
          <Animated.View testID="pro-welcome-action" style={enter(actionProgress)}>
            <PrimaryButton label={t('proWelcome.done')} onPress={() => router.back()} />
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between' },
  middle: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  centered: { textAlign: 'center' },
});
