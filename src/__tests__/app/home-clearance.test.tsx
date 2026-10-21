import { useFonts } from 'expo-font';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import RootLayout from '@/app/_layout';
import i18n from '@/i18n';
import type { SyncStatus, TripOverview } from '@/schemas';
import { LOCAL_PROFILE_ID } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/legacy/theme';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// A phone with a home indicator, so the clearance has an inset part that must not be counted twice.
const INSET_BOTTOM = 34;
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

// The snackbar itself is covered in its own test; here only the offset the home screen gives it matters.
let mockSnackbarOffset: number | undefined;
jest.mock('@/components/Snackbar', () => ({
  Snackbar: ({ bottomOffset }: { bottomOffset?: number }) => {
    mockSnackbarOffset = bottomOffset;
    return null;
  },
}));

let mockCurrent: () => Promise<TripOverview | null> = () => Promise.resolve(null);
const mockSyncStatus: SyncStatus = 'synced';
jest.mock('@/data/app-trip-repository', () => ({
  createAppTripRepository: () => ({
    list: async () => [],
    current: async () => {
      const overview = await mockCurrent();
      return overview && { overview, budgetSyncStatus: mockSyncStatus, fromCache: false };
    },
    create: () => Promise.reject(new Error('unused')),
    setBudget: async () => {},
    syncBudgets: async () => ({ nextAttemptAt: null }),
    photos: async () => [],
  }),
}));

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const { spacing, size } = lightTheme;
const CLEARANCE = INSET_BOTTOM + spacing[4] + size.navPill;
const OFFLINE = { isConnected: false, isInternetReachable: false };
const CREATE = 'Utwórz podróż';

function overview(): TripOverview {
  return {
    trip: {
      id: TRIP_ID,
      ownerId: LOCAL_PROFILE_ID,
      name: 'Warsaw → Bangkok',
      coverImageUri: 'preset:auckland',
      destination: 'BKK',
      startDate: '2026-11-03',
      endDate: '2026-11-15',
      baseCurrency: 'THB',
      budgetPerPerson: { amountMinor: 300000, currency: 'THB' },
      createdAt: '2026-10-04T12:00:00.000Z',
      budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
      travellerCount: 1,
    },
    members: [],
    segments: [],
  };
}

function renderHome() {
  return renderRouter({
    _layout: RootLayout,
    '(drawer)/_layout': DrawerLayout,
    '(drawer)/(tabs)/_layout': TabsLayout,
    '(drawer)/(tabs)/index': HomeScreen,
    'trips/new/index': () => null,
  });
}

async function showError() {
  jest.useFakeTimers({ advanceTimers: true });
  mockCurrent = () => Promise.reject(new Error('offline'));
  await renderHome();
  await act(async () => {
    await jest.runAllTimersAsync();
  });
  await screen.findByText('Nie udało się wczytać podróży.');
}

type Rendered = ReturnType<typeof screen.toJSON>;
/** Where the first node matching `match` is in the tree, top to bottom (-1 when absent). */
function position(match: (props: Record<string, unknown>) => boolean): number {
  let index = 0;
  let found = -1;
  const walk = (node: Rendered | string) => {
    if (!node || typeof node === 'string' || found !== -1) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (match(node.props)) found = index;
    index += 1;
    node.children?.forEach(walk);
  };
  walk(screen.toJSON());
  return found;
}

beforeEach(async () => {
  mockCurrent = () => Promise.resolve(null);
  mockSnackbarOffset = undefined;
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Home screen above the floating pill (pill-nav-and-dialog step 5)', () => {
  describe('trip view', () => {
    it('ends the scrolling cards above the pill: padding below the last card is the clearance and one more 16dp', async () => {
      mockCurrent = () => Promise.resolve(overview());
      await renderHome();
      const scroll = await screen.findByTestId('home-scroll');
      expect(scroll.props.contentContainerStyle.paddingBottom).toBeGreaterThanOrEqual(CLEARANCE + spacing[4]);
      expect(scroll.props.contentContainerStyle.paddingBottom).toBe(CLEARANCE + spacing[4]);
    });

    it('lifts the snackbar to the pill: its place is the clearance and 16dp', async () => {
      mockCurrent = () => Promise.resolve(overview());
      await renderHome();
      await screen.findByTestId('home-screen');
      // The snackbar adds the inset and 16dp itself, so its offset is the pill's height and 16dp.
      expect(mockSnackbarOffset).toBe(size.navPill + spacing[4]);
      expect(INSET_BOTTOM + spacing[4] + (mockSnackbarOffset ?? 0)).toBe(CLEARANCE + spacing[4]);
    });

    it('offline: pins the banner at the clearance, so the pill does not cover it', async () => {
      setNetwork(OFFLINE);
      mockCurrent = () => Promise.resolve(overview());
      await renderHome();
      const action = await screen.findByTestId('home-action');
      expect(action.props.style.paddingBottom).toBeGreaterThanOrEqual(CLEARANCE);
      expect(action.props.style.paddingBottom).toBe(CLEARANCE + spacing[3]);
    });

    it('offline: the cards do not add the pill\'s clearance a second time, the banner above it already does', async () => {
      setNetwork(OFFLINE);
      mockCurrent = () => Promise.resolve(overview());
      await renderHome();
      const scroll = await screen.findByTestId('home-scroll');
      expect(scroll.props.contentContainerStyle.paddingBottom).toBe(spacing[6]);
    });
  });

  describe('loading', () => {
    it('keeps the snackbar above the pill', async () => {
      mockCurrent = () => new Promise(() => {});
      await renderHome();
      await screen.findByTestId('trips-loading');
      expect(mockSnackbarOffset).toBe(size.navPill + spacing[4]);
    });
  });

  describe.each(['empty', 'error'] as const)('%s state', (state) => {
    async function show() {
      if (state === 'error') await showError();
      else {
        await renderHome();
        await screen.findByText('Nie masz jeszcze żadnej podróży.');
      }
    }

    it('pins "Utwórz podróż" at the clearance and 16dp: the bottom padding is no longer the bare inset', async () => {
      await show();
      expect(screen.getByRole('button', { name: CREATE })).toBeTruthy();
      expect(StyleSheet.flatten(screen.getByTestId('trips-screen').props.style).paddingBottom).toBe(CLEARANCE + spacing[4]);
    });

    it('lifts the snackbar above the button, which sits above the pill', async () => {
      await show();
      // Clear of the button: its height and 12dp above the snackbar's usual place (the clearance and 16dp).
      expect(mockSnackbarOffset).toBe(size.navPill + spacing[4] + size.buttonPrimary + spacing[3]);
    });

    it('offline: puts the banner right above the button, so both clear the pill', async () => {
      setNetwork(OFFLINE);
      await show();
      const banner = position((props) => props.testID === 'offline-banner');
      const button = position((props) => props.accessibilityLabel === CREATE);
      expect(banner).toBeGreaterThan(-1);
      expect(button).toBeGreaterThan(banner);
    });
  });
});
