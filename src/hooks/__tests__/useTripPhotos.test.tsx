import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { randomUUID } from 'expo-crypto';
import type { ReactNode } from 'react';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import { tripPhotosKey, useDeleteTripPhoto, usePhotoUploads, useTripPhotos } from '@/hooks/useTripPhotos';
import { AppProviders } from '@/providers/AppProviders';
import type { PickedPhoto } from '@/schemas';
import { createTripInputFixture } from '@/test/fixtures';
import { setNetwork } from '@/test/mock-network';

// jest-expo's native mock returns undefined; the photo ids must be real, lowercase UUIDs, and the tests need to know them.
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

const NOW = new Date('2026-10-15T12:00:00Z');
const OFFLINE = { isConnected: false, isInternetReachable: false };
const ONLINE = { isConnected: true, isInternetReachable: true };

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
/** The id the n-th photo added in a test gets (the randomUUID mock counts from 1 in every test). */
const photoId = (index: number) => `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
let photoCounter = 0;

beforeEach(() => {
  // Fake timers, like the other hook tests: the query cache's 5-minute garbage-collection timers die with them.
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  photoCounter = 0;
  jest.mocked(randomUUID).mockImplementation(() => photoId(++photoCounter));
});

afterEach(() => {
  jest.useRealTimers();
});

/** Lets everything that is already due happen (promises, query notifications), so "still waiting" is a real observation. */
const settle = () =>
  act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });

function setup(repository: TripRepository) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={queryClient} tripRepository={repository}>
      {children}
    </AppProviders>
  );
  return { queryClient, wrapper };
}

async function tripInRepository() {
  const repository = createInMemoryTripRepository({ now: () => NOW, newId });
  const trip = await repository.create(createTripInputFixture());
  return { repository, trip };
}

/** Photos as the gallery returns them, each with its own date taken. */
const gallery = (count: number): PickedPhoto[] =>
  Array.from({ length: count }, (_, i) => ({
    uri: `file:///gallery/${i + 1}.jpg`,
    takenAt: `2026-11-${String(i + 3).padStart(2, '0')}T10:00`,
  }));

type Upload = { tripId: string; photoId: string; picked: PickedPhoto; succeed: () => Promise<void>; fail: () => void };

/** A repository whose `addPhoto` waits until the test settles it, so the order and timing of the uploads are visible. */
function withManualUploads(base: TripRepository) {
  const uploads: Upload[] = [];
  const addPhoto = jest.fn(
    (tripId: string, id: string, picked: PickedPhoto) =>
      new Promise<void>((resolve, reject) => {
        uploads.push({
          tripId,
          photoId: id,
          picked,
          // Like the server: the photo exists once the upload is done.
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

async function renderUploads(repository: TripRepository, tripId: string) {
  const { queryClient, wrapper } = setup(repository);
  const view = await renderHook(() => ({ list: useTripPhotos(tripId), uploads: usePhotoUploads(tripId) }), { wrapper });
  await waitFor(() => expect(view.result.current.list.isSuccess).toBe(true));
  return { ...view, queryClient };
}

describe('useTripPhotos', () => {
  it("returns the trip's photos from the repository", async () => {
    const { repository, trip } = await tripInRepository();
    await repository.addPhoto(trip.id, photoId(1), gallery(1)[0]);
    const { result } = await renderHook(() => useTripPhotos(trip.id), { wrapper: setup(repository).wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({ id: photoId(1), tripId: trip.id, takenAt: '2026-11-03T10:00' });
  });

  it('still asks the repository offline, which answers from the copy on the phone (D8)', async () => {
    const { repository, trip } = await tripInRepository();
    const photos = jest.fn(repository.photos);
    onlineManager.setOnline(false);
    try {
      const { result } = await renderHook(() => useTripPhotos(trip.id), { wrapper: setup({ ...repository, photos }).wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(photos).toHaveBeenCalledWith(trip.id);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('exposes a repository error (an offline trip without a copy)', async () => {
    const { repository, trip } = await tripInRepository();
    const photos = jest.fn(() => Promise.reject(new Error('no copy')));
    const { result } = await renderHook(() => useTripPhotos(trip.id), { wrapper: setup({ ...repository, photos }).wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("has a key per trip, outside ['trips'], so budget saves and renames do not re-read the photos", async () => {
    expect(tripPhotosKey('abc')).toEqual(['trip-photos', 'abc']);
    const { repository, trip } = await tripInRepository();
    const photos = jest.fn(repository.photos);
    const { queryClient, wrapper } = setup({ ...repository, photos });
    const { result } = await renderHook(() => useTripPhotos(trip.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(photos).toHaveBeenCalledTimes(1);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    });

    expect(photos).toHaveBeenCalledTimes(1);
  });
});

describe('usePhotoUploads: the queue (A4, D15)', () => {
  it('adds one item per photo with a fresh id, its uri and its date, and sends the first at once', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);

    await act(async () => result.current.uploads.add(gallery(3)));

    expect(result.current.uploads.items).toEqual([
      { id: photoId(1), uri: 'file:///gallery/1.jpg', takenAt: '2026-11-03T10:00', status: 'sending' },
      { id: photoId(2), uri: 'file:///gallery/2.jpg', takenAt: '2026-11-04T10:00', status: 'waiting' },
      { id: photoId(3), uri: 'file:///gallery/3.jpg', takenAt: '2026-11-05T10:00', status: 'waiting' },
    ]);
    expect(manual.addPhoto).toHaveBeenCalledTimes(1);
    expect(manual.addPhoto).toHaveBeenCalledWith(trip.id, photoId(1), { uri: 'file:///gallery/1.jpg', takenAt: '2026-11-03T10:00' });
  });

  it('handles a photo without a date taken', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);

    await act(async () => result.current.uploads.add([{ uri: 'file:///gallery/screenshot.png' }]));

    expect(result.current.uploads.items).toEqual([{ id: photoId(1), uri: 'file:///gallery/screenshot.png', status: 'sending' }]);
    expect(manual.addPhoto).toHaveBeenCalledWith(trip.id, photoId(1), { uri: 'file:///gallery/screenshot.png' });
  });

  it('does nothing when no photo was picked', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);

    await act(async () => result.current.uploads.add([]));

    expect(result.current.uploads.items).toEqual([]);
    expect(result.current.uploads.progress).toBeNull();
    expect(manual.addPhoto).not.toHaveBeenCalled();
  });

  it('sends one photo at a time, in the order they were added; each is waiting, then sending, then gone', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    const statuses = () => result.current.uploads.items.map((item) => item.status);

    await act(async () => result.current.uploads.add(gallery(3)));
    expect(statuses()).toEqual(['sending', 'waiting', 'waiting']);

    await act(async () => manual.uploads[0].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    expect(statuses()).toEqual(['sending', 'waiting']);
    expect(manual.uploads[1].photoId).toBe(photoId(2));

    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    expect(statuses()).toEqual(['sending']);
    expect(manual.uploads[2].photoId).toBe(photoId(3));

    await act(async () => manual.uploads[2].succeed());
    await waitFor(() => expect(result.current.uploads.items).toEqual([]));
    expect(manual.addPhoto.mock.calls.map(([, id]) => id)).toEqual([photoId(1), photoId(2), photoId(3)]);
    expect(result.current.list.data?.map((photo) => photo.id)).toEqual([photoId(1), photoId(2), photoId(3)]);
  });

  it('keeps the tile until the refreshed photo list has arrived, so it does not blink (A3)', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    let hold = false;
    let release = () => {};
    const photos = jest.fn(async (tripId: string) => {
      if (hold) await new Promise<void>((resolve) => (release = resolve));
      return repository.photos(tripId);
    });
    const { result } = await renderUploads({ ...manual.repository, photos }, trip.id);
    hold = true;
    await act(async () => result.current.uploads.add(gallery(1)));

    await act(async () => manual.uploads[0].succeed());
    // The photo is on the server and the list is being read again: the tile is still there, and still "sending".
    await waitFor(() => expect(photos).toHaveBeenCalledTimes(2));
    await settle();
    expect(result.current.uploads.items).toMatchObject([{ id: photoId(1), status: 'sending' }]);
    expect(result.current.list.data).toEqual([]);

    await act(async () => release());
    await waitFor(() => expect(result.current.uploads.items).toEqual([]));
    expect(result.current.list.data?.map((photo) => photo.id)).toEqual([photoId(1)]);
  });

  it('leaves a failed upload as failed and still sends the next photo', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(3)));

    await act(async () => manual.uploads[0].fail());

    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed', 'sending', 'waiting']);
    expect(result.current.uploads.failedCount).toBe(1);
    expect(manual.uploads[1].photoId).toBe(photoId(2));

    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    await act(async () => manual.uploads[2].succeed());
    await waitFor(() => expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed']));
    expect(result.current.uploads.failedCount).toBe(1);
  });

  it('retry(id) sends that photo again with the same id, so the server never gets a second one (A5)', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(2)));
    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed']));

    await act(async () => result.current.uploads.retry(photoId(1)));

    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    expect(manual.uploads[2]).toMatchObject({ tripId: trip.id, photoId: photoId(1), picked: gallery(2)[0] });
    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['sending']);
    expect(result.current.uploads.failedCount).toBe(0);

    await act(async () => manual.uploads[2].succeed());
    await waitFor(() => expect(result.current.uploads.items).toEqual([]));
    expect(result.current.list.data?.map((photo) => photo.id)).toEqual([photoId(1), photoId(2)]);
  });

  it('retry(id) sends only that photo; the other failed ones stay failed', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(3)));
    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    await act(async () => manual.uploads[1].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed', 'failed', 'sending']);

    await act(async () => result.current.uploads.retry(photoId(1)));

    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['waiting', 'failed', 'sending']);
    expect(result.current.uploads.failedCount).toBe(1);
    await act(async () => manual.uploads[2].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(4));
    expect(manual.uploads[3].photoId).toBe(photoId(1));
    await act(async () => manual.uploads[3].succeed());
    await waitFor(() => expect(result.current.uploads.items.map((item) => item.id)).toEqual([photoId(2)]));
    expect(result.current.uploads.items[0].status).toBe('failed');
    expect(manual.addPhoto).toHaveBeenCalledTimes(4);
  });

  it('retry(id) ignores a photo that has not failed', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(2)));

    await act(async () => {
      result.current.uploads.retry(photoId(1)); // sending
      result.current.uploads.retry(photoId(2)); // waiting
      result.current.uploads.retry('unknown');
    });

    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['sending', 'waiting']);
    expect(manual.addPhoto).toHaveBeenCalledTimes(1);
  });

  it('retryFailed() sends every failed photo again, with the same ids, in the order they were added', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(3)));
    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    await act(async () => manual.uploads[2].fail());
    await waitFor(() => expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed', 'failed']));
    expect(result.current.uploads.failedCount).toBe(2);

    await act(async () => result.current.uploads.retryFailed());

    await waitFor(() => expect(manual.uploads).toHaveLength(4));
    expect(manual.uploads[3].photoId).toBe(photoId(1));
    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['sending', 'waiting']);
    await act(async () => manual.uploads[3].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(5));
    expect(manual.uploads[4]).toMatchObject({ photoId: photoId(3), picked: gallery(3)[2] });
    await act(async () => manual.uploads[4].succeed());
    await waitFor(() => expect(result.current.uploads.items).toEqual([]));
    expect(result.current.list.data?.map((photo) => photo.id)).toEqual([photoId(1), photoId(2), photoId(3)]);
  });

  it('invalidates the photos of its own trip after each success', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result, queryClient } = await renderUploads(manual.repository, trip.id);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    await act(async () => result.current.uploads.add(gallery(1)));
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tripPhotosKey(trip.id) });

    await act(async () => manual.uploads[0].succeed());

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: tripPhotosKey(trip.id) }));
  });

  it('does not invalidate the photos when an upload fails', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result, queryClient } = await renderUploads(manual.repository, trip.id);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    await act(async () => result.current.uploads.add(gallery(1)));

    await act(async () => manual.uploads[0].fail());

    await waitFor(() => expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed']));
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tripPhotosKey(trip.id) });
  });
});

describe('usePhotoUploads: offline (manual step 8)', () => {
  it('fails waiting photos without any network call, and sends them when the user retries online', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => setNetwork(OFFLINE));

    await act(async () => result.current.uploads.add(gallery(2)));

    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed', 'failed']);
    expect(result.current.uploads.failedCount).toBe(2);
    expect(result.current.uploads.progress).toBeNull();
    expect(manual.addPhoto).not.toHaveBeenCalled();

    // Coming back online does not send anything by itself: the user decides ("Spróbuj ponownie").
    await act(async () => setNetwork(ONLINE));
    expect(manual.addPhoto).not.toHaveBeenCalled();

    await act(async () => result.current.uploads.retryFailed());
    await waitFor(() => expect(manual.uploads).toHaveLength(1));
    expect(manual.uploads[0].photoId).toBe(photoId(1));
    await act(async () => manual.uploads[0].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    expect(manual.uploads[1].photoId).toBe(photoId(2));
  });

  it('does not send a retried photo while still offline', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => setNetwork(OFFLINE));
    await act(async () => result.current.uploads.add(gallery(1)));

    await act(async () => result.current.uploads.retryFailed());

    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['failed']);
    expect(manual.addPhoto).not.toHaveBeenCalled();
  });

  it('lets the upload that is already running finish when the connection drops, and fails the rest', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(3)));
    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['sending', 'waiting', 'waiting']);

    await act(async () => setNetwork(OFFLINE));

    expect(result.current.uploads.items.map((item) => item.status)).toEqual(['sending', 'failed', 'failed']);
    expect(result.current.uploads.failedCount).toBe(2);

    await act(async () => manual.uploads[0].succeed());
    await waitFor(() => expect(result.current.uploads.items.map((item) => item.id)).toEqual([photoId(2), photoId(3)]));
    expect(manual.addPhoto).toHaveBeenCalledTimes(1);
  });
});

describe('usePhotoUploads: progress and failedCount (D15)', () => {
  it('counts the photos sent out of those added, and is null when nothing is waiting or sending', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    expect(result.current.uploads.progress).toBeNull();

    await act(async () => result.current.uploads.add(gallery(3)));
    expect(result.current.uploads.progress).toEqual({ done: 0, total: 3 });

    await act(async () => manual.uploads[0].succeed());
    await waitFor(() => expect(result.current.uploads.progress).toEqual({ done: 1, total: 3 }));
    await waitFor(() => expect(manual.uploads).toHaveLength(2));

    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(result.current.uploads.progress).toEqual({ done: 2, total: 3 }));
    await waitFor(() => expect(manual.uploads).toHaveLength(3));

    await act(async () => manual.uploads[2].succeed());
    await waitFor(() => expect(result.current.uploads.progress).toBeNull());
    expect(result.current.uploads.failedCount).toBe(0);
  });

  it('adds photos picked while sending to the same count', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(2)));
    await act(async () => manual.uploads[0].succeed());
    await waitFor(() => expect(result.current.uploads.progress).toEqual({ done: 1, total: 2 }));

    await act(async () => result.current.uploads.add(gallery(2)));

    expect(result.current.uploads.progress).toEqual({ done: 1, total: 4 });
  });

  it('counts a failed photo of the batch in the total, and ends with null when nothing is left to send', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(3)));

    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    expect(result.current.uploads.progress).toEqual({ done: 0, total: 3 });

    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    expect(result.current.uploads.progress).toEqual({ done: 1, total: 3 });

    await act(async () => manual.uploads[2].succeed());
    await waitFor(() => expect(result.current.uploads.progress).toBeNull());
    expect(result.current.uploads.failedCount).toBe(1);
  });

  it('starts a new count when the queue had nothing waiting or sending; earlier failures are not part of it', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(1)));
    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(result.current.uploads.progress).toBeNull());
    expect(result.current.uploads.failedCount).toBe(1);

    await act(async () => result.current.uploads.add(gallery(2)));

    expect(result.current.uploads.progress).toEqual({ done: 0, total: 2 });
    expect(result.current.uploads.failedCount).toBe(1);
  });

  it('counts retried photos once: a failed photo of the batch that is retried does not raise the total', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(3)));
    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    expect(result.current.uploads.progress).toEqual({ done: 0, total: 3 });

    await act(async () => result.current.uploads.retry(photoId(1)));
    expect(result.current.uploads.progress).toEqual({ done: 0, total: 3 });

    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(result.current.uploads.progress).toEqual({ done: 1, total: 3 }));
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
  });

  it('counts retried photos as a new batch when the queue had nothing waiting or sending', async () => {
    const { repository, trip } = await tripInRepository();
    const manual = withManualUploads(repository);
    const { result } = await renderUploads(manual.repository, trip.id);
    await act(async () => result.current.uploads.add(gallery(3)));
    await act(async () => manual.uploads[0].fail());
    await waitFor(() => expect(manual.uploads).toHaveLength(2));
    await act(async () => manual.uploads[1].succeed());
    await waitFor(() => expect(manual.uploads).toHaveLength(3));
    await act(async () => manual.uploads[2].fail());
    await waitFor(() => expect(result.current.uploads.progress).toBeNull());

    await act(async () => result.current.uploads.retryFailed());

    expect(result.current.uploads.progress).toEqual({ done: 0, total: 2 });
    await waitFor(() => expect(manual.uploads).toHaveLength(4));
    await act(async () => manual.uploads[3].succeed());
    await waitFor(() => expect(result.current.uploads.progress).toEqual({ done: 1, total: 2 }));
    await waitFor(() => expect(manual.uploads).toHaveLength(5));
  });
});

describe('usePhotoUploads: switching the trip (A4)', () => {
  async function renderForTwoTrips() {
    const { repository, trip: tripA } = await tripInRepository();
    const tripB = await repository.create(createTripInputFixture());
    const manual = withManualUploads(repository);
    const { queryClient, wrapper } = setup(manual.repository);
    const view = await renderHook(({ id }: { id: string }) => usePhotoUploads(id), { initialProps: { id: tripA.id }, wrapper });
    return { ...view, ...manual, queryClient, repository, tripA, tripB };
  }

  it("starts with an empty queue for the new trip: the old trip's waiting photos are never sent", async () => {
    const { result, rerender, addPhoto, uploads, tripB } = await renderForTwoTrips();
    await act(async () => result.current.add(gallery(3)));
    expect(result.current.items).toHaveLength(3);

    await rerender({ id: tripB.id });

    expect(result.current.items).toEqual([]);
    expect(result.current.progress).toBeNull();
    expect(result.current.failedCount).toBe(0);

    // The upload that was running finishes; the two that were waiting are gone with the queue.
    await act(async () => uploads[0].succeed());
    await settle();
    expect(addPhoto).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([]);
  });

  it("a late success of the old trip's upload invalidates its own photos and leaves the new trip's queue alone", async () => {
    const { result, rerender, uploads, queryClient, tripA, tripB } = await renderForTwoTrips();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    await act(async () => result.current.add(gallery(1)));
    await rerender({ id: tripB.id });
    // The new trip's own photo goes out meanwhile (it does not wait for the other trip's upload).
    await act(async () => result.current.add(gallery(2)));
    const before = result.current.items;
    expect(result.current.progress).toEqual({ done: 0, total: 2 });
    expect(uploads).toHaveLength(2);

    await act(async () => uploads[0].succeed());

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: tripPhotosKey(tripA.id) }));
    await settle();
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tripPhotosKey(tripB.id) });
    expect(result.current.items).toEqual(before);
    expect(result.current.progress).toEqual({ done: 0, total: 2 });
  });

  it("a late failure of the old trip's upload does not touch the new trip's queue either", async () => {
    const { result, rerender, uploads, tripB } = await renderForTwoTrips();
    await act(async () => result.current.add(gallery(1)));
    await rerender({ id: tripB.id });
    await act(async () => result.current.add(gallery(2)));
    const before = result.current.items;

    await act(async () => uploads[0].fail());
    await settle();

    expect(result.current.items).toEqual(before);
    expect(result.current.failedCount).toBe(0);
    expect(result.current.progress).toEqual({ done: 0, total: 2 });
  });

  it('starts empty again when coming back to the first trip', async () => {
    const { result, rerender, uploads, tripA, tripB } = await renderForTwoTrips();
    await act(async () => result.current.add(gallery(2)));
    await rerender({ id: tripB.id });

    await rerender({ id: tripA.id });

    expect(result.current.items).toEqual([]);
    await act(async () => uploads[0].fail()); // the first trip's old upload ends: nothing comes back
    await settle();
    expect(result.current.items).toEqual([]);
    expect(result.current.failedCount).toBe(0);
  });
});

describe('useDeleteTripPhoto', () => {
  async function tripWithPhoto() {
    const { repository, trip } = await tripInRepository();
    await repository.addPhoto(trip.id, photoId(1), gallery(1)[0]);
    const [photo] = await repository.photos(trip.id);
    return { repository, trip, photo };
  }

  it('deletes the photo through the repository and refreshes the photos of the trip', async () => {
    const { repository, trip, photo } = await tripWithPhoto();
    const deletePhoto = jest.fn(repository.deletePhoto);
    const { wrapper } = setup({ ...repository, deletePhoto });
    const { result } = await renderHook(() => ({ list: useTripPhotos(trip.id), remove: useDeleteTripPhoto(trip.id) }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    await act(async () => {
      await result.current.remove.mutateAsync(photo);
    });

    expect(deletePhoto).toHaveBeenCalledWith(photo);
    await waitFor(() => expect(result.current.list.data).toEqual([]));
  });

  it('is done only once the refreshed list has arrived, so the viewer never shows the deleted photo', async () => {
    const { repository, trip, photo } = await tripWithPhoto();
    let hold = false;
    let release = () => {};
    const photos = jest.fn(async (tripId: string) => {
      if (hold) await new Promise<void>((resolve) => (release = resolve));
      return repository.photos(tripId);
    });
    const { wrapper } = setup({ ...repository, photos });
    const { result } = await renderHook(() => ({ list: useTripPhotos(trip.id), remove: useDeleteTripPhoto(trip.id) }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    hold = true;

    await act(async () => result.current.remove.mutate(photo));
    await waitFor(() => expect(photos).toHaveBeenCalledTimes(2));
    await settle();
    expect(result.current.remove.isPending).toBe(true);
    expect(result.current.list.data).toHaveLength(1);

    await act(async () => release());
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(result.current.list.data).toEqual([]);
  });

  it('exposes an error and leaves the list as it is', async () => {
    const { repository, trip, photo } = await tripWithPhoto();
    const photos = jest.fn(repository.photos);
    const deletePhoto = jest.fn(() => Promise.reject(new Error('photo-not-deletable')));
    const { wrapper } = setup({ ...repository, photos, deletePhoto });
    const { result } = await renderHook(() => ({ list: useTripPhotos(trip.id), remove: useDeleteTripPhoto(trip.id) }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    await act(async () => {
      await result.current.remove.mutateAsync(photo).catch(() => {});
    });

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(result.current.remove.error).toEqual(new Error('photo-not-deletable'));
    expect(photos).toHaveBeenCalledTimes(1);
    expect(result.current.list.data).toHaveLength(1);
  });

  it('waits for the connection instead of failing offline (D8)', async () => {
    const { repository, trip, photo } = await tripWithPhoto();
    const deletePhoto = jest.fn(repository.deletePhoto);
    const { wrapper } = setup({ ...repository, deletePhoto });
    onlineManager.setOnline(false);
    try {
      const { result } = await renderHook(() => useDeleteTripPhoto(trip.id), { wrapper });

      await act(async () => result.current.mutate(photo));

      await waitFor(() => expect(result.current.isPaused).toBe(true));
      expect(deletePhoto).not.toHaveBeenCalled();

      await act(async () => onlineManager.setOnline(true));
      await waitFor(() => expect(deletePhoto).toHaveBeenCalledWith(photo));
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
