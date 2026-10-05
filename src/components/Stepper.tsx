import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View, type AccessibilityActionEvent } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { IconButton } from './IconButton';

type Props = { label: string; value: number; min: number; max: number; onChange: (value: number) => void };

const VALUE_MIN_WIDTH = 32;

// − value + with a label; one "adjustable" element for screen readers.
export function Stepper({ label, value, min, max, onChange }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const change = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName === 'increment') change(value + 1);
    if (event.nativeEvent.actionName === 'decrement') change(value - 1);
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}
    >
      <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary, flex: 1 }]}>{label}</Text>
      <IconButton icon={Minus} label={t('common.decrease')} disabled={value <= min} onPress={() => change(value - 1)} />
      <Text
        style={[theme.typography.numericM, { color: theme.colors.text.primary, minWidth: VALUE_MIN_WIDTH, textAlign: 'center' }]}
      >
        {value}
      </Text>
      <IconButton icon={Plus} label={t('common.increase')} disabled={value >= max} onPress={() => change(value + 1)} />
    </View>
  );
}
