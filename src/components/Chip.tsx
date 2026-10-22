import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { label: string; selected: boolean; onToggle: () => void; disabled?: boolean };

const { chip, focusRing } = tokens.components;
const checkSize = tokens.iconography.size.xs;

// Selectable chip (design-context §8.6). Selected adds a check mark, so the state is not shown by colour alone.
// The width is the same selected and unselected (theme-split D9): an unselected chip keeps the room of the check mark
// (icon + gap) in its padding, split evenly, so toggling never reflows the chips around it.
export function Chip({ label, selected, onToggle, disabled = false }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const contentColor = disabled ? theme.disabled.foreground : selected ? theme.text.brand : theme.text.secondary;
  // Extends the 36dp chip to the 44dp touch target without changing how it looks.
  const slop = (chip.touchHeight - chip.visualHeight) / 2;
  // A 2dp focus border takes its extra dp from the padding, so the chip keeps its size.
  const borderWidth = focused && !disabled ? focusRing.width : chip.borderWidth;
  const inset = borderWidth - chip.borderWidth;
  const padding = chip.horizontalPadding + (selected ? 0 : (checkSize + chip.iconGap) / 2) - inset;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={selected}
      disabled={disabled}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      onPress={onToggle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: chip.visualHeight,
        maxWidth: '100%',
        paddingLeft: padding,
        paddingRight: padding,
        paddingVertical: tokens.spacing[1] - inset,
        borderRadius: chip.radius,
        flexDirection: 'row',
        alignItems: 'center',
        gap: chip.iconGap,
        borderWidth,
        borderColor: disabled
          ? theme.disabled.background
          : focused
            ? theme.border.focus
            : selected
              ? theme.brand.focus
              : theme.border.default,
        backgroundColor: disabled
          ? theme.disabled.background
          : pressed
            ? theme.background.sunken
            : selected
              ? theme.brand.tint
              : theme.surface.primary,
      })}
    >
      {selected && (
        <Check
          testID="chip-check"
          size={checkSize}
          strokeWidth={tokens.iconography.strokeWidth}
          color={contentColor}
          aria-hidden
        />
      )}
      <Text style={[tokens.typography.styles.labelMD, { color: contentColor, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}
