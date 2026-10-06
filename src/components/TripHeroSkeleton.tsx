import { useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { heroHeight } from './TripHero';

// Static placeholder with the full-bleed hero's geometry while the nearest trip loads (§10.18; no shimmer).
export function TripHeroSkeleton() {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  return (
    <View
      testID="trip-hero-skeleton"
      aria-hidden
      style={{ height: heroHeight(height), borderRadius: theme.radius.none, backgroundColor: theme.colors.surface.secondary }}
    />
  );
}
