import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';

import { ProfileScreen } from '../ProfileScreen';

// The profile is not there yet (still being read) and the trip list is whatever the test sets.
type TripsQuery = { data: unknown[] | undefined; isPending: boolean; isError: boolean };
let mockTrips: TripsQuery = { data: [], isPending: false, isError: false };
jest.mock('@/hooks/useProfile', () => ({ useMyProfile: () => ({ data: undefined }) }));
jest.mock('@/hooks/useTrips', () => ({ useTripList: () => mockTrips }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

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
