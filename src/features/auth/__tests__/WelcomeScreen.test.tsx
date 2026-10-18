import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { StyleSheet, Text } from 'react-native';

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

  it('scrolls when the text is huge, so nothing is cut off at 200 % font size', async () => {
    await setup();
    const scroll = screen.getByTestId('welcome-content');
    expect(scroll.type).toBe('RCTScrollView');
    expect(scroll.props.alwaysBounceVertical).toBe(false);
    expect(isHiddenFromAccessibility(scroll)).toBe(false);
  });
});
