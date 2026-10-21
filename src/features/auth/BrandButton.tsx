import { useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/legacy/useTheme';

type Props = {
  /** Which provider: the spinner's test id. */
  brand: 'google' | 'discord';
  label: string;
  onPress: () => void;
  /** The provider's mark, drawn 20dp wide before the label and hidden from screen readers. */
  Logo: ComponentType;
  /** The provider's colours (theme `colors.brand.*`); a button without a border of its own wears its background colour. */
  colors: { background: string; pressed: string; text: string; border?: string };
  disabled?: boolean;
  loading?: boolean;
};

// The shared base of the Google and Discord sign-in buttons (auth-onboarding D10, D13). Same size, radius, focus ring and
// loading behaviour as PrimaryButton (§10.1); only the colours, the logo slot and the disabled look (D16) are the provider's.
export function BrandButton({ brand, label, onPress, Logo, colors, disabled = false, loading = false }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { action } = theme.colors;

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
          borderWidth: 1,
          borderColor: colors.border ?? colors.background,
          backgroundColor: pressed ? colors.pressed : colors.background,
          // D16: a disabled brand button keeps the provider's colours; the whole button, logo included, is dimmed.
          opacity: disabled ? theme.opacity.disabled : 1,
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
        <ActivityIndicator testID={`${brand}-button-spinner`} color={colors.text} />
      ) : (
        <Logo />
      )}
      <Text style={[theme.typography.button, styles.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Lets long labels wrap at large font scales instead of overflowing.
  label: { flexShrink: 1, textAlign: 'center' },
});
