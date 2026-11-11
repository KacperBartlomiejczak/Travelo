import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/SegmentedControl';
import { DiscoverScreen } from '@/features/discover/DiscoverScreen';
import { EmptyScreen } from '@/features/nav/EmptyScreen';
import { useCurrentTrip } from '@/hooks/useTrips';
import { usePillClearance } from '@/features/nav/usePillClearance';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { layout, spacing, typography } = tokens;

type Mode = 'plan' | 'discover';

// The Plan tab (plan-discover-switch D1-D6): a "Plan" / "Odkryj" switch on top; Discover renders inside the tab. The mode is
// local and always starts on "Plan" (Z2).
export function PlanScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = usePillClearance();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('plan');
  const trips = useCurrentTrip();
  const gutter = width < layout.compactBreakpoint ? layout.screenGutterCompact : layout.screenGutter;
  const column = { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' } as const;

  // Without a current trip (loading, error, none) the screen stays the plain placeholder, no switch (D3).
  // Exception (D8): a reload after the first load (trip switch) keeps the tree so Discover state survives.
  const [hadTrip, setHadTrip] = useState(false);
  const show = !!trips.data || (hadTrip && trips.isPending);
  if (hadTrip !== show) setHadTrip(show);
  if (!show) return <EmptyScreen title={t('nav.plan')} message={t('nav.comingSoon')} />;

  return (
    <View testID="plan-screen" style={{ flex: 1, backgroundColor: theme.background.canvas, paddingTop: insets.top + spacing[4] }}>
      <View style={{ paddingHorizontal: gutter }}>
        <View style={column}>
          <SegmentedControl
            label={t('nav.planView')}
            options={[
              { value: 'plan', label: t('nav.plan') },
              { value: 'discover', label: t('nav.discover') },
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>
      </View>
      {mode === 'plan' ? (
        <View testID="plan-content" style={{ flex: 1, paddingTop: spacing[4], paddingBottom: clearance + spacing[4], paddingHorizontal: gutter }}>
          <Text style={[typography.styles.bodyMD, column, { color: theme.text.secondary }]}>{t('nav.comingSoon')}</Text>
        </View>
      ) : (
        <DiscoverScreen bottomInset={clearance} destination={trips.data?.overview.trip.destination} />
      )}
    </View>
  );
}
