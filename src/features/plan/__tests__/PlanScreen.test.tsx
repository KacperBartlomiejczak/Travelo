import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { useCurrentTrip } from '@/hooks/useTrips';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { setAppProfileRepository, repositoryWithProfile } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';
import { tokens } from '@/theme/tokens';

import { PlanScreen } from '../PlanScreen';

const insets = { top: 47, left: 0, right: 0, bottom: 34 };
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));
jest.mock('@/hooks/useTrips');
jest.mock('@/data/app-places', () => ({ fetchAppPlaceRecommendations: jest.fn() }));

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

async function open(trip: Partial<ReturnType<typeof useCurrentTrip>> = { isPending: false, isError: false, data: { overview: {} } as never }) {
  jest.mocked(useCurrentTrip).mockReturnValue({ isPending: false, isError: false, data: null, ...trip } as never);
  setAppProfileRepository(await repositoryWithProfile());
  await renderRouter({ _layout: Layout, plan: PlanScreen }, { initialUrl: '/plan' });
}

const placeholder = () => screen.queryByText('Ten ekran pojawi się wkrótce.');
const searchButton = () => screen.queryByRole('button', { name: 'Szukaj miejsc' });
const radio = (name: string) => screen.getByRole('radio', { name });
const clearance = insets.bottom + tokens.spacing[3] + tokens.components.tabs.height + 2 * tokens.components.tabs.containerPadding;
const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('PlanScreen without a current trip (D3)', () => {
  const noSwitch = () => {
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByLabelText('Widok ekranu Plan')).toBeNull();
    expect(screen.getByRole('header', { name: 'Plan' })).toBeTruthy();
    expect(placeholder()).toBeTruthy();
  };
  it('shows the current title and placeholder, no switch, with no trips', async () => {
    await open({ data: null });
    noSwitch();
  });
  it('does the same while loading', async () => {
    await open({ isPending: true, data: undefined });
    noSwitch();
  });
  it('does the same on error', async () => {
    await open({ isError: true, data: undefined });
    noSwitch();
  });
});

describe('PlanScreen (plan-discover-switch D1-D6)', () => {
  it('starts in Plan mode: labelled switch, Plan selected, placeholder shown, no Discover form', async () => {
    await open();
    expect(screen.getByLabelText('Widok ekranu Plan').props.accessibilityRole).toBe('radiogroup');
    expect(radio('Plan')).toBeChecked();
    expect(radio('Odkryj')).not.toBeChecked();
    expect(placeholder()).toBeTruthy();
    expect(searchButton()).toBeNull();
    expect(screen.queryByLabelText('Miasto')).toBeNull();
  });

  it('shows Discover under the switch after tapping Odkryj, and the placeholder is gone', async () => {
    await open();
    await fireEvent.press(radio('Odkryj'));
    expect(radio('Odkryj')).toBeChecked();
    expect(screen.getByLabelText('Miasto')).toBeTruthy();
    expect(searchButton()).toBeTruthy();
    expect(placeholder()).toBeNull();
    expect(radio('Plan')).toBeTruthy();
  });

  it('returns to the placeholder after tapping Plan', async () => {
    await open();
    await fireEvent.press(radio('Odkryj'));
    await fireEvent.press(radio('Plan'));
    expect(radio('Plan')).toBeChecked();
    expect(placeholder()).toBeTruthy();
    expect(searchButton()).toBeNull();
  });

  it('changes nothing when the selected option is tapped again', async () => {
    await open();
    await fireEvent.press(radio('Plan'));
    expect(radio('Plan')).toBeChecked();
    expect(placeholder()).toBeTruthy();
  });

  it('in Discover mode offline shows the banner and disables search', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    await open();
    await fireEvent.press(radio('Odkryj'));
    await waitFor(() => expect(screen.getByTestId('offline-banner')).toBeTruthy());
    expect(searchButton()).toBeDisabled();
  });

  it('keeps the content clear of the floating pill in Plan mode', async () => {
    await open();
    expect(style(screen.getByTestId('plan-content')).paddingBottom).toBeGreaterThanOrEqual(clearance + tokens.spacing[4]);
  });

  it('keeps the pinned Discover footer clear of the floating pill', async () => {
    await open();
    await fireEvent.press(radio('Odkryj'));
    expect(style(screen.getByTestId('discover-screen-footer')).paddingBottom).toBeGreaterThanOrEqual(clearance + tokens.spacing[4]);
  });

  it('keeps the switch below the status bar', async () => {
    await open();
    expect(style(screen.getByTestId('plan-screen')).paddingTop).toBeGreaterThanOrEqual(insets.top);
  });

  it('has the new labels in English as well', async () => {
    await i18n.changeLanguage('en');
    await open();
    expect(screen.getByLabelText('Plan screen view').props.accessibilityRole).toBe('radiogroup');
    expect(radio('Discover')).toBeTruthy();
    expect(radio('Plan')).toBeChecked();
  });
});
