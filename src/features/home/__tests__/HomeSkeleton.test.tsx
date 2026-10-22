import { act, isHiddenFromAccessibility, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { HomeSkeleton } from '@/features/home/HomeSkeleton';
import { darkTheme, lightTheme } from '@/theme/theme';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

let mockWidth = 375;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 812, scale: 2, fontScale: 1 }),
}));

// The Reanimated test mock turns every animation into a plain number; this wrapper records that a pulse was built.
const mockWithRepeat = jest.fn((animation: number, _times?: number) => animation);
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  withRepeat: (animation: number, times?: number) => mockWithRepeat(animation, times),
}));

const hidden = { includeHiddenElements: true };
const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);
const linesOf = (card: ReturnType<typeof screen.getByTestId>) => within(card).getAllByTestId('home-skeleton-line', hidden);

beforeEach(() => {
  mockScheme = 'light';
  mockWidth = 375;
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

describe('HomeSkeleton (app-loading-skeleton D1, D3, A2, §10.18)', () => {
  it('draws the hero skeleton and the three cards with title bar and lines', async () => {
    await render(<HomeSkeleton />);
    expect(screen.getByTestId('home-skeleton', hidden)).toBeTruthy();
    expect(screen.getByTestId('trip-hero-skeleton', hidden)).toBeTruthy();
    const cards = {
      flights: screen.getByTestId('home-skeleton-flights', hidden),
      travellers: screen.getByTestId('home-skeleton-travellers', hidden),
      budget: screen.getByTestId('home-skeleton-budget', hidden),
    };
    for (const card of Object.values(cards)) {
      const title = within(card).getByTestId('home-skeleton-title', hidden);
      expect(style(title)).toMatchObject({ width: '40%', height: lightTheme.typography.heading3.lineHeight });
    }
    expect(linesOf(cards.flights)).toHaveLength(3);
    expect(linesOf(cards.travellers)).toHaveLength(2);
    // Kacper 2026-10-21 (revised A2): the Budget card has the amount plus two body lines, not one amount line.
    expect(linesOf(cards.budget)).toHaveLength(3);
    for (const line of [...linesOf(cards.flights), ...linesOf(cards.travellers)]) {
      expect(style(line).height).toBe(lightTheme.typography.bodyM.lineHeight);
    }
  });

  it('draws the Budget card like the real one: title row with the "Zmień" button placeholder, the amount, two body lines', async () => {
    await render(<HomeSkeleton />);
    const budget = screen.getByTestId('home-skeleton-budget', hidden);
    const title = within(budget).getByTestId('home-skeleton-title', hidden);
    const action = within(budget).getByTestId('home-skeleton-action', hidden);
    // Title and action share one row laid out like the header of `Section`.
    expect(action.parent).toBe(title.parent);
    expect(style(title.parent!)).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: lightTheme.spacing[2],
    });
    expect(style(title)).toMatchObject({ width: '40%', height: lightTheme.typography.heading3.lineHeight });
    // The ghost TextButton is buttonCompact tall.
    expect(style(action)).toMatchObject({ width: '20%', height: lightTheme.size.buttonCompact });
    const lines = linesOf(budget);
    expect(lines.map((line) => style(line).height)).toEqual([
      lightTheme.typography.numericL.lineHeight,
      lightTheme.typography.bodyM.lineHeight,
      lightTheme.typography.bodyM.lineHeight,
    ]);
  });

  it('keeps the title and the action out of the lines, and Flights and Travellers without an action', async () => {
    await render(<HomeSkeleton />);
    expect(screen.getAllByTestId('home-skeleton-action', hidden)).toHaveLength(1);
    for (const name of ['flights', 'travellers']) {
      const card = screen.getByTestId(`home-skeleton-${name}`, hidden);
      expect(within(card).queryByTestId('home-skeleton-action', hidden)).toBeNull();
    }
  });

  it('draws no photo strip', async () => {
    await render(<HomeSkeleton />);
    expect(screen.queryByTestId('home-photos', hidden)).toBeNull();
  });

  it.each([
    ['light', lightTheme, lightTheme.colors.surface.default],
    ['dark', darkTheme, darkTheme.colors.surface.secondary],
  ] as const)('draws the cards like the trip view\'s sections in the %s theme', async (scheme, theme, surface) => {
    mockScheme = scheme;
    await render(<HomeSkeleton />);
    for (const id of ['home-skeleton-flights', 'home-skeleton-travellers', 'home-skeleton-budget']) {
      expect(style(screen.getByTestId(id, hidden))).toMatchObject({
        backgroundColor: surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing[4],
        gap: theme.spacing[3],
      });
    }
    expect(style(screen.getByTestId('home-skeleton-flights', hidden))).toMatchObject(theme.elevation.card);
  });

  it('keeps the card blocks visible: the skeleton colour (#DDD5C7) on the white card in light, surface.elevated on the dark card (D5, D27)', async () => {
    const blocks = () =>
      ['flights', 'travellers', 'budget'].flatMap((name) => {
        const card = screen.getByTestId(`home-skeleton-${name}`, hidden);
        return [
          within(card).getByTestId('home-skeleton-title', hidden),
          ...within(card).queryAllByTestId('home-skeleton-action', hidden),
          ...linesOf(card),
        ];
      });
    const { unmount } = await render(<HomeSkeleton />);
    for (const block of blocks()) {
      expect(style(block).backgroundColor).toBe('#DDD5C7');
      expect(style(block).backgroundColor).not.toBe(lightTheme.colors.surface.default);
    }
    expect(style(screen.getByTestId('trip-hero-skeleton', hidden)).backgroundColor).toBe('#DDD5C7');
    expect(style(screen.getByTestId('trip-hero-skeleton', hidden)).backgroundColor).not.toBe(lightTheme.colors.background);
    await unmount();

    mockScheme = 'dark';
    await render(<HomeSkeleton />);
    for (const block of blocks()) expect(style(block).backgroundColor).toBe(darkTheme.colors.surface.elevated);
    // The hero is on the page background, so it keeps the default block colour.
    expect(style(screen.getByTestId('trip-hero-skeleton', hidden)).backgroundColor).toBe(darkTheme.colors.skeleton);
  });

  it.each([
    ['a compact width', 320, lightTheme.spacing[4]],
    ['a wider screen', 375, lightTheme.spacing[5]],
  ])('pads the column by the trip view\'s side padding on %s, up to the max content width', async (_name, width, side) => {
    mockWidth = width;
    expect(width < lightTheme.breakpoints.compact).toBe(side === lightTheme.spacing[4]);
    await render(<HomeSkeleton />);
    const column = screen.getByTestId('home-skeleton-flights', hidden).parent!;
    expect(style(column)).toMatchObject({
      gap: lightTheme.spacing[4],
      paddingHorizontal: side,
      width: '100%',
      maxWidth: lightTheme.size.maxContentWidth,
      alignSelf: 'center',
    });
  });

  it('is hidden from screen readers, root and every block', async () => {
    await render(<HomeSkeleton />);
    expect(screen.queryByTestId('home-skeleton')).toBeNull();
    expect(isHiddenFromAccessibility(screen.getByTestId('home-skeleton', hidden))).toBe(true);
    for (const id of ['trip-hero-skeleton', 'home-skeleton-flights', 'home-skeleton-travellers', 'home-skeleton-budget']) {
      expect(isHiddenFromAccessibility(screen.getByTestId(id, hidden))).toBe(true);
    }
    for (const line of screen.getAllByTestId('home-skeleton-line', hidden)) expect(isHiddenFromAccessibility(line)).toBe(true);
    expect(isHiddenFromAccessibility(screen.getByTestId('home-skeleton-action', hidden))).toBe(true);
  });

  it('pulses with reduced motion off', async () => {
    await render(<HomeSkeleton />);
    await act(async () => {});
    expect(mockWithRepeat).toHaveBeenCalledWith(expect.anything(), -1);
  });

  it('stays still with reduced motion on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<HomeSkeleton />);
    await act(async () => {});
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });
});
