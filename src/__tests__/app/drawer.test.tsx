import { useFonts } from 'expo-font';
import { act, fireEvent, isHiddenFromAccessibility, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import DrawerLayout from '@/app/(drawer)/_layout';
import HomeScreen from '@/app/(drawer)/index';
import RootLayout from '@/app/_layout';
import i18n from '@/i18n';
import type { CurrentTrip, TripListItem } from '@/schemas';
import { drawerStatus } from '@/test/drawer-status';
import { darkTheme, lightTheme } from '@/theme/theme';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

let mockScheme: 'light' | 'dark' = 'light';
let mockWindowWidth = 375;
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 812, scale: 2, fontScale: 1 }),
}));

let mockStatusBarStyle: string | undefined;
jest.mock('expo-status-bar', () => ({
  StatusBar: ({ style }: { style?: string }) => {
    mockStatusBarStyle = style;
    return null;
  },
}));

const ROME: TripListItem = { id: '00000000-0000-4000-8000-0000000000a3', name: 'Rzym', startDate: '2026-10-05', endDate: '2026-10-12' };
const OSLO: TripListItem = { id: '00000000-0000-4000-8000-0000000000a2', name: 'Oslo', startDate: '2026-08-10', endDate: '2026-08-14' };

function mockCurrentTrip(item: TripListItem): CurrentTrip {
  return {
    overview: {
      trip: {
        ...item,
        ownerId: 'local-user',
        destination: 'FCO',
        baseCurrency: 'EUR',
        budgetPerPerson: { amountMinor: 100000, currency: 'EUR' },
        createdAt: '2026-10-01T12:00:00.000Z',
        budgetUpdatedAt: '2026-10-01T12:00:00.000Z',
        travellerCount: 1,
      },
      members: [],
      segments: [],
    },
    budgetSyncStatus: 'synced',
    fromCache: false,
  };
}

// Two trips, Rome is open. Reading the chosen trip waits while `mockHold` is set, to see the screen in between.
let mockChosen = ROME;
let mockHold = false;
let mockRelease = () => {};
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => ({
    list: async () => [OSLO, ROME],
    current: async () => {
      if (mockHold) await new Promise<void>((resolve) => (mockRelease = resolve));
      return mockCurrentTrip(mockChosen);
    },
    select: async (tripId: string) => {
      mockChosen = [OSLO, ROME].find((trip) => trip.id === tripId) ?? mockChosen;
    },
    create: () => Promise.reject(new Error('unused')),
    setBudget: async () => {},
    syncBudgets: async () => ({ nextAttemptAt: null }),
  }),
}));

function renderApp() {
  return renderRouter({ _layout: RootLayout, '(drawer)/_layout': DrawerLayout, '(drawer)/index': HomeScreen, 'trips/new/index': () => null });
}

async function openPanel() {
  const rendered = renderApp();
  await rendered;
  await screen.findByRole('header', { name: 'Rzym' });
  await fireEvent.press(screen.getByRole('button', { name: 'Otwórz listę podróży' }));
  await screen.findByRole('button', { name: 'Oslo, 10 sie – 14 sie 2026' });
  return { rendered };
}

/** The panel's own view: the drawer library's styled container around the panel content. */
function panel() {
  let node = screen.getByTestId('drawer-panel').parent;
  while (node && node.props.style === undefined) node = node.parent;
  return node;
}

beforeEach(async () => {
  mockChosen = ROME;
  mockHold = false;
  mockScheme = 'light';
  mockWindowWidth = 375;
  mockStatusBarStyle = undefined;
  await i18n.changeLanguage('pl');
});

describe('Side panel on the home screen (trips-drawer D2, D4)', () => {
  it('opening another trip closes the panel, shows the skeleton, then that trip — never the previous one', async () => {
    const { rendered } = await openPanel();
    mockHold = true;

    await fireEvent.press(screen.getByRole('button', { name: 'Oslo, 10 sie – 14 sie 2026' }));

    expect(drawerStatus(rendered)).toBe('closed');
    expect(await screen.findByTestId('trips-loading')).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Rzym' })).toBeNull();
    await act(async () => mockRelease());
    expect(await screen.findByRole('header', { name: 'Oslo' })).toBeTruthy();
  });

  it('"Nowa podróż" closes the panel and opens the wizard', async () => {
    const { rendered } = await openPanel();
    await fireEvent.press(screen.getByRole('button', { name: 'Nowa podróż' }));
    expect(rendered.getPathname()).toBe('/trips/new');
    await waitFor(() => expect(drawerStatus(rendered)).toBe('closed'));
  });

  it('closes from the scrim, labelled "Zamknij"', async () => {
    const { rendered } = await openPanel();
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    expect(drawerStatus(rendered)).toBe('closed');
  });

  it('is hidden from screen readers while closed, and reachable once open', async () => {
    await renderApp();
    await screen.findByRole('header', { name: 'Rzym' });
    expect(isHiddenFromAccessibility(screen.getByTestId('trips-drawer', { includeHiddenElements: true }))).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Otwórz listę podróży' }));
    expect(isHiddenFromAccessibility(screen.getByTestId('trips-drawer'))).toBe(false);
  });

  it('marks the open trip', async () => {
    await openPanel();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rzym, 5 paź – 12 paź 2026' })).toBeSelected());
  });
});

describe('Side panel look (trips-drawer P1, A7)', () => {
  it('is 85 % of a narrow screen, on the elevated surface, with 24dp right corners', async () => {
    mockWindowWidth = 320;
    await openPanel();
    expect(panel()).toHaveStyle({
      width: 272,
      backgroundColor: lightTheme.colors.surface.elevated,
      borderTopRightRadius: lightTheme.radius.xl,
      borderBottomRightRadius: lightTheme.radius.xl,
    });
  });

  it('is at most 360dp wide on a wide screen', async () => {
    mockWindowWidth = 768;
    await openPanel();
    expect(panel()).toHaveStyle({ width: lightTheme.size.drawerMaxWidth });
  });

  it('follows the system theme, while the trip view behind it stays dark', async () => {
    mockScheme = 'dark';
    await openPanel();
    expect(panel()).toHaveStyle({ backgroundColor: darkTheme.colors.surface.elevated });
    expect(within(screen.getByTestId('trips-drawer')).getByRole('header', { name: 'Twoje podróże' })).toHaveStyle({ color: darkTheme.colors.text.primary });
  });

  it('hands the status bar back to the system theme while the panel is open over the photo', async () => {
    await renderApp();
    await screen.findByRole('header', { name: 'Rzym' });
    expect(mockStatusBarStyle).toBe('light');
    await fireEvent.press(screen.getByRole('button', { name: 'Otwórz listę podróży' }));
    expect(mockStatusBarStyle).toBe('auto');
  });
});
