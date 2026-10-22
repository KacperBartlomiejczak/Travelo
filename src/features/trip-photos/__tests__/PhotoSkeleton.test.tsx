import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

import { PhotoSkeleton } from '../PhotoTile';

const { duration, minOpacity } = tokens.motion.microinteraction.skeletonPulse;
const { photoStripHeight: TILE } = tokens.screenMetrics.tripOverview;
const loading = () => screen.getByTestId('photo-strip-loading');
const opacity = () => StyleSheet.flatten(loading().props.style).opacity as number;
const pass = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Sunline Editorial §8.19 geometry and colors, motion per sunline-redesign D5 / D19 (pulse, not shimmer).
describe('PhotoSkeleton', () => {
  it('is three 80dp tiles with the medium radius in skeleton.base, 8dp apart, named once for a screen reader and busy', async () => {
    await render(<PhotoSkeleton label="Zdjęcia z podróży" />);
    expect(loading().props.accessible).toBe(true);
    expect(loading().props.accessibilityLabel).toBe('Zdjęcia z podróży');
    expect(loading().props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
    expect(loading()).toHaveStyle({ flexDirection: 'row', gap: tokens.spacing[2] });
    const tiles = screen.getAllByTestId('photo-skeleton-tile');
    expect(tiles).toHaveLength(3);
    for (const tile of tiles) {
      expect(tile).toHaveStyle({ width: TILE, height: TILE, borderRadius: tokens.radii.md, backgroundColor: lightTheme.skeleton.base });
    }
  });

  it('uses the dark skeleton color in dark mode', async () => {
    await render(<PhotoSkeleton label="Zdjęcia z podróży" />, { wrapper: DarkThemeScope });
    for (const tile of screen.getAllByTestId('photo-skeleton-tile')) {
      expect(tile).toHaveStyle({ backgroundColor: darkTheme.skeleton.base });
    }
  });

  it('pulses its opacity 1 → 0.5 → 1 over 1200 ms and repeats (D5, D19)', async () => {
    await render(<PhotoSkeleton label="Zdjęcia z podróży" />);
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
    await render(<PhotoSkeleton label="Zdjęcia z podróży" />);
    await act(async () => {});
    await pass(duration);
    expect(opacity()).toBe(1);
  });

  it('does not pulse while the system has not answered yet', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    await render(<PhotoSkeleton label="Zdjęcia z podróży" />);
    await pass(duration / 2);
    expect(opacity()).toBe(1);
  });
});
