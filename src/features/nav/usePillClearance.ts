import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

// Where the floating pill navigation starts: safe-area inset + the 12 dp gap above it (§8.14, sunline-redesign D23).
export function usePillBottomOffset(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + tokens.spacing[3];
}

// The space the pill takes from the bottom of the screen: its offset + its height. Screens add their own spacing
// on top of it so that content is never hidden under the pill.
export function usePillClearance(): number {
  return usePillBottomOffset() + tokens.components.tabs.height;
}
