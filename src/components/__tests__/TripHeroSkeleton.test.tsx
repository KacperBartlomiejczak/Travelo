import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { TripHeroSkeleton } from '@/components/TripHeroSkeleton';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
}));

const { duration, minOpacity } = tokens.motion.microinteraction.skeletonPulse;
const hidden = { includeHiddenElements: true };
const skeleton = () => screen.getByTestId('trip-hero-skeleton', hidden);
const opacity = () => StyleSheet.flatten(skeleton().props.style).opacity as number;
const pass = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Sunline Editorial §8.19 geometry and colors, motion per sunline-redesign D5 (pulse, not shimmer).
describe('TripHeroSkeleton', () => {
  it('is a block of the hero height in skeleton.base, hidden from screen readers', async () => {
    await render(<TripHeroSkeleton />);
    expect(screen.queryByTestId('trip-hero-skeleton')).toBeNull();
    expect(skeleton().props['aria-hidden']).toBe(true);
    // Same geometry as the full-bleed hero (§10.1, radius none).
    expect(skeleton()).toHaveStyle({ height: 406, borderRadius: tokens.radii.none, backgroundColor: lightTheme.skeleton.base });
  });

  it('uses the dark skeleton color in dark mode', async () => {
    await render(<TripHeroSkeleton />, { wrapper: DarkThemeScope });
    expect(skeleton()).toHaveStyle({ backgroundColor: darkTheme.skeleton.base });
  });

  it('pulses its opacity 1 → 0.5 → 1 over 1200 ms and repeats (D5)', async () => {
    expect([duration, minOpacity]).toEqual([1200, 0.5]);
    await render(<TripHeroSkeleton />);
    await act(async () => {}); // the reduce-motion answer arrives
    expect(opacity()).toBeCloseTo(1, 1);
    await pass(duration / 2);
    expect(opacity()).toBeCloseTo(minOpacity, 1);
    await pass(duration / 2);
    expect(opacity()).toBeCloseTo(1, 1);
    await pass(duration / 2);
    expect(opacity()).toBeCloseTo(minOpacity, 1);
  });

  it('stays static at full opacity when the system asks to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<TripHeroSkeleton />);
    await act(async () => {});
    await pass(duration / 2);
    expect(opacity()).toBe(1);
    await pass(duration);
    expect(opacity()).toBe(1);
  });

  it('does not pulse while the system has not yet said whether to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    const loop = jest.spyOn(Animated, 'loop');
    await render(<TripHeroSkeleton />);
    await act(async () => {});
    await pass(duration / 2);
    expect(loop).not.toHaveBeenCalled();
    expect(opacity()).toBe(1);
  });

  it('stays static when the system cannot say whether to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
    await render(<TripHeroSkeleton />);
    await act(async () => {});
    await pass(duration / 2);
    expect(opacity()).toBe(1);
  });

  it('stops pulsing when it unmounts', async () => {
    const stop = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
    const view = await render(<TripHeroSkeleton />);
    await act(async () => {}); // the pulse starts once the reduce-motion answer (false) has arrived
    await view.unmount();
    expect(stop).toHaveBeenCalled();
  });
});
