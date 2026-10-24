import { useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/components/usePressScale';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Which provider: the spinner's test id. */
  brand: 'google' | 'discord';
  label: string;
  onPress: () => void;
  /** The provider's mark, drawn 20dp wide before the label and hidden from screen readers. */
  Logo: ComponentType;
  /** The provider's colours (`partnerBrand.*`); a button without a border of its own wears its background colour. */
  colors: { background: string; pressed: string; text: string; border?: string };
  disabled?: boolean;
  loading?: boolean;
};

const { button, focusRing } = tokens.components;

// The shared base of the Google and Discord sign-in buttons (auth-onboarding D10, D13). Same size, radius, focus ring and
// loading behaviour as PrimaryButton (§8.1); only the colours and the logo slot are the provider's. Disabled is auth-onboarding
// D16 minus the dimming (sunline-redesign D11): the provider's colours stay, the button shows it only by not responding and by
// its accessibility state.
export function BrandButton({ brand, label, onPress, Logo, colors, disabled = false, loading = false }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { style: motionStyle, ...pressHandlers } = usePressScale();

  return (
    <Animated.View testID="brand-button-motion" style={motionStyle}>
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
          borderWidth: button.borderWidth,
          borderColor: colors.border ?? colors.background,
          backgroundColor: pressed ? colors.pressed : colors.background,
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
        <View style={styles.iconSlot}>
          <ActivityIndicator testID={`${brand}-button-spinner`} size="small" color={colors.text} />
        </View>
      ) : (
        <Logo />
      )}
      <Text style={[tokens.typography.styles.labelLG, styles.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
    </Animated.View>
  );
}

const iconSize = tokens.iconography.size.sm;

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // The spinner takes exactly the logo's place, so loading never changes the button's size.
  iconSlot: { width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' },
  // Lets long labels wrap at large font scales instead of overflowing.
  label: { flexShrink: 1, textAlign: 'center' },
});
