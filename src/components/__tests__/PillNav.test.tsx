import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import { AccessibilityInfo, LayoutAnimation, StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PillNav } from '@/components/PillNav';
import { NAV_TABS } from '@/features/nav/tabs';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

let mockFontScale = 1;
let mockWindowWidth = 360;
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: mockFontScale }),
}));

const { tabs, focusRing } = tokens.components;
const { styles } = tokens.typography;

const metrics = { frame: { x: 0, y: 0, width: 360, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const PL = ['Podróż', 'Wydatki', 'Plan', 'Profil'];
const UNSELECTED = ['Podróż', 'Plan', 'Profil'];

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
const scaleOf = (key: string) => {
  const transform = style(screen.getByTestId(`pill-nav-motion-${key}`)).transform as { scale: number }[] | undefined;
  return transform?.[0]?.scale;
};
// Only the PillNav motions run for duration.standard (the press scale uses duration.pressIn).
const standardTimings = (spy: jest.SpyInstance) => spy.mock.calls.filter(([, config]) => config?.duration === tokens.motion.duration.standard);
const pass = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(async () => {
  jest.useFakeTimers();
  mockFontScale = 1;
  mockWindowWidth = 360;
  mockScheme = 'light';
  await i18n.changeLanguage('pl');
  // The Reanimated mock creates a new shared value on every render; a stable one lets values survive re-renders like on a device.
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(<T,>(init: T) => useRef({ value: init }).current as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('PillNav (design-context §8.14, places-legal-navbar A2)', () => {
  describe('items', () => {
    it('shows four buttons in order with Polish accessibility labels, and only the selected label as text', async () => {
      await render(ui());
      expect(screen.getAllByRole('button').map((item) => item.props.accessibilityLabel)).toEqual(PL);
      expect(screen.getByText('Podróż')).toBeTruthy();
      ['Wydatki', 'Plan', 'Profil'].forEach((label) => expect(screen.queryByText(label)).toBeNull());
    });

    it('shows English labels', async () => {
      await i18n.changeLanguage('en');
      await render(ui());
      expect(screen.getAllByRole('button').map((item) => item.props.accessibilityLabel)).toEqual(['Trip', 'Expenses', 'Plan', 'Profile']);
    });

    it('has no role on the row and keeps it non-accessible, so every item is its own screen-reader stop', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav').props.accessibilityRole).toBeUndefined();
      expect(screen.getByTestId('pill-nav').props.accessible).not.toBe(true);
    });

    it('calls onSelect with the key of the pressed item', async () => {
      const onSelect = jest.fn();
      await render(ui('index', onSelect));
      await fireEvent.press(navButton('Plan'));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('plan');
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
      expect(screen.getAllByRole('button', { selected: true })).toHaveLength(1);
    });

    it('unselected items are 48x48 circles (>= 44dp touch target); the selected one is a 48dp high capsule with 16dp side padding', async () => {
      await render(ui('expenses'));
      UNSELECTED.forEach((label) => {
        expect(navButton(label)).toHaveStyle({ width: tabs.height, height: tabs.height, borderRadius: tokens.radii.pill });
      });
      expect(tabs.height).toBe(48);
      expect(tabs.height).toBeGreaterThanOrEqual(tokens.layout.touchTarget);
      expect(navButton('Wydatki')).toHaveStyle({ height: tabs.height, paddingHorizontal: tabs.horizontalPadding, borderRadius: tokens.radii.pill });
      expect(tabs.horizontalPadding).toBe(16);
    });
  });

  describe('look (§8.14)', () => {
    it('selected: label and icon in brand.onBrand over the sliding brand.primary indicator; the others icon-only circles on background.sunken (light)', async () => {
      await render(ui('expenses'));
      expect(style(screen.getByTestId('pill-nav-indicator')).backgroundColor).toBe(lightTheme.brand.primary);
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: lightTheme.brand.onBrand, ...styles.labelSM });
      expect(icon('expenses').props.stroke).toBe(lightTheme.brand.onBrand);
      UNSELECTED.forEach((label) => {
        expect(screen.queryByText(label)).toBeNull();
        expect(navButton(label)).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
      });
      ['index', 'plan', 'profile'].forEach((key) => expect(icon(key).props.stroke).toBe(lightTheme.icon.secondary));
    });

    it('lays the selected icon and label in a row with an 8dp gap', async () => {
      await render(ui('expenses'));
      expect(content('expenses')).toHaveStyle({ flexDirection: 'row', gap: tabs.gap });
      expect(tabs.gap).toBe(8);
      expect(screen.getByText('Wydatki').props.numberOfLines).toBe(1);
    });

    it('shows every icon at 22dp with the 1.75 stroke', async () => {
      await render(ui('expenses'));
      NAV_TABS.forEach(({ key }) => {
        expect(icon(key).props.width).toBe(tabs.iconSize);
        expect(icon(key).props.strokeWidth).toBe(tokens.iconography.strokeWidth);
      });
    });

    it('uses the dark colours in dark mode, with a level 2 border instead of a shadow on the shared pill only', async () => {
      await render(ui('expenses'), { wrapper: DarkThemeScope });
      expect(style(screen.getByTestId('pill-nav-indicator')).backgroundColor).toBe(darkTheme.brand.primary);
      expect(screen.getByText('Wydatki')).toHaveStyle({ color: darkTheme.brand.onBrand });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: darkTheme.background.sunken });
      expect(style(screen.getByTestId('pill-nav'))).toMatchObject({ backgroundColor: darkTheme.surface.elevated, borderWidth: 1, shadowOpacity: 0, elevation: 0 });
      screen.getAllByRole('button').forEach((item) => expect(style(item).borderWidth).toBeUndefined());
    });

    it('draws one shared pill under the row: surface.elevated, radius.pill, level 2 shadow, 8dp padding -> 64dp high; items have no own shadow', async () => {
      await render(ui('expenses'));
      expect(style(screen.getByTestId('pill-nav'))).toMatchObject({
        ...lightTheme.elevation.level2,
        backgroundColor: lightTheme.surface.elevated,
        borderRadius: tokens.radii.pill,
        padding: tabs.containerPadding,
        gap: tokens.spacing[2],
      });
      expect(style(screen.getByTestId('pill-nav')).shadowOpacity).toBeGreaterThan(0);
      expect(tabs.containerPadding).toBe(8);
      expect(tabs.height + 2 * tabs.containerPadding).toBe(64);
      screen.getAllByRole('button').forEach((item) => expect(style(item).shadowOpacity).toBeUndefined());
    });

    it('leaves vertical room for the shadow: the container is taller than the items and does not clip', async () => {
      await render(ui());
      const container = style(screen.getByTestId('pill-nav-container'));
      expect(container).toMatchObject({ position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingVertical: tokens.spacing[2] });
      // The items themselves start 12dp above the safe area, as usePillClearance assumes.
      expect(container.bottom).toBe(metrics.insets.bottom + tokens.spacing[3] - tokens.spacing[2]);
      expect(container.overflow).not.toBe('hidden');
      expect(style(screen.getByTestId('pill-nav')).overflow).not.toBe('hidden');
      expect(navButton('Plan')).not.toHaveStyle({ overflow: 'hidden' });
    });

    it('keeps the row within the container on a 320dp screen with a large font scale, truncating the label', async () => {
      mockWindowWidth = 320;
      mockFontScale = 2;
      await render(ui('expenses'));
      expect(style(screen.getByTestId('pill-nav')).width).toBe(320 - 2 * tokens.spacing[4]);
      expect(screen.getByText('Wydatki').props.numberOfLines).toBe(1);
      expect(navButton('Wydatki')).toHaveStyle({ flexShrink: 1 });
      const fixed = 3 * tabs.height + 3 * tokens.spacing[2] + 2 * tabs.containerPadding + 2 * tabs.horizontalPadding + tabs.iconSize + tabs.gap;
      expect(fixed).toBeLessThan(320 - 2 * tokens.spacing[4]);
    });

    it('is capped at the fixed pill width on a wide screen (D10)', async () => {
      mockWindowWidth = 1000;
      await render(ui());
      expect(tabs.pillWidth).toBe(320);
      expect(style(screen.getByTestId('pill-nav')).width).toBe(320);
    });

    it('has a fixed width of min(pillWidth, window - 2 * spacing[4]), items spread evenly, unchanged by a selection change (D10)', async () => {
      mockWindowWidth = 411;
      const view = await render(ui('index'));
      const pill = () => style(screen.getByTestId('pill-nav'));
      expect(pill()).toMatchObject({ width: 320, justifyContent: 'space-between' });
      await view.rerender(ui('expenses'));
      expect(pill().width).toBe(320);
      expect(pill().maxWidth).toBeUndefined();
    });

    it('keeps the view with the elevation on the same view as the radius and background (rounded shadow)', async () => {
      await render(ui('index'));
      const pill = style(screen.getByTestId('pill-nav'));
      expect(pill.elevation).toBeGreaterThan(0);
      expect(pill).toMatchObject({ borderRadius: tokens.radii.pill, backgroundColor: lightTheme.surface.elevated });
    });

    it('mounts a new pill view when the colour scheme changes (Android keeps a stale square shadow outline otherwise)', async () => {
      mockScheme = 'dark';
      const view = await render(ui());
      const hostOf = () => (screen.getByTestId('pill-nav') as unknown as { instance: unknown }).instance;
      const before = hostOf();
      mockScheme = 'light';
      await view.rerender(ui());
      expect(style(screen.getByTestId('pill-nav')).borderWidth).toBeUndefined();
      expect(hostOf()).not.toBe(before);
    });

    it('lets touches through everywhere except the items (box-none)', async () => {
      await render(ui());
      expect(screen.getByTestId('pill-nav-container').props.pointerEvents).toBe('box-none');
    });

    it('shows a pressed selected item with brand.pressed and a pressed unselected one with background.sunken, scaled like every button (D8)', async () => {
      await render(ui('expenses'));
      // currentTarget is what Pressability remembers as its responder; without it a later release is ignored.
      await fireEvent(navButton('Plan'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, currentTarget: 1, persist: jest.fn() });
      expect(navButton('Plan')).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
      expect(scaleOf('plan')).toBe(tokens.motion.press.scale);
      await fireEvent(navButton('Plan'), 'responderRelease', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      await pass(500);
      expect(scaleOf('plan')).toBe(1);
      await fireEvent(navButton('Wydatki'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, currentTarget: 2, persist: jest.fn() });
      expect(navButton('Wydatki')).toHaveStyle({ backgroundColor: lightTheme.brand.pressed });
      await fireEvent(navButton('Wydatki'), 'responderRelease', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      await pass(500);
      expect(style(navButton('Wydatki')).backgroundColor).toBeUndefined();
    });

    it('shows a 2dp border.focus ring while focused', async () => {
      await render(ui());
      expect(navButton('Plan')).not.toHaveStyle({ outlineWidth: focusRing.width });
      await fireEvent(navButton('Plan'), 'focus');
      expect(navButton('Plan')).toHaveStyle({ outlineWidth: focusRing.width, outlineColor: lightTheme.border.focus, outlineOffset: focusRing.offset });
      await fireEvent(navButton('Plan'), 'blur');
      expect(navButton('Plan')).not.toHaveStyle({ outlineWidth: focusRing.width });
    });
  });

  describe('sliding indicator (D7)', () => {
    const indicator = () => style(screen.getByTestId('pill-nav-indicator'));
    const layout = (name: string, x: number, width: number) =>
      fireEvent(navButton(name), 'layout', { nativeEvent: { layout: { x, y: 8, width, height: tabs.height } } });
    // The Reanimated mock re-evaluates animated styles only on render, so a re-render stands in for the UI thread.
    const flush = (view: Awaited<ReturnType<typeof render>>, key: string) => view.rerender(ui(key));

    it('takes the active item x and width after onLayout, without animating the first time', async () => {
      const timing = jest.spyOn(Reanimated, 'withTiming');
      const view = await render(ui('index'));
      await layout('Podróż', 8, 120);
      await flush(view, 'index');
      expect(indicator()).toMatchObject({ position: 'absolute', left: 8, width: 120, height: tabs.height, top: tabs.containerPadding, borderRadius: tokens.radii.pill });
      expect(standardTimings(timing)).toHaveLength(0);
    });

    it('animates left and width to the new item over duration.standard when the selection changes', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const view = await render(ui('index'));
      await layout('Podróż', 8, 120);
      const timing = jest.spyOn(Reanimated, 'withTiming');
      await view.rerender(ui('expenses'));
      await layout('Wydatki', 184, 140);
      await flush(view, 'expenses');
      expect(timing).toHaveBeenCalledWith(184, expect.objectContaining({ duration: tokens.motion.duration.standard }));
      expect(timing).toHaveBeenCalledWith(140, expect.objectContaining({ duration: tokens.motion.duration.standard }));
      expect(indicator()).toMatchObject({ left: 184, width: 140 });
    });

    it('in dark mode lines up with the active item: left compensates the 1 dp border, top does not', async () => {
      const view = await render(ui('index'), { wrapper: DarkThemeScope });
      await layout('Podróż', 9, 120);
      await flush(view, 'index');
      expect(indicator()).toMatchObject({ left: 8, top: tabs.containerPadding });
    });

    it('moves at once with reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const view = await render(ui('index'));
      await layout('Podróż', 8, 120);
      const timing = jest.spyOn(Reanimated, 'withTiming');
      await view.rerender(ui('expenses'));
      await layout('Wydatki', 184, 140);
      await flush(view, 'expenses');
      expect(standardTimings(timing)).toHaveLength(0);
      expect(indicator()).toMatchObject({ left: 184, width: 140 });
    });
  });

  describe('motion (§7.3, §7.4)', () => {
    const labelOpacity = () => style(screen.getByText('Wydatki')).opacity as number;

    it('does not animate on first render', async () => {
      const timing = jest.spyOn(Reanimated, 'withTiming');
      await render(ui('index'));
      expect(standardTimings(timing)).toHaveLength(0);
      expect(style(screen.getByText('Podróż')).opacity).toBe(1);
    });

    it('fades the new selected label in over duration.standard (180 ms)', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const timing = jest.spyOn(Reanimated, 'withTiming');
      const view = await render(ui('index'));
      await view.rerender(ui('expenses'));
      expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: tokens.motion.duration.standard }));
      expect(tokens.motion.duration.standard).toBe(180);
      await pass(tokens.motion.duration.standard + 50);
      expect(labelOpacity()).toBe(1);
    });

    it('starts the fade of the new selected label at 0, then times it to 1', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const assigned: number[] = [];
      jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(<T,>(init: T) => {
        const value = useRef({ current: init, set(next: T) { this.current = next; if (init === 1) assigned.push(next as number); } }).current;
        return useRef({ get value() { return value.current; }, set value(next: T) { value.set(next); } }).current as never;
      });
      const view = await render(ui('index'));
      await pass(0);
      assigned.length = 0;
      await view.rerender(ui('expenses'));
      const zero = assigned.indexOf(0);
      expect(zero).toBeGreaterThanOrEqual(0);
      expect(assigned[zero + 1]).toBe(1);
    });

    it('animates the capsule width change with LayoutAnimation over duration.standard, once per selection change', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const configure = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
      const view = await render(ui('index'));
      expect(configure).not.toHaveBeenCalled();
      await view.rerender(ui('expenses'));
      expect(configure).toHaveBeenCalledTimes(1);
      expect(configure).toHaveBeenCalledWith(expect.objectContaining({ duration: tokens.motion.duration.standard }));
      await view.rerender(ui('expenses'));
      expect(configure).toHaveBeenCalledTimes(1);
    });

    it('does not use LayoutAnimation with reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const configure = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
      const view = await render(ui('index'));
      await view.rerender(ui('expenses'));
      expect(configure).not.toHaveBeenCalled();
    });

    it('switches at once, with no animation, when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const view = await render(ui('index'));
      const timing = jest.spyOn(Reanimated, 'withTiming');
      await view.rerender(ui('expenses'));
      expect(standardTimings(timing)).toHaveLength(0);
      expect(labelOpacity()).toBe(1);
    });

    it('when the system cannot say whether to reduce motion, it shows without animation', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
      const view = await render(ui('index'));
      const timing = jest.spyOn(Reanimated, 'withTiming');
      await view.rerender(ui('expenses'));
      expect(standardTimings(timing)).toHaveLength(0);
      expect(labelOpacity()).toBe(1);
    });

    it('does not animate while the answer is still unknown', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
      const view = await render(ui('index'));
      const timing = jest.spyOn(Reanimated, 'withTiming');
      await view.rerender(ui('expenses'));
      expect(standardTimings(timing)).toHaveLength(0);
      expect(labelOpacity()).toBe(1);
    });

    it('ends with the selected label at opacity 1 after fast successive switches', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const view = await render(ui('index'));
      await pass(0);
      await view.rerender(ui('expenses'));
      await pass(90);
      await view.rerender(ui('plan'));
      await pass(60);
      await view.rerender(ui('expenses'));
      await pass(40);
      await view.rerender(ui('plan'));
      await pass(tokens.motion.duration.standard + 50);
      expect(style(screen.getByText('Plan')).opacity).toBe(1);
    });

    it('settles the label at full opacity when reduce motion switches on while the fade runs', async () => {
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
      await act(async () => {
        setReduceMotion(true);
      });
      expect(labelOpacity()).toBe(1);
      await pass(tokens.motion.duration.standard + 50);
      expect(labelOpacity()).toBe(1);
    });
  });
});
