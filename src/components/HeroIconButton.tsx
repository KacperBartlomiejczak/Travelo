import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = { icon: LucideIcon; label: string; onPress: () => void };

// 44dp round icon button over the trip photo (trips-drawer P5): ink at 50 % behind the icon keeps it readable
// on a bright photo; solid ink while pressed. Always labelled, icons never replace text for screen readers.
export function HeroIconButton({ icon: Icon, label, onPress }: Props) {
  const theme = useTheme();
  const { hero } = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: theme.size.touchTarget,
        height: theme.size.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: pressed ? hero.background : hero.control,
      })}
    >
      <Icon testID="hero-icon-button-icon" aria-hidden size={theme.size.iconPrimary} strokeWidth={theme.size.iconStroke} color={hero.text} />
    </Pressable>
  );
}
