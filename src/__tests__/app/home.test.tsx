import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, AppState, StyleSheet, type AppStateStatus } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import HomeScreen from '@/app/(drawer)/index';
import RootLayout from '@/app/_layout';
import i18n from '@/i18n';
import type { SyncStatus, TripOverview, TripPhotoList } from '@/schemas';
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
const mockUpdateDetails = jest.fn(async (_tripId: string, _input: { name: string; coverImageUri?: string }) => {});
const mockDelete = jest.fn(async (_tripId: string) => {});
// The trip's photos (trip-photos): none unless a test says otherwise.
let mockPhotos: (tripId: string) => Promise<TripPhotoList> = () => Promise.resolve([]);
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
    updateDetails: (tripId: string, input: { name: string; coverImageUri?: string }) => mockUpdateDetails(tripId, input),
    delete: (tripId: string) => mockDelete(tripId),
    photos: (tripId: string) => mockPhotos(tripId),
    addPhoto: () => Promise.reject(new Error('unused')),
    deletePhoto: () => Promise.reject(new Error('unused')),
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
  mockPhotos = () => Promise.resolve([]);
  mockSetBudget.mockReset();
  mockSyncBudgets.mockClear();
  mockUpdateDetails.mockReset();
  mockDelete.mockReset();
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
    // The sheet's backdrop; the side panel's scrim has the same label (hidden on a device while the panel is closed).
    await fireEvent.press(within(screen.getByTestId('bottom-sheet-modal')).getByRole('button', { name: 'Zamknij' }));
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

describe('Home screen — trip menu ⋮ (trip-edit-menu D3, D4, D6, D8, D15)', () => {
  const OPEN = 'Opcje podróży';
  const sheet = () => within(screen.getByTestId('bottom-sheet'));

  async function openMenu() {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');
    await fireEvent.press(screen.getByRole('button', { name: OPEN }));
  }

  it('shows the button on the trip view, pinned top right like the side panel button, second for screen readers', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');
    expect(screen.getByRole('button', { name: OPEN })).toHaveStyle({ backgroundColor: lightTheme.colors.hero.control });
    expect(within(screen.getByTestId('home-scroll')).queryByRole('button', { name: OPEN })).toBeNull();
    // The mirror image of ☰ (D4): same top, the same side inset, but on the right.
    const menu = screen.getByRole('button', { name: MENU }).parent;
    const options = screen.getByRole('button', { name: OPEN }).parent;
    expect(options).toHaveStyle({ position: 'absolute', right: lightTheme.spacing[5] });
    expect(menu).toHaveStyle({ position: 'absolute', left: lightTheme.spacing[5] });
    expect(StyleSheet.flatten(options?.props.style).top).toBe(StyleSheet.flatten(menu?.props.style).top);
    expect(StyleSheet.flatten(options?.props.style).top).toBeGreaterThanOrEqual(lightTheme.spacing[2]);
    expect(StyleSheet.flatten(options?.props.style).left).toBeUndefined();
    const labels = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(labels.slice(0, 2)).toEqual([MENU, OPEN]);
  });

  it.each(['loading', 'empty', 'error'] as const)('has no button in the %s state (A1)', async (state) => {
    if (state === 'error') {
      jest.useFakeTimers({ advanceTimers: true });
      mockCurrent = () => Promise.reject(new Error('offline'));
      await renderHome();
      await act(async () => {
        await jest.runAllTimersAsync();
      });
      await screen.findByText('Nie udało się wczytać podróży.');
    } else {
      mockCurrent = state === 'loading' ? () => new Promise(() => {}) : () => Promise.resolve(null);
      await renderHome();
      if (state === 'empty') await screen.findByText('Nie masz jeszcze żadnej podróży.');
    }
    expect(screen.queryByRole('button', { name: OPEN })).toBeNull();
  });

  it('opens a sheet with name and photo, budget and delete, and nothing about trip photos (D6)', async () => {
    await openMenu();
    expect(screen.getByRole('header', { name: 'Podróż' })).toBeTruthy();
    expect(sheet().getByRole('button', { name: 'Nazwa i zdjęcie' })).toBeTruthy();
    expect(sheet().getByRole('button', { name: 'Zmień budżet' })).toBeTruthy();
    expect(sheet().getByRole('button', { name: 'Usuń podróż' })).toBeTruthy();
    expect(screen.queryByText(/zdjęcia podróży/i)).toBeNull();
  });

  it('closes from the backdrop', async () => {
    await openMenu();
    await fireEvent.press(within(screen.getByTestId('bottom-sheet-modal')).getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByRole('header', { name: 'Podróż' })).toBeNull();
  });

  it('"Zmień budżet" closes the menu and opens the budget sheet (A6)', async () => {
    await openMenu();
    await fireEvent.press(sheet().getByRole('button', { name: 'Zmień budżet' }));
    expect(screen.queryByRole('header', { name: 'Podróż' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
    expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);
  });

  it('keeps the budget section\'s own button working (A7)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await fireEvent.press(within(await screen.findByTestId('home-budget')).getByRole('button', { name: 'Zmień budżet' }));
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Podróż' })).toBeNull();
  });

  // Step 7 replaced the interim "Usuń podróż closes the menu (its sheet comes in a later step)" (step 5, kept by step 6):
  // the plan gives the delete row its confirmation sheet (D7); the whole flow is in "deleting the trip" below.
  it('online: "Usuń podróż" closes the menu and opens the confirmation (D7)', async () => {
    await openMenu();
    await fireEvent.press(sheet().getByRole('button', { name: 'Usuń podróż' }));
    expect(screen.queryByRole('header', { name: 'Podróż' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Usunąć podróż „Warsaw → Bangkok”?' })).toBeTruthy();
    expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);
  });

  it('online: "Nazwa i zdjęcie" closes the menu and opens the details sheet with the current name (step 6)', async () => {
    await openMenu();
    await fireEvent.press(sheet().getByRole('button', { name: 'Nazwa i zdjęcie' }));
    expect(screen.queryByRole('header', { name: 'Podróż' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Nazwa i zdjęcie' })).toBeTruthy();
    expect(screen.getAllByTestId('bottom-sheet')).toHaveLength(1);
    expect(screen.getByLabelText('Nazwa podróży').props.value).toBe('Warsaw → Bangkok');
  });

  it('saving a new name closes the details sheet and the hero shows it (step 6)', async () => {
    let name = 'Warsaw → Bangkok';
    mockCurrent = () => Promise.resolve(overview({ name }));
    mockUpdateDetails.mockImplementation(async (_tripId, input) => {
      name = input.name;
    });
    await renderHome();
    await screen.findByTestId('home-screen');
    await fireEvent.press(screen.getByRole('button', { name: OPEN }));
    await fireEvent.press(sheet().getByRole('button', { name: 'Nazwa i zdjęcie' }));
    await fireEvent.changeText(screen.getByLabelText('Nazwa podróży'), '  Bangkok z Kasią ');
    await fireEvent.press(sheet().getByRole('button', { name: 'Zapisz' }));

    expect(mockUpdateDetails).toHaveBeenCalledWith(TRIP_ID, { name: 'Bangkok z Kasią' });
    expect(await screen.findByRole('header', { name: 'Bangkok z Kasią' })).toBeTruthy();
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('online: no offline hint', async () => {
    await openMenu();
    expect(screen.queryByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeNull();
    expect(sheet().getByRole('button', { name: 'Nazwa i zdjęcie' })).toBeEnabled();
    expect(sheet().getByRole('button', { name: 'Usuń podróż' })).toBeEnabled();
  });

  it('offline: name and delete are disabled with the hint, budget stays enabled and opens its sheet (D5, D8)', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    await openMenu();
    expect(sheet().getByRole('button', { name: 'Nazwa i zdjęcie' })).toBeDisabled();
    expect(sheet().getByRole('button', { name: 'Usuń podróż' })).toBeDisabled();
    expect(screen.getByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeTruthy();
    expect(sheet().getByRole('button', { name: 'Zmień budżet' })).toBeEnabled();
    await fireEvent.press(sheet().getByRole('button', { name: 'Zmień budżet' }));
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Trip options' }));
    expect(screen.getByRole('header', { name: 'Trip' })).toBeTruthy();
    expect(sheet().getByRole('button', { name: 'Name and photo' })).toBeTruthy();
    expect(sheet().getByRole('button', { name: 'Delete trip' })).toBeTruthy();
  });
});

describe('Home screen — deleting the trip (trip-edit-menu D7, D8, D9, D11, D19)', () => {
  const OPEN = 'Opcje podróży';
  const OTHER_ID = '5d8f6a0e-2b1c-4e7d-9f3a-8c4b1e6d2a02';
  const SNACKBAR = 'Podróż usunięta.';
  const sheet = () => within(screen.getByTestId('bottom-sheet'));
  const other = () => overview({ id: OTHER_ID, name: 'Kraków → Rome' });

  async function openConfirmation(name = 'Warsaw → Bangkok') {
    await fireEvent.press(await screen.findByRole('button', { name: OPEN }));
    await fireEvent.press(sheet().getByRole('button', { name: 'Usuń podróż' }));
    expect(screen.getByRole('header', { name: `Usunąć podróż „${name}”?` })).toBeTruthy();
  }
  const confirm = () => fireEvent.press(sheet().getByRole('button', { name: 'Usuń podróż' }));
  // The server keeps the trips that are left: once the delete has run, `current` answers with `next` (null = none left).
  const deletingLeaves = (next: (() => TripOverview) | null) =>
    mockDelete.mockImplementation(async () => {
      mockCurrent = () => Promise.resolve(next ? next() : null);
    });

  it('says that the photos go too (trip-photos P7)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    expect(sheet().getByText('Znikną loty, uczestnicy, budżet i zdjęcia. Tego nie da się cofnąć.')).toBeTruthy();
  });

  it('"Anuluj" keeps the trip: nothing is deleted, no snackbar', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    await fireEvent.press(sheet().getByRole('button', { name: 'Anuluj' }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    expect(screen.getByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
    expect(screen.queryByText(SNACKBAR)).toBeNull();
  });

  it('shows the default trip and the snackbar after a delete, though the trip view unmounted meanwhile', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    // The next trip takes a moment to load: the home screen goes to its skeleton, so CurrentTrip (and the sheet) unmount
    // before the delete settles. The message must not depend on a callback of the unmounted sheet (TanStack Query v5
    // skips per-call `mutate` callbacks then).
    let load: () => void = () => {};
    mockDelete.mockImplementation(async () => {
      mockCurrent = () => new Promise((resolve) => (load = () => resolve(other())));
    });
    await confirm();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(TRIP_ID);
    expect(await screen.findByTestId('trips-loading')).toBeTruthy();
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    expect(screen.queryByText(SNACKBAR)).toBeNull();
    await act(async () => load());
    expect(await screen.findByRole('header', { name: 'Kraków → Rome' })).toBeTruthy();
    expect(await screen.findByText(SNACKBAR)).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Warsaw → Bangkok' })).toBeNull();
  });

  it('deleting the last trip shows the empty state and the snackbar', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    deletingLeaves(null);
    await confirm();
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    expect(await screen.findByText(SNACKBAR)).toBeTruthy();
  });

  it('the snackbar goes away after its time, cleared by the screen, and shows again after a second delete', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const { snackbarAutoDismiss, small } = lightTheme.duration;
    // The screen clears the message at 3500 ms (onHide); the fade-out then runs for 180 ms and removes the snackbar.
    const hideSnackbar = async () => {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(snackbarAutoDismiss);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(small + 50);
      });
      expect(screen.queryByText(SNACKBAR)).toBeNull();
    };
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    deletingLeaves(other);
    await confirm();
    expect(await screen.findByText(SNACKBAR)).toBeTruthy();

    await hideSnackbar();

    // The same text again, later: it shows again, because the screen cleared it the first time.
    await openConfirmation('Kraków → Rome');
    deletingLeaves(null);
    await confirm();
    expect(await screen.findByText(SNACKBAR)).toBeTruthy();
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    await hideSnackbar();
  });

  it('keeps the trip and shows an inline error when deleting fails, with no snackbar', async () => {
    mockCurrent = () => Promise.resolve(overview());
    mockDelete.mockRejectedValue(new Error('trip-not-deletable'));
    await renderHome();
    await openConfirmation();
    await confirm();
    expect(await screen.findByText('Nie udało się usunąć podróży. Spróbuj ponownie.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Usunąć podróż „Warsaw → Bangkok”?' })).toBeTruthy();
    expect(screen.getByTestId('home-screen')).toBeTruthy();
    expect(screen.queryByText(SNACKBAR)).toBeNull();
  });

  it('offline while the confirmation is open: delete is disabled with the hint (D8)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    await act(async () => setNetwork({ isConnected: false, isInternetReachable: false }));
    expect(sheet().getByRole('button', { name: 'Usuń podróż' })).toBeDisabled();
    expect(screen.getByText('Bez internetu nie zmienisz nazwy ani nie usuniesz podróży.')).toBeTruthy();
  });

  it('sits above the pinned "Utwórz podróż" button on the empty state, at the usual place on the trip view (D21, §10.16)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    deletingLeaves(other);
    await confirm();
    const tripBottom = StyleSheet.flatten((await screen.findByTestId('snackbar-container')).props.style).bottom;
    expect(screen.queryByRole('button', { name: 'Utwórz podróż' })).toBeNull();

    await openConfirmation('Kraków → Rome');
    deletingLeaves(null);
    await confirm();
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeTruthy();
    // Clear of the button: its height and a spacing[3] gap above the usual place.
    const emptyBottom = StyleSheet.flatten(screen.getByTestId('snackbar-container').props.style).bottom;
    expect(emptyBottom - tripBottom).toBe(lightTheme.size.buttonPrimary + lightTheme.spacing[3]);
  });

  it('draws the snackbar in the theme of the screen behind it: dark over the trip view, the system theme over the empty state (D11)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await openConfirmation();
    deletingLeaves(other);
    await confirm();
    // The trip view is always dark (A4), also on this light device: the inverse snackbar is then the dark one.
    expect(await screen.findByRole('header', { name: 'Kraków → Rome' })).toBeTruthy();
    expect(await screen.findByTestId('snackbar')).toHaveStyle({ backgroundColor: darkTheme.colors.snackbar.background });
    expect(screen.getByText(SNACKBAR)).toHaveStyle({ color: darkTheme.colors.snackbar.text });

    await openConfirmation('Kraków → Rome');
    deletingLeaves(null);
    await confirm();
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(await screen.findByTestId('snackbar')).toHaveStyle({ backgroundColor: lightTheme.colors.snackbar.background });
    expect(screen.getByText(SNACKBAR)).toHaveStyle({ color: lightTheme.colors.snackbar.text });
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Trip options' }));
    await fireEvent.press(sheet().getByRole('button', { name: 'Delete trip' }));
    expect(screen.getByRole('header', { name: 'Delete trip “Warsaw → Bangkok”?' })).toBeTruthy();
    expect(sheet().getByText("Flights, members, budget and photos will be gone. This can't be undone.")).toBeTruthy();
    deletingLeaves(other);
    await fireEvent.press(sheet().getByRole('button', { name: 'Delete trip' }));
    expect(await screen.findByText('Trip deleted.')).toBeTruthy();
  });
});

describe('Home screen — photo strip (trip-photos P1, A3, D23)', () => {
  const PHOTO_IDS = ['4a1e7c2d-0b3f-4d5a-8e6b-000000000001', '4a1e7c2d-0b3f-4d5a-8e6b-000000000002'];
  const shown = (photoId: string, index: number) => ({
    id: photoId,
    tripId: TRIP_ID,
    takenAt: `2026-11-0${index + 3}T10:00`,
    createdAt: '2026-10-15T12:00:00.000Z',
    url: `https://photos.invalid/${photoId}.jpg`,
    thumbnailUrl: `https://photos.invalid/${photoId}-thumb.jpg`,
  });
  const twoPhotos = () => Promise.resolve(PHOTO_IDS.map(shown));
  const NO_PHOTOS_HINT = 'Dodaj zdjęcia z tej podróży.';
  const OFFLINE_HINT = 'Bez internetu nie dodasz ani nie usuniesz zdjęć.';

  type Rendered = ReturnType<typeof screen.toJSON>;
  /** The given testIDs in the order they are rendered, top to bottom. */
  function renderOrder(ids: string[]) {
    const found: string[] = [];
    const walk = (node: Rendered | string) => {
      if (!node || typeof node === 'string') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const testID = node.props.testID as string | undefined;
      if (testID && ids.includes(testID)) found.push(testID);
      node.children?.forEach(walk);
    };
    walk(screen.toJSON());
    return found;
  }

  it('sits right after the hero and before "Loty", with the trip\'s photos', async () => {
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = twoPhotos;
    await renderHome();
    expect(await screen.findByLabelText('Zdjęcie 1 z 2')).toBeTruthy();
    expect(screen.getByLabelText('Zdjęcie 2 z 2')).toBeTruthy();
    const order = ['trip-hero', 'photo-strip', 'home-flights', 'home-travellers', 'home-budget'];
    expect(renderOrder(order)).toEqual(order);
    expect(within(screen.getByTestId('home-scroll')).getByTestId('photo-strip')).toBeTruthy();
  });

  it('reads the photos of the trip shown', async () => {
    const asked = jest.fn(twoPhotos);
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = asked;
    await renderHome();
    await screen.findByLabelText('Zdjęcie 1 z 2');
    expect(asked).toHaveBeenCalledWith(TRIP_ID);
  });

  it('keeps the strip out of the padded column, in its own wrapper with the column\'s width rules, so tiles are not clipped', async () => {
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = twoPhotos;
    await renderHome();
    await screen.findByLabelText('Zdjęcie 1 z 2');
    const wrapper = screen.getByTestId('home-photos');
    expect(wrapper).toHaveStyle({ width: '100%', maxWidth: lightTheme.size.maxContentWidth, alignSelf: 'center' });
    expect(StyleSheet.flatten(wrapper.props.style).paddingHorizontal).toBeUndefined();
    expect(within(wrapper).getByTestId('photo-strip')).toBeTruthy();
    // The cards keep their side padding in the column; the strip pads its own row by the same amount, so the first tile lines up.
    expect(StyleSheet.flatten(screen.getByTestId('home-flights').parent?.props.style).paddingHorizontal).toBe(lightTheme.spacing[5]);
    expect(StyleSheet.flatten(within(wrapper).getByLabelText('Zdjęcia z podróży').props.contentContainerStyle).paddingHorizontal).toBe(lightTheme.spacing[5]);
  });

  it('keeps the 16dp rhythm between the strip and "Loty"', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByTestId('home-photos')).toHaveStyle({ marginBottom: lightTheme.spacing[4] });
  });

  it('shows the add tile and the hint when the trip has no photos', async () => {
    mockCurrent = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByText(NO_PHOTOS_HINT)).toBeTruthy();
    expect(within(screen.getByTestId('photo-strip')).getByRole('button', { name: 'Dodaj zdjęcia' })).toBeEnabled();
    // The row pads itself like the cards, so the add tile lines up with them.
    expect(screen.getByLabelText('Zdjęcia z podróży')).toHaveStyle({ paddingHorizontal: lightTheme.spacing[5] });
  });

  it('shows skeleton tiles while the photos load, and the trip is already there', async () => {
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = () => new Promise(() => {});
    await renderHome();
    expect(await screen.findByTestId('photo-strip-loading')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
    expect(screen.getByTestId('home-flights')).toBeTruthy();
  });

  it('is not there while the trip loads', async () => {
    mockCurrent = () => new Promise(() => {});
    await renderHome();
    await screen.findByTestId('trips-loading');
    expect(screen.queryByTestId('photo-strip')).toBeNull();
    expect(screen.queryByTestId('home-photos')).toBeNull();
  });

  it('is not there on the empty state', async () => {
    await renderHome();
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.queryByTestId('photo-strip')).toBeNull();
    expect(screen.queryByTestId('home-photos')).toBeNull();
  });

  it('is not there on the error state', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockCurrent = () => Promise.reject(new Error('offline'));
    await renderHome();
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(await screen.findByText('Nie udało się wczytać podróży.')).toBeTruthy();
    expect(screen.queryByTestId('photo-strip')).toBeNull();
    expect(screen.queryByTestId('home-photos')).toBeNull();
  });

  it('offline: shows the phone\'s copy of the photos, the disabled add tile and why', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    mockFromCache = true;
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = twoPhotos;
    await renderHome();
    expect(await screen.findByLabelText('Zdjęcie 1 z 2')).toBeTruthy();
    expect(screen.getByLabelText('Zdjęcie 2 z 2')).toBeTruthy();
    const strip = within(screen.getByTestId('photo-strip'));
    expect(strip.getByRole('button', { name: 'Dodaj zdjęcia' })).toBeDisabled();
    expect(strip.getByText(OFFLINE_HINT)).toBeTruthy();
  });

  it('a failed read of the photos shows inside the strip only: the trip stays (A3)', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = () => Promise.reject(new Error('photos failed'));
    await renderHome();
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    const strip = within(await screen.findByTestId('photo-strip'));
    expect(strip.getByText('Nie udało się wczytać zdjęć.')).toBeTruthy();
    expect(strip.getByRole('button', { name: 'Spróbuj ponownie' })).toBeTruthy();
    expect(screen.queryByText('Nie udało się wczytać podróży.')).toBeNull();
    expect(screen.getByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
    expect(within(screen.getByTestId('home-flights')).getByRole('header', { name: 'Loty' })).toBeTruthy();
  });

  it('shows the photos again after a retry', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    let fail = true;
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = () => (fail ? Promise.reject(new Error('photos failed')) : twoPhotos());
    await renderHome();
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    await screen.findByText('Nie udało się wczytać zdjęć.');
    fail = false;
    await fireEvent.press(within(screen.getByTestId('photo-strip')).getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByLabelText('Zdjęcie 1 z 2')).toBeTruthy();
  });

  it('photo tiles are not buttons yet: the viewer comes later (D23)', async () => {
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = twoPhotos;
    await renderHome();
    await screen.findByLabelText('Zdjęcie 1 z 2');
    const buttons = within(screen.getByTestId('photo-strip')).getAllByRole('button');
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Dodaj zdjęcia']);
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    mockCurrent = () => Promise.resolve(overview());
    mockPhotos = twoPhotos;
    await renderHome();
    expect(await screen.findByLabelText('Photo 1 of 2')).toBeTruthy();
    expect(within(screen.getByTestId('photo-strip')).getByRole('button', { name: 'Add photos' })).toBeTruthy();
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
