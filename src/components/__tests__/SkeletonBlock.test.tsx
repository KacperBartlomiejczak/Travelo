import { act, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { colors, radii, tokens } from '@/theme/tokens';

const { skeletonPulse } = tokens.motion.microinteraction;
const skeletonRadius = tokens.components.skeleton.radius;

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

// The Reanimated test mock turns every animation into a plain number; these wrappers record how the pulse was built.
const mockWithTiming = jest.fn((toValue: number, _config?: { duration?: number }) => toValue);
const mockWithSequence = jest.fn((...steps: number[]) => steps[steps.length - 1]);
const mockWithRepeat = jest.fn((animation: number, _times?: number) => animation);
const mockCancelAnimation = jest.fn();
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  withTiming: (toValue: number, config?: { duration?: number }) => mockWithTiming(toValue, config),
  withSequence: (...steps: number[]) => mockWithSequence(...steps),
  withRepeat: (animation: number, times?: number) => mockWithRepeat(animation, times),
  cancelAnimation: (value: unknown) => mockCancelAnimation(value),
}));

const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

beforeEach(() => {
  mockScheme = 'light';
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

describe('SkeletonBlock (profile-screen D9, §8.19, Sunline tokens)', () => {
  it('has the geometry it is given and is hidden from screen readers', async () => {
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    const block = screen.getByTestId('block', { includeHiddenElements: true });
    expect(style(block)).toMatchObject({ width: 48, height: 30 });
    expect(isHiddenFromAccessibility(block)).toBe(true);
  });

  it('rounds its corners with components.skeleton.radius unless a radius is given', async () => {
    const { unmount } = await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).borderRadius).toBe(skeletonRadius);
    await unmount();
    await render(<SkeletonBlock testID="block" width={48} height={30} radius={radii.none} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).borderRadius).toBe(radii.none);
  });

  it('is skeleton.base in light and in dark mode (sunline-merge-main D2)', async () => {
    const { unmount } = await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe(colors.light.skeleton.base);
    await unmount();
    mockScheme = 'dark';
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe(colors.dark.skeleton.base);
  });

  it('uses the colour it is given instead of the default (app-loading-skeleton D5)', async () => {
    mockScheme = 'dark';
    const { unmount } = await render(<SkeletonBlock testID="block" width={48} height={30} color={colors.dark.surface.elevated} />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe(colors.dark.surface.elevated);
    await unmount();
    mockScheme = 'light';
    await render(<SkeletonBlock testID="block" width={48} height={30} color="#123456" />);
    expect(style(screen.getByTestId('block', { includeHiddenElements: true })).backgroundColor).toBe('#123456');
  });

  it.each(['light', 'dark'] as const)('reduced motion off (%s): pulses opacity 1 -> minOpacity -> 1, forever, one cycle = skeletonPulse.duration', async (scheme) => {
    mockScheme = scheme;
    await render(<SkeletonBlock testID="block" width={48} height={30} />);
    await act(async () => {});
    expect(mockWithRepeat).toHaveBeenCalled();

    const legs = mockWithTiming.mock.calls.map(([toValue, config]) => ({ toValue, duration: config?.duration }));
    expect(legs.map((leg) => leg.toValue)).toEqual([skeletonPulse.minOpacity, 1]);
    expect(legs.reduce((sum, leg) => sum + (leg.duration ?? 0), 0)).toBe(skeletonPulse.duration);
    expect(mockWithSequence).toHaveBeenCalledTimes(1);
    expect(mockWithRepeat).toHaveBeenCalledWith(expect.anything(), -1);
  });

  it('cancels the pulse when it unmounts, and not before', async () => {
    const { unmount } = await render(<SkeletonBlock testID="block" width={48} height={30} />);
    await act(async () => {});
    expect(mockWithRepeat).toHaveBeenCalled();
    expect(mockCancelAnimation).not.toHaveBeenCalled();
    await unmount();
    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
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
