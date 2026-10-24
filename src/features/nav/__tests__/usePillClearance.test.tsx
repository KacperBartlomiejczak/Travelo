import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { usePillBottomOffset, usePillClearance } from '../usePillClearance';

const { tabs } = tokens.components;

function withInsets(bottom: number) {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom } };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;
  };
}

// §8.14: the pill floats 12 dp above the bottom safe-area inset (sunline-redesign D23, was 16).
describe('usePillClearance (pill-nav-and-dialog, sunline-redesign D23)', () => {
  it('puts the pill 12dp above the bottom inset', async () => {
    const { result } = await renderHook(() => usePillBottomOffset(), { wrapper: withInsets(34) });
    expect(result.current).toBe(34 + tokens.spacing[3]);
    expect(result.current).toBe(34 + 12);
  });

  it('is the bottom inset + 12 + the pill height', async () => {
    const { result } = await renderHook(() => usePillClearance(), { wrapper: withInsets(34) });
    expect(result.current).toBe(34 + tokens.spacing[3] + tabs.height);
    expect(result.current).toBe(34 + 12 + 64);
  });

  it('has no inset part on a device without a bottom inset', async () => {
    const { result } = await renderHook(() => usePillClearance(), { wrapper: withInsets(0) });
    expect(result.current).toBe(12 + 64);
  });
});
