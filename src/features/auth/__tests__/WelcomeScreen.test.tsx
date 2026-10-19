import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';

import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { setNetwork } from '@/test/mock-network';
import { darkTheme, lightTheme } from '@/theme/theme';

import { WelcomeScreen } from '../WelcomeScreen';

// The device is light: the welcome screen must be dark anyway (D5).
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'light' }));

let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 2, fontScale: 1 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));

// The style the welcome screen last gave the status bar.
let mockStatusBarStyle: string | undefined;
jest.mock('expo-status-bar', () => ({
  StatusBar: ({ style }: { style?: string }) => {
    mockStatusBarStyle = style;
    return null;
  },
}));

// Jest turns every image into the number 1, so the Bali files are stood in by distinct objects.
jest.mock('../../../../assets/covers/bali.jpg', () => ({ uri: 'bundled/bali.jpg' }));
jest.mock('../../../../assets/covers/bali_thumb.jpg', () => ({ uri: 'bundled/bali_thumb.jpg' }));

jest.mock('@/data/app-auth', () => ({ appAuth: { signInWithProvider: jest.fn(async () => 'cancelled') } }));

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

async function setup() {
  const rendered = renderRouter({ _layout: Layout, index: WelcomeScreen, email: () => <Text>email screen</Text> });
  await rendered;
  return { getPathname: () => rendered.getPathname() };
}

type JsonNode = { type: string; props: Record<string, unknown>; children: (JsonNode | string)[] | null };

function findNode(node: JsonNode | string | null, type: string): JsonNode | null {
  if (!node || typeof node === 'string') return null;
  if (node.type === type) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, type);
    if (found) return found;
  }
  return null;
}

function gradientStops(): number[] {
  const gradient = findNode(screen.toJSON() as JsonNode | null, 'RNSVGLinearGradient');
  return (gradient?.props.gradient as number[] | undefined) ?? [];
}

const signInButton = () => screen.getByRole('button', { name: 'Zaloguj się' });
const hidden = { includeHiddenElements: true };

beforeEach(async () => {
  mockWidth = 390;
  mockStatusBarStyle = undefined;
  await i18n.changeLanguage('pl');
});

describe('WelcomeScreen (auth-onboarding D5, D6, P4, P5, P6)', () => {
  it('shows the title as a header, the sentence and "Zaloguj się" (PL)', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Witaj w Travelo' })).toBeTruthy();
    expect(screen.getByText('Zaplanuj wyjazd dla całej ekipy — loty, budżet i dni w jednym miejscu.')).toBeTruthy();
    expect(signInButton()).toBeEnabled();
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByRole('header', { name: 'Welcome to Travelo' })).toBeTruthy();
    expect(screen.getByText('Plan a trip for the whole crew — flights, budget and days in one place.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('is always dark: ink background, light text, the dark primary button, a light status bar', async () => {
    await setup();
    expect(screen.getByTestId('welcome-screen')).toHaveStyle({ backgroundColor: darkTheme.colors.hero.background });
    expect(screen.getByText('Witaj w Travelo')).toHaveStyle({ ...darkTheme.typography.displayXL, color: darkTheme.colors.hero.text });
    expect(screen.getByText(/Zaplanuj wyjazd/)).toHaveStyle({ color: darkTheme.colors.hero.textSecondary });
    expect(signInButton()).toHaveStyle({ backgroundColor: darkTheme.colors.action.primary });
    expect(signInButton()).not.toHaveStyle({ backgroundColor: lightTheme.colors.action.primary });
    expect(mockStatusBarStyle).toBe('light');
  });

  it('uses the Bali cover full screen, hidden from screen readers, fading into ink with the hero token', async () => {
    await setup();
    expect(screen.queryByTestId('welcome-photo')).toBeNull(); // not reachable for screen readers
    expect(screen.getByTestId('welcome-photo', hidden).props['aria-hidden']).toBe(true);
    const image = screen.getByTestId('welcome-image', hidden);
    expect(image.props.source).toEqual([{ uri: 'bundled/bali.jpg' }]); // expo-image normalises to a list
    expect(image).toHaveStyle({ backgroundColor: darkTheme.colors.hero.background });
    expect(screen.getByTestId('welcome-gradient', hidden)).toBeTruthy();
    // The fade follows the theme's gradient token, like the trip hero (§20 rule 20). The native gradient prop is
    // [offset, colour, offset, colour, …].
    const offsets = gradientStops().filter((_, i) => i % 2 === 0);
    expect(offsets).toEqual([lightTheme.gradient.heroFade.start, 1]);
  });

  it('darkens the whole photo with the scrim token, between the image and the fade into ink', async () => {
    await setup();
    const dim = screen.getByTestId('welcome-dim', hidden);
    expect(dim).toHaveStyle({ ...StyleSheet.flatten(StyleSheet.absoluteFill), backgroundColor: darkTheme.colors.overlay.scrim });
    const json = JSON.stringify(screen.toJSON());
    const order = ['"welcome-image"', '"welcome-dim"', '"welcome-gradient"'].map((id) => json.indexOf(id));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The dim sits inside the photo layer, so screen readers skip it.
    expect(screen.queryByTestId('welcome-dim')).toBeNull();
  });

  it('puts the content in the thumb zone: at the bottom, above the safe area, 720dp wide at most, 20dp from the sides', async () => {
    await setup();
    const container = StyleSheet.flatten(screen.getByTestId('welcome-content').props.contentContainerStyle);
    expect(container).toMatchObject({ flexGrow: 1, justifyContent: 'flex-end' });
    const column = screen.getByTestId('welcome-column');
    expect(column).toHaveStyle({
      maxWidth: lightTheme.size.maxContentWidth,
      paddingHorizontal: lightTheme.spacing[5],
      paddingBottom: 34 + lightTheme.spacing[4],
      gap: lightTheme.spacing[4],
    });
  });

  it('uses 16dp side padding below 360dp', async () => {
    mockWidth = 340;
    await setup();
    expect(screen.getByTestId('welcome-column')).toHaveStyle({ paddingHorizontal: lightTheme.spacing[4] });
  });

  it('reads title, sentence, then the button (focus order follows the visual order)', async () => {
    await setup();
    const json = JSON.stringify(screen.toJSON());
    const order = ['Witaj w Travelo', 'Zaplanuj wyjazd', '"Zaloguj się"'].map((text) => json.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('"Zaloguj się" opens the sign-in sheet with the three options', async () => {
    await setup();
    expect(screen.queryByTestId('sign-in-options')).toBeNull();

    await fireEvent.press(signInButton());

    const sheet = await screen.findByTestId('bottom-sheet');
    expect(within(sheet).getByRole('header', { name: 'Zaloguj się' })).toBeTruthy();
    expect(within(sheet).getAllByRole('button').filter((b) => /Kontynuuj/.test(String(b.props.accessibilityLabel)))).toHaveLength(3);
    // Inside the dark scope, so the sheet is dark too.
    expect(sheet).toHaveStyle({ backgroundColor: darkTheme.colors.surface.elevated });
  });

  it('closing the sheet leaves the welcome screen, and it opens again afresh', async () => {
    await setup();
    await fireEvent.press(signInButton());
    await screen.findByTestId('bottom-sheet');

    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByTestId('bottom-sheet')).toBeNull());
    expect(screen.getByRole('header', { name: 'Witaj w Travelo' })).toBeTruthy();

    await fireEvent.press(signInButton());
    expect(await screen.findByTestId('bottom-sheet')).toBeTruthy();
  });

  it('the e-mail option leaves for the e-mail screen and the status bar follows that screen', async () => {
    const { getPathname } = await setup();
    await fireEvent.press(signInButton());
    await fireEvent.press(await screen.findByRole('button', { name: 'Kontynuuj z e-mailem' }));

    await waitFor(() => expect(getPathname()).toBe('/email'));
    await waitFor(() => expect(mockStatusBarStyle).toBe('auto'));
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  describe('offline (P4)', () => {
    it('shows the banner above a disabled button', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      await setup();

      expect(screen.getByTestId('offline-banner')).toBeTruthy();
      expect(signInButton()).toBeDisabled();
      const json = JSON.stringify(screen.toJSON());
      expect(json.indexOf('offline-banner')).toBeLessThan(json.indexOf('"Zaloguj się"'));
      await fireEvent.press(signInButton());
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    });

    it('has no banner online, and the button works again when the connection returns', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      await setup();
      await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
      expect(screen.queryByTestId('offline-banner')).toBeNull();
      expect(signInButton()).toBeEnabled();
    });
  });

  describe('entrance animation (theme-split-and-profile-prefill P3, design-context §9)', () => {
    const { standard } = darkTheme.duration;
    const rise = darkTheme.spacing[4];
    const STEP = 80;
    const parts = ['welcome-title', 'welcome-body', 'welcome-action'] as const;

    const look = (testID: (typeof parts)[number]) => {
      const flat = StyleSheet.flatten(screen.getByTestId(testID).props.style);
      const transform = flat.transform as { translateY: number }[] | undefined;
      return { opacity: flat.opacity as number, translateY: transform?.find((entry) => 'translateY' in entry)?.translateY };
    };
    const pass = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('uses the standard transition: 240 ms, and a 16dp rise', () => {
      expect(standard).toBe(240);
      expect(rise).toBe(16);
    });

    describe('without reduced motion', () => {
      beforeEach(() => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      });

      it('starts the title, the sentence and the button invisible and 16dp low', async () => {
        await setup();
        for (const part of parts) expect(look(part)).toEqual({ opacity: 0, translateY: rise });
      });

      it('fades and lifts each into place, one after another', async () => {
        await setup();
        await pass(100); // the title is 100 ms in, the sentence 20 ms in, the button has not started
        expect(look('welcome-title').opacity).toBeGreaterThan(0);
        expect(look('welcome-body').opacity).toBeGreaterThan(0);
        expect(look('welcome-title').opacity).toBeGreaterThan(look('welcome-body').opacity);
        expect(look('welcome-action')).toEqual({ opacity: 0, translateY: rise });

        await pass(20); // t = 120 ms, still before the button's 160 ms delay
        expect(look('welcome-action')).toEqual({ opacity: 0, translateY: rise });

        await pass(100); // t = 220 ms: the button is 60 ms in; the title is nearly done
        expect(look('welcome-action').opacity).toBeGreaterThan(0);
        expect(look('welcome-title').opacity).toBeGreaterThan(look('welcome-body').opacity);
        expect(look('welcome-body').opacity).toBeGreaterThan(look('welcome-action').opacity);
        expect(look('welcome-title').translateY).toBeLessThan(rise);

        await pass(2 * STEP + standard); // well past 160 + 240 ms
        for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
      });

      it('times each one for 240 ms, delayed 0, 80 and 160 ms, with the enter easing', async () => {
        const timing = jest.spyOn(Animated, 'timing');
        await setup();
        const delays = timing.mock.calls.map(([, config]) => config.delay);
        expect(delays).toEqual([0, STEP, 2 * STEP]); // title, sentence, button
        for (const [, config] of timing.mock.calls) {
          expect(config.duration).toBe(standard);
          expect(typeof config.easing).toBe('function');
          expect(config.easing?.(0)).toBeCloseTo(0, 5);
          expect(config.easing?.(1)).toBeCloseTo(1, 5);
          expect(config.easing?.(0.2)).toBeGreaterThan(0.5); // cubic-bezier(0.2, 0.8, 0.2, 1) leaves fast
        }
      });

      it('"Zaloguj się" works from the first frame, while it is still invisible', async () => {
        await setup();
        expect(look('welcome-action').opacity).toBe(0);
        await fireEvent.press(signInButton());
        expect(await screen.findByTestId('bottom-sheet')).toBeTruthy();
      });

      it('does not animate the offline banner, and the disabled button still does not open the sheet', async () => {
        setNetwork({ isConnected: false, isInternetReachable: false });
        await setup();
        expect(screen.getByTestId('offline-banner')).toBeTruthy();
        expect(StyleSheet.flatten(screen.getByTestId('offline-banner').props.style)?.opacity).not.toBe(0);
        await fireEvent.press(signInButton());
        expect(screen.queryByTestId('bottom-sheet')).toBeNull();
      });
    });

    describe('with reduced motion', () => {
      beforeEach(() => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      });

      it('shows everything in place at once, without any animation', async () => {
        const timing = jest.spyOn(Animated, 'timing');
        await setup();
        for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
        expect(timing).not.toHaveBeenCalled();
        await pass(2 * STEP + standard);
        for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
      });

      it('"Zaloguj się" opens the sheet', async () => {
        await setup();
        await fireEvent.press(signInButton());
        expect(await screen.findByTestId('bottom-sheet')).toBeTruthy();
      });

      it('shows everything in place, without animating, when the system cannot say whether to reduce motion', async () => {
        // Every caller (welcome screen, cover image, sign-in sheet) asks through the shared hook, and the question fails for all.
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
        const timing = jest.spyOn(Animated, 'timing');
        await setup();
        for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
        expect(timing).not.toHaveBeenCalled();
        await fireEvent.press(signInButton());
        expect(await screen.findByTestId('bottom-sheet')).toBeTruthy();
      });

      it('settles at once when reduce motion switches on while the entrance runs', async () => {
        let setReduceMotion: (enabled: boolean) => void = () => {};
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
        // The overloads of addEventListener are per event name; the stand-in only serves 'reduceMotionChanged'.
        const addListener = (_event: string, handler: (enabled: boolean) => void) => {
          setReduceMotion = handler;
          return { remove: jest.fn() };
        };
        jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(addListener as unknown as typeof AccessibilityInfo.addEventListener);
        await setup();
        await pass(100);
        expect(look('welcome-action').opacity).toBe(0);
        await act(async () => {
          setReduceMotion(true);
        });
        for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
        await pass(2 * STEP + standard);
        for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
      });
    });

    it('stays dark on a light phone while it animates', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await setup();
      await pass(2 * STEP + standard);
      expect(screen.getByTestId('welcome-screen')).toHaveStyle({ backgroundColor: darkTheme.colors.hero.background });
      expect(screen.getByText('Witaj w Travelo')).toHaveStyle({ color: darkTheme.colors.hero.text });
    });
  });

  it('scrolls when the text is huge, so nothing is cut off at 200 % font size', async () => {
    await setup();
    const scroll = screen.getByTestId('welcome-content');
    expect(scroll.type).toBe('RCTScrollView');
    expect(scroll.props.alwaysBounceVertical).toBe(false);
    expect(isHiddenFromAccessibility(scroll)).toBe(false);
  });
});
