import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';

import { ProfileScreen } from '../ProfileScreen';

// The profile is not there yet (still being read) and the trip list is whatever the test sets.
type TripsQuery = { data: unknown[] | undefined; isPending: boolean; isError: boolean };
let mockTrips: TripsQuery = { data: [], isPending: false, isError: false };
let mockOffline = false;
jest.mock('@/providers/BudgetSync', () => ({ useIsOffline: () => mockOffline }));
let mockPro = true;
jest.mock('@/providers/Purchases', () => ({ useIsPro: () => mockPro }));
let mockProfile: unknown;
const mockSelect = jest.fn();
const mockNavigate = jest.fn();
let mockCurrentId: string | undefined;
jest.mock('@/hooks/useProfile', () => ({
  useMyProfile: () => ({ data: mockProfile, refetch: jest.fn() }),
  useChangeAvatar: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useTrips', () => ({
  useTripList: () => mockTrips,
  useSelectTrip: () => ({ mutate: mockSelect }),
  useCurrentTrip: () => ({ data: mockCurrentId ? { overview: { trip: { id: mockCurrentId } } } : undefined }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: mockNavigate }) }));

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ProfileScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(async () => {
  mockTrips = { data: [], isPending: false, isError: false };
  mockProfile = undefined;
  mockPro = true;
  mockOffline = false;
  mockCurrentId = undefined;
  mockSelect.mockReset();
  mockNavigate.mockReset();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await i18n.changeLanguage('pl');
});

describe('ProfileScreen without a profile', () => {
  it('renders the header and the stats and no profile row', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Profil' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeTruthy();
    expect(screen.queryByTestId('profile-row')).toBeNull();
    expect(screen.getByLabelText('0 Podróże')).toBeTruthy();
  });
});

describe('ProfileScreen — the trip list failed (A2)', () => {
  it('shows a dash for every stat when there is no list at all, read as "no data" — no retry, no blame', async () => {
    mockTrips = { data: undefined, isPending: false, isError: true };
    await renderScreen();
    expect(screen.getAllByText('–')).toHaveLength(5);
    expect(screen.getByLabelText('brak danych Podróże')).toBeTruthy();
    expect(screen.queryAllByTestId('stat-skeleton', { includeHiddenElements: true })).toHaveLength(0);
    expect(screen.queryByText('Spróbuj ponownie')).toBeNull();
  });

  it('keeps the numbers it already has when a later read fails', async () => {
    mockTrips = {
      data: [
        {
          id: '00000000-0000-4000-8000-0000000000b1',
          name: 'Past',
          coverImageUri: 'preset:auckland',
          destination: 'JFK',
          flights: [{ fromIata: 'WAW', toIata: 'JFK' }],
          startDate: '2024-05-01',
          endDate: '2024-05-05',
        },
      ],
      isPending: false,
      isError: true,
    };
    await renderScreen();
    expect(screen.getByLabelText('1 Podróże')).toBeTruthy();
    expect(screen.getByLabelText('5 Dni w podróży')).toBeTruthy();
    expect(screen.queryByText('–')).toBeNull();
  });
});

const PAST = (id: string, name: string) => ({
  id,
  name,
  coverImageUri: 'preset:auckland',
  destination: 'JFK',
  flights: [],
  startDate: '2024-05-01',
  endDate: '2024-05-05',
});
const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';

describe('ProfileScreen — badge and friend code', () => {
  it('shows the PRO badge next to the nick and the friend code card when the profile is there', async () => {
    mockProfile = { profile: { username: 'kacper', avatarId: null, friendCode: 'ABC234' } };
    await renderScreen();
    expect(screen.getByLabelText('Konto PRO')).toBeTruthy();
    expect(screen.getByText('ABC234')).toBeTruthy();
  });

  it('keeps a long nick wrapping while the PRO badge stays fully visible', async () => {
    mockProfile = { profile: { username: 'kacperbartlomiejczak', avatarId: null, friendCode: 'ABC234' } };
    await renderScreen();
    expect(screen.getByTestId('profile-name-row')).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId('pro-badge')).toHaveStyle({ flexShrink: 0 });
  });

  it('hides the PRO badge when the account is not PRO but still shows the friend code', async () => {
    mockPro = false;
    mockProfile = { profile: { username: 'kacper', avatarId: null, friendCode: 'ABC234' } };
    await renderScreen();
    expect(screen.queryByTestId('pro-badge')).toBeNull();
    expect(screen.getByText('ABC234')).toBeTruthy();
  });

  it('shows neither before the profile is there', async () => {
    await renderScreen();
    expect(screen.queryByLabelText('Konto PRO')).toBeNull();
    expect(screen.queryByText('Kod znajomego')).toBeNull();
  });
});

describe('ProfileScreen — past trips', () => {
  const trips = () => [PAST(A, 'Alpha'), PAST(B, 'Beta'), { ...PAST('00000000-0000-4000-8000-0000000000c3', 'Future'), startDate: '2999-01-01', endDate: '2999-01-05' }];

  it('shows a card for each past trip only', async () => {
    mockTrips = { data: trips(), isPending: false, isError: false };
    await renderScreen();
    expect(screen.getByTestId(`past-trip-card-${A}`)).toBeTruthy();
    expect(screen.getByTestId(`past-trip-card-${B}`)).toBeTruthy();
    expect(screen.queryByText('Future')).toBeNull();
  });

  it('selects the tapped trip once and goes home', async () => {
    mockTrips = { data: trips(), isPending: false, isError: false };
    await renderScreen();
    fireEvent.press(screen.getByTestId(`past-trip-card-${A}`));
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledWith(A);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('only goes home when the current trip is tapped', async () => {
    mockCurrentId = A;
    mockTrips = { data: trips(), isPending: false, isError: false };
    await renderScreen();
    fireEvent.press(screen.getByTestId(`past-trip-card-${A}`));
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows the loading state while the list loads', async () => {
    mockTrips = { data: undefined, isPending: true, isError: false };
    await renderScreen();
    expect(screen.getAllByTestId('past-trip-skeleton', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  it('shows the error message when there is no list', async () => {
    mockTrips = { data: undefined, isPending: false, isError: true };
    await renderScreen();
    expect(screen.queryByTestId(`past-trip-card-${A}`)).toBeNull();
    expect(screen.getByText(i18n.t('profile.pastError'))).toBeTruthy();
  });

  it('keeps the cards when a later read fails', async () => {
    mockTrips = { data: trips(), isPending: false, isError: true };
    await renderScreen();
    expect(screen.getByTestId(`past-trip-card-${A}`)).toBeTruthy();
  });
});

describe('ProfileScreen — past trips, the rules', () => {
  const C = '00000000-0000-4000-8000-0000000000c3';
  const D = '00000000-0000-4000-8000-0000000000d4';
  const list = () => [
    PAST(A, 'Older'),
    { ...PAST(B, 'Newer'), startDate: '2024-09-01', endDate: '2024-09-05' },
    { ...PAST(C, 'Ongoing'), startDate: '2000-01-01', endDate: '2999-01-01' },
    // D10: linked-member trip (another organizer, more travellers); TripListItem has no owner field, so it is a card like any other.
    { ...PAST(D, 'Linked member'), travellerCount: 4, startDate: '2023-01-01', endDate: '2023-01-05' },
  ];

  it('does not make a card of an ongoing trip, orders newest finished first and includes the linked-member trip', async () => {
    mockTrips = { data: list(), isPending: false, isError: false };
    await renderScreen();
    expect(screen.queryByTestId(`past-trip-card-${C}`)).toBeNull();
    const ids = (await screen.findAllByTestId(/^past-trip-card-/, { includeHiddenElements: true })).map((node) => node.props.testID);
    expect(ids).toEqual([`past-trip-card-${B}`, `past-trip-card-${A}`, `past-trip-card-${D}`]);
  });

  it('has as many cards as the "Podróże" stat, and the stats card still shows its values (D6)', async () => {
    mockTrips = { data: list(), isPending: false, isError: false };
    await renderScreen();
    expect(await screen.findAllByTestId(/^past-trip-card-/, { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.getByLabelText('3 Podróże')).toBeTruthy();
  });

  it('offline: cards and the offline banner show, the friend code is there and sharing still works', async () => {
    mockOffline = true;
    mockProfile = { profile: { username: 'kacper', avatarId: null, friendCode: 'ABC234' } };
    mockTrips = { data: list(), isPending: false, isError: true };
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderScreen();
    expect(await screen.findByTestId(`past-trip-card-${A}`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
    expect(screen.getByText('ABC234')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Udostępnij kod znajomego' }));
    expect(share).toHaveBeenCalledTimes(1);
  });
});
