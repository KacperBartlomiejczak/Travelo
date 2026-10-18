import { useFonts } from 'expo-font';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import ExpensesScreen from '@/app/(drawer)/(tabs)/expenses';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import PlacesScreen from '@/app/(drawer)/(tabs)/places';
import PlanScreen from '@/app/(drawer)/(tabs)/plan';
import SettingsScreen from '@/app/(drawer)/(tabs)/settings';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import i18n from '@/i18n';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// The real Drawer, wrapped only to see which options the layout gave it: the edge swipe itself needs a device.
let mockSwipeEnabled: unknown;
jest.mock('expo-router/drawer', () => {
  const actual = jest.requireActual('expo-router/drawer');
  const RealDrawer = actual.Drawer;
  return {
    ...actual,
    Drawer: (props: { screenOptions?: { swipeEnabled?: boolean } }) => {
      mockSwipeEnabled = props.screenOptions?.swipeEnabled;
      return <RealDrawer {...props} />;
    },
  };
});

const ROUTES = {
  _layout: RootLayout,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': HomeScreen,
  '(drawer)/(tabs)/expenses': ExpensesScreen,
  '(drawer)/(tabs)/places': PlacesScreen,
  '(drawer)/(tabs)/plan': PlanScreen,
  '(drawer)/(tabs)/settings': SettingsScreen,
  'trips/new/index': () => null,
};

beforeEach(async () => {
  mockSwipeEnabled = undefined;
  await i18n.changeLanguage('pl');
});

describe('Side panel only on the home screen (pill-nav-and-dialog R3)', () => {
  it('lets the edge swipe open the panel on "/"', async () => {
    const app = renderRouter(ROUTES);
    await app;
    expect(app.getPathname()).toBe('/');
    expect(mockSwipeEnabled).toBe(true);
  });

  it.each(['/expenses', '/places', '/plan', '/settings'])('turns the edge swipe off on %s', async (path) => {
    const app = renderRouter(ROUTES, { initialUrl: path });
    await app;
    expect(app.getPathname()).toBe(path);
    expect(mockSwipeEnabled).toBe(false);
  });

  it('follows the pill: off after leaving the home screen, on again after coming back', async () => {
    const app = renderRouter(ROUTES);
    await app;
    await screen.findByTestId('trips-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Wydatki' }));
    await waitFor(() => expect(app.getPathname()).toBe('/expenses'));
    expect(mockSwipeEnabled).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Podróż' }));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(mockSwipeEnabled).toBe(true);
  });
});
