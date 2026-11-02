import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { useRemoveAvatar } from '@/hooks/useProfile';
import { AppProviders } from '@/providers/AppProviders';
import { setAppProfileRepository } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/theme';

import { ProfileScreen } from '../ProfileScreen';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const launch = jest.mocked(launchImageLibraryAsync);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ADD = 'Dodaj zdjęcie profilowe';
const ADD_OFFLINE = 'Dodaj zdjęcie profilowe, niedostępne bez internetu';
const OPEN = 'Otwórz zdjęcie profilowe';
const UPLOAD_ERROR = 'Nie udało się zmienić zdjęcia. Spróbuj ponownie.';
const PICKED = { canceled: false, assets: [{ uri: 'file:///new.jpg' }] } as Awaited<ReturnType<typeof launchImageLibraryAsync>>;
const GALLERY_ERROR = 'Nie udało się otworzyć galerii. Spróbuj ponownie.';
const OFFLINE = { isConnected: false, isInternetReachable: false };

// Stands in for the preview's "Usuń zdjęcie", which changes the profile query the screen reads.
function Remover() {
  const remove = useRemoveAvatar();
  return <Text onPress={() => remove.mutate()}>remove-stub</Text>;
}

async function setup({ photo, patch = {} }: { photo: boolean; patch?: Partial<ProfileRepository> }) {
  const base = createInMemoryProfileRepository({ newId: () => '00000000-0000-4000-8000-0000000000aa' });
  await base.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: photo ? 'file:///old.jpg' : null });
  const repository = { ...base, ...patch };
  setAppProfileRepository(repository);
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProviders>
        <ProfileScreen />
        <Remover />
      </AppProviders>
    </SafeAreaProvider>,
  );
  await screen.findByText('kacper');
  return repository;
}

const loadPhoto = async () => {
  const photo = await screen.findByTestId('profile-photo', { includeHiddenElements: true });
  await fireEvent(photo, 'load', { nativeEvent: { source: { url: 'https://avatars.invalid/a.jpg', width: 96, height: 96 } } });
};

let announce: jest.SpyInstance;
beforeEach(async () => {
  launch.mockReset();
  mockPush.mockReset();
  setNetwork({ isConnected: true, isInternetReachable: true });
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await i18n.changeLanguage('pl');
});

describe('Profile photo tap (profile-settings D13)', () => {
  describe('without a photo', () => {
    it('opens the gallery at once, not the preview, and uploads the picked photo', async () => {
      launch.mockResolvedValue(PICKED);
      const repository = await setup({ photo: false });
      const changeAvatar = jest.spyOn(repository, 'changeAvatar');
      await fireEvent.press(screen.getByRole('button', { name: ADD }));
      await waitFor(() => expect(changeAvatar).toHaveBeenCalledWith('file:///new.jpg'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows the new photo in the circle after the upload', async () => {
      launch.mockResolvedValue(PICKED);
      await setup({ photo: false });
      await fireEvent.press(screen.getByRole('button', { name: ADD }));
      const photo = await screen.findByTestId('profile-photo', { includeHiddenElements: true });
      expect(photo.props.source).toEqual([{ uri: expect.stringMatching(/^https:\/\/avatars\.invalid\//) }]);
      expect(screen.queryByTestId('profile-photo-placeholder', { includeHiddenElements: true })).toBeNull();
    });

    it('shows and announces a gallery error', async () => {
      launch.mockRejectedValue(new Error('denied'));
      await setup({ photo: false });
      await fireEvent.press(screen.getByRole('button', { name: ADD }));
      expect(await screen.findByText(GALLERY_ERROR)).toBeTruthy();
      expect(announce).toHaveBeenCalledWith(GALLERY_ERROR);
    });

    it('uploads nothing when the gallery is cancelled', async () => {
      launch.mockResolvedValue({ canceled: true, assets: null } as Awaited<ReturnType<typeof launchImageLibraryAsync>>);
      const repository = await setup({ photo: false });
      const changeAvatar = jest.spyOn(repository, 'changeAvatar');
      await fireEvent.press(screen.getByRole('button', { name: ADD }));
      await waitFor(() => expect(launch).toHaveBeenCalled());
      expect(changeAvatar).not.toHaveBeenCalled();
    });

    it('shows and announces an upload error', async () => {
      launch.mockResolvedValue(PICKED);
      await setup({ photo: false, patch: { changeAvatar: async () => Promise.reject(new Error('boom')) } });
      await fireEvent.press(screen.getByRole('button', { name: ADD }));
      expect(await screen.findByText(UPLOAD_ERROR)).toBeTruthy();
      expect(announce).toHaveBeenCalledWith(UPLOAD_ERROR);
    });

    it('offline: not pressable, and the label says why', async () => {
      setNetwork(OFFLINE);
      await setup({ photo: false });
      const button = screen.getByRole('button', { name: ADD_OFFLINE });
      expect(button).toBeDisabled();
      await fireEvent.press(button);
      expect(launch).not.toHaveBeenCalled();
    });
  });

  describe('with a photo', () => {
    it('opens the preview with the shown address, not the gallery', async () => {
      await setup({ photo: true });
      await loadPhoto();
      await fireEvent.press(screen.getByRole('button', { name: OPEN }));
      expect(launch).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/avatar', params: { uri: expect.stringMatching(/^https:\/\/avatars\.invalid\//), avatarId: '00000000-0000-4000-8000-0000000000aa' } });
    });

    it('shows the placeholder again once the photo is removed', async () => {
      await setup({ photo: true });
      await loadPhoto();
      await fireEvent.press(screen.getByText('remove-stub'));
      expect(await screen.findByTestId('profile-photo-placeholder', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByTestId('profile-photo', { includeHiddenElements: true })).toBeNull();
    });

    it('dims nothing but shows the sunken background round the circle while pressed (§8.7)', async () => {
      await setup({ photo: true });
      await loadPhoto();
      const button = screen.getByRole('button', { name: OPEN });
      expect(StyleSheet.flatten(button.props.style).backgroundColor).toBeUndefined();
      await fireEvent(button, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      const pressed = StyleSheet.flatten(screen.getByRole('button', { name: OPEN }).props.style);
      expect(pressed).toMatchObject({ backgroundColor: lightTheme.background.sunken });
      expect(pressed.opacity).toBeUndefined();
    });

    it('does not react while the skeleton is shown', async () => {
      await setup({ photo: true });
      await screen.findByTestId('profile-photo', { includeHiddenElements: true });
      const button = screen.getByRole('button', { name: OPEN });
      expect(button).toBeDisabled();
      await fireEvent.press(button);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('offline: the preview still opens once the photo is shown', async () => {
      await setup({ photo: true });
      await loadPhoto();
      setNetwork(OFFLINE);
      await fireEvent.press(screen.getByRole('button', { name: OPEN }));
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });
});
