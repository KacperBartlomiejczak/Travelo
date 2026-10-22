import { useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { SkeletonBlock } from './SkeletonBlock';
import { heroHeight } from './TripHero';

// Placeholder with the full-bleed hero's geometry while the current trip loads (§10.18). It pulses like every other
// loading block (app-loading-skeleton D3).
export function TripHeroSkeleton() {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  return <SkeletonBlock testID="trip-hero-skeleton" width="100%" height={heroHeight(height)} radius={theme.radius.none} />;
}
