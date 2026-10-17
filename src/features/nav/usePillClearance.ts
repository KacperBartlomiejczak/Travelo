import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

// Where the floating pill navigation starts: safe-area inset + the gap above it.
export function usePillBottomOffset(): number {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return insets.bottom + spacing[4];
}

// The space the pill takes from the bottom of the screen: its offset + its height. Screens add their own spacing
// on top of it so that content is never hidden under the pill.
export function usePillClearance(): number {
  const { size } = useTheme();
  return usePillBottomOffset() + size.navPill;
}
