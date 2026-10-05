import type { ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = { children: ReactNode; testID?: string; onLayout?: (event: LayoutChangeEvent) => void };

// Card used by wizard forms: surface, radius lg, padding 16, elevation 1 in light mode (D27).
export function Card({ children, testID, onLayout }: Props) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[
        {
          backgroundColor: theme.colors.surface.default,
          borderRadius: theme.radius.lg,
          padding: theme.spacing[4],
          gap: theme.spacing[3],
        },
        theme.elevation.card,
      ]}
    >
      {children}
    </View>
  );
}
