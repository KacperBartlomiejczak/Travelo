import { useWindowDimensions } from 'react-native';

import { tokens } from '@/theme/tokens';

import { SkeletonBlock } from './SkeletonBlock';
import { heroHeight } from './TripHero';

// Placeholder with the full-bleed hero's geometry while the current trip loads (design-context §8.19, §10.1): a
// full-width, square-cornered SkeletonBlock, so it pulses and respects reduce motion like every other skeleton (D19).
export function TripHeroSkeleton() {
  const { height } = useWindowDimensions();
  return <SkeletonBlock testID="trip-hero-skeleton" width="100%" height={heroHeight(height)} radius={tokens.radii.none} />;
}
