import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CoverImage } from '@/components/CoverImage';
import { formatDateRange } from '@/lib/date-time';
import { tripDayCount } from '@/lib/trip-days';
import type { TripSummary } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { heroMinHeight, heroHeightRatio, heroFadeStart } = tokens.screenMetrics.tripOverview;

// 52 % of the screen, never under the minimum so a short phone still gets a photo (§9.1).
export function heroHeight(windowHeight: number): number {
  return Math.max(heroMinHeight, Math.round(windowHeight * heroHeightRatio));
}

// Top of the home screen (§9.1): the cover photo fading into the theme's canvas, with the trip's name and dates below it on the canvas
// (sunline-redesign D6: `hero.text` over a scrim is only for text that sits on a photo).
export function TripHero({ trip }: { trip: TripSummary }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const gradientId = useId();
  const gutter = width < tokens.layout.compactBreakpoint ? tokens.layout.screenGutterCompact : tokens.layout.screenGutter;
  const canvas = theme.background.canvas;
  const days = tripDayCount(trip.startDate, trip.endDate);

  return (
    <View testID="trip-hero" style={{ height: heroHeight(height), backgroundColor: canvas }}>
      <View testID="trip-hero-photo" aria-hidden style={StyleSheet.absoluteFill}>
        {/* On the canvas colour while it loads, so the placeholder surface does not flash behind the fade. */}
        <CoverImage
          testID="trip-hero-image"
          cover={trip.coverImageUri}
          urls={trip.coverUrls}
          variant="full"
          style={[StyleSheet.absoluteFill, { backgroundColor: canvas }]}
        />
        <Svg testID="trip-hero-gradient" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={heroFadeStart} stopColor={canvas} stopOpacity={0} />
              <Stop offset={1} stopColor={canvas} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: gutter,
          paddingBottom: tokens.spacing[6],
          gap: tokens.spacing[1],
        }}
      >
        <Text accessibilityRole="header" style={[tokens.typography.styles.displayLG, { color: theme.text.primary }]}>
          {trip.name}
        </Text>
        <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>
          {t('newTrip.summary.dateLine', {
            range: formatDateRange(trip.startDate, trip.endDate, i18n.language),
            days: t('newTrip.summary.days', { count: days }),
          })}
        </Text>
      </View>
    </View>
  );
}
