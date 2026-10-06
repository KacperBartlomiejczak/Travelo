import { useFonts } from 'expo-font';
import { router, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import RootLayout from '@/app/_layout';
import TripsScreen from '@/app/index';
import BudgetStep from '@/app/trips/new/budget';
import NewTripLayout from '@/app/trips/new/_layout';
import { emptySegment, withCompanionCount } from '@/features/trip-create/draft';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import i18n from '@/i18n';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

type Destination = { iata: string; tz: string };
const BKK = { iata: 'BKK', tz: 'Asia/Bangkok' };
const BCN = { iata: 'BCN', tz: 'Europe/Madrid' };
const NRT = { iata: 'NRT', tz: 'Asia/Tokyo' };

// Stand-in for steps 1–2: WAW → destination on 3 Nov, back on 15 Nov (13 days), with `companions` friends.
function filledSteps(companions: number, first: Destination) {
  return function FilledFlights() {
    const { setDraft } = useTripDraft();
    const navigate = useRouter();
    function fill(destination: Destination) {
      setDraft((draft) =>
        withCompanionCount(
          {
            ...draft,
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
      index: TripsScreen,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': filledSteps(companions, destination),
      'trips/new/budget': BudgetStep,
      'trips/new/summary': SummaryStandIn,
    },
    { initialUrl: '/' },
  );
  await rendered;
  await fireEvent.press(screen.getByText('Utwórz podróż'));
  await fireEvent.press(screen.getByText('test: fill and go to budget'));
  return { getPathname: () => rendered.getPathname() };
}

// Stand-in for step 4 (the real summary needs friends' names, which this stand-in draft skips).
function SummaryStandIn() {
  return <Text>summary</Text>;
}

const amountBox = () => within(screen.getByTestId('amount-field-box'));

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Budget step', () => {
  it('asks for the budget per person, without flights (D5, D33, D37)', async () => {
    await openBudget();
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toBeTruthy();
    expect(screen.getByText('Na cały wyjazd, bez lotów: noclegi, jedzenie, atrakcje, transport na miejscu.')).toBeTruthy();
    expect(screen.getByLabelText('Kwota na osobę')).toBeTruthy();
  });

  it('speaks to a solo traveller in the singular (D37)', async () => {
    await openBudget(0);
    expect(screen.getByRole('header', { name: 'Ile chcesz wydać?' })).toBeTruthy();
    expect(screen.getByLabelText('Kwota')).toBeTruthy();
  });

  it('preselects the destination currency and offers PLN, EUR, USD (D8, D34)', async () => {
    await openBudget();
    expect(screen.getAllByRole('radio').map((option) => option.props.accessibilityLabel)).toEqual(['THB', 'PLN', 'EUR', 'USD']);
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

  it('shows the group total and the daily amount per person (D35)', async () => {
    await openBudget(2);
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '3000');
    expect(screen.getByText('Razem dla 3 osób: 9000 THB')).toBeTruthy();
    expect(screen.getByText('~231 THB dziennie na osobę')).toBeTruthy();
  });

  it('follows the chosen currency', async () => {
    await openBudget(2);
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '3000');
    await fireEvent.press(screen.getByRole('radio', { name: 'EUR' }));
    expect(screen.getByText('Razem dla 3 osób: 9000 EUR')).toBeTruthy();
  });

  it('shows no group total when travelling alone', async () => {
    await openBudget(0);
    await fireEvent.changeText(screen.getByLabelText('Kwota'), '3000');
    expect(screen.queryByText(/Razem dla/)).toBeNull();
    expect(screen.getByText('~231 THB dziennie na osobę')).toBeTruthy();
  });

  it('flags an amount that is not a number while typing (§10.5)', async () => {
    await openBudget();
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '12,5,0');
    expect(screen.getByText('Wpisz kwotę liczbą, np. 2500 lub 2500,50')).toBeTruthy();
  });

  it('gives a whole-number example for currencies without minor units', async () => {
    await openBudget(2, NRT);
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500,50');
    expect(screen.getByText('Wpisz kwotę liczbą, np. 2500')).toBeTruthy();
  });

  it.each([
    ['', 'Wpisz kwotę'],
    ['0', 'Kwota musi być większa od zera'],
    ['abc', 'Wpisz kwotę liczbą, np. 2500 lub 2500,50'],
  ])('does not move on with %p and announces it', async (text, message) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const app = await openBudget();
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), text);
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/budget');
    expect(screen.getByText(message)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
  });

  it('moves on to the summary with a valid amount', async () => {
    const app = await openBudget();
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500,50');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/summary');
  });
});
