import { act, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { heroHeight } from '@/components/TripHero';
import { TripHeroSkeleton } from '@/components/TripHeroSkeleton';
import { colors, tokens } from '@/theme/tokens';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
}));

// The Reanimated test mock turns every animation into a plain number; these wrappers record how the pulse was built.
const mockWithTiming = jest.fn((toValue: number, _config?: { duration?: number }) => toValue);
const mockWithRepeat = jest.fn((animation: number, _times?: number) => animation);
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  withTiming: (toValue: number, config?: { duration?: number }) => mockWithTiming(toValue, config),
  withRepeat: (animation: number, times?: number) => mockWithRepeat(animation, times),
}));

const { skeletonPulse } = tokens.motion.microinteraction;
const hidden = { includeHiddenElements: true };
const skeleton = () => screen.getByTestId('trip-hero-skeleton', hidden);
const style = () => StyleSheet.flatten(skeleton().props.style);

beforeEach(() => {
  mockScheme = 'light';
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

// Sunline Editorial §8.19 geometry and colors; a SkeletonBlock of the hero's size (sunline-merge-main, D19).
describe('TripHeroSkeleton', () => {
  it('is a full-width, square-cornered block of the hero height, hidden from screen readers', async () => {
    await render(<TripHeroSkeleton />);
    expect(screen.queryByTestId('trip-hero-skeleton')).toBeNull();
    expect(isHiddenFromAccessibility(skeleton())).toBe(true);
    expect(style()).toMatchObject({ width: '100%', height: heroHeight(812), borderRadius: tokens.radii.none });
    expect(heroHeight(812)).toBe(422);
  });

  it.each(['light', 'dark'] as const)('is skeleton.base in %s', async (scheme) => {
    mockScheme = scheme;
    await render(<TripHeroSkeleton />);
    expect(style().backgroundColor).toBe(colors[scheme].skeleton.base);
  });

  it('pulses opacity 1 -> minOpacity -> 1 over skeletonPulse.duration, forever', async () => {
    await render(<TripHeroSkeleton />);
    await act(async () => {});
    const legs = mockWithTiming.mock.calls.map(([toValue, config]) => ({ toValue, duration: config?.duration }));
    expect(legs.map((leg) => leg.toValue)).toEqual([skeletonPulse.minOpacity, 1]);
    expect(legs.reduce((sum, leg) => sum + (leg.duration ?? 0), 0)).toBe(skeletonPulse.duration);
    expect(mockWithRepeat).toHaveBeenCalledWith(expect.anything(), -1);
  });

  it('stays static at full opacity when the system asks to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<TripHeroSkeleton />);
    await act(async () => {});
    expect(mockWithRepeat).not.toHaveBeenCalled();
    expect(style().opacity).toBe(1);
  });

  it('does not pulse while the system has not yet said whether to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    await render(<TripHeroSkeleton />);
    await act(async () => {});
    expect(mockWithRepeat).not.toHaveBeenCalled();
    expect(style().opacity).toBe(1);
  });

  it('stays static when the system cannot say whether to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
    await render(<TripHeroSkeleton />);
    await act(async () => {});
    expect(mockWithRepeat).not.toHaveBeenCalled();
    expect(style().opacity).toBe(1);
  });
});
