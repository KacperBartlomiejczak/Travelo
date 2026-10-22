import { act, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { darkTheme, lightTheme } from '@/theme/theme';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

// The Reanimated test mock turns every animation into a plain number; these wrappers record how the pulse was built.
const mockWithTiming = jest.fn((toValue: number, _config?: { duration?: number }) => toValue);
const mockWithSequence = jest.fn((...steps: number[]) => steps[steps.length - 1]);
const mockWithRepeat = jest.fn((animation: number, _times?: number) => animation);
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  withTiming: (toValue: number, config?: { duration?: number }) => mockWithTiming(toValue, config),
  withSequence: (...steps: number[]) => mockWithSequence(...steps),
  withRepeat: (animation: number, times?: number) => mockWithRepeat(animation, times),
}));

const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

beforeEach(() => {
  mockScheme = 'light';
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

describe('SkeletonBlock (profile-screen D9, §10.18)', () => {
  it('has the geometry it is given and is hidden from screen readers', async () => {
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    const block = screen.getByTestId('block', { includeHiddenElements: true });
    expect(style(block)).toMatchObject({ width: 48, height: 30 });
    expect(isHiddenFromAccessibility(block)).toBe(true);
  });

  it('rounds its corners with radius.sm unless a radius is given', async () => {
    const { unmount } = await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).borderRadius).toBe(lightTheme.radius.sm);
    await unmount();
    await render(<SkeletonBlock testID="block" width={48} height={30} radius={lightTheme.radius.none} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).borderRadius).toBe(lightTheme.radius.none);
  });

  it('is #DDD5C7 (neutral.200) in light mode and #39443B (the skeleton role) in dark mode (D24, D27)', async () => {
    const { unmount } = await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe('#DDD5C7');
    await unmount();
    mockScheme = 'dark';
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe('#39443B');
  });

  it('uses the colour it is given instead of the default (app-loading-skeleton D5)', async () => {
    mockScheme = 'dark';
    const { unmount } = await render(<SkeletonBlock testID="block" width={48} height={30} color={darkTheme.colors.surface.elevated} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe(darkTheme.colors.surface.elevated);
    await unmount();
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe(darkTheme.colors.skeleton);
    await unmount();
    mockScheme = 'light';
    await render(<SkeletonBlock testID="block" width={48} height={30} color="#123456" />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe('#123456');
  });

  it('takes the pulse from tokens: 1200 ms per cycle (§10.18) down to opacity 0.5, the same in both themes', () => {
    expect(lightTheme.duration.skeletonPulse).toBe(1200);
    expect(lightTheme.opacity.skeletonPulseMin).toBe(0.5);
    expect(darkTheme.duration).toBe(lightTheme.duration);
    expect(darkTheme.opacity).toBe(lightTheme.opacity);
  });

  it('reduced motion off: pulses opacity 1 -> skeletonPulseMin -> 1, forever, one cycle = duration.skeletonPulse', async () => {
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    await act(async () => {});
    expect(mockWithRepeat).toHaveBeenCalled();

    const legs = mockWithTiming.mock.calls.map(([toValue, config]) => ({ toValue, duration: config?.duration }));
    expect(legs.map((leg) => leg.toValue)).toEqual([lightTheme.opacity.skeletonPulseMin, 1]);
    expect(legs.reduce((sum, leg) => sum + (leg.duration ?? 0), 0)).toBe(lightTheme.duration.skeletonPulse);
    expect(mockWithSequence).toHaveBeenCalledTimes(1);
    expect(mockWithRepeat).toHaveBeenCalledWith(expect.anything(), -1);
  });

  it('never scales: only opacity is animated', async () => {
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    await act(async () => {});
    expect(mockWithRepeat).toHaveBeenCalled();
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).transform).toBeUndefined();
  });

  it('reduced motion on: no animation at all, opacity stays 1', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    await act(async () => {});
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(mockWithRepeat).not.toHaveBeenCalled();
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).opacity).toBe(1);
  });

  it('waits for the system to answer before moving: no animation while reduced motion is unknown', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).opacity).toBe(1);
  });
});
