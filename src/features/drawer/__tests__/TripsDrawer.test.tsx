import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, isHiddenFromAccessibility, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { TripRepository } from '@/data/trip-repository';
import { TripsDrawer } from '@/features/drawer/TripsDrawer';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import type { CurrentTrip, TripListItem } from '@/schemas';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/theme';

const METRICS = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

// "Today" for the sections: 8 Oct 2026, in the morning on the device.
const NOW = new Date(2026, 9, 8, 9, 0);

const LISBON: TripListItem = { id: '00000000-0000-4000-8000-0000000000a1', name: 'Lizbona', startDate: '2026-05-01', endDate: '2026-05-08' };
const OSLO: TripListItem = { id: '00000000-0000-4000-8000-0000000000a2', name: 'Oslo', startDate: '2026-08-10', endDate: '2026-08-14' };
const ROME: TripListItem = {
  id: '00000000-0000-4000-8000-0000000000a3',
  name: 'Rzym',
  coverImageUri: 'file:///cache/rome.jpg',
  startDate: '2026-10-05',
  endDate: '2026-10-12',
};
const BANGKOK: TripListItem = { id: '00000000-0000-4000-8000-0000000000a4', name: 'Warsaw → Bangkok', startDate: '2026-11-03', endDate: '2026-11-15' };

function current(item: TripListItem): CurrentTrip {
  return {
    overview: {
      trip: {
        ...item,
        ownerId: 'local-user',
        destination: 'BKK',
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

type Setup = { list?: () => Promise<TripListItem[]>; currentId?: string | null };

function setup({ list = async () => [BANGKOK, LISBON, ROME, OSLO], currentId = ROME.id }: Setup = {}) {
  let chosen = currentId;
  const all = [LISBON, OSLO, ROME, BANGKOK];
  const repository: TripRepository = {
    list: jest.fn(list),
    current: jest.fn(async () => {
      const found = all.find((trip) => trip.id === chosen);
      return found ? current(found) : null;
    }),
    select: jest.fn(async (tripId: string) => {
      chosen = tripId;
    }),
    create: jest.fn(async () => {
      throw new Error('unused');
    }),
    setBudget: jest.fn(async () => {}),
    syncBudgets: jest.fn(async () => ({ nextAttemptAt: null })),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = jest.fn();
  const onCreate = jest.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProviders queryClient={queryClient} tripRepository={repository}>
        {children}
      </AppProviders>
    </SafeAreaProvider>
  );
  const rendered = render(<TripsDrawer onClose={onClose} onCreate={onCreate} />, { wrapper });
  return { repository, queryClient, onClose, onCreate, rendered };
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
});

/** Every text in the panel, top to bottom. */
function textsInOrder(): string[] {
  return within(screen.getByTestId('trips-drawer'))
    .getAllByText(/.+/)
    .map((node) => [node.props.children].flat().join(''));
}

describe('TripsDrawer (trips-drawer D4)', () => {
  it('lists upcoming trips soonest first and past trips most recently ended first, under their headers', async () => {
    await setup().rendered;
    expect(await screen.findByRole('header', { name: 'Twoje podróże' })).toBeTruthy();
    const upcoming = within(screen.getByTestId('drawer-section-upcoming'));
    expect(upcoming.getByRole('header', { name: 'Nadchodzące' })).toBeTruthy();
    expect(upcoming.getAllByRole('button').map((row) => row.props.accessibilityLabel)).toEqual([
      'Rzym, 5 paź – 12 paź 2026',
      'Warsaw → Bangkok, 3 lis – 15 lis 2026',
    ]);
    const past = within(screen.getByTestId('drawer-section-past'));
    expect(past.getByRole('header', { name: 'Minione' })).toBeTruthy();
    expect(past.getAllByRole('button').map((row) => row.props.accessibilityLabel)).toEqual([
      'Oslo, 10 sie – 14 sie 2026',
      'Lizbona, 1 maj – 8 maj 2026',
    ]);
  });

  it('leaves out a section with no trips', async () => {
    await setup({ list: async () => [BANGKOK] }).rendered;
    expect(await screen.findByTestId('drawer-section-upcoming')).toBeTruthy();
    expect(screen.queryByTestId('drawer-section-past')).toBeNull();
    expect(screen.queryByText('Minione')).toBeNull();
  });

  it('shows each row\'s name and dates, and the cover photo or a placeholder', async () => {
    await setup().rendered;
    const rome = await screen.findByRole('button', { name: 'Rzym, 5 paź – 12 paź 2026' });
    expect(within(rome).getByText('Rzym')).toBeTruthy();
    expect(within(rome).getByText('5 paź – 12 paź 2026')).toBeTruthy();
    const cover = within(rome).getByTestId('trip-row-cover', { includeHiddenElements: true });
    expect(cover.props.source).toEqual([{ uri: 'file:///cache/rome.jpg' }]); // expo-image normalises to a list
    expect(cover).toHaveStyle({ width: lightTheme.size.thumbnail, height: lightTheme.size.thumbnail, borderRadius: lightTheme.radius.sm });
    // A cover the phone has since cleared still shows as the placeholder square, not as a hole.
    expect(cover).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
    const bangkok = screen.getByRole('button', { name: 'Warsaw → Bangkok, 3 lis – 15 lis 2026' });
    expect(within(bangkok).queryByTestId('trip-row-cover', { includeHiddenElements: true })).toBeNull();
    const placeholder = within(bangkok).getByTestId('trip-row-placeholder', { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(placeholder)).toBe(true);
    expect(placeholder).toHaveStyle({ width: lightTheme.size.thumbnail, height: lightTheme.size.thumbnail, backgroundColor: lightTheme.colors.surface.secondary });
  });

  it('rows are list rows: at least 64dp high with 16dp side padding, secondary surface while pressed (§10.8)', async () => {
    await setup().rendered;
    expect(await screen.findByRole('button', { name: 'Rzym, 5 paź – 12 paź 2026' })).toHaveStyle({ minHeight: 64, paddingHorizontal: lightTheme.spacing[4] });
    const oslo = screen.getByRole('button', { name: 'Oslo, 10 sie – 14 sie 2026' });
    expect(oslo).not.toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
    await fireEvent(oslo, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
    expect(oslo).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
  });

  it('marks the open trip with a background and a check, never colour alone, and no other row (§15)', async () => {
    await setup().rendered;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rzym, 5 paź – 12 paź 2026' })).toBeSelected());
    const rome = screen.getByRole('button', { name: 'Rzym, 5 paź – 12 paź 2026' });
    expect(rome).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
    expect(within(rome).getByTestId('trip-row-check', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.colors.action.primary);
    for (const name of ['Warsaw → Bangkok, 3 lis – 15 lis 2026', 'Oslo, 10 sie – 14 sie 2026', 'Lizbona, 1 maj – 8 maj 2026']) {
      const row = screen.getByRole('button', { name });
      expect(row).not.toBeSelected();
      expect(within(row).queryByTestId('trip-row-check', { includeHiddenElements: true })).toBeNull();
    }
  });

  it('opens another trip: remembers the choice and closes the panel', async () => {
    const { repository, onClose, rendered } = setup();
    await rendered;
    await fireEvent.press(await screen.findByRole('button', { name: 'Oslo, 10 sie – 14 sie 2026' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(repository.select).toHaveBeenCalledWith(OSLO.id));
  });

  it('only closes the panel when the open trip is tapped', async () => {
    const { repository, onClose, rendered } = setup();
    await rendered;
    const rome = await screen.findByRole('button', { name: 'Rzym, 5 paź – 12 paź 2026' });
    await waitFor(() => expect(rome).toBeSelected());
    await fireEvent.press(rome);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(repository.select).not.toHaveBeenCalled();
  });

  it('starts a new trip from "Nowa podróż" at the bottom', async () => {
    const { onCreate, rendered } = setup();
    await rendered;
    await fireEvent.press(await screen.findByRole('button', { name: 'Nowa podróż' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows one busy element while loading', async () => {
    await setup({ list: () => new Promise(() => {}) }).rendered;
    const loading = screen.getByTestId('drawer-loading');
    expect(loading.props.accessible).toBe(true);
    expect(loading.props.accessibilityLabel).toBe('Wczytywanie podróży');
    expect(loading).toBeBusy();
    expect(screen.getByRole('button', { name: 'Nowa podróż' })).toBeTruthy();
  });

  it('shows an error with a retry that loads again', async () => {
    let fail = true;
    await setup({ list: async () => (fail ? Promise.reject(new Error('offline')) : [BANGKOK]) }).rendered;
    expect(await screen.findByText('Nie udało się wczytać podróży.')).toBeTruthy();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('button', { name: 'Warsaw → Bangkok, 3 lis – 15 lis 2026' })).toBeTruthy();
  });

  it('keeps the list on screen when a later read fails (§12: keep what is there)', async () => {
    let fail = false;
    const { queryClient, rendered } = setup({ list: async () => (fail ? Promise.reject(new Error('offline')) : [BANGKOK]) });
    await rendered;
    await screen.findByRole('button', { name: 'Warsaw → Bangkok, 3 lis – 15 lis 2026' });
    fail = true;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['trips', 'list'] });
      // Query updates reach the component through a setTimeout(0); let it re-render.
      await jest.runOnlyPendingTimersAsync();
    });
    expect(queryClient.getQueryState(['trips', 'list'])?.status).toBe('error');
    expect(screen.getByRole('button', { name: 'Warsaw → Bangkok, 3 lis – 15 lis 2026' })).toBeTruthy();
    expect(screen.queryByText('Nie udało się wczytać podróży.')).toBeNull();
  });

  it('offline: shows the list from the phone with the banner above "Nowa podróż"', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    await setup().rendered;
    expect(await screen.findByRole('button', { name: 'Rzym, 5 paź – 12 paź 2026' })).toBeTruthy();
    expect(textsInOrder()).toEqual(expect.arrayContaining(['Jesteś offline. Zmiany zapiszą się po połączeniu.', 'Nowa podróż']));
    expect(textsInOrder().indexOf('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeLessThan(textsInOrder().indexOf('Nowa podróż'));
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await setup().rendered;
    expect(await screen.findByRole('header', { name: 'Your trips' })).toBeTruthy();
    expect(await screen.findByRole('header', { name: 'Upcoming' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Past' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New trip' })).toBeTruthy();
  });
});

describe('TripsDrawer — no trips (trips-drawer D5)', () => {
  it('says there are no trips yet above "Nowa podróż", never an empty panel', async () => {
    await setup({ list: async () => [], currentId: null }).rendered;
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.queryByText('Nadchodzące')).toBeNull();
    expect(screen.queryByText('Minione')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nowa podróż' })).toBeTruthy();
    expect(textsInOrder()).toEqual(['Twoje podróże', 'Nie masz jeszcze żadnej podróży.', 'Zaplanuj pierwszą i zaproś znajomych.', 'Nowa podróż']);
  });

  it('says the same offline with an empty copy of the list, with the banner', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    await setup({ list: async () => [], currentId: null }).rendered;
    expect(await screen.findByText('Nie masz jeszcze żadnej podróży.')).toBeTruthy();
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
  });
});
