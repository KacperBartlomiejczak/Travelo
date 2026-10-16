import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { randomUUID } from 'expo-crypto';
import type { ReactNode } from 'react';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { pickTripPhotos } from '@/features/trip-photos/pick-trip-photos';
import { mergeStripItems, PhotoStrip } from '@/features/trip-photos/PhotoStrip';
import type { StripItem } from '@/features/trip-photos/PhotoTile';
import i18n from '@/i18n';
import * as tripPhotoHooks from '@/hooks/useTripPhotos';
import type { PhotoUpload } from '@/hooks/useTripPhotos';
import { AppProviders } from '@/providers/AppProviders';
import type { PickedPhoto, ShownTripPhoto } from '@/schemas';
import { createTripInputFixture } from '@/test/fixtures';
import { setNetwork } from '@/test/mock-network';
import { lightTheme } from '@/theme/theme';

// The gallery is the OS's; jest-expo's native mock of expo-crypto returns undefined, and the uploads need real, known ids.
jest.mock('@/features/trip-photos/pick-trip-photos', () => ({ pickTripPhotos: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
const pick = jest.mocked(pickTripPhotos);

const NOW = new Date('2026-10-15T12:00:00Z');
const OFFLINE = { isConnected: false, isInternetReachable: false };
const SIDE = 20;

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
/** Id of the n-th photo already on the server. */
const photoId = (index: number) => `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
/** Id the n-th photo added from the gallery in a test gets. */
const uploadId = (index: number) => `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`;
let uploadCounter = 0;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  uploadCounter = 0;
  jest.mocked(randomUUID).mockImplementation(() => uploadId(++uploadCounter));
  pick.mockReset();
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
});

/** Lets everything that is already due happen (promises, query notifications), so "still not there" is a real observation. */
const settle = () =>
  act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });

const gallery = (count: number, from = 1): PickedPhoto[] =>
  Array.from({ length: count }, (_, i) => ({ uri: `file:///gallery/${from + i}.jpg`, takenAt: `2026-11-${String(from + i + 2).padStart(2, '0')}T10:00` }));

type Upload = { photoId: string; succeed: () => Promise<void>; fail: () => void };

/** A repository whose `addPhoto` waits until the test settles it, so a tile can be looked at while it is sending. */
function withManualUploads(base: TripRepository) {
  const uploads: Upload[] = [];
  const addPhoto = jest.fn(
    (tripId: string, id: string, picked: PickedPhoto) =>
      new Promise<void>((resolve, reject) => {
        uploads.push({
          photoId: id,
          succeed: async () => {
            await base.addPhoto(tripId, id, picked);
            resolve();
          },
          fail: () => reject(new Error('upload failed')),
        });
      }),
  );
  return { repository: { ...base, addPhoto } satisfies TripRepository, addPhoto, uploads };
}

type Photos = { takenAt?: string }[];

/** A trip in the in-memory repository with photos already on the server (ids photoId(1), photoId(2), …). */
async function tripWithPhotos(photos: Photos = []) {
  const repository = createInMemoryTripRepository({ now: () => NOW, newId });
  const trip = await repository.create(createTripInputFixture());
  for (const [i, photo] of photos.entries()) await repository.addPhoto(trip.id, photoId(i + 1), { uri: `file:///seed/${i + 1}.jpg`, ...photo });
  return { repository, trip };
}

const sevenDays = (count: number): Photos => Array.from({ length: count }, (_, i) => ({ takenAt: `2026-11-0${i + 3}T10:00` }));

type Options = { onOpenPhoto?: (photoId: string) => void };

async function renderStrip(repository: TripRepository, tripId: string, { onOpenPhoto }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={queryClient} tripRepository={repository}>
      {children}
    </AppProviders>
  );
  const view = await render(<PhotoStrip tripId={tripId} sidePadding={SIDE} onOpenPhoto={onOpenPhoto} />, { wrapper });
  return { ...view, queryClient };
}

/** Waits until the strip has read the photos (the skeleton is gone). */
async function loaded() {
  await waitFor(() => expect(screen.queryByTestId('photo-strip-loading')).toBeNull());
}

/** The photo (or preview) in each tile, left to right: the uri its image shows. */
const shownUris = () => screen.getAllByTestId('photo-tile-image').map((image) => image.props.source[0].uri as string);

describe('PhotoStrip: the add tile (P2)', () => {
  it('is a button with its own label, first in the row, with a row label for the photos', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(2));
    await renderStrip(repository, trip.id);
    await loaded();
    const add = screen.getByRole('button', { name: 'Dodaj zdjęcia' });
    expect(add).toBeEnabled();
    expect(screen.getByLabelText('Zdjęcia z podróży')).toBeTruthy();
    // First in the row, before the photos.
    const labels = within(screen.getByLabelText('Zdjęcia z podróży'))
      .getAllByLabelText(/^(Dodaj zdjęcia|Zdjęcie \d+ z \d+)$/)
      .map((node) => node.props.accessibilityLabel);
    expect(labels).toEqual(['Dodaj zdjęcia', 'Zdjęcie 1 z 2', 'Zdjęcie 2 z 2']);
  });

  it('is a square of the photo tile size with the medium radius and the secondary surface, with an icon', async () => {
    const { repository, trip } = await tripWithPhotos();
    await renderStrip(repository, trip.id);
    await loaded();
    const add = screen.getByRole('button', { name: 'Dodaj zdjęcia' });
    expect(add).toHaveStyle({ width: lightTheme.size.photoTile, height: lightTheme.size.photoTile, borderRadius: lightTheme.radius.md });
    expect(screen.getByTestId('photo-add-tile')).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
    expect(within(add).getByTestId('photo-add-icon', { includeHiddenElements: true })).toBeTruthy();
  });

  it('opens the gallery and shows the picked photos at once, each sending, counted over the whole row', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(2, 1));
    await renderStrip(manual.repository, trip.id);
    await loaded();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));

    expect(pick).toHaveBeenCalledTimes(1);
    // The server photo is taken 3 Nov; the gallery ones 3 and 4 Nov at the same hour: the photo comes first on the tie.
    expect(await screen.findByLabelText('Zdjęcie 3 z 3, wysyłanie')).toBeTruthy();
    expect(screen.getByLabelText('Zdjęcie 2 z 3, wysyłanie')).toBeTruthy();
    expect(screen.getByLabelText('Zdjęcie 1 z 3')).toBeTruthy();
    expect(manual.addPhoto).toHaveBeenCalledWith(trip.id, uploadId(1), { uri: 'file:///gallery/1.jpg', takenAt: '2026-11-03T10:00' });
  });

  it('does nothing when the gallery is closed without a choice', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue([]);
    await renderStrip(manual.repository, trip.id);
    await loaded();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await act(async () => {}); // the gallery's answer arrives after the press

    expect(pick).toHaveBeenCalledTimes(1);
    expect(manual.addPhoto).not.toHaveBeenCalled();
    expect(screen.queryByText(/Wysyłam zdjęcia/)).toBeNull();
    expect(screen.queryByText('Nie udało się otworzyć galerii.')).toBeNull();
    expect(screen.getByText('Dodaj zdjęcia z tej podróży.')).toBeTruthy();
  });

  it('says so when the gallery cannot be opened, with an icon, and the next try clears it', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockRejectedValueOnce(new Error('no access'));
    await renderStrip(manual.repository, trip.id);
    await loaded();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    const message = await screen.findByText('Nie udało się otworzyć galerii.');
    expect(message).toHaveStyle({ color: lightTheme.colors.status.error });
    expect(message.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByTestId('photo-strip-error-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(manual.addPhoto).not.toHaveBeenCalled();

    pick.mockResolvedValueOnce(gallery(1));
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await waitFor(() => expect(screen.queryByText('Nie udało się otworzyć galerii.')).toBeNull());
    expect(await screen.findByLabelText('Zdjęcie 1 z 1, wysyłanie')).toBeTruthy();
  });

  it('does not carry the gallery error over to another trip', async () => {
    const { repository, trip } = await tripWithPhotos();
    const other = await repository.create(createTripInputFixture());
    pick.mockRejectedValueOnce(new Error('no access'));
    const { rerender } = await renderStrip(repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    expect(await screen.findByText('Nie udało się otworzyć galerii.')).toBeTruthy();

    await rerender(<PhotoStrip tripId={other.id} sidePadding={SIDE} />);

    await waitFor(() => expect(screen.queryByText('Nie udało się otworzyć galerii.')).toBeNull());
  });

  it('opens the gallery once when the tile is pressed twice while it is opening', async () => {
    const { repository, trip } = await tripWithPhotos();
    let open: (photos: PickedPhoto[]) => void = () => {};
    pick.mockReturnValue(new Promise<PickedPhoto[]>((resolve) => (open = resolve)));
    await renderStrip(repository, trip.id);
    await loaded();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    expect(pick).toHaveBeenCalledTimes(1);

    // Once the gallery has answered, the tile opens it again.
    await act(async () => open([]));
    pick.mockResolvedValue([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    expect(pick).toHaveBeenCalledTimes(2);
  });
});

describe('PhotoStrip: the photos (D10, A6, D23)', () => {
  it('shows them in order, labelled by their place in the row', async () => {
    const { repository, trip } = await tripWithPhotos([
      { takenAt: '2026-11-05T10:00' },
      { takenAt: '2026-11-03T10:00' },
      {},
      { takenAt: '2026-11-04T10:00' },
      { takenAt: '2026-11-06T10:00' },
    ]);
    await renderStrip(repository, trip.id);
    await loaded();

    const labels = screen.getAllByLabelText(/^Zdjęcie \d+ z 5$/).map((node) => node.props.accessibilityLabel);
    expect(labels).toEqual(['Zdjęcie 1 z 5', 'Zdjęcie 2 z 5', 'Zdjęcie 3 z 5', 'Zdjęcie 4 z 5', 'Zdjęcie 5 z 5']);
    // By date taken, the undated one last (photoId 2 = 3 Nov, 4 = 4 Nov, 1 = 5 Nov, 5 = 6 Nov, 3 = no date).
    expect(shownUris().map((uri) => uri.split('/').pop()?.replace('_thumb.jpg', ''))).toEqual([photoId(2), photoId(4), photoId(1), photoId(5), photoId(3)]);
  });

  it("shows each photo's thumbnail (not the full photo), cached under its own key, cropped to the square", async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    await renderStrip(repository, trip.id);
    await loaded();

    const image = within(screen.getByLabelText('Zdjęcie 1 z 1')).getByTestId('photo-tile-image');
    expect(image.props.source).toEqual([
      { uri: `https://photos.invalid/${trip.id}/${photoId(1)}_thumb.jpg`, cacheKey: `${trip.id}/${photoId(1)}_thumb.jpg` },
    ]);
    expect(image.props.contentFit).toBe('cover');
  });

  it('makes every tile a square of the photo tile size with the medium radius', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    await renderStrip(repository, trip.id);
    await loaded();
    expect(screen.getByLabelText('Zdjęcie 1 z 1')).toHaveStyle({
      width: lightTheme.size.photoTile,
      height: lightTheme.size.photoTile,
      borderRadius: lightTheme.radius.md,
    });
  });

  it('calls onOpenPhoto with the photo id when its tile is pressed', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(3));
    const onOpenPhoto = jest.fn();
    await renderStrip(repository, trip.id, { onOpenPhoto });
    await loaded();

    await fireEvent.press(screen.getByRole('button', { name: 'Zdjęcie 2 z 3' }));

    expect(onOpenPhoto).toHaveBeenCalledTimes(1);
    expect(onOpenPhoto).toHaveBeenCalledWith(photoId(2));
  });

  it('does not make the tiles buttons without onOpenPhoto', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(2));
    await renderStrip(repository, trip.id);
    await loaded();

    expect(screen.getByLabelText('Zdjęcie 1 z 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zdjęcie 1 z 2' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zdjęcie 2 z 2' })).toBeNull();
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    const { repository, trip } = await tripWithPhotos(sevenDays(2));
    await renderStrip(repository, trip.id);
    await loaded();
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeTruthy();
    expect(screen.getByLabelText('Trip photos')).toBeTruthy();
    expect(screen.getByLabelText('Photo 2 of 2')).toBeTruthy();
  });
});

describe('PhotoStrip: empty, loading and error (P3)', () => {
  it('shows a hint next to the add tile when the trip has no photos', async () => {
    const { repository, trip } = await tripWithPhotos();
    await renderStrip(repository, trip.id);
    await loaded();
    expect(screen.getByText('Dodaj zdjęcia z tej podróży.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dodaj zdjęcia' })).toBeTruthy();
    expect(screen.queryByLabelText(/^Zdjęcie \d+ z \d+/)).toBeNull();
  });

  it('drops the hint once there are photos', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    await renderStrip(repository, trip.id);
    await loaded();
    expect(screen.queryByText('Dodaj zdjęcia z tej podróży.')).toBeNull();
  });

  it('shows three static skeleton tiles of the tile size beside the add tile while the photos load', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    const photos = jest.fn(() => new Promise<never>(() => {}));
    await renderStrip({ ...repository, photos }, trip.id);

    const loading = await screen.findByTestId('photo-strip-loading');
    expect(loading.props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
    const tiles = within(loading).getAllByTestId('photo-skeleton-tile');
    expect(tiles).toHaveLength(3);
    for (const tile of tiles) {
      expect(tile).toHaveStyle({
        width: lightTheme.size.photoTile,
        height: lightTheme.size.photoTile,
        borderRadius: lightTheme.radius.md,
        backgroundColor: lightTheme.colors.surface.secondary,
      });
    }
    // One element for a screen reader, and the add tile stays usable.
    expect(loading.props.accessibilityLabel).toBe('Zdjęcia z podróży');
    expect(screen.getByRole('button', { name: 'Dodaj zdjęcia' })).toBeEnabled();
    expect(screen.queryByText('Dodaj zdjęcia z tej podróży.')).toBeNull();
  });

  it('says the photos could not be loaded and tries again on request', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(2));
    const photos = jest.fn(repository.photos);
    photos.mockRejectedValueOnce(new Error('network'));
    await renderStrip({ ...repository, photos }, trip.id);

    const message = await screen.findByText('Nie udało się wczytać zdjęć.');
    expect(message).toHaveStyle({ color: lightTheme.colors.status.error });
    expect(screen.getByTestId('photo-strip-error-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dodaj zdjęcia' })).toBeEnabled();
    expect(screen.queryByText('Dodaj zdjęcia z tej podróży.')).toBeNull();
    expect(photos).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByLabelText('Zdjęcie 2 z 2')).toBeTruthy();
    expect(photos).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Nie udało się wczytać zdjęć.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
  });

  it('keeps the photos on screen when a later read fails (§12)', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(2));
    const photos = jest.fn(repository.photos);
    const { queryClient } = await renderStrip({ ...repository, photos }, trip.id);
    await loaded();
    expect(await screen.findByLabelText('Zdjęcie 2 z 2')).toBeTruthy();

    photos.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['trip-photos', trip.id] });
    });

    // The query is in its error state (with the old list kept) and the screen has caught up with it.
    await waitFor(() => expect(queryClient.getQueryState(['trip-photos', trip.id])?.status).toBe('error'));
    await settle();
    expect(photos).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Zdjęcie 2 z 2')).toBeTruthy();
    expect(screen.queryByText('Nie udało się wczytać zdjęć.')).toBeNull();
  });

  it('still lets the user retry the read when photos are being sent but the list could not be read', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    const photos = jest.fn(repository.photos);
    photos.mockRejectedValueOnce(new Error('network'));
    pick.mockResolvedValue(gallery(1));
    await renderStrip({ ...manual.repository, photos }, trip.id);
    await screen.findByText('Nie udało się wczytać zdjęć.');

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    expect(await screen.findByLabelText('Zdjęcie 1 z 1, wysyłanie')).toBeTruthy();

    // The sending tile took the row's place, so the message and its button moved under the row.
    expect(screen.getByText('Nie udało się wczytać zdjęć.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(photos).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Nie udało się wczytać zdjęć.')).toBeNull());
  });
});

describe('PhotoStrip: sending (D15, D22)', () => {
  it('shows the preview of a photo being sent under the scrim with a spinner, and says so to a screen reader', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(2));
    await renderStrip(manual.repository, trip.id);
    await loaded();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));

    const sending = await screen.findByLabelText('Zdjęcie 1 z 2, wysyłanie');
    expect(within(sending).getByTestId('photo-tile-image').props.source).toEqual([{ uri: 'file:///gallery/1.jpg' }]);
    expect(within(sending).getByTestId('photo-tile-image').props.contentFit).toBe('cover');
    expect(within(sending).getByTestId('photo-tile-scrim')).toHaveStyle({ backgroundColor: lightTheme.colors.overlay.scrim });
    expect(within(sending).getByTestId('photo-tile-spinner', { includeHiddenElements: true })).toBeTruthy();
    // The second one waits its turn and looks the same.
    const waiting = screen.getByLabelText('Zdjęcie 2 z 2, wysyłanie');
    expect(within(waiting).getByTestId('photo-tile-spinner', { includeHiddenElements: true })).toBeTruthy();
    // Not pressable: nothing to do with a photo on its way.
    expect(screen.queryByRole('button', { name: 'Zdjęcie 1 z 2, wysyłanie' })).toBeNull();
  });

  it('counts the photos sent so far in a polite line under the row', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(3));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    expect(screen.queryByText(/Wysyłam zdjęcia/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    const line = await screen.findByText('Wysyłam zdjęcia: 0 z 3');
    expect(line.props.accessibilityLiveRegion).toBe('polite');
    expect(line).toHaveStyle({ color: lightTheme.colors.text.secondary });

    await act(async () => manual.uploads[0].succeed());
    expect(await screen.findByText('Wysyłam zdjęcia: 1 z 3')).toBeTruthy();
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    await act(async () => manual.uploads[1].succeed());
    expect(await screen.findByText('Wysyłam zdjęcia: 2 z 3')).toBeTruthy();
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    await act(async () => manual.uploads[2].succeed());

    // Everything is sent: the line goes and the three photos are tiles of the row, no longer sending.
    await waitFor(() => expect(screen.queryByText(/Wysyłam zdjęcia/)).toBeNull());
    expect(await screen.findByLabelText('Zdjęcie 3 z 3')).toBeTruthy();
    expect(screen.queryByLabelText(/wysyłanie/)).toBeNull();
  });

  it('turns the sent photo into its thumbnail under the same place, without a second tile', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(1));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await screen.findByLabelText('Zdjęcie 1 z 1, wysyłanie');

    await act(async () => manual.uploads[0].succeed());

    const tile = await screen.findByLabelText('Zdjęcie 1 z 1');
    expect(within(tile).getByTestId('photo-tile-image').props.source).toEqual([
      { uri: `https://photos.invalid/${trip.id}/${uploadId(1)}_thumb.jpg`, cacheKey: `${trip.id}/${uploadId(1)}_thumb.jpg` },
    ]);
    expect(screen.getAllByTestId('photo-tile-image')).toHaveLength(1);
  });

  it('puts a photo being sent where its date taken puts it, among the photos already there (P6)', async () => {
    const { repository, trip } = await tripWithPhotos([{ takenAt: '2026-11-03T10:00' }, { takenAt: '2026-11-09T10:00' }]);
    const manual = withManualUploads(repository);
    pick.mockResolvedValue([{ uri: 'file:///gallery/middle.jpg', takenAt: '2026-11-05T10:00' }]);
    await renderStrip(manual.repository, trip.id);
    await loaded();

    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await screen.findByLabelText('Zdjęcie 2 z 3, wysyłanie');

    expect(shownUris()[1]).toBe('file:///gallery/middle.jpg');
    expect(shownUris()).toHaveLength(3);
  });
});

describe('PhotoStrip: photos that could not be sent (P3)', () => {
  it('marks the tile with an icon and a label that says what to do, and sends that photo again when pressed', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(1));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await screen.findByLabelText('Zdjęcie 1 z 1, wysyłanie');

    await act(async () => manual.uploads[0].fail());

    const failed = await screen.findByRole('button', { name: 'Zdjęcie 1 z 1, nie wysłane. Stuknij, aby spróbować ponownie.' });
    expect(within(failed).getByTestId('photo-tile-scrim')).toBeTruthy();
    expect(within(failed).getByTestId('photo-tile-failed-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(within(failed).getByTestId('photo-tile-image').props.source).toEqual([{ uri: 'file:///gallery/1.jpg' }]);
    expect(manual.addPhoto).toHaveBeenCalledTimes(1);

    await fireEvent.press(failed);

    expect(await screen.findByLabelText('Zdjęcie 1 z 1, wysyłanie')).toBeTruthy();
    await waitFor(() => expect(manual.addPhoto).toHaveBeenCalledTimes(2));
    // The same photo again: the same id, so the server never gets two (A5).
    expect(manual.addPhoto).toHaveBeenLastCalledWith(trip.id, uploadId(1), { uri: 'file:///gallery/1.jpg', takenAt: '2026-11-03T10:00' });
  });

  it('says how many could not be sent and sends them all again with one button', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(3));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await screen.findByLabelText('Zdjęcie 1 z 3, wysyłanie');

    // The first one is sent, the other two fail.
    await act(async () => manual.uploads[0].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    await act(async () => manual.uploads[1].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    await act(async () => manual.uploads[2].fail());

    const line = await screen.findByText('Nie udało się wysłać 2 zdjęć');
    expect(line).toHaveStyle({ color: lightTheme.colors.status.error });
    expect(line.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByTestId('photo-strip-error-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(/Wysyłam zdjęcia/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    // Both go back to sending, the first one at once: ids 2 and 3 of the gallery.
    await waitFor(() => expect(manual.uploads).toHaveLength(4));
    expect(manual.uploads[3].photoId).toBe(uploadId(2));
    expect(await screen.findByText('Wysyłam zdjęcia: 0 z 2')).toBeTruthy();
    expect(screen.queryByText(/Nie udało się wysłać/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
  });

  it('uses the singular for one photo', async () => {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(1));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await screen.findByLabelText('Zdjęcie 1 z 1, wysyłanie');
    await act(async () => manual.uploads[0].fail());
    expect(await screen.findByText('Nie udało się wysłać 1 zdjęcia')).toBeTruthy();
  });

  it('reads in English, with the plural', async () => {
    await i18n.changeLanguage('en');
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(2));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
    expect(await screen.findByText('Sending photos: 0 of 2')).toBeTruthy();
    expect(screen.getByLabelText('Photo 1 of 2, sending')).toBeTruthy();
    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    expect(await screen.findByText("1 photo couldn't be sent")).toBeTruthy();
    expect(screen.getByLabelText('Photo 1 of 2, not sent. Tap to try again.')).toBeTruthy();
    await act(async () => manual.uploads[1].fail());
    expect(await screen.findByText("2 photos couldn't be sent")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('PhotoStrip: offline (D8)', () => {
  it('disables the add tile, does not open the gallery and says why; the photos on the phone still show', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(2));
    await renderStrip(repository, trip.id);
    await loaded();
    expect(screen.queryByText('Bez internetu nie dodasz ani nie usuniesz zdjęć.')).toBeNull();

    await act(async () => setNetwork(OFFLINE));

    expect(screen.getByText('Bez internetu nie dodasz ani nie usuniesz zdjęć.')).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Dodaj zdjęcia' });
    expect(add).toBeDisabled();
    expect(add.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(add).toHaveStyle({ opacity: 0.4 });
    await fireEvent.press(add);
    expect(pick).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Zdjęcie 1 z 2')).toBeTruthy();
    expect(screen.getByLabelText('Zdjęcie 2 z 2')).toBeTruthy();
  });

  it('is back to normal when the connection returns', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    await act(async () => setNetwork(OFFLINE));
    await renderStrip(repository, trip.id);
    await loaded();
    expect(screen.getByRole('button', { name: 'Dodaj zdjęcia' })).toBeDisabled();

    await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));

    expect(screen.getByRole('button', { name: 'Dodaj zdjęcia' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Dodaj zdjęcia' })).toHaveStyle({ opacity: 1 });
    expect(screen.queryByText('Bez internetu nie dodasz ani nie usuniesz zdjęć.')).toBeNull();
  });

  it('shows the hint and the load error together when there is no copy of the photos', async () => {
    const { repository, trip } = await tripWithPhotos();
    const photos = jest.fn(() => Promise.reject(new Error('offline without a copy')));
    await act(async () => setNetwork(OFFLINE));
    await renderStrip({ ...repository, photos }, trip.id);

    expect(await screen.findByText('Nie udało się wczytać zdjęć.')).toBeTruthy();
    expect(screen.getByText('Bez internetu nie dodasz ani nie usuniesz zdjęć.')).toBeTruthy();
  });
});

describe('PhotoStrip: trying again while offline (D24)', () => {
  const ONLINE = { isConnected: true, isInternetReachable: true };
  const tileLabel = (index: number, count: number) => `Zdjęcie ${index} z ${count}, nie wysłane. Stuknij, aby spróbować ponownie.`;
  // D29: offline the tile is disabled, so its label no longer tells the user to tap.
  const offlineTileLabel = (index: number, count: number) => `Zdjęcie ${index} z ${count}, nie wysłane`;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * The real upload queue with its two ways of trying again watched. Offline the queue fails a photo straight after it
   * is revived, so a wrongly allowed press shows nothing on screen: only the calls tell.
   */
  function watchRetries() {
    const retry = jest.fn();
    const retryFailed = jest.fn();
    const real = tripPhotoHooks.usePhotoUploads;
    jest.spyOn(tripPhotoHooks, 'usePhotoUploads').mockImplementation((tripId) => {
      const uploads = real(tripId);
      return {
        ...uploads,
        retry: (id: string) => {
          retry(id);
          uploads.retry(id);
        },
        retryFailed: () => {
          retryFailed();
          uploads.retryFailed();
        },
      };
    });
    return { retry, retryFailed };
  }

  /** `count` photos picked online, all of which fail to send. */
  async function withFailedPhotos(count: number) {
    const { repository, trip } = await tripWithPhotos();
    const manual = withManualUploads(repository);
    const watched = watchRetries();
    pick.mockResolvedValue(gallery(count));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await screen.findByLabelText(`Zdjęcie 1 z ${count}, wysyłanie`);
    for (let i = 0; i < count; i++) {
      await waitFor(() => expect(manual.uploads).toHaveLength(i + 1));
      await act(async () => manual.uploads[i].fail());
    }
    await screen.findByText(/Nie udało się wysłać/);
    return { manual, ...watched };
  }

  it('disables the tile of a failed photo and dims it like the add tile, and pressing it does not send the photo again', async () => {
    const { manual, retry } = await withFailedPhotos(2);
    const first = screen.getByRole('button', { name: tileLabel(1, 2) });
    expect(first).toBeEnabled();
    expect(first).toHaveStyle({ opacity: 1 });

    await act(async () => setNetwork(OFFLINE));

    for (const index of [1, 2]) {
      const tile = screen.getByRole('button', { name: offlineTileLabel(index, 2) });
      expect(tile).toBeDisabled();
      expect(tile.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
      expect(tile).toHaveStyle({ opacity: 0.4 });
      await fireEvent.press(tile);
    }
    expect(retry).not.toHaveBeenCalled();
    expect(manual.addPhoto).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Bez internetu nie dodasz ani nie usuniesz zdjęć.')).toBeTruthy();
  });

  it("disables the failed line's button, and pressing it does not send the photos again", async () => {
    const { manual, retryFailed } = await withFailedPhotos(2);
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeEnabled();

    await act(async () => setNetwork(OFFLINE));

    const button = screen.getByRole('button', { name: 'Spróbuj ponownie' });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    await fireEvent.press(button);
    expect(retryFailed).not.toHaveBeenCalled();
    expect(manual.addPhoto).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Nie udało się wysłać 2 zdjęć')).toBeTruthy();
  });

  it('works again when the connection returns: the tile sends its photo, the button sends the rest', async () => {
    const { manual, retry, retryFailed } = await withFailedPhotos(2);
    await act(async () => setNetwork(OFFLINE));
    expect(screen.getByRole('button', { name: offlineTileLabel(1, 2) })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeDisabled();

    await act(async () => setNetwork(ONLINE));

    const first = screen.getByRole('button', { name: tileLabel(1, 2) });
    expect(first).toBeEnabled();
    expect(first).toHaveStyle({ opacity: 1 });
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeEnabled();

    await fireEvent.press(first);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('Zdjęcie 1 z 2, wysyłanie')).toBeTruthy();
    await waitFor(() => expect(manual.addPhoto).toHaveBeenCalledTimes(3));

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(retryFailed).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('Zdjęcie 2 z 2, wysyłanie')).toBeTruthy();
  });

  it('drops the "tap to try again" instruction from the label of a disabled failed tile, and brings it back online (D29)', async () => {
    await withFailedPhotos(2);
    expect(screen.getByLabelText(tileLabel(1, 2))).toBeTruthy();
    expect(screen.queryByLabelText(offlineTileLabel(1, 2))).toBeNull();

    await act(async () => setNetwork(OFFLINE));

    expect(screen.getByRole('button', { name: offlineTileLabel(1, 2) })).toBeDisabled();
    expect(screen.getByRole('button', { name: offlineTileLabel(2, 2) })).toBeDisabled();
    expect(screen.queryByLabelText(/Stuknij/)).toBeNull();
    expect(screen.queryByLabelText(tileLabel(1, 2))).toBeNull();

    await act(async () => setNetwork(ONLINE));

    expect(screen.getByRole('button', { name: tileLabel(1, 2) })).toBeEnabled();
    expect(screen.getByRole('button', { name: tileLabel(2, 2) })).toBeEnabled();
    expect(screen.queryByLabelText(offlineTileLabel(1, 2))).toBeNull();
  });

  it('reads the offline label in English', async () => {
    await withFailedPhotos(1);
    await act(async () => i18n.changeLanguage('en'));
    await act(async () => setNetwork(OFFLINE));

    expect(screen.getByRole('button', { name: 'Photo 1 of 1, not sent' })).toBeDisabled();
    expect(screen.queryByLabelText(/Tap to try again/)).toBeNull();
  });

  it('does not change the label of a photo that is being sent or of one already on the server when offline', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    const manual = withManualUploads(repository);
    pick.mockResolvedValue(gallery(1));
    await renderStrip(manual.repository, trip.id);
    await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj zdjęcia' }));
    await screen.findByLabelText('Zdjęcie 2 z 2, wysyłanie');

    await act(async () => setNetwork(OFFLINE));

    expect(screen.getByLabelText('Zdjęcie 1 z 2')).toBeTruthy();
    expect(screen.getByLabelText('Zdjęcie 2 z 2, wysyłanie')).toBeTruthy();
  });

  it('leaves the load error\'s "Spróbuj ponownie" alone: reading the list again works offline, from the copy on the phone', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(1));
    const photos = jest.fn(repository.photos);
    photos.mockRejectedValueOnce(new Error('offline without a copy'));
    await act(async () => setNetwork(OFFLINE));
    await renderStrip({ ...repository, photos }, trip.id);
    await screen.findByText('Nie udało się wczytać zdjęć.');

    const retryRead = screen.getByRole('button', { name: 'Spróbuj ponownie' });
    expect(retryRead).toBeEnabled();
    await fireEvent.press(retryRead);

    await waitFor(() => expect(photos).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Zdjęcie 1 z 1')).toBeTruthy();
  });
});

describe('PhotoStrip: layout', () => {
  it('pads the row by the side padding it is given and puts the tiles 8dp apart', async () => {
    const { repository, trip } = await tripWithPhotos(sevenDays(2));
    await renderStrip(repository, trip.id);
    await loaded();
    expect(screen.getByLabelText('Zdjęcia z podróży').props.contentContainerStyle).toEqual(
      expect.objectContaining({ paddingHorizontal: SIDE, gap: lightTheme.spacing[2] }),
    );
  });
});

describe('mergeStripItems (D10, D13, P6)', () => {
  const TRIP = '00000000-0000-4000-8000-0000000000aa';
  const photo = (id: string, takenAt?: string): ShownTripPhoto => ({
    id,
    tripId: TRIP,
    ...(takenAt ? { takenAt } : {}),
    createdAt: '2026-10-15T12:00:00.000Z',
    url: `https://photos.invalid/${id}.jpg`,
    thumbnailUrl: `https://photos.invalid/${id}_thumb.jpg`,
  });
  const upload = (id: string, takenAt?: string): PhotoUpload => ({ id, uri: `file:///${id}.jpg`, ...(takenAt ? { takenAt } : {}), status: 'waiting' });
  const ids = (items: StripItem[]) => items.map((item) => (item.kind === 'photo' ? item.photo.id : item.upload.id));

  it('is the photos as they come when nothing is being sent, and the uploads in queue order when there are no photos', () => {
    const photos = [photo('p1', '2026-11-03T10:00'), photo('p2', '2026-11-04T10:00'), photo('p3')];
    expect(ids(mergeStripItems(photos, []))).toEqual(['p1', 'p2', 'p3']);
    const uploads = [upload('u1'), upload('u2'), upload('u3')];
    expect(ids(mergeStripItems([], uploads))).toEqual(['u1', 'u2', 'u3']);
    expect(mergeStripItems([], [])).toEqual([]);
  });

  it('tags each item with what it is', () => {
    const items = mergeStripItems([photo('p1', '2026-11-03T10:00')], [upload('u1', '2026-11-04T10:00')]);
    expect(items.map((item) => item.kind)).toEqual(['photo', 'upload']);
  });

  it('puts an upload among the photos by its date taken, oldest first', () => {
    const photos = [photo('p1', '2026-11-03T10:00'), photo('p2', '2026-11-07T10:00')];
    expect(ids(mergeStripItems(photos, [upload('u1', '2026-11-05T10:00')]))).toEqual(['p1', 'u1', 'p2']);
    expect(ids(mergeStripItems(photos, [upload('u1', '2026-11-01T10:00')]))).toEqual(['u1', 'p1', 'p2']);
    expect(ids(mergeStripItems(photos, [upload('u1', '2026-11-09T10:00')]))).toEqual(['p1', 'p2', 'u1']);
  });

  it('orders uploads by their date taken, not by when they were queued', () => {
    const uploads = [upload('u1', '2026-11-06T10:00'), upload('u2', '2026-11-04T10:00'), upload('u3', '2026-11-05T10:00')];
    expect(ids(mergeStripItems([], uploads))).toEqual(['u2', 'u3', 'u1']);
  });

  it('puts photos without a date taken after every dated one, uploads included', () => {
    const photos = [photo('p1', '2026-11-03T10:00'), photo('p2')];
    expect(ids(mergeStripItems(photos, [upload('u1', '2026-11-20T10:00')]))).toEqual(['p1', 'u1', 'p2']);
    expect(ids(mergeStripItems(photos, [upload('u1')]))).toEqual(['p1', 'p2', 'u1']);
    expect(ids(mergeStripItems([photo('p1')], [upload('u1', '2026-11-20T10:00')]))).toEqual(['u1', 'p1']);
  });

  it('puts a photo before an upload at the same place, whether the date is the same or both have none', () => {
    const dated = [photo('p1', '2026-11-03T10:00'), photo('p2', '2026-11-03T10:00')];
    expect(ids(mergeStripItems(dated, [upload('u1', '2026-11-03T10:00')]))).toEqual(['p1', 'p2', 'u1']);
    expect(ids(mergeStripItems(dated, [upload('u1', '2026-11-03T09:59')]))).toEqual(['u1', 'p1', 'p2']);
    expect(ids(mergeStripItems([photo('p1'), photo('p2')], [upload('u1')]))).toEqual(['p1', 'p2', 'u1']);
  });

  it('keeps the queue order of uploads at the same place', () => {
    const same = [upload('u1', '2026-11-03T10:00'), upload('u2', '2026-11-03T10:00'), upload('u3', '2026-11-03T10:00')];
    expect(ids(mergeStripItems([photo('p1', '2026-11-03T10:00')], same))).toEqual(['p1', 'u1', 'u2', 'u3']);
    expect(ids(mergeStripItems([], [upload('u1'), upload('u2'), upload('u3')]))).toEqual(['u1', 'u2', 'u3']);
  });

  it('keeps the photos in the order the list gave them (it is already sorted)', () => {
    const photos = [photo('p2', '2026-11-03T10:00'), photo('p1', '2026-11-03T10:00'), photo('p3')];
    expect(ids(mergeStripItems(photos, [upload('u1', '2026-11-03T10:00')]))).toEqual(['p2', 'p1', 'u1', 'p3']);
  });

  it('leaves out an upload whose photo is in the list already, so a sent photo is never shown twice', () => {
    const photos = [photo('p1', '2026-11-03T10:00'), photo('u1', '2026-11-04T10:00')];
    const items = mergeStripItems(photos, [upload('u1', '2026-11-04T10:00'), upload('u2', '2026-11-04T10:00')]);
    expect(ids(items)).toEqual(['p1', 'u1', 'u2']);
    expect(items.map((item) => item.kind)).toEqual(['photo', 'photo', 'upload']);
  });

  it('does not change what it is given', () => {
    const photos = [photo('p2', '2026-11-04T10:00'), photo('p1', '2026-11-03T10:00')];
    const uploads = [upload('u2', '2026-11-04T10:00'), upload('u1', '2026-11-01T10:00')];
    const photosBefore = structuredClone(photos);
    const uploadsBefore = structuredClone(uploads);
    mergeStripItems(photos, uploads);
    expect(photos).toEqual(photosBefore);
    expect(uploads).toEqual(uploadsBefore);
  });
});
