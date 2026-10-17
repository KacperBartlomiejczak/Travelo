import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';

import { useTripRepository } from '@/providers/AppProviders';
import { useIsOffline } from '@/providers/BudgetSync';
import type { PickedPhoto, TripPhoto } from '@/schemas';

/**
 * The photos of one trip. Outside `['trips']` on purpose: budget saves and renames re-read the trips,
 * which must not sign every photo again (trip-photos Approach).
 */
export const tripPhotosKey = (tripId: string) => ['trip-photos', tripId] as const;

/** The trip's photos in display order; offline the repository answers from the copy on the phone (trip-photos D8). */
export function useTripPhotos(tripId: string) {
  const repository = useTripRepository();
  return useQuery({ queryKey: tripPhotosKey(tripId), queryFn: () => repository.photos(tripId), networkMode: 'always' });
}

/** A picked photo on its way to the server. Local UI state, not an entity: the queue is not kept on the phone (trip-photos A4, D8). */
export type PhotoUpload = PickedPhoto & { id: string; status: 'waiting' | 'sending' | 'failed' };

type Queue = {
  tripId: string;
  items: PhotoUpload[];
  /** Photos counted in the „Wysyłam zdjęcia: {done} z {total}” line: those added or retried since nothing was waiting or sending. */
  batch: string[];
  /** How many photos of the batch were sent. */
  done: number;
};

const emptyQueue = (tripId: string): Queue => ({ tripId, items: [], batch: [], done: 0 });
const isActive = (item: PhotoUpload) => item.status !== 'failed';

function withStatus(queue: Queue, ids: string[], status: PhotoUpload['status']): Queue {
  if (!queue.items.some((item) => ids.includes(item.id))) return queue;
  return { ...queue, items: queue.items.map((item) => (ids.includes(item.id) ? { ...item, status } : item)) };
}

/** The batch after `ids` joined the queue: a new one when nothing was waiting or sending, else the current one plus them. */
function joinBatch(queue: Queue, ids: string[]): Pick<Queue, 'batch' | 'done'> {
  if (!queue.items.some(isActive)) return { batch: ids, done: 0 };
  return { batch: [...new Set([...queue.batch, ...ids])], done: queue.done };
}

/** Puts failed photos (all, or only `onlyId`) back in the waiting state; they keep their ids (trip-photos A5). */
function reviveFailed(queue: Queue, onlyId?: string): Queue {
  const ids = queue.items.filter((item) => item.status === 'failed' && (!onlyId || item.id === onlyId)).map((item) => item.id);
  if (ids.length === 0) return queue;
  return { ...withStatus(queue, ids, 'waiting'), ...joinBatch(queue, ids) };
}

/** Takes a photo out of the queue once it is sent; unknown to this queue (another trip's, an old one) changes nothing. */
function markSent(queue: Queue, id: string): Queue {
  if (!queue.items.some((item) => item.id === id)) return queue;
  return { ...queue, items: queue.items.filter((item) => item.id !== id), done: queue.done + 1 };
}

/**
 * Where the queue goes next, without a network call: offline, waiting photos fail (an upload already running finishes
 * on its own); online, the first waiting photo starts when none is sending, so photos go one at a time in the order added.
 */
function advance(queue: Queue, offline: boolean): Queue {
  const waiting = queue.items.filter((item) => item.status === 'waiting');
  if (waiting.length === 0) return queue;
  if (offline) return withStatus(queue, waiting.map((item) => item.id), 'failed');
  if (queue.items.some((item) => item.status === 'sending')) return queue;
  return withStatus(queue, [waiting[0].id], 'sending');
}

/**
 * The upload queue of one trip (trip-photos A4, D15, P3, P6): photos picked from the gallery are sent one at a time,
 * in the order they were added, while the app is open. A sent photo leaves the queue only after the trip's photo list
 * was read again, so its tile never blinks. A failed one stays `failed` until the user retries it; the same id is
 * sent again, so the server never gets two (A5). Offline nothing starts (see `advance`). Switching the trip starts
 * an empty queue; the old trip's running upload still refreshes its own photos but cannot touch the new queue.
 */
export function usePhotoUploads(tripId: string) {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  const offline = useIsOffline();
  const [queue, setQueue] = useState(() => emptyQueue(tripId));
  // The queue moves on while rendering (React's way of adjusting state to props): a new trip starts empty, and
  // `advance` runs. React renders again at once, so none of the in-between states is ever shown.
  const moved = advance(queue.tripId === tripId ? queue : emptyQueue(tripId), offline);
  if (moved !== queue) setQueue(moved);

  // Only the network call is an effect: it starts when a photo becomes `sending`.
  const sending = queue.items.find((item) => item.status === 'sending');
  useEffect(() => {
    if (!sending) return;
    const { id, uri, takenAt } = sending;
    void (async () => {
      try {
        await repository.addPhoto(tripId, id, { uri, takenAt });
      } catch {
        setQueue((current) => withStatus(current, [id], 'failed'));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: tripPhotosKey(tripId) });
      setQueue((current) => markSent(current, id));
    })();
  }, [sending, tripId, repository, queryClient]);

  const add = (picked: PickedPhoto[]) => {
    if (picked.length === 0) return;
    const added = picked.map(({ uri, takenAt }): PhotoUpload => ({ id: randomUUID(), uri, ...(takenAt ? { takenAt } : {}), status: 'waiting' }));
    setQueue((current) => ({
      ...current,
      items: [...current.items, ...added],
      ...joinBatch(current, added.map((item) => item.id)),
    }));
  };

  const pending = queue.items.filter(isActive).length;
  return {
    items: queue.items,
    add,
    retry: (id: string) => setQueue((current) => reviveFailed(current, id)),
    retryFailed: () => setQueue((current) => reviveFailed(current)),
    progress: pending > 0 ? { done: queue.done, total: queue.batch.length } : null,
    failedCount: queue.items.length - pending,
  };
}

/** Deletes a photo on the server; online only, the UI disables it offline (trip-photos D8). */
export function useDeleteTripPhoto(tripId: string) {
  const repository = useTripRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photo: TripPhoto) => repository.deletePhoto(photo),
    // Awaited, so the caller that continues after the delete already sees the list without the photo.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripPhotosKey(tripId) }),
  });
}
