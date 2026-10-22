import type { ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { children: ReactNode; testID?: string; onLayout?: (event: LayoutChangeEvent) => void };

const { card } = tokens.components;

// Base card, design-context §8.9 (used by the wizard forms): primary surface, 20dp corners, 16dp padding. The 1dp
// `border.subtle` separates it in light mode and is the dark level 1 border (`elevation.dark.level1`), so there is no shadow.
export function Card({ children, testID, onLayout }: Props) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={{
        backgroundColor: theme.surface.primary,
        borderRadius: card.radius,
        borderWidth: card.borderWidth,
        borderColor: theme.border.subtle,
        padding: card.padding,
        gap: tokens.spacing[3],
      }}
    >
      {children}
    </View>
  );
}
