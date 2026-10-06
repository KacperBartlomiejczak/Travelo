import { Image } from 'expo-image';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { formatDateRange } from '@/lib/date-time';
import { tripDayCount } from '@/lib/trip-days';
import type { TripSummary } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

// The hero takes half of the screen (D4); the photo is clear at the top and fades into ink from FADE_START down.
const SCREEN_SHARE = 0.5;
const FADE_START = 0.35;

export function heroHeight(windowHeight: number): number {
  return Math.round(windowHeight * SCREEN_SHARE);
}

// Top of the home screen: the cover photo fading into ink, or plain ink (D6), with the trip's name and dates.
export function TripHero({ trip }: { trip: TripSummary }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const gradientId = useId();
  const { hero } = theme.colors;
  const days = tripDayCount(trip.startDate, trip.endDate);

  return (
    <View testID="trip-hero" style={{ height: heroHeight(height), backgroundColor: hero.background }}>
      {trip.coverImageUri && (
        <View testID="trip-hero-photo" aria-hidden style={StyleSheet.absoluteFill}>
          <Image testID="trip-hero-image" source={{ uri: trip.coverImageUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
          <Svg testID="trip-hero-gradient" style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset={FADE_START} stopColor={hero.background} stopOpacity={0} />
                <Stop offset={1} stopColor={hero.background} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
        </View>
      )}
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
        <Text accessibilityRole="header" style={[theme.typography.displayL, { color: hero.text }]}>
          {trip.name}
        </Text>
        <Text style={[theme.typography.bodyM, { color: hero.textSecondary }]}>
          {t('newTrip.summary.dateLine', {
            range: formatDateRange(trip.startDate, trip.endDate, i18n.language),
            days: t('newTrip.summary.days', { count: days }),
          })}
        </Text>
      </View>
    </View>
  );
}
