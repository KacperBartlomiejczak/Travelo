import { useFonts } from 'expo-font';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Pressable, ScrollView, Text } from 'react-native';

import RootLayout from '@/app/_layout';
import TripsScreen from '@/app/index';
import BudgetStep from '@/app/trips/new/budget';
import FriendsStep from '@/app/trips/new/friends';
import NewTripLayout from '@/app/trips/new/_layout';
import SummaryStep from '@/app/trips/new/summary';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useGoToNextStep } from '@/features/trip-create/WizardScreen';
import i18n from '@/i18n';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

// Stand-in for step 1 (tested in flights.test.tsx): sets the companion count and moves on.
function FlightsWithCompanions() {
  const { setCompanionCount } = useTripDraft();
  const goNext = useGoToNextStep('flights');
  return (
    <>
      <Pressable onPress={() => setCompanionCount(2)}>
        <Text>test: two friends</Text>
      </Pressable>
      <Pressable onPress={goNext}>
        <Text>test: next</Text>
      </Pressable>
    </>
  );
}

async function openFriends() {
  const rendered = renderRouter(
    {
      _layout: RootLayout,
      index: TripsScreen,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': FlightsWithCompanions,
      'trips/new/friends': FriendsStep,
      'trips/new/budget': BudgetStep,
      'trips/new/summary': SummaryStep,
    },
    { initialUrl: '/' },
  );
  await rendered;
  await fireEvent.press(screen.getByText('Utwórz podróż'));
  await fireEvent.press(screen.getByText('test: two friends'));
  await fireEvent.press(screen.getByText('test: next'));
  return { getPathname: () => rendered.getPathname() };
}

const friend = (number: number) => within(screen.getByTestId(`friend-${number}`));

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('Friends step', () => {
  it('shows one card per companion (D10, D32)', async () => {
    const app = await openFriends();
    expect(app.getPathname()).toBe('/trips/new/friends');
    expect(screen.getByRole('header', { name: 'Kto leci z Tobą?' })).toBeTruthy();
    expect(screen.getByText('Zaznacz, co lubią — plan dnia to uwzględni.')).toBeTruthy();
    expect(screen.getByText('Znajomy 1')).toBeTruthy();
    expect(screen.getByText('Znajomy 2')).toBeTruthy();
    expect(screen.queryByText('Znajomy 3')).toBeNull();
  });

  it('shows all 17 interests in the 6 groups (D11)', async () => {
    await openFriends();
    const first = friend(1);
    for (const group of ['Zabawa', 'Natura', 'Kultura', 'Jedzenie', 'Aktywnie', 'Relaks i inne']) {
      expect(first.getByText(group)).toBeTruthy();
    }
    expect(first.getAllByRole('checkbox')).toHaveLength(17);
    expect(first.getByRole('checkbox', { name: 'Imprezy i nocne życie' })).toBeTruthy();
    expect(first.getByRole('checkbox', { name: 'Aquaparki i parki rozrywki' })).toBeTruthy();
    expect(first.getByRole('checkbox', { name: 'Muzea' })).toBeTruthy();
  });

  it('toggles interests per friend', async () => {
    await openFriends();
    await fireEvent.press(friend(1).getByRole('checkbox', { name: 'Plaże' }));
    expect(friend(1).getByRole('checkbox', { name: 'Plaże' })).toBeChecked();
    expect(friend(2).getByRole('checkbox', { name: 'Plaże' })).not.toBeChecked();
    await fireEvent.press(friend(1).getByRole('checkbox', { name: 'Plaże' }));
    expect(friend(1).getByRole('checkbox', { name: 'Plaże' })).not.toBeChecked();
  });

  it('needs a name for every friend; interests are optional (D16)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const app = await openFriends();
    await fireEvent.changeText(friend(1).getByLabelText('Imię'), 'Kasia');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/friends');
    expect(friend(2).getByText('Wpisz imię')).toBeTruthy();
    expect(friend(1).queryByText('Wpisz imię')).toBeNull();
    expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
    announce.mockRestore();
  });

  it('limits names to the schema length, with the limit in the message', async () => {
    await openFriends();
    await fireEvent.changeText(friend(1).getByLabelText('Imię'), 'a'.repeat(41));
    await fireEvent.changeText(friend(2).getByLabelText('Imię'), 'Ola');
    await fireEvent.press(screen.getByText('Dalej'));
    expect(friend(1).getByText('Imię może mieć do 40 znaków')).toBeTruthy();
  });

  it('scrolls to the first friend with an error (as D29)', async () => {
    const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);
    scrollTo.mockClear();
    await openFriends();
    await fireEvent.changeText(friend(1).getByLabelText('Imię'), 'Kasia');
    await fireEvent(screen.getByTestId('friend-2'), 'layout', { nativeEvent: { layout: { x: 0, y: 700, width: 335, height: 900 } } });
    await fireEvent.press(screen.getByText('Dalej'));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 700 - 16, animated: true });
  });

  it('moves on to the budget when every friend has a name', async () => {
    const app = await openFriends();
    await fireEvent.changeText(friend(1).getByLabelText('Imię'), 'Kasia');
    await fireEvent.changeText(friend(2).getByLabelText('Imię'), 'Ola');
    await fireEvent.press(friend(2).getByRole('checkbox', { name: 'Muzea' }));
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/budget');
  });
});
