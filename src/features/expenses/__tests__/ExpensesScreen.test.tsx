import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useCanEditExpense, useDeleteExpense, useExpenses, useExpenseWriter, useSaveExpense } from '@/hooks/useExpenses';
import { useIsTripOwner, useMyProfileId } from '@/hooks/useProfile';
import { useCurrentTrip } from '@/hooks/useTrips';
import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';
import { todayIn } from '@/lib/time';
import { useIsOffline } from '@/providers/BudgetSync';
import type { LocalExpense, TripOverview } from '@/schemas';
import { tokens } from '@/theme/tokens';

import { ExpensesScreen } from '../ExpensesScreen';

const mockOpenDrawer = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useNavigation: () => ({ openDrawer: mockOpenDrawer }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/hooks/useTrips');
jest.mock('@/hooks/useExpenses');
jest.mock('@/hooks/useProfile');
jest.mock('@/providers/BudgetSync');
jest.mock('@/lib/time', () => ({ ...jest.requireActual('@/lib/time'), todayIn: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const OWNER = '11111111-1111-4111-8111-111111111111';
const FRIEND_USER = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const money = (amountMinor: number) => formatMoney({ amountMinor, currency: 'PLN' }, 'pl');

const member = (id: string, userId: string | null, displayName: string) => ({
  id,
  tripId: TRIP_ID,
  userId,
  displayName,
  role: 'viewer' as const,
  interests: ['local_cuisine' as const],
  dailyBudgetMinor: 10000,
});
const overview: TripOverview = {
  trip: {
    id: TRIP_ID,
    ownerId: OWNER,
    name: 'Warszawa → Bangkok',
    coverImageUri: 'preset:auckland',
    destination: 'BKK',
    startDate: '2026-11-03',
    endDate: '2026-11-12',
    baseCurrency: 'PLN',
    dailyBudget: { amountMinor: 10000, currency: 'PLN' },
    createdAt: '2026-10-04T12:00:00.000Z',
    budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
    travellerCount: 3,
  },
  members: [member(MEMBER, FRIEND_USER, 'Ola'), member(OTHER, null, 'Piotr')],
  segments: [],
};

let nextId = 0;
const expense = (memberId: string | null, amountMinor: number): LocalExpense => ({
  id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
  tripId: TRIP_ID,
  memberId,
  name: 'Kolacja',
  amount: { amountMinor, currency: 'PLN' },
  category: 'food',
  spentOn: '2026-11-03',
  createdAt: '2026-11-03T10:00:00.000Z',
  updatedAt: '2026-11-03T10:00:00.000Z',
  deletedAt: null,
  syncStatus: 'synced',
  attempts: 0,
});

const refetchTrip = jest.fn();
const refetchExpenses = jest.fn();
type Query = { data?: unknown; isPending?: boolean; isError?: boolean };
type Options = { trip?: Query; expenses?: Query; me?: string; today?: string; offline?: boolean };

function setup({ trip = { data: { overview, budgetSyncStatus: 'synced' } }, expenses = { data: [] }, me = OWNER, today = '2026-11-01', offline = false }: Options = {}) {
  jest.mocked(useCurrentTrip).mockReturnValue({ isPending: false, isError: false, refetch: refetchTrip, ...trip } as never);
  jest.mocked(useExpenses).mockReturnValue({ isPending: false, isError: false, refetch: refetchExpenses, ...expenses } as never);
  jest.mocked(useCanEditExpense).mockReturnValue(() => true);
  jest.mocked(useExpenseWriter).mockReturnValue({ isOwner: me === OWNER, ownMemberId: me === OWNER ? null : MEMBER });
  jest.mocked(useSaveExpense).mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
  jest.mocked(useDeleteExpense).mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
  jest.mocked(useMyProfileId).mockReturnValue(me);
  jest.mocked(useIsTripOwner).mockImplementation((ownerId) => ownerId === me);
  jest.mocked(useIsOffline).mockReturnValue(offline);
  jest.mocked(todayIn).mockReturnValue(today);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ExpensesScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('pl');
});

describe('ExpensesScreen (expenses step 7)', () => {
  it('shows the trip bar and the budget; the trip bar opens the side panel (D11)', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Otwórz listę podróży, Warszawa → Bangkok' }));
    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Warszawa → Bangkok')).toBeOnTheScreen();
    expect(screen.getByText(`Zostało ${money(300000)}`)).toBeOnTheScreen();
  });

  it('lists the expenses by day under the budget (step 9)', async () => {
    await setup({ expenses: { data: [expense(null, 10000)] } });
    expect(within(screen.getByTestId('expense-day-2026-11-03')).getByText('Kolacja')).toBeOnTheScreen();
  });

  it('owner: "Ja" is the organizer (memberId null), the group is everyone', async () => {
    await setup({ expenses: { data: [expense(null, 10000), expense(MEMBER, 20000)] } });
    expect(screen.getByText(`Zostało ${money(270000)}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ja' }));
    expect(within(screen.getByTestId('budget-hero')).getByText(`Zostało ${money(90000)}`)).toBeOnTheScreen();
  });

  it('linked friend: "Ja" is their own member row', async () => {
    await setup({ me: FRIEND_USER, expenses: { data: [expense(null, 10000), expense(MEMBER, 20000)] } });
    await fireEvent.press(screen.getByRole('radio', { name: 'Ja' }));
    expect(within(screen.getByTestId('budget-hero')).getByText(`Zostało ${money(80000)}`)).toBeOnTheScreen();
  });

  it('shows "Zostało dziś" during the trip and not before or after it', async () => {
    await setup({ today: '2026-11-04' });
    expect(screen.getByText(/^Zostało dziś/)).toBeOnTheScreen();
    await screen.unmount();
    await setup({ today: '2026-11-01' });
    expect(screen.queryByText(/dziś/)).toBeNull();
    await screen.unmount();
    await setup({ today: '2026-11-20' });
    expect(screen.queryByText(/dziś/)).toBeNull();
  });

  it('no trip: the existing no-trip copy and the create button', async () => {
    await setup({ trip: { data: null } });
    expect(screen.getByText('Nie masz jeszcze żadnej podróży.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeOnTheScreen();
  });

  it('loading: a labelled skeleton, no budget', async () => {
    await setup({ trip: { data: undefined, isPending: true } });
    expect(screen.getByLabelText('Wczytywanie podróży')).toBeOnTheScreen();
    expect(screen.queryByText(/^Zostało/)).toBeNull();
  });

  it('error: a message with a retry that reloads', async () => {
    await setup({ trip: { data: undefined, isError: true } });
    expect(screen.getByText('Nie udało się wczytać podróży.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(refetchTrip).toHaveBeenCalled();
  });

  it('error reading the expenses has its own message and a retry', async () => {
    await setup({ expenses: { data: undefined, isError: true } });
    expect(screen.getByText('Nie udało się wczytać wydatków.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(refetchExpenses).toHaveBeenCalled();
  });

  it('no expenses: the budget stays, with the empty copy and an action that opens the add sheet', async () => {
    await setup();
    expect(screen.getByText(`Zostało ${money(300000)}`)).toBeOnTheScreen();
    expect(screen.getByText('Brak wydatków')).toBeOnTheScreen();
    expect(screen.getByText('Dodaj pierwszy wydatek. Zapis zajmuje tylko kilka sekund.')).toBeOnTheScreen();
    await fireEvent.press(within(screen.getByTestId('expenses-empty')).getByRole('button', { name: 'Dodaj wydatek' }));
    expect(screen.getByRole('header', { name: 'Dodaj wydatek' })).toBeOnTheScreen();
  });

  it.each([
    ['loading', { trip: { data: undefined, isPending: true } }],
    ['no trip', { trip: { data: null } }],
    ['trip error', { trip: { data: undefined, isError: true } }],
  ] as [string, Options][])('%s: the side panel can still be opened (trips-drawer P5)', async (_state, options) => {
    await setup(options);
    await fireEvent.press(screen.getByRole('button', { name: 'Otwórz listę podróży' }));
    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
  });

  it('expenses still loading: the trip bar and a labelled skeleton, no budget', async () => {
    await setup({ expenses: { data: undefined, isPending: true } });
    expect(screen.getByText('Warszawa → Bangkok')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wczytywanie podróży')).toBeOnTheScreen();
    expect(screen.queryByText(/^Zostało/)).toBeNull();
  });

  it('works out today in the destination airport time zone (A3)', async () => {
    await setup();
    expect(todayIn).toHaveBeenCalledWith('Asia/Bangkok');
  });

  it('offline: the banner shows and local data renders normally', async () => {
    await setup({ offline: true, expenses: { data: [expense(null, 10000)] } });
    expect(screen.getByTestId('offline-banner')).toBeOnTheScreen();
    expect(screen.getByText(`Zostało ${money(290000)}`)).toBeOnTheScreen();
    expect(screen.queryByText('Brak wydatków')).toBeNull();
  });
});

describe('ExpensesScreen who-spent-what chart (expenses step 8)', () => {
  it('shows the chart under the budget once there are expenses', async () => {
    await setup({ expenses: { data: [expense(null, 10000)] } });
    expect(screen.getByText('Ile kto wydał')).toBeOnTheScreen();
    expect(screen.getByTestId('spend-row-organizer')).toBeOnTheScreen();
  });

  it('leaves the chart out when there are no expenses', async () => {
    await setup();
    expect(screen.queryByText('Ile kto wydał')).toBeNull();
  });
});

describe('ExpensesScreen floating add button (expenses step 10, D14)', () => {
  it('shows the FAB with a trip, and it opens the add sheet', async () => {
    await setup({ expenses: { data: [expense(null, 10000)] } });
    expect(screen.getByRole('button', { name: 'Dodaj wydatek' })).toBe(screen.getByTestId('fab-add-expense'));
    await fireEvent.press(screen.getByTestId('fab-add-expense'));
    expect(screen.getByRole('header', { name: 'Dodaj wydatek' })).toBeOnTheScreen();
  });

  it('is not shown while there are no expenses: the empty state has the only add button (D24)', async () => {
    await setup();
    expect(screen.queryByTestId('fab-add-expense')).toBeNull();
  });

  it('sits at the right, above the floating pill', async () => {
    await setup({ expenses: { data: [expense(null, 10000)] } });
    expect(screen.getByTestId('fab-slot')).toHaveStyle({
      position: 'absolute',
      right: tokens.spacing[5],
      bottom: metrics.insets.bottom + tokens.components.fab.bottomClearance,
    });
  });

  it.each([
    ['loading', { trip: { data: undefined, isPending: true } }],
    ['no trip', { trip: { data: null } }],
    ['trip error', { trip: { data: undefined, isError: true } }],
  ] as [string, Options][])('%s: no FAB', async (_state, options) => {
    await setup(options);
    expect(screen.queryByTestId('fab-add-expense')).toBeNull();
  });

  it('offline: sits a gap above the banner, measured (a wrapped banner is taller)', async () => {
    await setup({ offline: true, expenses: { data: [expense(null, 10000)] } });
    const slot = screen.getByTestId('offline-banner-slot');
    await fireEvent(slot, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 190 } } });
    expect(screen.getByTestId('fab-slot')).toHaveStyle({ bottom: 190 });
    await fireEvent(slot, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 230 } } });
    expect(screen.getByTestId('fab-slot')).toHaveStyle({ bottom: 230 });
  });

  it('ignores presses beneath the closing sheet for its closing animation, then works again', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await setup({ expenses: { data: [expense(null, 10000)] } });
    await fireEvent.press(screen.getByTestId('fab-add-expense'));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Zamknij' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Kolacja' }));
    expect(screen.queryByRole('header', { name: 'Edytuj wydatek' })).toBeNull();
    now.mockReturnValue(1_000_000 + tokens.motion.duration.slow + 1);
    await fireEvent.press(screen.getByRole('button', { name: 'Kolacja' }));
    expect(screen.getByRole('header', { name: 'Edytuj wydatek' })).toBeOnTheScreen();
    now.mockRestore();
  });

  it('a row opens the edit sheet', async () => {
    await setup({ expenses: { data: [expense(null, 10000)] } });
    await fireEvent.press(screen.getByRole('button', { name: 'Kolacja' }));
    expect(screen.getByRole('header', { name: 'Edytuj wydatek' })).toBeOnTheScreen();
  });
});
