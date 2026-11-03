import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { usePressScale } from './usePressScale';

type Props = { label: string; onPress: () => void; testID?: string };

const { fab, focusRing } = tokens.components;

// Floating quick-add button (design-context §8.3): 56 dp, brand.primary, level 3 elevation, a Plus. The caller places it
// (right inset, above the pill). Pressed = brand.pressed and the shared press scale; focused = 2 dp brand.focus ring.
export function Fab({ label, onPress, testID }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { style: motionStyle, ...pressHandlers } = usePressScale();
  return (
    <Animated.View style={motionStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        {...pressHandlers}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          {
            width: fab.size,
            height: fab.size,
            borderRadius: tokens.radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.brand.pressed : theme.brand.primary,
            ...theme.elevation.level3,
          },
          focused && { outlineStyle: 'solid', outlineWidth: focusRing.width, outlineColor: theme.brand.focus, outlineOffset: focusRing.offset },
        ]}
      >
        <Plus testID="fab-icon" size={fab.iconSize} strokeWidth={tokens.iconography.strokeWidth} color={theme.brand.onBrand} aria-hidden />
      </Pressable>
    </Animated.View>
  );
}
