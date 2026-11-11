import { useFonts } from 'expo-font';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import ExpensesScreen from '@/app/(drawer)/(tabs)/expenses';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import PlanScreen from '@/app/(drawer)/(tabs)/plan';
import ProfileScreen from '@/app/(drawer)/(tabs)/profile';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import i18n from '@/i18n';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

jest.mock('expo-status-bar', () => ({ ...jest.requireActual('expo-status-bar'), StatusBar: () => null }));
jest.mock('@/data/app-places', () => ({ fetchAppPlaceRecommendations: jest.fn() })); // the Plan tab now hosts Discover

const ROUTES = {
  _layout: RootLayout,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/(tabs)/_layout': TabsLayout,
  '(drawer)/(tabs)/index': HomeScreen,
  '(drawer)/(tabs)/expenses': ExpensesScreen,
  '(drawer)/(tabs)/plan': PlanScreen,
  '(drawer)/(tabs)/profile': ProfileScreen,
  'trips/new/index': () => <Text>wizard</Text>,
  'trips/[tripId]/photos': () => <Text>photo viewer</Text>,
};

const PL = { index: 'Podróż', expenses: 'Wydatki', plan: 'Plan', profile: 'Profil' };
const EN = { index: 'Trip', expenses: 'Expenses', plan: 'Plan', profile: 'Profile' };
const PATHS = { index: '/', expenses: '/expenses', plan: '/plan', profile: '/profile' };
// Screens that are still placeholders; the profile and expenses screens have their own tests.
const EMPTY = ['plan'] as const;
const SCREENS = ['expenses', ...EMPTY, 'profile'] as const;
const SOON_PL = 'Ten ekran pojawi się wkrótce.';

const pill = () => screen.queryByTestId('pill-nav');
const tab = (name: string) => screen.getByRole('button', { name });

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('Pill navigation routes (pill-nav-and-dialog step 4)', () => {
  it('opens on the home screen at "/" with the pill and "Podróż" selected', async () => {
    const app = await renderRouter(ROUTES);
    expect(app.getPathname()).toBe('/');
    expect(await screen.findByTestId('trips-screen')).toBeTruthy();
    expect(pill()).toBeTruthy();
    expect(tab(PL.index)).toBeSelected();
    EMPTY.forEach((key) => expect(tab(PL[key])).not.toBeSelected());
  });

  describe.each(EMPTY)('%s', (key) => {
    it('shows its title and the "coming soon" sentence in Polish, with the pill', async () => {
      const app = await renderRouter(ROUTES, { initialUrl: PATHS[key] });
      expect(app.getPathname()).toBe(PATHS[key]);
      expect(screen.getByRole('header', { name: PL[key] })).toBeTruthy();
      expect(screen.getByText(SOON_PL)).toBeTruthy();
      expect(pill()).toBeTruthy();
      expect(tab(PL[key])).toBeSelected();
    });
  });

  it('has exactly four tab buttons and no "Miejsca" / "Places" button', async () => {
    await renderRouter(ROUTES);
    expect(Object.values(PL).map((name) => screen.getAllByRole('button', { name }).length)).toEqual([1, 1, 1, 1]);
    expect(screen.queryByRole('button', { name: 'Miejsca' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Places' })).toBeNull();
  });

  it('shows the English title and sentence', async () => {
    await i18n.changeLanguage('en');
    await renderRouter(ROUTES, { initialUrl: '/plan' });
    expect(screen.getByRole('header', { name: EN.plan })).toBeTruthy();
    expect(screen.getByText('This screen is coming soon.')).toBeTruthy();
    expect(tab(EN.plan)).toBeSelected();
  });

  it('shows the real profile screen at "/profile", not a placeholder', async () => {
    await renderRouter(ROUTES, { initialUrl: '/profile' });
    expect(screen.getByRole('header', { name: PL.profile })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeTruthy();
    expect(screen.queryByText(SOON_PL)).toBeNull();
    expect(screen.queryByText('Profil użytkownika')).toBeNull();
    expect(pill()).toBeTruthy();
    expect(tab(PL.profile)).toBeSelected();
  });

  it('shows the English profile label in the pill and the English profile title', async () => {
    await i18n.changeLanguage('en');
    await renderRouter(ROUTES, { initialUrl: '/profile' });
    expect(screen.getByRole('header', { name: EN.profile })).toBeTruthy();
    expect(screen.queryByText('This screen is coming soon.')).toBeNull();
    expect(screen.queryByText('User profile')).toBeNull();
    expect(tab(EN.profile)).toBeSelected();
  });

  it('has no "/settings" route any more: the profile screen is not shown there', async () => {
    await renderRouter(ROUTES, { initialUrl: '/settings' });
    expect(screen.queryByRole('header', { name: PL.profile })).toBeNull();
    expect(screen.queryByText(SOON_PL)).toBeNull();
    expect(screen.queryByRole('button', { name: PL.profile, selected: true })).toBeNull();
  });

  it('navigates to each screen by tapping its pill item and marks it selected', async () => {
    const app = await renderRouter(ROUTES);
    await screen.findByTestId('trips-screen');
    for (const key of SCREENS) {
      await fireEvent.press(tab(PL[key]));
      await waitFor(() => expect(app.getPathname()).toBe(PATHS[key]));
      // The expenses screen's header is the trip name, not the tab name: it is recognised by its own root.
      if (key === 'expenses') expect(screen.getByTestId('expenses-screen')).toBeTruthy();
      else expect(screen.getByRole('header', { name: PL[key] })).toBeTruthy();
      expect(tab(PL[key])).toBeSelected();
      (Object.keys(PL) as (keyof typeof PL)[])
        .filter((other) => other !== key)
        .forEach((other) => expect(tab(PL[other])).not.toBeSelected());
    }
  });

  it('returns to the home screen at "/" when the home item is pressed', async () => {
    const app = await renderRouter(ROUTES, { initialUrl: '/profile' });
    await fireEvent.press(tab(PL.index));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await screen.findByTestId('trips-screen')).toBeTruthy();
    expect(tab(PL.index)).toBeSelected();
  });

  it('has no pill in the new-trip wizard', async () => {
    await renderRouter(ROUTES, { initialUrl: '/trips/new' });
    expect(screen.getByText('wizard')).toBeTruthy();
    expect(pill()).toBeNull();
  });

  it('has no pill in the photo viewer', async () => {
    await renderRouter(ROUTES, { initialUrl: '/trips/0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01/photos' });
    expect(screen.getByText('photo viewer')).toBeTruthy();
    expect(pill()).toBeNull();
  });
});
