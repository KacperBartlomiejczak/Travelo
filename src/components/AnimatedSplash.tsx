import LottieView from 'lottie-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { darkTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import splash from '../../assets/animations/splash.json';
import { trace } from '@/lib/startupTrace';

type Props = { ready: boolean; onDone: () => void };

const width = tokens.screenMetrics.splash.animationWidth;
const height = width * (splash.h / splash.w);

// The logo animation over the app while it starts (splash-animation, A3, D2, D3): plays once on the theme's canvas, shows a spinner
// under the logo if the app is still not ready when the animation ends, and fades out once both are done. The first frame
// matches the native splash, so the lockup box is exactly centered and nothing (the spinner included) may move it.
export function AnimatedSplash({ ready, onDone }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [played, setPlayed] = useState(false);
  const lottie = useRef<LottieView>(null);
  const opacity = useSharedValue(1);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Reduce motion has nothing to play: the final frame counts as finished. `null` (not answered yet) waits on frame 0.
  const finished = played || reduceMotion === true;
  const leaving = finished && ready;
  const fadeDuration = reduceMotion === true ? tokens.motion.duration.reduced : tokens.motion.duration.standard;

  // `autoPlay` only acts when the native view mounts, and then the answer is still `null`: start by hand once it says "false".
  useEffect(() => {
    if (reduceMotion === false) lottie.current?.play();
    if (reduceMotion === false) trace('splash:play');
  }, [reduceMotion]);
  useEffect(() => { if (played) trace('splash:played'); }, [played]);

  useEffect(() => {
    if (!leaving) return;
    opacity.value = withTiming(0, { duration: fadeDuration, easing: Easing.bezier(...tokens.motion.easing.exit) });
    trace('splash:fade');
    const timer = setTimeout(() => onDoneRef.current(), fadeDuration);
    return () => clearTimeout(timer);
  }, [leaving, fadeDuration, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // The dark logo is the reversed one (logo README §4): the ink t and wordmark turn paper, the sun turns dark coral. The matte is not a colour.
  const colorFilters = useMemo(
    () =>
      theme === darkTheme
        ? [
            { keypath: 't', color: theme.surface.inverse },
            { keypath: 'sun', color: theme.brand.primary },
            { keypath: 'wordmark', color: theme.surface.inverse },
          ]
        : [],
    [theme],
  );

  return (
    <Animated.View
      testID="splash-overlay"
      style={[
        { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.canvas },
        fadeStyle,
      ]}
    >
      <View style={{ width, height }}>
        <LottieView
          ref={lottie}
          source={splash}
          style={{ width, height }}
          loop={false}
          autoPlay={reduceMotion === false}
          progress={reduceMotion === true ? 1 : reduceMotion === null ? 0 : undefined}
          colorFilters={colorFilters}
          onAnimationFinish={() => setPlayed(true)}
          onAnimationFailure={() => setPlayed(true)}
        />
        {finished && !ready ? (
          <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, alignItems: 'center' }}>
            <ActivityIndicator
              testID="splash-spinner"
              color={theme.brand.primary}
              accessibilityLabel={t('splash.loading')}
              accessibilityState={{ busy: true }}
            />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
