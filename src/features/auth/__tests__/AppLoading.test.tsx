import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLoading } from '@/features/auth/AppLoading';
import i18n from '@/i18n';
import { colors, tokens } from '@/theme/tokens';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

let mockWidth = 360;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 812, scale: 2, fontScale: 1 }),
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const hidden = { includeHiddenElements: true };
const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

function ui() {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <AppLoading />
    </SafeAreaProvider>
  );
}

beforeEach(async () => {
  mockScheme = 'light';
  mockWidth = 360;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  await i18n.changeLanguage('pl');
});

describe('AppLoading (app-loading-skeleton step 4, D2, A3, A4)', () => {
  it('is a busy, labelled view on the canvas that fills the screen', async () => {
    await render(ui());
    const root = screen.getByTestId('app-loading');
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityState).toEqual({ busy: true });
    expect(root.props.accessibilityLabel).toBe('Wczytywanie');
    expect(style(root)).toMatchObject({ flex: 1, backgroundColor: colors.light.background.canvas });
  });

  it('speaks English', async () => {
    await i18n.changeLanguage('en');
    await render(ui());
    expect(screen.getByTestId('app-loading').props.accessibilityLabel).toBe('Loading');
  });

  it('contains the home skeleton: hero and the three cards', async () => {
    await render(ui());
    const root = screen.getByTestId('app-loading');
    expect(root).toBeTruthy();
    expect(screen.getByTestId('home-skeleton', hidden)).toBeTruthy();
    expect(screen.getByTestId('trip-hero-skeleton', hidden)).toBeTruthy();
    for (const name of ['flights', 'travellers', 'budget']) expect(screen.getByTestId(`home-skeleton-${name}`, hidden)).toBeTruthy();
  });

  it('puts a round 44 dp placeholder where the menu button sits, drawn above the hero', async () => {
    mockWidth = 320; // compact: the gutter is screenGutterCompact
    await render(ui());
    const menu = screen.getByTestId('app-loading-menu', hidden);
    expect(style(menu)).toMatchObject({ width: tokens.components.iconButton.size, height: tokens.components.iconButton.size, borderRadius: tokens.components.iconButton.radius });
    expect(tokens.components.iconButton.size).toBe(44);
    // The wrapper is the one HeroMenuButton uses: absolute, under the status bar, at the gutter, above the content.
    expect(style(menu.parent!)).toMatchObject({
      position: 'absolute',
      zIndex: 1,
      top: metrics.insets.top + tokens.spacing[2],
      left: tokens.layout.screenGutterCompact,
    });
  });

  it.each([
    ['389 dp (compact)', 389, tokens.layout.screenGutterCompact],
    ['390 dp (regular)', 390, tokens.layout.screenGutter],
  ])("keeps the menu placeholder at the real button's gutter at %s", async (_name, width, side) => {
    mockWidth = width;
    await render(ui());
    expect(style(screen.getByTestId('app-loading-menu', hidden).parent!).left).toBe(side);
  });

  it("draws a pill-shaped placeholder with the pill's width, height and position", async () => {
    await render(ui());
    const pill = screen.getByTestId('app-loading-pill', hidden);
    expect(style(pill)).toMatchObject({
      width: Math.min(mockWidth - 2 * tokens.spacing[4], tokens.layout.maxContentWidth),
      height: tokens.components.tabs.height,
      borderRadius: tokens.radii.pill,
    });
    expect(style(pill.parent!)).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: metrics.insets.bottom + tokens.spacing[3], // the real pill's offset (usePillBottomOffset)
      alignItems: 'center',
    });
  });

  it('caps the pill placeholder at the max content width on a wide screen', async () => {
    mockWidth = 1024;
    await render(ui());
    expect(style(screen.getByTestId('app-loading-pill', hidden)).width).toBe(tokens.layout.maxContentWidth);
  });

  it.each(['light', 'dark'] as const)('draws the chrome blocks in border.default, which shows over the hero skeleton and the canvas in %s (D1)', async (scheme) => {
    mockScheme = scheme;
    await render(ui());
    const hero = style(screen.getByTestId('trip-hero-skeleton', hidden)).backgroundColor;
    expect(hero).toBe(colors[scheme].skeleton.base);
    for (const id of ['app-loading-menu', 'app-loading-pill']) {
      const color = style(screen.getByTestId(id, hidden)).backgroundColor;
      expect(color).toBe(colors[scheme].border.default);
      expect(color).not.toBe(hero);
      expect(color).not.toBe(colors[scheme].background.canvas);
    }
    expect(style(screen.getByTestId('app-loading')).backgroundColor).toBe(colors[scheme].background.canvas);
  });

  it('hides every block from screen readers: only the busy root with its label is reachable', async () => {
    await render(ui());
    expect(isHiddenFromAccessibility(screen.getByTestId('app-loading'))).toBe(false);
    for (const id of ['home-skeleton', 'trip-hero-skeleton', 'app-loading-menu', 'app-loading-pill']) {
      expect(isHiddenFromAccessibility(screen.getByTestId(id, hidden))).toBe(true);
    }
  });
});
