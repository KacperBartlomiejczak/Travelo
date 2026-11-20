import { Check } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { usePressScale } from './usePressScale';

type Props = { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean; testID?: string };

const { focusRing } = tokens.components;
const boxSize = tokens.iconography.size.md;

// Controlled checkbox with a label that may hold a link. The check mark makes the state visible without colour.
export function Checkbox({ checked, onChange, label, disabled = false, testID }: Props) {
  const theme = useTheme();
  const press = usePressScale();
  const [focused, setFocused] = useState(false);
  return (
    <Animated.View style={press.style}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], minHeight: tokens.layout.touchTarget }}
      >
        <View
          style={{
            width: boxSize,
            height: boxSize,
            borderRadius: tokens.radii.xs,
            borderWidth: focused && !disabled ? focusRing.width : 1,
            borderColor: disabled ? theme.disabled.background : focused ? theme.border.focus : checked ? theme.brand.primary : theme.border.default,
            backgroundColor: disabled ? theme.disabled.background : checked ? theme.brand.primary : theme.surface.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked && (
            <Check
              testID="checkbox-check"
              size={tokens.iconography.size.xs}
              strokeWidth={tokens.iconography.strokeWidth}
              color={disabled ? theme.disabled.foreground : theme.brand.onBrand}
              aria-hidden
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          {typeof label === 'string' ? <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.primary }]}>{label}</Text> : label}
        </View>
      </Pressable>
    </Animated.View>
  );
}
