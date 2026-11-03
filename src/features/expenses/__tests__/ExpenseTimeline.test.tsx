import { fireEvent, render, screen, within } from '@testing-library/react-native';

import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';
import { useRequestBudgetSync } from '@/providers/BudgetSync';
import type { LocalExpense, PersonBudget } from '@/schemas';

import { ExpenseTimeline } from '../ExpenseTimeline';

jest.mock('@/providers/BudgetSync');

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const OLA = '33333333-3333-4333-8333-333333333333';
const PIOTR = '44444444-4444-4444-8444-444444444444';
const GHOST = '55555555-5555-4555-8555-555555555555';
const money = (amountMinor: number) => formatMoney({ amountMinor, currency: 'PLN' }, 'pl');
const none = { food: 0, transport: 0, stay: 0, activities: 0, other: 0 };
const person = (memberId: string | null, displayName: string): PersonBudget => ({ memberId, displayName, spentMinor: 0, leftMinor: 0, byCategory: none });
const people = [person(null, 'Ty'), person(OLA, 'Ola'), person(PIOTR, 'Piotr')];

let nextId = 0;
const expense = (over: Partial<LocalExpense> = {}): LocalExpense => ({
  id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
  tripId: TRIP_ID,
  memberId: null,
  name: 'Kolacja',
  amount: { amountMinor: 5000, currency: 'PLN' },
  category: 'food',
  spentOn: '2026-11-03',
  createdAt: '2026-11-03T10:00:00.000Z',
  updatedAt: '2026-11-03T10:00:00.000Z',
  deletedAt: null,
  syncStatus: 'synced',
  attempts: 0,
  ...over,
});

const requestSync = jest.fn();
const onEditExpense = jest.fn();
const ownerCan = () => true;
const friendCan = (e: { memberId: string | null }) => e.memberId === OLA;

function setup(expenses: LocalExpense[], canEdit: (e: { memberId: string | null }) => boolean = ownerCan, edit: typeof onEditExpense | null = onEditExpense) {
  return render(<ExpenseTimeline expenses={expenses} people={people} currency="PLN" canEdit={canEdit} onEditExpense={edit ?? undefined} />);
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useRequestBudgetSync).mockReturnValue(requestSync);
  await i18n.changeLanguage('pl');
});

describe('ExpenseTimeline (expenses step 9, D12)', () => {
  it('groups by day, newest day first, with the day total and currency in the header', async () => {
    await setup([
      expense({ spentOn: '2026-11-03', amount: { amountMinor: 1000, currency: 'PLN' } }),
      expense({ spentOn: '2026-11-05', amount: { amountMinor: 2000, currency: 'PLN' } }),
      expense({ spentOn: '2026-11-05', amount: { amountMinor: 3000, currency: 'PLN' } }),
    ]);
    const days = screen.getAllByTestId(/^expense-day-[0-9]/);
    expect(days.map((d) => d.props.testID)).toEqual(['expense-day-2026-11-05', 'expense-day-2026-11-03']);
    const header = within(days[0]).getByRole('header');
    expect(header).toHaveTextContent(/5/);
    expect(within(days[0]).getByTestId('expense-day-total')).toHaveTextContent(money(5000));
    expect(within(days[1]).getByTestId('expense-day-total')).toHaveTextContent(money(1000));
  });

  it('shows name, person, amount and an accessible summary with the category on the row', async () => {
    const e = expense({ memberId: OLA, name: 'Taxi', category: 'transport', amount: { amountMinor: 4550, currency: 'PLN' } });
    await setup([e]);
    const row = screen.getByTestId(`expense-row-${e.id}`);
    expect(within(row).getByText('Taxi')).toBeOnTheScreen();
    expect(within(row).getByText('Ola')).toBeOnTheScreen();
    expect(within(row).getByText(money(4550))).toBeOnTheScreen();
    expect(row).toHaveAccessibilityValue({ text: `Transport, Ola, ${money(4550)}` });
    expect(row.props.accessibilityLabel).toBe('Taxi');
  });

  it('names the organizer with the same name as the chart', async () => {
    const e = expense({ memberId: null });
    await setup([e]);
    expect(within(screen.getByTestId(`expense-row-${e.id}`)).getByText('Ty')).toBeOnTheScreen();
  });

  it('keeps newest created first within a day and leaves out deleted rows', async () => {
    const a = expense({ name: 'Pierwszy', createdAt: '2026-11-03T08:00:00.000Z' });
    const b = expense({ name: 'Drugi', createdAt: '2026-11-03T09:00:00.000Z' });
    const gone = expense({ name: 'Usunięty', deletedAt: '2026-11-03T11:00:00.000Z' });
    await setup([a, b, gone]);
    expect(screen.getAllByTestId(/^expense-row-/).map((r) => r.props.testID)).toEqual([`expense-row-${b.id}`, `expense-row-${a.id}`]);
    expect(screen.queryByText('Usunięty')).toBeNull();
  });

  it('shows pending and failed status in words; synced shows none', async () => {
    const p = expense({ syncStatus: 'pending' });
    const f = expense({ syncStatus: 'failed' });
    const s = expense({ syncStatus: 'synced' });
    await setup([p, f, s]);
    expect(within(screen.getByTestId(`expense-item-${p.id}`)).getByText('Czeka na wysłanie')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`expense-item-${f.id}`)).getByText('Nie udało się wysłać')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`expense-item-${s.id}`)).queryByTestId('sync-indicator')).toBeNull();
  });

  it('retries a failed expense without opening it', async () => {
    const f = expense({ syncStatus: 'failed' });
    await setup([f]);
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(requestSync).toHaveBeenCalledTimes(1);
    expect(onEditExpense).not.toHaveBeenCalled();
  });

  it('owner: pressing any row calls onEditExpense with that expense', async () => {
    const mine = expense({ memberId: null, name: 'Moje' });
    const theirs = expense({ memberId: PIOTR, name: 'Cudze' });
    await setup([mine, theirs]);
    await fireEvent.press(screen.getByTestId(`expense-row-${theirs.id}`));
    expect(onEditExpense).toHaveBeenCalledWith(theirs);
    await fireEvent.press(screen.getByTestId(`expense-row-${mine.id}`));
    expect(onEditExpense).toHaveBeenCalledWith(mine);
  });

  it('linked friend: only their own rows are pressable buttons', async () => {
    const own = expense({ memberId: OLA, name: 'Moje' });
    const other = expense({ memberId: PIOTR, name: 'Cudze' });
    await setup([own, other], friendCan);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId(`expense-row-${other.id}`));
    expect(onEditExpense).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(`expense-row-${own.id}`));
    expect(onEditExpense).toHaveBeenCalledWith(own);
  });

  it('is not pressable without onEditExpense', async () => {
    await setup([expense()], ownerCan, null);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not crash on an unknown member: the row shows no person', async () => {
    const e = expense({ memberId: GHOST, name: 'Tajemniczy' });
    await setup([e]);
    const row = screen.getByTestId(`expense-row-${e.id}`);
    expect(within(row).getByText('Tajemniczy')).toBeOnTheScreen();
    expect(row).toHaveAccessibilityValue({ text: `Jedzenie, ${money(5000)}` });
  });
});
