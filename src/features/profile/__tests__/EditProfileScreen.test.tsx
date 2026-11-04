import { Stack, router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { ServerUnreachableError } from '@/data/errors';
import { createInMemoryProfileRepository, UsernameTakenError, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { useMyProfile } from '@/hooks/useProfile';
import { AppProviders } from '@/providers/AppProviders';
import { repositoryWithProfile, setAppProfileRepository, withMyProfile } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';

import { EditProfileScreen } from '../EditProfileScreen';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
}));

const NICK_LABEL = 'Nazwa użytkownika';
const NICK_TAKEN = 'Ten nick jest zajęty.';
const SAVE = 'Zapisz';
const SAVE_ERROR = 'Nie udało się zapisać profilu. Spróbuj ponownie.';
const LOAD_ERROR = 'Nie udało się wczytać profilu.';

function Layout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

// A stand-in for the settings screen that shows the profile's nick, to prove the profile query holds the new one.
function SettingsStub() {
  const username = useMyProfile().data?.profile.username;
  return <Text testID="settings-stub">{username}</Text>;
}

async function openEdit() {
  const rendered = renderRouter({ _layout: Layout, settings: SettingsStub, 'edit-profile': EditProfileScreen }, { initialUrl: '/settings' });
  await rendered;
  await waitFor(() => expect(screen.getByTestId('settings-stub').props.children).toBe('kacper'));
  await act(async () => router.push('/edit-profile'));
  await waitFor(() => expect(screen.getByTestId('edit-profile-screen')).toBeTruthy());
  return { getPathname: () => rendered.getPathname() };
}

const nickField = () => screen.getByLabelText(NICK_LABEL);
const saveButton = () => screen.getByRole('button', { name: SAVE });
const chip = (name: string) => screen.getByRole('checkbox', { name });

async function useRepository(options: Parameters<typeof createInMemoryProfileRepository>[0] = {}) {
  const base = await repositoryWithProfile(createInMemoryProfileRepository(options));
  const updateProfile = jest.fn<ReturnType<ProfileRepository['updateProfile']>, Parameters<ProfileRepository['updateProfile']>>((input) =>
    base.updateProfile(input),
  );
  setAppProfileRepository({ ...base, updateProfile });
  return updateProfile;
}

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('EditProfileScreen', () => {
  it('is filled in with the current nick and interests, and the save button is disabled until something changes', async () => {
    await useRepository();
    await openEdit();

    expect(nickField().props.value).toBe('kacper');
    expect(chip('Muzea')).toBeChecked();
    expect(saveButton()).toBeDisabled();

    await fireEvent.press(chip('Plaże'));
    expect(saveButton()).toBeEnabled();
    await fireEvent.press(chip('Plaże'));
    expect(saveButton()).toBeDisabled();
  });

  it('keeps save disabled when the nick is typed back in upper case with spaces, or the interests are only reordered', async () => {
    const base = createInMemoryProfileRepository();
    await base.createProfile({ username: 'kacper', interests: ['museums', 'beaches'], avatarUri: null });
    setAppProfileRepository(base);
    await openEdit();

    await fireEvent.changeText(nickField(), ' KACPER ');
    expect(saveButton()).toBeDisabled();
    await fireEvent.changeText(nickField(), 'kacper');
    await fireEvent.press(chip('Muzea'));
    await fireEvent.press(chip('Muzea'));
    expect(saveButton()).toBeDisabled();
  });

  it('disables the save button for an invalid nick and for no interests', async () => {
    const update = await useRepository();
    await openEdit();

    await fireEvent.changeText(nickField(), 'ab');
    expect(saveButton()).toBeDisabled();
    await fireEvent.changeText(nickField(), 'kacper2');
    expect(saveButton()).toBeEnabled();
    await fireEvent.press(chip('Muzea'));
    expect(saveButton()).toBeDisabled();
    await fireEvent.press(saveButton());
    expect(update).not.toHaveBeenCalled();
  });

  it('is disabled offline, under the offline banner, and sends nothing', async () => {
    setNetwork({ isConnected: false, isInternetReachable: false });
    const update = await useRepository();
    await openEdit();

    await fireEvent.changeText(nickField(), 'kacper2');
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText('Jesteś offline. Zmiana profilu wymaga internetu.')).toBeTruthy();
    expect(screen.queryByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeNull();
    expect(saveButton()).toBeDisabled();
    await fireEvent.press(saveButton());
    expect(update).not.toHaveBeenCalled();
  });

  it('saves the lower-cased nick and interests, goes back to settings, and the profile shows the new nick', async () => {
    const update = await useRepository();
    const { getPathname } = await openEdit();

    await fireEvent.changeText(nickField(), 'Nowy_Nick');
    await fireEvent.press(chip('Plaże'));
    await fireEvent.press(saveButton());

    await waitFor(() => expect(getPathname()).toBe('/settings'));
    expect(update).toHaveBeenCalledWith({ username: 'nowy_nick', interests: ['museums', 'beaches'] });
    await waitFor(() => expect(screen.getByTestId('settings-stub').props.children).toBe('nowy_nick'));
  });

  it('shows a taken nick as an error on the field, with the setup text, and keeps the form', async () => {
    await useRepository({ takenUsernames: ['zajety'] });
    const { getPathname } = await openEdit();

    await fireEvent.changeText(nickField(), 'zajety');
    await fireEvent.press(saveButton());

    await waitFor(() => expect(screen.getByText(NICK_TAKEN)).toBeTruthy());
    expect(getPathname()).toBe('/edit-profile');
    expect(nickField().props.value).toBe('zajety');
    await fireEvent.changeText(nickField(), 'zajety2');
    expect(screen.queryByText(NICK_TAKEN)).toBeNull();
  });

  it('shows fixed copy for any other failure and keeps the data', async () => {
    const base = await repositoryWithProfile();
    const failing = jest.fn(() => Promise.reject(new ServerUnreachableError('boom: secret detail')));
    setAppProfileRepository({ ...base, updateProfile: failing });
    const { getPathname } = await openEdit();

    await fireEvent.changeText(nickField(), 'kacper2');
    await fireEvent.press(saveButton());

    await waitFor(() => expect(screen.getByText(SAVE_ERROR)).toBeTruthy());
    expect(screen.queryByText(/secret detail/)).toBeNull();
    expect(getPathname()).toBe('/edit-profile');
    expect(nickField().props.value).toBe('kacper2');
    expect(saveButton()).toBeEnabled();
  });

  it('treats UsernameTakenError as the field error only, not the general one', async () => {
    const base = await repositoryWithProfile();
    setAppProfileRepository({ ...base, updateProfile: () => Promise.reject(new UsernameTakenError('username-taken')) });
    await openEdit();

    await fireEvent.changeText(nickField(), 'kacper2');
    await fireEvent.press(saveButton());

    await waitFor(() => expect(screen.getByText(NICK_TAKEN)).toBeTruthy());
    expect(screen.queryByText(SAVE_ERROR)).toBeNull();
  });
});

describe('EditProfileScreen without a profile', () => {
  it('shows a skeleton while the profile is read', async () => {
    const base = await repositoryWithProfile();
    setAppProfileRepository(withMyProfile(base, () => new Promise(() => {})));
    await renderRouter({ _layout: Layout, 'edit-profile': EditProfileScreen }, { initialUrl: '/edit-profile' });

    await waitFor(() => expect(screen.getByTestId('edit-profile-loading')).toBeTruthy());
    expect(screen.queryByLabelText(NICK_LABEL)).toBeNull();
  });

  it('shows an error with a retry when the profile cannot be read, and recovers on retry', async () => {
    const base = await repositoryWithProfile();
    let fail = true;
    setAppProfileRepository(withMyProfile(base, () => (fail ? Promise.reject(new ServerUnreachableError('x')) : base.myProfile())));
    await renderRouter({ _layout: Layout, 'edit-profile': EditProfileScreen }, { initialUrl: '/edit-profile' });

    await waitFor(() => expect(screen.getByText(LOAD_ERROR)).toBeTruthy());
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    await waitFor(() => expect(nickField().props.value).toBe('kacper'));
  });
});
