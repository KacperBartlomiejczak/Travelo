import { useWindowDimensions, View } from 'react-native';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { TripHeroSkeleton } from '@/components/TripHeroSkeleton';
import { darkTheme } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';

// Loading skeleton of the home screen's trip view (app-loading-skeleton D1, D3, A2 revised; §10.18): the hero, then the
// three cards of `CurrentTrip` (Budget with its "Zmień" button placeholder, amount and two lines) with its column, so the content does not jump when the trip arrives. No photo strip (a trip
// may have none). Everything pulses (D3). The hero uses the default block colour (`colors.skeleton`). In light the
// card is `surface.default` and its blocks use the default colour too (D27); in dark the card is `surface.secondary`, close to
// the default colour (`dark.border`), so the blocks inside the cards use `surface.elevated` (D5). Hidden from screen readers: the caller says "loading".
export function HomeSkeleton() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { spacing } = theme;
  const side = width < theme.breakpoints.compact ? spacing[4] : spacing[5];
  return (
    <View testID="home-skeleton" aria-hidden>
      <TripHeroSkeleton />
      <View
        style={{ gap: spacing[4], paddingHorizontal: side, paddingTop: spacing[4], width: '100%', maxWidth: theme.size.maxContentWidth, alignSelf: 'center' }}
      >
        <Card testID="home-skeleton-flights" lines={[{ width: '70%' }, { width: '55%' }, { width: '45%' }]} />
        <Card testID="home-skeleton-travellers" lines={[{ width: '55%' }, { width: '45%' }]} />
        <Card
          testID="home-skeleton-budget"
          action
          lines={[{ width: '50%', numeric: true }, { width: '70%' }, { width: '45%' }]}
        />
      </View>
    </View>
  );
}

type Line = { width: `${number}%`; numeric?: boolean };

// Same container as `Section` in `CurrentTrip`; the title bar and the lines stand for its heading3 and body text.
// `action` stands for the ghost "Zmień" TextButton at the right of the title row: buttonCompact tall, 20% wide (its real
// width depends on the label, so a fixed share of the card).
function Card({ testID, lines, action = false }: { testID: string; lines: Line[]; action?: boolean }) {
  const theme = useTheme();
  const dark = theme === darkTheme;
  const surface = dark ? theme.colors.surface.secondary : theme.colors.surface.default;
  const block = dark ? theme.colors.surface.elevated : undefined;
  const { typography } = theme;
  return (
    <View
      testID={testID}
      style={[{ backgroundColor: surface, borderRadius: theme.radius.lg, padding: theme.spacing[4], gap: theme.spacing[3] }, theme.elevation.card]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
        <SkeletonBlock testID="home-skeleton-title" width="40%" height={typography.heading3.lineHeight} color={block} />
        {action && <SkeletonBlock testID="home-skeleton-action" width="20%" height={theme.size.buttonCompact} color={block} />}
      </View>
      {lines.map((line, index) => (
        <SkeletonBlock
          key={index}
          testID="home-skeleton-line"
          width={line.width}
          height={line.numeric ? typography.numericL.lineHeight : typography.bodyM.lineHeight}
          color={block}
        />
      ))}
    </View>
  );
}
