import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { launchImageLibraryAsync } from 'expo-image-picker';
import type { ReactElement } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import BudgetStep from '@/app/trips/new/budget';
import FriendsStep from '@/app/trips/new/friends';
import NewTripLayout from '@/app/trips/new/_layout';
import SummaryStep from '@/app/trips/new/summary';
import { FriendAlreadyAddedError, OwnFriendCodeError, UnknownFriendCodeError } from '@/data/errors';
import { emptyFriend, emptySegment, withCompanionCount, withFoundFriend } from '@/features/trip-create/draft';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useCurrentTrip } from '@/hooks/useTrips';
import i18n from '@/i18n';
import { lightTheme } from '@/theme/legacy/theme';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
// jest-expo's native mock returns undefined; ids must be real UUIDs.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

let mockSaveFails = false;
// When set, saving fails with this error (the server refused a friend code, friend-invite D14).
let mockSaveError: Error | null = null;
// What the repository was last asked to create.
let mockCreateInput: unknown = null;
// The repository answers with the default cover, as when sending a gallery photo failed (trip-covers Q1).
let mockCoverUploadFails = false;
// When set, saving waits until the test calls it.
let mockReleaseSave: (() => void) | null = null;
let mockHoldSave = false;
jest.mock('@/data/app-trip-repository', () => {
  const actual = jest.requireActual('@/data/trip-repository');
  return {
    createAppTripRepository: () => {
      // The account behind friend code 5ZMRX8 (a linked friend, friend-invite D12); other codes are unknown to it.
      const repository = actual.createInMemoryTripRepository({
        now: () => new Date(),
        newId: () => jest.requireActual('crypto').randomUUID(),
        friendAccounts: { '5ZMRX8': '00000000-0000-4000-8000-0000000000aa' },
      });
      return {
        ...repository,
        create: async (input: unknown) => {
          mockCreateInput = input;
          if (mockSaveError) throw mockSaveError;
          if (mockHoldSave) await new Promise<void>((resolve) => (mockReleaseSave = resolve));
          if (mockSaveFails) throw new Error('down');
          const trip = await repository.create(input);
          return mockCoverUploadFails ? { ...trip, coverImageUri: 'preset:auckland' } : trip;
        },
      };
    },
  };
});

// Home screen stand-in: the saved trip's name, and its cover on a line of its own.
function TripsProbe() {
  const trip = useCurrentTrip().data?.overview.trip;
  return (
    <>
      <Text>{`trips: ${trip ? trip.name : ''}`}</Text>
      <Text>{`cover: ${trip?.coverImageUri ?? ''}`}</Text>
      <Text>Utwórz podróż</Text>
    </>
  );
}

// Stand-in for steps 1–3: WAW → DXB → BKK, back BKK → WAW, `companions` friends, 3000 THB per person.
function filledSteps(companions: number, linkedFirstFriend = false) {
  return function FilledFlights() {
    const { setDraft } = useTripDraft();
    const router = useRouter();
    function fill() {
      setDraft((draft) => {
        const withFriends = withCompanionCount(draft, companions);
        return {
          ...withFriends,
          outbound: [
            { ...emptySegment(), fromIata: 'WAW', departTz: 'Europe/Warsaw', toIata: 'DXB', arriveTz: 'Asia/Dubai', departAt: '2026-11-02T22:00', arriveAt: '2026-11-03T06:30' },
            { ...emptySegment(), fromIata: 'DXB', departTz: 'Asia/Dubai', toIata: 'BKK', arriveTz: 'Asia/Bangkok', departAt: '2026-11-03T15:30', arriveAt: '2026-11-03T23:59' },
          ],
          return: [
            { ...emptySegment(), fromIata: 'BKK', departTz: 'Asia/Bangkok', toIata: 'WAW', arriveTz: 'Europe/Warsaw', departAt: '2026-11-15T09:00', arriveAt: '2026-11-15T17:00' },
          ],
          friends: withFriends.friends.map((friend, i) => {
            if (i === 0 && linkedFirstFriend) return withFoundFriend(emptyFriend(), '5ZMRX8', { username: 'ola_b', interests: ['museums'] });
            return i === 0 ? { ...emptyFriend(), displayName: 'Kasia', interests: ['beaches', 'nightlife'] } : { ...emptyFriend(), displayName: 'Ola' };
          }),
          budget: { amountText: '3000', currency: '' },
        };
      });
      router.push('/trips/new/summary');
    }
    return (
      <Pressable onPress={fill}>
        <Text>test: fill all and go to summary</Text>
      </Pressable>
    );
  };
}

async function openSummary(companions = 2, home: () => ReactElement | null = TripsProbe, linkedFirstFriend = false) {
  const rendered = renderRouter(
    {
      _layout: RootLayout,
      '(drawer)/_layout': DrawerLayout,
      '(drawer)/(tabs)/_layout': TabsLayout,
      '(drawer)/(tabs)/index': home,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': filledSteps(companions, linkedFirstFriend),
      'trips/new/friends': FriendsStep,
      'trips/new/budget': BudgetStep,
      'trips/new/summary': SummaryStep,
    },
    { initialUrl: '/trips/new' },
  );
  await rendered;
  await fireEvent.press(screen.getByText('test: fill all and go to summary'));
  return { getPathname: () => rendered.getPathname(), getSearchParams: () => rendered.getSearchParams() };
}

const section = (name: string) => within(screen.getByTestId(`summary-${name}`));

beforeEach(async () => {
  mockSaveFails = false;
  mockSaveError = null;
  mockCreateInput = null;
  mockCoverUploadFails = false;
  mockHoldSave = false;
  mockReleaseSave = null;
  jest.useFakeTimers({ now: new Date('2026-10-04T12:00:00+02:00'), advanceTimers: true });
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Summary step', () => {
  it('aligns the layover label with the flight lines, no left inset (friend-invite D8)', async () => {
    await openSummary();
    expect(section('trip').getByText('9 godz. przesiadki w DXB').parent).not.toHaveStyle({ paddingLeft: lightTheme.spacing[4] });
  });

  it('shows the trip: city, dates, days, segments and layovers (D38)', async () => {
    await openSummary();
    expect(screen.getByRole('header', { name: 'Sprawdź podróż' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Krok 4 z 4' })).toBeTruthy();
    const trip = section('trip');
    expect(trip.getByText('Bangkok')).toBeTruthy();
    expect(trip.getByText('3 lis – 15 lis 2026 · 13 dni')).toBeTruthy();
    expect(trip.getByText('WAW 2 lis, 22:00 → DXB 3 lis, 6:30')).toBeTruthy();
    expect(trip.getByText('9 godz. przesiadki w DXB')).toBeTruthy();
    expect(trip.getByText('DXB 3 lis, 15:30 → BKK 3 lis, 23:59')).toBeTruthy();
    expect(trip.getByText('BKK 15 lis, 9:00 → WAW 15 lis, 17:00')).toBeTruthy();
  });

  it('lists the travellers with their interests', async () => {
    await openSummary();
    const people = section('travellers');
    expect(people.getByText('Podróżni · 3 osoby')).toBeTruthy();
    expect(people.getByText('Ty')).toBeTruthy();
    expect(people.getByText('Kasia — Plaże, Imprezy i nocne życie')).toBeTruthy();
    expect(people.getByText('Ola — bez zainteresowań')).toBeTruthy();
  });

  it('lists a friend linked by a code by the nick, like any friend (friend-invite D6)', async () => {
    await openSummary(2, TripsProbe, true);
    const people = section('travellers');
    expect(people.getByText('ola_b — Muzea')).toBeTruthy();
    expect(people.getByText('Ola — bez zainteresowań')).toBeTruthy();
  });

  it('sends the friend code of a linked friend to the repository, and no typed code text (friend-invite)', async () => {
    await openSummary(2, TripsProbe, true);
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    expect(await screen.findByText('trips: Warsaw → Bangkok')).toBeTruthy();
    expect(mockCreateInput).toEqual(
      expect.objectContaining({
        friends: {
          friends: [
            { displayName: 'ola_b', interests: ['museums'], friendCode: '5ZMRX8' },
            { displayName: 'Ola', interests: [], friendCode: null },
          ],
        },
      }),
    );
  });

  it('uses the "many" plural form for 5 travellers', async () => {
    await openSummary(4);
    expect(section('travellers').getByText('Podróżni · 5 osób')).toBeTruthy();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await openSummary();
    expect(screen.getByRole('header', { name: 'Check your trip' })).toBeTruthy();
    expect(section('trip').getByText('Nov 3 – Nov 15, 2026 · 13 days')).toBeTruthy();
    expect(section('travellers').getByText('Travellers · 3 people')).toBeTruthy();
    expect(section('budget').getByText('Total 9,000\u00a0THB · ~231\u00a0THB per person a day')).toBeTruthy();
  });

  it('shows a solo trip as one traveller', async () => {
    await openSummary(0);
    expect(section('travellers').getByText('Podróżni · 1 osoba')).toBeTruthy();
  });

  it('shows the budget per person, the group total and per day', async () => {
    await openSummary();
    const budget = section('budget');
    // Only the amount is large (Numeric L); the label is body text.
    expect(budget.getByText('3000\u00a0THB')).toBeTruthy();
    expect(budget.getByText('na osobę')).toBeTruthy();
    // The daily figure is per person (D35), not for the group.
    expect(budget.getByText('Razem 9000\u00a0THB · ~231\u00a0THB dziennie na osobę')).toBeTruthy();
  });

  it.each([
    ['trip', 'Zmień: Bangkok', '/trips/new'],
    ['travellers', 'Zmień: Podróżni · 3 osoby', '/trips/new/friends'],
    ['budget', 'Zmień: Budżet', '/trips/new/budget'],
  ])('"Zmień" in %s (read as "%s") goes back to that step', async (name, label, path) => {
    const app = await openSummary();
    expect(section(name).getByText('Zmień')).toBeTruthy();
    await fireEvent.press(section(name).getByRole('button', { name: label }));
    expect(app.getPathname()).toBe(path);
  });

  it('"Zmień" travellers goes to flights when travelling alone (no friends step)', async () => {
    const app = await openSummary(0);
    await fireEvent.press(section('travellers').getByRole('button', { name: 'Zmień: Podróżni · 1 osoba' }));
    expect(app.getPathname()).toBe('/trips/new');
  });

  it('saves the trip and returns to the trips list without asking to discard (D6)', async () => {
    const app = await openSummary();
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    expect(await screen.findByText('trips: Warsaw → Bangkok')).toBeTruthy();
    expect(app.getPathname()).toBe('/');
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(screen.queryByText('Odrzucić wpisane dane?')).toBeNull();
  });

  describe('name and cover photo (D2)', () => {
    const details = () => section('details');

    it('comes first, with the name filled in as "from → to" (D3)', async () => {
      await openSummary();
      expect(screen.getAllByTestId(/^summary-/)[0].props.testID).toBe('summary-details');
      expect(details().getByRole('header', { name: 'Nazwa i zdjęcie' })).toBeTruthy();
      expect(details().getByLabelText('Nazwa podróży').props.value).toBe('Warsaw → Bangkok');
      expect(details().getByRole('button', { name: 'Z galerii' })).toBeTruthy();
    });

    it('starts with the default cover selected, so the organizer never has to pick one (trip-covers D4)', async () => {
      await openSummary();
      expect(details().getByText('Zdjęcie okładki')).toBeTruthy();
      expect(details().queryByText(/opcjonalnie/)).toBeNull();
      expect(details().getByRole('radio', { name: 'Auckland', checked: true })).toBeTruthy();
    });

    it('saves the default cover when it was not touched', async () => {
      await openSummary();
      await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
      expect(await screen.findByText('cover: preset:auckland')).toBeTruthy();
    });

    it('saves the preset the organizer tapped', async () => {
      await openSummary();
      await fireEvent.press(details().getByRole('radio', { name: 'Bali' }));
      expect(details().getByRole('radio', { name: 'Bali', checked: true })).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
      expect(await screen.findByText('cover: preset:bali')).toBeTruthy();
    });

    it('saves the name the organizer typed', async () => {
      await openSummary();
      await fireEvent.changeText(details().getByLabelText('Nazwa podróży'), 'Tajlandia z ekipą');
      await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
      expect(await screen.findByText('trips: Tajlandia z ekipą')).toBeTruthy();
    });

    it('asks for a name instead of saving when it is cleared, and stays on the summary', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      const app = await openSummary();
      await fireEvent.changeText(details().getByLabelText('Nazwa podróży'), '  ');
      expect(app.getPathname()).toBe('/trips/new/summary');
      await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
      expect(details().getByText('Podaj nazwę podróży')).toBeTruthy();
      expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
      expect(app.getPathname()).toBe('/trips/new/summary');
      expect(screen.queryByTestId('primary-button-spinner')).toBeNull();
    });

    it('saves the chosen cover photo', async () => {
      jest.mocked(launchImageLibraryAsync).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///cache/cover.jpg', width: 1600, height: 900 }],
      });
      await openSummary();
      await fireEvent.press(details().getByRole('button', { name: 'Z galerii' }));
      expect(await details().findByRole('radio', { name: 'Twoje zdjęcie', checked: true })).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
      // The repository uploads the photo and keeps it as a stored cover, so the saved trip has photo:<id>, not the picked file.
      expect(await screen.findByText(/^cover: photo:[0-9a-f-]{36}$/)).toBeTruthy();
    });
  });

  describe('a cover photo that could not be sent (trip-covers Q1)', () => {
    const MESSAGE = 'Nie udało się wysłać zdjęcia okładki. Zmień je w „Nazwa i zdjęcie”.';
    const pickPhoto = async () => {
      const gallery = i18n.t('coverPicker.gallery');
      const yours = i18n.t('coverPicker.yourPhoto');
      jest.mocked(launchImageLibraryAsync).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///cache/cover.jpg', width: 1600, height: 900 }],
      });
      await fireEvent.press(section('details').getByRole('button', { name: gallery }));
      await section('details').findByRole('radio', { name: yours, checked: true });
    };
    const create = () => fireEvent.press(screen.getByRole('button', { name: i18n.t('newTrip.summary.create') }));

    it('lands on the home screen with the snackbar once, and clears the flag', async () => {
      mockCoverUploadFails = true;
      const app = await openSummary(2, HomeScreen);
      await pickPhoto();
      await create();
      expect(await screen.findByText(MESSAGE)).toBeTruthy();
      expect(app.getPathname()).toBe('/');
      await waitFor(() => expect(app.getSearchParams()).toEqual({}));
      // Gone after its time (cleared by the screen, then faded out), and not shown again by a later render.
      const { snackbarAutoDismiss, small } = lightTheme.duration;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(snackbarAutoDismiss);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(small + 50);
      });
      expect(screen.queryByText(MESSAGE)).toBeNull();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(snackbarAutoDismiss);
      });
      expect(screen.queryByText(MESSAGE)).toBeNull();
    });

    it('reads in English', async () => {
      await i18n.changeLanguage('en');
      mockCoverUploadFails = true;
      await openSummary(2, HomeScreen);
      await pickPhoto();
      await create();
      expect(await screen.findByText("Couldn't upload the cover photo. Change it in “Name and photo”.")).toBeTruthy();
    });

    it('shows nothing when the photo was sent', async () => {
      const app = await openSummary(2, HomeScreen);
      await pickPhoto();
      await create();
      await waitFor(() => expect(app.getPathname()).toBe('/'));
      expect(await screen.findByText('Warsaw → Bangkok')).toBeTruthy();
      expect(screen.queryByText(MESSAGE)).toBeNull();
      expect(app.getSearchParams()).toEqual({});
    });

    it('shows nothing for a preset, even if the repository answered with the default', async () => {
      mockCoverUploadFails = true;
      const app = await openSummary(2, HomeScreen);
      await fireEvent.press(section('details').getByRole('radio', { name: 'Bali' }));
      await create();
      await waitFor(() => expect(app.getPathname()).toBe('/'));
      expect(await screen.findByText('Warsaw → Bangkok')).toBeTruthy();
      expect(screen.queryByText(MESSAGE)).toBeNull();
    });
  });

  it('opens with a default name over 60 characters and asks to shorten it (PR #4 review)', async () => {
    // PKY → NLI: "Palangkaraya-Kalimantan Tengah → Nikolayevsk-na-Amure Airport" is 61 characters.
    function LongNameFlights() {
      const { setDraft } = useTripDraft();
      const router = useRouter();
      function fill() {
        setDraft((draft) => ({
          ...draft,
          outbound: [
            { ...emptySegment(), fromIata: 'PKY', departTz: 'Asia/Pontianak', toIata: 'NLI', arriveTz: 'Asia/Vladivostok', departAt: '2026-11-02T08:00', arriveAt: '2026-11-02T20:00' },
          ],
          return: [
            { ...emptySegment(), fromIata: 'NLI', departTz: 'Asia/Vladivostok', toIata: 'PKY', arriveTz: 'Asia/Pontianak', departAt: '2026-11-10T09:00', arriveAt: '2026-11-10T15:00' },
          ],
          budget: { amountText: '3000', currency: '' },
        }));
        router.push('/trips/new/summary');
      }
      return (
        <Pressable onPress={fill}>
          <Text>test: long-name trip</Text>
        </Pressable>
      );
    }
    const rendered = renderRouter(
      {
        _layout: RootLayout,
        '(drawer)/_layout': DrawerLayout,
        '(drawer)/(tabs)/_layout': TabsLayout,
        '(drawer)/(tabs)/index': TripsProbe,
        'trips/new/_layout': NewTripLayout,
        'trips/new/index': LongNameFlights,
        'trips/new/summary': SummaryStep,
      },
      { initialUrl: '/trips/new' },
    );
    await rendered;
    await fireEvent.press(screen.getByText('test: long-name trip'));
    expect(rendered.getPathname()).toBe('/trips/new/summary');
    const details = section('details');
    expect(details.getByLabelText('Nazwa podróży').props.value).toHaveLength(61);
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    expect(details.getByText('Nazwa może mieć do 60 znaków')).toBeTruthy();
    expect(rendered.getPathname()).toBe('/trips/new/summary');
  });

  it('sends an incomplete draft (e.g. opened by URL) back to step 1', async () => {
    const rendered = renderRouter(
      {
        _layout: RootLayout,
        '(drawer)/_layout': DrawerLayout,
        '(drawer)/(tabs)/_layout': TabsLayout,
        '(drawer)/(tabs)/index': TripsProbe,
        'trips/new/_layout': NewTripLayout,
        'trips/new/index': filledSteps(2),
        'trips/new/summary': SummaryStep,
      },
      { initialUrl: '/trips/new/summary' },
    );
    await rendered;
    expect(rendered.getPathname()).toBe('/trips/new');
  });

  it('shows loading on "Utwórz podróż" while saving', async () => {
    mockHoldSave = true;
    await openSummary();
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    // The mutation becomes pending on the next tick.
    expect(await screen.findByTestId('primary-button-spinner')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Utwórz podróż' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    await act(async () => mockReleaseSave?.());
    expect(await screen.findByText('trips: Warsaw → Bangkok')).toBeTruthy();
  });

  it('keeps everything, explains and announces when saving fails', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    mockSaveFails = true;
    const app = await openSummary();
    await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
    expect(await screen.findByText('Nie udało się zapisać podróży. Spróbuj ponownie.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Nie udało się zapisać podróży. Spróbuj ponownie.');
    expect(app.getPathname()).toBe('/trips/new/summary');
    expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeEnabled();
    expect(section('trip').getByText('Bangkok')).toBeTruthy();
    expect(section('budget').getByText('3000\u00a0THB')).toBeTruthy();
  });

  describe('the server refuses a friend code (friend-invite D14)', () => {
    it.each([
      ['your own code', new OwnFriendCodeError('FI001'), 'To Twój kod.'],
      ['a code nobody has', new UnknownFriendCodeError('FI002'), 'Nie ma użytkownika z tym kodem.'],
      ['the same friend twice', new FriendAlreadyAddedError('23505'), 'Ten znajomy jest już dodany.'],
    ])('%s: shows that text instead of the general error, announces it, and keeps everything', async (_name, error, message) => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      mockSaveError = error;
      const app = await openSummary(2, TripsProbe, true);
      await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.queryByText('Nie udało się zapisać podróży. Spróbuj ponownie.')).toBeNull();
      expect(announce).toHaveBeenCalledWith(message);
      expect(app.getPathname()).toBe('/trips/new/summary');
      expect(screen.getByRole('button', { name: 'Utwórz podróż' })).toBeEnabled();
      expect(section('travellers').getByText('ola_b — Muzea')).toBeTruthy();
    });

    it('reads in English', async () => {
      await i18n.changeLanguage('en');
      mockSaveError = new UnknownFriendCodeError('FI002');
      await openSummary(2, TripsProbe, true);
      await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
      expect(await screen.findByText('No user has this code.')).toBeTruthy();
    });

    it('still shows the general error for any other failure', async () => {
      mockSaveError = new Error('down');
      await openSummary(2, TripsProbe, true);
      await fireEvent.press(screen.getByRole('button', { name: 'Utwórz podróż' }));
      expect(await screen.findByText('Nie udało się zapisać podróży. Spróbuj ponownie.')).toBeTruthy();
    });
  });
});
