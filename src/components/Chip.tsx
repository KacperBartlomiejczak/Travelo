import { Check } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = { label: string; selected: boolean; onToggle: () => void; disabled?: boolean };

// 32dp instead of the 36dp of §10.6: a written exception decided by Kacper (theme-split D9). Minimum; grows with large text (§4.4).
const CHIP_HEIGHT = 32;

// Selectable chip (§10.6, D32). Selected adds a check mark, so the state is not shown by colour alone.
// The width is the same selected and unselected (theme-split D9): an unselected chip keeps the room of the check mark
// (icon + gap) in its padding, split evenly, so toggling never reflows the chips around it.
export function Chip({ label, selected, onToggle, disabled = false }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const contentColor = selected ? colors.action.onPrimary : colors.text.primary;
  // Extends the 32dp chip to the 44dp touch target without changing how it looks.
  const slop = (theme.size.touchTarget - CHIP_HEIGHT) / 2;
  const gap = theme.spacing[1];
  const padding = theme.spacing[2] + (selected ? 0 : (theme.size.iconInline + gap) / 2);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={selected}
      disabled={disabled}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      onPress={onToggle}
      style={({ pressed }) => ({
        // §10.2: a disabled control is drawn at the disabled opacity.
        opacity: disabled ? theme.opacity.disabled : 1,
        minHeight: CHIP_HEIGHT,
        maxWidth: '100%',
        paddingLeft: padding,
        paddingRight: padding,
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap,
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
