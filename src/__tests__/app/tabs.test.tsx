import { useFonts } from 'expo-font';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

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

const ROUTES = {
  _layout: RootLayout,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': HomeScreen,
  '(drawer)/(tabs)/expenses': ExpensesScreen,
  '(drawer)/(tabs)/places': PlacesScreen,
  '(drawer)/(tabs)/plan': PlanScreen,
  '(drawer)/(tabs)/settings': SettingsScreen,
  'trips/new/index': () => <Text>wizard</Text>,
  'trips/[tripId]/photos': () => <Text>photo viewer</Text>,
};

const PL = { index: 'Podróż', expenses: 'Wydatki', places: 'Miejsca', plan: 'Plan', settings: 'Ustawienia' };
const EN = { index: 'Trip', expenses: 'Expenses', places: 'Places', plan: 'Plan', settings: 'Settings' };
const PATHS = { index: '/', expenses: '/expenses', places: '/places', plan: '/plan', settings: '/settings' };
const EMPTY = ['expenses', 'places', 'plan', 'settings'] as const;
const SOON_PL = 'Ten ekran pojawi się wkrótce.';

const pill = () => screen.queryByTestId('pill-nav');
const tab = (name: string) => screen.getByRole('button', { name });

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('Pill navigation routes (pill-nav-and-dialog step 4)', () => {
  it('opens on the home screen at "/" with the pill and "Podróż" selected', async () => {
    const app = renderRouter(ROUTES);
    await app;
    expect(app.getPathname()).toBe('/');
    expect(await screen.findByTestId('trips-screen')).toBeTruthy();
    expect(pill()).toBeTruthy();
    expect(tab(PL.index)).toBeSelected();
    EMPTY.forEach((key) => expect(tab(PL[key])).not.toBeSelected());
  });

  describe.each(EMPTY)('%s', (key) => {
    it('shows its title and the "coming soon" sentence in Polish, with the pill', async () => {
      const app = renderRouter(ROUTES, { initialUrl: PATHS[key] });
      await app;
      expect(app.getPathname()).toBe(PATHS[key]);
      expect(screen.getByRole('header', { name: PL[key] })).toBeTruthy();
      expect(screen.getByText(SOON_PL)).toBeTruthy();
      expect(pill()).toBeTruthy();
      expect(tab(PL[key])).toBeSelected();
    });
  });

  it('shows the English title and sentence', async () => {
    await i18n.changeLanguage('en');
    await renderRouter(ROUTES, { initialUrl: '/places' });
    expect(screen.getByRole('header', { name: EN.places })).toBeTruthy();
    expect(screen.getByText('This screen is coming soon.')).toBeTruthy();
    expect(tab(EN.places)).toBeSelected();
  });

  it('navigates to each screen by tapping its pill item and marks it selected', async () => {
    const app = renderRouter(ROUTES);
    await app;
    await screen.findByTestId('trips-screen');
    for (const key of EMPTY) {
      await fireEvent.press(tab(PL[key]));
      await waitFor(() => expect(app.getPathname()).toBe(PATHS[key]));
      expect(screen.getByRole('header', { name: PL[key] })).toBeTruthy();
      expect(tab(PL[key])).toBeSelected();
      (Object.keys(PL) as (keyof typeof PL)[])
        .filter((other) => other !== key)
        .forEach((other) => expect(tab(PL[other])).not.toBeSelected());
    }
  });

  it('returns to the home screen at "/" when the home item is pressed', async () => {
    const app = renderRouter(ROUTES, { initialUrl: '/settings' });
    await app;
    await fireEvent.press(tab(PL.index));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await screen.findByTestId('trips-screen')).toBeTruthy();
    expect(tab(PL.index)).toBeSelected();
  });

  it('has no pill in the new-trip wizard', async () => {
    const app = renderRouter(ROUTES, { initialUrl: '/trips/new' });
    await app;
    expect(screen.getByText('wizard')).toBeTruthy();
    expect(pill()).toBeNull();
  });

  it('has no pill in the photo viewer', async () => {
    const app = renderRouter(ROUTES, { initialUrl: '/trips/0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01/photos' });
    await app;
    expect(screen.getByText('photo viewer')).toBeTruthy();
    expect(pill()).toBeNull();
  });
});
