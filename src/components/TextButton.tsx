import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = {
  variant: 'secondary' | 'ghost';
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  /** For screen readers when the visible label needs context, e.g. "Zmień: Budżet" (§15). */
  accessibilityLabel?: string;
};

// Secondary and ghost buttons from §10.1, colours per D28.
export function TextButton({ variant, label, onPress, icon: Icon, disabled = false, accessibilityLabel }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { colors } = theme;
  const secondary = variant === 'secondary';
  const contentColor = disabled ? colors.text.tertiary : secondary ? colors.text.primary : colors.action.link;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: secondary ? theme.size.buttonPrimary : theme.size.buttonCompact,
          paddingHorizontal: secondary ? theme.spacing[4] : theme.spacing[3],
          gap: theme.spacing[2],
          borderRadius: theme.radius.md,
          backgroundColor: (disabled && secondary) || pressed ? colors.surface.secondary : 'transparent',
        },
        secondary && { borderWidth: 1, borderColor: colors.input.border },
        focused && {
          outlineStyle: 'solid',
          outlineWidth: theme.size.focusRing,
          outlineColor: colors.action.primary,
          outlineOffset: theme.spacing[1],
        },
      ]}
    >
      {Icon && <Icon size={theme.size.iconStandard} strokeWidth={theme.size.iconStroke} color={contentColor} aria-hidden />}
      <Text style={[theme.typography.button, styles.label, { color: contentColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1, textAlign: 'center' },
});
