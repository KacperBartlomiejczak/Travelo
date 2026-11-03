import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { usePressScale } from './usePressScale';

type Props = {
  variant: 'secondary' | 'ghost' | 'destructive';
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Work is running: a spinner replaces the icon and the button cannot be pressed again; the colours stay as they are. */
  loading?: boolean;
  /** For screen readers when the visible label needs context, e.g. "Zmień: Budżet" (§13.3). */
  accessibilityLabel?: string;
};

const { button, focusRing } = tokens.components;

// Secondary, ghost and destructive buttons from design-context §8.1. Ghost is the compact size (44dp, labelMD), the others the default (52dp, labelLG).
export function TextButton({ variant, label, onPress, icon: Icon, disabled = false, loading = false, accessibilityLabel }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { style: motionStyle, ...pressHandlers } = usePressScale();
  const { error } = theme.semantic;
  const compact = variant === 'ghost';
  const contentColor = disabled
    ? theme.disabled.foreground
    : variant === 'destructive'
      ? error.foreground
      : variant === 'secondary'
        ? theme.text.primary
        : theme.text.brand;

  const background = (pressed: boolean) => {
    if (disabled) return theme.disabled.background;
    if (variant === 'destructive') return error.background;
    if (variant === 'secondary') return pressed ? theme.background.sunken : theme.surface.primary;
    return pressed ? theme.brand.tint : 'transparent';
  };
  // The border is always reserved, so pressing a destructive button never moves the layout.
  const borderColor = (pressed: boolean) => {
    if (variant === 'secondary') return theme.border.default;
    return variant === 'destructive' && pressed && !disabled ? error.foreground : 'transparent';
  };

  return (
    <Animated.View testID="text-button-motion" style={motionStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled, busy: loading }}
        disabled={disabled || loading}
        onPress={onPress}
        {...pressHandlers}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: compact ? button.compactHeight : button.height,
            paddingHorizontal: button.horizontalPadding,
            gap: button.iconGap,
            borderRadius: button.radius,
            borderWidth: button.borderWidth,
            borderColor: borderColor(pressed),
            backgroundColor: background(pressed),
          },
          focused && {
            outlineStyle: 'solid',
            outlineWidth: focusRing.width,
            outlineOffset: focusRing.offset,
            outlineColor: variant === 'destructive' ? error.foreground : theme.border.focus,
          },
        ]}
      >
        {loading ? (
          <View testID="text-button-spinner-slot" style={styles.iconSlot}>
            <ActivityIndicator testID="text-button-spinner" size="small" color={contentColor} />
          </View>
        ) : (
          Icon && (
            <Icon
              testID="text-button-icon"
              size={tokens.iconography.size.sm}
              strokeWidth={tokens.iconography.strokeWidth}
              color={contentColor}
              aria-hidden
            />
          )
        )}
        <Text style={[compact ? tokens.typography.styles.labelMD : tokens.typography.styles.labelLG, styles.label, { color: contentColor }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // The spinner takes exactly the icon's place, so loading never changes the button's size.
  iconSlot: { width: tokens.iconography.size.sm, height: tokens.iconography.size.sm, alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1, textAlign: 'center' },
});
