import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { DeletePhotoSheet } from '@/features/trip-photos/DeletePhotoSheet';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import type { ShownTripPhoto, TripPhoto } from '@/schemas';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/legacy/theme';
import { lightTheme as sunlineLightTheme } from '@/theme/theme';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const PHOTO_ID = '4a1e7c2d-0b3f-4d5a-8e6b-000000000001';

const photo: ShownTripPhoto = {
  id: PHOTO_ID,
  tripId: TRIP_ID,
  takenAt: '2026-11-03T10:00',
  createdAt: '2026-10-15T12:00:00.000Z',
  url: 'https://photos.invalid/photo.jpg',
  thumbnailUrl: 'https://photos.invalid/photo-thumb.jpg',
};

type Remove = jest.Mock<Promise<void>, [TripPhoto]>;
const remove = (impl: () => Promise<void> = async () => {}): Remove => jest.fn((_photo: TripPhoto) => impl());

async function setup(deletePhoto: Remove = remove()) {
  const onClose = jest.fn();
  const onDeleted = jest.fn();
  const repository: TripRepository = { ...createInMemoryTripRepository(), deletePhoto };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders tripRepository={repository}>
        <DeletePhotoSheet photo={photo} onClose={onClose} onDeleted={onDeleted} />
      </AppProviders>
    </SafeAreaProvider>,
  );
  return { onClose, onDeleted, deletePhoto };
}

const confirm = () => screen.getByRole('button', { name: 'Usuń zdjęcie' });
const cancel = () => screen.getByRole('button', { name: 'Anuluj' });
const OFFLINE_HINT = 'Bez internetu nie dodasz ani nie usuniesz zdjęć.';
const ERROR = 'Nie udało się usunąć zdjęcia. Spróbuj ponownie.';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DeletePhotoSheet (trip-photos P5, D8)', () => {
  it('asks "Usunąć to zdjęcie?" and says it cannot be undone', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Usunąć to zdjęcie?' })).toBeTruthy();
    expect(screen.getByText('Zniknie z tej podróży. Tego nie da się cofnąć.')).toBeTruthy();
  });

  it('puts the destructive "Usuń zdjęcie" above "Anuluj", full width and 16dp apart, never adjacent (trip-edit-menu D19)', async () => {
    await setup();
    expect(screen.getByText('Usuń zdjęcie')).toHaveStyle({ color: sunlineLightTheme.semantic.error.foreground });
    const actions = screen.getByTestId('delete-photo-actions');
    expect(actions).toHaveStyle({ gap: lightTheme.spacing[4] });
    expect(within(actions).getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual(['Usuń zdjęcie', 'Anuluj']);
    expect(StyleSheet.flatten(actions.props.style).alignItems).toBeUndefined();
    expect(StyleSheet.flatten(actions.props.style).flexDirection).toBeUndefined();
  });

  it('"Anuluj" closes the sheet and deletes nothing', async () => {
    const { onClose, onDeleted, deletePhoto } = await setup();
    await fireEvent.press(cancel());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deletePhoto).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('"Usuń zdjęcie" deletes that photo, then reports it', async () => {
    const { onClose, onDeleted, deletePhoto } = await setup();
    await fireEvent.press(confirm());
    expect(deletePhoto).toHaveBeenCalledTimes(1);
    expect(deletePhoto.mock.calls[0][0]).toEqual(expect.objectContaining({ id: PHOTO_ID, tripId: TRIP_ID }));
    await act(async () => {});
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('while deleting, both buttons are disabled and a second press does not delete twice', async () => {
    let finish: () => void = () => {};
    const { deletePhoto, onDeleted } = await setup(remove(() => new Promise<void>((resolve) => (finish = resolve))));
    await fireEvent.press(confirm());
    await waitFor(() => expect(confirm()).toBeDisabled());
    expect(cancel()).toBeDisabled();
    await fireEvent.press(confirm());
    expect(deletePhoto).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet open with an inline error, announced once, when deleting fails, and lets the user try again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const deletePhoto = remove();
    deletePhoto.mockRejectedValueOnce(new Error('photo-not-deletable'));
    const { onClose, onDeleted } = await setup(deletePhoto);
    await fireEvent.press(confirm());
    expect(await screen.findByText(ERROR)).toBeTruthy();
    // Announced once, by the call; a live region on the text would read it a second time.
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(ERROR);
    expect(screen.getByText(ERROR).props.accessibilityLiveRegion).toBeUndefined();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(confirm()).toBeEnabled();
    expect(cancel()).toBeEnabled();
    await fireEvent.press(confirm());
    await act(async () => {});
    expect(deletePhoto).toHaveBeenCalledTimes(2);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('while deleting, a backdrop tap and the back button do not dismiss the sheet', async () => {
    let finish: () => void = () => {};
    const { onClose } = await setup(remove(() => new Promise<void>((resolve) => (finish = resolve))));
    await fireEvent.press(confirm());
    await waitFor(() => expect(confirm()).toBeDisabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
  });

  it('after deleting fails, the error stays visible and a backdrop tap closes the sheet again', async () => {
    const deletePhoto = remove();
    deletePhoto.mockRejectedValueOnce(new Error('photo-not-deletable'));
    const { onClose } = await setup(deletePhoto);
    await fireEvent.press(confirm());
    expect(await screen.findByText(ERROR)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offline while open: delete is disabled with the offline hint, nothing is sent (D8)', async () => {
    const { deletePhoto } = await setup();
    expect(screen.queryByText(OFFLINE_HINT)).toBeNull();
    await act(async () => setNetwork({ isConnected: false, isInternetReachable: false }));
    expect(screen.getByText(OFFLINE_HINT)).toBeTruthy();
    expect(confirm()).toBeDisabled();
    await fireEvent.press(confirm());
    expect(deletePhoto).not.toHaveBeenCalled();
    // Cancelling stays possible.
    expect(cancel()).toBeEnabled();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await setup();
    expect(screen.getByRole('header', { name: 'Delete this photo?' })).toBeTruthy();
    expect(screen.getByText("It will be removed from this trip. This can't be undone.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
