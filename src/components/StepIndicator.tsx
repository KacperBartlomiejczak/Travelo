import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// 4 dp as before (sunline-redesign D13): the spacing step, since tokens have no 4 dp bar.
const BAR_HEIGHT = tokens.spacing[1];

// "Krok 2 z 4" + progress bar (D12, D23).
export function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const label = t('newTrip.step', { current, total });

  return (
    <View style={{ gap: tokens.spacing[2] }}>
      {/* Hidden from screen readers: the progress bar below announces the same label once. */}
      <Text aria-hidden style={[tokens.typography.styles.bodySM, { color: theme.text.secondary }]}>
        {label}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: total, now: current }}
        style={[
          styles.track,
          { height: BAR_HEIGHT, borderRadius: tokens.radii.pill, backgroundColor: theme.border.subtle },
        ]}
      >
        <View
          testID="step-indicator-fill"
          style={{
            width: `${(current / total) * 100}%`,
            height: BAR_HEIGHT,
            borderRadius: tokens.radii.pill,
            backgroundColor: theme.brand.primary,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
});
