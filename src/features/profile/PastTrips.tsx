import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CoverImage } from '@/components/CoverImage';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { usePressScale } from '@/components/usePressScale';
import { findAirport } from '@/lib/airport-search';
import type { TripListItem } from '@/schemas';
import { radii, tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { spacing, typography } = tokens;
const cardHeight = tokens.components.card.tripImageHeight;

// react-native-svg ignores the alpha in a stop colour, so the token's rgb and alpha go in separately (D20).
function splitRgba(color: string): { rgb: string; alpha: number } {
  const [r, g, b, a = '1'] = color.match(/[\d.]+/g) ?? [];
  return { rgb: `rgb(${r}, ${g}, ${b})`, alpha: Number(a) };
}

type Props = {
  /** The past trips, already filtered and in display order. */
  trips: TripListItem[];
  state: 'loading' | 'error' | 'ready';
  onOpen: (tripId: string) => void;
};

function PastTripCard({ trip, onOpen }: { trip: TripListItem; onOpen: (tripId: string) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const gradientId = useId();
  const { style: motionStyle, ...pressHandlers } = usePressScale();
  const scrim = splitRgba(theme.hero.scrim);
  const place = findAirport(trip.destination)?.city ?? trip.destination;
  const friendCount = trip.travellerCount === undefined ? undefined : trip.travellerCount - 1;
  const friends = friendCount === undefined ? undefined : friendCount === 0 ? t('profile.pastSolo') : t('profile.pastFriends', { count: friendCount });
  const label = [trip.name, place, friends].filter(Boolean).join(', ');

  return (
    <Animated.View style={motionStyle}>
      <Pressable
        testID={`past-trip-card-${trip.id}`}
        accessibilityRole="button"
        accessibilityLabel={friends ? t('profile.pastTripLabel', { name: trip.name, place, friends }) : label}
        accessibilityHint={t('profile.pastTripHint')}
        onPress={() => onOpen(trip.id)}
        {...pressHandlers}
        style={{ minHeight: cardHeight, borderRadius: radii.lg, overflow: 'hidden', justifyContent: 'flex-end' }}
      >
        <View aria-hidden style={StyleSheet.absoluteFill}>
          <CoverImage cover={trip.coverImageUri} urls={trip.coverUrls} variant="full" style={StyleSheet.absoluteFill} />
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset={0} stopColor={scrim.rgb} stopOpacity={0} />
                <Stop offset={0.5} stopColor={scrim.rgb} stopOpacity={scrim.alpha} />
                <Stop offset={1} stopColor={scrim.rgb} stopOpacity={scrim.alpha} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
        </View>
        <View
          testID="past-trip-pill"
          style={{
            position: 'absolute',
            top: spacing[3],
            right: spacing[3],
            borderRadius: radii.pill,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
            backgroundColor: theme.hero.controlBackground,
            borderWidth: tokens.components.button.borderWidth,
            borderColor: theme.hero.controlBorder,
          }}
        >
          <Text style={[typography.styles.labelSM, { color: theme.hero.text }]}>{place}</Text>
        </View>
        <View style={{ padding: spacing[4], gap: spacing[1] }}>
          <Text numberOfLines={2} style={[typography.styles.headingMD, { color: theme.hero.text }]}>
            {trip.name}
          </Text>
          {friends ? <Text style={[typography.styles.bodySM, { color: theme.hero.text }]}>{friends}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Past-trips section of the profile (profile-upgrade D1): presentational, the list is filtered by the caller.
export function PastTrips({ trips, state, onOpen }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const message = (key: string) => <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{t(key)}</Text>;

  return (
    <View style={{ gap: spacing[3] }}>
      <Text accessibilityRole="header" style={[typography.styles.headingMD, { color: theme.text.primary }]}>
        {t('profile.pastTitle')}
      </Text>
      {state === 'loading' ? (
        <View accessible accessibilityLabel={t('profile.pastLoading')} accessibilityState={{ busy: true }} style={{ gap: spacing[3] }}>
          {[0, 1].map((i) => (
            <View key={i} testID="past-trip-skeleton">
              <SkeletonBlock width="100%" height={cardHeight} radius={radii.lg} />
            </View>
          ))}
        </View>
      ) : state === 'error' ? (
        message('profile.pastError')
      ) : trips.length === 0 ? (
        message('profile.pastEmpty')
      ) : (
        trips.map((trip) => <PastTripCard key={trip.id} trip={trip} onOpen={onOpen} />)
      )}
    </View>
  );
}
