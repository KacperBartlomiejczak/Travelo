import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CoverImage } from '@/components/CoverImage';
import { formatDateRange } from '@/lib/date-time';
import { tripDayCount } from '@/lib/trip-days';
import type { TripSummary } from '@/schemas';
import { useTheme } from '@/theme/legacy/useTheme';

// The hero takes half of the screen (D4).
const SCREEN_SHARE = 0.5;

export function heroHeight(windowHeight: number): number {
  return Math.round(windowHeight * SCREEN_SHARE);
}

// Top of the home screen: the cover photo fading into the theme's background (paper in light, ink in dark), with the trip's name and dates.
export function TripHero({ trip }: { trip: TripSummary }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const gradientId = useId();
  const { colors } = theme;
  const days = tripDayCount(trip.startDate, trip.endDate);

  return (
    <View testID="trip-hero" style={{ height: heroHeight(height), backgroundColor: colors.background }}>
      <View testID="trip-hero-photo" aria-hidden style={StyleSheet.absoluteFill}>
        {/* On the background colour while it loads, so the placeholder surface does not flash behind the fade. */}
        <CoverImage
          testID="trip-hero-image"
          cover={trip.coverImageUri}
          urls={trip.coverUrls}
          variant="full"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
        />
        <Svg testID="trip-hero-gradient" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={theme.gradient.heroFade.start} stopColor={colors.background} stopOpacity={0} />
              <Stop offset={1} stopColor={colors.background} stopOpacity={1} />
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
          paddingHorizontal: theme.spacing[5],
          paddingBottom: theme.spacing[6],
          gap: theme.spacing[1],
        }}
      >
        <Text accessibilityRole="header" style={[theme.typography.displayXL, { color: colors.text.primary }]}>
          {trip.name}
        </Text>
        <Text style={[theme.typography.bodyM, { color: colors.text.secondary }]}>
          {t('newTrip.summary.dateLine', {
            range: formatDateRange(trip.startDate, trip.endDate, i18n.language),
            days: t('newTrip.summary.days', { count: days }),
          })}
        </Text>
      </View>
    </View>
  );
}
