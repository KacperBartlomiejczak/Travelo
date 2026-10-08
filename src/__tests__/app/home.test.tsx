import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import HomeScreen from '@/app/(drawer)/index';
import RootLayout from '@/app/_layout';
import i18n from '@/i18n';
import type { SyncStatus, TripOverview } from '@/schemas';
import { drawerStatus } from '@/test/drawer-status';
import { setNetwork } from '@/test/mock-network';
import { darkTheme, lightTheme } from '@/theme/theme';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

// The light scheme proves the trip view is dark anyway (A4).
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'light' }));

// The style the home screen last gave the status bar.
let mockStatusBarStyle: string | undefined;
jest.mock('expo-status-bar', () => ({
  StatusBar: ({ style }: { style?: string }) => {
    mockStatusBarStyle = style;
    return null;
  },
}));

// The screen reads the current trip through the repository; tests decide what `current` returns.
let mockCurrent: () => Promise<TripOverview | null> = () => Promise.resolve(null);
let mockSyncStatus: SyncStatus = 'synced';
let mockFromCache = false;
const mockSetBudget = jest.fn(async (_trip: { id: string; baseCurrency: string }, _amountMinor: number) => {});
const mockSyncBudgets = jest.fn(async () => ({ nextAttemptAt: null }));
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => ({
    list: async () => [],
    current: async () => {
      const overview = await mockCurrent();
      return overview && { overview, budgetSyncStatus: mockSyncStatus, fromCache: mockFromCache };
    },
    create: () => Promise.reject(new Error('unused')),
    setBudget: (trip: { id: string; baseCurrency: string }, amountMinor: number) => mockSetBudget(trip, amountMinor),
    syncBudgets: () => mockSyncBudgets(),
  }),
}));

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
let nextId = 0;
const id = () => `7c2d9e1f-3a4b-4c5d-8e6f-${String(++nextId).padStart(12, '0')}`;

function segment(direction: 'outbound' | 'return', order: number, from: [string, string, string], to: [string, string, string]) {
  return { id: id(), tripId: TRIP_ID, direction, order, fromIata: from[0], departAt: from[1], departTz: from[2], toIata: to[0], arriveAt: to[1], arriveTz: to[2] };
}

// Warsaw → Dubai → Bangkok and back, Kasia and Ola fly along, 3000 THB per person.
function overview(patch: Partial<TripOverview['trip']> = {}): TripOverview {
  return {
    trip: {
      id: TRIP_ID,
      ownerId: 'local-user',
      name: 'Warsaw → Bangkok',
      destination: 'BKK',
      startDate: '2026-11-03',
      endDate: '2026-11-15',
      baseCurrency: 'THB',
      budgetPerPerson: { amountMinor: 300000, currency: 'THB' },
      createdAt: '2026-10-04T12:00:00.000Z',
      budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
      travellerCount: 3,
      ...patch,
    },
    members: [
      { id: id(), tripId: TRIP_ID, userId: null, displayName: 'Kasia', role: 'viewer', interests: [] },
      { id: id(), tripId: TRIP_ID, userId: null, displayName: 'Ola', role: 'viewer', interests: [] },
    ],
    segments: [
      segment('outbound', 0, ['WAW', '2026-11-02T10:00:00+01:00', 'Europe/Warsaw'], ['DXB', '2026-11-02T18:30:00+04:00', 'Asia/Dubai']),
      segment('outbound', 1, ['DXB', '2026-11-03T03:30:00+04:00', 'Asia/Dubai'], ['BKK', '2026-11-03T12:45:00+07:00', 'Asia/Bangkok']),
      segment('return', 0, ['BKK', '2026-11-15T09:00:00+07:00', 'Asia/Bangkok'], ['WAW', '2026-11-15T17:00:00+01:00', 'Europe/Warsaw']),
    ],
  };
}

function renderHome() {
  return renderRouter({ _layout: RootLayout, '(drawer)/_layout': DrawerLayout, '(drawer)/index': HomeScreen, 'trips/new/index': () => null });
}

const MENU = 'Otwórz listę podróży';

beforeEach(async () => {
  mockCurrent = () => Promise.resolve(null);
  mockSyncStatus = 'synced';
  mockFromCache = false;
  mockSetBudget.mockReset();
  mockSyncBudgets.mockClear();
  mockStatusBarStyle = undefined;
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Home screen — current trip (D4)', () => {
  it('shows the hero skeleton while loading', async () => {
    mockCurrent = () => new Promise(() => {});
    await renderHome();
    const loading = screen.getByTestId('trips-loading');
    // One accessibility element, so VoiceOver reads "Wczytywanie podróży" (the skeleton is hidden).
    expect(loading.props.accessible).toBe(true);
    expect(loading.props.accessibilityLabel).toBe('Wczytywanie podróży');
    expect(loading).toBeBusy();
    expect(screen.getByTestId('trip-hero-skeleton', { includeHiddenElements: true })).toBeTruthy();
    // The skeleton matches the trip view, which has no pinned button any more (trips-drawer A6).
    expect(screen.queryByRole('button', { name: 'Utwórz podróż' })).toBeNull();
  });

  it('opens on the current trip: the hero with its name and dates', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
    expect(within(screen.getByTestId('trip-hero')).getByText('3 lis – 15 lis 2026 · 13 dni')).toBeTruthy();
    expect(screen.queryByText('Nie masz jeszcze żadnej podróży.')).toBeNull();
  });

  it('shows the flights in airport-local time, with the layover', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    const flights = within(await screen.findByTestId('home-flights'));
    expect(flights.getByRole('header', { name: 'Loty' })).toBeTruthy();
    expect(flights.getByText('Lot tam')).toBeTruthy();
    expect(flights.getByText('WAW 2 lis, 10:00 → DXB 2 lis, 18:30')).toBeTruthy();
    expect(flights.getByText('9 godz. przesiadki w DXB')).toBeTruthy();
    expect(flights.getByText('DXB 3 lis, 3:30 → BKK 3 lis, 12:45')).toBeTruthy();
    expect(flights.getByText('Powrót')).toBeTruthy();
    expect(flights.getByText('BKK 15 lis, 9:00 → WAW 15 lis, 17:00')).toBeTruthy();
  });

  it('lists the travellers: you and the friends', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    const people = within(await screen.findByTestId('home-travellers'));
    expect(people.getByRole('header', { name: 'Podróżni · 3 osoby' })).toBeTruthy();
    expect(people.getByText('Ty')).toBeTruthy();
    expect(people.getByText('Kasia')).toBeTruthy();
    expect(people.getByText('Ola')).toBeTruthy();
  });

  it('shows a solo trip as one traveller', async () => {
    mockCurrent = () => Promise.resolve({ ...overview({ travellerCount: 1 }), members: [] });
    await renderHome();
    const people = within(await screen.findByTestId('home-travellers'));
    expect(people.getByRole('header', { name: 'Podróżni · 1 osoba' })).toBeTruthy();
    expect(people.getByText('Ty')).toBeTruthy();
  });

  it('shows the budget per person, the group total and per day', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    const budget = within(await screen.findByTestId('home-budget'));
    expect(budget.getByRole('header', { name: 'Budżet' })).toBeTruthy();
    expect(budget.getByText('3000 THB')).toBeTruthy();
    expect(budget.getByText('na osobę')).toBeTruthy();
    expect(budget.getByText('Razem 9000 THB · ~231 THB dziennie na osobę')).toBeTruthy();
  });

  it('is dark on a light device: ink background and dark-theme cards (A4)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByTestId('home-screen')).toHaveStyle({ backgroundColor: darkTheme.colors.hero.background });
    expect(screen.getByTestId('home-flights')).toHaveStyle({ backgroundColor: darkTheme.colors.surface.secondary });
    expect(screen.getByText('Ty')).toHaveStyle({ color: darkTheme.colors.text.primary });
  });

  it('has no pinned "Utwórz podróż" any more: a new trip starts from the side panel (trips-drawer D4)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');
    expect(screen.queryByRole('button', { name: 'Utwórz podróż' })).toBeNull();
    expect(screen.queryByTestId('home-action')).toBeNull();
  });

  it('uses a light status bar over the hero, and hands it back when another screen opens on top', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');
    expect(mockStatusBarStyle).toBe('light');
    // The home screen stays mounted under the wizard; its status bar must not stay light there.
    await act(async () => router.push('/trips/new'));
    expect(mockStatusBarStyle).toBe('auto');
  });

  it('measures a layover from the stored instants, also in the hour repeated when clocks go back', async () => {
    // Lands in Warsaw at the first 02:30 (CEST), leaves at the second 02:45 (CET): 1 h 15 min, not 15 min.
    const trip = overview();
    trip.segments = [
      segment('outbound', 0, ['LHR', '2026-10-24T23:00:00+01:00', 'Europe/London'], ['WAW', '2026-10-25T02:30:00+02:00', 'Europe/Warsaw']),
      segment('outbound', 1, ['WAW', '2026-10-25T02:45:00+01:00', 'Europe/Warsaw'], ['BKK', '2026-10-25T20:00:00+07:00', 'Asia/Bangkok']),
      segment('return', 0, ['BKK', '2026-11-15T09:00:00+07:00', 'Asia/Bangkok'], ['WAW', '2026-11-15T17:00:00+01:00', 'Europe/Warsaw']),
    ];
    mockCurrent = () => Promise.resolve(trip);
    await renderHome();
    const flights = within(await screen.findByTestId('home-flights'));
    expect(flights.getByText('1 godz. 15 min przesiadki w WAW')).toBeTruthy();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    const flights = within(await screen.findByTestId('home-flights'));
    expect(flights.getByRole('header', { name: 'Flights' })).toBeTruthy();
    expect(within(screen.getByTestId('home-travellers')).getByText('You')).toBeTruthy();
  });

  it('shows and announces an error, with a retry that loads again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    jest.useFakeTimers({ advanceTimers: true });
    let fail = true;
    mockCurrent = () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(overview()));
    await renderHome();
    // TanStack Query retries before giving up.
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(await screen.findByText('Nie udało się wczytać podróży.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Nie udało się wczytać podróży.');
    // The error state keeps its way to create a trip (trips-drawer A6).
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeTruthy();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
  });
});

describe('Home screen — changing the budget (trips-supabase D5, D10–D13)', () => {
  async function openSheet() {
    const budget = within(await screen.findByTestId('home-budget'));
    await fireEvent.press(budget.getByRole('button', { name: 'Zmień budżet' }));
  }

  it('opens a sheet with the current amount per person in the trip\'s currency', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openSheet();
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
    expect(screen.getByText('Na cały wyjazd, bez lotów: noclegi, jedzenie, atrakcje, transport na miejscu.')).toBeTruthy();
    expect(screen.getByLabelText('Kwota na osobę').props.value).toBe('3000');
    expect(within(screen.getByTestId('amount-field-box')).getByText('THB')).toBeTruthy();
  });

  it('asks "Ile chcesz wydać?" on a solo trip', async () => {
    mockCurrent = () => Promise.resolve({ ...overview({ travellerCount: 1 }), members: [] });
    await renderHome();
    await openSheet();
    expect(screen.getByRole('header', { name: 'Ile chcesz wydać?' })).toBeTruthy();
    expect(screen.getByLabelText('Kwota')).toBeTruthy();
  });

  it.each([
    ['0', 'Kwota musi być większa od zera'],
    ['', 'Wpisz kwotę'],
    ['dużo', 'Wpisz kwotę liczbą, np. 2500 lub 2500,50'],
  ])('does not save "%s" and says why', async (typed, message) => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openSheet();
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), typed);
    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz' }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(mockSetBudget).not.toHaveBeenCalled();
  });

  it('saves the new amount on the device, closes, and shows it on the card', async () => {
    let amountMinor = 300000;
    mockCurrent = () => Promise.resolve(overview({ budgetPerPerson: { amountMinor, currency: 'THB' } }));
    mockSetBudget.mockImplementation(async (_trip, next) => {
      amountMinor = next;
      mockSyncStatus = 'pending';
    });
    await renderHome();
    await openSheet();
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500,50');
    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz' }));

    expect(mockSetBudget).toHaveBeenCalledWith(expect.objectContaining({ id: TRIP_ID, baseCurrency: 'THB' }), 250050);
    expect(screen.queryByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeNull();
    const budget = within(screen.getByTestId('home-budget'));
    expect(await budget.findByText('2500,50 THB')).toBeTruthy();
    expect(budget.getByText('Czeka na wysłanie')).toBeTruthy();
    expect(mockSyncBudgets).toHaveBeenCalled();
  });

  it('closes right after saving on the device, without waiting for Supabase (weak connection)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openSheet();
    // From now on reading the trip never answers, like a request hanging on a captive portal.
    mockCurrent = () => new Promise(() => {});
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500');
    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz' }));
    expect(screen.queryByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeNull();
    expect(mockSyncBudgets).toHaveBeenCalled();
  });

  it('keeps the sheet open with an error when saving on the device fails', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    mockCurrent = () => Promise.resolve(overview());
    mockSetBudget.mockRejectedValue(new Error('disk full'));
    await renderHome();
    await openSheet();
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500');
    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByText('Nie udało się zapisać. Spróbuj ponownie.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Nie udało się zapisać. Spróbuj ponownie.');
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
  });

  it('closes without saving from the backdrop', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeNull();
    expect(mockSetBudget).not.toHaveBeenCalled();
  });

  it('shows a waiting change on the card', async () => {
    mockSyncStatus = 'pending';
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    expect(within(await screen.findByTestId('home-budget')).getByText('Czeka na wysłanie')).toBeTruthy();
  });

  it('shows a failed change with a retry that sends it again', async () => {
    mockSyncStatus = 'failed';
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    const budget = within(await screen.findByTestId('home-budget'));
    expect(budget.getByText('Nie udało się wysłać')).toBeTruthy();
    mockSyncBudgets.mockClear();
    await fireEvent.press(budget.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(mockSyncBudgets).toHaveBeenCalled();
  });

  it('shows nothing extra once the budget is synced', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    const budget = within(await screen.findByTestId('home-budget'));
    expect(budget.queryByText('Czeka na wysłanie')).toBeNull();
    expect(budget.queryByText('Nie udało się wysłać')).toBeNull();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    const budget = within(await screen.findByTestId('home-budget'));
    await fireEvent.press(budget.getByRole('button', { name: 'Change budget' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});

describe('Home screen — offline (D6, D11)', () => {
  it('shows the trip from the device copy with the offline banner pinned at the bottom', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    mockFromCache = true;
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
    const action = within(screen.getByTestId('home-action'));
    expect(action.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Utwórz podróż' })).toBeNull();
  });

  it('keeps the offline banner in the centred content column (tablets, §18)', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByTestId('home-action')).toHaveStyle({ maxWidth: lightTheme.size.maxContentWidth, alignSelf: 'center' });
  });

  it('still lets the budget be changed offline', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await fireEvent.press(within(await screen.findByTestId('home-budget')).getByRole('button', { name: 'Zmień budżet' }));
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500');
    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz' }));
    expect(mockSetBudget).toHaveBeenCalledWith(expect.objectContaining({ id: TRIP_ID }), 250000);
  });

  it('shows the banner on the empty screen too', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    await renderHome();
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
  });

  it('shows the banner on the error screen (offline, no copy on the device)', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    setNetwork({ isConnected: false, isInternetReachable: false });
    mockCurrent = () => Promise.reject(new Error('Network request failed'));
    await renderHome();
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(await screen.findByText('Nie udało się wczytać podróży.')).toBeTruthy();
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
  });

  it('has no banner online', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});

describe('Home screen — menu button (trips-drawer P5)', () => {
  // Returns the router handle in an object: renderRouter puts getRouterState on its promise, and an async
  // function returning that promise would unwrap it.
  async function failToLoad() {
    jest.useFakeTimers({ advanceTimers: true });
    mockCurrent = () => Promise.reject(new Error('offline'));
    const rendered = renderHome();
    await rendered;
    // TanStack Query retries before giving up.
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    await screen.findByText('Nie udało się wczytać podróży.');
    return { rendered };
  }

  async function showState(state: 'loading' | 'empty' | 'error' | 'trip') {
    if (state === 'error') return failToLoad();
    mockCurrent = state === 'loading' ? () => new Promise(() => {}) : () => Promise.resolve(state === 'trip' ? overview() : null);
    const rendered = renderHome();
    await rendered;
    if (state === 'empty') await screen.findByText('Nie masz jeszcze żadnej podróży.');
    if (state === 'trip') await screen.findByTestId('home-screen');
    return { rendered };
  }

  it.each(['loading', 'empty', 'error', 'trip'] as const)('opens the side panel from the %s state', async (state) => {
    const { rendered } = await showState(state);
    expect(drawerStatus(rendered)).toBe('closed');
    await fireEvent.press(screen.getByRole('button', { name: MENU }));
    expect(drawerStatus(rendered)).toBe('open');
  });

  it('stays pinned over the photo: it does not scroll away with the trip', async () => {
    await showState('trip');
    expect(screen.getByRole('button', { name: MENU })).toHaveStyle({ backgroundColor: lightTheme.colors.hero.control });
    expect(within(screen.getByTestId('home-scroll')).queryByRole('button', { name: MENU })).toBeNull();
  });

  it('is there over the skeleton while the trip loads (§10.18)', async () => {
    await showState('loading');
    expect(screen.getByRole('button', { name: MENU })).toHaveStyle({ backgroundColor: lightTheme.colors.hero.control });
  });

  it('comes first for screen readers, before the trip (§15 focus order: navigation first)', async () => {
    await showState('trip');
    const labels = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(labels[0]).toBe(MENU);
    expect(labels).toContain('Zmień budżet');
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await showState('trip');
    expect(screen.getByRole('button', { name: 'Open trips list' })).toBeTruthy();
  });
});

describe('Home screen — no trips (trips-drawer D5)', () => {
  it('shows the empty state with the menu and "Utwórz podróż", never a blank screen', async () => {
    await renderHome();
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.getByText('Zaplanuj pierwszą i zaproś znajomych.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeTruthy();
    expect(screen.getByRole('button', { name: MENU })).toBeTruthy();
  });

  it('shows the empty state when the last trip disappears from the server', async () => {
    let foreground: (state: AppStateStatus) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
      foreground = listener;
      return { remove: jest.fn() } as never;
    });
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');

    // Deleted on another phone; the app comes back to the foreground and reads the trips again.
    mockCurrent = () => Promise.resolve(null);
    await act(async () => foreground('active'));

    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    expect(screen.getByRole('button', { name: MENU })).toBeTruthy();
  });
});
