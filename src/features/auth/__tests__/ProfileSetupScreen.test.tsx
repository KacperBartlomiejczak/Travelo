import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { AccessibilityInfo, findNodeHandle, ScrollView } from 'react-native';
import { ZodError } from 'zod';

import { appProviderProfile } from '@/data/app-provider-profile';
import { ServerUnreachableError } from '@/data/errors';
import { createInMemoryProfileRepository, UsernameTakenError, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { setAppProfileRepository } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/legacy/theme';

import { ProfileSetupScreen } from '../ProfileSetupScreen';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launch = jest.mocked(launchImageLibraryAsync);

// A phone with a status bar: the screen has no header, so it must add this itself.
const INSET_TOP = 47;
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));

// The screen reader focus is moved by node handle, and Jest has none: the handle of the nick is made up here, so a test can tell it was focused.
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => {
  const actual = jest.requireActual('react-native/Libraries/ReactNative/RendererProxy');
  return { ...actual, findNodeHandle: jest.fn(actual.findNodeHandle) };
});
const actualFindNodeHandle = jest.requireActual<typeof import('react-native/Libraries/ReactNative/RendererProxy')>(
  'react-native/Libraries/ReactNative/RendererProxy',
).findNodeHandle;
const NICK_HANDLE = 1001;

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
  setAppProfileRepository({ ...base, myProfile: () => base.myProfile(), createProfile });
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
  setAppProfileRepository({ ...base, myProfile: () => base.myProfile(), createProfile });
  return { createProfile, finish: () => finish(), fail: (error: Error) => fail(error) };
}

/** A save that fails with this error. */
function failSave(error: Error) {
  const base = createInMemoryProfileRepository();
  const createProfile = jest.fn<ReturnType<ProfileRepository['createProfile']>, Parameters<ProfileRepository['createProfile']>>(() => Promise.reject(error));
  setAppProfileRepository({ ...base, myProfile: () => base.myProfile(), createProfile });
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

/** Where the nick block sits in the scrolling content (Jest lays nothing out, so the test reports it). */
const NICK_Y = 210;

async function layOut(testID: string, y: number) {
  await fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y, width: 360, height: 120 } } });
}

/** The screen has been laid out: the nick block at a known place. */
async function openLaidOut() {
  const opened = await openSetup();
  await layOut('profile-nick-block', NICK_Y);
  return opened;
}

const scrollTo = () => jest.mocked(ScrollView.prototype.scrollTo);
const screenReaderFocus = () => jest.mocked(AccessibilityInfo.setAccessibilityFocus);

let announce: jest.SpyInstance;

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  launch.mockReset();
  launch.mockResolvedValue(cancelled);
  useRepository();
  // jest-expo already mocks it, so calls of earlier tests would still be counted.
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announce.mockClear();
  scrollTo().mockClear();
  screenReaderFocus().mockClear();
  // The nick input is the node with the nick's label.
  jest.mocked(findNodeHandle).mockImplementation((node) => {
    const props = (node as { props?: { accessibilityLabel?: string } } | null)?.props;
    if (props?.accessibilityLabel === NICK_LABEL) return NICK_HANDLE;
    return actualFindNodeHandle(node);
  });
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
      // The button waits for a complete form (D4), and nothing is wrong yet: nothing is checked.
      expect(saveButton()).toBeDisabled();
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
      expect(screen.getByRole('button', { name: 'Save and start' })).toBeDisabled();
    });

    it('speaks English for the taken nick', async () => {
      await i18n.changeLanguage('en');
      useRepository({ takenUsernames: ['taken'] });
      await openSetup();
      expect(screen.getByRole('button', { name: 'Save and start' })).toBeDisabled();

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
  });

  describe('an incomplete form (D4, P4): the button waits, nothing is checked and nothing is sent', () => {
    const expectNoErrors = () => {
      expect(screen.queryByText(NICK_REQUIRED)).toBeNull();
      expect(screen.queryByText(NICK_FORMAT_ERROR)).toBeNull();
      expect(screen.queryAllByTestId('field-error-icon', hidden)).toHaveLength(0);
      // The hints stay what they are, in their own colour.
      expect(screen.getByText(NICK_HINT)).toBeTruthy();
      expect(screen.getByText(INTERESTS_HINT)).toHaveStyle({ color: lightTheme.colors.text.secondary });
    };

    it('an empty form: the button is disabled, a tap and the keyboard key do nothing', async () => {
      const create = useRepository();
      await openSetup();
      expect(saveButton()).toBeDisabled();

      await fireEvent.press(saveButton());
      await fireEvent(nickField(), 'submitEditing');

      expect(create).not.toHaveBeenCalled();
      expectNoErrors();
    });

    it('a valid nick and no interest: the button is disabled', async () => {
      const create = useRepository();
      await openSetup();
      await fireEvent.changeText(nickField(), 'kacper');

      expect(saveButton()).toBeDisabled();
      await fireEvent.press(saveButton());
      await fireEvent(nickField(), 'submitEditing');

      expect(create).not.toHaveBeenCalled();
      expectNoErrors();
    });

    it('an interest and no nick: the button is disabled', async () => {
      const create = useRepository();
      await openSetup();
      await fireEvent.press(chip('Muzea'));

      expect(saveButton()).toBeDisabled();
      await fireEvent.press(saveButton());
      await fireEvent(nickField(), 'submitEditing');

      expect(create).not.toHaveBeenCalled();
      expect(screen.queryByText(NICK_REQUIRED)).toBeNull();
      expect(screen.queryAllByTestId('field-error-icon', hidden)).toHaveLength(0);
    });

    it.each([['ab'], ['1abc'], ['a..b'], ['a'.repeat(21)], ['ab..cd'], ['abc.'], ['ab cd'], ['ab-cd'], ['żółw1'], ['   ']])(
      'the nick "%s" is not valid, so with an interest the button is still disabled and nothing is sent',
      async (nick) => {
        const create = useRepository();
        await openSetup();
        await fireEvent.changeText(nickField(), nick);
        await fireEvent.press(chip('Muzea'));

        expect(saveButton()).toBeDisabled();
        await fireEvent.press(saveButton());
        await fireEvent(nickField(), 'submitEditing');

        expect(create).not.toHaveBeenCalled();
        expect(screen.queryByText(NICK_REQUIRED)).toBeNull();
        expect(screen.queryByText(NICK_FORMAT_ERROR)).toBeNull();
        expect(screen.queryAllByTestId('field-error-icon', hidden)).toHaveLength(0);
        expect(screen.getByText(NICK_HINT)).toBeTruthy();
      },
    );

    it('a valid nick and one interest: the button is enabled', async () => {
      await openSetup();
      await fillValid();
      expect(saveButton()).toBeEnabled();
    });

    it('turns on as soon as the form is complete, whichever half comes last', async () => {
      await openSetup();
      await fireEvent.press(chip('Muzea'));
      expect(saveButton()).toBeDisabled();
      await fireEvent.changeText(nickField(), 'ka');
      expect(saveButton()).toBeDisabled();
      await fireEvent.changeText(nickField(), 'kac');
      expect(saveButton()).toBeEnabled();
    });

    it('is disabled again when the last interest is taken back, and the keyboard key does nothing', async () => {
      const create = useRepository();
      await openSetup();
      await fillValid();
      await fireEvent.press(chip('Plaże'));
      await fireEvent.press(chip('Muzea'));
      expect(saveButton()).toBeEnabled();

      await fireEvent.press(chip('Plaże'));

      expect(chip('Plaże')).not.toBeChecked();
      expect(saveButton()).toBeDisabled();
      await fireEvent(nickField(), 'submitEditing');
      expect(create).not.toHaveBeenCalled();
      expectNoErrors();
    });

    it('is disabled again when the nick stops being valid', async () => {
      await openSetup();
      await fillValid();
      expect(saveButton()).toBeEnabled();

      await fireEvent.changeText(nickField(), 'k');

      expect(saveButton()).toBeDisabled();
    });

    it('keeps the nick hint and shows no format error while the nick is not valid', async () => {
      await openSetup();
      await fireEvent.changeText(nickField(), 'ab');
      expect(screen.getByText(NICK_HINT)).toBeTruthy();
      expect(screen.queryByText(NICK_FORMAT_ERROR)).toBeNull();

      await fireEvent.changeText(nickField(), 'abc');

      expect(screen.getByText(NICK_HINT)).toBeTruthy();
    });

    it('the picked photo does not complete the form', async () => {
      launch.mockResolvedValue(picked(PHOTO));
      await openSetup();
      await fireEvent.press(avatarButton());
      await waitFor(() => expect(screen.getByTestId('avatar-preview', hidden)).toBeTruthy());

      expect(saveButton()).toBeDisabled();
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
      expect(screen.getByText(NICK_TAKEN).props.accessibilityLiveRegion).toBe('polite');
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
      setAppProfileRepository({ ...base, myProfile: () => base.myProfile(), createProfile: create });
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

  describe('where the interests hint and error sit (D24, P5)', () => {
    const tree = () => JSON.stringify(screen.toJSON());

    it('the hint is right under the "Twoje zainteresowania" heading, before the first chip group', async () => {
      await openSetup();
      expect(tree().indexOf(INTERESTS_LABEL)).toBeLessThan(tree().indexOf(INTERESTS_HINT));
      expect(tree().indexOf(INTERESTS_HINT)).toBeLessThan(tree().indexOf('Zabawa'));
    });

    it('while no interest is picked the hint stays a plain hint: its own colour, no error icon, never an error (D4, P4)', async () => {
      await openSetup();
      await fireEvent.changeText(nickField(), 'kacper');

      await fireEvent(nickField(), 'submitEditing');

      expect(tree().indexOf(INTERESTS_LABEL)).toBeLessThan(tree().indexOf(INTERESTS_HINT));
      expect(tree().indexOf(INTERESTS_HINT)).toBeLessThan(tree().indexOf('Zabawa'));
      expect(screen.getAllByText(INTERESTS_HINT)).toHaveLength(1);
      expect(screen.getByText(INTERESTS_HINT)).toHaveStyle({ color: lightTheme.colors.text.secondary });
      expect(screen.queryAllByTestId('field-error-icon', hidden)).toHaveLength(0);
    });

    /**
     * The nick's Field frame holds the label, the input and then the message as siblings. Walks up from the input to the frame (the first
     * ancestor that also holds the message) and returns the position of the input and of the message among the frame's children.
     */
    function nickSiblingOrder(message: string) {
      // A node holds the message when it is, or contains, the Text that shows it.
      const holds = (node: ReturnType<typeof nickField>) =>
        [node.props.children].flat().includes(message) || within(node).queryByText(message) !== null;
      let inputChild = nickField();
      while (inputChild.parent && !holds(inputChild.parent)) inputChild = inputChild.parent;
      const frame = inputChild.parent;
      if (!frame) throw new Error('The nick input has no Field frame');
      const children = frame.children.filter((child) => typeof child !== 'string');
      return {
        input: children.indexOf(inputChild),
        message: children.findIndex((child) => child !== inputChild && holds(child)),
      };
    }

    it('the nick keeps its hint and its error under the input: siblings after the input in its Field', async () => {
      useRepository({ takenUsernames: ['kacper'] });
      await openSetup();
      const hint = nickSiblingOrder(NICK_HINT);
      expect(hint.input).toBeGreaterThanOrEqual(0);
      expect(hint.message).toBeGreaterThan(hint.input);

      await fillValid('kacper');
      await fireEvent.press(saveButton());
      await waitFor(() => expect(screen.getByText(NICK_TAKEN)).toBeTruthy());

      const error = nickSiblingOrder(NICK_TAKEN);
      expect(error.input).toBeGreaterThanOrEqual(0);
      expect(error.message).toBeGreaterThan(error.input);
    });
  });

  describe('a taken nick scrolls to the nick and focuses it (D24)', () => {
    it('a taken nick counts as a nick error: it scrolls to the nick and focuses it', async () => {
      useRepository({ takenUsernames: ['kacper'] });
      await openLaidOut();
      await fillValid('kacper');
      expect(scrollTo()).not.toHaveBeenCalled();

      await fireEvent.press(saveButton());

      await waitFor(() => expect(screen.getByText(NICK_TAKEN)).toBeTruthy());
      expect(scrollTo()).toHaveBeenCalledTimes(1);
      expect(scrollTo()).toHaveBeenCalledWith({ y: NICK_Y, animated: false });
      expect(screenReaderFocus()).toHaveBeenCalledTimes(1);
      expect(screenReaderFocus()).toHaveBeenCalledWith(NICK_HANDLE);
    });

    it('scrolls to where the nick block is now, not where it first was', async () => {
      useRepository({ takenUsernames: ['kacper'] });
      await openLaidOut();
      await layOut('profile-nick-block', NICK_Y + 100); // e.g. a bigger font, or the offline banner appearing
      await fillValid('kacper');

      await fireEvent.press(saveButton());

      await waitFor(() => expect(screen.getByText(NICK_TAKEN)).toBeTruthy());
      expect(scrollTo()).toHaveBeenCalledWith({ y: NICK_Y + 100, animated: false });
    });

    it('does not scroll or move focus when the save succeeds', async () => {
      const create = useRepository();
      await openLaidOut();
      await fillValid();

      await fireEvent.press(saveButton());

      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(scrollTo()).not.toHaveBeenCalled();
      expect(screenReaderFocus()).not.toHaveBeenCalled();
    });

    it('does not scroll or move focus when the save fails with the general error: it sits above the button', async () => {
      failSave(new Error('x'));
      await openLaidOut();
      await fillValid();

      await fireEvent.press(saveButton());

      await waitFor(() => expect(screen.getByText(SAVE_ERROR)).toBeTruthy());
      expect(scrollTo()).not.toHaveBeenCalled();
      expect(screenReaderFocus()).not.toHaveBeenCalled();
    });

    it('does not scroll or move focus for an incomplete form: nothing is checked, so there is no error to go to (D4, P4)', async () => {
      await openLaidOut();

      await fireEvent.press(saveButton());
      await fireEvent(nickField(), 'submitEditing');
      await fireEvent.changeText(nickField(), 'ab');
      await fireEvent(nickField(), 'submitEditing');

      expect(scrollTo()).not.toHaveBeenCalled();
      expect(screenReaderFocus()).not.toHaveBeenCalled();
    });

    it('does not scroll while offline, where nothing is sent', async () => {
      setNetwork({ isConnected: false, isInternetReachable: false });
      await openLaidOut();
      await fillValid();

      await fireEvent.press(saveButton());

      expect(scrollTo()).not.toHaveBeenCalled();
      expect(screenReaderFocus()).not.toHaveBeenCalled();
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

    it('keeps the status bar area solid: a fixed view the height of the top inset, outside the scroll view, in the screen colour (D24)', async () => {
      await openSetup();
      const scroll = screen.getByTestId('profile-setup-screen-scroll');
      const inset = screen.getByTestId('profile-setup-screen-top-inset', hidden);
      expect(inset).toHaveStyle({ height: INSET_TOP, backgroundColor: lightTheme.colors.background });
      // Outside the scroll view, so what scrolls up is hidden behind it; and above it.
      expect(within(scroll).queryByTestId('profile-setup-screen-top-inset', hidden)).toBeNull();
      const tree = JSON.stringify(screen.toJSON());
      expect(tree.indexOf('profile-setup-screen-top-inset')).toBeLessThan(tree.indexOf('profile-setup-screen-scroll'));
    });

    it('no longer pads the scrolling content by the top inset: the fixed view above it does that', async () => {
      await openSetup();
      const style = Object.assign({}, ...[screen.getByTestId('profile-setup-screen-scroll').props.contentContainerStyle].flat(2)) as {
        paddingTop: number;
      };
      expect(style.paddingTop).toBe(lightTheme.spacing[4]);
    });
  });

  describe('pre-filled from a Google / Discord sign-in (theme-split-and-profile-prefill P5, P7)', () => {
    const GOOGLE_URL = 'https://lh3.googleusercontent.com/a/ACg8ocAnnaNowakPhoto=s512-c';
    const DISCORD_URL = 'https://cdn.discordapp.com/avatars/123456789012345678/abcdef0123456789.png?size=512';
    const GOOGLE = { suggestedUsername: 'annanowak', avatarUrl: GOOGLE_URL };
    const DISCORD = { suggestedUsername: 'jan_kowalski', avatarUrl: DISCORD_URL };
    const DOWNLOADED = 'file:///data/cache/avatar-1';
    const AVATAR_LOADING = 'avatar-loading';

    const read = jest.mocked(appProviderProfile.read);
    const download = jest.mocked(appProviderProfile.downloadAvatar);

    type Suggestion = Awaited<ReturnType<typeof appProviderProfile.read>>;

    /** A promise the test settles when it wants. */
    function deferred<T>() {
      let resolve: (value: T) => void = () => {};
      let reject: (error: Error) => void = () => {};
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve: (value: T) => act(async () => resolve(value)), reject: (error: Error) => act(async () => reject(error)) };
    }

    /** The sign-in told us this; the photo downloads at once. */
    function suggest(suggestion: Suggestion) {
      read.mockResolvedValue(suggestion);
      download.mockResolvedValue(DOWNLOADED);
    }

    /** The sign-in told us this; the photo stays on its way until the test finishes it. */
    function holdDownload(suggestion: Suggestion) {
      const photo = deferred<string>();
      read.mockResolvedValue(suggestion);
      download.mockReturnValue(photo.promise);
      return photo;
    }

    const preview = () => screen.getByTestId('avatar-preview', hidden);

    beforeEach(() => {
      read.mockReset();
      read.mockResolvedValue({ suggestedUsername: null, avatarUrl: null });
      download.mockReset();
      download.mockRejectedValue(new Error('No download expected'));
    });

    it('a Google user: the nick is filled in, the photo is downloaded from the 512 px address and shown, and the button says "Zmień zdjęcie"', async () => {
      suggest(GOOGLE);
      await openSetup();

      await waitFor(() => expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]));
      expect(nickField().props.value).toBe('annanowak');
      expect(download).toHaveBeenCalledTimes(1);
      expect(download).toHaveBeenCalledWith(GOOGLE_URL);
      expect(avatarButton().props.accessibilityLabel).toBe(AVATAR_CHANGE);
      expect(screen.getByText(AVATAR_CHANGE)).toBeTruthy();
      expect(screen.queryByTestId(AVATAR_LOADING, hidden)).toBeNull();
      expect(screen.queryByTestId('avatar-error', hidden)).toBeNull();
    });

    it('a Discord user: the same with the Discord nick and photo', async () => {
      suggest(DISCORD);
      await openSetup();

      await waitFor(() => expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]));
      expect(nickField().props.value).toBe('jan_kowalski');
      expect(download).toHaveBeenCalledWith(DISCORD_URL);
      expect(avatarButton().props.accessibilityLabel).toBe(AVATAR_CHANGE);
    });

    it('a user with a nick but no photo: only the nick is filled in and nothing is downloaded', async () => {
      suggest({ suggestedUsername: 'annanowak', avatarUrl: null });
      await openSetup();

      await waitFor(() => expect(nickField().props.value).toBe('annanowak'));
      expect(download).not.toHaveBeenCalled();
      expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
      expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
    });

    it('an e-mail user: the form starts empty as before, "Dodaj zdjęcie", and nothing is downloaded', async () => {
      await openSetup();
      await act(async () => {});

      expect(read).toHaveBeenCalledTimes(1);
      expect(nickField().props.value).toBe('');
      expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
      expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
      expect(download).not.toHaveBeenCalled();
      expect(saveButton()).toBeDisabled();
    });

    it('speaks English on an English phone', async () => {
      await i18n.changeLanguage('en');
      suggest(GOOGLE);
      await openSetup();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Change photo' })).toBeTruthy());
      expect(screen.getByLabelText('Username').props.value).toBe('annanowak');
    });

    it('only suggests: the interests are still to pick, so the button waits for them', async () => {
      suggest(GOOGLE);
      await openSetup();
      await waitFor(() => expect(preview()).toBeTruthy());

      expect(saveButton()).toBeDisabled();
      await fireEvent.press(chip('Muzea'));
      expect(saveButton()).toBeEnabled();
    });

    describe('while the photo downloads', () => {
      it('the circle shows a spinner instead of the camera and is busy for screen readers; the button cannot open the gallery', async () => {
        holdDownload(GOOGLE);
        await openSetup();

        await waitFor(() => expect(screen.getByTestId(AVATAR_LOADING, hidden)).toBeTruthy());
        expect(screen.queryByTestId('avatar-camera', hidden)).toBeNull();
        expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
        expect(avatarButton()).toBeBusy();
        expect(avatarButton()).toBeDisabled();
        expect(screen.getByTestId('avatar-placeholder')).toHaveStyle({
          width: lightTheme.size.avatarSetup,
          height: lightTheme.size.avatarSetup,
        });

        await fireEvent.press(avatarButton());
        expect(launch).not.toHaveBeenCalled();
      });

      it('the nick is filled in at once and the button follows the form, not the download', async () => {
        const photo = holdDownload(GOOGLE);
        await openSetup();
        await waitFor(() => expect(screen.getByTestId(AVATAR_LOADING, hidden)).toBeTruthy());
        expect(nickField().props.value).toBe('annanowak');
        expect(saveButton()).toBeDisabled();

        await fireEvent.press(chip('Muzea'));

        expect(screen.getByTestId(AVATAR_LOADING, hidden)).toBeTruthy();
        expect(saveButton()).toBeEnabled();

        await photo.resolve(DOWNLOADED);
        expect(screen.queryByTestId(AVATAR_LOADING, hidden)).toBeNull();
        expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]);
        expect(avatarButton()).not.toBeBusy();
        expect(avatarButton()).toBeEnabled();
        expect(saveButton()).toBeEnabled();
      });

      it('saving before the photo arrives sends no photo, and the late photo is not shown afterwards', async () => {
        const photo = holdDownload(GOOGLE);
        const create = useRepository();
        await openSetup();
        await waitFor(() => expect(screen.getByTestId(AVATAR_LOADING, hidden)).toBeTruthy());
        await fireEvent.press(chip('Muzea'));

        await fireEvent.press(saveButton());
        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create).toHaveBeenCalledWith({ username: 'annanowak', interests: ['museums'], avatarUri: null });

        await photo.resolve(DOWNLOADED);
        expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();
      });

      describe('a save that fails while the photo is still on its way (theme-split-and-profile-prefill D12)', () => {
        /** Opens the screen, waits for the spinner, picks an interest and presses save: the save is in flight and the photo is not there yet. */
        async function saveWhileDownloading() {
          const photo = holdDownload(GOOGLE);
          const save = holdSave();
          await openSetup();
          await waitFor(() => expect(screen.getByTestId(AVATAR_LOADING, hidden)).toBeTruthy());
          await fireEvent.press(chip('Muzea'));
          await fireEvent.press(saveButton());
          await waitFor(() => expect(save.createProfile).toHaveBeenCalledTimes(1));
          expect(save.createProfile).toHaveBeenLastCalledWith({ username: 'annanowak', interests: ['museums'], avatarUri: null });
          return { photo, save };
        }

        const failing = () => act(async () => {});

        it('the photo that arrives after the failure is shown with "Zmień zdjęcie", and the next save sends it', async () => {
          const { photo, save } = await saveWhileDownloading();
          await act(async () => save.fail(new ServerUnreachableError('offline')));
          await waitFor(() => expect(screen.getByTestId('profile-save-error')).toBeTruthy());
          expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();

          await photo.resolve(DOWNLOADED);

          expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]);
          expect(avatarButton().props.accessibilityLabel).toBe(AVATAR_CHANGE);
          expect(screen.queryByTestId(AVATAR_LOADING, hidden)).toBeNull();
          await fireEvent.press(saveButton());
          await waitFor(() => expect(save.createProfile).toHaveBeenCalledTimes(2));
          expect(save.createProfile).toHaveBeenLastCalledWith({ username: 'annanowak', interests: ['museums'], avatarUri: DOWNLOADED });
        });

        it('the photo that arrives before the failure settles is shown once the save has failed, not before', async () => {
          const { photo, save } = await saveWhileDownloading();

          await photo.resolve(DOWNLOADED);
          expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();
          expect(screen.queryByTestId(AVATAR_LOADING, hidden)).toBeNull();

          await act(async () => save.fail(new ServerUnreachableError('offline')));
          await failing();

          expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]);
          expect(avatarButton().props.accessibilityLabel).toBe(AVATAR_CHANGE);
          await fireEvent.press(saveButton());
          await waitFor(() => expect(save.createProfile).toHaveBeenCalledTimes(2));
          expect(save.createProfile).toHaveBeenLastCalledWith({ username: 'annanowak', interests: ['museums'], avatarUri: DOWNLOADED });
        });

        it('a taken nick counts as a failed save too: the photo is shown afterwards', async () => {
          const { photo, save } = await saveWhileDownloading();
          await photo.resolve(DOWNLOADED);

          await act(async () => save.fail(new UsernameTakenError()));
          await failing();

          expect(screen.getByText(NICK_TAKEN)).toBeTruthy();
          expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]);
        });

        it('a save that succeeds changes nothing: the photo that arrives before or after it is never shown', async () => {
          const { photo, save } = await saveWhileDownloading();
          await photo.resolve(DOWNLOADED);

          await act(async () => save.finish());
          await failing();

          expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();
          expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
        });

        it('a save that succeeds before the photo arrives: the late photo is not shown', async () => {
          const { photo, save } = await saveWhileDownloading();

          await act(async () => save.finish());
          await failing();
          await photo.resolve(DOWNLOADED);

          expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();
          expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
        });

        it('a gallery photo picked afterwards stays, and the next save sends it', async () => {
          launch.mockResolvedValue(picked(PHOTO));
          const { photo, save } = await saveWhileDownloading();
          await act(async () => save.fail(new ServerUnreachableError('offline')));
          await photo.resolve(DOWNLOADED);
          expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]);

          await fireEvent.press(avatarButton());
          await waitFor(() => expect(preview().props.source).toEqual([{ uri: PHOTO }]));
          await fireEvent.press(saveButton());

          await waitFor(() => expect(save.createProfile).toHaveBeenCalledTimes(2));
          expect(save.createProfile).toHaveBeenLastCalledWith({ username: 'annanowak', interests: ['museums'], avatarUri: PHOTO });
        });

        it('a gallery photo picked before the late photo arrives stays when the save fails', async () => {
          const suggestion = deferred<Suggestion>();
          read.mockReturnValue(suggestion.promise);
          download.mockResolvedValue(DOWNLOADED);
          launch.mockResolvedValue(picked(PHOTO));
          const save = holdSave();
          await openSetup();
          await fireEvent.press(avatarButton());
          await waitFor(() => expect(preview().props.source).toEqual([{ uri: PHOTO }]));
          await fireEvent.changeText(nickField(), 'ania');
          await fireEvent.press(chip('Muzea'));
          await fireEvent.press(saveButton());
          await waitFor(() => expect(save.createProfile).toHaveBeenCalledTimes(1));

          await suggestion.resolve(GOOGLE);
          await act(async () => save.fail(new ServerUnreachableError('offline')));
          await failing();

          expect(preview().props.source).toEqual([{ uri: PHOTO }]);
          expect(download).not.toHaveBeenCalled();
        });
      });
    });

    describe('when the photo cannot be downloaded (the photo is optional)', () => {
      it('the circle stays empty, the button says "Dodaj zdjęcie", and no error is shown or announced', async () => {
        read.mockResolvedValue(GOOGLE);
        download.mockRejectedValue(new Error('response has status 404'));
        await openSetup();

        await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByTestId(AVATAR_LOADING, hidden)).toBeNull());
        expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
        expect(screen.getByTestId('avatar-camera', hidden)).toBeTruthy();
        expect(screen.queryByTestId('avatar-preview', hidden)).toBeNull();
        expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
        expect(avatarButton()).toBeEnabled();
        expect(avatarButton()).not.toBeBusy();
        expect(screen.queryByTestId('avatar-error', hidden)).toBeNull();
        expect(screen.queryByText(PICK_ERROR)).toBeNull();
        expect(screen.queryByText(/validation\./)).toBeNull();
        expect(screen.queryByText(/avatarUrl/i)).toBeNull();
        expect(screen.queryByText(SAVE_ERROR)).toBeNull();
        expect(announce).not.toHaveBeenCalled();
        // The nick from the account stays, and the photo can still be picked.
        expect(nickField().props.value).toBe('annanowak');
      });

      it('the gallery still works after a failed download', async () => {
        read.mockResolvedValue(GOOGLE);
        download.mockRejectedValue(new Error('offline'));
        launch.mockResolvedValue(picked(PHOTO));
        await openSetup();
        await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByTestId(AVATAR_LOADING, hidden)).toBeNull());

        await fireEvent.press(avatarButton());

        await waitFor(() => expect(preview().props.source).toEqual([{ uri: PHOTO }]));
      });

      it('a suggestion that cannot even be read leaves the form empty and shows no error', async () => {
        read.mockRejectedValue(new Error('storage broken'));
        await openSetup();
        await act(async () => {});

        expect(nickField().props.value).toBe('');
        expect(avatarButton().props.accessibilityLabel).toBe(AVATAR);
        expect(download).not.toHaveBeenCalled();
        expect(screen.queryByTestId('avatar-error', hidden)).toBeNull();
        expect(announce).not.toHaveBeenCalled();
      });
    });

    describe("the user's own choices are never overwritten", () => {
      it('text typed in the nick field before the suggestion arrives stays', async () => {
        const suggestion = deferred<Suggestion>();
        read.mockReturnValue(suggestion.promise);
        download.mockResolvedValue(DOWNLOADED);
        await openSetup();
        await fireEvent.changeText(nickField(), 'moj.nick');

        await suggestion.resolve(GOOGLE);

        expect(nickField().props.value).toBe('moj.nick');
        // The photo was not touched by the user, so it is still suggested.
        await waitFor(() => expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]));
      });

      it('a nick that was typed and then deleted is still the user\'s: it stays empty', async () => {
        const suggestion = deferred<Suggestion>();
        read.mockReturnValue(suggestion.promise);
        await openSetup();
        await fireEvent.changeText(nickField(), 'abc');
        await fireEvent.changeText(nickField(), '');

        await suggestion.resolve({ suggestedUsername: 'annanowak', avatarUrl: null });

        expect(nickField().props.value).toBe('');
      });

      it('a gallery photo picked before the suggestion arrives stays, and the account photo is not even downloaded', async () => {
        const suggestion = deferred<Suggestion>();
        read.mockReturnValue(suggestion.promise);
        download.mockResolvedValue(DOWNLOADED);
        launch.mockResolvedValue(picked(PHOTO));
        await openSetup();
        await fireEvent.press(avatarButton());
        await waitFor(() => expect(preview().props.source).toEqual([{ uri: PHOTO }]));

        await suggestion.resolve(GOOGLE);

        expect(preview().props.source).toEqual([{ uri: PHOTO }]);
        expect(download).not.toHaveBeenCalled();
        expect(screen.queryByTestId(AVATAR_LOADING, hidden)).toBeNull();
        // The nick was not touched by the user, so it is still suggested.
        expect(nickField().props.value).toBe('annanowak');
      });

      it('after the suggestion the user can change the nick and replace the photo from the gallery', async () => {
        suggest(GOOGLE);
        launch.mockResolvedValue(picked(PHOTO));
        const create = useRepository();
        await openSetup();
        await waitFor(() => expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]));

        await fireEvent.changeText(nickField(), 'Ania');
        await fireEvent.press(avatarButton());
        await waitFor(() => expect(preview().props.source).toEqual([{ uri: PHOTO }]));
        await fireEvent.press(chip('Muzea'));
        await fireEvent.press(saveButton());

        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create).toHaveBeenCalledWith({ username: 'ania', interests: ['museums'], avatarUri: PHOTO });
      });
    });

    describe('leaving the screen', () => {
      it('a photo that arrives after the screen is gone sets no state and logs nothing', async () => {
        const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
        const photo = holdDownload(GOOGLE);
        await openSetup();
        await waitFor(() => expect(screen.getByTestId(AVATAR_LOADING, hidden)).toBeTruthy());

        await act(async () => screen.unmount());
        await photo.resolve(DOWNLOADED);

        expect(errors).not.toHaveBeenCalled();
      });

      it('a failed download that ends after the screen is gone logs nothing', async () => {
        const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
        const photo = holdDownload(GOOGLE);
        await openSetup();
        await waitFor(() => expect(screen.getByTestId(AVATAR_LOADING, hidden)).toBeTruthy());

        await act(async () => screen.unmount());
        await photo.reject(new Error('offline'));

        expect(errors).not.toHaveBeenCalled();
      });

      it('a suggestion that arrives after the screen is gone starts no download', async () => {
        const suggestion = deferred<Suggestion>();
        read.mockReturnValue(suggestion.promise);
        await openSetup();

        await act(async () => screen.unmount());
        await suggestion.resolve(GOOGLE);

        expect(download).not.toHaveBeenCalled();
      });
    });

    describe('saving', () => {
      it('sends the downloaded local file as the photo, with the account nick and the picked interests', async () => {
        suggest(GOOGLE);
        const create = useRepository();
        await openSetup();
        await waitFor(() => expect(preview().props.source).toEqual([{ uri: DOWNLOADED }]));
        await fireEvent.press(chip('Muzea'));

        await fireEvent.press(saveButton());

        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create).toHaveBeenCalledWith({ username: 'annanowak', interests: ['museums'], avatarUri: DOWNLOADED });
        expect(DOWNLOADED.startsWith('file://')).toBe(true);
      });

      it('an e-mail user saves with no photo, as before', async () => {
        const create = useRepository();
        await openSetup();
        await fillValid();

        await fireEvent.press(saveButton());

        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create).toHaveBeenCalledWith({ username: 'kacper', interests: ['museums'], avatarUri: null });
      });
    });
  });
});
