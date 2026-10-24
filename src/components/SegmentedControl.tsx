import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

const { segmentedControl: segmented, focusRing } = tokens.components;

// Design-context §8.15: 44dp track, selected segment raised (shadow in light, 1dp border in dark).
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  const theme = useTheme();
  const [focusedValue, setFocusedValue] = useState<T | null>(null);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        minHeight: segmented.height,
        padding: segmented.padding,
        gap: segmented.padding,
        // Concentric with the segments: segment radius plus the padding around it.
        borderRadius: segmented.segmentRadius + segmented.padding,
        backgroundColor: theme.background.sunken,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const focused = option.value === focusedValue;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            onFocus={() => setFocusedValue(option.value)}
            onBlur={() => setFocusedValue(null)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: segmented.segmentRadius,
              backgroundColor: selected ? theme.surface.elevated : pressed ? theme.surface.primary : undefined,
              ...(selected ? theme.elevation.level1 : {}),
              ...(focused ? { borderWidth: focusRing.width, borderColor: theme.border.focus } : {}),
            })}
          >
            <Text
              style={[tokens.typography.styles.labelMD, { color: selected ? theme.text.primary : theme.text.secondary }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
