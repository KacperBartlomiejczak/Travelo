import { useFonts } from 'expo-font';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import RootLayout from '@/app/_layout';
import TripsScreen from '@/app/index';
import i18n from '@/i18n';
import type { TripOverview } from '@/schemas';
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

// The screen reads the nearest trip through the repository; tests decide what `nearest` returns.
let mockNearest: () => Promise<TripOverview | null> = () => Promise.resolve(null);
jest.mock('@/data/trip-repository', () => ({
  ...jest.requireActual('@/data/trip-repository'),
  createInMemoryTripRepository: () => ({
    nearest: async () => {
      const overview = await mockNearest();
      return overview && { overview, budgetSyncStatus: 'synced', fromCache: false };
    },
    create: () => Promise.reject(new Error('unused')),
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
  return renderRouter({ _layout: RootLayout, index: TripsScreen, 'trips/new/index': () => null });
}

beforeEach(async () => {
  mockNearest = () => Promise.resolve(null);
  mockStatusBarStyle = undefined;
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Home screen — nearest trip (D4)', () => {
  it('shows the hero skeleton while loading', async () => {
    mockNearest = () => new Promise(() => {});
    await renderHome();
    const loading = screen.getByTestId('trips-loading');
    // One accessibility element, so VoiceOver reads "Wczytywanie podróży" (the skeleton is hidden).
    expect(loading.props.accessible).toBe(true);
    expect(loading.props.accessibilityLabel).toBe('Wczytywanie podróży');
    expect(loading).toBeBusy();
    expect(screen.getByTestId('trip-hero-skeleton', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeTruthy();
  });

  it('opens on the nearest trip: the hero with its name and dates', async () => {
    mockNearest = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
    expect(within(screen.getByTestId('trip-hero')).getByText('3 lis – 15 lis 2026 · 13 dni')).toBeTruthy();
    expect(screen.queryByText('Nie masz jeszcze żadnej podróży.')).toBeNull();
  });

  it('shows the flights in airport-local time, with the layover', async () => {
    mockNearest = () => Promise.resolve(overview());
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
    mockNearest = () => Promise.resolve(overview());
    await renderHome();
    const people = within(await screen.findByTestId('home-travellers'));
    expect(people.getByRole('header', { name: 'Podróżni · 3 osoby' })).toBeTruthy();
    expect(people.getByText('Ty')).toBeTruthy();
    expect(people.getByText('Kasia')).toBeTruthy();
    expect(people.getByText('Ola')).toBeTruthy();
  });

  it('shows a solo trip as one traveller', async () => {
    mockNearest = () => Promise.resolve({ ...overview({ travellerCount: 1 }), members: [] });
    await renderHome();
    const people = within(await screen.findByTestId('home-travellers'));
    expect(people.getByRole('header', { name: 'Podróżni · 1 osoba' })).toBeTruthy();
    expect(people.getByText('Ty')).toBeTruthy();
  });

  it('shows the budget per person, the group total and per day', async () => {
    mockNearest = () => Promise.resolve(overview());
    await renderHome();
    const budget = within(await screen.findByTestId('home-budget'));
    expect(budget.getByRole('header', { name: 'Budżet' })).toBeTruthy();
    expect(budget.getByText('3000 THB')).toBeTruthy();
    expect(budget.getByText('na osobę')).toBeTruthy();
    expect(budget.getByText('Razem 9000 THB · ~231 THB dziennie na osobę')).toBeTruthy();
  });

  it('is dark on a light device: ink background and dark-theme cards (A4)', async () => {
    mockNearest = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByTestId('home-screen')).toHaveStyle({ backgroundColor: darkTheme.colors.hero.background });
    expect(screen.getByTestId('home-flights')).toHaveStyle({ backgroundColor: darkTheme.colors.surface.secondary });
    expect(screen.getByText('Ty')).toHaveStyle({ color: darkTheme.colors.text.primary });
  });

  it('still creates a trip from the pinned button', async () => {
    mockNearest = () => Promise.resolve(overview());
    const rendered = renderHome();
    await rendered;
    await screen.findByTestId('home-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    expect(rendered.getPathname()).toBe('/trips/new');
  });

  it('uses a light status bar over the hero, and hands it back when another screen opens on top', async () => {
    mockNearest = () => Promise.resolve(overview());
    await renderHome();
    await screen.findByTestId('home-screen');
    expect(mockStatusBarStyle).toBe('light');
    // The home screen stays mounted under the wizard; its status bar must not stay light there.
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    expect(mockStatusBarStyle).toBe('auto');
  });

  it('keeps the pinned button in the centred content column (tablets, §18)', async () => {
    mockNearest = () => Promise.resolve(overview());
    await renderHome();
    expect(await screen.findByTestId('home-action')).toHaveStyle({ maxWidth: lightTheme.size.maxContentWidth, alignSelf: 'center' });
  });

  it('keeps the loading state\'s button in the centred content column too', async () => {
    mockNearest = () => new Promise(() => {});
    await renderHome();
    expect(screen.getByTestId('home-action')).toHaveStyle({ maxWidth: lightTheme.size.maxContentWidth, alignSelf: 'center' });
  });

  it('measures a layover from the stored instants, also in the hour repeated when clocks go back', async () => {
    // Lands in Warsaw at the first 02:30 (CEST), leaves at the second 02:45 (CET): 1 h 15 min, not 15 min.
    const trip = overview();
    trip.segments = [
      segment('outbound', 0, ['LHR', '2026-10-24T23:00:00+01:00', 'Europe/London'], ['WAW', '2026-10-25T02:30:00+02:00', 'Europe/Warsaw']),
      segment('outbound', 1, ['WAW', '2026-10-25T02:45:00+01:00', 'Europe/Warsaw'], ['BKK', '2026-10-25T20:00:00+07:00', 'Asia/Bangkok']),
      segment('return', 0, ['BKK', '2026-11-15T09:00:00+07:00', 'Asia/Bangkok'], ['WAW', '2026-11-15T17:00:00+01:00', 'Europe/Warsaw']),
    ];
    mockNearest = () => Promise.resolve(trip);
    await renderHome();
    const flights = within(await screen.findByTestId('home-flights'));
    expect(flights.getByText('1 godz. 15 min przesiadki w WAW')).toBeTruthy();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    mockNearest = () => Promise.resolve(overview());
    await renderHome();
    const flights = within(await screen.findByTestId('home-flights'));
    expect(flights.getByRole('header', { name: 'Flights' })).toBeTruthy();
    expect(within(screen.getByTestId('home-travellers')).getByText('You')).toBeTruthy();
  });

  it('shows and announces an error, with a retry that loads again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    jest.useFakeTimers({ advanceTimers: true });
    let fail = true;
    mockNearest = () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(overview()));
    await renderHome();
    // TanStack Query retries before giving up.
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(await screen.findByText('Nie udało się wczytać podróży.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Nie udało się wczytać podróży.');
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('header', { name: 'Warsaw → Bangkok' })).toBeTruthy();
  });
});
