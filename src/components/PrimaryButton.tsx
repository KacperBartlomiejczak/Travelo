import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
};

// Primary button from design-context §10.1 (focus ring per D10, disabled colors per D9).
export function PrimaryButton({ label, onPress, icon: Icon, disabled = false, loading = false }: PrimaryButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { action } = theme.colors;
  const contentColor = disabled ? action.onDisabled : action.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.size.buttonPrimary,
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[3],
          gap: theme.spacing[2],
          borderRadius: theme.radius.md,
          backgroundColor: disabled ? action.disabled : pressed ? action.primaryPressed : action.primary,
        },
        focused && {
          outlineStyle: 'solid',
          outlineWidth: theme.size.focusRing,
          outlineColor: action.primary,
          outlineOffset: theme.spacing[1],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator testID="primary-button-spinner" color={contentColor} />
      ) : (
        Icon && (
          <Icon
            testID="primary-button-icon"
            size={theme.size.iconStandard}
            strokeWidth={theme.size.iconStroke}
            color={contentColor}
          />
        )
      )}
      <Text style={[theme.typography.button, styles.label, { color: contentColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lets long labels wrap at large font scales instead of overflowing.
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
});
