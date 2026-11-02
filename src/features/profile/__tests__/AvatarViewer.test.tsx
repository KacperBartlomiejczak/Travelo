import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { setAppProfileRepository, withMyProfile } from '@/test/fake-profile-repository';
import { setNetwork } from '@/test/mock-network';

import { AvatarViewer } from '../AvatarViewer';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
const launch = jest.mocked(launchImageLibraryAsync);

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const CLOSE = 'Zamknij podgląd zdjęcia profilowego';
const OPTIONS = 'Opcje zdjęcia profilowego';
const CHANGE = 'Zmień zdjęcie';
const REMOVE = 'Usuń zdjęcie';
const GALLERY_ERROR = 'Nie udało się otworzyć galerii. Spróbuj ponownie.';
const UPLOAD_ERROR = 'Nie udało się zmienić zdjęcia. Spróbuj ponownie.';
const REMOVE_ERROR = 'Nie udało się usunąć zdjęcia. Spróbuj ponownie.';
const LOAD_ERROR = 'Nie udało się wczytać zdjęcia.';
const OFFLINE_HINT = 'Bez internetu nie zmienisz ani nie usuniesz zdjęcia.';
const OFFLINE = { isConnected: false, isInternetReachable: false };
const PICKED = { canceled: false, assets: [{ uri: 'file:///new.jpg' }] } as Awaited<ReturnType<typeof launchImageLibraryAsync>>;

let n = 0;
async function profileWithPhoto(patch: Partial<ProfileRepository> = {}) {
  const base = createInMemoryProfileRepository({ newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` });
  await base.createProfile({ username: 'kacper', interests: ['museums'], avatarUri: 'file:///old.jpg' });
  const repository = { ...base, ...patch };
  setAppProfileRepository(repository);
  return repository;
}

async function renderViewer(props: { fallbackUri?: string; fallbackAvatarId?: string } = {}) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProviders>
        <AvatarViewer onClose={onClose} {...props} />
      </AppProviders>
    </SafeAreaProvider>,
  );
  await screen.findByTestId('avatar-viewer-image');
  return { onClose };
}

const image = () => screen.getByTestId('avatar-viewer-image');
const sourceUri = () => (image().props.source as { uri: string }[])[0].uri;
const openSheet = async () => {
  await fireEvent.press(screen.getByRole('button', { name: OPTIONS }));
  await screen.findByRole('button', { name: CHANGE });
};

let announce: jest.SpyInstance;
beforeEach(async () => {
  launch.mockReset();
  setNetwork({ isConnected: true, isInternetReachable: true });
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await i18n.changeLanguage('pl');
});

describe('AvatarViewer', () => {
  it('shows the whole photo, with a labelled close button on the left and options on the right', async () => {
    await profileWithPhoto();
    await renderViewer();
    expect(image().props.contentFit).toBe('contain');
    expect(screen.getByRole('button', { name: CLOSE })).toBeTruthy();
    expect(screen.getByRole('button', { name: OPTIONS })).toBeTruthy();
  });

  it('closes with the cross', async () => {
    await profileWithPhoto();
    const { onClose } = await renderViewer();
    await fireEvent.press(screen.getByRole('button', { name: CLOSE }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the address from the route when the profile read has none (profile-screen D23)', async () => {
    const base = await profileWithPhoto();
    const own = await base.myProfile();
    if (!own) throw new Error('no profile');
    const { avatarUrl: _gone, ...withoutUrl } = own.profile;
    setAppProfileRepository(withMyProfile(base, async () => ({ profile: { ...withoutUrl }, fromCache: true })));
    await renderViewer({ fallbackUri: 'https://avatars.invalid/shown.jpg', fallbackAvatarId: own.profile.avatarId ?? undefined });
    expect(sourceUri()).toBe('https://avatars.invalid/shown.jpg');
  });

  it('does not show the address from the route for another photo: a load error, with the buttons working', async () => {
    const base = await profileWithPhoto();
    const own = await base.myProfile();
    if (!own) throw new Error('no profile');
    const { avatarUrl: _gone, ...withoutUrl } = own.profile;
    setAppProfileRepository(withMyProfile(base, async () => ({ profile: { ...withoutUrl }, fromCache: false })));
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AppProviders>
          <AvatarViewer onClose={onClose} fallbackUri="https://avatars.invalid/old.jpg" fallbackAvatarId="00000000-0000-4000-8000-00000000ffff" />
        </AppProviders>
      </SafeAreaProvider>,
    );
    expect(await screen.findByText(LOAD_ERROR)).toBeTruthy();
    expect(screen.queryByTestId('avatar-viewer-image')).toBeNull();
    expect(screen.getByRole('button', { name: OPTIONS })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: CLOSE }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error when the photo does not load, and the cross and the options still work', async () => {
    await profileWithPhoto();
    const { onClose } = await renderViewer();
    await fireEvent(image(), 'error', { nativeEvent: { error: 'x' } });
    expect(screen.getByText(LOAD_ERROR)).toBeTruthy();
    await openSheet();
    await fireEvent.press(screen.getByRole('button', { name: CLOSE }));
    expect(onClose).toHaveBeenCalled();
  });

  describe('options sheet', () => {
    it('opens with "Zmień zdjęcie" and "Usuń zdjęcie"', async () => {
      await profileWithPhoto();
      await renderViewer();
      await openSheet();
      expect(screen.getByRole('button', { name: REMOVE })).toBeTruthy();
    });

    it('changes the photo: the viewer stays open and shows the new one', async () => {
      const repository = await profileWithPhoto();
      const changeAvatar = jest.spyOn(repository, 'changeAvatar');
      launch.mockResolvedValue(PICKED);
      const { onClose } = await renderViewer();
      const before = sourceUri();
      await openSheet();
      await fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      await waitFor(() => expect(sourceUri()).not.toBe(before));
      expect(changeAvatar).toHaveBeenCalledWith('file:///new.jpg');
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('button', { name: CHANGE })).toBeNull());
    });

    it('changes nothing when the gallery is cancelled', async () => {
      const repository = await profileWithPhoto();
      const changeAvatar = jest.spyOn(repository, 'changeAvatar');
      launch.mockResolvedValue({ canceled: true, assets: null } as Awaited<ReturnType<typeof launchImageLibraryAsync>>);
      await renderViewer();
      const before = sourceUri();
      await openSheet();
      await fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      await waitFor(() => expect(launch).toHaveBeenCalled());
      expect(changeAvatar).not.toHaveBeenCalled();
      expect(sourceUri()).toBe(before);
    });

    it('is busy while uploading: the buttons are disabled and a second press makes no second call', async () => {
      let finish: () => void = () => {};
      const base = await profileWithPhoto();
      const changeAvatar = jest.fn(async (uri: string) => {
        await new Promise<void>((resolve) => (finish = resolve));
        return base.changeAvatar(uri);
      });
      setAppProfileRepository({ ...base, changeAvatar });
      launch.mockResolvedValue(PICKED);
      await renderViewer();
      await openSheet();
      // Not awaited: fireEvent.press waits for the handler, and the upload is held open.
      void fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      await waitFor(() => expect(changeAvatar).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: CHANGE })).toBeDisabled();
      expect(screen.getByRole('button', { name: REMOVE })).toBeDisabled();
      expect(screen.getByTestId('avatar-busy')).toBeTruthy();
      void fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      expect(changeAvatar).toHaveBeenCalledTimes(1);
      await act(async () => finish());
      await waitFor(() => expect(screen.queryByTestId('avatar-busy')).toBeNull());
    });

    it('has no spinner while the gallery is open, only the buttons are disabled and a second press does nothing', async () => {
      await profileWithPhoto();
      let close: (r: Awaited<ReturnType<typeof launchImageLibraryAsync>>) => void = () => {};
      launch.mockImplementation(() => new Promise((resolve) => (close = resolve)));
      await renderViewer();
      await openSheet();
      void fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      await waitFor(() => expect(launch).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: CHANGE })).toBeDisabled();
      expect(screen.queryByTestId('avatar-busy')).toBeNull();
      void fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      expect(launch).toHaveBeenCalledTimes(1);
      await act(async () => close({ canceled: true, assets: null } as Awaited<ReturnType<typeof launchImageLibraryAsync>>));
    });

    it('shows and announces a gallery error and keeps the old photo', async () => {
      await profileWithPhoto();
      launch.mockRejectedValue(new Error('denied'));
      await renderViewer();
      const before = sourceUri();
      await openSheet();
      await fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      expect(await screen.findByText(GALLERY_ERROR)).toBeTruthy();
      expect(announce).toHaveBeenCalledWith(GALLERY_ERROR);
      expect(sourceUri()).toBe(before);
    });

    it('shows and announces an upload error and keeps the old photo', async () => {
      const base = await profileWithPhoto();
      setAppProfileRepository({ ...base, changeAvatar: async () => Promise.reject(new Error('boom')) });
      launch.mockResolvedValue(PICKED);
      await renderViewer();
      const before = sourceUri();
      await openSheet();
      await fireEvent.press(screen.getByRole('button', { name: CHANGE }));
      expect(await screen.findByText(UPLOAD_ERROR)).toBeTruthy();
      expect(announce).toHaveBeenCalledWith(UPLOAD_ERROR);
      expect(sourceUri()).toBe(before);
    });

    it('removes the photo without a confirmation and closes the viewer', async () => {
      const repository = await profileWithPhoto();
      const removeAvatar = jest.spyOn(repository, 'removeAvatar');
      const { onClose } = await renderViewer();
      await openSheet();
      await fireEvent.press(screen.getByRole('button', { name: REMOVE }));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(removeAvatar).toHaveBeenCalledTimes(1);
    });

    it('shows and announces a remove error and stays open', async () => {
      const base = await profileWithPhoto();
      setAppProfileRepository({ ...base, removeAvatar: async () => Promise.reject(new Error('boom')) });
      const { onClose } = await renderViewer();
      await openSheet();
      await fireEvent.press(screen.getByRole('button', { name: REMOVE }));
      expect(await screen.findByText(REMOVE_ERROR)).toBeTruthy();
      expect(announce).toHaveBeenCalledWith(REMOVE_ERROR);
      expect(onClose).not.toHaveBeenCalled();
      expect(image()).toBeTruthy();
    });
  });

  it('offline: the options are disabled, with the reason at the bottom, and the photo still shows', async () => {
    await profileWithPhoto();
    setNetwork(OFFLINE);
    await renderViewer();
    expect(screen.getByRole('button', { name: OPTIONS })).toBeDisabled();
    expect(screen.getByText(OFFLINE_HINT)).toBeTruthy();
    expect(screen.getByRole('button', { name: CLOSE })).toBeEnabled();
  });
});
