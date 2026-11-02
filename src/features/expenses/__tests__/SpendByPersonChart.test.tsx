import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';
import type { PersonBudget } from '@/schemas';

import { SpendByPersonChart } from '../SpendByPersonChart';

const money = (amountMinor: number) => formatMoney({ amountMinor, currency: 'PLN' }, 'pl');
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const FRIEND = '33333333-3333-4333-8333-333333333333';
const hidden = { includeHiddenElements: true };
const none = { food: 0, transport: 0, stay: 0, activities: 0, other: 0 };

const organizer: PersonBudget = {
  memberId: null,
  displayName: 'Ty',
  spentMinor: 4000,
  leftMinor: 6000,
  byCategory: { ...none, food: 3000, stay: 1000 },
};
const friend: PersonBudget = { memberId: FRIEND, displayName: 'Ola', spentMinor: 0, leftMinor: 10000, byCategory: none };

const chart = (people: PersonBudget[]) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <SpendByPersonChart people={people} currency="PLN" />
  </SafeAreaProvider>
);

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('SpendByPersonChart (expenses D8, D19)', () => {
  it('shows the heading and one row per traveler, organizer first', async () => {
    await render(chart([organizer, friend]));
    expect(screen.getByText('Ile kto wydał')).toBeOnTheScreen();
    const rows = screen.getAllByTestId(/^spend-row-/);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Ty')).toBeOnTheScreen();
    expect(within(rows[1]).getByText('Ola')).toBeOnTheScreen();
  });

  it('shows spent and left with currency, and a summary label on the row', async () => {
    await render(chart([organizer]));
    const row = screen.getByTestId('spend-row-organizer');
    expect(within(row).getByText(`Wydane ${money(4000)}`)).toBeOnTheScreen();
    expect(within(row).getByText(`Zostało ${money(6000)}`)).toBeOnTheScreen();
    expect(row).toHaveAccessibilityValue({ text: `Wydane ${money(4000)}, Zostało ${money(6000)}` });
    expect(screen.getByRole('button', { name: 'Ty' })).toBeOnTheScreen();
  });

  it('splits the bar into segments proportional to the category amounts', async () => {
    await render(chart([organizer]));
    expect(screen.getByTestId('spend-segment-organizer-food', hidden)).toHaveStyle({ flex: 3000 });
    expect(screen.getByTestId('spend-segment-organizer-stay', hidden)).toHaveStyle({ flex: 1000 });
    expect(screen.queryByTestId('spend-segment-organizer-transport', hidden)).toBeNull();
    // 4000 of a 10000 budget fills 40 % of the track.
    expect(screen.getByTestId('spend-fill-organizer', hidden)).toHaveStyle({ width: '40%' });
  });

  it('lists a legend with icon, label and value for the used categories only', async () => {
    await render(chart([organizer]));
    const row = screen.getByTestId('spend-row-organizer');
    expect(within(row).getByText('Jedzenie')).toBeOnTheScreen();
    expect(within(row).getByText(money(3000))).toBeOnTheScreen();
    expect(within(row).getByText('Nocleg')).toBeOnTheScreen();
    expect(within(row).getByText(money(1000))).toBeOnTheScreen();
    expect(within(row).queryByText('Transport')).toBeNull();
    expect(within(row).getByTestId('spend-legend-icon-organizer-food', hidden)).toBeOnTheScreen();
  });

  it('keeps a zero-spend traveler as a row with an empty bar and no legend', async () => {
    await render(chart([organizer, friend]));
    const row = screen.getByTestId(`spend-row-${FRIEND}`);
    expect(within(row).getByText(`Wydane ${money(0)}`)).toBeOnTheScreen();
    expect(within(row).getByText(`Zostało ${money(10000)}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`spend-fill-${FRIEND}`, hidden)).toHaveStyle({ width: '0%' });
    expect(within(row).queryByText('Jedzenie')).toBeNull();
  });

  it('fills the bar fully and says "ponad budżet" when over budget', async () => {
    const over: PersonBudget = { ...organizer, spentMinor: 12000, leftMinor: -2000, byCategory: { ...none, food: 12000 } };
    await render(chart([over]));
    const row = screen.getByTestId('spend-row-organizer');
    expect(screen.getByTestId('spend-fill-organizer', hidden)).toHaveStyle({ width: '100%' });
    expect(within(row).getByText(`${money(2000)} ponad budżet`)).toBeOnTheScreen();
  });

  it('opens a sheet with all five categories in fixed order when a row is pressed', async () => {
    await render(chart([organizer]));
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ty' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(within(sheet).getByText('Ty')).toBeOnTheScreen();
    const labels = ['Jedzenie', 'Transport', 'Nocleg', 'Atrakcje', 'Inne'];
    labels.forEach((label) => expect(within(sheet).getByText(label)).toBeOnTheScreen());
    expect(within(sheet).getByText(money(3000))).toBeOnTheScreen();
    expect(within(sheet).getAllByText(money(0))).toHaveLength(3);
    expect(within(sheet).getByText(`Wydane ${money(4000)}`)).toBeOnTheScreen();
  });

  it('closes the sheet', async () => {
    await render(chart([organizer]));
    await fireEvent.press(screen.getByRole('button', { name: 'Ty' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByText('Atrakcje')).toBeNull();
  });

  it('is in English too', async () => {
    await i18n.changeLanguage('en');
    await render(chart([organizer]));
    expect(screen.getByText('Who spent what')).toBeOnTheScreen();
    expect(screen.getByText('Food')).toBeOnTheScreen();
    expect(screen.getByText(`${formatMoney({ amountMinor: 4000, currency: 'PLN' }, 'en')} spent`)).toBeOnTheScreen();
  });
});
