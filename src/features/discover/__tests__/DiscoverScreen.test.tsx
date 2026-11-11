import { Stack } from 'expo-router';
import React from 'react';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { QueryClient } from '@tanstack/react-query';
import { Linking, StyleSheet } from 'react-native';

import { PlacesError } from '@/data/places';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import type { RecommendPlacesRequest, RecommendPlacesResponse } from '@/schemas';
import { setAppProfileRepository, repositoryWithProfile, withMyProfile } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';
import { tokens } from '@/theme/tokens';

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
  photos: [],
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

async function open(fetcher: Fetcher, destination?: string) {
  setAppProfileRepository(await repositoryWithProfile());
  const Screen = () => <DiscoverScreen fetcher={fetcher} destination={destination} />;
  await renderRouter({ _layout: Layout, discover: Screen }, { initialUrl: '/discover' });
  await waitFor(() => expect(screen.queryByTestId('discover-loading')).toBeNull());
}

const searchButton = () => screen.getByRole('button', { name: 'Szukaj miejsc' });
async function pickCity() {
  await fireEvent.changeText(screen.getByLabelText('Miasto'), 'Krak');
  await fireEvent.press(screen.getByRole('button', { name: /Kraków · KRK/ }));
}

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
});

describe('DiscoverScreen', () => {
  it('shows the form without interest chips and no results', async () => {
    await open(jest.fn());
    expect(screen.queryByText('Zainteresowania')).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText('Dane: Google')).toBeNull();
  });

  it('disables search and fetches nothing until a city is picked', async () => {
    const fetcher = jest.fn();
    await open(fetcher);
    expect(searchButton()).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
    await pickCity();
    await waitFor(() => expect(searchButton()).toBeEnabled());
  });

  it('disables search and shows the loading block while the profile loads', async () => {
    setAppProfileRepository(withMyProfile(await repositoryWithProfile(), () => new Promise(() => {})));
    const fetcher = jest.fn();
    await renderRouter({ _layout: Layout, discover: () => <DiscoverScreen fetcher={fetcher} /> }, { initialUrl: '/discover' });
    await pickCity();
    expect(screen.getByTestId('discover-loading')).toBeTruthy();
    expect(searchButton()).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('disables search and says so when the profile fails to load', async () => {
    setAppProfileRepository(withMyProfile(await repositoryWithProfile(), () => Promise.reject(new Error('boom'))));
    const fetcher = jest.fn();
    await renderRouter({ _layout: Layout, discover: () => <DiscoverScreen fetcher={fetcher} /> }, { initialUrl: '/discover' });
    await waitFor(() => expect(screen.getByText('Nie udało się wczytać Twoich zainteresowań.')).toBeTruthy());
    await pickCity();
    expect(searchButton()).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
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
    await waitFor(() => expect(screen.getByText('Nie znaleźliśmy miejsc w tym mieście. Spróbuj innego miasta.')).toBeTruthy());
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

describe('DiscoverScreen footer', () => {
  it('keeps the safe-area bottom padding when no bottomInset is given', async () => {
    await open(jest.fn());
    expect(StyleSheet.flatten(screen.getByTestId('discover-screen-footer').props.style).paddingBottom).toBe(34 + tokens.spacing[4]);
  });
});

describe('DiscoverScreen with a trip destination', () => {
  const lisbon = { city: 'Lisbon', latitude: 38.7813, longitude: -9.1359, interests: ['museums'], locale: 'pl' };
  const cityField = () => screen.getByLabelText('Miasto').props.value;
  it('prefills the destination city and searches by itself once', async () => {
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(() => Promise.resolve(answer()));
    await open(fetcher, 'LIS');
    expect(cityField()).toBe('Lisbon · LIS');
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(lisbon);
  });

  it('does not call the fetcher again after a remount in the same session', async () => {
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(() => Promise.resolve(answer()));
    setAppProfileRepository(await repositoryWithProfile());
    const client = new QueryClient();
    let setShow: (show: boolean) => void = () => {};
    const Screen = () => {
      const [show, set] = React.useState(true);
      React.useEffect(() => {
        setShow = set;
      }, [set]);
      return show ? <DiscoverScreen fetcher={fetcher} destination="LIS" /> : null;
    };
    const SharedLayout = () => (
      <AppProviders queryClient={client}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    await renderRouter({ _layout: SharedLayout, discover: Screen }, { initialUrl: '/discover' });
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
    await act(async () => setShow(false));
    await act(async () => setShow(true));
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not search offline on open, and searches once when the connection returns', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(() => Promise.resolve(answer()));
    await open(fetcher, 'LIS');
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });

  it('does not search for a manually picked city until the button is pressed', async () => {
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(() => Promise.resolve(answer()));
    await open(fetcher, 'LIS');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await pickCity();
    expect(cityField()).toBe('Kraków · KRK');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await fireEvent.press(searchButton());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ city: 'Kraków' }));
  });

  it('hides the previous city results when another city is picked, and shows the new ones after searching', async () => {
    const fetcher = jest
      .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
      .mockResolvedValueOnce(answer())
      .mockResolvedValue(answer([place({ placeId: 'p2', name: 'Wawel' })]));
    await open(fetcher, 'LIS');
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
    await pickCity();
    expect(screen.queryByText('Muzeum Narodowe')).toBeNull();
    expect(screen.queryByText('Dane: Google')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Zostało dziś wyszukiwań: 4')).toBeTruthy();
    await fireEvent.press(searchButton());
    await waitFor(() => expect(screen.getByText('Wawel')).toBeTruthy());
    expect(screen.getByText('Dane: Google')).toBeTruthy();
  });

  it('hides the results while typing a new city', async () => {
    await open(() => Promise.resolve(answer()), 'LIS');
    await waitFor(() => expect(screen.getByText('Muzeum Narodowe')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Miasto'), 'Kra');
    expect(screen.queryByText('Muzeum Narodowe')).toBeNull();
    expect(screen.queryByText('Dane: Google')).toBeNull();
  });

  it('hides the error block of the searched city when another city is picked', async () => {
    await open(() => Promise.reject(new PlacesError('failed', 'x')), 'LIS');
    await waitFor(() => expect(screen.getByText('Nie udało się wczytać miejsc.')).toBeTruthy());
    await pickCity();
    expect(screen.queryByText('Nie udało się wczytać miejsc.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
  });

  it('keeps the daily limit message when another city is picked', async () => {
    await open(() => Promise.reject(new PlacesError('limit_reached', 'x')), 'LIS');
    await waitFor(() => expect(screen.getByText(/Wykorzystano dzisiejszy limit/)).toBeTruthy());
    await pickCity();
    expect(screen.getByText(/Wykorzystano dzisiejszy limit/)).toBeTruthy();
  });

  it('leaves the city empty and searches nothing for an unknown destination', async () => {
    const fetcher = jest.fn();
    await open(fetcher, 'ZZZ');
    expect(cityField()).toBe('');
    expect(searchButton()).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('drops the manual pick and loads the new destination when the destination changes', async () => {
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(() => Promise.resolve(answer()));
    setAppProfileRepository(await repositoryWithProfile());
    let setDestination: (iata: string) => void = () => {};
    const Screen = () => {
      const [destination, set] = React.useState('LIS');
      React.useEffect(() => {
        setDestination = set;
      }, [set]);
      return <DiscoverScreen fetcher={fetcher} destination={destination} />;
    };
    await renderRouter({ _layout: Layout, discover: Screen }, { initialUrl: '/discover' });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await pickCity();
    await act(async () => setDestination('WAW'));
    expect(cityField()).toBe('Warsaw · WAW');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ city: 'Warsaw' }));
  });

  it('shows the limit message after one automatic call and does not loop', async () => {
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(() => Promise.reject(new PlacesError('limit_reached', 'x')));
    await open(fetcher, 'LIS');
    await waitFor(() => expect(screen.getByText(/Wykorzystano dzisiejszy limit/)).toBeTruthy());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
