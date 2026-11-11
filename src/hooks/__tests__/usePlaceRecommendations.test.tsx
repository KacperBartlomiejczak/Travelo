import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

import { PlacesError } from '@/data/places';
import type { RecommendPlacesRequest, RecommendPlacesResponse } from '@/schemas';

import { usePlaceRecommendations } from '../usePlaceRecommendations';

// The default fetcher builds the Supabase client, which tests never reach.
jest.mock('@/data/app-places', () => ({ fetchAppPlaceRecommendations: jest.fn() }));

const REQUEST: RecommendPlacesRequest = { city: 'Lisbon', latitude: 38.72, longitude: -9.14, interests: ['museums', 'beaches'], locale: 'en' };
const RESPONSE: RecommendPlacesResponse = { places: [], remainingToday: 4 };

let queryClient: QueryClient;
let fetcher: jest.Mock<Promise<RecommendPlacesResponse>, [RecommendPlacesRequest]>;

// The default QueryClient (retry 3), not the tests' usual `retry: false`: the hook must set its own policy.
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
const render = () => renderHook(() => usePlaceRecommendations(fetcher), { wrapper });

beforeEach(() => {
  queryClient = new QueryClient();
  fetcher = jest.fn(async (_request: RecommendPlacesRequest) => RESPONSE);
});

describe('usePlaceRecommendations (places step C4)', () => {
  it('makes no call before search, even after a re-render', async () => {
    const { result, rerender } = await render();
    rerender({});
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('search makes one call and exposes data and remainingToday', async () => {
    const { result } = await render();
    await act(async () => result.current.search(REQUEST));
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));
    expect(result.current.remainingToday).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(REQUEST);
  });

  it('the same request again, interests in another order, is served from the cache', async () => {
    const { result } = await render();
    await act(async () => result.current.search(REQUEST));
    await waitFor(() => expect(result.current.data).toBeDefined());
    await act(async () => result.current.search({ ...REQUEST, interests: ['beaches', 'museums'] }));
    await act(async () => result.current.search(REQUEST));
    expect(result.current.data).toEqual(RESPONSE);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a cached request is also served after the hook was unmounted and mounted again', async () => {
    const first = await render();
    await act(async () => first.result.current.search(REQUEST));
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    await first.unmount();
    const second = await render();
    await act(async () => second.result.current.search(REQUEST));
    await waitFor(() => expect(second.result.current.data).toEqual(RESPONSE));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a different request is a new call', async () => {
    const { result } = await render();
    await act(async () => result.current.search(REQUEST));
    await waitFor(() => expect(result.current.data).toBeDefined());
    await act(async () => result.current.search({ ...REQUEST, interests: ['museums'] }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it.each(['limit_reached', 'unauthorized', 'failed', 'offline'] as const)('%s is not retried; the typed error is exposed', async (kind) => {
    fetcher.mockRejectedValue(new PlacesError(kind, kind));
    const { result } = await render();
    await act(async () => result.current.search(REQUEST));
    await waitFor(() => expect(result.current.error).toBe(kind));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retry asks again after a failure, and then clears the error', async () => {
    fetcher.mockRejectedValueOnce(new PlacesError('offline', 'x'));
    const { result } = await render();
    await act(async () => result.current.search(REQUEST));
    await waitFor(() => expect(result.current.error).toBe('offline'));
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('an error that is not a PlacesError is "failed"', async () => {
    fetcher.mockRejectedValue(new Error('boom'));
    const { result } = await render();
    await act(async () => result.current.search(REQUEST));
    await waitFor(() => expect(result.current.error).toBe('failed'));
  });

  it('is not persisted: nothing in the app persists the query cache (Google allows storing only placeId)', async () => {
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) sources.push(readFileSync(path, 'utf8'));
      }
    };
    walk(join(__dirname, '..', '..'));
    expect(sources.filter((source) => /persistQueryClient|PersistQueryClientProvider|query-persist-client|query-async-storage-persister/.test(source))).toEqual([]);
  });
});
