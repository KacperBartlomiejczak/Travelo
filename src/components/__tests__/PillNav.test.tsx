import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PillNav } from '@/components/PillNav';
import { NAV_TABS } from '@/features/nav/tabs';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

let mockFontScale = 1;
let mockWindowWidth = 360;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: mockFontScale }),
}));

const { tabs, focusRing } = tokens.components;
const { styles } = tokens.typography;

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
const capsule = (key: string) => screen.getByTestId(`pill-nav-capsule-${key}`);
const hasCapsule = (key: string) => screen.queryByTestId(`pill-nav-capsule-${key}`) !== null;
const pass = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const opacityOf = (key: string) => style(capsule(key)).opacity as number;

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

describe('PillNav (design-context §8.14, pill-nav-and-dialog D1, D2, D4)', () => {
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

    it('is at least 44dp high and 56dp wide from 390dp screens up, and shares the width equally (D27)', async () => {
      mockWindowWidth = tokens.layout.compactBreakpoint;
      await render(ui());
      screen.getAllByRole('button').forEach((item) => {
        expect(style(item).minHeight).toBeGreaterThanOrEqual(tokens.layout.touchTarget);
        expect(style(item).minWidth).toBe(tabs.itemMinWidth);
        expect(style(item).flex).toBe(1);
      });
      expect(tabs.itemMinWidth).toBe(56);
    });

    it('drops the minimum width to the 44dp touch target below 390dp, so five items fit a 320dp phone (D27)', async () => {
      mockWindowWidth = tokens.layout.compactBreakpoint - 1;
      await render(ui());
      screen.getAllByRole('button').forEach((item) => {
        expect(style(item).minWidth).toBe(tokens.layout.touchTarget);
        expect(style(item).minHeight).toBeGreaterThanOrEqual(tokens.layout.touchTarget);
        expect(style(item).flex).toBe(1);
      });
      expect(tokens.layout.touchTarget).toBe(44);
      mockWindowWidth = 320;
      await screen.unmount();
      await render(ui());
      screen.getAllByRole('button').forEach((item) => expect(style(item).minWidth).toBe(tokens.layout.touchTarget));
      // 5 x 44 + 2 x 8 side padding fits the pill (320 - 2 x 16).
      expect(5 * tokens.layout.touchTarget + 2 * tabs.horizontalPadding).toBeLessThanOrEqual(320 - 2 * tokens.spacing[4]);
    });
  });

  describe('look (§8.14)', () => {
    it('selected item: brand.tint capsule with text.brand label and icon; the others icon.secondary / text.tertiary (light)', async () => {
      await render(ui('expenses'));
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: lightTheme.text.brand, ...styles.labelSM });
      expect(icon('expenses').props.stroke).toBe(lightTheme.text.brand);
      expect(capsule('expenses')).toHaveStyle({ backgroundColor: lightTheme.brand.tint, borderRadius: tokens.radii.pill });
      ['Podróż', 'Miejsca', 'Plan', 'Profil'].forEach((label) => {
        expect(screen.getByText(label)).toHaveStyle({ color: lightTheme.text.tertiary, ...styles.labelSM });
      });
      ['index', 'places', 'plan', 'profile'].forEach((key) => {
        expect(icon(key).props.stroke).toBe(lightTheme.icon.secondary);
        // The capsule is the selection's container shape: only the selected item has it.
        expect(hasCapsule(key)).toBe(false);
      });
    });

    it('uses the dark colours in dark mode', async () => {
      await render(ui('expenses'), { wrapper: DarkThemeScope });
      expect(darkTheme.brand.tint).not.toBe(lightTheme.brand.tint);
      expect(capsule('expenses')).toHaveStyle({ backgroundColor: darkTheme.brand.tint });
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: darkTheme.text.brand });
      expect(icon('expenses').props.stroke).toBe(darkTheme.text.brand);
      expect(screen.getByText('Plan')).toHaveStyle({ color: darkTheme.text.tertiary });
      expect(icon('plan').props.stroke).toBe(darkTheme.icon.secondary);
    });

    it('shows every icon at 22dp with the 1.75 stroke, selected or not, with a 3dp gap to the label', async () => {
      await render(ui('expenses'));
      NAV_TABS.forEach(({ key }) => {
        expect(icon(key).props.width).toBe(tabs.iconSize);
        expect(icon(key).props.height).toBe(tabs.iconSize);
        expect(icon(key).props.strokeWidth).toBe(tokens.iconography.strokeWidth);
        expect(content(key)).toHaveStyle({ gap: tabs.labelGap });
      });
      expect([tabs.iconSize, tabs.labelGap, tokens.iconography.strokeWidth]).toEqual([22, 3, 1.75]);
    });

    it('is a floating capsule: 64dp high, 8dp side padding, fully rounded, elevated surface, level 2 shadow (light)', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav')).toHaveStyle({
        height: tabs.height,
        paddingHorizontal: tabs.horizontalPadding,
        borderRadius: tabs.radius,
        backgroundColor: lightTheme.surface.elevated,
        ...lightTheme.elevation.level2,
      });
      expect([tabs.height, tabs.horizontalPadding, tabs.radius]).toEqual([64, 8, tokens.radii.pill]);
      expect(style(screen.getByTestId('pill-nav')).shadowOpacity).toBeGreaterThan(0);
    });

    it('takes its depth from a level 2 border, not a shadow, in dark mode', async () => {
      await render(ui(), { wrapper: DarkThemeScope });
      expect(screen.getByTestId('pill-nav')).toHaveStyle({ backgroundColor: darkTheme.surface.elevated, ...darkTheme.elevation.level2 });
      expect(style(screen.getByTestId('pill-nav'))).toMatchObject({ borderWidth: 1, shadowOpacity: 0, elevation: 0 });
    });

    it('sits above the bottom safe area, centred, 16dp from each side', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav-container')).toHaveStyle({
        position: 'absolute',
        bottom: metrics.insets.bottom + tokens.spacing[4],
        left: 0,
        right: 0,
        alignItems: 'center',
      });
      expect(screen.getByTestId('pill-nav')).toHaveStyle({ width: 360 - 2 * tokens.spacing[4] });
    });

    it('is capped at the maximum content width on a wide screen', async () => {
      mockWindowWidth = 1000;
      await render(ui());
      expect(screen.getByTestId('pill-nav')).toHaveStyle({ width: tokens.layout.maxContentWidth });
    });

    it('lets touches through everywhere except the capsule (box-none)', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav-container').props.pointerEvents).toBe('box-none');
    });

    it('shows a pressed item, selected or not, with a background.sunken underlay', async () => {
      await render(ui('expenses'));
      expect(navButton('Plan')).not.toHaveStyle({ backgroundColor: lightTheme.background.sunken });
      // currentTarget is what Pressability remembers as its responder; without it a later release is ignored.
      await fireEvent(navButton('Plan'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, currentTarget: 1, persist: jest.fn() });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: lightTheme.background.sunken, borderRadius: tokens.radii.pill });
      await fireEvent(navButton('Plan'), 'responderRelease', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      await pass(500);
      expect(navButton('Plan')).not.toHaveStyle({ backgroundColor: lightTheme.background.sunken });
      await fireEvent(navButton('Wydatki'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, currentTarget: 2, persist: jest.fn() });
      // The selected tint capsule covers the underlay, so what the user sees on a pressed selected tab is the capsule itself.
      expect(capsule('expenses')).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
      await fireEvent(navButton('Wydatki'), 'responderRelease', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      await pass(500);
      expect(capsule('expenses')).toHaveStyle({ backgroundColor: lightTheme.brand.tint });
    });

    it('uses the dark underlay in dark mode', async () => {
      await render(ui(), { wrapper: DarkThemeScope });
      await fireEvent(navButton('Plan'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, currentTarget: 1, persist: jest.fn() });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: darkTheme.background.sunken });
    });

    it('shows a 2dp border.focus ring while focused', async () => {
      await render(ui());
      expect(navButton('Plan')).not.toHaveStyle({ outlineWidth: focusRing.width });
      await fireEvent(navButton('Plan'), 'focus');
      expect(navButton('Plan')).toHaveStyle({ outlineWidth: focusRing.width, outlineColor: lightTheme.border.focus });
      await fireEvent(navButton('Plan'), 'blur');
      expect(navButton('Plan')).not.toHaveStyle({ outlineWidth: focusRing.width });
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

  describe('motion (§7.3 selected-tab indicator, §7.4, D4)', () => {
    it('does not animate on first render', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await render(ui('index'));
      expect(timing).not.toHaveBeenCalled();
      expect(opacityOf('index')).toBe(1);
      expect(hasCapsule('expenses')).toBe(false);
    });

    it('fades the new selected capsule in over duration.standard (180 ms); the one left just loses its capsule', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const timing = jest.spyOn(Animated, 'timing');
      const view = await render(ui('index'));
      await view.rerender(ui('expenses'));
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 1, duration: tokens.motion.duration.standard, useNativeDriver: false }),
      );
      expect(tokens.motion.duration.standard).toBe(180);
      expect(opacityOf('expenses')).toBe(0);
      expect(hasCapsule('index')).toBe(false);
      // Only the capsule fades: icon and label of the new item stay fully visible.
      expect(style(content('expenses')).opacity).toBeUndefined();
      await pass(tokens.motion.duration.standard + 50);
      expect(opacityOf('expenses')).toBe(1);
    });

    it('switches at once, with no animation, when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const view = await render(ui('index'));
      const timing = jest.spyOn(Animated, 'timing');
      await view.rerender(ui('expenses'));
      expect(timing).not.toHaveBeenCalled();
      expect(opacityOf('expenses')).toBe(1);
      expect(capsule('expenses')).toHaveStyle({ backgroundColor: lightTheme.brand.tint });
    });

    it('when the system cannot say whether to reduce motion, it shows without animation', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
      const view = await render(ui('index'));
      const timing = jest.spyOn(Animated, 'timing');
      await view.rerender(ui('expenses'));
      expect(timing).not.toHaveBeenCalled();
      expect(opacityOf('expenses')).toBe(1);
    });

    it('does not animate while the answer is still unknown', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
      const view = await render(ui('index'));
      const timing = jest.spyOn(Animated, 'timing');
      await view.rerender(ui('expenses'));
      expect(timing).not.toHaveBeenCalled();
      expect(opacityOf('expenses')).toBe(1);
    });

    it('settles the capsule at full opacity when reduce motion switches on while the fade runs', async () => {
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
      expect(opacityOf('expenses')).toBeLessThan(1);
      await act(async () => {
        setReduceMotion(true);
      });
      expect(opacityOf('expenses')).toBe(1);
      await pass(tokens.motion.duration.standard + 50);
      expect(opacityOf('expenses')).toBe(1);
    });
  });
});
