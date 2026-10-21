import { useFonts } from 'expo-font';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Pressable, ScrollView, Text } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import RootLayout from '@/app/_layout';
import BudgetStep from '@/app/trips/new/budget';
import FriendsStep from '@/app/trips/new/friends';
import NewTripLayout from '@/app/trips/new/_layout';
import SummaryStep from '@/app/trips/new/summary';
import { emptyFriend, withCompanionCount, withFoundFriend } from '@/features/trip-create/draft';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useGoToNextStep } from '@/features/trip-create/WizardScreen';
import { ServerUnreachableError } from '@/data/errors';
import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { setNetwork } from '@/test/mock-network';
import { repositoryWithProfile, setAppProfileRepository } from '@/test/fake-profile-repository';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

// What the draft holds for the friends, as the tests read it (the code text is UI state and not part of it).
function FriendsWithProbe() {
  const { draft } = useTripDraft();
  return (
    <>
      <FriendsStep />
      <Text testID="draft-friends">
        {JSON.stringify(draft.friends.map(({ displayName, interests, friendCode }) => ({ displayName, interests, friendCode })))}
      </Text>
    </>
  );
}

const draftFriends = () => JSON.parse(String(screen.getByTestId('draft-friends').props.children));

const OLA = { username: 'ola_b', interests: ['museums' as const, 'beaches' as const] };
const TOMEK = { username: 'tomek', interests: ['cycling' as const] };
const OLA_CODE = '5ZMRX8';
const TOMEK_CODE = 'K7PQ2D';

// The accounts the friend codes belong to; call before the app is rendered. Returns the lookup spy and the user's own code.
async function setUpAccounts(override?: (base: ProfileRepository) => Partial<ProfileRepository>) {
  const base = await repositoryWithProfile(
    createInMemoryProfileRepository({ friendAccounts: { [OLA_CODE]: OLA, [TOMEK_CODE]: TOMEK } }),
  );
  const findByFriendCode = jest.fn((code: string) => base.findByFriendCode(code));
  setAppProfileRepository({ ...base, findByFriendCode, ...override?.(base) });
  const ownCode = (await base.myProfile())?.profile.friendCode ?? '';
  return { findByFriendCode, ownCode };
}

// Stand-in for step 1 (tested in flights.test.tsx): sets the companion count and moves on.
function FlightsWithCompanions() {
  const { setCompanionCount, setDraft } = useTripDraft();
  const goNext = useGoToNextStep('flights');
  return (
    <>
      <Pressable onPress={() => setCompanionCount(2)}>
        <Text>test: two friends</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          setDraft((draft) => ({
            ...withCompanionCount(draft, 2),
            friends: [withFoundFriend(emptyFriend(), OLA_CODE, OLA), withFoundFriend(emptyFriend(), OLA_CODE, OLA)],
          }))
        }
      >
        <Text>test: the same linked friend twice</Text>
      </Pressable>
      <Pressable onPress={goNext}>
        <Text>test: next</Text>
      </Pressable>
    </>
  );
}

async function openFriends(setUp = 'test: two friends') {
  const rendered = renderRouter(
    {
      _layout: RootLayout,
      '(drawer)/_layout': DrawerLayout,
      '(drawer)/(tabs)/_layout': TabsLayout,
      '(drawer)/(tabs)/index': HomeScreen,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': FlightsWithCompanions,
      'trips/new/friends': FriendsWithProbe,
      'trips/new/budget': BudgetStep,
      'trips/new/summary': SummaryStep,
    },
    { initialUrl: '/' },
  );
  await rendered;
  await fireEvent.press(await screen.findByText('Utwórz podróż'));
  await fireEvent.press(screen.getByText(setUp));
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

  describe('friend code (friend-invite)', () => {
    const code = (number: number) => friend(number).getByLabelText('Kod znajomego');
    const type = (number: number, text: string) => fireEvent.changeText(code(number), text);
    const name = (number: number) => friend(number).getByLabelText('Imię');

    // The scroll target is checked on the second card, so the first one is filled in.
    async function blockedOnSecondCard() {
      const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);
      scrollTo.mockClear();
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await fireEvent.changeText(name(1), 'Kasia');
      await fireEvent.changeText(name(2), 'Ola');
      await fireEvent(screen.getByTestId('friend-2'), 'layout', { nativeEvent: { layout: { x: 0, y: 700, width: 335, height: 900 } } });
      return { scrollTo, announce };
    }

    async function expectBlocked(
      app: Awaited<ReturnType<typeof openFriends>>,
      { scrollTo, announce }: Awaited<ReturnType<typeof blockedOnSecondCard>>,
    ) {
      await fireEvent.press(screen.getByText('Dalej'));
      expect(app.getPathname()).toBe('/trips/new/friends');
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 700 - 16, animated: true });
      expect(announce).toHaveBeenCalledWith('Popraw zaznaczone pola');
    }

    it('adds an optional "Kod znajomego" at the top of every card, above the name', async () => {
      await openFriends();
      for (const number of [1, 2]) {
        expect(friend(number).getByText('Kod znajomego (opcjonalnie)')).toBeTruthy();
        const inputs = friend(number).getAllByLabelText(/^(Kod znajomego|Imię)$/);
        expect(inputs.map((input) => input.props.accessibilityLabel)).toEqual(['Kod znajomego', 'Imię']);
      }
    });

    it('forces uppercase while typing, takes 6 characters and does not autocorrect', async () => {
      await setUpAccounts();
      await openFriends();
      await type(1, 'k7pq');
      expect(code(1).props.value).toBe('K7PQ');
      expect(code(1).props.maxLength).toBe(6);
      expect(code(1).props.autoCorrect).toBe(false);
      expect(code(1).props.autoCapitalize).toBe('characters');
    });

    it('checks the code once, right after the 6th character (D5)', async () => {
      const { findByFriendCode } = await setUpAccounts();
      await openFriends();
      await type(1, 'k7pq2');
      expect(findByFriendCode).not.toHaveBeenCalled();
      await type(1, 'k7pq2d');
      await waitFor(() => expect(name(1).props.value).toBe('tomek'));
      // Typing elsewhere re-renders the screen; the same text is not checked again.
      await fireEvent.changeText(name(2), 'Ola');
      await fireEvent.press(friend(2).getByRole('checkbox', { name: 'Muzea' }));
      expect(findByFriendCode).toHaveBeenCalledTimes(1);
      expect(findByFriendCode).toHaveBeenCalledWith('K7PQ2D');
    });

    it('shows a small progress indicator while the code is being checked', async () => {
      let answer: (found: typeof OLA | null) => void = () => {};
      await setUpAccounts(() => ({ findByFriendCode: () => new Promise((resolve) => (answer = resolve)) }));
      await openFriends();
      expect(friend(1).queryByTestId('friend-code-checking')).toBeNull();
      await type(1, OLA_CODE);
      expect(await friend(1).findByTestId('friend-code-checking')).toBeTruthy();
      expect(friend(1).getByLabelText('Sprawdzam kod…')).toBeTruthy();
      await act(async () => answer(OLA));
      await waitFor(() => expect(friend(1).queryByTestId('friend-code-checking')).toBeNull());
    });

    it('a found code fills the card with the nick and interests, which cannot be edited, and the draft gets the code', async () => {
      await setUpAccounts();
      await openFriends();
      await type(1, '5zmrx8');
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      expect(code(1).props.value).toBe('5ZMRX8');
      expect(name(1).props.editable).toBe(false);
      expect(friend(1).getByRole('checkbox', { name: 'Muzea' })).toBeChecked();
      expect(friend(1).getByRole('checkbox', { name: 'Plaże' })).toBeChecked();
      expect(friend(1).getByRole('checkbox', { name: 'Rowery i wycieczki' })).not.toBeChecked();
      expect(friend(1).getByRole('checkbox', { name: 'Rowery i wycieczki' })).toBeDisabled();
      await fireEvent.press(friend(1).getByRole('checkbox', { name: 'Rowery i wycieczki' }));
      expect(friend(1).getByRole('checkbox', { name: 'Rowery i wycieczki' })).not.toBeChecked();
      expect(draftFriends()[0]).toEqual({ displayName: 'ola_b', interests: ['museums', 'beaches'], friendCode: OLA_CODE });
      // The other card is untouched.
      expect(draftFriends()[1]).toEqual({ displayName: '', interests: [], friendCode: null });
      expect(name(2).props.editable).not.toBe(false);
    });

    it('overwrites a name and interests typed before the code was found', async () => {
      await setUpAccounts();
      await openFriends();
      await fireEvent.changeText(name(1), 'Aleksandra');
      await fireEvent.press(friend(1).getByRole('checkbox', { name: 'Rowery i wycieczki' }));
      await type(1, OLA_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      expect(friend(1).getByRole('checkbox', { name: 'Rowery i wycieczki' })).not.toBeChecked();
    });

    it('says it is the own code, without asking the server (D7)', async () => {
      const { findByFriendCode, ownCode } = await setUpAccounts();
      await openFriends();
      await type(1, ownCode.toLowerCase());
      expect(await friend(1).findByText('To Twój kod.')).toBeTruthy();
      expect(findByFriendCode).not.toHaveBeenCalled();
      expect(draftFriends()[0].friendCode).toBeNull();
      expect(name(1).props.value).toBe('');
    });

    it('says the friend is already added when another card has the code, without asking again', async () => {
      const { findByFriendCode } = await setUpAccounts();
      await openFriends();
      await type(1, OLA_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      await type(2, OLA_CODE);
      expect(await friend(2).findByText('Ten znajomy jest już dodany.')).toBeTruthy();
      expect(findByFriendCode).toHaveBeenCalledTimes(1);
      expect(friend(1).queryByText('Ten znajomy jest już dodany.')).toBeNull();
      expect(draftFriends()[1].friendCode).toBeNull();
    });

    it('checks the second card again once the first one lets go of the code', async () => {
      await setUpAccounts();
      await openFriends();
      await type(1, OLA_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      await type(2, OLA_CODE);
      await friend(2).findByText('Ten znajomy jest już dodany.');
      await type(1, '');
      await waitFor(() => expect(name(2).props.value).toBe('ola_b'));
      expect(friend(2).queryByText('Ten znajomy jest już dodany.')).toBeNull();
      expect(draftFriends()[1].friendCode).toBe(OLA_CODE);
    });

    it('says there is no such user for a code with look-alike letters, without asking the server', async () => {
      const { findByFriendCode } = await setUpAccounts();
      await openFriends();
      await type(1, 'ABCDE0');
      expect(await friend(1).findByText('Nie ma użytkownika z tym kodem.')).toBeTruthy();
      expect(findByFriendCode).not.toHaveBeenCalled();
    });

    it('says there is no such user when nobody has the code', async () => {
      const { findByFriendCode } = await setUpAccounts();
      await openFriends();
      await type(1, 'ABCDEF');
      expect(await friend(1).findByText('Nie ma użytkownika z tym kodem.')).toBeTruthy();
      expect(findByFriendCode).toHaveBeenCalledTimes(1);
      expect(friend(1).queryByTestId('friend-code-checking')).toBeNull();
    });

    it('asks to connect when the server cannot be reached, and checks again after the code is edited', async () => {
      const calls: string[] = [];
      await setUpAccounts((base) => ({
        findByFriendCode: async (text) => {
          calls.push(text);
          if (calls.length === 1) throw new ServerUnreachableError('offline');
          return base.findByFriendCode(text);
        },
      }));
      await openFriends();
      await type(1, OLA_CODE);
      expect(await friend(1).findByText('Połącz się z internetem, żeby sprawdzić kod.')).toBeTruthy();
      await type(1, '5ZMRX');
      await type(1, OLA_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      expect(calls).toEqual([OLA_CODE, OLA_CODE]);
      expect(friend(1).queryByText('Połącz się z internetem, żeby sprawdzić kod.')).toBeNull();
    });

    it('says the check failed for any other error, and checks again after the code is edited', async () => {
      const calls: string[] = [];
      await setUpAccounts((base) => ({
        findByFriendCode: async (text) => {
          calls.push(text);
          if (calls.length === 1) throw new Error('boom');
          return base.findByFriendCode(text);
        },
      }));
      await openFriends();
      await type(1, OLA_CODE);
      expect(await friend(1).findByText('Nie udało się sprawdzić kodu. Spróbuj ponownie.')).toBeTruthy();
      await type(1, '5ZMRX');
      await type(1, OLA_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      expect(calls).toHaveLength(2);
    });

    it('offline: the field is disabled and says to connect; the rest of the card works (D5)', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      const { findByFriendCode } = await setUpAccounts();
      await openFriends();
      expect(code(1).props.editable).toBe(false);
      expect(friend(1).getByText('Połącz się z internetem, żeby sprawdzić kod.')).toBeTruthy();
      expect(name(1).props.editable).not.toBe(false);
      await fireEvent.changeText(name(1), 'Kasia');
      expect(name(1).props.value).toBe('Kasia');
      await fireEvent.press(friend(1).getByRole('checkbox', { name: 'Muzea' }));
      expect(friend(1).getByRole('checkbox', { name: 'Muzea' })).toBeChecked();
      expect(findByFriendCode).not.toHaveBeenCalled();
      await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
      expect(code(1).props.editable).not.toBe(false);
      expect(friend(1).queryByText('Połącz się z internetem, żeby sprawdzić kod.')).toBeNull();
    });

    it('editing or clearing the code of a found card returns an empty manual card (D9)', async () => {
      await setUpAccounts();
      await openFriends();
      await type(1, OLA_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      await type(1, '5ZMRX');
      expect(name(1).props.value).toBe('');
      expect(name(1).props.editable).not.toBe(false);
      expect(friend(1).getByRole('checkbox', { name: 'Muzea' })).not.toBeChecked();
      expect(friend(1).getByRole('checkbox', { name: 'Muzea' })).toBeEnabled();
      expect(draftFriends()[0]).toEqual({ displayName: '', interests: [], friendCode: null });

      await type(1, TOMEK_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('tomek'));
      await type(1, '');
      expect(name(1).props.value).toBe('');
      expect(code(1).props.value).toBe('');
      expect(friend(1).getByRole('checkbox', { name: 'Rowery i wycieczki' })).not.toBeChecked();
      expect(draftFriends()[0]).toEqual({ displayName: '', interests: [], friendCode: null });
    });

    it('editing the code of a card that was not found keeps the typed name and interests (D9)', async () => {
      await setUpAccounts();
      await openFriends();
      await fireEvent.changeText(name(1), 'Kasia');
      await fireEvent.press(friend(1).getByRole('checkbox', { name: 'Plaże' }));
      await type(1, 'ABCDEF');
      await friend(1).findByText('Nie ma użytkownika z tym kodem.');
      await type(1, 'ABCDE');
      expect(name(1).props.value).toBe('Kasia');
      expect(friend(1).getByRole('checkbox', { name: 'Plaże' })).toBeChecked();
      expect(friend(1).queryByText('Nie ma użytkownika z tym kodem.')).toBeNull();
    });

    it('works as before without a code', async () => {
      const { findByFriendCode } = await setUpAccounts();
      const app = await openFriends();
      await fireEvent.changeText(name(1), 'Kasia');
      await fireEvent.changeText(name(2), 'Ola');
      await fireEvent.press(screen.getByText('Dalej'));
      expect(app.getPathname()).toBe('/trips/new/budget');
      expect(findByFriendCode).not.toHaveBeenCalled();
    });

    it('moves on with linked friends, whose names come from their accounts (D13)', async () => {
      await setUpAccounts();
      const app = await openFriends();
      await type(1, OLA_CODE);
      await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
      await type(2, TOMEK_CODE);
      await waitFor(() => expect(name(2).props.value).toBe('tomek'));
      await fireEvent.press(screen.getByText('Dalej'));
      expect(app.getPathname()).toBe('/trips/new/budget');
    });

    describe('"Dalej" is blocked while a code is not found (D13)', () => {
      it('an incomplete code: "Kod ma 6 znaków." after "Dalej", and not while typing', async () => {
        await setUpAccounts();
        const app = await openFriends();
        const spies = await blockedOnSecondCard();
        await type(2, 'AB');
        expect(friend(2).queryByText('Kod ma 6 znaków.')).toBeNull();
        await expectBlocked(app, spies);
        expect(friend(2).getByText('Kod ma 6 znaków.')).toBeTruthy();
        expect(friend(1).queryByText('Kod ma 6 znaków.')).toBeNull();
        // Fixing the code lets the user on.
        await type(2, OLA_CODE);
        await waitFor(() => expect(name(2).props.value).toBe('ola_b'));
        await fireEvent.press(screen.getByText('Dalej'));
        expect(app.getPathname()).toBe('/trips/new/budget');
      });

      it('an unknown code', async () => {
        await setUpAccounts();
        const app = await openFriends();
        const spies = await blockedOnSecondCard();
        await type(2, 'ABCDEF');
        await friend(2).findByText('Nie ma użytkownika z tym kodem.');
        await expectBlocked(app, spies);
      });

      it('a code with look-alike letters', async () => {
        await setUpAccounts();
        const app = await openFriends();
        const spies = await blockedOnSecondCard();
        await type(2, 'ABCDE0');
        await expectBlocked(app, spies);
        expect(friend(2).getByText('Nie ma użytkownika z tym kodem.')).toBeTruthy();
      });

      it('the own code', async () => {
        const { ownCode } = await setUpAccounts();
        const app = await openFriends();
        const spies = await blockedOnSecondCard();
        await type(2, ownCode);
        await expectBlocked(app, spies);
        expect(friend(2).getByText('To Twój kod.')).toBeTruthy();
      });

      it('a code already used by another card', async () => {
        await setUpAccounts();
        const app = await openFriends();
        await type(1, OLA_CODE);
        await waitFor(() => expect(name(1).props.value).toBe('ola_b'));
        const spies = await blockedOnSecondCard();
        await type(2, OLA_CODE);
        await expectBlocked(app, spies);
        expect(friend(2).getByText('Ten znajomy jest już dodany.')).toBeTruthy();
      });

      it('a check that failed', async () => {
        await setUpAccounts(() => ({ findByFriendCode: async () => Promise.reject(new Error('boom')) }));
        const app = await openFriends();
        const spies = await blockedOnSecondCard();
        await type(2, OLA_CODE);
        await friend(2).findByText('Nie udało się sprawdzić kodu. Spróbuj ponownie.');
        await expectBlocked(app, spies);
      });

      it('a check that is still running', async () => {
        await setUpAccounts(() => ({ findByFriendCode: () => new Promise(() => {}) }));
        const app = await openFriends();
        const spies = await blockedOnSecondCard();
        await type(2, OLA_CODE);
        await friend(2).findByTestId('friend-code-checking');
        await expectBlocked(app, spies);
        expect(friend(2).getByTestId('friend-code-checking')).toBeTruthy();
      });

      it('scrolls to the first card that has a name error or an unresolved code', async () => {
        await setUpAccounts();
        const app = await openFriends();
        const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);
        scrollTo.mockClear();
        await fireEvent.changeText(name(1), 'Kasia');
        await type(1, 'AB');
        await fireEvent(screen.getByTestId('friend-1'), 'layout', { nativeEvent: { layout: { x: 0, y: 100, width: 335, height: 900 } } });
        await fireEvent(screen.getByTestId('friend-2'), 'layout', { nativeEvent: { layout: { x: 0, y: 700, width: 335, height: 900 } } });
        await fireEvent.press(screen.getByText('Dalej'));
        expect(app.getPathname()).toBe('/trips/new/friends');
        expect(scrollTo).toHaveBeenLastCalledWith({ y: 100 - 16, animated: true });
      });
    });

    it('shows the schema error for the same friend twice, translated, if it ever reaches the form', async () => {
      await setUpAccounts();
      const app = await openFriends('test: the same linked friend twice');
      await fireEvent.press(screen.getByText('Dalej'));
      expect(app.getPathname()).toBe('/trips/new/friends');
      expect(friend(2).getByText('Ten znajomy jest już dodany.')).toBeTruthy();
      expect(friend(1).queryByText('Ten znajomy jest już dodany.')).toBeNull();
    });

    it('reads in English', async () => {
      const { ownCode } = await setUpAccounts();
      await openFriends();
      await act(async () => void (await i18n.changeLanguage('en')));
      const englishCode = (number: number) => friend(number).getByLabelText('Friend code');
      const englishName = (number: number) => friend(number).getByLabelText('Name');
      expect(friend(1).getByText('Friend code (optional)')).toBeTruthy();
      await fireEvent.changeText(englishCode(1), ownCode);
      expect(await friend(1).findByText("That's your code.")).toBeTruthy();
      await fireEvent.changeText(englishCode(1), 'ABCDEF');
      expect(await friend(1).findByText('No user has this code.')).toBeTruthy();
      await fireEvent.changeText(englishCode(1), 'ABC');
      await fireEvent.press(screen.getByText('Next'));
      expect(friend(1).getByText('The code has 6 characters.')).toBeTruthy();
      await fireEvent.changeText(englishCode(1), OLA_CODE);
      await waitFor(() => expect(englishName(1).props.value).toBe('ola_b'));
      await fireEvent.changeText(englishCode(2), OLA_CODE);
      expect(await friend(2).findByText('This friend is already added.')).toBeTruthy();
    });
  });
});
