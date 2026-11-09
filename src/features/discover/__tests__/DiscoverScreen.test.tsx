import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { PlacesError } from '@/data/places';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import type { RecommendPlacesRequest, RecommendPlacesResponse } from '@/schemas';
import { setAppProfileRepository, repositoryWithProfile } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';

import { DiscoverScreen } from '../DiscoverScreen';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));

jest.mock('@/data/app-places', () => ({ fetchAppPlaceRecommendations: jest.fn() }));

type Fetcher = (request: RecommendPlacesRequest) => Promise<RecommendPlacesResponse>;

const place = (over: Partial<RecommendPlacesResponse['places'][number]> = {}) => ({
  placeId: 'p1',
  name: 'Muzeum Narodowe',
  typeLabel: 'Muzeum',
  address: 'al. 3 Maja 1, Kraków',
  types: ['museum'],
  location: { latitude: 50.06, longitude: 19.92 },
  googleMapsUri: 'https://maps.google.com/?cid=1',
  reason: 'Pasuje do Twojej miłości do muzeów.',
  ...over,
});
const answer = (places = [place()], remainingToday = 4): RecommendPlacesResponse => ({ places, remainingToday });

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

async function open(fetcher: Fetcher) {
  setAppProfileRepository(await repositoryWithProfile());
  const Screen = () => <DiscoverScreen fetcher={fetcher} />;
  await renderRouter({ _layout: Layout, discover: Screen }, { initialUrl: '/discover' });
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Muzea' })).toBeChecked());
}

const searchButton = () => screen.getByRole('button', { name: 'Szukaj miejsc' });
async function pickCity() {
  await fireEvent.changeText(screen.getByLabelText('Miasto'), 'Krak');
  await fireEvent.press(screen.getByRole('button', { name: /Kraków · KRK/ }));
}

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('DiscoverScreen', () => {
  it('shows the form with the profile interests preselected and no results', async () => {
    await open(jest.fn());
    expect(screen.getByRole('checkbox', { name: 'Muzea' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Plaże' })).not.toBeChecked();
    expect(screen.queryByText('Dane: Google')).toBeNull();
  });

  it('disables search until a city and at least one interest are chosen', async () => {
    await open(jest.fn());
    expect(searchButton()).toBeDisabled();
    await pickCity();
    expect(searchButton()).toBeEnabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Muzea' }));
    expect(searchButton()).toBeDisabled();
  });

  it('calls the fetcher with the city, its coordinates, the interests and the locale', async () => {
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(() => Promise.resolve(answer()));
    await open(fetcher);
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledWith({ city: 'Kraków', latitude: 50.0777, longitude: 19.7848, interests: ['museums'], locale: 'pl' });
  });

  it('shows a loading state while searching', async () => {
    await open(() => new Promise(() => {}));
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByTestId('discover-loading')).toBeTruthy());
  });

  it('lists the places with address, reason, attribution and remaining searches, and opens Google Maps', async () => {
    await open(() => Promise.resolve(answer()));
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
    expect(screen.getByText('al. 3 Maja 1, Kraków')).toBeTruthy();
    expect(screen.getByText('Pasuje do Twojej miłości do muzeów.')).toBeTruthy();
    expect(screen.getByText('Dane: Google')).toBeTruthy();
    expect(screen.getByText('Zostało dziś wyszukiwań: 4')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Otwórz w Mapach Google/ }));
    expect(Linking.openURL).toHaveBeenCalledWith('https://maps.google.com/?cid=1');
  });

  it('hides the reason when there is none', async () => {
    await open(() => Promise.resolve(answer([place({ reason: null })])));
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
    expect(screen.queryByText(/Pasuje/)).toBeNull();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('shows an empty state when nothing was found', async () => {
    await open(() => Promise.resolve(answer([], 3)));
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByText(/Nie znaleźliśmy miejsc/)).toBeTruthy());
  });

  it('shows an error with a retry that searches again', async () => {
    const fetcher = jest
      .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
      .mockRejectedValueOnce(new PlacesError('failed', 'x'))
      .mockResolvedValue(answer());
    await open(fetcher);
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByText('Nie udało się wczytać miejsc.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
  });

  it('shows the limit message without a retry', async () => {
    await open(() => Promise.reject(new PlacesError('limit_reached', 'x')));
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByText(/Wykorzystano dzisiejszy limit/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
  });

  it('treats unauthorized as the generic error', async () => {
    await open(() => Promise.reject(new PlacesError('unauthorized', 'x')));
    await pickCity();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByText('Nie udało się wczytać miejsc.')).toBeTruthy());
  });

  it('is disabled offline, under the offline banner, and calls nothing', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    const fetcher = jest.fn();
    await open(fetcher);
    await pickCity();
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText('Jesteś offline. Szukanie miejsc wymaga internetu.')).toBeTruthy();
    expect(searchButton()).toBeDisabled();
    await fireEvent.press(searchButton());
    expect(fetcher).not.toHaveBeenCalled();
  });
});
