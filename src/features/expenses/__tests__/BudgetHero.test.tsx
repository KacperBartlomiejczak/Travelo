import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import { drawsCircleAlert } from '@/test/alert-icon';
import { lightTheme } from '@/theme/theme';
import { formatMoney } from '@/lib/money';
import type { GroupBudget, PersonBudget } from '@/schemas';

import { BudgetHero } from '../BudgetHero';

const money = (amountMinor: number) => formatMoney({ amountMinor, currency: 'PLN' }, 'pl');

const group: GroupBudget = { spentMinor: 10000, leftMinor: 40000, today: { allowedMinor: 5000, leftMinor: 3000, carryoverMinor: 1000 } };
const me: PersonBudget = {
  memberId: null,
  displayName: 'Ty',
  spentMinor: 4000,
  leftMinor: 20000,
  byCategory: { food: 0, transport: 0, stay: 0, activities: 0, other: 0 },
  today: { allowedMinor: 2000, leftMinor: 500, carryoverMinor: 0 },
};

const hero = (g: GroupBudget = group, p: PersonBudget | null = me) => <BudgetHero group={g} me={p ?? undefined} currency="PLN" />;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('BudgetHero (expenses D7, D9, D10)', () => {
  it('starts on the group and shows what is left', async () => {
    await render(hero());
    expect(screen.getByText(`Zostało ${money(40000)}`)).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Grupa' })).toBeChecked();
  });

  it('switches the number to the own budget on "Ja" and back', async () => {
    await render(hero());
    await fireEvent.press(screen.getByRole('radio', { name: 'Ja' }));
    expect(screen.getByText(`Zostało ${money(20000)}`)).toBeOnTheScreen();
    expect(screen.queryByText(`Zostało ${money(40000)}`)).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Grupa' }));
    expect(screen.getByText(`Zostało ${money(40000)}`)).toBeOnTheScreen();
  });

  it('shows today and the carryover only when it is above zero', async () => {
    await render(hero());
    expect(screen.getByText(`Zostało dziś ${money(3000)}`)).toBeOnTheScreen();
    expect(screen.getByText(`+${money(1000)} z poprzednich dni`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ja' }));
    expect(screen.getByText(`Zostało dziś ${money(500)}`)).toBeOnTheScreen();
    expect(screen.queryByText(/z poprzednich dni/)).toBeNull();
  });

  it('has no "today" line outside the trip (D10)', async () => {
    await render(hero({ ...group, today: undefined }, { ...me, today: undefined }));
    expect(screen.getByText(`Zostało ${money(40000)}`)).toBeOnTheScreen();
    expect(screen.queryByText(/dziś/)).toBeNull();
    expect(screen.queryByText(/z poprzednich dni/)).toBeNull();
  });

  it('says "ponad budżet" when the left amount is negative', async () => {
    await render(hero({ ...group, leftMinor: -2500, today: undefined }));
    expect(screen.getByText(`${money(2500)} ponad budżet`)).toBeOnTheScreen();
    expect(screen.queryByText(/^Zostało/)).toBeNull();
  });

  it('says today is over the plan, and that it is used up at zero', async () => {
    await render(hero({ ...group, today: { allowedMinor: 100, leftMinor: -700, carryoverMinor: 0 } }));
    expect(screen.getByText(`Dziś ${money(700)} ponad plan`)).toBeOnTheScreen();
    await screen.unmount();
    await render(hero({ ...group, today: { allowedMinor: 100, leftMinor: 0, carryoverMinor: 0 } }));
    expect(screen.getByText('Dzisiejszy plan budżetu jest wykorzystany')).toBeOnTheScreen();
  });

  it('has no toggle when there is no own row, and speaks English', async () => {
    await i18n.changeLanguage('en');
    await render(hero(group, null));
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText(`${formatMoney({ amountMinor: 3000, currency: 'PLN' }, 'en')} left today`)).toBeOnTheScreen();
  });

  describe('budget states (design-context §2.7, §13.9)', () => {
    const withToday = (allowedMinor: number, leftMinor: number) => hero({ ...group, today: { allowedMinor, leftMinor, carryoverMinor: 0 } });
    const icons = () => ({
      near: screen.queryByTestId('budget-icon-near', { includeHiddenElements: true }),
      over: screen.queryByTestId('budget-icon-over', { includeHiddenElements: true }),
    });

    it('under (spent up to 80% of today): under color, no icon', async () => {
      await render(withToday(5000, 1000));
      expect(screen.getByText(`Zostało dziś ${money(1000)}`)).toHaveStyle({ color: lightTheme.budget.under.foreground });
      expect(icons()).toEqual({ near: null, over: null });
    });

    it('near (above 80% up to 100%): near color and a triangle', async () => {
      await render(withToday(5000, 500));
      expect(screen.getByText(`Zostało dziś ${money(500)}`)).toHaveStyle({ color: lightTheme.budget.near.foreground });
      expect(icons().near).toBeTruthy();
      expect(icons().over).toBeNull();
    });

    it('exactly 80% is still under, 100% (nothing left) is near', async () => {
      await render(withToday(5000, 1000));
      expect(icons().near).toBeNull();
      await screen.unmount();
      await render(withToday(5000, 0));
      expect(screen.getByText('Dzisiejszy plan budżetu jest wykorzystany')).toHaveStyle({ color: lightTheme.budget.near.foreground });
      expect(icons().near).toBeTruthy();
    });

    it('over today: over color and a CircleAlert, with the exceeded amount', async () => {
      await render(withToday(5000, -700));
      expect(screen.getByText(`Dziś ${money(700)} ponad plan`)).toHaveStyle({ color: lightTheme.budget.over.foreground });
      expect(drawsCircleAlert(icons().over as object)).toBe(true);
    });

    it('over the whole budget: the main line uses the over color and a CircleAlert', async () => {
      await render(hero({ ...group, leftMinor: -2500, today: undefined }));
      expect(screen.getByText(`${money(2500)} ponad budżet`)).toHaveStyle({ color: lightTheme.budget.over.foreground });
      expect(drawsCircleAlert(icons().over as object)).toBe(true);
    });
  });
});
