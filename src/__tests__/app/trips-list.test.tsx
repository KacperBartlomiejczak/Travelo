import { useFonts } from 'expo-font';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import RootLayout from '@/app/_layout';
import TripsScreen from '@/app/index';
import i18n from '@/i18n';
import type { TripSummary } from '@/schemas';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

// The screen reads trips through the repository; tests decide what `list` returns.
let mockList: () => Promise<TripSummary[]> = () => Promise.resolve([]);
jest.mock('@/data/trip-repository', () => ({
  ...jest.requireActual('@/data/trip-repository'),
  createInMemoryTripRepository: () => ({ list: () => mockList(), create: () => Promise.reject(new Error('unused')) }),
}));

let nextId = 0;
const summary = (name: string, destination: string, startDate: string, endDate: string): TripSummary => ({
  id: `0b9e7c4e-6a43-4c4b-9a55-${String(++nextId).padStart(12, '0')}`,
  ownerId: 'local-user',
  name,
  destination,
  startDate,
  endDate,
  baseCurrency: 'EUR',
  budgetPerPerson: { amountMinor: 150000, currency: 'EUR' },
  createdAt: '2026-10-04T12:00:00.000Z',
  travellerCount: 2,
});

function renderTrips() {
  return renderRouter({ _layout: RootLayout, index: TripsScreen, 'trips/new/index': () => null });
}

beforeEach(async () => {
  mockList = () => Promise.resolve([]);
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Trips screen — states (D39, §12)', () => {
  it('shows skeleton cards while loading', async () => {
    mockList = () => new Promise(() => {});
    await renderTrips();
    const loading = screen.getByTestId('trips-loading');
    // One accessibility element, so VoiceOver reads "Wczytywanie podróży" (the skeletons are hidden).
    expect(loading.props.accessible).toBe(true);
    expect(loading.props.accessibilityLabel).toBe('Wczytywanie podróży');
    expect(loading).toBeBusy();
    expect(screen.getAllByTestId('trip-card-skeleton', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByText('Nie masz jeszcze żadnej podróży.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeTruthy();
  });

  it('lists the soonest trip under "Najbliższa podróż" and the rest under "Później"', async () => {
    // The repository returns trips soonest first.
    mockList = () =>
      Promise.resolve([
        summary('Bangkok', 'BKK', '2026-11-03', '2026-11-15'),
        summary('Barcelona', 'BCN', '2027-01-10', '2027-01-17'),
        summary('Tokyo', 'NRT', '2027-04-01', '2027-04-12'),
      ]);
    await renderTrips();
    const next = within(await screen.findByTestId('trips-next'));
    expect(next.getByRole('header', { name: 'Najbliższa podróż' })).toBeTruthy();
    expect(next.getByText('Bangkok')).toBeTruthy();
    const later = within(screen.getByTestId('trips-later'));
    expect(later.getByRole('header', { name: 'Później' })).toBeTruthy();
    expect(later.getAllByRole('header').map((node) => node.props.children)).toEqual(['Później', 'Barcelona', 'Tokyo']);
    expect(screen.queryByText('Nie masz jeszcze żadnej podróży.')).toBeNull();
  });

  it('has no "Później" section with a single trip', async () => {
    mockList = () => Promise.resolve([summary('Bangkok', 'BKK', '2026-11-03', '2026-11-15')]);
    await renderTrips();
    expect(await screen.findByText('Bangkok')).toBeTruthy();
    expect(screen.queryByTestId('trips-later')).toBeNull();
  });

  it('shows and announces an error, with a retry that loads again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    jest.useFakeTimers({ advanceTimers: true });
    let fail = true;
    mockList = () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve([summary('Bangkok', 'BKK', '2026-11-03', '2026-11-15')]));
    await renderTrips();
    // TanStack Query retries before giving up.
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(await screen.findByText('Nie udało się wczytać podróży.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Nie udało się wczytać podróży.');
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByText('Bangkok')).toBeTruthy();
  });
});
