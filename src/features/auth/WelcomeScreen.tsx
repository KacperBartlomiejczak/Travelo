import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CoverImage } from '@/components/CoverImage';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useIsOffline } from '@/providers/BudgetSync';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope, useTheme } from '@/theme/useTheme';

import { SignInSheet } from './SignInSheet';

// The bundled cover behind the welcome screen (auth-onboarding P6): no new asset.
const WELCOME_COVER = 'preset:bali';

// Entrance (theme-split-and-profile-prefill P3): the title, the sentence and the button each fade in and rise 16dp
// (spacing[4]) over the 500 ms `welcomeRevealed` duration, 150 ms apart (longer than first built, D13), on the `enter`
// easing of design-context §7.2.
const ENTRANCE_STAGGER_MS = 150;
const ENTER_EASING = Easing.bezier(...tokens.motion.easing.enter);
const ENTRANCE_PARTS = 3;
const { spacing, typography } = tokens;

/**
 * One progress value (0 → 1) per part of the column. Once, on mount, they run one after another; with reduce motion (§9.4)
 * nothing moves or fades: they jump to 1. Until the system answers whether to reduce motion, they wait at 0, so a phone
 * that asks for it never shows a part sliding. They only drive opacity and translateY, so the button is pressable at once.
 */
function useEntrance(): Animated.Value[] {
  const [progress] = useState(() => Array.from({ length: ENTRANCE_PARTS }, () => new Animated.Value(0)));
  const reduceMotion = useReduceMotion();
  const played = useRef(false);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      // Also settles an entrance that was running when reduce motion came on (its cleanup stopped it mid-way).
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
        // JS driver, like the pill navigation: three short, one-off tweens, and the native driver does not update the rendered style under Jest.
        useNativeDriver: false,
      }),
    );
    entrance.forEach((animation) => animation.start());
    return () => entrance.forEach((animation) => animation.stop());
  }, [reduceMotion, progress]);

  return progress;
}

/**
 * The first screen of a signed-out user (auth-onboarding D5, D6, P4, P5): a full-screen cover photo under the `hero.scrim`, fading
 * into the dark canvas like the trip hero, with the title, one sentence and "Zaloguj się" in the thumb zone. Always dark. "Zaloguj się" opens the sign-in
 * sheet; offline the button is disabled under the offline banner. The screen never navigates after a sign-in: the gate does.
 */
export function WelcomeScreen() {
  return (
    <DarkThemeScope>
      <Welcome />
    </DarkThemeScope>
  );
}

function Welcome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gradientId = useId();
  const offline = useIsOffline();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Pushed screens stay mounted under the next one (the e-mail screens): only the focused screen keeps the bar light.
  const focused = useIsFocused();
  const [titleProgress, bodyProgress, actionProgress] = useEntrance();
  const { hero } = theme;
  const side = width < tokens.layout.compactBreakpoint ? spacing[4] : spacing[5];
  const enter = (progress: Animated.Value) => ({
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [spacing[4], 0] }) }],
  });

  return (
    <View testID="welcome-screen" style={[styles.screen, { backgroundColor: theme.background.canvas }]}>
      <StatusBar style={focused ? 'light' : 'auto'} />
      <View testID="welcome-photo" aria-hidden style={StyleSheet.absoluteFill}>
        {/* On the dark canvas while it loads, so the light placeholder surface does not flash behind the fade. */}
        <CoverImage
          testID="welcome-image"
          cover={WELCOME_COVER}
          variant="full"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.background.canvas }]}
        />
        {/* Darkens the whole photo evenly, so the sheet's rounded corners do not show where the photo ends. */}
        <View testID="welcome-dim" style={[StyleSheet.absoluteFill, { backgroundColor: hero.scrim }]} />
        <Svg testID="welcome-gradient" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={tokens.screenMetrics.tripOverview.heroFadeStart} stopColor={theme.background.canvas} stopOpacity={0} />
              <Stop offset={1} stopColor={theme.background.canvas} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
      {/* Scrolls only when large text does not fit; otherwise the column sits at the bottom of the screen. */}
      <ScrollView
        testID="welcome-content"
        alwaysBounceVertical={false}
        contentContainerStyle={styles.content}
      >
        <View
          testID="welcome-column"
          style={{
            width: '100%',
            maxWidth: tokens.layout.maxContentWidth,
            alignSelf: 'center',
            paddingTop: insets.top + spacing[4],
            paddingHorizontal: side,
            paddingBottom: insets.bottom + spacing[4],
            gap: spacing[4],
          }}
        >
          <View style={{ gap: spacing[2] }}>
            <Animated.View testID="welcome-title" style={enter(titleProgress)}>
              <Text accessibilityRole="header" style={[typography.styles.displayXL, { color: hero.text }]}>
                {t('auth.welcome.title')}
              </Text>
            </Animated.View>
            <Animated.View testID="welcome-body" style={enter(bodyProgress)}>
              <Text style={[typography.styles.bodyLG, { color: theme.text.secondary }]}>{t('auth.welcome.body')}</Text>
            </Animated.View>
          </View>
          {offline && <OfflineBanner />}
          <Animated.View testID="welcome-action" style={enter(actionProgress)}>
            <PrimaryButton label={t('auth.welcome.signIn')} onPress={() => setSheetOpen(true)} disabled={offline} />
          </Animated.View>
        </View>
      </ScrollView>
      {sheetOpen && <SignInSheet onClose={() => setSheetOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'flex-end' },
});
