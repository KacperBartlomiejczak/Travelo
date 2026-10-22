import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean };

const { iconButton, focusRing } = tokens.components;

// 44×44 icon button, surface tone (design-context §8.2). Icons never replace text for critical actions, so it always has a label.
export function IconButton({ icon: Icon, label, onPress, disabled = false }: Props) {
  const theme = useTheme();
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
          backgroundColor: disabled ? theme.disabled.background : pressed ? theme.background.sunken : theme.surface.primary,
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
        testID="icon-button-icon"
        aria-hidden
        size={tokens.iconography.size.sm}
        strokeWidth={tokens.iconography.strokeWidth}
        color={disabled ? theme.disabled.foreground : theme.icon.primary}
      />
    </Pressable>
  );
}
