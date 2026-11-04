import { useFonts } from 'expo-font';
import { router, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import RootLayout from '@/app/_layout';
import BudgetStep from '@/app/trips/new/budget';
import NewTripLayout from '@/app/trips/new/_layout';
import { emptyFriend, emptySegment, withCompanionCount } from '@/features/trip-create/draft';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

type Destination = { iata: string; tz: string };
const BKK = { iata: 'BKK', tz: 'Asia/Bangkok' };
const BCN = { iata: 'BCN', tz: 'Europe/Madrid' };
const NRT = { iata: 'NRT', tz: 'Asia/Tokyo' };

// Stand-in for steps 1–2: WAW → destination on 3 Nov, back on 15 Nov (13 days), with `companions` friends (Kasia, Ola).
function filledSteps(companions: number, first: Destination) {
  return function FilledFlights() {
    const { setDraft } = useTripDraft();
    const navigate = useRouter();
    function fill(destination: Destination) {
      setDraft((draft) =>
        withCompanionCount(
          {
            ...draft,
            friends: [{ ...emptyFriend(), displayName: 'Kasia' }, { ...emptyFriend(), displayName: 'Ola' }].slice(0, companions),
            outbound: [{ ...emptySegment(), fromIata: 'WAW', departTz: 'Europe/Warsaw', toIata: destination.iata, arriveTz: destination.tz, departAt: '2026-11-02T22:00', arriveAt: '2026-11-03T14:00' }],
            return: [{ ...emptySegment(), fromIata: destination.iata, departTz: destination.tz, toIata: 'WAW', arriveTz: 'Europe/Warsaw', departAt: '2026-11-15T09:00', arriveAt: '2026-11-15T17:00' }],
          },
          companions,
        ),
      );
      navigate.push('/trips/new/budget');
    }
    return (
      <>
        <Pressable onPress={() => fill(first)}>
          <Text>test: fill and go to budget</Text>
        </Pressable>
        <Pressable onPress={() => fill(BCN)}>
          <Text>test: fly to Barcelona instead</Text>
        </Pressable>
      </>
    );
  };
}

async function openBudget(companions = 2, destination: Destination = BKK) {
  const rendered = renderRouter(
    {
      _layout: RootLayout,
      '(drawer)/_layout': DrawerLayout,
      '(drawer)/(tabs)/_layout': TabsLayout,
      '(drawer)/(tabs)/index': HomeScreen,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': filledSteps(companions, destination),
      'trips/new/budget': BudgetStep,
      'trips/new/summary': SummaryStandIn,
    },
    { initialUrl: '/' },
  );
  await rendered;
  await fireEvent.press(await screen.findByText('Utwórz podróż'));
  await fireEvent.press(screen.getByText('test: fill and go to budget'));
  return { getPathname: () => rendered.getPathname() };
}

// Stand-in for step 4.
function SummaryStandIn() {
  return <Text>summary</Text>;
}

const amountBox = () => within(screen.getByTestId('amount-field-box'));
const SHARED = 'Kwota dziennie na osobę';
// Amounts of 5+ digits are grouped in Polish, so expectations come from the formatter.
const money = (major: number, currency = 'THB') => formatMoney({ amountMinor: major * 100, currency }, 'pl');

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Budget step', () => {
  it('asks for the daily budget per person, without flights (B1)', async () => {
    await openBudget();
    expect(screen.getByRole('header', { name: 'Ile każdy może wydać dziennie?' })).toBeTruthy();
    expect(screen.getByText(/^Bez lotów: noclegi/)).toBeTruthy();
    expect(screen.getByLabelText(SHARED)).toBeTruthy();
  });

  it('speaks to a solo traveller in the singular, with no switch (B1)', async () => {
    await openBudget(0);
    expect(screen.getByRole('header', { name: 'Ile chcesz wydać dziennie?' })).toBeTruthy();
    expect(screen.getByLabelText('Kwota dziennie')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Osobno' })).toBeNull();
  });

  it('offers Razem / Osobno when travelling with friends, Razem first', async () => {
    await openBudget();
    expect(screen.getByRole('radio', { name: 'Razem' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Osobno' })).not.toBeChecked();
  });

  it('shows one field for everyone in Razem, and one per person in Osobno', async () => {
    await openBudget();
    expect(screen.queryByLabelText('Kasia')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    expect(screen.getByLabelText('Ty')).toBeTruthy();
    expect(screen.getByLabelText('Kasia')).toBeTruthy();
    expect(screen.getByLabelText('Ola')).toBeTruthy();
    expect(screen.queryByLabelText(SHARED)).toBeNull();
  });

  it('prefills everyone with the shared amount when switching to Osobno', async () => {
    await openBudget();
    await fireEvent.changeText(screen.getByLabelText(SHARED), '200');
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    for (const name of ['Ty', 'Kasia', 'Ola']) expect(screen.getByLabelText(name).props.value).toBe('200');
  });

  it("uses the organizer's amount for everyone when switching back to Razem", async () => {
    await openBudget();
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    await fireEvent.changeText(screen.getByLabelText('Ty'), '300');
    await fireEvent.changeText(screen.getByLabelText('Kasia'), '100');
    await fireEvent.press(screen.getByRole('radio', { name: 'Razem' }));
    expect(screen.getByLabelText(SHARED).props.value).toBe('300');
    expect(screen.getByText(`Razem dla 3 osób: ${money(11700)}`)).toBeTruthy();
  });

  it('preselects the destination currency and offers PLN, EUR, USD (D8, D34)', async () => {
    await openBudget();
    const labels = screen.getAllByRole('radio').map((option) => option.props.accessibilityLabel);
    expect(labels.filter((label) => label !== 'Razem' && label !== 'Osobno')).toEqual(['THB', 'PLN', 'EUR', 'USD']);
    expect(screen.getByRole('radio', { name: 'THB' })).toBeChecked();
    expect(amountBox().getByText('THB')).toBeTruthy();
  });

  it("follows a new destination's currency when none was picked by hand (D36)", async () => {
    await openBudget();
    await act(() => router.back());
    await fireEvent.press(screen.getByText('test: fly to Barcelona instead'));
    expect(screen.getByRole('radio', { name: 'EUR' })).toBeChecked();
    expect(amountBox().getByText('EUR')).toBeTruthy();
  });

  it('keeps a hand-picked currency when the destination changes (D36)', async () => {
    await openBudget();
    await fireEvent.press(screen.getByRole('radio', { name: 'PLN' }));
    await act(() => router.back());
    await fireEvent.press(screen.getByText('test: fly to Barcelona instead'));
    expect(screen.getByRole('radio', { name: 'PLN' })).toBeChecked();
  });

  it('shows the total per person and for the group over the trip days (13)', async () => {
    await openBudget(2);
    await fireEvent.changeText(screen.getByLabelText(SHARED), '3000');
    expect(screen.getByText(`${money(39000)} na osobę na podróż`)).toBeTruthy();
    expect(screen.getByText(`Razem dla 3 osób: ${money(117000)}`)).toBeTruthy();
  });

  it('shows each person their own total for the trip in Osobno', async () => {
    await openBudget(2);
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    await fireEvent.changeText(screen.getByLabelText('Ty'), '3000');
    await fireEvent.changeText(screen.getByLabelText('Kasia'), '2000');
    await fireEvent.changeText(screen.getByLabelText('Ola'), '1000');
    expect(screen.getByText(`Ty: ${money(39000)} na podróż`)).toBeTruthy();
    expect(screen.getByText(`Kasia: ${money(26000)} na podróż`)).toBeTruthy();
    expect(screen.getByText(`Ola: ${money(13000)} na podróż`)).toBeTruthy();
    expect(screen.getByText(`Razem dla 3 osób: ${money(78000)}`)).toBeTruthy();
  });

  it('follows the chosen currency', async () => {
    await openBudget(2);
    await fireEvent.changeText(screen.getByLabelText(SHARED), '3000');
    await fireEvent.press(screen.getByRole('radio', { name: 'EUR' }));
    expect(screen.getByText(`Razem dla 3 osób: ${money(117000, 'EUR')}`)).toBeTruthy();
  });

  it('shows no group total when travelling alone, only the total for the trip', async () => {
    await openBudget(0);
    await fireEvent.changeText(screen.getByLabelText('Kwota dziennie'), '3000');
    expect(screen.queryByText(/Razem dla/)).toBeNull();
    expect(screen.getByText(`${money(39000)} na podróż`)).toBeTruthy();
  });

  it('flags an amount that is not a number while typing (§10.5)', async () => {
    await openBudget();
    await fireEvent.changeText(screen.getByLabelText(SHARED), '12,5,0');
    expect(screen.getByText('Wpisz kwotę liczbą, np. 2500 lub 2500,50')).toBeTruthy();
  });

  it('flags a friend amount that is not a number while typing', async () => {
    await openBudget();
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    await fireEvent.changeText(screen.getByLabelText('Kasia'), 'abc');
    expect(screen.getByText('Wpisz kwotę liczbą, np. 2500 lub 2500,50')).toBeTruthy();
  });

  it('gives a whole-number example for currencies without minor units', async () => {
    await openBudget(2, NRT);
    await fireEvent.changeText(screen.getByLabelText(SHARED), '2500,50');
    expect(screen.getByText('Wpisz kwotę liczbą, np. 2500')).toBeTruthy();
  });

  it.each([
    ['', 'Wpisz kwotę'],
    ['0', 'Kwota musi być większa od zera'],
    ['abc', 'Wpisz kwotę liczbą, np. 2500 lub 2500,50'],
  ])('does not move on with %p and announces it', async (text, message) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const app = await openBudget();
    await fireEvent.changeText(screen.getByLabelText(SHARED), text);
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/budget');
    expect(screen.getByText(message)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
  });

  it('does not move on in Osobno while a friend amount is empty, and flags that field', async () => {
    const app = await openBudget();
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    await fireEvent.changeText(screen.getByLabelText('Ty'), '100');
    await fireEvent.changeText(screen.getByLabelText('Kasia'), '100');
    await fireEvent.changeText(screen.getByLabelText('Ola'), '');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/budget');
    expect(screen.getByText('Wpisz kwotę')).toBeTruthy();
  });

  it('moves on to the summary with a valid amount', async () => {
    const app = await openBudget();
    await fireEvent.changeText(screen.getByLabelText(SHARED), '2500,50');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/summary');
  });

  it('moves on to the summary with separate valid amounts', async () => {
    const app = await openBudget();
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    await fireEvent.changeText(screen.getByLabelText('Ty'), '100');
    await fireEvent.changeText(screen.getByLabelText('Kasia'), '200');
    await fireEvent.changeText(screen.getByLabelText('Ola'), '300');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/summary');
  });
});
