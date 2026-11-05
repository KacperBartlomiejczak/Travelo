import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSaveExpense } from '@/hooks/useExpenses';
import { useIsTripOwner, useMyProfileId } from '@/hooks/useProfile';
import { useCurrentTrip } from '@/hooks/useTrips';
import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';
import { todayIn } from '@/lib/time';
import { AppProviders } from '@/providers/AppProviders';
import { useIsOffline } from '@/providers/BudgetSync';
import type { TripOverview } from '@/schemas';
import { tokens } from '@/theme/tokens';

import { ExpensesScreen } from '../ExpensesScreen';

// The whole screen on the real in-memory expense repository (jest.setup.ts): the sheet writes, the timeline and the budget read back.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useNavigation: () => ({ openDrawer: jest.fn() }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/hooks/useTrips');
jest.mock('@/hooks/useProfile');
jest.mock('@/hooks/useExpenses', () => {
  const actual = jest.requireActual('@/hooks/useExpenses');
  return { ...actual, useSaveExpense: jest.fn(actual.useSaveExpense) };
});
jest.mock('@/providers/BudgetSync', () => ({ ...jest.requireActual('@/providers/BudgetSync'), useIsOffline: jest.fn() }));
jest.mock('@/lib/time', () => ({ ...jest.requireActual('@/lib/time'), todayIn: jest.fn() }));
// The native picker is replaced by a button that "picks" 5 Nov 2026.
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    DateTimePicker: (props: { mode: string; value: Date; onValueChange: (e: object, d: Date) => void }) => (
      <Pressable testID="picker" onPress={() => props.onValueChange({}, new Date(Date.UTC(2026, 10, 5, 12, 0)))}>
        <Text>{`picker ${props.mode} ${props.value.toISOString()}`}</Text>
      </Pressable>
    ),
  };
});

// Add-then-edit flows run the real in-memory SQLite and can pass the 5 s default on a loaded machine.
jest.setTimeout(20000);

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const OWNER = '11111111-1111-4111-8111-111111111111';
const FRIEND_USER = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const TODAY = '2026-11-01';
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

function setup({ me = OWNER, offline = false }: { me?: string; offline?: boolean } = {}) {
  jest.mocked(useCurrentTrip).mockReturnValue({ isPending: false, isError: false, data: { overview, budgetSyncStatus: 'synced' } } as never);
  jest.mocked(useMyProfileId).mockReturnValue(me);
  jest.mocked(useIsTripOwner).mockImplementation((ownerId) => ownerId === me);
  jest.mocked(useIsOffline).mockReturnValue(offline);
  jest.mocked(todayIn).mockReturnValue(TODAY);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders>
        <ExpensesScreen />
      </AppProviders>
    </SafeAreaProvider>,
  );
}

// D24: the empty state's action is the only add button until there is an expense; then the FAB.
// The screen ignores presses beneath a sheet that has just closed (its closing animation); wait that out.
const closingAnimation = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, tokens.motion.duration.slow + 20)));
const openAdd = async () => {
  await closingAnimation();
  const empty = await screen.findByTestId(/^(expenses-empty|fab-add-expense)$/, {}, { timeout: 3000 });
  await fireEvent.press(empty.props.testID === 'fab-add-expense' ? empty : within(empty).getByRole('button'));
};
const saveButton = () => screen.getByRole('button', { name: 'Zapisz wydatek' });
const sheetOpen = () => screen.queryByRole('button', { name: 'Zapisz wydatek' }) !== null;

async function fill({ amount, category, name }: { amount?: string; category?: string; name?: string }) {
  if (amount !== undefined) await fireEvent.changeText(screen.getByLabelText('Kwota'), amount);
  if (category) await fireEvent.press(screen.getByRole('checkbox', { name: category }));
  if (name !== undefined) await fireEvent.changeText(screen.getByLabelText('Nazwa'), name);
}

async function addExpense(fields: { amount: string; category: string; name: string }) {
  await openAdd();
  await fill(fields);
  await fireEvent.press(saveButton());
  await waitFor(() => expect(sheetOpen()).toBe(false));
  await closingAnimation();
}

beforeEach(async () => {
  jest.clearAllMocks();
  const actual = jest.requireActual('@/hooks/useExpenses');
  jest.mocked(useSaveExpense).mockImplementation(actual.useSaveExpense);
  await i18n.changeLanguage('pl');
});

describe('ExpenseSheet: adding (expenses step 10)', () => {
  it('opens with the amount focused and the trip currency beside it (D5, D21)', async () => {
    await setup();
    await openAdd();
    expect(screen.getByRole('header', { name: 'Dodaj wydatek' })).toBeOnTheScreen();
    const amount = screen.getByLabelText('Kwota');
    expect(amount.props.autoFocus).toBe(true);
    expect(amount.props.keyboardType).toBe('decimal-pad');
    expect(within(screen.getByTestId('amount-field-box')).getByText('PLN')).toBeOnTheScreen();
  });

  it('has no category chosen by default, the organizer as payer and today as the date', async () => {
    await setup();
    await openAdd();
    for (const name of ['Jedzenie', 'Transport', 'Nocleg', 'Atrakcje', 'Inne']) {
      expect(screen.getByRole('checkbox', { name })).not.toBeChecked();
    }
    expect(screen.getByRole('checkbox', { name: 'Ty' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Data' })).toHaveTextContent('1 lis 2026');
  });

  it('a reopened add sheet starts with no category again', async () => {
    await setup();
    await openAdd();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Atrakcje' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Zamknij' })[0]);
    await openAdd();
    expect(screen.getByRole('checkbox', { name: 'Atrakcje' })).not.toBeChecked();
  });

  it('shows no errors until Save is pressed, then names what is missing', async () => {
    await setup();
    await openAdd();
    expect(screen.queryByText('Wpisz kwotę')).toBeNull();
    await fireEvent.press(saveButton());
    expect(screen.getByText('Wpisz kwotę')).toBeOnTheScreen();
    expect(screen.getByText('Wybierz kategorię')).toBeOnTheScreen();
    expect(screen.getByText('Podaj nazwę wydatku')).toBeOnTheScreen();
    expect(sheetOpen()).toBe(true);
  });

  it('rejects an amount of 0 on Save, and an amount that is not a number while typing', async () => {
    await setup();
    await openAdd();
    await fill({ amount: '0', category: 'Jedzenie', name: 'Kolacja' });
    expect(screen.queryByText('Kwota musi być większa od zera')).toBeNull();
    await fireEvent.press(saveButton());
    expect(screen.getByText('Kwota musi być większa od zera')).toBeOnTheScreen();
    expect(sheetOpen()).toBe(true);
    await fill({ amount: 'abc' });
    expect(screen.getByText('Wpisz kwotę liczbą, np. 2500 lub 2500,50')).toBeOnTheScreen();
  });

  it('saves, closes at once, and the timeline and the budget update (offline: "waiting to sync")', async () => {
    await setup({ offline: true });
    await addExpense({ amount: '45,50', category: 'Jedzenie', name: 'Kolacja' });
    expect(screen.getByText('Wydatek zapisany. Czeka na wysłanie.')).toBeOnTheScreen();
    const row = await screen.findByTestId('expense-day-2026-11-01');
    expect(within(row).getByText('Kolacja')).toBeOnTheScreen();
    expect(within(row).getByText('Ty')).toBeOnTheScreen();
    expect(screen.getByText(`Zostało ${money(300000 - 4550)}`)).toBeOnTheScreen();
  });

  it('online it confirms with the plain message', async () => {
    await setup();
    await addExpense({ amount: '10', category: 'Transport', name: 'Taxi' });
    expect(screen.getByText('Wydatek zapisany')).toBeOnTheScreen();
  });

  it('the owner can pick who spent it (D15)', async () => {
    await setup();
    await openAdd();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Piotr' }));
    expect(screen.getByRole('checkbox', { name: 'Piotr' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ty' })).not.toBeChecked();
    await fill({ amount: '20', category: 'Nocleg', name: 'Hostel' });
    await fireEvent.press(saveButton());
    const row = await screen.findByTestId('expense-day-2026-11-01');
    expect(within(row).getByText('Piotr')).toBeOnTheScreen();
  });

  it('a linked friend has a fixed "Ty" and the expense is on their own row (D15)', async () => {
    await setup({ me: FRIEND_USER });
    await openAdd();
    expect(screen.getByText('Ty')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Ola' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Piotr' })).toBeNull();
    await fill({ amount: '30', category: 'Atrakcje', name: 'Bilety' });
    await fireEvent.press(saveButton());
    const row = await screen.findByTestId('expense-day-2026-11-01');
    expect(within(row).getByText('Ola')).toBeOnTheScreen();
  });

  it('any date can be chosen (D10)', async () => {
    await setup();
    await openAdd();
    await fireEvent.press(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByText('picker date 2026-11-01T00:00:00.000Z')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('picker'));
    expect(screen.getByRole('button', { name: 'Data' })).toHaveTextContent('5 lis 2026');
    await fill({ amount: '12', category: 'Inne', name: 'Pamiątka' });
    await fireEvent.press(saveButton());
    expect(await screen.findByTestId('expense-day-2026-11-05')).toBeOnTheScreen();
  });

  it('closing the sheet discards what was typed', async () => {
    await setup();
    await openAdd();
    await fill({ amount: '99', category: 'Jedzenie', name: 'Nie zapisuj' });
    await fireEvent.press(screen.getAllByRole('button', { name: 'Zamknij' })[0]);
    expect(sheetOpen()).toBe(false);
    expect(screen.queryByText('Nie zapisuj')).toBeNull();
    expect(screen.getByText('Brak wydatków')).toBeOnTheScreen();
  });

  it('a failed local save keeps the sheet and the values, and says so above Save', async () => {
    jest.mocked(useSaveExpense).mockReturnValue({
      mutate: (_input: unknown, options?: { onError?: (error: Error) => void }) => options?.onError?.(new Error('disk full')),
      isPending: false,
    } as never);
    await setup();
    await openAdd();
    await fill({ amount: '45', category: 'Jedzenie', name: 'Kolacja' });
    await fireEvent.press(saveButton());
    expect(await screen.findByText('Nie udało się zapisać wydatku.')).toBeOnTheScreen();
    expect(sheetOpen()).toBe(true);
    expect(screen.getByLabelText('Kwota').props.value).toBe('45');
    expect(screen.getByLabelText('Nazwa').props.value).toBe('Kolacja');
    expect(screen.getByRole('checkbox', { name: 'Jedzenie' })).toBeChecked();
  });

  it('works in English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    await openAdd();
    expect(screen.getByRole('header', { name: 'Add expense' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(screen.getByText('Enter an amount')).toBeOnTheScreen();
    expect(screen.getByText('Choose a category')).toBeOnTheScreen();
  });

  it('the FAB appears once the first expense is saved (D24)', async () => {
    await setup();
    expect(screen.queryByTestId('fab-add-expense')).toBeNull();
    await addExpense({ amount: '10', category: 'Transport', name: 'Taxi' });
    expect(await screen.findByTestId('fab-add-expense')).toBeOnTheScreen();
    expect(screen.queryByTestId('expenses-empty')).toBeNull();
  });

  it('a double tap on Save makes one expense', async () => {
    await setup();
    await openAdd();
    await fill({ amount: '10', category: 'Transport', name: 'Taxi' });
    await act(async () => {
      void fireEvent.press(saveButton());
      void fireEvent.press(saveButton());
    });
    await waitFor(() => expect(sheetOpen()).toBe(false));
    const day = await screen.findByTestId('expense-day-2026-11-01');
    expect(within(day).getAllByTestId(/^expense-item-/)).toHaveLength(1);
  });
});

describe('ExpenseSheet: editing and deleting (expenses step 10)', () => {
  it('a row opens the sheet filled in; saving updates the same expense', async () => {
    await setup();
    await addExpense({ amount: '45,50', category: 'Jedzenie', name: 'Kolacja' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Kolacja' }));
    expect(screen.getByRole('header', { name: 'Edytuj wydatek' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Kwota').props.value).toBe('45,50');
    expect(screen.getByLabelText('Nazwa').props.value).toBe('Kolacja');
    expect(screen.getByRole('checkbox', { name: 'Jedzenie' })).toBeChecked();
    await fill({ name: 'Obiad', amount: '50' });
    await fireEvent.press(saveButton());
    await waitFor(() => expect(sheetOpen()).toBe(false));
    const day = await screen.findByTestId('expense-day-2026-11-01');
    await waitFor(() => expect(within(day).getByText('Obiad')).toBeOnTheScreen());
    expect(within(day).queryByText('Kolacja')).toBeNull();
    expect(within(day).getAllByTestId(/^expense-item-/)).toHaveLength(1);
    expect(screen.getByText(`Zostało ${money(300000 - 5000)}`)).toBeOnTheScreen();
  });

  it('Delete is only in edit mode, asks first, and the row leaves the timeline', async () => {
    await setup();
    await openAdd();
    expect(screen.queryByRole('button', { name: 'Usuń wydatek' })).toBeNull();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Zamknij' })[0]);
    await addExpense({ amount: '45', category: 'Jedzenie', name: 'Kolacja' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Kolacja' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usuń wydatek' }));
    expect(screen.getByText('Usunąć ten wydatek?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(sheetOpen()).toBe(false));
    await waitFor(() => expect(screen.queryByText('Kolacja')).toBeNull());
    expect(screen.getByText('Brak wydatków')).toBeOnTheScreen();
    expect(screen.getByText(`Zostało ${money(300000)}`)).toBeOnTheScreen();
  });

  it('cancelling the confirmation keeps the expense and the sheet', async () => {
    await setup();
    await addExpense({ amount: '45', category: 'Jedzenie', name: 'Kolacja' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Kolacja' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usuń wydatek' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Anuluj' }));
    await waitFor(() => expect(screen.queryByText('Usunąć ten wydatek?')).toBeNull()); // the dialog fades out first
    expect(sheetOpen()).toBe(true);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Zamknij' })[0]);
    expect(within(await screen.findByTestId('expense-day-2026-11-01')).getByText('Kolacja')).toBeOnTheScreen();
  });
});
