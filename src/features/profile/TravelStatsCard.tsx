import { CalendarDays, Globe, Luggage, Plane, Route, type LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { Card } from '@/components/Card';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import type { TravelStats } from '@/lib/travel-stats';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** The numbers; without them (the list failed and the phone has no copy) every value is a dash. */
  stats?: TravelStats;
  /** The trip list is still loading: the values are pulsing skeletons. */
  loading: boolean;
};

const ITEMS: { key: keyof TravelStats; Icon: LucideIcon }[] = [
  { key: 'trips', Icon: Luggage },
  { key: 'countries', Icon: Globe },
  { key: 'days', Icon: CalendarDays },
  { key: 'flights', Icon: Plane },
  { key: 'km', Icon: Route },
];

// Above this font scale the two-column grid gives way to one column, so no label is cut off (same limit as the pill
// navigation, pill-nav-and-dialog R1).
const MAX_FONT_SCALE_TWO_COLUMNS = 1.3;

// The stats card of the profile (profile-screen A6): a title and a grid of five stats, two columns with "km" alone on
// the last row, one column at large Dynamic Type. Each stat is a single screen-reader element, "<value> <label>". While the
// values load, the card is a single "loading" element and the values are skeletons of the same size (§10.18).
export function TravelStatsCard({ stats, loading }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const { spacing, colors, typography } = theme;
  const format = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);

  const columns = fontScale > MAX_FONT_SCALE_TWO_COLUMNS ? 1 : 2;
  const rows = Array.from({ length: Math.ceil(ITEMS.length / columns) }, (_, row) => ITEMS.slice(row * columns, (row + 1) * columns));

  return (
    <Card>
      <Text accessibilityRole="header" style={[typography.heading3, { color: colors.text.primary }]}>
        {t('profile.statsTitle')}
      </Text>
      <View
        accessible={loading}
        accessibilityLabel={loading ? t('profile.statsLoading') : undefined}
        accessibilityState={loading ? { busy: true } : undefined}
        style={{ gap: spacing[4] }}
      >
        {rows.map((row) => (
          <View key={row[0].key} testID="stats-row" style={{ flexDirection: 'row', gap: spacing[3] }}>
            {row.map(({ key, Icon }) => {
              const label = t(`profile.stats.${key}`);
              const value = stats ? format.format(stats[key]) : '–';
              const spoken = stats ? value : t('profile.noData');
              return (
                <View
                  key={key}
                  testID={`stat-${key}`}
                  accessible={!loading}
                  accessibilityLabel={loading ? undefined : `${spoken} ${label}`}
                  style={{ flex: 1, gap: spacing[1] }}
                >
                  <Icon size={theme.size.iconPrimary} strokeWidth={theme.size.iconStroke} color={colors.text.secondary} aria-hidden />
                  {loading ? (
                    <SkeletonBlock testID="stat-skeleton" width={spacing[12]} height={typography.numericL.lineHeight * fontScale} />
                  ) : (
                    <Text style={[typography.numericL, { color: colors.text.primary }]}>{value}</Text>
                  )}
                  <Text style={[typography.bodyS, { color: colors.text.secondary }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}
