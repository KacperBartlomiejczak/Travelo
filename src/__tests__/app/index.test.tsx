import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import DrawerLayout from '@/app/(drawer)/_layout';
import HomeScreen from '@/app/(drawer)/index';
import RootLayout from '@/app/_layout';
import FlightsStep from '@/app/trips/new/index';
import NewTripLayout from '@/app/trips/new/_layout';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';

let mockScheme: 'light' | 'dark' | null = 'light';
let mockWindowWidth = 375;

// useColorScheme reads Appearance through an internal import, so it is mocked at its module path.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme,
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: 1 }),
}));
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

// Waits until the trips have loaded (the screen shows a loading state first); the promise still
// carries getPathname from renderRouter.
function renderTrips() {
  const rendered = renderRouter({
    _layout: RootLayout,
    '(drawer)/_layout': DrawerLayout,
    '(drawer)/index': HomeScreen,
    'trips/new/_layout': NewTripLayout,
    'trips/new/index': FlightsStep,
  });
  const loaded = rendered.then(async (result) => {
    await waitFor(() => expect(screen.queryByTestId('trips-loading')).toBeNull());
    return result;
  });
  return Object.assign(loaded, { getPathname: () => rendered.getPathname() });
}

beforeEach(async () => {
  mockScheme = 'light';
  mockWindowWidth = 375;
  await i18n.changeLanguage('pl');
});

describe('Trips screen — empty state', () => {
  it('shows the Polish title, empty-state copy and create button', async () => {
    await renderTrips();
    expect(screen.getByRole('header', { name: 'Twoje podróże' })).toBeTruthy();
    expect(screen.getByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.getByText('Zaplanuj pierwszą i zaproś znajomych.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeTruthy();
  });

  it('shows the English copy', async () => {
    await i18n.changeLanguage('en');
    await renderTrips();
    expect(screen.getByRole('header', { name: 'Your trips' })).toBeTruthy();
    expect(screen.getByText("You don't have any trips yet.")).toBeTruthy();
    expect(screen.getByText('Plan your first one and invite your friends.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create trip' })).toBeTruthy();
  });

  it('has exactly one action, next to the menu button by the title (§10.19, trips-drawer P5)', async () => {
    await renderTrips();
    // Within the screen: the side panel's scrim sits beside it (hidden on a device while the panel is closed).
    const buttons = within(screen.getByTestId('trips-screen')).getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(buttons).toEqual(['Otwórz listę podróży', 'Utwórz podróż']);
  });

  it('opens the new trip screen when the button is pressed', async () => {
    // renderRouter attaches getPathname to the returned promise, not to the awaited result.
    const rendered = renderTrips();
    await rendered;
    expect(rendered.getPathname()).toBe('/');
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    expect(rendered.getPathname()).toBe('/trips/new');
  });

  it('hides the decorative illustration from screen readers', async () => {
    await renderTrips();
    const illustration = screen.getByTestId('trips-empty-illustration', { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(illustration)).toBe(true);
    // aria-hidden must sit on a React Native View: View.js turns it into the props iOS and Android read
    // (accessibilityElementsHidden / importantForAccessibility). On Svg it never reaches native.
    // Jest mocks View, so that conversion itself can't be observed here.
    expect(illustration.type).toBe('View');
    expect(illustration.props['aria-hidden']).toBe(true);
    const drawing = screen.getByTestId('trips-empty-illustration-svg', { includeHiddenElements: true });
    expect(drawing.props.width).toBe(lightTheme.size.illustration);
  });

  it('uses the light background token in light mode', async () => {
    await renderTrips();
    expect(screen.getByTestId('trips-screen')).toHaveStyle({ backgroundColor: lightTheme.colors.background });
  });

  it('uses the dark background token in dark mode', async () => {
    mockScheme = 'dark';
    await renderTrips();
    expect(screen.getByTestId('trips-screen')).toHaveStyle({ backgroundColor: darkTheme.colors.background });
  });

  it('uses the standard 20dp side padding on standard phones', async () => {
    await renderTrips();
    expect(screen.getByTestId('trips-screen')).toHaveStyle({ paddingHorizontal: lightTheme.spacing[5] });
  });

  it('reduces the side padding to 16dp on compact screens (§18)', async () => {
    mockWindowWidth = 320;
    await renderTrips();
    expect(screen.getByTestId('trips-screen')).toHaveStyle({ paddingHorizontal: lightTheme.spacing[4] });
  });
});
