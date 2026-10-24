import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean };

const { iconButton, button, focusRing } = tokens.components;

// 44dp round icon button over the trip photo, hero tone (design-context §8.2, trips-drawer P5): a dark control with a light
// 1dp border keeps the icon readable on a bright photo; pressing brightens the border. The border is always reserved, so
// pressing never moves the layout. Always labelled, icons never replace text for screen readers.
// Disabled (trip-photos D30, e.g. delete offline): the disabled tokens, not pressable.
export function HeroIconButton({ icon: Icon, label, onPress, disabled = false }: Props) {
  const theme = useTheme();
  const { hero } = theme;
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          width: iconButton.size,
          height: iconButton.size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: iconButton.radius,
          borderWidth: button.borderWidth,
          borderColor: disabled ? 'transparent' : pressed ? hero.text : hero.controlBorder,
          backgroundColor: disabled ? theme.disabled.background : hero.controlBackground,
        },
        focused && {
          outlineStyle: 'solid',
          outlineWidth: focusRing.width,
          outlineOffset: focusRing.offset,
          outlineColor: theme.border.focus,
        },
      ]}
    >
      <Icon
        testID="hero-icon-button-icon"
        aria-hidden
        // 24 dp: hero overlay controls (design-context §6.1 rule 8), unlike the 20 dp of surface buttons.
        size={tokens.iconography.size.md}
        strokeWidth={tokens.iconography.strokeWidth}
        color={disabled ? theme.disabled.foreground : hero.text}
      />
    </Pressable>
  );
}
