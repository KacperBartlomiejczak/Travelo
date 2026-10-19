import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PillNav } from '@/components/PillNav';
import { NAV_TABS } from '@/features/nav/tabs';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { palette } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

let mockFontScale = 1;
let mockWindowWidth = 360;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: mockFontScale }),
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const PL = ['Podróż', 'Wydatki', 'Miejsca', 'Plan', 'Profil'];

function items() {
  return NAV_TABS.map(({ key, labelKey, Icon }) => ({ key, label: i18n.t(labelKey), Icon }));
}

function ui(activeKey = 'index', onSelect: (key: string) => void = () => {}) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <PillNav items={items()} activeKey={activeKey} onSelect={onSelect} />
    </SafeAreaProvider>
  );
}

const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);
const navButton = (name: string) => screen.getByRole('button', { name });
const icon = (key: string) => screen.getByTestId(`pill-nav-icon-${key}`, { includeHiddenElements: true });
const content = (key: string) => screen.getByTestId(`pill-nav-content-${key}`);
const pass = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const scaleOf = (key: string) => {
  const transform = style(content(key)).transform as { scale: number }[] | undefined;
  return transform?.find((entry) => 'scale' in entry)?.scale;
};

beforeEach(async () => {
  jest.useFakeTimers();
  mockFontScale = 1;
  mockWindowWidth = 360;
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('PillNav (design-context §10.2, pill-nav-and-dialog D1, D2, D4)', () => {
  describe('items', () => {
    it('shows five buttons in order with Polish labels', async () => {
      await render(ui());
      expect(screen.getAllByRole('button').map((item) => item.props.accessibilityLabel)).toEqual(PL);
      PL.forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    });

    it('shows English labels', async () => {
      await i18n.changeLanguage('en');
      await render(ui());
      expect(screen.getAllByRole('button').map((item) => item.props.accessibilityLabel)).toEqual([
        'Trip',
        'Expenses',
        'Places',
        'Plan',
        'Profile',
      ]);
    });

    it('has no role on the container and keeps it non-accessible, so every item is its own screen-reader stop', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav').props.accessibilityRole).toBeUndefined();
      expect(screen.getByTestId('pill-nav').props.accessible).not.toBe(true);
    });

    it('calls onSelect with the key of the pressed item', async () => {
      const onSelect = jest.fn();
      await render(ui('index', onSelect));
      await fireEvent.press(navButton('Miejsca'));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('places');
    });

    it('still calls onSelect when the active item is pressed (the router decides)', async () => {
      const onSelect = jest.fn();
      await render(ui('index', onSelect));
      await fireEvent.press(navButton('Podróż'));
      expect(onSelect).toHaveBeenCalledWith('index');
    });

    it('exposes only the active item as selected', async () => {
      await render(ui('plan'));
      PL.forEach((label) => expect(navButton(label).props.accessibilityState).toEqual(expect.objectContaining({ selected: label === 'Plan' })));
      expect(screen.getByRole('button', { name: 'Plan', selected: true })).toBeTruthy();
      expect(screen.getAllByRole('button', { selected: true })).toHaveLength(1);
    });

    it('is at least 44 x 44dp for every item and shares the width equally', async () => {
      await render(ui());
      screen.getAllByRole('button').forEach((item) => {
        expect(style(item).minHeight).toBeGreaterThanOrEqual(lightTheme.size.touchTarget);
        expect(style(item).minWidth).toBeGreaterThanOrEqual(lightTheme.size.touchTarget);
        expect(style(item).flex).toBe(1);
      });
    });
  });

  describe('look', () => {
    it('active item is brand coloured and large, the others are muted and standard size (light)', async () => {
      await render(ui('expenses'));
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: lightTheme.colors.nav.active, ...lightTheme.typography.caption });
      expect(icon('expenses').props.stroke).toBe(lightTheme.colors.nav.active);
      expect(icon('expenses').props.width).toBe(lightTheme.size.iconPrimary);
      expect(icon('expenses').props.strokeWidth).toBe(lightTheme.size.iconStroke);
      ['Podróż', 'Miejsca', 'Plan', 'Profil'].forEach((label) => {
        expect(screen.getByText(label)).toHaveStyle({ color: lightTheme.colors.nav.textInactive });
      });
      ['index', 'places', 'plan', 'profile'].forEach((key) => {
        expect(icon(key).props.width).toBe(lightTheme.size.iconStandard);
        expect(icon(key).props.height).toBe(lightTheme.size.iconStandard);
        expect(icon(key).props.strokeWidth).toBe(lightTheme.size.iconStroke);
        expect(icon(key).props.stroke).toBe(lightTheme.colors.nav.textInactive);
      });
    });

    it('is a white pill with brand-coloured active item and muted inactive items in light mode (theme-split D2)', async () => {
      await render(ui('expenses'));
      expect(screen.getByTestId('pill-nav')).toHaveStyle({
        backgroundColor: palette.neutral[0],
        borderColor: palette.neutral[200],
      });
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: palette.brand[600] });
      expect(icon('expenses').props.stroke).toBe(palette.brand[600]);
      expect(screen.getByText('Plan')).toHaveStyle({ color: palette.neutral[600] });
      expect(icon('plan').props.stroke).toBe(palette.neutral[600]);
    });

    it('resolves to the ink pill colours in dark mode', async () => {
      await render(ui('expenses'), { wrapper: DarkThemeScope });
      expect(darkTheme.colors.nav).not.toEqual(lightTheme.colors.nav);
      expect(screen.getByTestId('pill-nav')).toHaveStyle({
        backgroundColor: palette.neutral[900],
        borderColor: palette.dark.border,
      });
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: palette.dark.brand });
      expect(icon('expenses').props.stroke).toBe(palette.dark.brand);
      expect(screen.getByText('Plan')).toHaveStyle({ color: palette.dark.textSecondary });
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: darkTheme.colors.nav.active });
      expect(screen.getByText('Plan')).toHaveStyle({ color: darkTheme.colors.nav.textInactive });
      expect(screen.getByTestId('pill-nav')).toHaveStyle({
        backgroundColor: darkTheme.colors.nav.background,
        borderColor: darkTheme.colors.nav.border,
      });
    });

    it('is a floating capsule: 64dp high, fully rounded, 1dp border, floating elevation', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav')).toHaveStyle({
        height: lightTheme.size.navPill,
        borderRadius: lightTheme.radius.full,
        borderWidth: 1,
        borderColor: lightTheme.colors.nav.border,
        backgroundColor: lightTheme.colors.nav.background,
        ...lightTheme.elevation.floating,
      });
      expect(lightTheme.size.navPill).toBe(64);
    });

    it('sits 16dp above the bottom safe area, centred, 16dp from each side', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav-container')).toHaveStyle({
        position: 'absolute',
        bottom: metrics.insets.bottom + lightTheme.spacing[4],
        left: 0,
        right: 0,
        alignItems: 'center',
      });
      expect(screen.getByTestId('pill-nav')).toHaveStyle({ width: 360 - 2 * lightTheme.spacing[4] });
    });

    it('is capped at the maximum content width on a wide screen', async () => {
      mockWindowWidth = 1000;
      await render(ui());
      expect(screen.getByTestId('pill-nav')).toHaveStyle({ width: lightTheme.size.maxContentWidth });
    });

    it('lets touches through everywhere except the capsule (box-none)', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav-container').props.pointerEvents).toBe('box-none');
    });

    it('shows pressed feedback in the nav.pressed colour (theme-split-and-profile-prefill D8)', async () => {
      await render(ui());
      expect(navButton('Plan')).not.toHaveStyle({ backgroundColor: lightTheme.colors.nav.pressed });
      // currentTarget is what Pressability remembers as its responder; without it a later release is ignored.
      await fireEvent(navButton('Plan'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, currentTarget: 1, persist: jest.fn() });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: lightTheme.colors.nav.pressed, borderRadius: lightTheme.radius.full });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: palette.neutral[50] });
      await fireEvent(navButton('Plan'), 'responderRelease', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      await pass(500);
      expect(navButton('Plan')).not.toHaveStyle({ backgroundColor: lightTheme.colors.nav.pressed });
    });

    it('keeps the same pressed colour as before in dark mode (D8)', async () => {
      await render(ui(), { wrapper: DarkThemeScope });
      await fireEvent(navButton('Plan'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, currentTarget: 1, persist: jest.fn() });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: darkTheme.colors.nav.pressed });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: palette.dark.border });
    });

    it('shows a 2dp ring in the active colour while focused', async () => {
      await render(ui());
      expect(navButton('Plan')).not.toHaveStyle({ outlineWidth: lightTheme.size.focusRing });
      await fireEvent(navButton('Plan'), 'focus');
      expect(navButton('Plan')).toHaveStyle({ outlineWidth: lightTheme.size.focusRing, outlineColor: lightTheme.colors.nav.active });
      await fireEvent(navButton('Plan'), 'blur');
      expect(navButton('Plan')).not.toHaveStyle({ outlineWidth: lightTheme.size.focusRing });
    });
  });

  describe('large text (R1)', () => {
    it('shows every label up to a font scale of 1.3', async () => {
      mockFontScale = 1.3;
      await render(ui('index'));
      PL.forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    });

    it('above 1.3 shows only the active label and keeps the accessibility labels', async () => {
      mockFontScale = 2;
      await render(ui('expenses'));
      expect(screen.getByText('Wydatki')).toBeTruthy();
      ['Podróż', 'Miejsca', 'Plan', 'Profil'].forEach((label) => {
        expect(screen.queryByText(label)).toBeNull();
        expect(navButton(label)).toBeTruthy();
      });
      expect(screen.getAllByRole('button').map((item) => item.props.accessibilityLabel)).toEqual(PL);
    });
  });

  describe('motion (§9, D4)', () => {
    it('does not animate on first render', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await render(ui('index'));
      expect(timing).not.toHaveBeenCalled();
      expect(scaleOf('index')).toBe(1);
      expect(scaleOf('expenses')).toBe(1);
    });

    it('grows the new active item and settles the old one over 180 ms', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const timing = jest.spyOn(Animated, 'timing');
      const view = await render(ui('index'));
      await view.rerender(ui('expenses'));
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 1, duration: lightTheme.duration.small, useNativeDriver: false }),
      );
      expect(lightTheme.duration.small).toBe(180);
      // The new active item starts at the size ratio of its former (inactive) icon, the old one at the active size.
      expect(scaleOf('expenses')).toBeCloseTo(lightTheme.size.iconStandard / lightTheme.size.iconPrimary, 2);
      expect(scaleOf('index')).toBeCloseTo(lightTheme.size.iconPrimary / lightTheme.size.iconStandard, 2);
      await pass(lightTheme.duration.small + 50);
      expect(scaleOf('expenses')).toBe(1);
      expect(scaleOf('index')).toBe(1);
    });

    it('switches at once, with no animation, when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const view = await render(ui('index'));
      const timing = jest.spyOn(Animated, 'timing');
      await view.rerender(ui('expenses'));
      expect(timing).not.toHaveBeenCalled();
      expect(scaleOf('expenses')).toBe(1);
      expect(scaleOf('index')).toBe(1);
      expect(icon('expenses').props.width).toBe(lightTheme.size.iconPrimary);
      expect(icon('index').props.width).toBe(lightTheme.size.iconStandard);
    });

    it('settles both items at 1 when reduce motion switches on while the animation runs', async () => {
      let setReduceMotion: (enabled: boolean) => void = () => {};
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      // The overloads of addEventListener are per event name; the stand-in only serves 'reduceMotionChanged'.
      const addListener = (_event: string, handler: (enabled: boolean) => void) => {
        setReduceMotion = handler;
        return { remove: jest.fn() };
      };
      jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(addListener as unknown as typeof AccessibilityInfo.addEventListener);
      const view = await render(ui('index'));
      await view.rerender(ui('expenses'));
      expect(scaleOf('expenses')).toBeLessThan(1);
      await act(async () => {
        setReduceMotion(true);
      });
      expect(scaleOf('expenses')).toBe(1);
      expect(scaleOf('index')).toBe(1);
      await pass(lightTheme.duration.small + 50);
      expect(scaleOf('expenses')).toBe(1);
    });
  });
});
