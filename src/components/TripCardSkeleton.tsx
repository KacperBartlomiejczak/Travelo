import { View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { Card } from './Card';

// Static loading placeholder on the real card, with its rows' geometry (§10.18, D39; no shimmer).
export function TripCardSkeleton() {
  const theme = useTheme();
  const bar = (widthPercent: `${number}%`, height: number) => (
    <View style={{ width: widthPercent, height, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface.secondary }} />
  );
  return (
    <View testID="trip-card-skeleton" aria-hidden>
      <Card>
        {bar('45%', theme.typography.heading3.lineHeight)}
        {bar('60%', theme.typography.bodyM.lineHeight)}
        {bar('30%', theme.typography.bodyM.lineHeight)}
        {bar('50%', theme.typography.bodyM.lineHeight)}
      </Card>
    </View>
  );
}
