import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean };

// 44dp round icon button over the trip photo (trips-drawer P5): ink at 50 % behind the icon keeps it readable
// on a bright photo; solid ink while pressed. Always labelled, icons never replace text for screen readers.
// Disabled (trip-photos D30, e.g. delete offline): dimmed to the disabled opacity (§10.2), not pressable.
export function HeroIconButton({ icon: Icon, label, onPress, disabled = false }: Props) {
  const theme = useTheme();
  const { hero } = theme.colors;
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
        borderRadius: theme.radius.full,
        opacity: disabled ? theme.opacity.disabled : 1,
        backgroundColor: pressed ? hero.background : hero.control,
      })}
    >
      <Icon testID="hero-icon-button-icon" aria-hidden size={theme.size.iconPrimary} strokeWidth={theme.size.iconStroke} color={hero.text} />
    </Pressable>
  );
}
