import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean };

const DISABLED_OPACITY = 0.4; // §10.2

// 44×44 icon button (§10.2, D28). Icons never replace text for critical actions, so it always has a label.
export function IconButton({ icon: Icon, label, onPress, disabled = false }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: theme.size.touchTarget,
        height: theme.size.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        opacity: disabled ? DISABLED_OPACITY : 1,
        backgroundColor: pressed ? theme.colors.surface.secondary : undefined,
      })}
    >
      <Icon size={theme.size.iconPrimary} strokeWidth={theme.size.iconStroke} color={theme.colors.text.primary} />
    </Pressable>
  );
}
