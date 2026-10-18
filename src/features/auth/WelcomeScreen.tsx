import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CoverImage } from '@/components/CoverImage';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useIsOffline } from '@/providers/BudgetSync';
import { DarkThemeScope, useTheme } from '@/theme/useTheme';

import { SignInSheet } from './SignInSheet';

// The bundled cover behind the welcome screen (auth-onboarding P6): no new asset.
const WELCOME_COVER = 'preset:bali';

/**
 * The first screen of a signed-out user (auth-onboarding D5, D6, P4, P5): a full-screen cover photo fading into ink like the
 * trip hero, with the title, one sentence and "Zaloguj się" in the thumb zone. Always dark. "Zaloguj się" opens the sign-in
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
  const { spacing, colors, typography } = theme;
  const { hero } = colors;
  const side = width < theme.breakpoints.compact ? spacing[4] : spacing[5];

  return (
    <View testID="welcome-screen" style={[styles.screen, { backgroundColor: hero.background }]}>
      <StatusBar style={focused ? 'light' : 'auto'} />
      <View testID="welcome-photo" aria-hidden style={StyleSheet.absoluteFill}>
        {/* On ink while it loads, so the light placeholder surface does not flash behind the fade. */}
        <CoverImage
          testID="welcome-image"
          cover={WELCOME_COVER}
          variant="full"
          style={[StyleSheet.absoluteFill, { backgroundColor: hero.background }]}
        />
        <Svg testID="welcome-gradient" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={theme.gradient.heroFade.start} stopColor={hero.background} stopOpacity={0} />
              <Stop offset={1} stopColor={hero.background} stopOpacity={1} />
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
            maxWidth: theme.size.maxContentWidth,
            alignSelf: 'center',
            paddingTop: insets.top + spacing[4],
            paddingHorizontal: side,
            paddingBottom: insets.bottom + spacing[4],
            gap: spacing[4],
          }}
        >
          <View style={{ gap: spacing[2] }}>
            <Text accessibilityRole="header" style={[typography.displayXL, { color: hero.text }]}>
              {t('auth.welcome.title')}
            </Text>
            <Text style={[typography.bodyL, { color: hero.textSecondary }]}>{t('auth.welcome.body')}</Text>
          </View>
          {offline && <OfflineBanner />}
          <PrimaryButton label={t('auth.welcome.signIn')} onPress={() => setSheetOpen(true)} disabled={offline} />
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
