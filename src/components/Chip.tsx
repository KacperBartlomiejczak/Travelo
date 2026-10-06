import { Check } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = { label: string; selected: boolean; onToggle: () => void };

const CHIP_HEIGHT = 36; // §10.6 (minimum; grows with large text, §4.4)

// Selectable chip (§10.6, D32). Selected adds a check mark, so the state is not shown by colour alone.
export function Chip({ label, selected, onToggle }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const contentColor = selected ? colors.action.onPrimary : colors.text.primary;
  // Extends the 36dp chip to the 44dp touch target without changing how it looks.
  const slop = (theme.size.touchTarget - CHIP_HEIGHT) / 2;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={selected}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      onPress={onToggle}
      style={({ pressed }) => ({
        minHeight: CHIP_HEIGHT,
        maxWidth: '100%',
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        borderWidth: 1,
        borderColor: selected ? colors.action.primary : colors.input.border,
        backgroundColor: selected
          ? pressed
            ? colors.action.primaryPressed
            : colors.action.primary
          : pressed
            ? colors.surface.secondary
            : colors.surface.default,
      })}
    >
      {selected && (
        <Check testID="chip-check" size={theme.size.iconInline} strokeWidth={theme.size.iconStroke} color={contentColor} aria-hidden />
      )}
      <Text style={[theme.typography.bodyS, { color: contentColor, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}
