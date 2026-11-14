import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { fetchAppPlaceDetails, fetchAppTripPlan, generateAppTripPlan } from '@/data/app-trip-plan';
import { LOCAL_PROFILE_ID } from '@/data/profile-repository';
import { TripPlanCallError } from '@/data/trip-plan';
import { useCurrentTrip } from '@/hooks/useTrips';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import type { GenerateTripPlanRequest, PlaceDetails, TripPlan } from '@/schemas';
import { setAppProfileRepository, repositoryWithProfile } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';

import { PlanScreen } from '../PlanScreen';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/hooks/useTrips');
jest.mock('@/data/app-places', () => ({ fetchAppPlaceRecommendations: jest.fn() }));
jest.mock('@/data/app-trip-plan', () => ({ generateAppTripPlan: jest.fn(), fetchAppTripPlan: jest.fn(), fetchAppPlaceDetails: jest.fn() }));

const mockConfirmProps: { destructive?: boolean }[] = [];
jest.mock('@/components/ConfirmDialog', () => {
  const actual = jest.requireActual('@/components/ConfirmDialog');
  return { ConfirmDialog: (props: { destructive?: boolean }) => (mockConfirmProps.push(props), actual.ConfirmDialog(props)) };
});

const mockResultMounts = jest.fn();
jest.mock('../PlanResult', () => {
  const React = jest.requireActual('react');
  const actual = jest.requireActual('../PlanResult');
  return { PlanResult: (props: object) => (React.useEffect(() => mockResultMounts(), []), actual.PlanResult(props)) };
});

const TRIP_ID = '00000000-0000-4000-8000-0000000000a1';
const mockRequest: GenerateTripPlanRequest = { tripId: TRIP_ID, scope: { kind: 'city_only' }, extraCities: [], preferences: [], locale: 'pl' };
// The wizard has its own tests; here it is a stand-in that reports its destination.
jest.mock('../PlanWizard', () => ({
  PlanWizard: ({ destination, onSubmit, onCancel }: { destination: { iata: string }; onSubmit: (r: unknown) => void; onCancel: () => void }) => {
    const { Pressable, Text, View } = jest.requireActual('react-native');
    return (
      <View testID="wizard">
        <Text>{`wizard ${destination.iata}`}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="stub-submit" onPress={() => onSubmit(mockRequest)} />
        <Pressable accessibilityRole="button" accessibilityLabel="stub-cancel" onPress={onCancel} />
      </View>
    );
  },
}));

const plan: TripPlan = {
  tripId: TRIP_ID,
  model: 'm',
  createdAt: '2026-11-14T10:00:00+01:00',
  days: [{ date: '2026-12-01', cityIata: 'LIS', items: [{ placeId: 'p1', slot: 'morning', reason: 'Nice view', forPeople: ['owner'] }] }],
};
const place: PlaceDetails = { placeId: 'p1', name: 'Alfama', address: null, googleMapsUri: 'https://maps.google.com/?cid=1' };

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

const mockTrip = (ownerId: string, id = TRIP_ID, destination = 'LIS') =>
  jest.mocked(useCurrentTrip).mockReturnValue({ isPending: false, isError: false, data: { overview: { trip: { id, ownerId, destination } } } } as never);

async function open(ownerId: string = LOCAL_PROFILE_ID, destination = 'LIS') {
  mockTrip(ownerId, TRIP_ID, destination);
  setAppProfileRepository(await repositoryWithProfile());
  await renderRouter({ _layout: Layout, plan: PlanScreen }, { initialUrl: '/plan' });
}

const button = (name: string) => screen.getByRole('button', { name });
const ownerReady = async () => {
  await open();
  await screen.findByRole('button', { name: 'Ułóż plan z AI' });
};

beforeEach(async () => {
  mockResultMounts.mockClear();
  jest.mocked(fetchAppTripPlan).mockReset();
  jest.mocked(fetchAppPlaceDetails).mockReset();
  jest.mocked(generateAppTripPlan).mockReset();
  setNetwork({ isConnected: true, isInternetReachable: true });
  await i18n.changeLanguage('pl');
  jest.mocked(fetchAppTripPlan).mockResolvedValue(null);
  jest.mocked(fetchAppPlaceDetails).mockResolvedValue({ p1: place });
});

describe('Plan side of the Plan tab (ai-trip-plan step 9)', () => {
  it('shows skeletons while the plan loads', async () => {
    jest.mocked(fetchAppTripPlan).mockReturnValue(new Promise(() => {}));
    await open();
    expect(screen.getByLabelText('Wczytuję plan')).toBeTruthy();
  });

  it('shows an error with retry when the plan fails to load', async () => {
    jest.mocked(fetchAppTripPlan).mockRejectedValueOnce(new TripPlanCallError('failed', 'x'));
    await open();
    expect(await screen.findByText('Nie udało się wczytać planu.')).toBeTruthy();
    await fireEvent.press(button('Spróbuj ponownie'));
    expect(await screen.findByRole('button', { name: 'Ułóż plan z AI' })).toBeTruthy();
  });

  it('offline: banner, disabled generate, message instead of a saved plan', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    jest.mocked(fetchAppTripPlan).mockResolvedValue(plan);
    await open();
    await waitFor(() => expect(screen.getByTestId('offline-banner')).toBeTruthy());
    expect(screen.getByText('Plan wymaga internetu.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Ułóż plan z AI' })).toBeDisabled();
    expect(screen.queryByText('Alfama')).toBeNull();
  });

  it('owner without a plan: empty state, wizard with the destination, cancel goes back', async () => {
    await ownerReady();
    expect(screen.getByText('Nie masz jeszcze planu podróży')).toBeTruthy();
    await fireEvent.press(button('Ułóż plan z AI'));
    expect(screen.getByText('wizard LIS')).toBeTruthy();
    await fireEvent.press(button('stub-cancel'));
    expect(screen.getByText('Nie masz jeszcze planu podróży')).toBeTruthy();
  });

  it('owner: wizard submit shows generating, then the plan with names', async () => {
    let resolve: (v: unknown) => void = () => {};
    jest.mocked(generateAppTripPlan).mockReturnValue(new Promise((r) => (resolve = r)) as never);
    await ownerReady();
    await fireEvent.press(button('Ułóż plan z AI'));
    await fireEvent.press(button('stub-submit'));
    expect(await screen.findByText('Układam plan podróży…')).toBeTruthy();
    expect(generateAppTripPlan).toHaveBeenCalledWith(mockRequest);
    resolve({ plan, places: [place], remainingToday: 2 });
    expect(await screen.findByText('Alfama')).toBeTruthy();
    expect(fetchAppPlaceDetails).not.toHaveBeenCalled();
  });

  it('linked friend without a plan: read-only message, no button', async () => {
    await open('someone-else');
    expect(await screen.findByText('Organizator nie ułożył jeszcze planu.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ułóż plan z AI' })).toBeNull();
  });

  it('linked friend with a plan: sees it, cannot regenerate', async () => {
    jest.mocked(fetchAppTripPlan).mockResolvedValue(plan);
    await open('someone-else');
    expect(await screen.findByText('Alfama')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ułóż ponownie' })).toBeNull();
  });

  it('plan details failing shows an error with retry instead of the plan', async () => {
    jest.mocked(fetchAppTripPlan).mockResolvedValue(plan);
    jest.mocked(fetchAppPlaceDetails).mockRejectedValueOnce(new TripPlanCallError('failed', 'x'));
    await open();
    expect(await screen.findByText('Nie udało się wczytać miejsc.')).toBeTruthy();
    await fireEvent.press(button('Spróbuj ponownie'));
    expect(await screen.findByText('Alfama')).toBeTruthy();
  });

  it('regenerate asks first: cancel keeps the plan, confirm opens the wizard', async () => {
    jest.mocked(fetchAppTripPlan).mockResolvedValue(plan);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ułóż ponownie' }));
    expect(screen.getByText('Zastąpić obecny plan?')).toBeTruthy();
    await fireEvent.press(button('Anuluj'));
    expect(screen.queryByText('wizard LIS')).toBeNull();
    expect(screen.getByText('Alfama')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ułóż ponownie' }));
    await fireEvent.press(button('Zastąp'));
    expect(screen.getByText('wizard LIS')).toBeTruthy();
  });

  it('the replace confirmation is destructive', async () => {
    jest.mocked(fetchAppTripPlan).mockResolvedValue(plan);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ułóż ponownie' }));
    expect(mockConfirmProps.at(-1)?.destructive).toBe(true);
  });

  it('without a known destination airport there is no generate button and no regenerate', async () => {
    await open(LOCAL_PROFILE_ID, 'ZZZ');
    await screen.findByText('Nie masz jeszcze planu podróży');
    expect(screen.queryByRole('button', { name: 'Ułóż plan z AI' })).toBeNull();
  });

  it('no regenerate when the destination airport is unknown', async () => {
    jest.mocked(fetchAppTripPlan).mockResolvedValue(plan);
    await open(LOCAL_PROFILE_ID, 'ZZZ');
    await screen.findByText('Alfama');
    expect(screen.queryByRole('button', { name: 'Ułóż ponownie' })).toBeNull();
  });

  it('switching the trip resets a generation error', async () => {
    jest.mocked(generateAppTripPlan).mockRejectedValue(new TripPlanCallError('failed', 'x'));
    await ownerReady();
    await fireEvent.press(button('Ułóż plan z AI'));
    await fireEvent.press(button('stub-submit'));
    await screen.findByText('Nie udało się ułożyć planu');
    mockTrip(LOCAL_PROFILE_ID, '00000000-0000-4000-8000-0000000000a2');
    await act(async () => {
      await i18n.changeLanguage('en'); // the hook is mocked: a language change re-renders the screen
    });
    expect(await screen.findByText('No trip plan yet')).toBeTruthy();
    expect(screen.queryByText("Couldn't build the plan")).toBeNull();
  });

  describe('failed regeneration keeps the plan (§12.11)', () => {
    const regenerateWith = async (kind: ConstructorParameters<typeof TripPlanCallError>[0]) => {
      jest.mocked(fetchAppTripPlan).mockResolvedValue(plan);
      jest.mocked(generateAppTripPlan).mockRejectedValue(new TripPlanCallError(kind, 'x'));
      await open();
      await fireEvent.press(await screen.findByRole('button', { name: 'Ułóż ponownie' }));
      await fireEvent.press(button('Zastąp'));
      await fireEvent.press(button('stub-submit'));
    };

    it('shows the plan with an inline error, retry re-sends the last request, dismiss hides it', async () => {
      await regenerateWith('failed');
      expect(await screen.findByText('Nie udało się ułożyć planu')).toBeTruthy();
      expect(screen.getByText('Alfama')).toBeTruthy();
      jest.mocked(generateAppTripPlan).mockReturnValue(new Promise(() => {}) as never);
      await fireEvent.press(button('Spróbuj ponownie'));
      expect(generateAppTripPlan).toHaveBeenLastCalledWith(mockRequest);
      expect(await screen.findByText('Układam plan podróży…')).toBeTruthy();
    });

    it('keeps PlanResult mounted while the error shows and is dismissed (no replayed animation)', async () => {
      await regenerateWith('no_places');
      await screen.findByRole('button', { name: 'Anuluj' });
      await screen.findByText('Alfama');
      mockResultMounts.mockClear();
      await fireEvent.press(screen.getAllByRole('button', { name: 'Anuluj' })[0]);
      await waitFor(() => expect(screen.queryByText(/Nie znaleźliśmy wystarczającej/)).toBeNull());
      expect(screen.getByText('Alfama')).toBeTruthy();
      expect(mockResultMounts).not.toHaveBeenCalled();
    });

    it('can be dismissed', async () => {
      await regenerateWith('no_places');
      await fireEvent.press(await screen.findByRole('button', { name: 'Anuluj' }));
      expect(screen.queryByText('Nie znaleźliśmy wystarczającej liczby pasujących miejsc. Zmień zainteresowania albo zakres dnia.')).toBeNull();
      expect(await screen.findByText('Alfama')).toBeTruthy();
    });

    it('limit: message above the plan, no retry', async () => {
      await regenerateWith('limit_reached');
      expect(await screen.findByText('Wykorzystano dzisiejszy limit planów (3). Spróbuj jutro.')).toBeTruthy();
      expect(screen.getByText('Alfama')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
    });
  });

  describe('generation errors', () => {
    const fail = async (kind: ConstructorParameters<typeof TripPlanCallError>[0]) => {
      jest.mocked(generateAppTripPlan).mockRejectedValue(new TripPlanCallError(kind, 'x'));
      await ownerReady();
      await fireEvent.press(button('Ułóż plan z AI'));
      await fireEvent.press(button('stub-submit'));
    };

    it('limit_reached: the daily limit, no retry', async () => {
      await fail('limit_reached');
      expect(await screen.findByText('Wykorzystano dzisiejszy limit planów (3). Spróbuj jutro.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
    });
    it('no_places', async () => {
      await fail('no_places');
      expect(await screen.findByText('Nie znaleźliśmy wystarczającej liczby pasujących miejsc. Zmień zainteresowania albo zakres dnia.')).toBeTruthy();
    });
    it('offline', async () => {
      await fail('offline');
      expect(await screen.findByText('Generowanie planu wymaga internetu.')).toBeTruthy();
    });
    it('failed: title, retry re-sends the same request and shows generating (D21)', async () => {
      await fail('failed');
      expect(await screen.findByText('Nie udało się ułożyć planu')).toBeTruthy();
      jest.mocked(generateAppTripPlan).mockReturnValue(new Promise(() => {}) as never);
      await fireEvent.press(button('Spróbuj ponownie'));
      expect(await screen.findByText('Układam plan podróży…')).toBeTruthy();
      expect(generateAppTripPlan).toHaveBeenCalledTimes(2);
      expect(generateAppTripPlan).toHaveBeenLastCalledWith(mockRequest);
      expect(screen.queryByText('wizard LIS')).toBeNull();
    });
    it('is in English too', async () => {
      await i18n.changeLanguage('en');
      jest.mocked(generateAppTripPlan).mockRejectedValue(new TripPlanCallError('limit_reached', 'x'));
      await open();
      await fireEvent.press(await screen.findByRole('button', { name: 'Plan with AI' }));
      await fireEvent.press(button('stub-submit'));
      expect(await screen.findByText("You've used today's plan limit (3). Try again tomorrow.")).toBeTruthy();
    });
  });
});
