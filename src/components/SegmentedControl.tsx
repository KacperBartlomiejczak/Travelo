import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

// §10.14 look; 52dp high like §10.5's currency selector, which also keeps it above the 44pt touch target.
const HEIGHT = 52;

export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  const theme = useTheme();
  const inner = theme.radius.segmented - theme.spacing[1] / 2;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        minHeight: HEIGHT,
        padding: theme.spacing[1],
        gap: theme.spacing[1],
        borderRadius: theme.radius.segmented,
        backgroundColor: theme.colors.surface.secondary,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: inner,
              backgroundColor: selected ? theme.colors.surface.default : undefined,
            }}
          >
            <Text
              style={[
                selected ? theme.typography.bodyMMedium : theme.typography.bodyM,
                { color: selected ? theme.colors.text.primary : theme.colors.text.secondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
