import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { AccessibilityInfo } from 'react-native';
import { ZodError } from 'zod';

import { ServerUnreachableError } from '@/data/errors';
import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { setAppProfileRepository } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/theme';

import { ProfileSetupScreen } from '../ProfileSetupScreen';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launch = jest.mocked(launchImageLibraryAsync);

// A phone with a status bar: the screen has no header, so it must add this itself.
const INSET_TOP = 47;
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));

const hidden = { includeHiddenElements: true };
const PHOTO = 'file:///cache/ImagePicker/photo-1.jpg';
const OTHER_PHOTO = 'file:///cache/ImagePicker/photo-2.jpg';
const ATTACKER_TEXT = 'Click here: evil.example/steal';

// PL copy (P5, D20)
const TITLE = 'Utwórz profil';
const AVATAR = 'Dodaj zdjęcie';
const AVATAR_CHANGE = 'Zmień zdjęcie';
const NICK_LABEL = 'Nazwa użytkownika';
const NICK_HINT = '3–20 znaków: litery, cyfry, _ i .';
const NICK_FORMAT_ERROR = 'Nick: 3–20 znaków, zaczyna się literą; litery, cyfry, _ i .';
const NICK_REQUIRED = 'Wpisz nick.';
const NICK_TAKEN = 'Ten nick jest zajęty.';
const INTERESTS_LABEL = 'Twoje zainteresowania';
const INTERESTS_HINT = 'Wybierz co najmniej jedno.';
const SAVE = 'Zapisz i zaczynamy';
const SAVE_ERROR = 'Nie udało się zapisać profilu. Spróbuj ponownie.';
const PICK_ERROR = 'Nie udało się otworzyć galerii. Spróbuj ponownie.';

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

/** The screen in the app's providers, opened the way the gate opens it: a stack screen without a header. */
async function openSetup() {
  const rendered = renderRouter({ _layout: Layout, onboarding: ProfileSetupScreen }, { initialUrl: '/onboarding' });
  await rendered;
  await waitFor(() => expect(screen.getByTestId('profile-setup-screen')).toBeTruthy());
  return { getPathname: () => rendered.getPathname() };
}

const nickField = () => screen.getByLabelText(NICK_LABEL);
const saveButton = () => screen.getByRole('button', { name: SAVE });
// The photo button: "Dodaj zdjęcie" until a photo is picked, then "Zmień zdjęcie" (D21). Tests of the label itself use the exact names.
const avatarButton = () => screen.getByRole('button', { name: new RegExp(`^(${AVATAR}|${AVATAR_CHANGE})$`) });
const chip = (name: string) => screen.getByRole('checkbox', { name });

const picked = (uri: string) => ({ canceled: false as const, assets: [{ uri, width: 1024, height: 1024 }] });
const cancelled = { canceled: true as const, assets: null };

type Created = jest.Mock<ReturnType<ProfileRepository['createProfile']>, Parameters<ProfileRepository['createProfile']>>;

/** The app's profile repository for the test, with a spy on the save. */
function useRepository(options: Parameters<typeof createInMemoryProfileRepository>[0] = {}) {
  const base = createInMemoryProfileRepository(options);
  const createProfile: Created = jest.fn((input) => base.createProfile(input));
  setAppProfileRepository({ myProfile: () => base.myProfile(), createProfile });
  return createProfile;
}

/** A save that stays open until the test finishes it. */
function holdSave() {
  let finish: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  const base = createInMemoryProfileRepository();
  const createProfile: Created = jest.fn(
    (input) =>
      new Promise((resolve, reject) => {
        finish = () => resolve(base.createProfile(input));
        fail = reject;
      }),
  );
  setAppProfileRepository({ myProfile: () => base.myProfile(), createProfile });
  return { createProfile, finish: () => finish(), fail: (error: Error) => fail(error) };
}

/** A save that fails with this error. */
function failSave(error: Error) {
  const base = createInMemoryProfileRepository();
  const createProfile = jest.fn<ReturnType<ProfileRepository['createProfile']>, Parameters<ProfileRepository['createProfile']>>(() => Promise.reject(error));
  setAppProfileRepository({ myProfile: () => base.myProfile(), createProfile });
  return createProfile;
}

/** The `onPress` of a button, found the way `fireEvent.press` finds it: on the host element or on the component above it. */
function pressHandler(button: ReturnType<typeof saveButton>): () => void {
  for (let fiber = button.unstable_fiber; fiber !== null; fiber = fiber.return) {
    const handler: unknown = fiber.memoizedProps?.onPress;
    if (typeof handler === 'function') return handler as () => void;
  }
  throw new Error('The button has no onPress handler');
}

/** A valid form: a nick and one interest. */
async function fillValid(nick = 'Kacper') {
  await fireEvent.changeText(nickField(), nick);
  await fireEvent.press(chip('Muzea'));
}

let announce: jest.SpyInstance;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  launch.mockReset();
  launch.mockResolvedValue(cancelled);
  useRepository();
  // jest-expo already mocks it, so calls of earlier tests would still be counted.
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announce.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ProfileSetupScreen (auth-onboarding D7, D20, P1, P2, P4, P5)', () => {
  describe('what it shows', () => {
    it('shows the heading, the photo button, the nick field with its hint, the interests with their hint and "Zapisz i zaczynamy"', async () => {
      await openSetup();
      expect(screen.getByRole('header', { name: TITLE })).toBeTruthy();
      expect(avatarButton()).toBeTruthy();
      expect(screen.getByText(AVATAR)).toBeTruthy();
      expect(nickField()).toBeTruthy();
      expect(screen.getByText(NICK_HINT)).toBeTruthy();
      expect(screen.getByText(INTERESTS_LABEL)).toBeTruthy();
      expect(screen.getByText(INTERESTS_HINT)).toBeTruthy();
      expect(saveButton()).toBeEnabled();
      // Nothing is wrong yet: validation happens on save (D20).
      expect(screen.queryByText(NICK_REQUIRED)).toBeNull();
      expect(screen.queryByText(NICK_FORMAT_ERROR)).toBeNull();
      expect(screen.queryByText(SAVE_ERROR)).toBeNull();
    });

    it('speaks English on an English phone', async () => {
      await i18n.changeLanguage('en');
      await openSetup();
      expect(screen.getByRole('header', { name: 'Create your profile' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add photo' })).toBeTruthy();
      expect(screen.getByLabelText('Username')).toBeTruthy();
      expect(screen.getByText('3–20 characters: letters, digits, _ and .')).toBeTruthy();
      expect(screen.getByText('Your interests')).toBeTruthy();
      expect(screen.getByText('Pick at least one.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save and start' })).toBeEnabled();
    });

    it('speaks English for every error', async () => {
      await i18n.changeLanguage('en');
      useRepository({ takenUsernames: ['taken'] });
      await openSetup();
      await fireEvent.press(screen.getByRole('button', { name: 'Save and start' }));
      expect(screen.getByText('Enter a username.')).toBeTruthy();
      expect(screen.getByText('Pick at least one.')).toBeTruthy();

      await fireEvent.changeText(screen.getByLabelText('Username'), 'ab');
      await fireEvent.press(screen.getByRole('button', { name: 'Save and start' }));
      expect(screen.getByText('Username: 3–20 characters, starts with a letter; letters, digits, _ and .')).toBeTruthy();

      await fireEvent.changeText(screen.getByLabelText('Username'), 'taken');
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Museums' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Save and start' }));
      await waitFor(() => expect(screen.getByText('This username is taken.')).toBeTruthy());
    });

    it('uses the same 17 interest chips in 6 groups as the friends step', async () => {
      await openSetup();
      expect(screen.getAllByRole('checkbox')).toHaveLength(17);
      for (const group of ['Zabawa', 'Natura', 'Kultura', 'Jedzenie', 'Aktywnie', 'Relaks i inne']) {
        expect(screen.getByText(group)).toBeTruthy();
      }
      expect(chip('Aquaparki i parki rozrywki')).toBeTruthy();
    });

    it('uses the theme background', async () => {
      await openSetup();
      expect(screen.getByTestId('profile-setup-screen')).toHaveStyle({ backgroundColor: lightTheme.colors.background });
    });
  });

  describe('the nick field', () => {
    it('is set up for a nick: no capitals, no autocorrect', async () => {
      await openSetup();
      expect(nickField().props.autoCapitalize).toBe('none');
      expect(nickField().props.autoCorrect).toBe(false);
    });

    it('turns letters into lower case as they are typed', async () => {
      await openSetup();
      await fireEvent.changeText(nickField(), 'KaCper_1.X');
      expect(nickField().props.value).toBe('kacper_1.x');
    });

    it('hides the hint while the format error shows, and brings it back when the user types', async () => {
      await openSetup();
      await fireEvent.changeText(nickField(), 'ab');
      await fireEvent.press(saveButton());
      expect(screen.getByText(NICK_FORMAT_ERROR)).toBeTruthy();
      expect(screen.queryByText(NICK_HINT)).toBeNull();

      await fireEvent.changeText(nickField(), 'abc');

      expect(screen.queryByText(NICK_FORMAT_ERROR)).toBeNull();
      expect(screen.getByText(NICK_HINT)).toBeTruthy();
    });
  });

  describe('validation on save: field errors and no request', () => {
    it('an empty nick: "Wpisz nick."', async () => {
      const create = useRepository();
      await openSetup();
      await fireEvent.press(chip('Muzea'));

      await fireEvent.press(saveButton());

      expect(screen.getByText(NICK_REQUIRED)).toBeTruthy();
      expect(screen.getByText(NICK_REQUIRED)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(nickField().props.accessibilityHint).toBe(NICK_REQUIRED);
      expect(nickField()).toHaveStyle({ borderWidth: 2, borderColor: lightTheme.colors.status.error });
      expect(screen.queryByText(NICK_FORMAT_ERROR)).toBeNull();
      expect(create).not.toHaveBeenCalled();
    });

    it('a nick of only spaces counts as empty', async () => {
      const create = useRepository();
      await openSetup();
      await fireEvent.changeText(nickField(), '   ');
      await fireEvent.press(chip('Muzea'));

      await fireEvent.press(saveButton());

      expect(screen.getByText(NICK_REQUIRED)).toBeTruthy();
      expect(create).not.toHaveBeenCalled();
    });

    it.each([['ab'], ['1abc'], ['a'.repeat(21)], ['ab..cd'], ['abc.'], ['ab cd'], ['ab-cd'], ['żółw1']])(
      'the nick "%s" has a bad format: the format error, no request',
      async (nick) => {
        const create = useRepository();
        await openSetup();
        await fireEvent.changeText(nickField(), nick);
        await fireEvent.press(chip('Muzea'));

        await fireEvent.press(saveButton());

        expect(screen.getByText(NICK_FORMAT_ERROR)).toBeTruthy();
        expect(screen.getByText(NICK_FORMAT_ERROR)).toHaveStyle({ color: lightTheme.colors.status.error });
        expect(screen.queryByText(NICK_HINT)).toBeNull();
        expect(screen.queryByText(NICK_REQUIRED)).toBeNull();
        expect(create).not.toHaveBeenCalled();
      },
    );

    it('no interest: "Wybierz co najmniej jedno." as the error of the interests, in the error colour and with an icon', async () => {
      const create = useRepository();
      await openSetup();
      await fireEvent.changeText(nickField(), 'kacper');
      expect(screen.queryAllByTestId('field-error-icon', hidden)).toHaveLength(0);

      await fireEvent.press(saveButton());

      // The hint and the error say the same, so the error takes the hint's place: the text is there once.
      const error = screen.getByText(INTERESTS_HINT);
      expect(error).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(screen.getAllByText(INTERESTS_HINT)).toHaveLength(1);
      // Not by colour alone: the error comes with an icon, hidden from screen readers (the text is read).
      expect(screen.getAllByTestId('field-error-icon', hidden)).toHaveLength(1);
      expect(create).not.toHaveBeenCalled();
    });

    it('shows the nick error and the interests error together', async () => {
      const create = useRepository();
      await openSetup();

      await fireEvent.press(saveButton());

      expect(screen.getByText(NICK_REQUIRED)).toBeTruthy();
      expect(screen.getByText(INTERESTS_HINT)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(screen.getAllByTestId('field-error-icon', hidden)).toHaveLength(2);
      expect(create).not.toHaveBeenCalled();
    });

    it('does not read the field errors twice: they are live regions already, so nothing is announced as well', async () => {
      await openSetup();

      await fireEvent.press(saveButton());

      expect(screen.getByText(NICK_REQUIRED).props.accessibilityLiveRegion).toBe('polite');
      expect(screen.getByText(INTERESTS_HINT).props.accessibilityLiveRegion).toBe('polite');
      expect(announce).not.toHaveBeenCalled();
    });

    it('the nick error goes away when the user types, the interests error when they pick one', async () => {
      await openSetup();
      await fireEvent.press(saveButton());
      expect(screen.getByText(NICK_REQUIRED)).toBeTruthy();

      await fireEvent.changeText(nickField(), 'k');
      expect(screen.queryByText(NICK_REQUIRED)).toBeNull();
      expect(screen.getByText(INTERESTS_HINT)).toHaveStyle({ color: lightTheme.colors.status.error });

      await fireEvent.press(chip('Muzea'));
      expect(screen.getByText(INTERESTS_HINT)).toHaveStyle({ color: lightTheme.colors.text.secondary });
      expect(screen.queryAllByTestId('field-error-icon', hidden)).toHaveLength(0);
    });

    it('a picked interest can be taken back, and then the next save complains again', async () => {
      const create = useRepository();
      await openSetup();
      await fillValid();
      await fireEvent.press(chip('Muzea'));
      expect(chip('Muzea')).not.toBeChecked();

      await fireEvent.press(saveButton());

      expect(screen.getByText(INTERESTS_HINT)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('the profile photo (P2, D20)', () => {
    it('is a round 96dp placeholder with a camera icon hidden from screen readers, labelled "Dodaj zdjęcie"', async () => {
      await openSetup();
      expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
      expect(screen.getByTestId('avatar-placeholder')).toHaveStyle({
        width: lightTheme.size.avatarSetup,
        height: lightTheme.size.avatarSetup,
        borderRadius: lightTheme.radius.full,
      });
      expect(screen.getByTestId('avatar-camera', hidden)).toBeTruthy();
      expect(screen.queryByTestId('avatar-camera')).toBeNull(); // not in the accessibility tree
      expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();
      // The 96dp circle is far above the 44dp minimum touch target.
      expect(lightTheme.size.avatarSetup).toBeGreaterThanOrEqual(lightTheme.size.touchTarget);
    });

    it('opens the gallery with a square crop, images only', async () => {
      await openSetup();

      await fireEvent.press(avatarButton());

      expect(launch).toHaveBeenCalledTimes(1);
      expect(launch).toHaveBeenCalledWith(
        expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] }),
      );
    });

    it('shows the picked photo as a round preview of the local uri, in place of the placeholder', async () => {
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());
      expect(screen.getByTestId('avatar-preview', hidden).props.source).toEqual([{ uri: PHOTO }]);
      expect(screen.getByTestId('avatar-preview', hidden)).toHaveStyle({
        width: lightTheme.size.avatarSetup,
        height: lightTheme.size.avatarSetup,
        borderRadius: lightTheme.radius.full,
      });
      expect(screen.queryByTestId('avatar-placeholder', hidden)).toBeNull();
      // A decorative picture: the button's label says what it does.
      expect(screen.queryByTestId('avatar-preview')).toBeNull();
    });

    it('a second pick replaces the first', async () => {
      launch.mockResolvedValueOnce(picked(PHOTO)).mockResolvedValueOnce(picked(OTHER_PHOTO));
      await openSetup();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden).props.source).toEqual([{ uri: PHOTO }]));

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden).props.source).toEqual([{ uri: OTHER_PHOTO }]));
    });

    it('cancelling the gallery keeps the previous choice', async () => {
      launch.mockResolvedValueOnce(picked(PHOTO)).mockResolvedValueOnce(cancelled);
      await openSetup();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(launch).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('avatar-preview', hidden).props.source).toEqual([{ uri: PHOTO }]);
      expect(screen.queryByText(PICK_ERROR)).toBeNull();
    });

    it('cancelling the gallery without a photo leaves the placeholder, with no error', async () => {
      await openSetup();

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(launch).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
      expect(screen.queryByText(PICK_ERROR)).toBeNull();
    });

    it('is called "Dodaj zdjęcie" until a photo is picked, then "Zmień zdjęcie", both written and spoken (D21)', async () => {
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();
      expect(screen.getByRole('button', { name: AVATAR })).toBeTruthy();
      expect(screen.getByText(AVATAR)).toBeTruthy();
      expect(screen.queryByText(AVATAR_CHANGE)).toBeNull();

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(screen.getByRole('button', { name: AVATAR_CHANGE })).toBeTruthy());
      expect(avatarButton().props.accessibilityLabel).toBe(AVATAR_CHANGE);
      expect(screen.getByText(AVATAR_CHANGE)).toBeTruthy();
      expect(screen.queryByText(AVATAR)).toBeNull();
      expect(screen.queryByRole('button', { name: AVATAR })).toBeNull();
    });

    it('is "Change photo" after a pick on an English phone', async () => {
      await i18n.changeLanguage('en');
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();
      expect(screen.getByRole('button', { name: 'Add photo' })).toBeTruthy();

      await fireEvent.press(screen.getByRole('button', { name: 'Add photo' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Change photo' })).toBeTruthy());
      expect(screen.getByText('Change photo')).toBeTruthy();
      expect(screen.queryByText('Add photo')).toBeNull();
    });

    it('keeps "Zmień zdjęcie" when a later pick is cancelled or fails, and "Dodaj zdjęcie" when there never was a photo', async () => {
      launch.mockResolvedValueOnce(cancelled).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(picked(PHOTO));
      await openSetup();
      await fireEvent.press(avatarButton()); // cancelled: no photo yet
      await waitFor(() => expect(launch).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: AVATAR })).toBeTruthy();
      await fireEvent.press(avatarButton()); // fails: no photo yet
      await waitFor(() => expect(screen.getByText(PICK_ERROR)).toBeTruthy());
      expect(screen.getByRole('button', { name: AVATAR })).toBeTruthy();

      await fireEvent.press(avatarButton()); // picked
      await waitFor(() => expect(screen.getByRole('button', { name: AVATAR_CHANGE })).toBeTruthy());
      launch.mockResolvedValueOnce(cancelled);
      await fireEvent.press(avatarButton()); // cancelled: the photo stays
      await waitFor(() => expect(launch).toHaveBeenCalledTimes(4));
      expect(screen.getByRole('button', { name: AVATAR_CHANGE })).toBeTruthy();
    });

    describe('a second tap while the gallery is opening (D21)', () => {
      /** A gallery that stays open until the test closes it. */
      function holdGallery() {
        let close: (result: Awaited<ReturnType<typeof launchImageLibraryAsync>>) => void = () => {};
        let fail: (error: Error) => void = () => {};
        launch.mockImplementation(
          () =>
            new Promise((resolve, reject) => {
              close = resolve;
              fail = reject;
            }),
        );
        return { close: (result: Awaited<ReturnType<typeof launchImageLibraryAsync>>) => close(result), fail: (error: Error) => fail(error) };
      }

      it('does nothing: two taps in the same moment open the gallery once', async () => {
        const gallery = holdGallery();
        await openSetup();

        // Both taps run before React renders anything, so the press handler itself is called twice inside one act.
        const onPress = pressHandler(avatarButton());
        await act(async () => {
          onPress();
          onPress();
        });

        expect(launch).toHaveBeenCalledTimes(1);
        await act(async () => gallery.close(cancelled));
      });

      it.each([
        ['a photo is picked', (gallery: ReturnType<typeof holdGallery>) => gallery.close(picked(PHOTO))],
        ['the gallery is cancelled', (gallery: ReturnType<typeof holdGallery>) => gallery.close(cancelled)],
        ['the gallery fails to open', (gallery: ReturnType<typeof holdGallery>) => gallery.fail(new Error('x'))],
      ])('opens the gallery again once %s', async (_name, settle) => {
        const gallery = holdGallery();
        await openSetup();
        // Not fireEvent.press: it waits for the handler's promise, and that is the open gallery.
        const tap = () => act(async () => void pressHandler(avatarButton())());

        await tap();
        expect(launch).toHaveBeenCalledTimes(1);
        await tap();
        expect(launch).toHaveBeenCalledTimes(1);

        await act(async () => settle(gallery));
        await tap();

        expect(launch).toHaveBeenCalledTimes(2);
      });
    });

    it('has no way to remove the photo (D20)', async () => {
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());
      expect(screen.queryByRole('button', { name: /usuń|remove|delete/i })).toBeNull();
      expect(screen.getAllByRole('button')).toHaveLength(2); // the photo and "Zapisz i zaczynamy"
    });

    it('a gallery that cannot be opened is an announced, fixed error with an icon, and the previous photo stays', async () => {
      launch.mockResolvedValueOnce(picked(PHOTO)).mockRejectedValueOnce(new Error(ATTACKER_TEXT));
      await openSetup();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(screen.getByText(PICK_ERROR)).toBeTruthy());
      expect(announce).toHaveBeenCalledWith(PICK_ERROR);
      expect(screen.getByText(PICK_ERROR)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(screen.getByTestId('avatar-error-icon', hidden)).toBeTruthy();
      expect(JSON.stringify(screen.toJSON())).not.toContain(ATTACKER_TEXT);
      expect(screen.getByTestId('avatar-preview', hidden).props.source).toEqual([{ uri: PHOTO }]);
    });

    it('a picked uri that is not a file on the phone is refused with the same error', async () => {
      launch.mockResolvedValue(picked('https://evil.example/photo.jpg'));
      await openSetup();

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(screen.getByText(PICK_ERROR)).toBeTruthy());
      expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();
    });

    it('the error goes away on the next pick', async () => {
      launch.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(picked(PHOTO));
      await openSetup();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByText(PICK_ERROR)).toBeTruthy());

      await fireEvent.press(avatarButton());

      await waitFor(() => expect(screen.queryByText(PICK_ERROR)).toBeNull());
      expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy();
    });
  });

  describe('saving', () => {
    it('sends the normalised nick, the interests and the picked photo, and does not navigate by itself', async () => {
      const create = useRepository();
      launch.mockResolvedValue(picked(PHOTO));
      const { getPathname } = await openSetup();
      await fillValid('  KaCper ');
      await fireEvent.press(chip('Plaże'));
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());

      await fireEvent.press(saveButton());

      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      expect(create).toHaveBeenCalledWith({ username: 'kacper', interests: ['museums', 'beaches'], avatarUri: PHOTO });
      // Success is for the gate to act on (the profile query now holds the profile): the screen leaves nothing to chance.
      await act(async () => {});
      expect(getPathname()).toBe('/onboarding');
    });

    it('sends a null photo when none was picked', async () => {
      const create = useRepository();
      await openSetup();
      await fillValid();

      await fireEvent.press(saveButton());

      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      expect(create).toHaveBeenCalledWith({ username: 'kacper', interests: ['museums'], avatarUri: null });
    });

    it('saves from the keyboard "done" key too', async () => {
      const create = useRepository();
      await openSetup();
      await fillValid();

      await fireEvent(nickField(), 'submitEditing');

      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    });

    it('is loading while it saves: the button is busy and every control is locked', async () => {
      const save = holdSave();
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();
      await fillValid();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());

      await fireEvent.press(saveButton());

      await waitFor(() => expect(saveButton()).toBeBusy());
      expect(screen.getByTestId('primary-button-spinner')).toBeTruthy();
      expect(nickField().props.editable).toBe(false);
      expect(nickField().props.value).toBe('kacper');
      for (const interest of screen.getAllByRole('checkbox')) expect(interest).toBeDisabled();
      expect(avatarButton()).toBeDisabled();
      // A tap on a locked control does nothing.
      await fireEvent.press(chip('Plaże'));
      expect(chip('Plaże')).not.toBeChecked();
      await fireEvent.press(avatarButton());
      expect(launch).toHaveBeenCalledTimes(1);

      await act(async () => save.finish());
    });

    it('a second press, and the keyboard key, send nothing more while it saves', async () => {
      const save = holdSave();
      await openSetup();
      await fillValid();

      await fireEvent.press(saveButton());
      await waitFor(() => expect(saveButton()).toBeBusy());
      await fireEvent.press(saveButton());
      await fireEvent(nickField(), 'submitEditing');

      expect(save.createProfile).toHaveBeenCalledTimes(1);
      await act(async () => save.finish());
      expect(save.createProfile).toHaveBeenCalledTimes(1);
    });

    it('two taps in the same moment send only once', async () => {
      const save = holdSave();
      await openSetup();
      await fillValid();

      // Both taps run before React renders the loading state, so the press handler itself is called twice inside one act.
      const onPress = pressHandler(saveButton());
      await act(async () => {
        onPress();
        onPress();
      });

      expect(save.createProfile).toHaveBeenCalledTimes(1);
      await act(async () => save.finish());
    });

    it('stays busy after a success, until the gate takes the screen away, so nothing can be sent twice', async () => {
      const save = holdSave();
      await openSetup();
      await fillValid();
      await fireEvent.press(saveButton());
      await waitFor(() => expect(saveButton()).toBeBusy());

      await act(async () => save.finish());
      // Let the mutation settle, so only the success state is left to guard. renderRouter turns on Jest's fake timers and TanStack Query
      // notifies its observers from a timer, so the timer is advanced by hand (without this, a button that stops being busy on success passes).
      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(saveButton()).toBeBusy();
      expect(screen.getByTestId('primary-button-spinner')).toBeTruthy();
      expect(nickField().props.editable).toBe(false);
      await fireEvent.press(saveButton());
      await fireEvent(nickField(), 'submitEditing');
      expect(save.createProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('a taken nick', () => {
    it('is the error "Ten nick jest zajęty." on the nick field, and everything the user entered stays', async () => {
      useRepository({ takenUsernames: ['kacper'] });
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();
      await fillValid('Kacper');
      await fireEvent.press(chip('Plaże'));
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());

      await fireEvent.press(saveButton());

      await waitFor(() => expect(screen.getByText(NICK_TAKEN)).toBeTruthy());
      expect(screen.getByText(NICK_TAKEN)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(nickField().props.accessibilityHint).toBe(NICK_TAKEN);
      expect(nickField()).toHaveStyle({ borderWidth: 2, borderColor: lightTheme.colors.status.error });
      expect(screen.queryByText(NICK_HINT)).toBeNull();
      // Not the general save error: it is about the field.
      expect(screen.queryByText(SAVE_ERROR)).toBeNull();
      expect(screen.queryByTestId('profile-save-error')).toBeNull();
      // Nothing is lost, and the form is usable again.
      expect(nickField().props.value).toBe('kacper');
      expect(chip('Muzea')).toBeChecked();
      expect(chip('Plaże')).toBeChecked();
      expect(screen.getByTestId('avatar-preview', hidden).props.source).toEqual([{ uri: PHOTO }]);
      expect(nickField().props.editable).not.toBe(false);
      expect(saveButton()).toBeEnabled();
      expect(saveButton()).not.toBeBusy();
      // The field error is a live region; nothing else is announced.
      expect(announce).not.toHaveBeenCalled();
    });

    it('goes away when the user types another nick, and the next save goes through', async () => {
      const create = useRepository({ takenUsernames: ['kacper'] });
      await openSetup();
      await fillValid('kacper');
      await fireEvent.press(saveButton());
      await waitFor(() => expect(screen.getByText(NICK_TAKEN)).toBeTruthy());

      await fireEvent.changeText(nickField(), 'kacper2');

      expect(screen.queryByText(NICK_TAKEN)).toBeNull();
      await fireEvent.press(saveButton());
      await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
      expect(create).toHaveBeenLastCalledWith({ username: 'kacper2', interests: ['museums'], avatarUri: null });
      expect(screen.queryByText(NICK_TAKEN)).toBeNull();
    });
  });

  describe('any other failed save: fixed copy, never the error text (D20)', () => {
    it.each([
      ['an error carrying attacker text', () => new Error(ATTACKER_TEXT)],
      ['an unreachable server', () => new ServerUnreachableError(ATTACKER_TEXT)],
      ['a ZodError from the data layer', () => new ZodError([{ code: 'custom', path: ['username'], message: ATTACKER_TEXT }])],
    ])('%s', async (_name, makeError) => {
      const create = failSave(makeError());
      launch.mockResolvedValue(picked(PHOTO));
      const { getPathname } = await openSetup();
      await fillValid();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());

      await fireEvent.press(saveButton());

      await waitFor(() => expect(screen.getByText(SAVE_ERROR)).toBeTruthy());
      expect(create).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(SAVE_ERROR);
      expect(screen.getByText(SAVE_ERROR)).toHaveStyle({ color: lightTheme.colors.status.error });
      expect(screen.getByTestId('profile-save-error-icon', hidden)).toBeTruthy();
      expect(JSON.stringify(screen.toJSON())).not.toContain('evil.example');
      expect(JSON.stringify(screen.toJSON())).not.toContain(ATTACKER_TEXT);
      expect(getPathname()).toBe('/onboarding');
      // The nick field shows no error: this is not about the nick.
      expect(nickField().props.accessibilityHint).toBe(NICK_HINT);
      // Usable again, and everything is as the user left it.
      expect(nickField().props.value).toBe('kacper');
      expect(nickField().props.editable).not.toBe(false);
      expect(chip('Muzea')).toBeChecked();
      expect(screen.getByTestId('avatar-preview', hidden).props.source).toEqual([{ uri: PHOTO }]);
      expect(saveButton()).toBeEnabled();
      expect(saveButton()).not.toBeBusy();
    });

    it('sits above the button, in the pinned part, not in the scrolling part', async () => {
      failSave(new Error('x'));
      await openSetup();
      await fillValid();

      await fireEvent.press(saveButton());

      await waitFor(() => expect(screen.getByText(SAVE_ERROR)).toBeTruthy());
      expect(within(screen.getByTestId('profile-setup-screen-scroll')).queryByText(SAVE_ERROR)).toBeNull();
      expect(within(screen.getByTestId('profile-setup-screen-scroll')).queryByRole('button', { name: SAVE })).toBeNull();
    });

    it('goes away when the user tries again, and a retry sends again', async () => {
      const base = createInMemoryProfileRepository();
      const create: Created = jest
        .fn<ReturnType<ProfileRepository['createProfile']>, Parameters<ProfileRepository['createProfile']>>()
        .mockRejectedValueOnce(new Error('x'))
        .mockImplementation((input) => base.createProfile(input));
      setAppProfileRepository({ myProfile: () => base.myProfile(), createProfile: create });
      await openSetup();
      await fillValid();
      await fireEvent.press(saveButton());
      await waitFor(() => expect(screen.getByText(SAVE_ERROR)).toBeTruthy());

      await fireEvent.press(saveButton());

      await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText(SAVE_ERROR)).toBeNull());
    });

    it('unlocks the controls after a failure that comes late', async () => {
      const save = holdSave();
      await openSetup();
      await fillValid();
      await fireEvent.press(saveButton());
      await waitFor(() => expect(nickField().props.editable).toBe(false));

      await act(async () => save.fail(new Error('x')));

      await waitFor(() => expect(screen.getByText(SAVE_ERROR)).toBeTruthy());
      expect(nickField().props.editable).not.toBe(false);
      for (const interest of screen.getAllByRole('checkbox')) expect(interest).toBeEnabled();
      expect(avatarButton()).toBeEnabled();
      await fireEvent.press(saveButton());
      expect(save.createProfile).toHaveBeenCalledTimes(2);
    });

    it('is in English on an English phone', async () => {
      await i18n.changeLanguage('en');
      failSave(new Error('x'));
      await openSetup();
      await fireEvent.changeText(screen.getByLabelText('Username'), 'kacper');
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Museums' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Save and start' }));
      await waitFor(() => expect(screen.getByText("Couldn't save your profile. Try again.")).toBeTruthy());
    });
  });

  describe('offline (P4)', () => {
    it('shows the offline banner and disables the save button: no request', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      const create = useRepository();
      await openSetup();
      await fillValid();

      expect(screen.getByTestId('offline-banner')).toBeTruthy();
      expect(saveButton()).toBeDisabled();
      await fireEvent.press(saveButton());
      await fireEvent(nickField(), 'submitEditing');
      expect(create).not.toHaveBeenCalled();
      expect(screen.queryByText(NICK_REQUIRED)).toBeNull();
    });

    it('still lets the user fill the form in: the nick, the interests and the photo', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();

      await fireEvent.changeText(nickField(), 'kacper');
      await fireEvent.press(chip('Muzea'));
      await fireEvent.press(avatarButton());

      expect(nickField().props.editable).not.toBe(false);
      expect(nickField().props.value).toBe('kacper');
      expect(chip('Muzea')).toBeChecked();
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());
    });

    it('shows no banner while online', async () => {
      await openSetup();
      expect(screen.queryByTestId('offline-banner')).toBeNull();
    });

    it('enables the button again when the connection returns, with the form as it was', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      const create = useRepository();
      await openSetup();
      await fillValid();

      await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));

      expect(saveButton()).toBeEnabled();
      expect(screen.queryByTestId('offline-banner')).toBeNull();
      await fireEvent.press(saveButton());
      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    });
  });

  describe('layout and keyboard', () => {
    // How the frame moves with the keyboard (KeyboardAvoidingView) is checked on a device: Jest has no keyboard.
    it('pins "Zapisz i zaczynamy" below the scrolling content, which keeps taps working while the keyboard is open', async () => {
      await openSetup();
      const scroll = screen.getByTestId('profile-setup-screen-scroll');
      expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
      // The form scrolls (large fonts); the button is outside the scroll view, so it stays above the keyboard.
      expect(within(scroll).getByLabelText(NICK_LABEL)).toBeTruthy();
      expect(within(scroll).getByText(INTERESTS_LABEL)).toBeTruthy();
      expect(within(scroll).getByRole('button', { name: AVATAR })).toBeTruthy();
      expect(within(scroll).queryByRole('button', { name: SAVE })).toBeNull();
    });

    it('starts below the status bar: this screen has no header, so it adds the top inset itself', async () => {
      await openSetup();
      const style = Object.assign({}, ...[screen.getByTestId('profile-setup-screen-scroll').props.contentContainerStyle].flat(2)) as {
        paddingTop: number;
      };
      expect(style.paddingTop).toBe(INSET_TOP + lightTheme.spacing[4]);
    });
  });
});
