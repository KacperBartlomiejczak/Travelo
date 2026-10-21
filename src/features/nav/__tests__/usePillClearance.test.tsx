import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { lightTheme } from '@/theme/legacy/theme';

import { usePillClearance } from '../usePillClearance';

function withInsets(bottom: number) {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom } };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;
  };
}

describe('usePillClearance (pill-nav-and-dialog)', () => {
  it('is the bottom inset + 16 + the pill height', async () => {
    const { result } = await renderHook(() => usePillClearance(), { wrapper: withInsets(34) });
    expect(result.current).toBe(34 + lightTheme.spacing[4] + lightTheme.size.navPill);
    expect(result.current).toBe(34 + 16 + 64);
  });

  it('has no inset part on a device without a bottom inset', async () => {
    const { result } = await renderHook(() => usePillClearance(), { wrapper: withInsets(0) });
    expect(result.current).toBe(16 + 64);
  });
});
