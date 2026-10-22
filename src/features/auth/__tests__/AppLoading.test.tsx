import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLoading } from '@/features/auth/AppLoading';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';

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
  it('is a busy, labelled view in the background colour that fills the screen', async () => {
    await render(ui());
    const root = screen.getByTestId('app-loading');
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityState).toEqual({ busy: true });
    expect(root.props.accessibilityLabel).toBe('Wczytywanie');
    expect(style(root)).toMatchObject({ flex: 1, backgroundColor: lightTheme.colors.background });
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
    mockWidth = 320; // compact: the side padding is spacing[4]
    await render(ui());
    const menu = screen.getByTestId('app-loading-menu', hidden);
    expect(style(menu)).toMatchObject({ width: lightTheme.size.touchTarget, height: lightTheme.size.touchTarget, borderRadius: lightTheme.radius.full });
    expect(lightTheme.size.touchTarget).toBe(44);
    // The wrapper is the one HeroMenuButton uses: absolute, under the status bar, at the side padding, above the content.
    expect(style(menu.parent!)).toMatchObject({
      position: 'absolute',
      zIndex: 1,
      top: metrics.insets.top + lightTheme.spacing[2],
      left: lightTheme.spacing[4],
    });
  });

  it.each([
    ['a compact width', 320, lightTheme.spacing[4]],
    ['a wider screen', 375, lightTheme.spacing[5]],
  ])('keeps the menu placeholder at the real button\'s side padding on %s', async (_name, width, side) => {
    mockWidth = width;
    await render(ui());
    expect(style(screen.getByTestId('app-loading-menu', hidden).parent!).left).toBe(side);
  });

  it('draws a pill-shaped placeholder with the pill\'s width, height and position', async () => {
    await render(ui());
    const pill = screen.getByTestId('app-loading-pill', hidden);
    expect(style(pill)).toMatchObject({
      width: Math.min(mockWidth - 2 * lightTheme.spacing[4], lightTheme.size.maxContentWidth),
      height: lightTheme.size.navPill,
      borderRadius: lightTheme.radius.full,
    });
    expect(style(pill.parent!)).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: metrics.insets.bottom + lightTheme.spacing[4],
      alignItems: 'center',
    });
  });

  it('caps the pill placeholder at the max content width on a wide screen', async () => {
    mockWidth = 1024;
    await render(ui());
    expect(style(screen.getByTestId('app-loading-pill', hidden)).width).toBe(lightTheme.size.maxContentWidth);
  });

  it.each([
    ['light', lightTheme, '#C5BBAA'],
    ['dark', darkTheme, darkTheme.colors.input.border],
  ] as const)('draws the chrome blocks in input.border, a colour that shows over the hero skeleton and the page in %s (D25, D27)', async (scheme, theme, chrome) => {
    mockScheme = scheme;
    await render(ui());
    const hero = style(screen.getByTestId('trip-hero-skeleton', hidden)).backgroundColor;
    expect(hero).toBe(theme.colors.skeleton);
    for (const id of ['app-loading-menu', 'app-loading-pill']) {
      const color = style(screen.getByTestId(id, hidden)).backgroundColor;
      expect(color).toBe(chrome);
      expect(color).not.toBe(hero);
      expect(color).not.toBe(theme.colors.background);
    }
    expect(style(screen.getByTestId('app-loading')).backgroundColor).toBe(theme.colors.background);
  });

  it('hides every block from screen readers: only the busy root with its label is reachable', async () => {
    await render(ui());
    expect(isHiddenFromAccessibility(screen.getByTestId('app-loading'))).toBe(false);
    for (const id of ['home-skeleton', 'trip-hero-skeleton', 'app-loading-menu', 'app-loading-pill']) {
      expect(isHiddenFromAccessibility(screen.getByTestId(id, hidden))).toBe(true);
    }
  });
});
