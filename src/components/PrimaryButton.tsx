import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { usePressScale } from './usePressScale';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
};

const { button, focusRing } = tokens.components;
const iconSize = tokens.iconography.size.sm;

// Primary button, design-context §8.1: focus ring with a gap, disabled colors, press scale (usePressScale).
export function PrimaryButton({ label, onPress, icon: Icon, disabled = false, loading = false }: PrimaryButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { style: motionStyle, ...pressHandlers } = usePressScale();
  const contentColor = disabled ? theme.disabled.foreground : theme.brand.onBrand;

  return (
    <Animated.View testID="primary-button-motion" style={motionStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, busy: loading }}
        disabled={disabled || loading}
        onPress={onPress}
        {...pressHandlers}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: button.height,
            paddingHorizontal: button.horizontalPadding,
            paddingVertical: tokens.spacing[3],
            gap: button.iconGap,
            borderRadius: button.radius,
            backgroundColor: disabled ? theme.disabled.background : pressed ? theme.brand.pressed : theme.brand.primary,
          },
          focused && {
            outlineStyle: 'solid',
            outlineWidth: focusRing.width,
            outlineColor: theme.brand.focus,
            outlineOffset: focusRing.offset,
          },
        ]}
      >
        {loading ? (
          <View testID="primary-button-spinner-slot" style={styles.iconSlot}>
            <ActivityIndicator testID="primary-button-spinner" size="small" color={contentColor} />
          </View>
        ) : (
          Icon && (
            <Icon
              testID="primary-button-icon"
              size={iconSize}
              strokeWidth={tokens.iconography.strokeWidth}
              color={contentColor}
            />
          )
        )}
        <Text style={[tokens.typography.styles.labelLG, styles.label, { color: contentColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The spinner takes exactly the icon's place, so loading never changes the button's size.
  iconSlot: { width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' },
  // Lets long labels wrap at large font scales instead of overflowing.
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
});
