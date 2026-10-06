import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

const BAR_HEIGHT = 4;

// "Krok 2 z 4" + progress bar (D12, D23).
export function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const label = t('newTrip.step', { current, total });

  return (
    <View style={{ gap: theme.spacing[2] }}>
      {/* Hidden from screen readers: the progress bar below announces the same label once. */}
      <Text aria-hidden style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>
        {label}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: total, now: current }}
        style={[
          styles.track,
          { height: BAR_HEIGHT, borderRadius: theme.radius.full, backgroundColor: theme.colors.border },
        ]}
      >
        <View
          testID="step-indicator-fill"
          style={{
            width: `${(current / total) * 100}%`,
            height: BAR_HEIGHT,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.action.primary,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
});
