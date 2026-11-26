import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

import { ProWelcomeScreen } from '../ProWelcomeScreen';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

// Opened on top of a home screen, so going back is observable as the path.
async function setup() {
  const rendered = await renderRouter({ _layout: Layout, index: () => <Text>home</Text>, 'pro-welcome': ProWelcomeScreen });
  await act(async () => router.push('/pro-welcome'));
  return rendered;
}
const done = () => screen.getByRole('button', { name: 'Super!' });
const hidden = { includeHiddenElements: true };
const parts = ['pro-welcome-art', 'pro-welcome-title', 'pro-welcome-body', 'pro-welcome-action'] as const;
const rise = tokens.spacing[4];
const STEP = 150;
const { itemDuration } = tokens.motion.microinteraction.welcomeRevealed;

const look = (testID: (typeof parts)[number]) => {
  const flat = StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style);
  const transform = flat.transform as { translateY: number }[] | undefined;
  return { opacity: flat.opacity as number, translateY: transform?.find((entry) => 'translateY' in entry)?.translateY };
};
const pass = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('ProWelcomeScreen (premium-welcome-screen step 1)', () => {
  it('shows the title as a header, the body and "Super!" (PL), on the canvas', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Witaj w Travelo PRO' })).toBeTruthy();
    expect(screen.getByText('Dziękujemy, że wspierasz Travelo. Twoja subskrypcja jest już aktywna.')).toBeTruthy();
    expect(done()).toBeEnabled();
    expect(screen.getByTestId('pro-welcome-screen')).toHaveStyle({ backgroundColor: lightTheme.background.canvas });
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByRole('header', { name: 'Welcome to Travelo PRO' })).toBeTruthy();
    expect(screen.getByText('Thanks for supporting Travelo. Your subscription is now active.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Great!' })).toBeTruthy();
  });

  it('"Super!" goes back', async () => {
    const rendered = await setup();
    expect(rendered.getPathname()).toBe('/pro-welcome');
    await fireEvent.press(done());
    expect(rendered.getPathname()).toBe('/');
  });

  it('hides the art from screen readers', async () => {
    await setup();
    expect(screen.queryByTestId('pro-welcome-art')).toBeNull();
    expect(screen.getByTestId('pro-welcome-art', hidden).props['aria-hidden']).toBe(true);
  });

  it('scrolls when the text is huge', async () => {
    await setup();
    expect(screen.getByTestId('pro-welcome-content').type).toBe('RCTScrollView');
  });

  describe('entrance', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('with motion: starts invisible and 16dp low, then settles one after another', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await setup();
      for (const part of parts) expect(look(part)).toEqual({ opacity: 0, translateY: rise });
      await pass(3 * STEP + itemDuration + 100);
      for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
    });

    it('with motion: "Super!" works from the first frame, while it is still invisible', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const rendered = await setup();
      expect(look('pro-welcome-action').opacity).toBe(0);
      await fireEvent.press(done());
      expect(rendered.getPathname()).toBe('/');
    });

    it('with reduced motion: everything is in place at once', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await setup();
      for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
    });

    it('when reduce motion cannot be read: everything is in place at once', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no native module'));
      await setup();
      for (const part of parts) expect(look(part)).toEqual({ opacity: 1, translateY: 0 });
    });
  });
});
