import { useWindowDimensions, View } from 'react-native';

import { Card } from '@/components/Card';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { TripHeroSkeleton } from '@/components/TripHeroSkeleton';
import { tokens } from '@/theme/tokens';

const { spacing, layout, typography, components } = tokens;

// Loading skeleton of the home screen's trip view (app-loading-skeleton D1, D3; §8.19, §10.18): the hero, then the
// three cards of `CurrentTrip` (Budget with its "Zmień" button placeholder, amount and two lines) in its column and
// gutters, so the content does not jump when the trip arrives. No photo strip (a trip may have none). Everything pulses.
// Every block, hero and cards, is `skeleton.base` (sunline-merge-main D2). Hidden from screen readers: the caller says "loading".
export function HomeSkeleton() {
  const { width } = useWindowDimensions();
  const side = width < layout.compactBreakpoint ? layout.screenGutterCompact : layout.screenGutter;
  return (
    <View testID="home-skeleton" aria-hidden>
      <TripHeroSkeleton />
      <View style={{ gap: spacing[4], paddingHorizontal: side, paddingTop: spacing[4], width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
        <SkeletonCard testID="home-skeleton-flights" lines={[{ width: '70%' }, { width: '55%' }, { width: '45%' }]} />
        <SkeletonCard testID="home-skeleton-travellers" lines={[{ width: '55%' }, { width: '45%' }]} />
        <SkeletonCard
          testID="home-skeleton-budget"
          action
          lines={[{ width: '50%', numeric: true }, { width: '70%' }, { width: '45%' }]}
        />
      </View>
    </View>
  );
}

type Line = { width: `${number}%`; numeric?: boolean };

// The base `Card` (§8.9), like `Section` in `CurrentTrip`; the title bar and the lines stand for its headingSM and bodyMD text.
// `action` stands for the ghost "Zmień" TextButton at the right of the title row: compact button tall, 20% wide (its real
// width depends on the label, so a fixed share of the card).
function SkeletonCard({ testID, lines, action = false }: { testID: string; lines: Line[]; action?: boolean }) {
  return (
    <Card testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] }}>
        <SkeletonBlock testID="home-skeleton-title" width="40%" height={typography.styles.headingSM.lineHeight} />
        {action && <SkeletonBlock testID="home-skeleton-action" width="20%" height={components.button.compactHeight} />}
      </View>
      {lines.map((line, index) => (
        <SkeletonBlock
          key={index}
          testID="home-skeleton-line"
          width={line.width}
          height={line.numeric ? typography.styles.moneyLG.lineHeight : typography.styles.bodyMD.lineHeight}
        />
      ))}
    </Card>
  );
}
